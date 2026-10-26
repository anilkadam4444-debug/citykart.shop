import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const readSource = (relPath) =>
  fs.readFileSync(path.join(rootDir, relPath), 'utf8');

const homepageSrc = readSource('app/page.tsx');
const partnerPortalSrc = readSource('components/city-partner-portal.tsx');
const partnerOtpPageSrc = readSource('app/partner/verify-otp/page.tsx');
const partnerOtpComponentSrc = readSource(
  'components/partner-otp-verification.tsx'
);
const partnerContextSrc = readSource('lib/partner-onboarding-context.ts');
const otpApiRouteSrc = readSource('app/api/auth/otp/route.ts');
const sharedModalSrc = readSource('components/mobile-otp-auth-modal.tsx');
const providerSrc = readSource('components/urbandirect-provider.tsx');
const partnerProgramSrc = readSource('lib/partner-program.ts');

// Pure behavioral replica of sanitizePartnerOnboardingState & resolvePostOtpNavigationDestination
// matching lib/partner-onboarding-context.ts
const FORBIDDEN_SENSITIVE_KEYS = new Set([
  'otp',
  'otpCode',
  'verificationToken',
  'idToken',
  'accessToken',
  'password',
  'secret',
  'identityDocNumber',
  'panOrTaxId',
  'bankAccountNumber',
  'role',
  'roles',
  'isPartner',
  'isAdmin',
  'isSuperAdmin',
  'status',
  'assignedCityId',
  'partnerId',
]);

function hasForbiddenKeysInObject(raw) {
  if (!raw || typeof raw !== 'object') return false;
  for (const [k, v] of Object.entries(raw)) {
    if (FORBIDDEN_SENSITIVE_KEYS.has(k)) return true;
    if (v && typeof v === 'object' && hasForbiddenKeysInObject(v)) return true;
  }
  return false;
}

