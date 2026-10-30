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
  MapPin,
  Lock,
  Navigation,
} from 'lucide-react';
import {
  CountryCallingRecord,
  INTERNATIONAL_COUNTRIES,
  validatePhoneNumberForCountry,
} from '@/lib/countries-data';
import {
  CustomerShoppingLocation,
  normalizeCityId,
  SellerProfile,
  UserAccount,
} from '@/lib/catalog-data';
import {
  CascadingLocationSelector,
  SelectedLocationPayload,
} from './cascading-location-selector';
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

export type OtpAuthContextMode =
  | 'BUYER_SIGN_IN'
  | 'SELLER_SIGN_IN'
  | 'SELLER_OPEN_STORE'
  | 'PARTNER_REGISTRATION';

interface MobileOtpAuthModalProps {
  isOpen: boolean;
  defaultJourney?: 'BUYER' | 'SELLER';
  authContextMode?: OtpAuthContextMode;
  currentLocation?: CustomerShoppingLocation;
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

  if (code === 'auth/invalid-phone-number' || code === 'auth/missing-phone-number') {
    return {
      userMessage:
        'Please enter a valid mobile phone number in international E.164 format (e.g., +919876543210).',
      isConsoleConfigNotice: false,
    };
  }
  if (code === 'auth/invalid-verification-code' || code === 'auth/missing-verification-code') {
    return {
      userMessage:
        'Incorrect 6-digit verification code. Please check the SMS code sent to your mobile number and try again.',
      isConsoleConfigNotice: false,
    };
  }
  if (code === 'auth/code-expired' || code === 'auth/session-expired') {
    return {
      userMessage:
        'Your verification code has expired. Tap "Resend code" to receive a fresh SMS verification code.',
      isConsoleConfigNotice: false,
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      userMessage:
        'Too many verification attempts from this device or phone number. Firebase has temporarily throttled requests — please wait a few minutes and try again.',
      isConsoleConfigNotice: false,
    };
  }
  if (code === 'auth/quota-exceeded' || rawMessage.includes('QUOTA_EXCEEDED')) {
    return {
      userMessage:
        'SMS verification quota for project urbandirectintracity has been exceeded for today. Please try again later or contact support.',
      isConsoleConfigNotice: true,
    };
  }
  if (code === 'auth/captcha-check-failed') {
    return {
      userMessage:
        'Firebase reCAPTCHA verification failed or expired. Please ensure this domain is listed in Firebase Console -> Authentication -> Settings -> Authorized domains and try again.',
      isConsoleConfigNotice: true,
    };
  }
  if (code === 'auth/unauthorized-domain' || code === 'auth/app-not-authorized') {
    const currentDomain =
      typeof window !== 'undefined' ? window.location.hostname : 'current domain';
    return {
      userMessage: `Domain "${currentDomain}" is not authorized for Firebase Phone Authentication in project "urbandirectintracity". Add "${currentDomain}" and "citykart.shop" in Firebase Console -> Authentication -> Settings -> Authorized domains.`,
      isConsoleConfigNotice: true,
    };
  }
  if (code === 'auth/operation-not-allowed' || rawMessage.includes('OPERATION_NOT_ALLOWED')) {
    return {
      userMessage:
        'Phone Authentication or SMS regional delivery (+91 India) is not enabled in Firebase Console (project: urbandirectintracity). Enable the Phone Sign-In provider and permit India (+91) in SMS Region Policy.',
      isConsoleConfigNotice: true,
    };
  }
  if (code === 'auth/billing-not-enabled' || rawMessage.includes('BILLING_NOT_ENABLED')) {
    return {
      userMessage:
        'Real SMS OTP delivery in Firebase Phone Authentication requires the Blaze (pay-as-you-go) billing plan on Firebase project "urbandirectintracity". Upgrade project billing in Firebase Console to enable carrier SMS dispatch.',
      isConsoleConfigNotice: true,
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      userMessage:
        'Network connection failed while reaching Firebase Authentication. Please check your internet connection or ad-blocker settings and try again.',
      isConsoleConfigNotice: false,
    };
  }
  if (code === 'auth/internal-error') {
    return {
      userMessage:
        'Firebase Authentication encountered an internal error during reCAPTCHA or SMS initialization. Please refresh the page and try again.',
      isConsoleConfigNotice: true,
    };
  }

