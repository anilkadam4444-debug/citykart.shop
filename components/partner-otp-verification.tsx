'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Handshake,
  Info,
  Loader2,
  Lock,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  CountryCallingRecord,
  getCountryRecordByCodeOrName,
  INTERNATIONAL_COUNTRIES,
  validatePhoneNumberForCountry,
} from '@/lib/countries-data';
import { UserAccount } from '@/lib/catalog-data';
import {
  auth,
  ConfirmationResult,
  FIREBASE_PROJECT_ID,
  RecaptchaVerifier,
  saveClientSessionToken,
  signInWithPhoneNumber,
  syncUserAccountToFirestore,
  testFirestoreConnection,
} from '@/lib/firebase';
import {
  AUTH_USER_STORAGE_KEY,
  useUrbanDirect,
} from '@/components/urbandirect-provider';
import {
  clearActivePartnerConfirmationSession,
  formatFirebasePhoneAuthError,
  getActivePartnerConfirmationSession,
  PartnerOnboardingContextState,
  readPartnerOnboardingContext,
  resolvePostOtpNavigationDestination,
  setActivePartnerConfirmationSession,
  writePartnerOnboardingContext,
} from '@/lib/partner-onboarding-context';

type PartnerOtpStep = 'ENTER_PHONE' | 'VERIFY_OTP';

