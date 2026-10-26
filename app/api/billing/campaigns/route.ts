import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { db, removeUndefined } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  BillingTransaction,
  CampaignApprovalStatus,
  CampaignStatus,
  DEFAULT_SPONSORED_PLACEMENT_CONFIGS,
  FeaturedCampaign,
  FEATURED_STORE_PACKAGES,
  SponsoredPlacementConfig,
  SponsoredPlacementTier,
} from '@/lib/revenue-model';
import {
  INITIAL_PRODUCTS,
  INITIAL_STORES,
  LocalStore,
  Product,
} from '@/lib/catalog-data';
import {
  recordAdminAuditLog,
  serverProductOverridesRegistry,
  serverStoreOverridesRegistry,
  verifyAdminRequest,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

const VALID_PLACEMENT_TIERS: SponsoredPlacementTier[] = [
  'CATEGORY_SPONSORED',
  'LOCAL_FEATURED',
  'HOMEPAGE_SPONSORED',
];

declare global {
  var __serverSponsoredPricingOverride:
    | {
        placements: Record<SponsoredPlacementTier, SponsoredPlacementConfig>;
        livePaymentsApproved: boolean;
        updatedAt: string;
        updatedBy: string;
      }
    | undefined;
  var __serverCampaignsRegistry: Map<string, FeaturedCampaign> | undefined;
  var __serverCampaignTransactionsRegistry:
    | Map<string, BillingTransaction>
    | undefined;
  var __serverMetricDedupeRegistry: Map<string, number> | undefined;
}

if (!globalThis.__serverCampaignsRegistry) {
  globalThis.__serverCampaignsRegistry = new Map<string, FeaturedCampaign>();
}
if (!globalThis.__serverCampaignTransactionsRegistry) {
  globalThis.__serverCampaignTransactionsRegistry = new Map<
    string,
    BillingTransaction
  >();
}
if (!globalThis.__serverMetricDedupeRegistry) {
  globalThis.__serverMetricDedupeRegistry = new Map<string, number>();
}

const serverCampaignsRegistry = globalThis.__serverCampaignsRegistry!;
const serverCampaignTransactionsRegistry =
  globalThis.__serverCampaignTransactionsRegistry!;
const serverMetricDedupeRegistry = globalThis.__serverMetricDedupeRegistry!;

async function loadServerPlacementSettings(): Promise<{
  placements: Record<SponsoredPlacementTier, SponsoredPlacementConfig>;
  livePaymentsApproved: boolean;
}> {
  try {
    const snap = await getDoc(doc(db, 'platformSettings', 'sponsoredPricing'));
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.placements) {
        const mergedPlacements: Record<
          SponsoredPlacementTier,
          SponsoredPlacementConfig
        > = {
          ...DEFAULT_SPONSORED_PLACEMENT_CONFIGS,
          ...data.placements,
        };
        const livePaymentsApproved = Boolean(data.livePaymentsApproved);
        globalThis.__serverSponsoredPricingOverride = {
          placements: mergedPlacements,
          livePaymentsApproved,
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedBy: data.updatedBy || 'super_admin',
        };
        return {
          placements: mergedPlacements,
          livePaymentsApproved,
        };
      }
    }
  } catch {
    // Fallback to in-memory or default configs
  }

  if (globalThis.__serverSponsoredPricingOverride) {
    return {
      placements: globalThis.__serverSponsoredPricingOverride.placements,
      livePaymentsApproved:
        globalThis.__serverSponsoredPricingOverride.livePaymentsApproved,
    };
  }

  return {
    placements: JSON.parse(JSON.stringify(DEFAULT_SPONSORED_PLACEMENT_CONFIGS)),
    livePaymentsApproved: false,
  };
}

function enrichCampaignForClient(
  raw: FeaturedCampaign,
  nowIso: string
): FeaturedCampaign {
  const isExpired = Boolean(raw.endDate && raw.endDate < nowIso);
  const isFutureScheduled = Boolean(raw.startDate && raw.startDate > nowIso);

  let effectiveStatus: CampaignStatus = raw.status;
  if (
    (raw.status === 'ACTIVE' || raw.status === 'SCHEDULED') &&
    isExpired
  ) {
    effectiveStatus = 'EXPIRED';
  } else if (
    raw.status === 'SCHEDULED' &&
    !isFutureScheduled &&
    !isExpired &&
    raw.approvalStatus !== 'REJECTED'
  ) {
    effectiveStatus = 'ACTIVE';
  }

  return {
    ...raw,
    status: effectiveStatus,
    pricePaid: raw.pricePaid ?? raw.budgetInr,
    city: raw.city ?? raw.cityName,
    category: raw.category ?? raw.categoryName,
  };
}

