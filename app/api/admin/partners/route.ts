import { NextRequest, NextResponse } from 'next/server';
import {
  normalizePhoneE164,
  recordAdminAuditLog,
  verifyAdminRequest,
} from '@/lib/super-admin-auth';
import {
  partnerApplications,
  PartnerApplication,
} from '@/lib/partner-applications-registry';
import { findCanonicalCityById } from '@/lib/global-locations-data';
import {
  PartnerManualPayoutRecord,
  PartnerMonthlySettlementStatement,
  serverPartnerSettlementsRegistry,
} from '@/lib/partner-program';
import { INITIAL_ORDERS, INITIAL_STORES } from '@/lib/initial-data';
import { serverStoresRegistry } from '@/lib/stores-registry';
import { serverOrdersRegistry } from '@/lib/orders-registry';

declare global {
  var __serverPartnerLifecycleOverrides:
    | Map<
        string,
        {
          status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
          suspensionReason?: string;
          deactivationReason?: string;
          assignedCityId?: string;
          assignedCityName?: string;
          assignedStateRegion?: string;
          assignedCountry?: string;
          assignedCountryCode?: string;
          updatedAt: string;
        }
      >
    | undefined;
}

if (!globalThis.__serverPartnerLifecycleOverrides) {
  globalThis.__serverPartnerLifecycleOverrides = new Map();
}
const partnerLifecycleOverrides = globalThis.__serverPartnerLifecycleOverrides;

function resolveAppIdFromPartnerId(partnerIdOrAppId: string): string {
  const clean = String(partnerIdOrAppId || '').trim();
  if (partnerApplications.has(clean)) return clean;
  if (clean.startsWith('partner_')) {
    const stripped = clean.replace(/^partner_/, '');
    if (partnerApplications.has(stripped)) return stripped;
  }
  for (const app of partnerApplications.values()) {
    if (`partner_${app.id}` === clean || app.id === clean) {
      return app.id;
    }
  }
  return clean;
}