  return {
    userMessage:
      rawMessage && rawMessage.length < 180
        ? `Phone verification failed (${code || 'error'}): ${rawMessage}`
        : 'Could not complete phone verification right now. Please check your number and try again.',
    isConsoleConfigNotice: false,
  };
}

const LOGIN_QUICK_CITIES = [
  { country: 'India', countryCode: 'IN', stateRegion: 'Maharashtra', city: 'Mumbai', locality: 'Bandra West', postalCode: '400050' },
  { country: 'India', countryCode: 'IN', stateRegion: 'Maharashtra', city: 'Pune', locality: 'Kothrud', postalCode: '411038' },
  { country: 'India', countryCode: 'IN', stateRegion: 'Maharashtra', city: 'Nanded', locality: 'Vazirabad', postalCode: '431601' },
  { country: 'United Kingdom', countryCode: 'GB', stateRegion: 'England', city: 'London', locality: 'Shoreditch', postalCode: 'E1 6JE' },
  { country: 'Japan', countryCode: 'JP', stateRegion: 'Tokyo Metropolis', city: 'Tokyo', locality: 'Shibuya', postalCode: '150-0002' },
  { country: 'United States', countryCode: 'US', stateRegion: 'New York', city: 'New York', locality: 'SoHo', postalCode: '10012' },
];

