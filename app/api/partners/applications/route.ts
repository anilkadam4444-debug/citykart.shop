import { NextRequest, NextResponse } from 'next/server';
import {
  normalizePhoneE164,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';
import {
  checkCityPartnerAvailability,
  findCanonicalCityRecord,
  hydratePartnerRegistriesFromFirestore,
  markPartnerNotificationRead,
  persistPartnerApplication,
  resolvePartnerStatusForUser,
  sanitizeApplicationForApplicantView,
  serverPartnerApplicationsRegistry,
  serverPartnerNotificationsRegistry,
  submitPartnerApplication,
  validateApplicationStateTransition,
} from '@/lib/partner-program';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await hydratePartnerRegistriesFromFirestore();

  const { searchParams } = new URL(req.url);
  const queryCityId = searchParams.get('cityId');
  const queryCountry = searchParams.get('country');
  const queryState = searchParams.get('stateRegion');
  const queryCityName = searchParams.get('cityName');

  // 1. Optional Canonical City Availability Check
  let cityAvailability: ReturnType<typeof checkCityPartnerAvailability> | null =
    null;
  let canonicalCityRecord = null;
  let canonicalError: string | undefined;

  if (queryCityId || (queryCountry && queryState && queryCityName)) {
    const canonicalCheck = findCanonicalCityRecord({
      cityId: queryCityId || undefined,
      country: queryCountry || undefined,
      stateRegion: queryState || undefined,
      cityName: queryCityName || undefined,
    });
    if (canonicalCheck.valid && canonicalCheck.cityRecord) {
      canonicalCityRecord = canonicalCheck.cityRecord;
      cityAvailability = checkCityPartnerAvailability(
        canonicalCheck.cityRecord.cityId
      );
    } else {
      canonicalError = canonicalCheck.error;
    }
  }

  // 2. Check Authenticated Caller for their own Applications & Partner Status
  const caller = await verifyAuthenticatedCaller(req);
  if (!caller.authenticated) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      canonicalCity: canonicalCityRecord,
      canonicalError,
      cityAvailability,
      applications: [],
      partnerRecord: null,
      notifications: [],
    });
  }

  const statusInfo = resolvePartnerStatusForUser({
    uid: caller.uid,
    phoneE164: caller.phoneE164,
  });

  const myApplications = Array.from(
    serverPartnerApplicationsRegistry.values()
  )
    .filter(
      (app) =>
        app.phoneE164 === caller.phoneE164 || app.applicantUid === caller.uid
    )
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map(sanitizeApplicationForApplicantView);

  const myNotifications = Array.from(
    serverPartnerNotificationsRegistry.values()
  )
    .filter(
      (n) =>
        n.recipientPhoneE164 === caller.phoneE164 ||
        (n.recipientUid && n.recipientUid === caller.uid)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({
    ok: true,
    authenticated: true,
    canonicalCity: canonicalCityRecord,
    canonicalError,
    cityAvailability,
    isActivePartner: statusInfo.isActivePartner,
    partnerRecord: statusInfo.partnerRecord,
    latestApplication: statusInfo.latestApplication
      ? sanitizeApplicationForApplicantView(statusInfo.latestApplication)
      : null,
    applications: myApplications,
    notifications: myNotifications,
  });
}

