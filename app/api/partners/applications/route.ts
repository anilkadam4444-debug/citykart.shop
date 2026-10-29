import { NextRequest, NextResponse } from 'next/server';
import {
  normalizePhoneE164,
  resolveSuperAdminSessionFromRequest,
} from '@/lib/super-admin-auth';
import { findCanonicalCityById } from '@/lib/global-locations-data';

import { partnerApplications, PartnerApplication } from '@/lib/partner-applications-registry';

export async function verifyAuthenticatedCaller(req: NextRequest) {
  return resolveSuperAdminSessionFromRequest(req);
}

export async function GET(req: NextRequest) {
  const session = await verifyAuthenticatedCaller(req);
  if (!session.authenticated) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const allApps = Array.from(partnerApplications.values());
  // Admins & Super Admins see all applications; regular callers only see their own applications
  const visibleApps = session.authorized
    ? allApps
    : allApps.filter(
        (a) =>
          session.phoneE164 &&
          normalizePhoneE164(a.phoneE164) === normalizePhoneE164(session.phoneE164)
      );

  return NextResponse.json({ ok: true, applications: visibleApps });
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuthenticatedCaller(req);
    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: 'Authentication is required. Please verify mobile number.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      fullName,
      fullLegalName,
      phoneE164,
      email,
      cityId,
      action,
      applicationId,
      residentialOrBusinessAddress,
      countryCode,
      stateRegion,
      district,
      postalCode,
      relevantExperience,
      localGrowthPlan,
      kyc,
    } = body || {};

    if (action === 'WITHDRAW' && applicationId) {
      const app = partnerApplications.get(applicationId);
      if (!app) {
        return NextResponse.json({ ok: false, error: 'Application not found.' }, { status: 404 });
      }
      // Enforce ownership or admin authority on WITHDRAW
      const isApplicantOwner =
        session.phoneE164 &&
        normalizePhoneE164(app.phoneE164) === normalizePhoneE164(session.phoneE164);
      if (!isApplicantOwner && !session.authorized) {
        return NextResponse.json(
          { ok: false, error: 'Forbidden: Cannot withdraw another applicant’s application.' },
          { status: 403 }
        );
      }
      partnerApplications.delete(applicationId);
      return NextResponse.json({ ok: true, message: 'Application withdrawn.' });
    }

    // Negative check: applicant cannot set status to APPROVED
    if (body.status === 'APPROVED' && !session.isSuperAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Applicants cannot self-approve applications.' },
        { status: 403 }
      );
    }

    const effectiveName = String(fullLegalName || fullName || '').trim();
    const effectivePhone = phoneE164 ? normalizePhoneE164(phoneE164) : session.phoneE164;

    if (!effectiveName || !effectivePhone || !cityId) {
      return NextResponse.json(
        { ok: false, error: 'Full name, phone, and target city are required.' },
        { status: 400 }
      );
    }

    // Validate canonical city
    const canonicalCity = findCanonicalCityById(cityId);
    if (!canonicalCity) {
      return NextResponse.json(
        { ok: false, error: 'Target city is not a recognized canonical city.' },
        { status: 400 }
      );
    }

    // Check duplicate pending application
    const existing = Array.from(partnerApplications.values()).find(
      (a) =>
        normalizePhoneE164(a.phoneE164) === effectivePhone &&
        a.cityId === canonicalCity.cityId &&
        ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(a.status)
    );
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'A pending application for this city already exists.' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const appId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const refId = `CK-PARTNER-${new Date().getFullYear()}-${String(partnerApplications.size + 1).padStart(4, '0')}`;
    const newApp: PartnerApplication = {
      id: appId,
      referenceId: refId,
      fullName: effectiveName,
      fullLegalName: effectiveName,
      phone: effectivePhone,
      phoneE164: effectivePhone,
      otpVerified: true,
      email: String(email || '').trim(),
      residentialOrBusinessAddress: String(
        residentialOrBusinessAddress || `${canonicalCity.cityName}, ${canonicalCity.stateRegion}`
      ).trim(),
      countryCode: String(countryCode || canonicalCity.countryCode || 'IN'),
      stateRegion: String(stateRegion || canonicalCity.stateRegion || 'Maharashtra'),
      cityId: canonicalCity.cityId,
      cityName: canonicalCity.cityName,
      district: String(district || canonicalCity.district || canonicalCity.cityName),
      postalCode: String(postalCode || canonicalCity.postalCodePrefix || '400001'),
      relevantExperience: String(relevantExperience || 'Local retail & merchant onboarding'),
      localGrowthPlan: String(localGrowthPlan || 'Expand verified stores across city'),
      investmentTier: 'EXCLUSIVE_CITY_PARTNER',
      status: 'PENDING',
      commissionPct: 50,
      kyc: {
        identityDocType: kyc?.identityDocType || 'PAN_CARD',
        identityDocNumber: kyc?.identityDocNumber || 'PENDING',
        addressProofType: kyc?.addressProofType || 'AADHAAR',
        panOrTaxId: kyc?.panOrTaxId || 'PENDING',
        bankAccountHolderName: kyc?.bankAccountHolderName || effectiveName,
        bankAccountNumber: kyc?.bankAccountNumber || 'XXXX0000',
        bankIfscOrRoutingCode: kyc?.bankIfscOrRoutingCode || 'HDFC0000001',
        bankName: kyc?.bankName || 'HDFC Bank',
        kycVerificationStatus: kyc?.kycVerificationStatus || 'PENDING',
      },
      createdAt: now,
      submittedAt: now,
    };

    partnerApplications.set(appId, newApp);

    return NextResponse.json({
      ok: true,
      message: 'Partner application submitted successfully.',
      application: newApp,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Application submission failed.' },
      { status: 500 }
    );
  }
}
