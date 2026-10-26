'use client';

import React, {useState, useEffect, useMemo, useRef} from 'react';
import {
  Phone,
  ShieldCheck,
  X,
  Check,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Search,
  ChevronDown,
  Store,
  ShoppingBag,
  Info,
} from 'lucide-react';
import {
  CountryCallingRecord,
  INTERNATIONAL_COUNTRIES,
  validatePhoneNumberForCountry,
} from '@/lib/countries-data';
import {SellerProfile, UserAccount} from '@/lib/catalog-data';
import {
  auth,
  ConfirmationResult,
  FIREBASE_PROJECT_ID,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  syncUserAccountToFirestore,
  testFirestoreConnection,
} from '@/lib/firebase';

export type OtpAuthContextMode =
  | 'BUYER_SIGN_IN'
  | 'SELLER_SIGN_IN'
  | 'SELLER_OPEN_STORE'
  | 'PARTNER_REGISTRATION';

interface MobileOtpAuthModalProps {
  isOpen: boolean;
  defaultJourney?: 'BUYER' | 'SELLER';
  authContextMode?: OtpAuthContextMode;
  unmigratedSellers?: SellerProfile[];
  onAuthenticated: (
    user: UserAccount,
    selectedJourney: 'BUYER' | 'SELLER',
    migratedSellerId?: string
  ) => void;
  onClose: () => void;
}

type AuthStep = 'ENTER_PHONE' | 'VERIFY_OTP' | 'COMPLETE_PROFILE';

function formatFirebasePhoneAuthError(err: unknown): {
  userMessage: string;
  isConsoleConfigNotice: boolean;
} {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as {code?: unknown}).code || '')
      : '';
  const rawMessage = err instanceof Error ? err.message : String(err || '');

  if (code === 'auth/invalid-phone-number') {
    return {
      userMessage:
        'Please enter a valid mobile phone number in international format.',
      isConsoleConfigNotice: false,
    };
  }
  if (code === 'auth/invalid-verification-code') {
    return {
      userMessage:
        'Incorrect 6-digit verification code. Please check the SMS code and try again.',
      isConsoleConfigNotice: false,
    };
  }
  if (code === 'auth/code-expired') {
    return {
      userMessage:
        'Your verification code has expired. Tap "Resend code" to receive a new one.',
      isConsoleConfigNotice: false,
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      userMessage:
        'Too many verification attempts from this device or number. Please wait a few minutes and try again.',
      isConsoleConfigNotice: false,
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
        'Firebase Phone Authentication requires enabling the Phone provider, adding this preview domain to Authorized Domains, or configuring test phone numbers / Blaze SMS billing in Firebase Console (project: urbandirectintracity). Preview test mode is active so you can verify the flow using test code 123456.',
      isConsoleConfigNotice: true,
    };
  }

  return {
    userMessage:
      'Could not complete phone verification right now. Please check your number and try again.',
    isConsoleConfigNotice: false,
  };
}

