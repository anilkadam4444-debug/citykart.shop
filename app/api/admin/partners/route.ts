import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db, syncUserAccountToFirestore } from '@/lib/firebase';
import {
  LocalStore,
  OrderRecord,
  UserAccount,
} from '@/lib/catalog-data';
import { INITIAL_STORES, serverUserAccounts } from '@/lib/initial-data';
import {
  BillingTransaction,
  PlatformFeeLedgerEntry,
} from '@/lib/revenue-model';
import { serverOrdersRegistry } from '@/lib/orders-registry';
import { serverDeletedStoresRegistry } from '@/lib/stores-registry';
import { serverPlatformFeeLedgerRegistry } from '@/lib/fees';
import {
  recordAdminAuditLog,
  serverStoreOverridesRegistry,
  verifyAdminRequest,
} from '@/lib/super-admin-auth';
import {
  approvePartnerApplicationAndAllocateCity,
  approvePartnerSettlementStatement,
  calculateCityPartnerRevenueReport,
  checkCityPartnerAvailability,
  CityRevenueAttributionSummary,
  directOnboardCityPartner,
  generateOrUpdateMonthlyPartnerSettlement,
  hydratePartnerRegistriesFromFirestore,
  recordManualPartnerSettlementPayout,
  rejectOrRequestInfoOnPartnerApplication,
  sanitizeApplicationForApplicantView,
  serverCityAllocationsRegistry,
  serverCityPartnersRegistry,
  serverPartnerApplicationsRegistry,
  serverPartnerSettlementsRegistry,
  updateActivePartnerLifecycle,
} from '@/lib/partner-program';

export const dynamic = 'force-dynamic';

async function loadMarketplaceRevenueInputs(): Promise<{
  stores: LocalStore[];
  orders: OrderRecord[];
  transactions: BillingTransaction[];
  platformFeeLedger: PlatformFeeLedgerEntry[];
}> {
  const [fsStoresSnap, fsOrdersSnap, fsTxSnap, fsLedgerSnap] =
    await Promise.all([
      getDocs(collection(db, 'stores')).catch(() => null),
      getDocs(collection(db, 'orders')).catch(() => null),
      getDocs(collection(db, 'billingTransactions')).catch(() => null),
      getDocs(collection(db, 'platformFeeLedger')).catch(() => null),
    ]);

  const deletedStoreIds = new Set<string>(serverDeletedStoresRegistry.keys());
  const storesMap = new Map<string, LocalStore>();
  for (const st of INITIAL_STORES) {
    if (!deletedStoreIds.has(st.id)) storesMap.set(st.id, { ...st });
  }
  fsStoresSnap?.forEach((d) => {
    const data = d.data() as LocalStore;
    if (data?.id && !deletedStoreIds.has(data.id)) storesMap.set(data.id, data);
  });
  for (const [storeId, override] of serverStoreOverridesRegistry.entries()) {
    const existing = storesMap.get(storeId);
    if (existing) {
      storesMap.set(storeId, {
        ...existing,
        isSuspended: override.isSuspended,
        isActive: override.isActive,
      });
    }
  }

  const ordersMap = new Map<string, OrderRecord>();
  for (const [id, ord] of serverOrdersRegistry.entries()) {
    ordersMap.set(id, ord);
  }
  fsOrdersSnap?.forEach((d) => {
    const data = d.data() as OrderRecord;
    if (data?.id) ordersMap.set(data.id, data);
  });

  const txMap = new Map<string, BillingTransaction>();
  fsTxSnap?.forEach((d) => {
    const data = d.data() as BillingTransaction;
    if (data?.id) txMap.set(data.id, data);
  });

  const ledgerMap = new Map<string, PlatformFeeLedgerEntry>();
  for (const [id, entry] of serverPlatformFeeLedgerRegistry.entries()) {
    ledgerMap.set(id, entry);
  }
  fsLedgerSnap?.forEach((d) => {
    const data = d.data() as PlatformFeeLedgerEntry;
    if (data?.id) ledgerMap.set(data.id, data);
  });

  return {
    stores: Array.from(storesMap.values()),
    orders: Array.from(ordersMap.values()),
    transactions: Array.from(txMap.values()),
    platformFeeLedger: Array.from(ledgerMap.values()),
  };
}