async function resolveAuthoritativeStoreAndProduct(params: {
  storeId: string;
  targetProductId?: string;
}): Promise<{
  store: LocalStore | null;
  product: Product | null;
  isStoreEligible: boolean;
  isProductEligible: boolean;
  ineligibleReason?: string;
}> {
  const { storeId, targetProductId } = params;

  // 1. Resolve store
  let store: LocalStore | null =
    INITIAL_STORES.find((s) => s.id === storeId) || null;
  try {
    const storeSnap = await getDoc(doc(db, 'stores', storeId));
    if (storeSnap.exists()) {
      store = storeSnap.data() as LocalStore;
    }
  } catch {
    // Use initial store fallback if available
  }

  // Check if store was deleted or suspended
  try {
    const deletedSnap = await getDoc(doc(db, 'deleted_stores', storeId));
    if (deletedSnap.exists()) {
      return {
        store: null,
        product: null,
        isStoreEligible: false,
        isProductEligible: false,
        ineligibleReason: 'Store has been permanently deleted.',
      };
    }
  } catch {
    // Ignore
  }

  const storeOverride = serverStoreOverridesRegistry?.get(storeId);
  const isStoreSuspended = Boolean(
    storeOverride?.isSuspended ?? store?.isSuspended
  );
  const isStoreActive = Boolean(
    storeOverride?.isActive ?? store?.isActive ?? true
  );

  if (!store || isStoreSuspended || !isStoreActive) {
    return {
      store,
      product: null,
      isStoreEligible: false,
      isProductEligible: false,
      ineligibleReason: !store
        ? 'Store not found.'
        : 'Store is currently suspended or inactive and cannot run promotional campaigns.',
    };
  }

  if (!targetProductId) {
    return {
      store,
      product: null,
      isStoreEligible: true,
      isProductEligible: true,
    };
  }

  // 2. Resolve product
  let product: Product | null =
    INITIAL_PRODUCTS.find((p) => p.id === targetProductId) || null;
  try {
    const prodSnap = await getDoc(doc(db, 'products', targetProductId));
    if (prodSnap.exists()) {
      product = prodSnap.data() as Product;
    }
  } catch {
    // Use initial product fallback if available
  }

  if (!product) {
    return {
      store,
      product: null,
      isStoreEligible: true,
      isProductEligible: false,
      ineligibleReason: 'Target product not found in catalog.',
    };
  }

  if (product.storeId !== storeId) {
    return {
      store,
      product,
      isStoreEligible: true,
      isProductEligible: false,
      ineligibleReason:
        'Security Error: You can only promote products belonging to your own store.',
    };
  }

  const prodOverride = serverProductOverridesRegistry?.get(targetProductId);
  const isUnpublished = Boolean(
    prodOverride?.adminUnpublished ?? product.adminUnpublished
  );
  const isAvailable = Boolean(
    prodOverride?.isAvailable ?? product.isAvailable
  );
  const hasStock = Number(product.stock) > 0;

  if (isUnpublished || !isAvailable || !hasStock) {
    return {
      store,
      product,
      isStoreEligible: true,
      isProductEligible: false,
      ineligibleReason:
        'This product is currently unpublished, unavailable, or out of stock and cannot be promoted.',
    };
  }

  return {
    store,
    product,
    isStoreEligible: true,
    isProductEligible: true,
  };
}