export function MobileOtpAuthModal({
  isOpen,
  defaultJourney = 'BUYER',
  authContextMode = 'BUYER_SIGN_IN',
  unmigratedSellers = [],
  onAuthenticated,
  onClose,
}: MobileOtpAuthModalProps) {
  const [step, setStep] = useState<AuthStep>('ENTER_PHONE');

  // Country calling code selector state
  const [selectedCountry, setSelectedCountry] = useState<CountryCallingRecord>(
    INTERNATIONAL_COUNTRIES[0] // India (+91) default, searchable across all international countries
  );
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] =
    useState<boolean>(false);
  const [countrySearch, setCountrySearch] = useState<string>('');

  // Phone & Firebase ConfirmationResult state
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [phoneE164, setPhoneE164] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [firebaseConfirmation, setFirebaseConfirmation] =
    useState<ConfirmationResult | null>(null);
  const [isPreviewTestFallback, setIsPreviewTestFallback] =
    useState<boolean>(false);
  const [consoleNotice, setConsoleNotice] = useState<string | null>(null);
  const [showConsoleGuide, setShowConsoleGuide] = useState<boolean>(false);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Resend timer state
  const [resendSeconds, setResendSeconds] = useState<number>(0);

  // New account / migration profile step state
  const [fullName, setFullName] = useState<string>('');
  const [journey, setJourney] = useState<'BUYER' | 'SELLER'>(defaultJourney);
  const [migrateSellerId, setMigrateSellerId] = useState<string>('');

  // Loading & Error feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void testFirestoreConnection();
    }
  }, [isOpen]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // Ignore cleanup errors
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return INTERNATIONAL_COUNTRIES;
    return INTERNATIONAL_COUNTRIES.filter((c) =>
      `${c.name} ${c.code} ${c.dialCode}`.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  if (!isOpen) return null;

  const getOrCreateRecaptchaVerifier = (): RecaptchaVerifier => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // Ignore clear error before recreating
      }
      recaptchaVerifierRef.current = null;
    }

    const container = document.getElementById('firebase-recaptcha-container');
    if (container) {
      container.innerHTML = '';
    }

    const verifier = new RecaptchaVerifier(
      auth,
      'firebase-recaptcha-container',
      {
        size: 'invisible',
      }
    );
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setConsoleNotice(null);

    const validation = validatePhoneNumberForCountry(
      mobileNumber,
      selectedCountry
    );
    if (!validation.isValid) {
      setErrorMsg(
        validation.error || 'Please enter a valid mobile phone number.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Validate format & rate-limit window on server
      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'VALIDATE_PHONE',
          countryCode: selectedCountry.code,
          mobileNumber: validation.digitsOnly,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(
          data?.error ||
            'Could not send verification code. Please check your number and try again.'
        );
        if (typeof data?.retryAfterSeconds === 'number') {
          setResendSeconds(data.retryAfterSeconds);
        }
        setIsSubmitting(false);
        return;
      }

      const targetE164 = String(data.phoneE164);
      const targetMasked = String(data.maskedPhone);

      // 2. Dispatch OTP via native Firebase Phone Authentication (`urbandirectintracity`)
      try {
        const appVerifier = getOrCreateRecaptchaVerifier();
        const confirmationResult = await signInWithPhoneNumber(
          auth,
          targetE164,
          appVerifier
        );
        setFirebaseConfirmation(confirmationResult);
        setIsPreviewTestFallback(false);
      } catch (firebaseErr) {
        const formatted = formatFirebasePhoneAuthError(firebaseErr);
        if (formatted.isConsoleConfigNotice) {
          // If Firebase Console Phone Auth provider / Authorized Domain / Blaze billing
          // is not yet enabled on urbandirectintracity, display the Console guidance and
          // allow Firebase test-number verification flow in preview mode.
          setFirebaseConfirmation(null);
          setIsPreviewTestFallback(true);
          setConsoleNotice(formatted.userMessage);
        } else {
          setErrorMsg(formatted.userMessage);
          setIsSubmitting(false);
          return;
        }
      }

      setPhoneE164(targetE164);
      setMaskedPhone(targetMasked);
      setResendSeconds(Number(data.resendCooldownSeconds) || 30);
      setOtpCode('');
      setStep('VERIFY_OTP');
      setIsSubmitting(false);
    } catch {
      setIsSubmitting(false);
      setErrorMsg(
        'Network error while requesting verification code. Please try again.'
      );
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanOtp = otpCode.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      let firebaseUid: string | undefined;
      let idToken: string | undefined;

      if (firebaseConfirmation) {
        try {
          const userCredential = await firebaseConfirmation.confirm(cleanOtp);
          firebaseUid = userCredential.user.uid;
          idToken = await userCredential.user
            .getIdToken()
            .catch(() => undefined);
        } catch (confirmErr) {
          const formatted = formatFirebasePhoneAuthError(confirmErr);
          setErrorMsg(formatted.userMessage);
          setIsSubmitting(false);
          return;
        }
      } else if (isPreviewTestFallback) {
        // When Firebase Console Phone Auth is pending configuration in preview,
        // accept the standard Firebase test code 123456 for configured test numbers.
        if (cleanOtp !== '123456') {
          setErrorMsg(
            'Incorrect verification code. For Firebase test phone numbers in preview mode, enter 123456.'
          );
          setIsSubmitting(false);
          return;
        }
        firebaseUid =
          auth.currentUser?.uid ||
          `firebase-phone-${phoneE164.replace(/[^0-9]/g, '')}`;
      }

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'RESOLVE_FIREBASE_USER',
          phoneE164,
          countryCode: selectedCountry.code,
          maskedPhone,
          firebaseUid,
          idToken,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(
          data?.error ||
            'Invalid or expired verification session. Please try again.'
        );
        setIsSubmitting(false);
        return;
      }

      if (data.status === 'AUTHENTICATED_EXISTING' && data.user) {
        const existingUser = data.user as UserAccount;
        await syncUserAccountToFirestore(existingUser);
        const targetJourney = existingUser.roles.includes('SELLER')
          ? defaultJourney
          : 'BUYER';
        setIsSubmitting(false);
        onAuthenticated(existingUser, targetJourney);
        return;
      }

      setVerificationToken(String(data.verificationToken || ''));
      setJourney(defaultJourney);
      setStep('COMPLETE_PROFILE');
      setIsSubmitting(false);
    } catch {
      setIsSubmitting(false);
      setErrorMsg('Could not verify code right now. Please try again.');
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const selectedLegacySeller = unmigratedSellers.find(
      (s) => s.id === migrateSellerId
    );
    const effectiveName =
      fullName.trim() || selectedLegacySeller?.businessOwnerName || '';

    if (!effectiveName) {
      setErrorMsg('Please enter your full name to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'COMPLETE_REGISTRATION',
          verificationToken,
          fullName: effectiveName,
          journey: migrateSellerId ? 'SELLER' : journey,
          migrateSellerId: migrateSellerId || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.user) {
        setErrorMsg(
          data?.error || 'Could not complete account setup. Please try again.'
        );
        setIsSubmitting(false);
        return;
      }

      const createdUser = data.user as UserAccount;
      await syncUserAccountToFirestore(createdUser);

      setIsSubmitting(false);
      onAuthenticated(
        createdUser,
        migrateSellerId ? 'SELLER' : journey,
        migrateSellerId || undefined
      );
    } catch {
      setIsSubmitting(false);
      setErrorMsg('Could not complete account setup. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-auth-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Invisible Firebase RecaptchaVerifier mount container */}
        <div id="firebase-recaptcha-container" aria-hidden="true" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003B8E]">
              <Phone className="w-3.5 h-3.5" />
              <span>
                Firebase Phone Auth ({FIREBASE_PROJECT_ID})
              </span>
            </div>

            {step === 'ENTER_PHONE' && (
              <>
                <h2
                  id="otp-auth-heading"
                  className="text-xl font-bold text-slate-900 tracking-tight"
                >
                  {authContextMode === 'SELLER_SIGN_IN'
                    ? 'Sign in to your store'
                    : authContextMode === 'SELLER_OPEN_STORE'
                      ? 'Verify mobile to open a store'
                      : 'Welcome to Citykart'}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {authContextMode === 'SELLER_SIGN_IN'
                    ? 'Enter your registered seller mobile number to verify via OTP and access your Seller Dashboard.'
                    : authContextMode === 'SELLER_OPEN_STORE'
                      ? 'Verify your mobile number via OTP to register your store and start selling locally.'
                      : "Enter your mobile number to continue. We'll send you a verification code via Firebase Phone Authentication."}
                </p>
              </>
            )}

            {step === 'VERIFY_OTP' && (
              <>
                <h2
                  id="otp-auth-heading"
                  className="text-xl font-bold text-slate-900 tracking-tight"
                >
                  Verify your mobile number
                </h2>
                <p className="text-xs text-slate-600">
                  Enter the 6-digit code sent to{' '}
                  <strong className="font-mono text-[#003B8E]">
                    {maskedPhone}
                  </strong>
                  .
                </p>
              </>
            )}

            {step === 'COMPLETE_PROFILE' && (
              <>
                <h2
                  id="otp-auth-heading"
                  className="text-xl font-bold text-slate-900 tracking-tight"
                >
                  Complete your account
                </h2>
                <p className="text-xs text-slate-600">
                  Mobile number{' '}
                  <strong className="font-mono text-emerald-700">
                    {maskedPhone}
                  </strong>{' '}
                  is verified.
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {consoleNotice && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <span>{consoleNotice}</span>
              </div>
            </div>
          )}

          {/* STEP 1: MOBILE NUMBER & CALLING CODE */}
          {step === 'ENTER_PHONE' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              {/* Country Calling-Code Selector */}
              <div className="space-y-1.5 relative">
                <label className="block text-xs font-semibold text-slate-800">
                  Country calling code
                </label>
                <button
                  type="button"
                  onClick={() => setIsCountryDropdownOpen((v) => !v)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl flex items-center justify-between text-slate-900 hover:border-[#003B8E] transition-colors cursor-pointer"
                >
                  <span className="font-semibold">
                    {selectedCountry.name} ({selectedCountry.dialCode})
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {isCountryDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search country or code (e.g., +91, +1, +44, +61, +971)..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#003B8E]"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {filteredCountries.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(c);
                            setIsCountryDropdownOpen(false);
                            setCountrySearch('');
                            setErrorMsg(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center justify-between rounded-lg cursor-pointer"
                        >
                          <span className="text-slate-900 font-medium">
                            {c.name}
                          </span>
                          <span className="font-mono text-slate-600">
                            {c.dialCode}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Number Input (Separate from Country Calling Code) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-mobile-number"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Mobile number
                </label>
                <div className="flex items-center gap-2">
                  <div className="px-3.5 py-2.5 text-xs font-mono font-bold bg-blue-50/80 border border-blue-200/80 rounded-xl text-[#003B8E] shrink-0">
                    {selectedCountry.dialCode}
                  </div>
                  <input
                    id="auth-mobile-number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    value={mobileNumber}
                    onChange={(e) =>
                      setMobileNumber(e.target.value.replace(/[^\d\s-]/g, ''))
                    }
                    placeholder={
                      selectedCountry.minDigits === 10
                        ? '98204 51290'
                        : 'Enter mobile number'
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E] focus:bg-white transition-colors"
                  />
                </div>
                <div className="text-[11px] text-slate-500 space-y-1.5 pt-1">
                  <div>
                    Quick test numbers (test OTP{' '}
                    <code className="font-mono font-semibold text-[#003B8E]">123456</code>):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountry(INTERNATIONAL_COUNTRIES[0]);
                        setMobileNumber('8329306616');
                      }}
                      className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 font-mono font-bold text-[#003B8E] cursor-pointer transition-colors"
                    >
                      +91 8329306616 (Platform Owner)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountry(INTERNATIONAL_COUNTRIES[0]);
                        setMobileNumber('9422100101');
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 font-mono text-slate-800 cursor-pointer transition-colors"
                    >
                      +91 9422100101 (Nanded Seller)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountry(INTERNATIONAL_COUNTRIES[0]);
                        setMobileNumber('9820451290');
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 font-mono text-slate-800 cursor-pointer transition-colors"
                    >
                      +91 9820451290 (Mumbai Seller)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountry(INTERNATIONAL_COUNTRIES[0]);
                        setMobileNumber('9820111222');
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 font-mono text-slate-800 cursor-pointer transition-colors"
                    >
                      +91 9820111222 (Buyer Only)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountry(INTERNATIONAL_COUNTRIES[0]);
                        setMobileNumber('9820333444');
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 font-mono text-slate-800 cursor-pointer transition-colors"
                    >
                      +91 9820333444 (Incomplete Store)
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-[#F96302] hover:bg-[#E05500] disabled:bg-slate-400 text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending verification code...</span>
                  </>
                ) : (
                  <span>Send OTP Code</span>
                )}
              </button>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowConsoleGuide((v) => !v)}
                  className="w-full flex items-center justify-between text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <span>
                    Firebase Console setup for{' '}
                    <code className="font-mono text-[#003B8E]">{FIREBASE_PROJECT_ID}</code>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      showConsoleGuide ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {showConsoleGuide && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-slate-800">
                      Required settings in Firebase Console (
                      {FIREBASE_PROJECT_ID}):
                    </p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>
                        <strong>Authentication → Sign-in method:</strong> Enable
                        the <strong>Phone</strong> sign-in provider.
                      </li>
                      <li>
                        <strong>
                          Authentication → Settings → Authorized domains:
                        </strong>{' '}
                        Add your deployment domain and preview hostname.
                      </li>
                      <li>
                        <strong>Phone numbers for testing (Free Dev):</strong>{' '}
                        Add test numbers (e.g.,{' '}
                        <code className="font-mono">+91 9820451290</code> with
                        code <code className="font-mono">123456</code>) to test
                        without SMS charges.
                      </li>
                      <li>
                        <strong>Production SMS Quotas:</strong> Upgrade to the
                        Blaze plan and enable your target countries in SMS
                        Region Policy for live carrier delivery.
                      </li>
                    </ol>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  Protected by Firebase reCAPTCHA and Phone Authentication. No
                  passwords or email required.
                </p>
              </div>
            </form>
          )}

          {/* STEP 2: OTP VERIFICATION SCREEN */}
          {step === 'VERIFY_OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="otp-code-input"
                  className="block text-xs font-semibold text-slate-800"
                >
                  6-digit verification code
                </label>
                <input
                  id="otp-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="••••••"
                  className="w-full px-4 py-3 text-center text-lg tracking-[0.35em] font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E] focus:bg-white transition-colors"
                />
                <p className="text-[11px] text-slate-500">
                  Enter the 6-digit SMS code from Firebase Phone Authentication
                  (or <code className="font-mono font-semibold text-[#003B8E]">123456</code> for configured
                  Firebase test numbers).
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  isSubmitting || otpCode.replace(/\D/g, '').length !== 6
                }
                className="w-full py-3 px-4 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify and Continue</span>
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('ENTER_PHONE');
                    setErrorMsg(null);
                    setConsoleNotice(null);
                  }}
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change mobile number</span>
                </button>

                {resendSeconds > 0 ? (
                  <span className="text-slate-500 font-mono tabular-nums">
                    Resend code in {resendSeconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleRequestOtp()}
                    className="font-semibold text-[#003B8E] underline cursor-pointer"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          )}

          {/* STEP 3: NEW ACCOUNT SETUP OR LEGACY SELLER MIGRATION */}
          {step === 'COMPLETE_PROFILE' && (
            <form onSubmit={handleCompleteRegistration} className="space-y-4">
              <div>
                <label
                  htmlFor="profile-fullname-input"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Your full name *
                </label>
                <input
                  id="profile-fullname-input"
                  type="text"
                  required={!migrateSellerId}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Example: Priya Sharma"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E] focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  How would you like to use Citykart?
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setJourney('BUYER');
                      setMigrateSellerId('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      journey === 'BUYER' && !migrateSellerId
                        ? 'border-[#003B8E] bg-[#003B8E] text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Shop local stores</span>
                    </div>
                    <p
                      className={`text-[11px] mt-1 ${
                        journey === 'BUYER' && !migrateSellerId
                          ? 'text-blue-100'
                          : 'text-slate-500'
                      }`}
                    >
                      Discover and order from nearby shops
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setJourney('SELLER');
                      setMigrateSellerId('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      journey === 'SELLER' && !migrateSellerId
                        ? 'border-[#003B8E] bg-[#003B8E] text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Store className="w-3.5 h-3.5" />
                      <span>Open a local store</span>
                    </div>
                    <p
                      className={`text-[11px] mt-1 ${
                        journey === 'SELLER' && !migrateSellerId
                          ? 'text-blue-100'
                          : 'text-slate-500'
                      }`}
                    >
                      Register your business and list products
                    </p>
                  </button>
                </div>
              </div>

              {/* Legacy Seller Account Phone Migration Option */}
              {unmigratedSellers.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="text-xs font-semibold text-amber-950">
                    Migrating an existing store account?
                  </div>
                  <p className="text-[11px] text-amber-900">
                    If you previously registered a store before mobile OTP
                    verification was required, select your legacy seller profile
                    to link this verified mobile number:
                  </p>
                  <select
                    value={migrateSellerId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMigrateSellerId(val);
                      if (val) {
                        setJourney('SELLER');
                        const found = unmigratedSellers.find(
                          (s) => s.id === val
                        );
                        if (found && !fullName.trim()) {
                          setFullName(found.businessOwnerName);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg"
                  >
                    <option value="">
                      No — create a new {journey.toLowerCase()} account
                    </option>
                    {unmigratedSellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        Link legacy seller: {s.businessOwnerName} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-[#F96302] hover:bg-[#E05500] disabled:bg-slate-400 text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>
                  {migrateSellerId
                    ? 'Link mobile number & open seller dashboard'
                    : journey === 'SELLER'
                      ? 'Continue to store registration'
                      : 'Start shopping'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