export async function GET(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        error: authCheck.reason,
      },
      { status: authCheck.status }
    );
  }

  await hydratePartnerRegistriesFromFirestore();
  const { searchParams } = new URL(req.url);

  // Fast check for City Partner Availability during Onboarding
  const checkCityAvailabilityId = searchParams.get('checkCityAvailability');
  if (checkCityAvailabilityId) {
    const availability = checkCityPartnerAvailability(checkCityAvailabilityId);
    return NextResponse.json({
      ok: true,
      availability,
    });
  }

  const periodMonth = searchParams.get('periodMonth') || 'ALL';

  const { stores, orders, transactions, platformFeeLedger } =
    await loadMarketplaceRevenueInputs();

  // Only Super Admin receives unmasked KYC / bank account details for restricted review;
  // operational admins receive masked KYC details.
  const applications = Array.from(
    serverPartnerApplicationsRegistry.values()
  )
    .sort((a, b) => {
      const timeA = a.submittedAt || a.updatedAt || '';
      const timeB = b.submittedAt || b.updatedAt || '';
      return timeB.localeCompare(timeA);
    })
    .map((app) =>
      authCheck.isSuperAdmin ? app : sanitizeApplicationForApplicantView(app)
    );

  const partners = Array.from(serverCityPartnersRegistry.values()).sort(
    (a, b) => (b.activatedAt || '').localeCompare(a.activatedAt || '')
  );

  const allocations = Array.from(serverCityAllocationsRegistry.values());

  const settlements = Array.from(
    serverPartnerSettlementsRegistry.values()
  ).sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));

  const cityRevenueByPartnerId: Record<string, CityRevenueAttributionSummary> =
    {};
  const cityPerformanceByPartnerId: Record<
    string,
    {
      storesCount: number;
      activeStoresCount: number;
      ordersCount: number;
      deliveredOrdersCount: number;
    }
  > = {};

  for (const p of partners) {
    const cleanCityId = p.assignedCityId.toLowerCase();
    const pStores = stores.filter(
      (s) => (s.cityId || '').trim().toLowerCase() === cleanCityId
    );
    const pStoreIds = new Set(pStores.map((s) => s.id));
    const pOrders = orders.filter((o) => pStoreIds.has(o.storeId));

    cityPerformanceByPartnerId[p.id] = {
      storesCount: pStores.length,
      activeStoresCount: pStores.filter((s) => s.isActive && !s.isSuspended)
        .length,
      ordersCount: pOrders.length,
      deliveredOrdersCount: pOrders.filter(
        (o) => o.orderStatus === 'DELIVERED' || o.currentStepIndex >= 3
      ).length,
    };

    cityRevenueByPartnerId[p.id] = calculateCityPartnerRevenueReport({
      cityId: p.assignedCityId,
      cityName: p.assignedCityName,
      periodMonth,
      currency: 'INR',
      partnerSharePercent: p.revenueSharePercent,
      stores,
      orders,
      transactions,
      platformFeeLedger,
    });
  }

  return NextResponse.json({
    ok: true,
    authorized: true,
    isSuperAdmin: authCheck.isSuperAdmin,
    applications,
    partners,
    allocations,
    settlements,
    cityRevenueByPartnerId,
    cityPerformanceByPartnerId,
  });
}