async function getAllCampaignsMerged(): Promise<Map<string, FeaturedCampaign>> {
  const merged = new Map<string, FeaturedCampaign>();
  for (const [id, camp] of serverCampaignsRegistry.entries()) {
    merged.set(id, camp);
  }
  try {
    const snap = await getDocs(collection(db, 'featuredCampaigns'));
    snap.forEach((docSnap) => {
      const raw = docSnap.data() as FeaturedCampaign;
      if (raw && raw.id) {
        merged.set(raw.id, raw);
        serverCampaignsRegistry.set(raw.id, raw);
      }
    });
  } catch {
    // Fallback to in-memory registry
  }
  return merged;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');
    const sellerId = searchParams.get('sellerId');
    const cityId = searchParams.get('cityId');
    const requestedIncludeExpired =
      searchParams.get('includeExpired') === 'true' ||
      searchParams.get('includeAll') === 'true';

    // Only allow unscoped includeExpired/includeAll if the caller is a verified Admin/Super Admin,
    // or if scoped to a specific storeId / sellerId
    let includeExpired = false;
    if (requestedIncludeExpired) {
      if (storeId || sellerId) {
        includeExpired = true;
      } else {
        const adminCheck = await verifyAdminRequest(req);
        if (adminCheck.authorized) {
          includeExpired = true;
        }
      }
    }

    const [{ placements: placementConfigs, livePaymentsApproved }, mergedMap] =
      await Promise.all([
        loadServerPlacementSettings(),
        getAllCampaignsMerged(),
      ]);

    const nowIso = new Date().toISOString();
    const campaigns: FeaturedCampaign[] = [];

    for (const raw of mergedMap.values()) {
      if (!raw || !raw.id) continue;

      const enriched = enrichCampaignForClient(raw, nowIso);

      if (storeId && enriched.storeId !== storeId) continue;
      if (sellerId && enriched.sellerId !== sellerId) continue;
      if (cityId && enriched.cityId !== cityId) continue;

      // For public buyer discovery (!includeExpired), enforce strict eligibility & schedule boundaries
      if (!includeExpired) {
        if (enriched.status !== 'ACTIVE') continue;
        if (enriched.approvalStatus === 'REJECTED') continue;
        if (enriched.paymentStatus === 'FAILED' || enriched.paymentStatus === 'REFUNDED') {
          continue;
        }
        if (enriched.startDate && enriched.startDate > nowIso) continue;
        if (enriched.endDate && enriched.endDate < nowIso) continue;

        // Check store/product overrides so suspended stores or unpublished products never appear as sponsored
        const storeOverride = serverStoreOverridesRegistry?.get(enriched.storeId);
        if (storeOverride && (storeOverride.isSuspended || !storeOverride.isActive)) {
          continue;
        }
        if (enriched.targetProductId) {
          const prodOverride = serverProductOverridesRegistry?.get(
            enriched.targetProductId
          );
          if (
            prodOverride &&
            (prodOverride.adminUnpublished || !prodOverride.isAvailable)
          ) {
            continue;
          }
        }
      }

      campaigns.push(enriched);
    }

    campaigns.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );

    const placementConfigsList = VALID_PLACEMENT_TIERS.map(
      (tier) => placementConfigs[tier]
    );

    return NextResponse.json({
      ok: true,
      success: true,
      campaigns,
      placementConfigs,
      placementConfigsList,
      livePaymentsApproved,
      pricingStatus: livePaymentsApproved
        ? 'APPROVED_LIVE_PRICING'
        : 'PROPOSED_LAUNCH_PRICING_SANDBOX_ONLY',
      razorpayConfigured: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load campaigns';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'LAUNCH_CAMPAIGN';

    // =========================================================================
    // ACTION 1: RECORD IMPRESSION OR CLICK METRIC (WITH ELIGIBILITY & DEDUPE)
    // =========================================================================
    if (action === 'RECORD_METRIC') {
      const campaignId =
        typeof body.campaignId === 'string' ? body.campaignId.trim() : '';
      const rawMetric = body.metricType || body.metric;
      const metricType =
        rawMetric === 'IMPRESSION' || rawMetric === 'CLICK' ? rawMetric : null;

      if (!campaignId || !metricType) {
        return NextResponse.json(
          { ok: false, error: 'Invalid metric parameters' },
          { status: 400 }
        );
      }

      // Rate-limit / deduplicate identical metric bursts per IP + campaignId + metricType
      const clientIp =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      const dedupeKey = `${clientIp}:${campaignId}:${metricType}`;
      const nowMs = Date.now();
      const cooldownMs = metricType === 'IMPRESSION' ? 30_000 : 2_000;
      const lastRecorded = serverMetricDedupeRegistry.get(dedupeKey) || 0;
      if (nowMs - lastRecorded < cooldownMs) {
        return NextResponse.json({
          ok: true,
          success: true,
          deduplicated: true,
        });
      }

      // Verify campaign is genuinely ACTIVE and within valid date window before recording metrics
      const mergedMap = await getAllCampaignsMerged();
      const targetCampaign = mergedMap.get(campaignId);
      const nowIso = new Date().toISOString();

      if (targetCampaign) {
        const enriched = enrichCampaignForClient(targetCampaign, nowIso);
        if (
          enriched.status !== 'ACTIVE' ||
          enriched.approvalStatus === 'REJECTED' ||
          (enriched.startDate && enriched.startDate > nowIso) ||
          (enriched.endDate && enriched.endDate < nowIso)
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Cannot record active placement metrics for an inactive, paused, rejected, or expired campaign.',
            },
            { status: 400 }
          );
        }

        const updated: FeaturedCampaign = {
          ...targetCampaign,
          impressions:
            metricType === 'IMPRESSION'
              ? (Number(targetCampaign.impressions) || 0) + 1
              : Number(targetCampaign.impressions) || 0,
          clicks:
            metricType === 'CLICK'
              ? (Number(targetCampaign.clicks) || 0) + 1
              : Number(targetCampaign.clicks) || 0,
          updatedAt: nowIso,
        };
        serverCampaignsRegistry.set(campaignId, updated);
      }

      serverMetricDedupeRegistry.set(dedupeKey, nowMs);
      if (serverMetricDedupeRegistry.size > 5000) {
        const oldestKey = serverMetricDedupeRegistry.keys().next().value;
        if (oldestKey) serverMetricDedupeRegistry.delete(oldestKey);
      }

      const fieldToIncrement =
        metricType === 'CLICK' ? 'clicks' : 'impressions';

      try {
        await updateDoc(doc(db, 'featuredCampaigns', campaignId), {
          [fieldToIncrement]: increment(1),
          updatedAt: nowIso,
        });
      } catch {
        // Ignore if campaign exists only in memory/local state
      }

      return NextResponse.json({ ok: true, success: true });
    }

    // =========================================================================
    // ACTION 2: SELLER PAUSE / RESUME OWN CAMPAIGN (STRICT OWNERSHIP CHECK)
    // =========================================================================
    if (action === 'SELLER_PAUSE_RESUME') {
      const { campaignId, sellerId, storeId, status: requestedStatus } = body;

      if (
        !campaignId ||
        !sellerId ||
        !storeId ||
        (requestedStatus !== 'PAUSED' && requestedStatus !== 'ACTIVE')
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Invalid parameters. Sellers may only pause or resume their own active campaigns.',
          },
          { status: 400 }
        );
      }

      const mergedMap = await getAllCampaignsMerged();
      const existing = mergedMap.get(campaignId);
      if (!existing) {
        return NextResponse.json(
          { ok: false, error: 'Campaign not found.' },
          { status: 404 }
        );
      }

      if (existing.sellerId !== sellerId || existing.storeId !== storeId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Security Error: You cannot modify a campaign belonging to another seller or store.',
          },
          { status: 403 }
        );
      }

      const caller = await verifyAuthenticatedCaller(req);
      const adminCheck = await verifyAdminRequest(req);
      if (caller.authenticated && !adminCheck.authorized) {
        const matchesCaller =
          (caller.sellerId && caller.sellerId === existing.sellerId) ||
          (caller.uid && caller.uid === existing.ownerUid) ||
          (caller.storeIds && caller.storeIds.includes(existing.storeId));
        if (!matchesCaller && caller.sellerId) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Security Error: Authenticated session does not own this campaign.',
            },
            { status: 403 }
          );
        }
      }

      const nowIso = new Date().toISOString();
      if (existing.endDate && existing.endDate < nowIso) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Expired campaigns cannot be resumed.',
          },
          { status: 400 }
        );
      }

      if (
        existing.approvalStatus === 'REJECTED' ||
        existing.status === 'REJECTED' ||
        existing.status === 'PENDING_PAYMENT' ||
        existing.paymentStatus === 'FAILED'
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Rejected or unpaid campaigns cannot be activated by the seller.',
          },
          { status: 400 }
        );
      }

      const updated: FeaturedCampaign = {
        ...existing,
        status: requestedStatus,
        updatedAt: nowIso,
      };
      serverCampaignsRegistry.set(campaignId, updated);

      try {
        await setDoc(
          doc(db, 'featuredCampaigns', campaignId),
          removeUndefined({ status: requestedStatus, updatedAt: nowIso }),
          { merge: true }
        );
      } catch {
        // Fallback to server memory registry
      }

      return NextResponse.json({
        ok: true,
        success: true,
        campaign: enrichCampaignForClient(updated, nowIso),
        message: `Campaign is now ${requestedStatus.toLowerCase()}.`,
      });
    }

    // =========================================================================
    // ACTION 3: ADMIN / SUPER ADMIN CAMPAIGN MODERATION & PRICING CONTROLS
    // Strictly requires server-verified Admin / Super Admin authentication!
    // =========================================================================
    if (action === 'ADMIN_UPDATE') {
      const adminAuth = await verifyAdminRequest(req);
      if (!adminAuth.authorized) {
        return NextResponse.json(
          {
            ok: false,
            error:
              adminAuth.reason ||
              'Unauthorized: Administrator authentication is required for campaign moderation and pricing updates.',
          },
          { status: adminAuth.status }
        );
      }

      const {
        subAction,
        campaignId,
        status,
        approvalStatus,
        adminNotes,
        placementConfigs: incomingPlacements,
        livePaymentsApproved,
      } = body;

      const nowIso = new Date().toISOString();

      // Sub-Action A: Update global Sponsored Placement Pricing & Availability (Super Admin Only)
      if (subAction === 'UPDATE_PRICING' || incomingPlacements) {
        if (!adminAuth.isSuperAdmin) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Permission Denied: Only the Platform Owner Super Admin can modify global sponsored placement pricing.',
            },
            { status: 403 }
          );
        }

        const currentSettings = await loadServerPlacementSettings();
        const normalizedPlacements: Record<
          SponsoredPlacementTier,
          SponsoredPlacementConfig
        > = {
          ...currentSettings.placements,
        };

        if (Array.isArray(incomingPlacements)) {
          for (const item of incomingPlacements) {
            if (
              item &&
              VALID_PLACEMENT_TIERS.includes(item.id as SponsoredPlacementTier)
            ) {
              const tier = item.id as SponsoredPlacementTier;
              const existingTier = normalizedPlacements[tier];
              const price7 = Math.max(
                1,
                Math.min(
                  100000,
                  Number(
                    item.price7DaysInr ??
                      item.packages?.find((p: { days: number }) => p.days === 7)
                        ?.priceInr ??
                      existingTier.packages[0].priceInr
                  )
                )
              );
              const price30 = Math.max(
                1,
                Math.min(
                  100000,
                  Number(
                    item.price30DaysInr ??
                      item.packages?.find(
                        (p: { days: number }) => p.days === 30
                      )?.priceInr ??
                      existingTier.packages[1].priceInr
                  )
                )
              );
              const isEnabled =
                typeof item.isEnabled === 'boolean'
                  ? item.isEnabled
                  : typeof item.isActive === 'boolean'
                    ? item.isActive
                    : existingTier.isEnabled;

              normalizedPlacements[tier] = {
                ...existingTier,
                isEnabled,
                packages: [
                  {
                    ...existingTier.packages[0],
                    days: 7,
                    priceInr: price7,
                  },
                  {
                    ...existingTier.packages[1],
                    days: 30,
                    priceInr: price30,
                  },
                ],
              };
            }
          }
        } else if (
          incomingPlacements &&
          typeof incomingPlacements === 'object'
        ) {
          for (const tier of VALID_PLACEMENT_TIERS) {
            const item = (incomingPlacements as Record<string, any>)[tier];
            if (item) {
              const existingTier = normalizedPlacements[tier];
              const pkg7 =
                item.packages?.find((p: { days: number }) => p.days === 7)
                  ?.priceInr ?? existingTier.packages[0].priceInr;
              const pkg30 =
                item.packages?.find((p: { days: number }) => p.days === 30)
                  ?.priceInr ?? existingTier.packages[1].priceInr;
              normalizedPlacements[tier] = {
                ...existingTier,
                ...item,
                isEnabled: Boolean(item.isEnabled ?? existingTier.isEnabled),
                packages: [
                  {
                    ...existingTier.packages[0],
                    days: 7,
                    priceInr: Math.max(1, Math.min(100000, Number(pkg7))),
                  },
                  {
                    ...existingTier.packages[1],
                    days: 30,
                    priceInr: Math.max(1, Math.min(100000, Number(pkg30))),
                  },
                ],
              };
            }
          }
        }

        const nextLiveApproved =
          typeof livePaymentsApproved === 'boolean'
            ? livePaymentsApproved
            : currentSettings.livePaymentsApproved;

        globalThis.__serverSponsoredPricingOverride = {
          placements: normalizedPlacements,
          livePaymentsApproved: nextLiveApproved,
          updatedAt: nowIso,
          updatedBy: adminAuth.phoneE164,
        };

        const payload = removeUndefined({
          id: 'sponsoredPricing',
          placements: normalizedPlacements,
          livePaymentsApproved: nextLiveApproved,
          updatedAt: nowIso,
          updatedBy: adminAuth.phoneE164,
        });

        try {
          await setDoc(doc(db, 'platformSettings', 'sponsoredPricing'), payload, {
            merge: true,
          });
        } catch {
          // Persisted in server memory registry if client SDK requires user auth token
        }

        await recordAdminAuditLog({
          adminUid: adminAuth.firebaseUid,
          adminPhone: adminAuth.phoneE164,
          adminRole: adminAuth.role,
          actionType: 'UPDATE_SPONSORED_PRICING',
          targetEntityType: 'PLATFORM_SETTINGS',
          targetEntityId: 'sponsoredPricing',
          targetEntityName: 'Sponsored Product Placement Pricing',
          status: 'SUCCESS',
          reason: `Updated Sponsored Product placement pricing and availability (Category 7d/30d: ₹${normalizedPlacements.CATEGORY_SPONSORED.packages[0].priceInr}/₹${normalizedPlacements.CATEGORY_SPONSORED.packages[1].priceInr}, Local 7d/30d: ₹${normalizedPlacements.LOCAL_FEATURED.packages[0].priceInr}/₹${normalizedPlacements.LOCAL_FEATURED.packages[1].priceInr}, Homepage 7d/30d: ₹${normalizedPlacements.HOMEPAGE_SPONSORED.packages[0].priceInr}/₹${normalizedPlacements.HOMEPAGE_SPONSORED.packages[1].priceInr}).`,
        });

        return NextResponse.json({
          ok: true,
          success: true,
          placementConfigs: normalizedPlacements,
          placementConfigsList: VALID_PLACEMENT_TIERS.map(
            (t) => normalizedPlacements[t]
          ),
          livePaymentsApproved: nextLiveApproved,
          message:
            'Sponsored placement pricing & availability updated and logged.',
        });
      }

      // Sub-Action B: Moderate Specific Campaign (Approve, Reject, Pause, Resume)
      if (campaignId) {
        const mergedMap = await getAllCampaignsMerged();
        const existing = mergedMap.get(campaignId);
        if (!existing) {
          return NextResponse.json(
            { ok: false, error: `Campaign ${campaignId} not found.` },
            { status: 404 }
          );
        }

        const updates: Partial<FeaturedCampaign> = {
          updatedAt: nowIso,
        };
        if (status) updates.status = status as CampaignStatus;
        if (approvalStatus) {
          updates.approvalStatus = approvalStatus as CampaignApprovalStatus;
        }
        if (adminNotes !== undefined) {
          updates.adminNotes = String(adminNotes).slice(0, 500);
        }

        const updatedCampaign: FeaturedCampaign = {
          ...existing,
          ...updates,
        };
        serverCampaignsRegistry.set(campaignId, updatedCampaign);

        try {
          await setDoc(
            doc(db, 'featuredCampaigns', campaignId),
            removeUndefined(updates),
            { merge: true }
          );
        } catch {
          // Fallback to server memory registry
        }

        await recordAdminAuditLog({
          adminUid: adminAuth.firebaseUid,
          adminPhone: adminAuth.phoneE164,
          adminRole: adminAuth.role,
          actionType: 'MODERATE_SPONSORED_CAMPAIGN',
          targetEntityType: 'SPONSORED_CAMPAIGN',
          targetEntityId: campaignId,
          targetEntityName:
            existing.targetProductName || existing.storeName || campaignId,
          status: 'SUCCESS',
          reason: `Campaign ${campaignId} moderated: status=${status || existing.status}, approvalStatus=${approvalStatus || existing.approvalStatus}.${adminNotes ? ` Notes: ${adminNotes}` : ''}`,
        });

        return NextResponse.json({
          ok: true,
          success: true,
          campaign: enrichCampaignForClient(updatedCampaign, nowIso),
          message: `Campaign ${campaignId} updated.`,
        });
      }

      return NextResponse.json(
        { ok: false, error: 'Missing admin update parameters' },
        { status: 400 }
      );
    }

    // =========================================================================
    // ACTION 4: VERIFY RAZORPAY SIGNATURE & ACTIVATE STORED CAMPAIGN
    // Never trusts client-submitted campaign pricing or duration; loads stored
    // PENDING_PAYMENT campaign from authoritative server storage!
    // =========================================================================
    if (action === 'VERIFY_PAYMENT') {
      const {
        campaignId: rawCampaignId,
        campaignDraft,
        gatewayPaymentId,
        gatewayOrderId,
        gatewaySignature,
      } = body as {
        campaignId?: string;
        campaignDraft?: FeaturedCampaign;
        gatewayPaymentId: string;
        gatewayOrderId: string;
        gatewaySignature: string;
      };

      const targetCampaignId = rawCampaignId || campaignDraft?.id || '';

      if (
        !targetCampaignId ||
        !gatewayPaymentId ||
        !gatewayOrderId ||
        !gatewaySignature
      ) {
        return NextResponse.json(
          { ok: false, error: 'Missing required payment verification details' },
          { status: 400 }
        );
      }

      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Razorpay secret is not configured on the server. Payment signature cannot be verified.',
          },
          { status: 501 }
        );
      }

      // 1. Verify HMAC-SHA256 signature using timing-safe comparison
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${gatewayOrderId}|${gatewayPaymentId}`)
        .digest('hex');

      const sigBuf = Buffer.from(gatewaySignature);
      const expBuf = Buffer.from(expectedSignature);
      if (
        sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)
      ) {
        return NextResponse.json(
          { ok: false, error: 'Invalid Razorpay payment signature.' },
          { status: 400 }
        );
      }

      // 2. Load authoritative stored campaign from server/Firestore (never trust client campaignDraft!)
      const mergedMap = await getAllCampaignsMerged();
      const storedCampaign = mergedMap.get(targetCampaignId);
      if (!storedCampaign) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending campaign order not found on server. Cannot verify payment.',
          },
          { status: 404 }
        );
      }

      // 3. Verify that gatewayOrderId matches the exact Razorpay order created for this campaign
      if (
        storedCampaign.razorpayOrderId &&
        storedCampaign.razorpayOrderId !== gatewayOrderId
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Security Error: Razorpay Order ID does not match the campaign order record.',
          },
          { status: 400 }
        );
      }

      // 4. Idempotency check: prevent duplicate activation or payment replay across campaigns
      const txId = `tx_ad_${gatewayPaymentId}`;
      let existingTx = serverCampaignTransactionsRegistry.get(txId);
      if (!existingTx) {
        try {
          const txSnap = await getDoc(doc(db, 'billingTransactions', txId));
          if (txSnap.exists()) {
            existingTx = txSnap.data() as BillingTransaction;
          }
        } catch {
          // Ignore
        }
      }

      if (existingTx) {
        // If this payment was already used for this exact campaign, return idempotent success
        if (
          storedCampaign.paymentReferenceId === gatewayPaymentId &&
          storedCampaign.status === 'ACTIVE'
        ) {
          return NextResponse.json({
            ok: true,
            success: true,
            idempotent: true,
            campaign: enrichCampaignForClient(
              storedCampaign,
              new Date().toISOString()
            ),
            transaction: existingTx,
            message: 'Payment already verified and campaign is active.',
          });
        }
        return NextResponse.json(
          {
            ok: false,
            error:
              'Security Error: This payment reference has already been processed.',
          },
          { status: 409 }
        );
      }

      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(now.getDate() + Number(storedCampaign.durationDays));

      const activatedCampaign: FeaturedCampaign = removeUndefined({
        ...storedCampaign,
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        paymentStatus: 'PAID',
        paymentReferenceId: gatewayPaymentId,
        razorpayOrderId: gatewayOrderId,
        isSandboxProposal: false,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        updatedAt: now.toISOString(),
      });

      const transaction: BillingTransaction = removeUndefined({
        id: txId,
        sellerId: activatedCampaign.sellerId,
        storeId: activatedCampaign.storeId,
        type: 'AD_CAMPAIGN',
        description: `${activatedCampaign.placementLabel || 'Sponsored Product'} (${activatedCampaign.durationDays} days) — ${activatedCampaign.targetProductName || activatedCampaign.storeName}`,
        amount:
          activatedCampaign.basePriceInr || activatedCampaign.budgetInr,
        taxAmount: activatedCampaign.taxAmountInr || 0,
        totalAmount: activatedCampaign.budgetInr,
        currency: 'INR',
        status: 'SUCCESS',
        paymentGateway: 'RAZORPAY',
        gatewayTransactionId: gatewayPaymentId,
        invoiceNumber:
          activatedCampaign.invoiceNumber ||
          `INV-AD-${Date.now().toString().slice(-6)}`,
        createdAt: now.toISOString(),
      });

      serverCampaignsRegistry.set(activatedCampaign.id, activatedCampaign);
      serverCampaignTransactionsRegistry.set(txId, transaction);

      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, 'featuredCampaigns', activatedCampaign.id),
          activatedCampaign
        );
        batch.set(doc(db, 'billingTransactions', txId), transaction);
        await batch.commit();
      } catch (err) {
        console.warn('[campaigns/verify] Firestore write warning:', err);
      }

      return NextResponse.json({
        ok: true,
        success: true,
        campaign: enrichCampaignForClient(
          activatedCampaign,
          now.toISOString()
        ),
        transaction,
        message: 'Payment verified and sponsored campaign activated!',
      });
    }

    // =========================================================================
    // ACTION 5: CREATE / LAUNCH SPONSORED CAMPAIGN (WITH STRICT OWNERSHIP &
    // AUTHORITATIVE SERVER-SIDE PRICING)
    // =========================================================================
    const {
      sellerId,
      ownerUid,
      storeId,
      storeName,
      type = 'SPONSORED_PRODUCT',
      placementTier = 'CATEGORY_SPONSORED',
      targetProductId,
      targetProductName,
      categoryId,
      categoryName,
      cityId,
      cityName,
      durationDays,
      initiateRazorpayOrder = false,
    } = body;

    if (!sellerId || !storeId || !type || !cityId || durationDays === undefined) {
      return NextResponse.json(
        { ok: false, error: 'Missing required campaign parameters' },
        { status: 400 }
      );
    }

    if (type !== 'SPONSORED_PRODUCT' && type !== 'FEATURED_STORE') {
      return NextResponse.json(
        { ok: false, error: 'Invalid campaign placement type.' },
        { status: 400 }
      );
    }

    if (type === 'SPONSORED_PRODUCT' && !targetProductId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A target product ID is required for Sponsored Product campaigns.',
        },
        { status: 400 }
      );
    }

    // Verify caller identity if session/token present, and verify store & product ownership + eligibility
    const caller = await verifyAuthenticatedCaller(req);
    const eligibility = await resolveAuthoritativeStoreAndProduct({
      storeId,
      targetProductId: type === 'SPONSORED_PRODUCT' ? targetProductId : undefined,
    });

    if (!eligibility.isStoreEligible || !eligibility.store) {
      return NextResponse.json(
        {
          ok: false,
          error:
            eligibility.ineligibleReason ||
            'Store is not eligible to create promotional campaigns.',
        },
        { status: 400 }
      );
    }

    // Enforce seller ownership of the store
    if (
      eligibility.store.sellerId &&
      eligibility.store.sellerId !== sellerId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Security Error: Store ownership mismatch. You can only create campaigns for your own store.',
        },
        { status: 403 }
      );
    }

    if (
      caller.authenticated &&
      caller.sellerId &&
      caller.sellerId !== sellerId &&
      !caller.roles.includes('ADMIN')
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Security Error: Authenticated session does not match the requested seller account.',
        },
        { status: 403 }
      );
    }

    if (type === 'SPONSORED_PRODUCT' && !eligibility.isProductEligible) {
      const status = eligibility.ineligibleReason?.startsWith('Security Error')
        ? 403
        : 400;
      return NextResponse.json(
        {
          ok: false,
          error:
            eligibility.ineligibleReason ||
            'Selected product is not eligible for promotion.',
        },
        { status }
      );
    }

    // Authoritative Server-Side Pricing & Duration Validation
    const { placements: placementConfigs, livePaymentsApproved } =
      await loadServerPlacementSettings();
    const numericDuration = Number(durationDays);
    let basePriceInr = 0;
    let placementLabel = '';

    if (type === 'FEATURED_STORE') {
      const pkg = FEATURED_STORE_PACKAGES.find(
        (p) => p.days === numericDuration
      );
      if (!pkg) {
        return NextResponse.json(
          {
            ok: false,
            error: `Unsupported campaign duration (${durationDays} days) for Featured Store. Supported durations: 7, 14, or 30 days.`,
          },
          { status: 400 }
        );
      }
      basePriceInr = pkg.priceInr;
      placementLabel = `Featured Store (${pkg.days} Days)`;
    } else {
      if (
        !VALID_PLACEMENT_TIERS.includes(placementTier as SponsoredPlacementTier)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid sponsored placement tier "${placementTier}". Allowed tiers: CATEGORY_SPONSORED, LOCAL_FEATURED, HOMEPAGE_SPONSORED.`,
          },
          { status: 400 }
        );
      }

      const tierConfig =
        placementConfigs[placementTier as SponsoredPlacementTier];

      if (!tierConfig || !tierConfig.isEnabled) {
        return NextResponse.json(
          {
            ok: false,
            error: `The "${tierConfig?.name || placementTier}" placement is currently disabled by the platform administrator.`,
          },
          { status: 400 }
        );
      }

      const pkg = tierConfig.packages.find((p) => p.days === numericDuration);
      if (!pkg) {
        return NextResponse.json(
          {
            ok: false,
            error: `Unsupported campaign duration (${durationDays} days) for ${tierConfig.name}. Supported durations: 7 or 30 days.`,
          },
          { status: 400 }
        );
      }

      basePriceInr = pkg.priceInr;
      placementLabel = tierConfig.name;
    }

    // Duplicate-submission protection: check if an active campaign already exists for the same store, product, and placement
    const nowIso = new Date().toISOString();
    const mergedMap = await getAllCampaignsMerged();
    for (const existing of mergedMap.values()) {
      const enriched = enrichCampaignForClient(existing, nowIso);
      if (
        enriched.status === 'ACTIVE' &&
        enriched.storeId === storeId &&
        enriched.type === type &&
        (type === 'FEATURED_STORE' ||
          (enriched.targetProductId === targetProductId &&
            enriched.placementTier === placementTier))
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'An active campaign already exists for this product and placement tier.',
          },
          { status: 409 }
        );
      }
    }

    const taxAmountInr = Math.round(basePriceInr * 0.18 * 100) / 100;
    const totalAmountInr =
      Math.round((basePriceInr + taxAmountInr) * 100) / 100;

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + numericDuration);

    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const invoiceNumber = `INV-AD-${Date.now().toString().slice(-6)}`;

    const verifiedProduct = eligibility.product;
    const verifiedStore = eligibility.store;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Path A: Razorpay Order Creation (when Razorpay keys are configured and either test mode or livePaymentsApproved)
    const isTestRazorpayKey = Boolean(keyId && keyId.startsWith('rzp_test_'));
    if (
      initiateRazorpayOrder &&
      keyId &&
      keySecret &&
      (livePaymentsApproved || isTestRazorpayKey)
    ) {
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const rzpOrder = await razorpay.orders.create({
        amount: Math.round(totalAmountInr * 100), // paise
        currency: 'INR',
        receipt: invoiceNumber,
        notes: {
          campaignId,
          sellerId,
          storeId,
          targetProductId: targetProductId || '',
          placementTier: type === 'SPONSORED_PRODUCT' ? placementTier : '',
          durationDays: String(numericDuration),
          type: 'AD_CAMPAIGN',
        },
      });

      const pendingCampaign: FeaturedCampaign = removeUndefined({
        id: campaignId,
        sellerId,
        ownerUid: ownerUid || verifiedStore.ownerUid || sellerId,
        storeId,
        storeName: verifiedStore.name || storeName || 'Local Store',
        type,
        placementTier:
          type === 'SPONSORED_PRODUCT'
            ? (placementTier as SponsoredPlacementTier)
            : undefined,
        placementLabel,
        targetProductId: targetProductId || undefined,
        targetProductName:
          verifiedProduct?.name || targetProductName || undefined,
        targetProductPrice: verifiedProduct?.price,
        targetProductImageUrl: verifiedProduct?.customImageUrl,
        categoryId:
          verifiedProduct?.categoryId ||
          categoryId ||
          verifiedStore.categoryId ||
          undefined,
        categoryName:
          verifiedProduct?.category ||
          categoryName ||
          verifiedStore.category ||
          undefined,
        category:
          verifiedProduct?.category ||
          categoryName ||
          verifiedStore.category ||
          undefined,
        cityId: verifiedStore.cityId || cityId,
        cityName: verifiedStore.cityName || cityName || 'City',
        city: verifiedStore.cityName || cityName || 'City',
        status: 'PENDING_PAYMENT',
        approvalStatus: 'PENDING',
        paymentStatus: 'PENDING',
        razorpayOrderId: rzpOrder.id,
        invoiceNumber,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        durationDays: numericDuration,
        currency: 'INR',
        basePriceInr,
        taxAmountInr,
        budgetInr: totalAmountInr,
        pricePaid: totalAmountInr,
        isSandboxProposal: false,
        impressions: 0,
        clicks: 0,
        attributedOrders: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      // Persist PENDING_PAYMENT campaign authoritatively on server before returning to client
      serverCampaignsRegistry.set(campaignId, pendingCampaign);
      try {
        await setDoc(doc(db, 'featuredCampaigns', campaignId), pendingCampaign);
      } catch (err) {
        console.warn('[campaigns] Pending campaign write notice:', err);
      }

      return NextResponse.json({
        ok: true,
        success: true,
        requiresRazorpayCheckout: true,
        campaignId,
        campaignDraft: pendingCampaign,
        gatewayOptions: {
          key: keyId,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          name: 'Citykart Sponsored Ads',
          description: `${placementLabel} (${numericDuration} Days)`,
          order_id: rzpOrder.id,
        },
      });
    }

    // Path B: Sandbox / Preview Mode (when Razorpay keys are not configured or live charges are gated pending approval)
    const txId = `tx_sandbox_${Date.now()}`;
    const sandboxRef = `sandbox_preview_${Date.now().toString(36)}`;
    const campaign: FeaturedCampaign = removeUndefined({
      id: campaignId,
      sellerId,
      ownerUid: ownerUid || verifiedStore.ownerUid || sellerId,
      storeId,
      storeName: verifiedStore.name || storeName || 'Local Store',
      type,
      placementTier:
        type === 'SPONSORED_PRODUCT'
          ? (placementTier as SponsoredPlacementTier)
          : undefined,
      placementLabel,
      targetProductId: targetProductId || undefined,
      targetProductName:
        verifiedProduct?.name || targetProductName || undefined,
      targetProductPrice: verifiedProduct?.price,
      targetProductImageUrl: verifiedProduct?.customImageUrl,
      categoryId:
        verifiedProduct?.categoryId ||
        categoryId ||
        verifiedStore.categoryId ||
        undefined,
      categoryName:
        verifiedProduct?.category ||
        categoryName ||
        verifiedStore.category ||
        undefined,
      category:
        verifiedProduct?.category ||
        categoryName ||
        verifiedStore.category ||
        undefined,
      cityId: verifiedStore.cityId || cityId,
      cityName: verifiedStore.cityName || cityName || 'City',
      city: verifiedStore.cityName || cityName || 'City',
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      paymentStatus: 'SANDBOX_TEST',
      paymentReferenceId: sandboxRef,
      invoiceNumber,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      durationDays: numericDuration,
      currency: 'INR',
      basePriceInr,
      taxAmountInr,
      budgetInr: totalAmountInr,
      pricePaid: totalAmountInr,
      isSandboxProposal: true,
      impressions: 0,
      clicks: 0,
      attributedOrders: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const transaction: BillingTransaction = removeUndefined({
      id: txId,
      sellerId,
      storeId,
      type: 'AD_CAMPAIGN',
      description: `[Sandbox Preview — No Live Charge] ${placementLabel} (${numericDuration} days) — ${campaign.targetProductName || campaign.storeName}`,
      amount: basePriceInr,
      taxAmount: taxAmountInr,
      totalAmount: totalAmountInr,
      currency: 'INR',
      status: 'SUCCESS',
      paymentGateway: 'OFFLINE_TRANSFER',
      gatewayTransactionId: sandboxRef,
      invoiceNumber,
      createdAt: now.toISOString(),
    });

    serverCampaignsRegistry.set(campaign.id, campaign);
    serverCampaignTransactionsRegistry.set(transaction.id, transaction);

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'featuredCampaigns', campaign.id), campaign);
      batch.set(doc(db, 'billingTransactions', transaction.id), transaction);
      await batch.commit();
    } catch (err) {
      console.warn('[campaigns] Firestore persist notice:', err);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      isSandboxProposal: true,
      campaign: enrichCampaignForClient(campaign, now.toISOString()),
      transaction,
      message: `Sandbox campaign activated (Proposed fee: ₹${basePriceInr} + ₹${taxAmountInr} GST = ₹${totalAmountInr}; no live seller charge made). "${campaign.targetProductName || campaign.storeName}" is now promoted under ${placementLabel} for ${numericDuration} days.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Campaign operation failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