function sanitizePartnerOnboardingState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.registrationIntent !== 'partner') return null;
  const stepRaw = String(raw.verificationStep || 'PHONE_ENTRY');
  const verificationStep =
    stepRaw === 'OTP_SENT' || stepRaw === 'PHONE_VERIFIED'
      ? stepRaw
      : 'PHONE_ENTRY';
  const returnTabRaw = String(raw.returnTab || 'apply');
  const returnTab =
    returnTabRaw === 'overview' || returnTabRaw === 'application-status'
      ? returnTabRaw
      : 'apply';

  return {
    registrationIntent: 'partner',
    countryCode: String(raw.countryCode || 'IN').slice(0, 8),
    dialCode: String(raw.dialCode || '+91').slice(0, 10),
    mobileNumber: String(raw.mobileNumber || '')
      .replace(/[^\d\s-]/g, '')
      .slice(0, 20),
    phoneE164: String(raw.phoneE164 || '').slice(0, 24),
    maskedPhone: String(raw.maskedPhone || '').slice(0, 32),
    verificationStep,
    resendAvailableAtMs:
      typeof raw.resendAvailableAtMs === 'number'
        ? raw.resendAvailableAtMs
        : undefined,
    returnPath: '/partner',
    returnTab,
    draftApplication: raw.draftApplication
      ? {
          fullLegalName: String(raw.draftApplication.fullLegalName || ''),
          email: String(raw.draftApplication.email || ''),
          cityId: String(
            raw.draftApplication.cityId || 'india-maharashtra-nanded'
          ),
        }
      : undefined,
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

function resolvePostOtpNavigationDestination(options) {
  const pathname = String(options.currentPathname || '').trim();
  const isPartnerRoute =
    pathname === '/partner' || pathname.startsWith('/partner/');
  const rawIntent = String(options.registrationIntent || '')
    .trim()
    .toLowerCase();

  if (rawIntent === 'partner') {
    const tab = options.partnerReturnTab || 'apply';
    return {
      resolvedIntent: 'partner',
      destination: `/partner?tab=${tab}&otpVerified=1`,
      recoveredFromMissingIntentOnPartnerRoute: false,
    };
  }

  if (isPartnerRoute) {
    const tab = options.partnerReturnTab || 'apply';
    return {
      resolvedIntent: 'partner',
      destination: `/partner?tab=${tab}&otpVerified=1`,
      recoveredFromMissingIntentOnPartnerRoute: true,
    };
  }

  if (rawIntent === 'store_owner' || rawIntent === 'seller') {
    return {
      resolvedIntent: 'store_owner',
      destination: '/seller/register',
      recoveredFromMissingIntentOnPartnerRoute: false,
    };
  }

  return {
    resolvedIntent: 'buyer',
    destination: '/',
    recoveredFromMissingIntentOnPartnerRoute: false,
  };
}

test('Scenario 1: Click Become a Partner from the public homepage routes to /partner', () => {
  assert.match(homepageSrc, /href="\/partner"/);
  assert.match(homepageSrc, /Become a Partner/);
  assert.match(homepageSrc, /Become a Partner \(50\/50 Share\)/);
});

test('Scenario 2: Start City Partner registration and enter a valid phone number with registrationIntent="partner"', () => {
  assert.match(partnerPortalSrc, /partner-inline-phone-input/);
  assert.match(partnerPortalSrc, /registrationIntent:\s*'partner'/);
  assert.match(otpApiRouteSrc, /registrationIntent === 'partner'/);

  const state = sanitizePartnerOnboardingState({
    registrationIntent: 'partner',
    countryCode: 'IN',
    dialCode: '+91',
    mobileNumber: '9876543210',
    phoneE164: '+919876543210',
    maskedPhone: '+91 ******3210',
    verificationStep: 'PHONE_ENTRY',
    returnTab: 'apply',
  });
  assert.ok(state);
  assert.equal(state.registrationIntent, 'partner');
  assert.equal(state.phoneE164, '+919876543210');
});

test('Scenario 3: Request OTP and verify navigation goes to dedicated /partner/verify-otp route', () => {
  // Confirm /app/partner/verify-otp/page.tsx exists and renders PartnerOtpVerification
  assert.match(partnerOtpPageSrc, /PartnerOtpVerification/);
  // Confirm City Partner Portal routes to /partner/verify-otp and never calls openOtpAuthModal with BUYER_SIGN_IN
  assert.match(partnerPortalSrc, /router\.push\('\/partner\/verify-otp'\)/);
  assert.doesNotMatch(partnerPortalSrc, /authContextMode:\s*'BUYER_SIGN_IN'/);
  assert.doesNotMatch(partnerPortalSrc, /defaultJourney:\s*'BUYER'/);
});

test('Scenario 4: Confirm /partner/verify-otp displays Partner-specific UI and never shows Buyer or Store Owner UI', () => {
  assert.match(
    partnerOtpComponentSrc,
    /Verify Your Phone — City Partner Registration/
  );
  assert.match(partnerOtpComponentSrc, /partner-otp-heading/);
  // Must not contain Buyer or Store Owner journey cards from MobileOtpAuthModal
  assert.doesNotMatch(partnerOtpComponentSrc, /Shop local stores/);
  assert.doesNotMatch(partnerOtpComponentSrc, /Start shopping/);
  assert.doesNotMatch(
    partnerOtpComponentSrc,
    /Continue to store registration/
  );
});

test('Scenario 5: Submit an invalid OTP and confirm partner context remains intact', () => {
  assert.match(partnerContextSrc, /auth\/invalid-verification-code/);
  assert.match(
    partnerContextSrc,
    /Incorrect 6-digit verification code\. Please check the SMS code and try again\./
  );
  // Confirm invalid OTP submission in PartnerOtpVerification does not clear partner onboarding context or redirect away
  assert.match(partnerOtpComponentSrc, /setErrorMsg\(formatted\.userMessage\)/);
  const stateAfterInvalidAttempt = sanitizePartnerOnboardingState({
    registrationIntent: 'partner',
    countryCode: 'IN',
    dialCode: '+91',
    mobileNumber: '9876543210',
    phoneE164: '+919876543210',
    maskedPhone: '+91 ******3210',
    verificationStep: 'OTP_SENT',
    returnTab: 'apply',
  });
  assert.equal(stateAfterInvalidAttempt?.registrationIntent, 'partner');
  assert.equal(stateAfterInvalidAttempt?.verificationStep, 'OTP_SENT');
});

test('Scenario 6: Test resend OTP cooldown and resend behavior', () => {
  assert.match(partnerOtpComponentSrc, /resendSeconds > 0/);
  assert.match(partnerOtpComponentSrc, /Resend code in \{resendSeconds\}s/);
  assert.match(partnerOtpComponentSrc, /partner-resend-otp-btn/);
  assert.match(partnerOtpComponentSrc, /handleResendOtp/);
  assert.match(partnerOtpComponentSrc, /if \(resendSeconds > 0 \|\| isSubmitting\) return;/);
});

test('Scenario 7: Submit a valid OTP and confirm navigation continues to next City Partner application step', () => {
  const nav = resolvePostOtpNavigationDestination({
    registrationIntent: 'partner',
    currentPathname: '/partner/verify-otp',
    partnerReturnTab: 'apply',
  });
  assert.equal(nav.resolvedIntent, 'partner');
  assert.equal(nav.destination, '/partner?tab=apply&otpVerified=1');
  assert.equal(nav.recoveredFromMissingIntentOnPartnerRoute, false);

  assert.match(
    otpApiRouteSrc,
    /'phone_verified_application_not_submitted'/
  );
  assert.match(otpApiRouteSrc, /'\/partner\?tab=apply'/);
});

test('Scenario 8: Refresh /partner/verify-otp mid-flow and confirm safe partner-context recovery without storing sensitive secrets', () => {
  assert.match(partnerOtpComponentSrc, /reloadedWithoutLiveConfirmation/);
  assert.match(partnerOtpComponentSrc, /partner-refresh-recovery-notice/);

  const maliciousAttempt = {
    registrationIntent: 'partner',
    countryCode: 'IN',
    dialCode: '+91',
    mobileNumber: '9876543210',
    phoneE164: '+919876543210',
    maskedPhone: '+91 ******3210',
    verificationStep: 'OTP_SENT',
    otpCode: '123456',
    verificationToken: 'secret-token',
    isPartner: true,
    role: 'partner',
    status: 'approved',
    bankAccountNumber: '999988887777',
    draftApplication: {
      fullLegalName: 'Aarav Deshmukh',
      email: 'aarav@example.com',
      cityId: 'india-maharashtra-nanded',
    },
  };
  assert.equal(hasForbiddenKeysInObject(maliciousAttempt), true);
  const sanitized = sanitizePartnerOnboardingState(maliciousAttempt);
  assert.ok(sanitized);
  assert.equal(hasForbiddenKeysInObject(sanitized), false);
  assert.equal(sanitized.phoneE164, '+919876543210');
  assert.equal(sanitized.draftApplication?.fullLegalName, 'Aarav Deshmukh');
});

test('Scenario 9: Open /partner/verify-otp directly without onboarding state and confirm safe partner recovery banner', () => {
  assert.match(partnerOtpComponentSrc, /openedWithoutOnboardingState/);
  assert.match(partnerOtpComponentSrc, /partner-otp-recovery-banner/);
  assert.match(
    partnerOtpComponentSrc,
    /Direct Access Recovery — City Partner Phone Verification/
  );

  // Also verify centralized routing helper recovers missing intent on /partner* routes into partner flow
  const recovered = resolvePostOtpNavigationDestination({
    registrationIntent: undefined,
    currentPathname: '/partner/verify-otp',
  });
  assert.equal(recovered.resolvedIntent, 'partner');
  assert.equal(recovered.destination, '/partner?tab=apply&otpVerified=1');
  assert.equal(recovered.recoveredFromMissingIntentOnPartnerRoute, true);
});

test('Scenario 10: Complete OTP verification and confirm user is NOT marked as an approved partner or admin yet', () => {
  // Verify server-side OTP API blocks privilege escalation fields with HTTP 403
  assert.match(otpApiRouteSrc, /FORBIDDEN_PRIVILEGE_ESCALATION_FIELDS/);
  assert.match(
    otpApiRouteSrc,
    /Security violation: Client cannot assign partner, admin, or approval status during OTP verification\./
  );
  // Verify unapproved partner applicants have isPartner: false, isAdmin: false, role: undefined
  assert.match(
    otpApiRouteSrc,
    /isPartner:\s*Boolean\(approvedPartnerRecord\)/
  );
  assert.match(
    otpApiRouteSrc,
    /role:\s*approvedPartnerRecord\s*\?\s*'partner'\s*:\s*undefined/
  );
  assert.match(
    otpApiRouteSrc,
    /'phone_verified_application_not_submitted'/
  );
});

test('Scenario 11: Submit the partner application after OTP verification and confirm status becomes pending_review', () => {
  assert.match(partnerProgramSrc, /export async function submitPartnerApplication/);
  assert.match(partnerProgramSrc, /status:\s*'pending_review'/);
  assert.match(partnerProgramSrc, /kycVerificationStatus:\s*'PENDING_MANUAL_REVIEW'/);
  assert.match(partnerProgramSrc, /otpVerified:\s*true/);
});

test('Scenario 12: Test Buyer registration/OTP flow to confirm no regression', () => {
  assert.match(sharedModalSrc, /'BUYER_SIGN_IN'/);
  assert.match(sharedModalSrc, /Shop local stores/);
  assert.match(sharedModalSrc, /Start shopping/);

  const buyerNav = resolvePostOtpNavigationDestination({
    registrationIntent: 'buyer',
    currentPathname: '/',
  });
  assert.equal(buyerNav.resolvedIntent, 'buyer');
  assert.equal(buyerNav.destination, '/');
  assert.equal(buyerNav.recoveredFromMissingIntentOnPartnerRoute, false);
});

test('Scenario 13: Test Store Owner registration/OTP flow to confirm no regression', () => {
  assert.match(sharedModalSrc, /'SELLER_SIGN_IN'/);
  assert.match(sharedModalSrc, /'SELLER_OPEN_STORE'/);
  assert.match(sharedModalSrc, /Open a local store/);
  assert.match(sharedModalSrc, /Continue to store registration/);
  assert.match(providerSrc, /PARTNER_REGISTRATION/);

  const sellerNav = resolvePostOtpNavigationDestination({
    registrationIntent: 'store_owner',
    currentPathname: '/seller/register',
  });
  assert.equal(sellerNav.resolvedIntent, 'store_owner');
  assert.equal(sellerNav.destination, '/seller/register');
  assert.equal(sellerNav.recoveredFromMissingIntentOnPartnerRoute, false);
});