export async function POST(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized || !authCheck.firebaseUid) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        error: authCheck.reason,
      },
      { status: authCheck.status }
    );
  }

  if (!authCheck.isSuperAdmin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Forbidden: Only the Platform Owner Super Admin (+918329306616) is authorized to approve applications, allocate cities, or manage partner settlements.',
      },
      { status: 403 }
    );
  }

  await hydratePartnerRegistriesFromFirestore();
  const adminUid = authCheck.firebaseUid;
  const adminPhone = authCheck.phoneE164;
  const adminName =
    authCheck.superAdminRecord?.displayName || 'Platform Owner Super Admin';

  try {
    const body = await req.json();
    const action = String(body.action || '').trim();

    // 0. DEDICATED DIRECT ONBOARD CITY PARTNER ARCHITECTURE
    if (action === 'DIRECT_ONBOARD_PARTNER') {
      const partnerFullName = String(
        body.partnerFullName || body.fullName || ''
      ).trim();
      const phoneE164 = String(body.phoneE164 || '').trim();
      const email = String(body.email || '').trim();
      const cityId = String(body.cityId || '').trim();
      const cityName = body.cityName ? String(body.cityName).trim() : undefined;
      const stateRegion = body.stateRegion
        ? String(body.stateRegion).trim()
        : undefined;
      const country = body.country ? String(body.country).trim() : undefined;
      const countryCode = body.countryCode
        ? String(body.countryCode).trim()
        : undefined;
      const district = body.district ? String(body.district).trim() : undefined;
      const postalCode = body.postalCode
        ? String(body.postalCode).trim()
        : undefined;
      const residentialOrBusinessAddress = body.residentialOrBusinessAddress
        ? String(body.residentialOrBusinessAddress).trim()
        : undefined;
      const panOrTaxId = body.panOrTaxId
        ? String(body.panOrTaxId).trim()
        : undefined;
      const bankAccountHolderName = body.bankAccountHolderName
        ? String(body.bankAccountHolderName).trim()
        : undefined;
      const bankAccountNumber = body.bankAccountNumber
        ? String(body.bankAccountNumber).trim()
        : undefined;
      const bankIfscOrRoutingCode = body.bankIfscOrRoutingCode
        ? String(body.bankIfscOrRoutingCode).trim()
        : undefined;
      const bankName = body.bankName ? String(body.bankName).trim() : undefined;
      const notes = body.notes ? String(body.notes).trim() : undefined;

      const result = await directOnboardCityPartner({
        adminUid,
        adminPhone,
        adminName,
        isSuperAdmin: true,
        partnerFullName,
        phoneE164,
        email,
        residentialOrBusinessAddress,
        country,
        countryCode,
        stateRegion,
        cityId,
        cityName,
        district,
        postalCode,
        panOrTaxId,
        bankAccountHolderName,
        bankAccountNumber,
        bankIfscOrRoutingCode,
        bankName,
        notes,
      });

      if (!result.ok || !result.partner || !result.allocation) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole: 'super_admin',
        actionType: 'DIRECT_ONBOARD_PARTNER',
        targetEntityType: 'PARTNER',
        targetEntityId: result.partner.id,
        targetEntityName: `${result.partner.fullName} · ${result.partner.assignedCityName} (${result.partner.assignedCityId})`,
        status: 'SUCCESS',
        reason:
          notes ||
          `Directly onboarded City Partner ${result.partner.fullName} (${result.partner.phoneE164}) with exclusive allocation for ${result.partner.assignedCityName} (${result.partner.assignedCityId}).`,
      });

      return NextResponse.json({
        ok: true,
        partner: result.partner,
        allocation: result.allocation,
        application: result.application,
        message: `Successfully onboarded ${result.partner.fullName} as City Partner for ${result.partner.assignedCityName}.`,
      });
    }

    // 1. APPROVE PARTNER APPLICATION & ATOMICALLY ALLOCATE CITY
    if (action === 'APPROVE_APPLICATION') {
      const applicationId = String(body.applicationId || '').trim();
      const reviewNotes = body.reviewNotes
        ? String(body.reviewNotes).trim()
        : undefined;
      const markKycVerified = body.markKycVerified !== false;

      const result = await approvePartnerApplicationAndAllocateCity({
        applicationId,
        adminUid,
        adminPhone,
        adminName,
        isSuperAdmin: true,
        markKycVerified,
        reviewNotes,
      });

      if (!result.ok || !result.partner || !result.application) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      // Link Partner role metadata on user's UserAccount without granting Admin rights
      const existingUser = serverUserAccounts.get(result.partner.phoneE164);
      if (existingUser) {
        const updatedRoles = Array.from(
          new Set([...existingUser.roles, 'PARTNER'])
        ) as UserAccount['roles'];
        const updatedUser: UserAccount = {
          ...existingUser,
          roles: updatedRoles,
          isPartner: true,
          partnerId: result.partner.id,
          assignedCityId: result.partner.assignedCityId,
          assignedCityName: result.partner.assignedCityName,
          role: existingUser.isAdmin ? existingUser.role : 'partner',
        };
        serverUserAccounts.set(result.partner.phoneE164, updatedUser);
        await syncUserAccountToFirestore(updatedUser);
      }

      await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole: 'super_admin',
        actionType: 'APPROVE_PARTNER_APPLICATION',
        targetEntityType: 'PARTNER_APPLICATION',
        targetEntityId: result.application.id,
        targetEntityName: `${result.partner.fullName} · ${result.partner.assignedCityName} (${result.partner.assignedCityId})`,
        status: 'SUCCESS',
        reason:
          reviewNotes ||
          `Approved application ${result.application.referenceId} and allocated exclusive city ${result.partner.assignedCityId} to ${result.partner.fullName} (${result.partner.phoneE164}).`,
      });

      return NextResponse.json({
        ok: true,
        application: result.application,
        partner: result.partner,
        allocation: result.allocation,
        message: `Approved ${result.partner.fullName} as City Partner for ${result.partner.assignedCityName}.`,
      });
    }

    // 2. REJECT PARTNER APPLICATION
    if (action === 'REJECT_APPLICATION') {
      const applicationId = String(body.applicationId || '').trim();
      const reason = String(body.reason || '').trim();
      const waitlisted = Boolean(body.waitlisted);

      const result = await rejectOrRequestInfoOnPartnerApplication({
        applicationId,
        targetStatus: 'rejected',
        reasonOrPrompt: reason,
        waitlisted,
        adminUid,
        adminName,
        isSuperAdmin: true,
      });

      if (!result.ok || !result.application) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole: 'super_admin',
        actionType: 'REJECT_PARTNER_APPLICATION',
        targetEntityType: 'PARTNER_APPLICATION',
        targetEntityId: result.application.id,
        targetEntityName: `${result.application.fullLegalName} (${result.application.referenceId})`,
        status: 'SUCCESS',
        reason: `Rejected partner application ${result.application.referenceId}: ${reason}`,
      });

      return NextResponse.json({
        ok: true,
        application: result.application,
        message: `Rejected application ${result.application.referenceId}.`,
      });
    }

    // 3. REQUEST ADDITIONAL INFORMATION ON PARTNER APPLICATION
    if (action === 'REQUEST_ADDITIONAL_INFO') {
      const applicationId = String(body.applicationId || '').trim();
      const prompt = String(body.prompt || body.reason || '').trim();

      const result = await rejectOrRequestInfoOnPartnerApplication({
        applicationId,
        targetStatus: 'additional_information_required',
        reasonOrPrompt: prompt,
        adminUid,
        adminName,
        isSuperAdmin: true,
      });

      if (!result.ok || !result.application) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole: 'super_admin',
        actionType: 'REQUEST_PARTNER_ADDITIONAL_INFO',
        targetEntityType: 'PARTNER_APPLICATION',
        targetEntityId: result.application.id,
        targetEntityName: `${result.application.fullLegalName} (${result.application.referenceId})`,
        status: 'SUCCESS',
        reason: `Requested additional information on ${result.application.referenceId}: ${prompt}`,
      });

      return NextResponse.json({
        ok: true,
        application: result.application,
        message: `Requested additional information from ${result.application.fullLegalName}.`,
      });
    }

    // 4. ACTIVE PARTNER LIFECYCLE (SUSPEND / REACTIVATE / DEACTIVATE / REASSIGN_CITY)
    if (
      action === 'SUSPEND_PARTNER' ||
      action === 'REACTIVATE_PARTNER' ||
      action === 'DEACTIVATE_PARTNER' ||
      action === 'REASSIGN_PARTNER_CITY'
    ) {
      const partnerId = String(body.partnerId || '').trim();
      const reason = String(body.reason || '').trim();
      const lifecycleAction =
        action === 'SUSPEND_PARTNER'
          ? 'SUSPEND'
          : action === 'REACTIVATE_PARTNER'
            ? 'REACTIVATE'
            : action === 'DEACTIVATE_PARTNER'
              ? 'DEACTIVATE'
              : 'REASSIGN_CITY';

      const result = await updateActivePartnerLifecycle({
        partnerId,
        action: lifecycleAction,
        reason,
        newCityId: body.newCityId ? String(body.newCityId) : undefined,
        newCountry: body.newCountry ? String(body.newCountry) : undefined,
        newStateRegion: body.newStateRegion
          ? String(body.newStateRegion)
          : undefined,
        newCityName: body.newCityName ? String(body.newCityName) : undefined,
        adminUid,
        adminPhone,
        adminName,
        isSuperAdmin: true,
      });

      if (!result.ok || !result.partner) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      // Synchronize user's UserAccount with updated partner status and city assignment
      const existingUser = serverUserAccounts.get(result.partner.phoneE164);
      if (existingUser) {
        const isStillActive = result.partner.status === 'ACTIVE';
        const filteredRoles = existingUser.roles.filter((r) => r !== 'PARTNER');
        const updatedRoles = (
          isStillActive ? [...filteredRoles, 'PARTNER'] : filteredRoles
        ) as UserAccount['roles'];
        const updatedUser: UserAccount = {
          ...existingUser,
          roles: updatedRoles.length > 0 ? updatedRoles : ['BUYER'],
          isPartner: isStillActive,
          partnerId: result.partner.id,
          assignedCityId: isStillActive
            ? result.partner.assignedCityId
            : undefined,
          assignedCityName: isStillActive
            ? result.partner.assignedCityName
            : undefined,
          role: existingUser.isAdmin
            ? existingUser.role
            : isStillActive
              ? 'partner'
              : undefined,
        };
        serverUserAccounts.set(result.partner.phoneE164, updatedUser);
        await syncUserAccountToFirestore(updatedUser);
      }

      await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole: 'super_admin',
        actionType: action,
        targetEntityType: 'PARTNER',
        targetEntityId: result.partner.id,
        targetEntityName: `${result.partner.fullName} · ${result.partner.assignedCityName}`,
        status: 'SUCCESS',
        reason: `${action} on partner ${result.partner.fullName} (${result.partner.phoneE164}): ${reason}`,
      });

      return NextResponse.json({
        ok: true,
        partner: result.partner,
        message: `Partner ${result.partner.fullName} updated (${lifecycleAction}).`,
      });
    }

    // 5. GENERATE MONTHLY PARTNER SETTLEMENT STATEMENT
    if (action === 'GENERATE_MONTHLY_SETTLEMENT') {
      const partnerId = String(body.partnerId || '').trim();
      const periodMonth = String(body.periodMonth || '').trim();
      const agreedDeductions = Number(body.agreedDeductions) || 0;
      const deductionNotes = body.deductionNotes
        ? String(body.deductionNotes).trim()
        : undefined;

      const { stores, orders, transactions, platformFeeLedger } =
        await loadMarketplaceRevenueInputs();

      const result = await generateOrUpdateMonthlyPartnerSettlement({
        partnerId,
        periodMonth,
        currency: body.currency === 'USD' ? 'USD' : 'INR',
        agreedDeductions,
        deductionNotes,
        stores,
        orders,
        transactions,
        platformFeeLedger,
        adminUid,
        isSuperAdmin: true,
      });

      if (!result.ok || !result.settlement) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole: 'super_admin',
        actionType: 'GENERATE_PARTNER_SETTLEMENT',
        targetEntityType: 'PARTNER_SETTLEMENT',
        targetEntityId: result.settlement.id,
        targetEntityName: `${result.settlement.statementNumber} (${result.settlement.partnerName} · ${result.settlement.periodMonth})`,
        status: 'SUCCESS',
        reason: `Generated monthly settlement statement ${result.settlement.statementNumber} for ${result.settlement.assignedCityName} (${result.settlement.periodMonth}): Net Eligible=${result.settlement.netEligibleRevenue}, Partner 50% Share=${result.settlement.partnerPayableAmount}.`,
      });

      return NextResponse.json({
        ok: true,
        settlement: result.settlement,
        message: `Settlement statement ${result.settlement.statementNumber} generated.`,
      });
    }

    // 6. APPROVE PARTNER SETTLEMENT STATEMENT (DOES NOT MARK AS PAID)
    if (action === 'APPROVE_SETTLEMENT') {
      const settlementId = String(body.settlementId || '').trim();
      const result = await approvePartnerSettlementStatement({
        settlementId,
        adminUid,
        adminPhone,
        isSuperAdmin: true,
      });

      if (!result.ok || !result.settlement) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole: 'super_admin',
        actionType: 'APPROVE_PARTNER_SETTLEMENT',
        targetEntityType: 'PARTNER_SETTLEMENT',
        targetEntityId: result.settlement.id,
        targetEntityName: `${result.settlement.statementNumber} (${result.settlement.partnerName})`,
        status: 'SUCCESS',
        reason: `Approved settlement statement ${result.settlement.statementNumber} (${result.settlement.periodMonth}) for manual bank transfer payout.`,
      });

      return NextResponse.json({
        ok: true,
        settlement: result.settlement,
        message: `Settlement ${result.settlement.statementNumber} approved for manual bank transfer.`,
      });
    }

    // 7. RECORD MANUAL BANK TRANSFER PAYOUT & MARK SETTLEMENT AS PAID
    if (action === 'RECORD_MANUAL_PAYOUT') {
      const settlementId = String(body.settlementId || '').trim();
      const amountPaid = Number(body.amountPaid) || 0;
      const currency = body.currency === 'USD' ? 'USD' : 'INR';
      const paymentDate = String(
        body.paymentDate || new Date().toISOString().slice(0, 10)
      ).trim();
      const paymentMethod =
        body.paymentMethod === 'RTGS' ||
        body.paymentMethod === 'IMPS' ||
        body.paymentMethod === 'BANK_TRANSFER'
          ? body.paymentMethod
          : 'NEFT';
      const paymentReferenceNumber = String(
        body.paymentReferenceNumber || ''
      ).trim();
      const notes = body.notes ? String(body.notes).trim() : undefined;
      const proofDocumentUrl = body.proofDocumentUrl
        ? String(body.proofDocumentUrl).trim()
        : undefined;

      const result = await recordManualPartnerSettlementPayout({
        settlementId,
        amountPaid,
        currency,
        paymentDate,
        paymentMethod,
        paymentReferenceNumber,
        notes,
        proofDocumentUrl,
        adminUid,
        adminPhone,
        isSuperAdmin: true,
      });

      if (!result.ok || !result.settlement || !result.payment) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole: 'super_admin',
        actionType: 'RECORD_PARTNER_SETTLEMENT_PAYOUT',
        targetEntityType: 'PARTNER_SETTLEMENT',
        targetEntityId: result.settlement.id,
        targetEntityName: `${result.settlement.statementNumber} · Ref ${result.payment.paymentReferenceNumber}`,
        status: 'SUCCESS',
        reason: `Recorded manual bank transfer (${result.payment.paymentMethod} Ref: ${result.payment.paymentReferenceNumber}) of ${result.payment.currency} ${result.payment.amountPaid} for ${result.settlement.partnerName} (${result.settlement.assignedCityName}).`,
      });

      return NextResponse.json({
        ok: true,
        settlement: result.settlement,
        payment: result.payment,
        message: `Manual bank transfer (${result.payment.paymentReferenceNumber}) recorded and settlement updated to ${result.settlement.status}.`,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unsupported partner admin action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Internal error processing partner management action.',
      },
      { status: 500 }
    );
  }
}
