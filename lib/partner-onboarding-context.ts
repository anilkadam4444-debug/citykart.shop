import type { ConfirmationResult } from './firebase';
import type { PartnerKycAndPayoutInfo } from './partner-program';

export const PARTNER_ONBOARDING_STORAGE_KEY = 'citykart_partner_onboarding_v1';
export const PARTNER_OTP_ROUTE = '/partner/verify-otp';
export const PARTNER_PORTAL_ROUTE = '/partner';

export type PartnerVerificationStep =
  | 'PHONE_ENTRY'
  | 'OTP_SENT'
  | 'PHONE_VERIFIED';

export interface PartnerApplicationDraftState {
  fullLegalName: string;
  email: string;
  residentialOrBusinessAddress: string;
  countryCode: string;
  stateRegion: string;
  cityId: string;
  postalCode: string;
  relevantExperience: string;
  localGrowthPlan: string;
  identityDocType: PartnerKycAndPayoutInfo['identityDocType'];
  addressProofType: PartnerKycAndPayoutInfo['addressProofType'];
  bankAccountHolderName: string;
  bankName: string;
  bankIfscOrRoutingCode: string;
  consentAccepted: boolean;
}

export interface PartnerOnboardingContextState {
  registrationIntent: 'partner';
  countryCode: string;
  dialCode: string;
  mobileNumber: string;
  phoneE164: string;
  maskedPhone: string;
  verificationStep: PartnerVerificationStep;
  resendAvailableAtMs?: number;
  returnPath: '/partner';
  returnTab: 'overview' | 'apply' | 'application-status';
  draftApplication?: PartnerApplicationDraftState;
  updatedAt: string;
}

export interface ActivePartnerConfirmationSession {
  phoneE164: string;
  maskedPhone: string;
  countryCode: string;
  dialCode: string;
  mobileNumber: string;
  confirmationResult: ConfirmationResult | null;
  isPreviewTestFallback: boolean;
  consoleNotice: string | null;
  resendAvailableAtMs: number;
  createdAtMs: number;
}

// In-memory singleton for active SPA navigation from /partner -> /partner/verify-otp
// Never persisted to storage; holds the live Firebase ConfirmationResult object.
let activePartnerConfirmationSession: ActivePartnerConfirmationSession | null =
  null;

export function setActivePartnerConfirmationSession(
  session: ActivePartnerConfirmationSession | null
): void {
  activePartnerConfirmationSession = session;
}

export function getActivePartnerConfirmationSession(): ActivePartnerConfirmationSession | null {
  return activePartnerConfirmationSession;
}

export function clearActivePartnerConfirmationSession(): void {
  activePartnerConfirmationSession = null;
}

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

/**
 * Sanitizes partner onboarding state before reading/writing to sessionStorage.
 * Ensures no OTP codes, tokens, raw KYC ID numbers, or privileged role flags are ever stored.
 */
export function sanitizePartnerOnboardingState(
  raw: unknown
): PartnerOnboardingContextState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.registrationIntent !== 'partner') {
    return null;
  }

  const stepRaw = String(obj.verificationStep || 'PHONE_ENTRY');
  const verificationStep: PartnerVerificationStep =
    stepRaw === 'OTP_SENT' || stepRaw === 'PHONE_VERIFIED'
      ? stepRaw
      : 'PHONE_ENTRY';

  const returnTabRaw = String(obj.returnTab || 'apply');
  const returnTab: 'overview' | 'apply' | 'application-status' =
    returnTabRaw === 'overview' || returnTabRaw === 'application-status'
      ? returnTabRaw
      : 'apply';

  let draftApplication: PartnerApplicationDraftState | undefined;
  if (obj.draftApplication && typeof obj.draftApplication === 'object') {
    const d = obj.draftApplication as Record<string, unknown>;
    draftApplication = {
      fullLegalName: String(d.fullLegalName || '').slice(0, 120),
      email: String(d.email || '').slice(0, 120),
      residentialOrBusinessAddress: String(
        d.residentialOrBusinessAddress || ''
      ).slice(0, 300),
      countryCode: String(d.countryCode || 'IN').slice(0, 8),
      stateRegion: String(d.stateRegion || 'Maharashtra').slice(0, 100),
      cityId: String(d.cityId || 'india-maharashtra-nanded').slice(0, 120),
      postalCode: String(d.postalCode || '431601').slice(0, 20),
      relevantExperience: String(d.relevantExperience || '').slice(0, 1500),
      localGrowthPlan: String(d.localGrowthPlan || '').slice(0, 1500),
      identityDocType:
        (d.identityDocType as PartnerKycAndPayoutInfo['identityDocType']) ||
        'PAN_CARD',
      addressProofType:
        (d.addressProofType as PartnerKycAndPayoutInfo['addressProofType']) ||
        'AADHAAR',
      bankAccountHolderName: String(d.bankAccountHolderName || '').slice(
        0,
        120
      ),
      bankName: String(d.bankName || '').slice(0, 120),
      bankIfscOrRoutingCode: String(d.bankIfscOrRoutingCode || '').slice(
        0,
        24
      ),
      consentAccepted: Boolean(d.consentAccepted),
    };
  }

  return {
    registrationIntent: 'partner',
    countryCode: String(obj.countryCode || 'IN').slice(0, 8),
    dialCode: String(obj.dialCode || '+91').slice(0, 10),
    mobileNumber: String(obj.mobileNumber || '')
      .replace(/[^\d\s-]/g, '')
      .slice(0, 20),
    phoneE164: String(obj.phoneE164 || '').slice(0, 24),
    maskedPhone: String(obj.maskedPhone || '').slice(0, 32),
    verificationStep,
    resendAvailableAtMs:
      typeof obj.resendAvailableAtMs === 'number'
        ? obj.resendAvailableAtMs
        : undefined,
    returnPath: '/partner',
    returnTab,
    draftApplication,
    updatedAt: String(obj.updatedAt || new Date().toISOString()),
  };
}