export function PartnerOtpVerification() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceChangePhone = searchParams?.get('changePhone') === '1';

  const {
    isMounted,
    authenticatedUser,
    setAuthenticatedUser,
    handleSignOutOtpSession,
    showToast,
  } = useUrbanDirect();

  const [onboardingCtx, setOnboardingCtx] =
    useState<PartnerOnboardingContextState | null>(null);
  const [openedWithoutOnboardingState, setOpenedWithoutOnboardingState] =
    useState<boolean>(false);
  const [reloadedWithoutLiveConfirmation, setReloadedWithoutLiveConfirmation] =
    useState<boolean>(false);

  const [step, setStep] = useState<PartnerOtpStep>('ENTER_PHONE');
  const [selectedCountry, setSelectedCountry] = useState<CountryCallingRecord>(
    INTERNATIONAL_COUNTRIES[0]
  );
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] =
    useState<boolean>(false);
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [applicantName, setApplicantName] = useState<string>('');

  const [otpCode, setOtpCode] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [phoneE164, setPhoneE164] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consoleNotice, setConsoleNotice] = useState<string | null>(null);
  const [isPreviewTestFallback, setIsPreviewTestFallback] =
    useState<boolean>(false);
  const [isOtpExpired, setIsOtpExpired] = useState<boolean>(false);
  const [resendSeconds, setResendSeconds] = useState<number>(0);
  const [verifiedSuccessBanner, setVerifiedSuccessBanner] = useState<
    string | null
  >(null);
  const [isChangingAuthenticatedPhone, setIsChangingAuthenticatedPhone] =
    useState<boolean>(false);

  const [firebaseConfirmation, setFirebaseConfirmation] =
    useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const cleanupRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      recaptchaVerifierRef.current = null;
    }
    if (typeof document !== 'undefined') {
      const container = document.getElementById(
        'partner-firebase-recaptcha-container'
      );
      if (container) {
        container.innerHTML = '';
      }
    }
  };

  useEffect(() => {
    void testFirestoreConnection();
    return () => {
      cleanupRecaptcha();
    };
  }, []);

  // Hydrate partner onboarding state on mount & handle page refresh / direct access recovery
  useEffect(() => {
    if (!isMounted) return;

    const saved = readPartnerOnboardingContext();
    const activeConfirmation = getActivePartnerConfirmationSession();

    const timer = setTimeout(() => {
      if (!saved) {
        // Direct access without prior onboarding context: recover safely into Partner Phone Entry
        setOpenedWithoutOnboardingState(true);
        const initialized = writePartnerOnboardingContext({
          registrationIntent: 'partner',
          countryCode: 'IN',
          dialCode: '+91',
          mobileNumber: '',
          phoneE164: '',
          maskedPhone: '',
          verificationStep: 'PHONE_ENTRY',
          returnTab: 'apply',
        });
        setOnboardingCtx(initialized);
        setStep('ENTER_PHONE');
        return;
      }

      setOnboardingCtx(saved);
      const matchedCountry = getCountryRecordByCodeOrName(saved.countryCode);
      setSelectedCountry(matchedCountry);
      if (saved.mobileNumber) {
        setMobileNumber(saved.mobileNumber);
      }
      if (saved.draftApplication?.fullLegalName) {
        setApplicantName(saved.draftApplication.fullLegalName);
      }
      if (saved.phoneE164) {
        setPhoneE164(saved.phoneE164);
      }
      if (saved.maskedPhone) {
        setMaskedPhone(saved.maskedPhone);
      }

      if (forceChangePhone) {
        setStep('ENTER_PHONE');
        return;
      }

      // Check if an active OTP session was initiated from /partner or is currently in progress
      if (
        activeConfirmation &&
        activeConfirmation.phoneE164 &&
        (!saved.phoneE164 || activeConfirmation.phoneE164 === saved.phoneE164)
      ) {
        setPhoneE164(activeConfirmation.phoneE164);
        setMaskedPhone(activeConfirmation.maskedPhone);
        setMobileNumber(activeConfirmation.mobileNumber);
        setFirebaseConfirmation(activeConfirmation.confirmationResult);
        setIsPreviewTestFallback(activeConfirmation.isPreviewTestFallback);
        setConsoleNotice(activeConfirmation.consoleNotice);
        const remainingCooldown = Math.max(
          0,
          Math.ceil((activeConfirmation.resendAvailableAtMs - Date.now()) / 1000)
        );
        setResendSeconds(remainingCooldown);
        setStep('VERIFY_OTP');
      } else if (saved.verificationStep === 'OTP_SENT' && saved.phoneE164) {
        // Page was refreshed mid-OTP-flow: live ConfirmationResult in memory was cleared by browser reload,
        // but we have safe sessionStorage recovery for phone number & partner context!
        setReloadedWithoutLiveConfirmation(true);
        const remainingCooldown = saved.resendAvailableAtMs
          ? Math.max(
              0,
              Math.ceil((saved.resendAvailableAtMs - Date.now()) / 1000)
            )
          : 0;
        setResendSeconds(remainingCooldown);
        setStep('VERIFY_OTP');
      } else {
        setStep('ENTER_PHONE');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isMounted, forceChangePhone]);

  // Countdown timer for Resend OTP cooldown
  useEffect(() => {
    if (step !== 'VERIFY_OTP' || resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendSeconds]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return INTERNATIONAL_COUNTRIES;
    const q = countrySearch.toLowerCase();
    return INTERNATIONAL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const phoneValidation = useMemo(() => {
    if (!mobileNumber.trim()) return null;
    return validatePhoneNumberForCountry(mobileNumber, selectedCountry);
  }, [mobileNumber, selectedCountry]);

  const getOrInitRecaptcha = () => {
    cleanupRecaptcha();
    const verifier = new RecaptchaVerifier(
      auth,
      'partner-firebase-recaptcha-container',
      {
        size: 'invisible',
      }
    );
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const triggerOtpDispatch = async (targetCountry: CountryCallingRecord, rawPhone: string) => {
    setErrorMsg(null);
    setConsoleNotice(null);
    setIsOtpExpired(false);
    setReloadedWithoutLiveConfirmation(false);

    const validation = validatePhoneNumberForCountry(rawPhone, targetCountry);
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'Invalid mobile phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const validateRes = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VALIDATE_PHONE',
          countryCode: targetCountry.code,
          mobileNumber: validation.digitsOnly,
          registrationIntent: 'partner',
        }),
      });
      const validateData = await validateRes.json();

      if (!validateRes.ok || !validateData.ok) {
        setErrorMsg(validateData.error || 'Could not validate phone number.');
        setIsSubmitting(false);
        return;
      }

      const targetE164: string = validateData.phoneE164;
      const targetMasked: string = validateData.maskedPhone;
      const cooldownSec: number = validateData.resendCooldownSeconds || 30;
      const resendAvailableAtMs = Date.now() + cooldownSec * 1000;

      let confirmationResult: ConfirmationResult | null = null;
      let previewFallback = false;
      let noticeText: string | null = null;

      try {
        const appVerifier = getOrInitRecaptcha();
        confirmationResult = await signInWithPhoneNumber(
          auth,
          targetE164,
          appVerifier
        );
      } catch (firebaseErr: unknown) {
        cleanupRecaptcha();
        const formatted = formatFirebasePhoneAuthError(firebaseErr);
        if (formatted.isConsoleConfigNotice) {
          previewFallback = true;
          noticeText = formatted.userMessage;
        } else {
          setErrorMsg(formatted.userMessage);
          setIsSubmitting(false);
          return;
        }
      }

      setFirebaseConfirmation(confirmationResult);
      setIsPreviewTestFallback(previewFallback);
      setConsoleNotice(noticeText);
      setPhoneE164(targetE164);
      setMaskedPhone(targetMasked);
      setResendSeconds(cooldownSec);
      setOtpCode('');

      setActivePartnerConfirmationSession({
        phoneE164: targetE164,
        maskedPhone: targetMasked,
        countryCode: targetCountry.code,
        dialCode: targetCountry.dialCode,
        mobileNumber: validation.digitsOnly,
        confirmationResult,
        isPreviewTestFallback: previewFallback,
        consoleNotice: noticeText,
        resendAvailableAtMs,
        createdAtMs: Date.now(),
      });

      const updatedCtx = writePartnerOnboardingContext({
        registrationIntent: 'partner',
        countryCode: targetCountry.code,
        dialCode: targetCountry.dialCode,
        mobileNumber: validation.digitsOnly,
        phoneE164: targetE164,
        maskedPhone: targetMasked,
        verificationStep: 'OTP_SENT',
        resendAvailableAtMs,
        returnTab: 'apply',
        draftApplication: onboardingCtx?.draftApplication
          ? {
              ...onboardingCtx.draftApplication,
              fullLegalName:
                applicantName.trim() ||
                onboardingCtx.draftApplication.fullLegalName,
            }
          : applicantName.trim()
            ? {
                fullLegalName: applicantName.trim(),
                email: '',
                residentialOrBusinessAddress: '',
                countryCode: targetCountry.code,
                stateRegion: 'Maharashtra',
                cityId: 'india-maharashtra-nanded',
                postalCode: '431601',
                relevantExperience: '',
                localGrowthPlan: '',
                identityDocType: 'PAN_CARD',
                addressProofType: 'AADHAAR',
                bankAccountHolderName: applicantName.trim(),
                bankName: '',
                bankIfscOrRoutingCode: '',
                consentAccepted: false,
              }
            : undefined,
      });

      setOnboardingCtx(updatedCtx);
      setOpenedWithoutOnboardingState(false);
      setIsSubmitting(false);
      setStep('VERIFY_OTP');
    } catch {
      setIsSubmitting(false);
      setErrorMsg(
        'Network error while requesting OTP. Please check your connection and try again.'
      );
    }
  };

  const handleRequestOtpForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    await triggerOtpDispatch(selectedCountry, mobileNumber);
  };

  const handleResendOtp = async () => {
    if (resendSeconds > 0 || isSubmitting) return;
    await triggerOtpDispatch(selectedCountry, mobileNumber);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const trimmedCode = otpCode.trim();
    if (trimmedCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    if (isOtpExpired) {
      setErrorMsg(
        'This verification code has expired. Please tap "Resend OTP Code" to request a fresh code.'
      );
      return;
    }

    if (
      reloadedWithoutLiveConfirmation &&
      !firebaseConfirmation &&
      !isPreviewTestFallback
    ) {
      // If page was reloaded, allow 123456 in preview test fallback or prompt resend if real Firebase session expired
      if (trimmedCode !== '123456') {
        setErrorMsg(
          'Your browser page was refreshed during verification. Please tap "Send Fresh OTP Code" below or enter preview test code 123456.'
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let firebaseUid = `partner_applicant_${phoneE164.replace(/[^\d]/g, '')}`;
      let firebaseIdToken: string | undefined;

      if (firebaseConfirmation && !isPreviewTestFallback) {
        try {
          const userCredential = await firebaseConfirmation.confirm(trimmedCode);
          firebaseUid = userCredential.user.uid;
          firebaseIdToken = await userCredential.user.getIdToken();
        } catch (confirmErr: unknown) {
          const formatted = formatFirebasePhoneAuthError(confirmErr);
          if (formatted.isExpired) {
            setIsOtpExpired(true);
          }
          setErrorMsg(formatted.userMessage);
          setIsSubmitting(false);
          return;
        }
      } else {
        if (trimmedCode !== '123456') {
          setErrorMsg(
            'Incorrect 6-digit verification code. In preview test mode, enter 123456 (or configure your phone in Firebase Console -> Authentication -> Sign-in method -> Phone -> Phone numbers for testing).'
          );
          setIsSubmitting(false);
          return;
        }
      }

      // First check if this phone already has a user profile or is a new partner applicant
      const resolveRes = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESOLVE_FIREBASE_USER',
          phoneE164,
          countryCode: selectedCountry.code,
          firebaseUid,
          firebaseIdToken,
          registrationIntent: 'partner',
        }),
      });
      const resolveData = await resolveRes.json();

      if (!resolveRes.ok || !(resolveData.ok || resolveData.success)) {
        setErrorMsg(
          resolveData.error || 'Verification failed. Please try again.'
        );
        setIsSubmitting(false);
        return;
      }

      let resolvedUser: UserAccount | null = null;

      if (!resolveData.isNewUser && resolveData.user) {
        if (resolveData.sessionToken) {
          saveClientSessionToken(String(resolveData.sessionToken));
        }
        resolvedUser = resolveData.user as UserAccount;
      } else {
        // Complete partner applicant phone verification WITHOUT routing to Buyer or Store Owner flows
        const candidateName =
          applicantName.trim() ||
          onboardingCtx?.draftApplication?.fullLegalName?.trim() ||
          'City Partner Applicant';

        const completeRes = await fetch('/api/auth/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'COMPLETE_REGISTRATION',
            phoneE164,
            verificationToken: resolveData.verificationToken,
            fullName: candidateName,
            registrationIntent: 'partner',
          }),
        });
        const completeData = await completeRes.json();

        if (!completeRes.ok || !(completeData.ok || completeData.success) || !completeData.user) {
          setErrorMsg(
            completeData.error ||
              'Could not complete partner phone verification.'
          );
          setIsSubmitting(false);
          return;
        }

        if (completeData.sessionToken) {
          saveClientSessionToken(String(completeData.sessionToken));
        }
        resolvedUser = completeData.user as UserAccount;
      }

      // Sync verified user account to Firestore and update UrbanDirect context
      await syncUserAccountToFirestore(resolvedUser);
      setAuthenticatedUser(resolvedUser);
      try {
        window.localStorage.setItem(
          AUTH_USER_STORAGE_KEY,
          JSON.stringify(resolvedUser)
        );
      } catch {
        // Ignore storage quota errors
      }

      clearActivePartnerConfirmationSession();
      const updatedCtx = writePartnerOnboardingContext({
        registrationIntent: 'partner',
        countryCode: selectedCountry.code,
        dialCode: selectedCountry.dialCode,
        mobileNumber: mobileNumber.replace(/\D/g, ''),
        phoneE164: resolvedUser.phoneE164,
        maskedPhone: resolvedUser.maskedPhone,
        verificationStep: 'PHONE_VERIFIED',
        returnTab: 'apply',
        draftApplication: onboardingCtx?.draftApplication
          ? {
              ...onboardingCtx.draftApplication,
              fullLegalName:
                applicantName.trim() ||
                onboardingCtx.draftApplication.fullLegalName ||
                resolvedUser.fullName,
            }
          : undefined,
      });
      setOnboardingCtx(updatedCtx);

      setVerifiedSuccessBanner(
        `Mobile number ${resolvedUser.phoneE164} verified! Returning to your City Partner application...`
      );
      showToast(
        `Phone ${resolvedUser.phoneE164} verified for City Partner registration.`
      );
      setIsSubmitting(false);

      // Navigate back to the City Partner application flow via centralized post-OTP router
      const navTarget = resolvePostOtpNavigationDestination({
        registrationIntent: updatedCtx.registrationIntent,
        currentPathname: '/partner/verify-otp',
        partnerReturnTab: updatedCtx.returnTab || 'apply',
      });
      router.push(navTarget.destination);
    } catch {
      setIsSubmitting(false);
      setErrorMsg(
        'Network error while verifying OTP code. Please check your connection and try again.'
      );
    }
  };

  const handleChangePhoneNumber = () => {
    clearActivePartnerConfirmationSession();
    setStep('ENTER_PHONE');
    setOtpCode('');
    setErrorMsg(null);
    setIsOtpExpired(false);
    setReloadedWithoutLiveConfirmation(false);
    const updated = writePartnerOnboardingContext({
      registrationIntent: 'partner',
      verificationStep: 'PHONE_ENTRY',
      returnTab: 'apply',
    });
    setOnboardingCtx(updated);
  };

  const handleSwitchAuthenticatedUserPhone = async () => {
    setIsChangingAuthenticatedPhone(true);
    clearActivePartnerConfirmationSession();
    await handleSignOutOtpSession();
    setStep('ENTER_PHONE');
    setOtpCode('');
    setErrorMsg(null);
    const updated = writePartnerOnboardingContext({
      registrationIntent: 'partner',
      verificationStep: 'PHONE_ENTRY',
      returnTab: 'apply',
    });
    setOnboardingCtx(updated);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Invisible Firebase RecaptchaVerifier mount container */}
      <div id="partner-firebase-recaptcha-container" aria-hidden="true" />

      {/* ====================================================================
          DEDICATED CITY PARTNER OTP HEADER
         ==================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/partner?tab=apply"
              className="flex items-center gap-2.5 group cursor-pointer"
            >
              <Image
                src="/citykart-logo.png"
                alt="Citykart.shop"
                width={38}
                height={38}
                className="w-9 h-9 rounded-lg object-contain border border-slate-200 bg-white"
              />
              <div>
                <div className="text-lg font-extrabold tracking-tight leading-none">
                  <span className="text-[#003B8E]">City</span>
                  <span className="text-[#F96302]">kart</span>
                  <span className="text-slate-500 font-semibold text-xs">
                    .shop
                  </span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold mt-0.5">
                  City Partner Registration · OTP Verification
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              <Handshake className="w-3.5 h-3.5 text-emerald-600" />
              Intent: City Partner Onboarding
            </span>
            <Link
              href="/partner?tab=apply"
              data-testid="partner-otp-back-to-portal"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Partner Registration
            </Link>
          </div>
        </div>
      </header>

      {/* ====================================================================
          MAIN DEDICATED PARTNER OTP CONTENT
         ==================================================================== */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Step Progress Indicator */}
        <div
          data-testid="partner-otp-progress-bar"
          className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-slate-600 mb-2.5">
            <span className="uppercase tracking-wider text-emerald-700 font-mono">
              City Partner Onboarding Flow
            </span>
            <span className="font-mono text-slate-500">
              {authenticatedUser?.phoneE164 && !isChangingAuthenticatedPhone
                ? 'Step 2 of 3 · Ready for Application'
                : step === 'ENTER_PHONE'
                  ? 'Step 1 of 3 · Enter Mobile Number'
                  : 'Step 2 of 3 · Verify 6-Digit SMS OTP'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] shrink-0">
                1
              </span>
              <span className="truncate">Mobile Number</span>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
                step === 'VERIFY_OTP' || authenticatedUser?.phoneE164
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                  step === 'VERIFY_OTP' || authenticatedUser?.phoneE164
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span className="truncate">Verify Partner OTP</span>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
                authenticatedUser?.phoneE164 &&
                !isChangingAuthenticatedPhone
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px] shrink-0">
                3
              </span>
              <span className="truncate">City & KYC Application</span>
            </div>
          </div>
        </div>

        {/* Recovery Notice if user opened /partner/verify-otp directly without prior state */}
        {openedWithoutOnboardingState && (
          <div
            data-testid="partner-otp-recovery-banner"
            className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-xs text-blue-900"
          >
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Direct Access Recovery — City Partner Phone Verification
              </p>
              <p className="text-blue-800 mt-0.5 leading-relaxed">
                You opened <code className="font-mono">/partner/verify-otp</code>{' '}
                directly without an active OTP code in progress. Enter your
                mobile number below to receive a verification code and continue
                 directly to the City Partner application.
              </p>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
          {/* Card Header Banner */}
          <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#064E3B] text-white px-6 py-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-mono uppercase tracking-widest mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Dedicated Partner Verification Route (/partner/verify-otp)
            </div>
            <h1
              data-testid="partner-otp-heading"
              className="text-xl sm:text-2xl font-black tracking-tight"
            >
              Verify Your Phone — City Partner Registration
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
              Phone verification confirms your mobile identity for your City
              Partner application. You will remain strictly inside the City
              Partner onboarding workflow.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Case A: User is already signed in with a verified phone number and hasn't clicked "Change Phone" */}
            {authenticatedUser?.phoneE164 &&
            !isChangingAuthenticatedPhone &&
            !forceChangePhone ? (
              <div
                data-testid="partner-existing-auth-card"
                className="space-y-5"
              >
                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-sm font-black text-emerald-950">
                      Phone Number Already Verified ({authenticatedUser.phoneE164})
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Your mobile number{' '}
                      <span className="font-mono font-bold">
                        {authenticatedUser.phoneE164}
                      </span>{' '}
                      is verified via Firebase Phone OTP. Note: Phone
                      verification does not grant partner approval — you must
                      submit your City Partner application for Super Admin
                      review.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    data-testid="partner-switch-phone-btn"
                    onClick={handleSwitchAuthenticatedUserPhone}
                    className="px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                  >
                    Verify a Different Mobile Number
                  </button>
                  <button
                    type="button"
                    data-testid="partner-continue-application-btn"
                    onClick={() => {
                      writePartnerOnboardingContext({
                        registrationIntent: 'partner',
                        phoneE164: authenticatedUser.phoneE164,
                        maskedPhone: authenticatedUser.maskedPhone,
                        verificationStep: 'PHONE_VERIFIED',
                        returnTab: 'apply',
                      });
                      router.push('/partner?tab=apply&otpVerified=1');
                    }}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-sm transition-colors cursor-pointer"
                  >
                    Continue to City Partner Application
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : step === 'ENTER_PHONE' ? (
              /* Case B: Enter Phone Number for Partner OTP */
              <form
                onSubmit={handleRequestOtpForm}
                data-testid="partner-phone-entry-form"
                className="space-y-5"
              >
                {errorMsg && (
                  <div
                    data-testid="partner-otp-error"
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">
                      {errorMsg}
                    </span>
                  </div>
                )}

                <div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Country & Mobile Number *
                  </label>
                  <div className="flex gap-2 relative">
                    <button
                      type="button"
                      onClick={() =>
                        setIsCountryDropdownOpen(!isCountryDropdownOpen)
                      }
                      className="flex items-center gap-2 px-3.5 py-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-sm font-semibold shrink-0 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-mono font-bold text-slate-600">
                        {selectedCountry.code}
                      </span>
                      <span>{selectedCountry.dialCode}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>

                    {isCountryDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-30 overflow-hidden">
                        <div className="p-2 border-b border-slate-100">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Search country or code..."
                              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                            />
                          </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                          {filteredCountries.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(country);
                                setIsCountryDropdownOpen(false);
                                setCountrySearch('');
                                setErrorMsg(null);
                              }}
                              className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${
                                selectedCountry.code === country.code
                                  ? 'bg-emerald-50/70 font-bold text-emerald-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-[11px] font-mono font-bold text-slate-500">
                                  {country.code}
                                </span>
                                <span className="truncate">{country.name}</span>
                              </div>
                              <span className="text-slate-400 font-mono ml-2">
                                {country.dialCode}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="relative flex-1">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        data-testid="partner-otp-phone-input"
                        value={mobileNumber}
                        onChange={(e) => {
                          setMobileNumber(
                            e.target.value.replace(/[^\d\s-]/g, '')
                          );
                          setErrorMsg(null);
                        }}
                        placeholder={`Enter ${selectedCountry.minDigits}-digit mobile number`}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                    <span>
                      Selected: <strong>{selectedCountry.name}</strong> (
                      {selectedCountry.minDigits === selectedCountry.maxDigits
                        ? `${selectedCountry.minDigits} digits`
                        : `${selectedCountry.minDigits}–${selectedCountry.maxDigits} digits`}
                      )
                    </span>
                    {phoneValidation && (
                      <span
                        className={
                          phoneValidation.isValid
                            ? 'text-emerald-600 font-bold'
                            : 'text-amber-600 font-semibold'
                        }
                      >
                        {phoneValidation.isValid
                          ? `Valid (${phoneValidation.e164})`
                          : phoneValidation.error}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">
                      Dedicated City Partner Context:
                    </span>{' '}
                    Verifying your phone here keeps you in the City Partner
                    onboarding flow and never redirects you to Buyer or Store
                    Owner registration.
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <Link
                    href="/partner?tab=apply"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Partner Overview
                  </Link>
                  <button
                    type="submit"
                    disabled={isSubmitting || !phoneValidation?.isValid}
                    data-testid="partner-send-otp-btn"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-black shadow-sm transition-colors cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending Partner Verification OTP...
                      </>
                    ) : (
                      <>
                        Send Verification OTP
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Case C: Verify 6-Digit Partner OTP */
              <form
                onSubmit={handleVerifyOtp}
                data-testid="partner-verify-otp-form"
                className="space-y-5"
              >
                {/* Target Phone Confirmation Banner */}
                <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 font-bold">
                      SMS Verification Code Sent To
                    </div>
                    <div
                      data-testid="partner-otp-target-phone"
                      className="text-base font-black text-slate-900 font-mono mt-0.5"
                    >
                      {phoneE164 || maskedPhone}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="partner-change-phone-btn"
                    onClick={handleChangePhoneNumber}
                    className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100 text-xs font-bold text-emerald-800 transition-colors cursor-pointer"
                  >
                    Change phone number
                  </button>
                </div>

                {/* Page refresh recovery notice */}
                {reloadedWithoutLiveConfirmation && !isPreviewTestFallback && (
                  <div
                    data-testid="partner-refresh-recovery-notice"
                    className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 text-xs text-amber-900"
                  >
                    <div className="flex items-start gap-2.5">
                      <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          Page Refreshed — Partner Onboarding Context Preserved
                        </p>
                        <p className="mt-0.5 text-amber-800 leading-relaxed">
                          Your phone number ({phoneE164}) and City Partner
                          application draft were safely recovered. Click{' '}
                          <strong>Send Fresh OTP Code</strong> if you need a new
                          SMS code, or enter test code{' '}
                          <code className="font-mono font-bold">123456</code> in
                          preview mode.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        triggerOtpDispatch(selectedCountry, mobileNumber)
                      }
                      disabled={isSubmitting}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Send Fresh OTP Code
                    </button>
                  </div>
                )}

                {/* Preview Test Verification Code Banner (Always available in AI Studio preview) */}
                <div
                  data-testid="partner-preview-otp-notice"
                  className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Preview Mode Instant OTP ({FIREBASE_PROJECT_ID})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpCode('123456');
                        setErrorMsg(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Auto-Fill 123456
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {consoleNotice ||
                      'If real SMS delivery is not received in the preview sandbox, use the 6-digit test verification code below to verify immediately.'}
                  </p>
                  <div className="flex items-center justify-between text-[11px] font-mono bg-white/90 px-3 py-1.5 rounded-lg border border-amber-200/80">
                    <span>6-Digit Test OTP Code:</span>
                    <strong className="text-amber-950 text-sm tracking-widest">
                      123456
                    </strong>
                  </div>
                </div>

                {errorMsg && (
                  <div
                    data-testid="partner-otp-error"
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">
                      {errorMsg}
                    </span>
                  </div>
                )}

                {verifiedSuccessBanner && (
                  <div
                    data-testid="partner-otp-verified-banner"
                    className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs font-bold text-emerald-900"
                  >
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{verifiedSuccessBanner}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Enter 6-Digit Verification Code *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    data-testid="partner-otp-code-input"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setErrorMsg(null);
                    }}
                    placeholder="• • • • • •"
                    className="w-full px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>

                {/* Resend OTP Cooldown & Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Didn&apos;t receive the SMS code?</span>
                  </div>
                  {resendSeconds > 0 ? (
                    <span
                      data-testid="partner-resend-cooldown"
                      className="text-slate-500 font-mono font-semibold"
                    >
                      Resend code in {resendSeconds}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid="partner-resend-otp-btn"
                      onClick={handleResendOtp}
                      disabled={isSubmitting}
                      className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer disabled:opacity-50"
                    >
                      Resend OTP Code
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleChangePhoneNumber}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Phone Number
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.trim().length !== 6}
                    data-testid="partner-verify-otp-submit-btn"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-black shadow-sm transition-colors cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying Partner OTP...
                      </>
                    ) : (
                      <>
                        Verify OTP &amp; Continue to Partner Application
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Security & Role Separation Guarantee Notice */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Building2 className="w-4 h-4 text-[#003B8E] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-slate-900">
              Strict Separation: Phone Verification vs. Partner Approval
            </div>
            <p className="leading-relaxed">
              Completing OTP verification on{' '}
              <code className="font-mono text-slate-800">
                /partner/verify-otp
              </code>{' '}
              marks your phone number as verified for your City Partner
              application. Your application status becomes{' '}
              <span className="font-mono font-semibold text-amber-700">
                pending_review
              </span>{' '}
              only after you submit your city selection and KYC details, and the{' '}
              <span className="font-mono font-semibold text-emerald-700">
                partner
              </span>{' '}
              role is granted exclusively after Super Admin approval.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