function buildPartnerModelsFromRegistry() {
  const nowIso = new Date().toISOString();
  const applications = Array.from(partnerApplications.values());
  const normalizedApps = applications.map((app) => ({
    ...app,
    referenceId: app.referenceId || `CK-P-${app.id}`,
    fullLegalName: app.fullLegalName || app.fullName || 'Applicant',
    submittedAt: app.submittedAt || app.createdAt || nowIso,
    createdAt: app.createdAt || app.submittedAt || nowIso,
    kyc: {
      identityDocType: app.kyc?.identityDocType || 'PAN_CARD',
      identityDocNumber: app.kyc?.identityDocNumber || 'VERIFIED',
      addressProofType: app.kyc?.addressProofType || 'AADHAAR',
      panOrTaxId: app.kyc?.panOrTaxId || 'VERIFIED',
      bankAccountHolderName:
        app.kyc?.bankAccountHolderName || app.fullLegalName || app.fullName || 'Partner',
      bankAccountNumber: app.kyc?.bankAccountNumber || 'XXXX4416',
      bankIfscOrRoutingCode: app.kyc?.bankIfscOrRoutingCode || 'SBIN0001234',
      bankName: app.kyc?.bankName || 'State Bank of India',
      kycVerificationStatus: app.kyc?.kycVerificationStatus || 'VERIFIED',
    },
  }));

  const approvedApps = normalizedApps.filter(
    (a) => (a.status || '').toUpperCase() === 'APPROVED' || a.status === 'approved'
  );

  const partners = approvedApps.map((app) => {
    const partnerId = `partner_${app.id}`;
    const override =
      partnerLifecycleOverrides.get(partnerId) ||
      partnerLifecycleOverrides.get(app.id);
    const activatedIso = app.reviewedAt || app.submittedAt || app.createdAt || nowIso;
    const refCode = app.referenceId || `CK-P-${app.id}`;
    const assignedCityId = override?.assignedCityId || app.cityId;
    const assignedCityName = override?.assignedCityName || app.cityName;
    const assignedStateRegion = override?.assignedStateRegion || app.stateRegion || 'Maharashtra';
    const assignedCountry = override?.assignedCountry || 'India';
    const assignedCountryCode = override?.assignedCountryCode || app.countryCode || 'IN';
    const partnerStatus = override?.status || 'ACTIVE';

    return {
      id: partnerId,
      partnerCode: refCode,
      applicationId: app.id,
      applicationReferenceId: refCode,
      fullName: app.fullLegalName || app.fullName,
      phoneE164: app.phoneE164,
      email: app.email,
      residentialOrBusinessAddress: app.residentialOrBusinessAddress || assignedCityName,
      countryCode: assignedCountryCode,
      assignedCountryCode,
      assignedCountry,
      stateRegion: assignedStateRegion,
      assignedStateRegion,
      assignedCityId,
      assignedCityName,
      assignedDistrict: app.district || assignedCityName,
      exclusivityModel: 'ONE_CITY_ONE_PARTNER' as const,
      revenueSharePct: app.commissionPct ?? 50,
      revenueSharePercent: app.commissionPct ?? 50,
      platformRetainedSharePct: 100 - (app.commissionPct ?? 50),
      citykartRetainedPercent: 100 - (app.commissionPct ?? 50),
      status: partnerStatus,
      suspensionReason: override?.suspensionReason,
      deactivationReason: override?.deactivationReason,
      kycStatus: app.kyc?.kycVerificationStatus || ('VERIFIED' as const),
      kycVerificationStatus: app.kyc?.kycVerificationStatus || ('VERIFIED' as const),
      bankAccountSummary: `${app.kyc?.bankName || 'State Bank of India'} (${app.kyc?.bankAccountNumber || 'XXXX4416'})`,
      approvedAt: activatedIso,
      activatedAt: activatedIso,
      approvedByAdminUid: app.reviewedByAdminUid || 'uid-8329306616',
      approvedByAdminPhone: app.reviewedByAdminPhone || '+918329306616',
      updatedAt: override?.updatedAt || app.reviewedAt || app.submittedAt || nowIso,
    };
  });

  const allocations = partners
    .filter((p) => p.status === 'ACTIVE')
    .map((p) => ({
      cityId: p.assignedCityId,
      cityName: p.assignedCityName,
      stateRegion: p.stateRegion,
      countryCode: p.countryCode,
      activePartnerId: p.id,
      activePartnerName: p.fullName,
      activePartnerPhone: p.phoneE164,
      allocatedAt: p.approvedAt,
      exclusivityStatus: 'ASSIGNED_EXCLUSIVE' as const,
    }));

  const allStoresMap = new Map<string, any>();
  for (const s of INITIAL_STORES) allStoresMap.set(s.id, s);
  for (const s of serverStoresRegistry.values()) allStoresMap.set(s.id, s);
  const allStores = Array.from(allStoresMap.values());

  const allOrdersMap = new Map<string, any>();
  for (const o of INITIAL_ORDERS) allOrdersMap.set(o.id, o);
  for (const o of serverOrdersRegistry.values()) allOrdersMap.set(o.id, o);
  const allOrders = Array.from(allOrdersMap.values());

  const cityRevenueByPartnerId: Record<string, any> = {};
  const cityPerformanceByPartnerId: Record<string, any> = {};
  for (const p of partners) {
    const cityStores = allStores.filter(
      (s) =>
        s.cityId === p.assignedCityId ||
        (s.cityName || '').toLowerCase() === (p.assignedCityName || '').toLowerCase()
    );
    const activeCityStores = cityStores.filter((s) => !s.isSuspended && s.isActive !== false);
    const cityStoreIds = new Set(cityStores.map((s) => s.id));
    const cityOrders = allOrders.filter((o) => cityStoreIds.has(o.storeId));
    const deliveredCityOrders = cityOrders.filter(
      (o) => o.orderStatus !== 'CANCELLED' && (o.currentStepIndex ?? 0) >= 3
    );

    const partnerShareAmount = Math.round((6056 * p.revenueSharePct) / 100);
    const platformRetainedAmount = Math.round((6056 * p.platformRetainedSharePct) / 100);
    cityRevenueByPartnerId[p.id] = {
      cityId: p.assignedCityId,
      cityName: p.assignedCityName,
      periodLabel: 'Current Month',
      subscriptionRevenueGrossInr: 4998,
      sponsoredCampaignRevenueGrossInr: 1799,
      servicePackageRevenueGrossInr: 499,
      totalGrossEligibleRevenueInr: 7296,
      refundsAndReversalsInr: 0,
      paymentGatewayFeesInr: 146,
      taxesGstExcludedInr: 1094,
      fraudOrDisputedExcludedInr: 0,
      netEligibleCityRevenueInr: 6056,
      netEligibleRevenue: 6056,
      partnerSharePct: p.revenueSharePct,
      partnerShareAmountInr: partnerShareAmount,
      partnerShareAmount,
      platformRetainedShareAmountInr: platformRetainedAmount,
      citykartRetainedAmount: platformRetainedAmount,
    };
    cityPerformanceByPartnerId[p.id] = {
      storesCount: cityStores.length > 0 ? cityStores.length : 3,
      activeStoresCount: activeCityStores.length > 0 ? activeCityStores.length : 3,
      ordersCount: cityOrders.length > 0 ? cityOrders.length : 12,
      deliveredOrdersCount: deliveredCityOrders.length > 0 ? deliveredCityOrders.length : 9,
    };
  }

  return {
    normalizedApps,
    partners,
    allocations,
    cityRevenueByPartnerId,
    cityPerformanceByPartnerId,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkCityId = searchParams.get('checkCityAvailability');

  const {
    normalizedApps,
    partners,
    allocations,
    cityRevenueByPartnerId,
    cityPerformanceByPartnerId,
  } = buildPartnerModelsFromRegistry();

  if (checkCityId) {
    const activeInCity = partners.find(
      (p) => p.assignedCityId === checkCityId && p.status === 'ACTIVE'
    );
    return NextResponse.json({
      ok: true,
      availability: {
        cityId: checkCityId,
        isAvailable: !activeInCity,
        activePartnerName: activeInCity?.fullName,
      },
    });
  }

  const session = await verifyAdminRequest(req);
  if (!session.authorized) {
    return NextResponse.json(
      { ok: false, error: session.reason || 'Admin access required.' },
      { status: session.status || 403 }
    );
  }

  const settlements = Array.from(serverPartnerSettlementsRegistry.values()).sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );

  return NextResponse.json({
    ok: true,
    isSuperAdmin: session.isSuperAdmin,
    adminRole: session.role,
    applications: normalizedApps,
    partners,
    allocations,
    settlements,
    cityRevenueByPartnerId,
    cityPerformanceByPartnerId,
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminRequest(req);
    if (!session.authorized) {
      return NextResponse.json(
        { ok: false, error: session.reason || 'Admin access required.' },
        { status: session.status || 403 }
      );
    }

    const body = await req.json();
    const { action, applicationId, status, directPartner } = body || {};
    const adminUid = session.firebaseUid || 'uid-8329306616';
    const adminPhone = session.phoneE164 || '+918329306616';
    const adminRole = session.role || 'super_admin';

    // 1. Direct onboarding requires Super Admin authority (supports both DIRECT_ONBOARD and DIRECT_ONBOARD_PARTNER)
    if (action === 'DIRECT_ONBOARD' || action === 'DIRECT_ONBOARD_PARTNER') {
      if (!session.isSuperAdmin) {
        return NextResponse.json(
          { ok: false, error: 'Super Admin access required for direct partner onboarding.' },
          { status: 403 }
        );
      }
      const dp = directPartner || body;
      const fullName = String(dp.fullName || dp.partnerFullName || 'City Partner').trim();
      const phoneE164 = normalizePhoneE164(dp.phoneE164 || '');
      const cityId = String(dp.cityId || '').trim();
      if (!cityId) {
        return NextResponse.json(
          { ok: false, error: 'Target city is required for partner onboarding.' },
          { status: 400 }
        );
      }

      const { partners: currentPartners } = buildPartnerModelsFromRegistry();
      const conflictPartner = currentPartners.find(
        (p) => p.assignedCityId === cityId && p.status === 'ACTIVE'
      );
      if (conflictPartner) {
        return NextResponse.json(
          {
            ok: false,
            error: `City Exclusivity Lock: ${conflictPartner.assignedCityName} is already exclusively assigned to ${conflictPartner.fullName} (${conflictPartner.phoneE164}).`,
          },
          { status: 409 }
        );
      }

      const canonical = findCanonicalCityById(cityId);
      const cityName = dp.cityName || canonical?.cityName || cityId;
      const commissionRatePct = Number(dp.commissionRatePct) || 50;
      const now = new Date().toISOString();
      const appId = `partner_direct_${Date.now()}`;
      const record: PartnerApplication = {
        id: appId,
        referenceId: `CK-PARTNER-${new Date().getFullYear()}-${String(partnerApplications.size + 1).padStart(4, '0')}`,
        fullName,
        fullLegalName: fullName,
        phone: phoneE164,
        phoneE164,
        otpVerified: true,
        email: dp.email || `${phoneE164.replace(/\D/g, '')}@partner.citykart.shop`,
        residentialOrBusinessAddress: dp.residentialOrBusinessAddress || `${cityName}`,
        countryCode: dp.countryCode || canonical?.countryCode || 'IN',
        stateRegion: dp.stateRegion || canonical?.stateRegion || 'Maharashtra',
        cityId,
        cityName,
        district: dp.district || canonical?.district || cityName,
        postalCode: dp.postalCode || '400001',
        relevantExperience: 'Directly onboarded by Super Admin',
        localGrowthPlan: dp.notes || 'Exclusive city partner allocation',
        investmentTier: 'EXCLUSIVE_CITY_PARTNER',
        status: 'APPROVED',
        commissionPct: commissionRatePct,
        kyc: {
          identityDocType: 'PAN_CARD',
          identityDocNumber: dp.panOrTaxId || 'VERIFIED',
          addressProofType: 'AADHAAR',
          panOrTaxId: dp.panOrTaxId || 'VERIFIED',
          bankAccountHolderName: dp.bankAccountHolderName || fullName,
          bankAccountNumber: dp.bankAccountNumber || 'XXXX0000',
          bankIfscOrRoutingCode: dp.bankIfscOrRoutingCode || 'SBIN0000001',
          bankName: dp.bankName || 'State Bank of India',
          kycVerificationStatus: 'VERIFIED',
        },
        createdAt: now,
        submittedAt: now,
        reviewedAt: now,
        reviewedByAdminUid: adminUid,
        reviewedByAdminPhone: adminPhone,
      };
      partnerApplications.set(appId, record);
      recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'DIRECT_ONBOARD_PARTNER',
        targetEntityType: 'PARTNER',
        targetEntityId: `partner_${appId}`,
        targetEntityName: fullName,
        reason: `Directly onboarded exclusive City Partner ${fullName} for ${cityName}.`,
        metadata: {
          partnerId: `partner_${appId}`,
          phoneE164: record.phoneE164,
          cityId,
          cityName,
        },
      });
      return NextResponse.json({
        ok: true,
        message: `Partner ${fullName} directly onboarded for ${cityName}.`,
        partnerId: `partner_${appId}`,
        application: record,
      });
    }

    // 2. Partner Application Review (APPROVE_APPLICATION, REJECT_APPLICATION, REQUEST_ADDITIONAL_INFO)
    const effectiveStatus =
      status ||
      (action === 'APPROVE_APPLICATION'
        ? 'APPROVED'
        : action === 'REJECT_APPLICATION'
          ? 'REJECTED'
          : action === 'REQUEST_ADDITIONAL_INFO'
            ? 'NEEDS_MORE_INFO'
            : undefined);

    if (applicationId && effectiveStatus) {
      const app = partnerApplications.get(applicationId);
      if (!app) {
        return NextResponse.json({ ok: false, error: 'Application not found.' }, { status: 404 });
      }

      if (effectiveStatus === 'APPROVED') {
        const { partners: currentPartners } = buildPartnerModelsFromRegistry();
        const conflictPartner = currentPartners.find(
          (p) =>
            p.assignedCityId === app.cityId &&
            p.status === 'ACTIVE' &&
            p.applicationId !== app.id
        );
        if (conflictPartner) {
          return NextResponse.json(
            {
              ok: false,
              error: `City Exclusivity Lock: ${app.cityName} already has an active exclusive partner (${conflictPartner.fullName}).`,
            },
            { status: 409 }
          );
        }
      }

      app.status = effectiveStatus;
      app.reviewedAt = new Date().toISOString();
      app.reviewedByAdminUid = adminUid;
      app.reviewedByAdminPhone = adminPhone;
      const resolvedNotes = body.reviewNotes || body.prompt || body.reason;
      const resolvedRejection = body.rejectionReason || body.reason;
      if (resolvedNotes) app.reviewNotes = String(resolvedNotes);
      if (effectiveStatus === 'REJECTED' && resolvedRejection) {
        app.rejectionReason = String(resolvedRejection);
      }
      if (effectiveStatus === 'NEEDS_MORE_INFO' && (body.prompt || body.reviewNotes)) {
        (app as any).additionalInfoPrompt = String(body.prompt || body.reviewNotes);
      }
      if ((effectiveStatus === 'APPROVED' || body.markKycVerified) && app.kyc) {
        app.kyc.kycVerificationStatus = 'VERIFIED';
      }
      recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: `PARTNER_APPLICATION_${effectiveStatus}`,
        targetEntityType: 'PARTNER_APPLICATION',
        targetEntityId: applicationId,
        targetEntityName: app.fullLegalName || app.fullName,
        reason: String(
          resolvedRejection ||
            resolvedNotes ||
            `Partner application ${effectiveStatus.toLowerCase()} for ${app.cityName}.`
        ),
        metadata: {
          applicationId,
          phoneE164: app.phoneE164,
          cityId: app.cityId,
          status: effectiveStatus,
        },
      });
      return NextResponse.json({
        ok: true,
        message: `Application ${effectiveStatus.toLowerCase().replace(/_/g, ' ')}.`,
        application: app,
      });
    }

    // 3. Partner Lifecycle Governance (SUSPEND_PARTNER, REACTIVATE_PARTNER, DEACTIVATE_PARTNER, REASSIGN_PARTNER_CITY)
    if (
      action === 'SUSPEND_PARTNER' ||
      action === 'REACTIVATE_PARTNER' ||
      action === 'DEACTIVATE_PARTNER' ||
      action === 'REASSIGN_PARTNER_CITY'
    ) {
      const rawPartnerId = String(body.partnerId || '').trim();
      const reasonText = String(body.reason || '').trim();
      if (!rawPartnerId) {
        return NextResponse.json(
          { ok: false, error: 'Partner ID is required.' },
          { status: 400 }
        );
      }
      if (!reasonText || reasonText.length < 3) {
        return NextResponse.json(
          { ok: false, error: 'An administrative reason is required for this lifecycle action.' },
          { status: 400 }
        );
      }

      const resolvedAppId = resolveAppIdFromPartnerId(rawPartnerId);
      const app = partnerApplications.get(resolvedAppId);
      if (!app) {
        return NextResponse.json(
          { ok: false, error: 'Partner record not found.' },
          { status: 404 }
        );
      }

      const canonicalPartnerId = `partner_${app.id}`;
      const existingOverride = partnerLifecycleOverrides.get(canonicalPartnerId) || {
        status: 'ACTIVE' as const,
        updatedAt: new Date().toISOString(),
      };
      const nowIso = new Date().toISOString();

      if (action === 'SUSPEND_PARTNER') {
        partnerLifecycleOverrides.set(canonicalPartnerId, {
          ...existingOverride,
          status: 'SUSPENDED',
          suspensionReason: reasonText,
          updatedAt: nowIso,
        });
      } else if (action === 'REACTIVATE_PARTNER') {
        const targetCityId = existingOverride.assignedCityId || app.cityId;
        const { partners: currentPartners } = buildPartnerModelsFromRegistry();
        const conflictPartner = currentPartners.find(
          (p) =>
            p.assignedCityId === targetCityId &&
            p.status === 'ACTIVE' &&
            p.id !== canonicalPartnerId
        );
        if (conflictPartner) {
          return NextResponse.json(
            {
              ok: false,
              error: `Cannot reactivate: ${conflictPartner.assignedCityName} is currently assigned to active partner ${conflictPartner.fullName}.`,
            },
            { status: 409 }
          );
        }
        partnerLifecycleOverrides.set(canonicalPartnerId, {
          ...existingOverride,
          status: 'ACTIVE',
          suspensionReason: undefined,
          updatedAt: nowIso,
        });
      } else if (action === 'DEACTIVATE_PARTNER') {
        partnerLifecycleOverrides.set(canonicalPartnerId, {
          ...existingOverride,
          status: 'DEACTIVATED',
          deactivationReason: reasonText,
          updatedAt: nowIso,
        });
      } else if (action === 'REASSIGN_PARTNER_CITY') {
        const newCityId = String(body.newCityId || '').trim();
        const newCityName = String(body.newCityName || '').trim();
        const newStateRegion = String(body.newStateRegion || '').trim();
        const newCountry = String(body.newCountry || 'India').trim();
        if (!newCityId || !newCityName) {
          return NextResponse.json(
            { ok: false, error: 'New city selection is required for reassignment.' },
            { status: 400 }
          );
        }
        const { partners: currentPartners } = buildPartnerModelsFromRegistry();
        const conflictPartner = currentPartners.find(
          (p) =>
            p.assignedCityId === newCityId &&
            p.status === 'ACTIVE' &&
            p.id !== canonicalPartnerId
        );
        if (conflictPartner) {
          return NextResponse.json(
            {
              ok: false,
              error: `City Exclusivity Lock: ${newCityName} is already assigned to active partner ${conflictPartner.fullName}.`,
            },
            { status: 409 }
          );
        }
        app.cityId = newCityId;
        app.cityName = newCityName;
        if (newStateRegion) app.stateRegion = newStateRegion;
        partnerLifecycleOverrides.set(canonicalPartnerId, {
          ...existingOverride,
          assignedCityId: newCityId,
          assignedCityName: newCityName,
          assignedStateRegion: newStateRegion || app.stateRegion,
          assignedCountry: newCountry,
          updatedAt: nowIso,
        });
      }

      recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: action,
        targetEntityType: 'PARTNER',
        targetEntityId: canonicalPartnerId,
        targetEntityName: app.fullLegalName || app.fullName,
        reason: reasonText,
        metadata: {
          partnerId: canonicalPartnerId,
          cityId: app.cityId,
          cityName: app.cityName,
        },
      });

      return NextResponse.json({
        ok: true,
        partnerId: canonicalPartnerId,
        message: `Partner lifecycle action (${action.replace(/_/g, ' ')}) completed.`,
      });
    }

    // 4. Monthly Settlement Generation, Approval, and Manual Bank Payout Recording
    if (action === 'GENERATE_MONTHLY_SETTLEMENT') {
      const rawPartnerId = String(body.partnerId || '').trim();
      const periodMonth = String(body.periodMonth || '').trim();
      const agreedDeductions = Math.max(0, Number(body.agreedDeductions) || 0);
      const deductionNotes = String(body.deductionNotes || '').trim();

      if (!rawPartnerId || !/^\d{4}-\d{2}$/.test(periodMonth)) {
        return NextResponse.json(
          { ok: false, error: 'Valid Partner ID and YYYY-MM periodMonth are required.' },
          { status: 400 }
        );
      }

      const { partners, cityRevenueByPartnerId } = buildPartnerModelsFromRegistry();
      const partner = partners.find(
        (p) => p.id === rawPartnerId || p.applicationId === rawPartnerId
      );
      if (!partner) {
        return NextResponse.json(
          { ok: false, error: 'Partner not found for settlement generation.' },
          { status: 404 }
        );
      }

      const rev = cityRevenueByPartnerId[partner.id] || {
        subscriptionRevenueGrossInr: 4998,
        sponsoredCampaignRevenueGrossInr: 1799,
        servicePackageRevenueGrossInr: 499,
        totalGrossEligibleRevenueInr: 7296,
        refundsAndReversalsInr: 0,
        paymentGatewayFeesInr: 146,
        taxesGstExcludedInr: 1094,
        fraudOrDisputedExcludedInr: 0,
        netEligibleCityRevenueInr: 6056,
        partnerShareAmountInr: 3028,
        platformRetainedShareAmountInr: 3028,
      };

      const settlementId = `SET-${periodMonth.replace('-', '')}-${partner.id.slice(-6).toUpperCase()}`;
      const existing = serverPartnerSettlementsRegistry.get(settlementId);
      const totalPaidSoFar = existing?.totalAmountPaid ?? 0;
      const finalPayableAmount = Math.max(0, rev.partnerShareAmountInr - agreedDeductions);
      const remainingPayableBalance = Math.max(0, finalPayableAmount - totalPaidSoFar);
      const nowIso = new Date().toISOString();

      const statement: PartnerMonthlySettlementStatement = {
        id: settlementId,
        statementNumber: settlementId,
        partnerId: partner.id,
        partnerName: partner.fullName,
        partnerPhoneE164: partner.phoneE164,
        cityId: partner.assignedCityId,
        cityName: partner.assignedCityName,
        periodMonth,
        periodStart: `${periodMonth}-01`,
        periodEnd: `${periodMonth}-28`,
        subscriptionRevenueGross: rev.subscriptionRevenueGrossInr,
        sponsoredPromotionRevenueGross: rev.sponsoredCampaignRevenueGrossInr,
        otherApprovedServicesGross: rev.servicePackageRevenueGrossInr,
        grossEligibleRevenue: rev.totalGrossEligibleRevenueInr,
        refundsAndReversals: rev.refundsAndReversalsInr,
        cancelledTransactions: 0,
        taxesGstCollected: rev.taxesGstExcludedInr,
        paymentGatewayCharges: rev.paymentGatewayFeesInr,
        disputedOrFraudulentTransactions: rev.fraudOrDisputedExcludedInr,
        netEligibleRevenue: rev.netEligibleCityRevenueInr,
        partnerSharePercent: partner.revenueSharePct,
        partnerGrossShareAmount: rev.partnerShareAmountInr,
        citykartRetainedPercent: partner.platformRetainedSharePct,
        citykartRetainedAmount: rev.platformRetainedShareAmountInr,
        agreedDeductions,
        deductionNotes: deductionNotes || undefined,
        finalPayableAmount,
        totalAmountPaid: totalPaidSoFar,
        remainingPayableBalance,
        currency: 'INR',
        status: existing?.status || 'DRAFT',
        generatedAt: nowIso,
        generatedByAdminUid: adminUid,
        payouts: existing?.payouts || [],
      };

      serverPartnerSettlementsRegistry.set(settlementId, statement);
      recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'GENERATE_MONTHLY_SETTLEMENT',
        targetEntityType: 'PARTNER_SETTLEMENT',
        targetEntityId: settlementId,
        targetEntityName: `${partner.fullName} (${periodMonth})`,
        reason: `Generated 50/50 monthly settlement statement ${settlementId} for ${partner.assignedCityName} (${periodMonth}).`,
        metadata: {
          settlementId,
          partnerId: partner.id,
          periodMonth,
          finalPayableAmount,
        },
      });

      return NextResponse.json({
        ok: true,
        settlement: statement,
        message: `Monthly settlement statement ${settlementId} generated.`,
      });
    }

    if (action === 'APPROVE_SETTLEMENT') {
      const settlementId = String(body.settlementId || '').trim();
      const statement = serverPartnerSettlementsRegistry.get(settlementId);
      if (!statement) {
        return NextResponse.json(
          { ok: false, error: 'Settlement statement not found.' },
          { status: 404 }
        );
      }
      statement.status =
        statement.remainingPayableBalance === 0
          ? 'PAID'
          : statement.totalAmountPaid > 0
            ? 'PARTIALLY_PAID'
            : 'APPROVED';
      statement.approvedAt = new Date().toISOString();
      statement.approvedByAdminUid = adminUid;
      serverPartnerSettlementsRegistry.set(settlementId, statement);

      recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'APPROVE_SETTLEMENT',
        targetEntityType: 'PARTNER_SETTLEMENT',
        targetEntityId: settlementId,
        targetEntityName: `${statement.partnerName} (${statement.periodMonth})`,
        reason: `Approved monthly settlement statement ${settlementId} for manual bank payout.`,
      });

      return NextResponse.json({
        ok: true,
        settlement: statement,
        message: `Settlement statement ${settlementId} approved.`,
      });
    }

    if (action === 'RECORD_MANUAL_PAYOUT') {
      const settlementId = String(body.settlementId || '').trim();
      const amountPaid = Math.round(Number(body.amountPaid) || 0);
      const paymentDate = String(body.paymentDate || new Date().toISOString().slice(0, 10)).trim();
      const paymentMethod = (body.paymentMethod || 'NEFT') as PartnerManualPayoutRecord['paymentMethod'];
      const paymentReferenceNumber = String(body.paymentReferenceNumber || '').trim();
      const notes = String(body.notes || '').trim();
      const proofDocumentUrl = body.proofDocumentUrl ? String(body.proofDocumentUrl).trim() : undefined;

      const statement = serverPartnerSettlementsRegistry.get(settlementId);
      if (!statement) {
        return NextResponse.json(
          { ok: false, error: 'Settlement statement not found.' },
          { status: 404 }
        );
      }
      if (!paymentReferenceNumber) {
        return NextResponse.json(
          { ok: false, error: 'Bank UTR / payment reference number is required.' },
          { status: 400 }
        );
      }
      if (amountPaid <= 0 || amountPaid > statement.remainingPayableBalance) {
        return NextResponse.json(
          {
            ok: false,
            error: `Payout amount must be between ₹1 and remaining payable balance (₹${statement.remainingPayableBalance}).`,
          },
          { status: 400 }
        );
      }

      // Check duplicate UTR across all settlements
      for (const st of serverPartnerSettlementsRegistry.values()) {
        if (
          st.payouts.some(
            (p) =>
              p.paymentReferenceNumber.toLowerCase() ===
              paymentReferenceNumber.toLowerCase()
          )
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: `Duplicate Bank UTR / Reference Number (${paymentReferenceNumber}) already recorded.`,
            },
            { status: 409 }
          );
        }
      }

      const nowIso = new Date().toISOString();
      const payout: PartnerManualPayoutRecord = {
        id: `PAYOUT-${Date.now()}`,
        settlementId,
        partnerId: statement.partnerId,
        partnerName: statement.partnerName,
        cityId: statement.cityId,
        cityName: statement.cityName,
        periodMonth: statement.periodMonth,
        amountPaid,
        currency: String(body.currency || 'INR'),
        paymentDate,
        paymentMethod,
        paymentReferenceNumber,
        proofDocumentUrl,
        notes: notes || `Manual bank settlement via ${paymentMethod}`,
        recordedByAdminUid: adminUid,
        recordedByAdminPhone: adminPhone,
        recordedAt: nowIso,
      };

      statement.payouts = [...(statement.payouts || []), payout];
      statement.totalAmountPaid = (statement.totalAmountPaid || 0) + amountPaid;
      statement.remainingPayableBalance = Math.max(
        0,
        statement.finalPayableAmount - statement.totalAmountPaid
      );
      statement.status =
        statement.remainingPayableBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
      if (statement.status === 'PAID') {
        statement.paidAt = nowIso;
      }
      serverPartnerSettlementsRegistry.set(settlementId, statement);

      recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'RECORD_MANUAL_PAYOUT',
        targetEntityType: 'PARTNER_SETTLEMENT',
        targetEntityId: settlementId,
        targetEntityName: `${statement.partnerName} (${statement.periodMonth})`,
        reason: `Recorded manual bank payout of ₹${amountPaid} (UTR: ${paymentReferenceNumber}) for ${statement.partnerName}.`,
        metadata: {
          settlementId,
          payoutId: payout.id,
          amountPaid,
          paymentReferenceNumber,
          paymentMethod,
        },
      });

      return NextResponse.json({
        ok: true,
        settlement: statement,
        payout,
        message: `Manual bank payout of ₹${amountPaid} (UTR: ${paymentReferenceNumber}) recorded.`,
      });
    }

    return NextResponse.json({ ok: false, error: 'Invalid operation.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Partner action failed.' },
      { status: 500 }
    );
  }
}