export function hasForbiddenKeysInObject(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (FORBIDDEN_SENSITIVE_KEYS.has(k)) return true;
    if (v && typeof v === 'object' && hasForbiddenKeysInObject(v)) return true;
  }
  return false;
}

export function readPartnerOnboardingContext(): PartnerOnboardingContextState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PARTNER_ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizePartnerOnboardingState(parsed);
  } catch {
    return null;
  }
}

export function writePartnerOnboardingContext(
  state: Partial<PartnerOnboardingContextState> & {
    registrationIntent?: 'partner';
  }
): PartnerOnboardingContextState {
  const existing = readPartnerOnboardingContext();
  const mergedRaw: PartnerOnboardingContextState = {
    registrationIntent: 'partner',
    countryCode: state.countryCode ?? existing?.countryCode ?? 'IN',
    dialCode: state.dialCode ?? existing?.dialCode ?? '+91',
    mobileNumber: state.mobileNumber ?? existing?.mobileNumber ?? '',
    phoneE164: state.phoneE164 ?? existing?.phoneE164 ?? '',
    maskedPhone: state.maskedPhone ?? existing?.maskedPhone ?? '',
    verificationStep:
      state.verificationStep ?? existing?.verificationStep ?? 'PHONE_ENTRY',
    resendAvailableAtMs:
      state.resendAvailableAtMs !== undefined
        ? state.resendAvailableAtMs
        : existing?.resendAvailableAtMs,
    returnPath: '/partner',
    returnTab: state.returnTab ?? existing?.returnTab ?? 'apply',
    draftApplication: state.draftApplication ?? existing?.draftApplication,
    updatedAt: new Date().toISOString(),
  };

  const sanitized = sanitizePartnerOnboardingState(mergedRaw)!;

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        PARTNER_ONBOARDING_STORAGE_KEY,
        JSON.stringify(sanitized)
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  return sanitized;
}

export function clearPartnerOnboardingContext(): void {
  clearActivePartnerConfirmationSession();
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PARTNER_ONBOARDING_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function formatFirebasePhoneAuthError(err: unknown): {
  userMessage: string;
  errorCode: string;
  isConsoleConfigNotice: boolean;
  isExpired: boolean;
  isRateLimited: boolean;
} {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const rawMessage = err instanceof Error ? err.message : String(err || '');

  if (code === 'auth/invalid-phone-number') {
    return {
      userMessage:
        'Please enter a valid mobile phone number in international format.',
      errorCode: code,
      isConsoleConfigNotice: false,
      isExpired: false,
      isRateLimited: false,
    };
  }
  if (code === 'auth/invalid-verification-code') {
    return {
      userMessage:
        'Incorrect 6-digit verification code. Please check the SMS code and try again.',
      errorCode: code,
      isConsoleConfigNotice: false,
      isExpired: false,
      isRateLimited: false,
    };
  }
  if (code === 'auth/code-expired' || code === 'auth/session-expired') {
    return {
      userMessage:
        'Your verification code has expired. Tap "Resend OTP Code" below to receive a fresh verification code.',
      errorCode: code || 'auth/code-expired',
      isConsoleConfigNotice: false,
      isExpired: true,
      isRateLimited: false,
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      userMessage:
        'Too many verification attempts from this device or number. Please wait a few minutes and try again.',
      errorCode: code,
      isConsoleConfigNotice: false,
      isExpired: false,
      isRateLimited: true,
    };
  }
  if (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/unauthorized-domain' ||
    code === 'auth/billing-not-enabled' ||
    code === 'auth/quota-exceeded' ||
    code === 'auth/captcha-check-failed' ||
    code === 'auth/internal-error' ||
    rawMessage.includes('BILLING_NOT_ENABLED') ||
    rawMessage.includes('OPERATION_NOT_ALLOWED')
  ) {
    return {
      userMessage:
        'Firebase Phone Authentication requires enabling the Phone provider, adding this preview domain to Authorized Domains, or configuring test phone numbers / Blaze SMS billing in Firebase Console (project: urbandirectintracity). Preview test mode is active so you can verify the City Partner flow using test code 123456.',
      errorCode: code || 'auth/console-config-notice',
      isConsoleConfigNotice: true,
      isExpired: false,
      isRateLimited: false,
    };
  }

  return {
    userMessage:
      'Could not complete phone verification right now. Please check your number and try again.',
    errorCode: code || 'auth/unknown',
    isConsoleConfigNotice: false,
    isExpired: false,
    isRateLimited: false,
  };
}

export type RegistrationFlowType = 'buyer' | 'store_owner' | 'partner';

/**
 * Centralized post-OTP navigation helper across Buyer, Store Owner, and City Partner flows.
 * - Never defaults missing/invalid intent to 'buyer' or 'store_owner' when initiated from `/partner*` routes.
 */
export function resolvePostOtpNavigationDestination(options: {
  registrationIntent?: RegistrationFlowType | string | null;
  currentPathname?: string | null;
  partnerReturnTab?: 'overview' | 'apply' | 'application-status';
}): {
  resolvedIntent: RegistrationFlowType;
  destination: string;
  recoveredFromMissingIntentOnPartnerRoute: boolean;
} {
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

  // Never fall back to buyer or store_owner if initiated from /partner* routes
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
