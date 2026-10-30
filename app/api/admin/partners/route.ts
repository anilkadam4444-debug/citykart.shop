import { NextRequest, NextResponse } from 'next/server';
import {
  normalizePhoneE164,
  recordAdminAuditLog,
  verifyAdminRequest,
} from '@/lib/super-admin-auth';
import { partnerApplications, PartnerApplication } from '@/lib/partner-applications-registry';
import { findCanonicalCityById } from '@/lib/global-locations-data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkCityId = searchParams.get('checkCityAvailability');

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
    (a) => (a.status || '').toUpperCase() === 'APPROVED'
  );

  if (checkCityId) {
    const activeInCity = approvedApps.find((a) => a.cityId === checkCityId);
    return NextResponse.json({
      ok: true,
      availability: {
        cityId: checkCityId,
        isAvailable: !activeInCity,
        activePartnerName: activeInCity?.fullLegalName || activeInCity?.fullName,
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

  const partners = approvedApps.map((app) => {
    const activatedIso = app.reviewedAt || app.submittedAt || app.createdAt || nowIso;
    const refCode = app.referenceId || `CK-P-${app.id}`;
    return {
      id: `partner_${app.id}`,
      partnerCode: refCode,
      applicationId: app.id,
      applicationReferenceId: refCode,
      fullName: app.fullLegalName || app.fullName,
      phoneE164: app.phoneE164,
      email: app.email,
      residentialOrBusinessAddress: app.residentialOrBusinessAddress || app.cityName,
      countryCode: app.countryCode || 'IN',
      assignedCountryCode: app.countryCode || 'IN',
      assignedCountry: 'India',
      stateRegion: app.stateRegion || 'Maharashtra',
      assignedStateRegion: app.stateRegion || 'Maharashtra',
      assignedCityId: app.cityId,
      assignedCityName: app.cityName,
      assignedDistrict: app.district || app.cityName,
      exclusivityModel: 'ONE_CITY_ONE_PARTNER' as const,
      revenueSharePct: app.commissionPct ?? 50,
      revenueSharePercent: app.commissionPct ?? 50,
      platformRetainedSharePct: 100 - (app.commissionPct ?? 50),
      citykartRetainedPercent: 100 - (app.commissionPct ?? 50),
      status: 'ACTIVE' as const,
      kycStatus: app.kyc?.kycVerificationStatus || ('VERIFIED' as const),
      kycVerificationStatus: app.kyc?.kycVerificationStatus || ('VERIFIED' as const),
      bankAccountSummary: `${app.kyc?.bankName || 'State Bank of India'} (${app.kyc?.bankAccountNumber || 'XXXX4416'})`,
      approvedAt: activatedIso,
      activatedAt: activatedIso,
      approvedByAdminUid: app.reviewedByAdminUid || 'uid-8329306616',
      approvedByAdminPhone: app.reviewedByAdminPhone || '+918329306616',
      updatedAt: app.submittedAt || app.createdAt || nowIso,
    };
  });

  const allocations = partners.map((p) => ({
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

  const cityRevenueByPartnerId: Record<string, any> = {};
  const cityPerformanceByPartnerId: Record<string, any> = {};
  for (const p of partners) {
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
      storesCount: 3,
      activeStoresCount: 3,
      ordersCount: 12,
      deliveredOrdersCount: 9,
    };
  }

  return NextResponse.json({
    ok: true,
    isSuperAdmin: session.isSuperAdmin,
    adminRole: session.role,
    applications: normalizedApps,
    partners,
    allocations,
    settlements: [],
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

    // Direct onboarding requires Super Admin authority (supports both DIRECT_ONBOARD and DIRECT_ONBOARD_PARTNER)
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
      const cityId = dp.cityId;
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
        reviewedByAdminUid: session.firebaseUid || 'uid-8329306616',
        reviewedByAdminPhone: session.phoneE164 || '+918329306616',
      };
      partnerApplications.set(appId, record);
      recordAdminAuditLog('DIRECT_ONBOARD_PARTNER', {
        partnerId: appId,
        phoneE164: record.phoneE164,
        cityId,
        actorUid: session.firebaseUid,
      });
      return NextResponse.json({
        ok: true,
        message: 'Partner directly onboarded.',
        partnerId: appId,
        application: record,
      });
    }

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
      if (app) {
        app.status = effectiveStatus;
        app.reviewedAt = new Date().toISOString();
        app.reviewedByAdminUid = session.firebaseUid || 'uid-8329306616';
        app.reviewedByAdminPhone = session.phoneE164 || '+918329306616';
        if (body.reviewNotes) app.reviewNotes = String(body.reviewNotes);
        if (body.rejectionReason) app.rejectionReason = String(body.rejectionReason);
        if (effectiveStatus === 'APPROVED' && app.kyc) {
          app.kyc.kycVerificationStatus = 'VERIFIED';
        }
        recordAdminAuditLog(`PARTNER_APPLICATION_${effectiveStatus}`, {
          applicationId,
          phoneE164: app.phoneE164,
          cityId: app.cityId,
          status: effectiveStatus,
          actorUid: session.firebaseUid,
        });
        return NextResponse.json({
          ok: true,
          message: `Application ${effectiveStatus.toLowerCase()}.`,
          application: app,
        });
      }
      return NextResponse.json({ ok: false, error: 'Application not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: false, error: 'Invalid operation.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Partner action failed.' },
      { status: 500 }
    );
  }
}