export function MobileOtpAuthModal({
  isOpen,
  defaultJourney = 'BUYER',
  authContextMode = 'BUYER_SIGN_IN',
  currentLocation,
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

  // Hyperlocal City Lock Selection during Login (Mumbai initial onboarding market default)
  const [loginCitySelection, setLoginCitySelection] =
    useState<SelectedLocationPayload>({
      country: currentLocation?.country || 'India',
      countryCode: currentLocation?.countryCode || 'IN',
      stateRegion: currentLocation?.stateRegion || 'Maharashtra',
      district: currentLocation?.district || 'Mumbai Suburban',
      localityType: currentLocation?.localityType || 'CITY',
      city: currentLocation?.city || 'Mumbai',
      cityId:
        currentLocation?.cityId ||
        normalizeCityId(
          currentLocation?.country || 'India',
          currentLocation?.stateRegion || 'Maharashtra',
          currentLocation?.city || 'Mumbai'
        ),
      locality: currentLocation?.locality || 'Bandra West',
      postalCode: currentLocation?.postalCode || '400050',
    });
  const [showFullCityPicker, setShowFullCityPicker] = useState<boolean>(false);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [detectedStreetAddress, setDetectedStreetAddress] = useState<string>('');

  const handleDetectBuyerGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingGps(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/location/reverse-geocode', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          const data = await res.json();
          if (res.ok && data.city) {
            const street = data.streetAddress || data.locality || '';
            setDetectedStreetAddress(data.formattedAddress || street);
            setLoginCitySelection({
              country: data.country || 'India',
              countryCode: data.countryCode || 'IN',
              stateRegion: data.stateRegion || 'Maharashtra',
              city: data.city,
              cityId:
                data.cityId ||
                normalizeCityId(
                  data.country || 'India',
                  data.stateRegion || 'Maharashtra',
                  data.city
                ),
              locality: street,
              postalCode: data.postalCode || '',
              localityType: 'CITY',
            });
          } else {
            setErrorMsg(
              data?.error ||
                'Could not auto-detect your city. Please select manually.'
            );
          }
        } catch {
          setErrorMsg('Network error while detecting GPS location.');
        } finally {
          setIsDetectingGps(false);
        }
      },
      (geoErr) => {
        setIsDetectingGps(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setErrorMsg(
            'Location permission was denied. Please allow location access or select your city manually.'
          );
        } else {
          setErrorMsg(
            'Unable to retrieve your GPS location. Please select your city manually.'
          );
        }
      },
      {enableHighAccuracy: true, timeout: 10000}
    );
  };

  // Phone & Firebase ConfirmationResult state
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [phoneE164, setPhoneE164] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [firebaseConfirmation, setFirebaseConfirmation] =
    useState<ConfirmationResult | null>(null);
  const [consoleNotice, setConsoleNotice] = useState<string | null>(null);

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
      if (currentLocation?.city) {
        setLoginCitySelection({
          country: currentLocation.country || 'India',
          countryCode: currentLocation.countryCode || 'IN',
          stateRegion: currentLocation.stateRegion || 'Maharashtra',
          district: currentLocation.district,
          localityType: currentLocation.localityType || 'CITY',
          city: currentLocation.city,
          cityId:
            currentLocation.cityId ||
            normalizeCityId(
              currentLocation.country || 'India',
              currentLocation.stateRegion || 'Maharashtra',
              currentLocation.city
            ),
          locality: currentLocation.locality || '',
          postalCode: currentLocation.postalCode || '',
        });
      }
    }
  }, [isOpen, currentLocation]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const clearRecaptchaInstance = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      recaptchaVerifierRef.current = null;
    }
    if (typeof document !== 'undefined') {
      const container = document.getElementById('firebase-recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
    }
  };

  useEffect(() => {
    return () => {
      clearRecaptchaInstance();
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
    clearRecaptchaInstance();

    const verifier = new RecaptchaVerifier(
      auth,
      'firebase-recaptcha-container',
      {
        size: 'invisible',
        'expired-callback': () => {
          clearRecaptchaInstance();
        },
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

      // 2. Dispatch real OTP via native Firebase Phone Authentication (`urbandirectintracity`)
      try {
        const appVerifier = getOrCreateRecaptchaVerifier();
        await appVerifier.render();
        const confirmationResult = await signInWithPhoneNumber(
          auth,
          targetE164,
          appVerifier
        );
        setFirebaseConfirmation(confirmationResult);
        setPhoneE164(targetE164);
        setMaskedPhone(targetMasked);
        setResendSeconds(Number(data.resendCooldownSeconds) || 30);
        setOtpCode('');
        setConsoleNotice(
          `SMS verification code sent to ${targetMasked} via Firebase Phone Authentication.`
        );
        setStep('VERIFY_OTP');
        setIsSubmitting(false);
      } catch (firebaseErr) {
        clearRecaptchaInstance();
        setFirebaseConfirmation(null);
        const formatted = formatFirebasePhoneAuthError(firebaseErr);
        setErrorMsg(formatted.userMessage);
        setIsSubmitting(false);
      }
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

    if (!firebaseConfirmation) {
      setErrorMsg(
        'Your verification session has expired or was not initialized. Please tap "Resend code" to request a fresh SMS OTP.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let firebaseUid: string;
      let idToken: string | undefined;

      try {
        const userCredential = await firebaseConfirmation.confirm(cleanOtp);
        firebaseUid = userCredential.user.uid;
        idToken = await userCredential.user
          .getIdToken(true)
          .catch(() => undefined);
      } catch (confirmErr) {
        const formatted = formatFirebasePhoneAuthError(confirmErr);
        setErrorMsg(formatted.userMessage);
        setIsSubmitting(false);
        return;
      }

      const lockedLocPayload = {
        country: loginCitySelection.country.trim() || 'India',
        countryCode: loginCitySelection.countryCode || 'IN',
        stateRegion: loginCitySelection.stateRegion.trim() || 'Maharashtra',
        district: loginCitySelection.district,
        city: loginCitySelection.city.trim() || 'Mumbai',
        cityId:
          loginCitySelection.cityId ||
          normalizeCityId(
            loginCitySelection.country || 'India',
            loginCitySelection.stateRegion || 'Maharashtra',
            loginCitySelection.city || 'Mumbai'
          ),
        locality: (loginCitySelection.locality || '').trim(),
        postalCode: loginCitySelection.postalCode,
      };

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? {Authorization: `Bearer ${idToken}`} : {}),
        },
        body: JSON.stringify({
          action: 'RESOLVE_FIREBASE_USER',
          phoneE164,
          otpCode: cleanOtp,
          countryCode: selectedCountry.code,
          maskedPhone,
          firebaseUid,
          idToken,
          lockedLocation: lockedLocPayload,
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
        if (data.sessionToken) {
          saveClientSessionToken(String(data.sessionToken));
        }
        const existingUser: UserAccount = {
          ...(data.user as UserAccount),
          lockedCity: (data.user as UserAccount).lockedCity || lockedLocPayload.city,
          lockedCityId: (data.user as UserAccount).lockedCityId || lockedLocPayload.cityId,
          lockedStateRegion:
            (data.user as UserAccount).lockedStateRegion || lockedLocPayload.stateRegion,
          lockedCountry:
            (data.user as UserAccount).lockedCountry || lockedLocPayload.country,
          lockedCountryCode:
            (data.user as UserAccount).lockedCountryCode || lockedLocPayload.countryCode,
          lockedLocality:
            (data.user as UserAccount).lockedLocality ?? lockedLocPayload.locality,
          lockedPostalCode:
            (data.user as UserAccount).lockedPostalCode ?? lockedLocPayload.postalCode,
          cityLockedAt:
            (data.user as UserAccount).cityLockedAt || new Date().toISOString(),
        };
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

    if (!loginCitySelection.city.trim()) {
      setErrorMsg('Please select your city to lock your hyperlocal shopping location.');
      return;
    }

    const lockedLocPayload = {
      country: loginCitySelection.country.trim() || 'India',
      countryCode: loginCitySelection.countryCode || 'IN',
      stateRegion: loginCitySelection.stateRegion.trim() || 'Maharashtra',
      district: loginCitySelection.district,
      city: loginCitySelection.city.trim() || 'Mumbai',
      cityId:
        loginCitySelection.cityId ||
        normalizeCityId(
          loginCitySelection.country || 'India',
          loginCitySelection.stateRegion || 'Maharashtra',
          loginCitySelection.city || 'Mumbai'
        ),
      locality: (loginCitySelection.locality || '').trim(),
      postalCode: loginCitySelection.postalCode,
    };

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
          lockedLocation: lockedLocPayload,
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

      if (data.sessionToken) {
        saveClientSessionToken(String(data.sessionToken));
      }
      const createdUser: UserAccount = {
        ...(data.user as UserAccount),
        lockedCity: (data.user as UserAccount).lockedCity || lockedLocPayload.city,
        lockedCityId: (data.user as UserAccount).lockedCityId || lockedLocPayload.cityId,
        lockedStateRegion:
          (data.user as UserAccount).lockedStateRegion || lockedLocPayload.stateRegion,
        lockedCountry:
          (data.user as UserAccount).lockedCountry || lockedLocPayload.country,
        lockedCountryCode:
          (data.user as UserAccount).lockedCountryCode || lockedLocPayload.countryCode,
        lockedLocality:
          (data.user as UserAccount).lockedLocality ?? lockedLocPayload.locality,
        lockedPostalCode:
          (data.user as UserAccount).lockedPostalCode ?? lockedLocPayload.postalCode,
        cityLockedAt:
          (data.user as UserAccount).cityLockedAt || new Date().toISOString(),
      };
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-md max-h-[92dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Invisible Firebase RecaptchaVerifier mount container */}
        <div id="firebase-recaptcha-container" aria-hidden="true" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003B8E]">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Firebase Phone Auth ({FIREBASE_PROJECT_ID})
              </span>
            </div>

            {step === 'ENTER_PHONE' && (
              <>
                <h2
                  id="otp-auth-heading"
                  className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight"
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
                  className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight"
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
                  className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight"
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
            className="min-w-[44px] min-h-[44px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1">
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
                        ? 'e.g. 98765 43210'
                        : 'Enter mobile number'
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Hyperlocal City Lock Selection (Country, State, City) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/70 border border-blue-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#003B8E] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-900">
                          Delivery City (Country, State, City)
                        </span>
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-[#003B8E] text-white tracking-wide uppercase">
                          Intra-City Lock
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Orders are strictly delivered locally within your chosen city.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Explicit Location Permission Request Prompt */}
                <div className="p-3 rounded-xl bg-blue-100/90 border border-blue-200 text-xs text-slate-800 space-y-2 shadow-2xs">
                  <div className="flex items-start gap-2">
                    <Navigation className="w-4 h-4 text-[#003B8E] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900">
                        Location Access Permission Requested
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Allow location permission to auto-detect your precise street address and lock your hyperlocal shopping city.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDetectBuyerGps}
                    disabled={isDetectingGps}
                    className="w-full py-2 px-3 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {isDetectingGps ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Detecting Precise Street Address...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Allow Location &amp; Auto-Detect Precise Address</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Direct High-Visibility Cascading Selector: Country -> State -> City */}
                <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-2xs">
                  <CascadingLocationSelector
                    selectedCountry={loginCitySelection.country}
                    selectedStateRegion={loginCitySelection.stateRegion}
                    selectedCity={loginCitySelection.city}
                    selectedLocality={loginCitySelection.locality}
                    selectedDistrict={loginCitySelection.district}
                    selectedPostalCode={loginCitySelection.postalCode}
                    selectedLocalityType={loginCitySelection.localityType}
                    hideDistrict={true}
                    onChange={(payload) => setLoginCitySelection(payload)}
                    allowLocalityInput={false}
                    showLocalityInput={false}
                    showMissingLocationButton={false}
                  />
                </div>

                {/* Popular Hubs (1-Tap Fast Selection) */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Popular Hubs (1-Tap Select)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {LOGIN_QUICK_CITIES.map((qc) => {
                      const isSelected =
                        loginCitySelection.city.toLowerCase() ===
                          qc.city.toLowerCase() &&
                        loginCitySelection.country.toLowerCase() ===
                          qc.country.toLowerCase();
                      return (
                        <button
                          key={`${qc.country}-${qc.city}`}
                          type="button"
                          onClick={() => {
                            setLoginCitySelection({
                              country: qc.country,
                              countryCode: qc.countryCode,
                              stateRegion: qc.stateRegion,
                              city: qc.city,
                              cityId: normalizeCityId(
                                qc.country,
                                qc.stateRegion,
                                qc.city
                              ),
                              locality: qc.locality,
                              postalCode: qc.postalCode,
                              localityType: 'CITY',
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
                            isSelected
                              ? 'bg-[#003B8E] border-[#003B8E] text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-[#003B8E] hover:text-[#003B8E]'
                          }`}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{qc.city}</span>
                          <span
                            className={`text-[10px] font-normal ${
                              isSelected ? 'text-blue-200' : 'text-slate-400'
                            }`}
                          >
                            ({qc.stateRegion})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Hub Lock Banner */}
                <div className="px-3 py-2.5 rounded-xl bg-blue-100/80 border border-blue-200 space-y-1 text-xs text-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-[#003B8E]">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Active City: {loginCitySelection.city}, {loginCitySelection.stateRegion}, {loginCitySelection.country}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-200/80 text-[#003B8E] uppercase shrink-0">
                      Locked
                    </span>
                  </div>
                  {detectedStreetAddress && (
                    <div className="text-[11px] text-slate-700 bg-white/80 px-2 py-1 rounded border border-blue-200 font-mono">
                      <strong className="text-slate-900 font-sans">Precise GPS Address:</strong> {detectedStreetAddress}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !loginCitySelection.city.trim()}
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

              <div className="pt-2 border-t border-slate-200">
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
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
                  <span className="text-slate-700 truncate">
                    Locking delivery city to{' '}
                    <strong className="font-extrabold text-[#003B8E]">
                      {loginCitySelection.city}
                    </strong>
                    {loginCitySelection.locality
                      ? ` (${loginCitySelection.locality})`
                      : ''}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-bold text-[#003B8E] shrink-0">
                  Intra-City Only
                </span>
              </div>

              {consoleNotice && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>SMS Delivery Status</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {consoleNotice}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="otp-code-input"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    6-digit verification code
                  </label>
                </div>
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
                  Enter the 6-digit SMS verification code sent to your mobile phone.
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

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      Locked Hyperlocal City: {loginCitySelection.city}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      Delivery of products will be strictly within {loginCitySelection.city} only.
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-bold text-[#003B8E] shrink-0">
                  Locked
                </span>
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