export async function POST(req: NextRequest) {
  await hydratePartnerRegistriesFromFirestore();

  const caller = await verifyAuthenticatedCaller(req);
  if (!caller.authenticated) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Authentication required: Please verify your mobile number with OTP before submitting or updating a Partner Application.',
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const action = String(body.action || 'SUBMIT_APPLICATION').trim();

    // Security Gate: Block any applicant attempt to self-approve, escalate role, or self-verify KYC
    if (
      body.status === 'approved' ||
      body.role === 'partner' ||
      body.role === 'admin' ||
      body.role === 'super_admin' ||
      body.kycVerificationStatus === 'VERIFIED' ||
      body?.kyc?.kycVerificationStatus === 'VERIFIED'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Forbidden: Applicants cannot self-approve applications, modify assigned roles, or mark KYC as verified.',
        },
        { status: 403 }
      );
    }

    // 1. SUBMIT NEW PARTNER APPLICATION
    if (action === 'SUBMIT_APPLICATION') {
      const requestedPhone = normalizePhoneE164(
        String(body.phoneE164 || caller.phoneE164).trim()
      );
      if (requestedPhone !== caller.phoneE164) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Mobile number mismatch: The application mobile number must match your OTP-verified session phone number.',
          },
          { status: 403 }
        );
      }

      const result = await submitPartnerApplication({
        applicantUid: caller.uid,
        fullLegalName: String(body.fullLegalName || ''),
        phoneE164: caller.phoneE164,
        maskedPhone: String(body.maskedPhone || ''),
        otpVerified: true,
        email: String(body.email || ''),
        residentialOrBusinessAddress: String(
          body.residentialOrBusinessAddress || ''
        ),
        country: String(body.country || 'India'),
        countryCode: String(body.countryCode || 'IN'),
        stateRegion: String(body.stateRegion || ''),
        cityId: String(body.cityId || ''),
        cityName: String(body.cityName || ''),
        district: body.district ? String(body.district) : undefined,
        postalCode: String(body.postalCode || ''),
        relevantExperience: String(body.relevantExperience || ''),
        localGrowthPlan: String(body.localGrowthPlan || ''),
        identityDocType: body.identityDocType || 'PAN_CARD',
        identityDocNumber: String(body.identityDocNumber || ''),
        addressProofType: body.addressProofType || 'AADHAAR',
        addressProofReference: body.addressProofReference
          ? String(body.addressProofReference)
          : undefined,
        panOrTaxId: String(body.panOrTaxId || ''),
        bankAccountHolderName: String(body.bankAccountHolderName || ''),
        bankAccountNumber: String(body.bankAccountNumber || ''),
        bankIfscOrRoutingCode: String(body.bankIfscOrRoutingCode || ''),
        bankName: String(body.bankName || ''),
        supportingDocuments: Array.isArray(body.supportingDocuments)
          ? body.supportingDocuments
          : [],
        consentAccepted: Boolean(body.consentAccepted),
      });

      if (!result.ok || !result.application) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: result.statusCode || 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        application: sanitizeApplicationForApplicantView(result.application),
        message: `Application ${result.application.referenceId} submitted with status pending_review.`,
      });
    }

    // 2. PROVIDE ADDITIONAL INFORMATION WHEN REQUESTED BY SUPER ADMIN
    if (action === 'PROVIDE_ADDITIONAL_INFO') {
      const applicationId = String(body.applicationId || '').trim();
      const responseText = String(body.responseText || '').trim();

      const app = serverPartnerApplicationsRegistry.get(applicationId);
      if (!app) {
        return NextResponse.json(
          { ok: false, error: 'Application not found.' },
          { status: 404 }
        );
      }
      if (
        app.phoneE164 !== caller.phoneE164 &&
        app.applicantUid !== caller.uid
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Forbidden: You can only update your own application.',
          },
          { status: 403 }
        );
      }
      if (!responseText || responseText.length < 5) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Please provide the requested additional information (minimum 5 characters).',
          },
          { status: 400 }
        );
      }

      const transition = validateApplicationStateTransition({
        fromStatus: app.status,
        toStatus: 'pending_review',
        actorRole: 'applicant',
        otpVerified: app.otpVerified,
      });

      if (!transition.allowed) {
        return NextResponse.json(
          { ok: false, error: transition.error },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const updated: typeof app = {
        ...app,
        status: 'pending_review',
        applicantAdditionalResponse: responseText,
        updatedAt: nowIso,
        history: [
          ...app.history,
          {
            id: `hist_${Date.now()}`,
            timestamp: nowIso,
            fromStatus: app.status,
            toStatus: 'pending_review',
            actorUid: caller.uid,
            actorName: app.fullLegalName,
            actorRole: 'applicant',
            note: `Applicant submitted requested additional information: ${responseText}`,
          },
        ],
      };

      await persistPartnerApplication(updated);
      return NextResponse.json({
        ok: true,
        application: sanitizeApplicationForApplicantView(updated),
      });
    }

    // 3. WITHDRAW APPLICATION
    if (action === 'WITHDRAW_APPLICATION') {
      const applicationId = String(body.applicationId || '').trim();
      const app = serverPartnerApplicationsRegistry.get(applicationId);
      if (!app) {
        return NextResponse.json(
          { ok: false, error: 'Application not found.' },
          { status: 404 }
        );
      }
      if (
        app.phoneE164 !== caller.phoneE164 &&
        app.applicantUid !== caller.uid
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Forbidden: You can only withdraw your own application.',
          },
          { status: 403 }
        );
      }

      const transition = validateApplicationStateTransition({
        fromStatus: app.status,
        toStatus: 'withdrawn',
        actorRole: 'applicant',
        otpVerified: app.otpVerified,
      });
      if (!transition.allowed) {
        return NextResponse.json(
          { ok: false, error: transition.error },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const updated: typeof app = {
        ...app,
        status: 'withdrawn',
        statusReason: 'Withdrawn by applicant.',
        updatedAt: nowIso,
        history: [
          ...app.history,
          {
            id: `hist_${Date.now()}`,
            timestamp: nowIso,
            fromStatus: app.status,
            toStatus: 'withdrawn',
            actorUid: caller.uid,
            actorName: app.fullLegalName,
            actorRole: 'applicant',
            note: 'Application withdrawn by applicant.',
          },
        ],
      };

      await persistPartnerApplication(updated);
      return NextResponse.json({
        ok: true,
        application: sanitizeApplicationForApplicantView(updated),
      });
    }

    // 4. MARK PARTNER NOTIFICATION READ
    if (action === 'MARK_NOTIFICATION_READ') {
      const notifId = String(body.notificationId || '').trim();
      await markPartnerNotificationRead({
        notificationId: notifId,
        callerUid: caller.uid,
        callerPhoneE164: caller.phoneE164,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: `Unsupported action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to process partner application request.',
      },
      { status: 500 }
    );
  }
}
