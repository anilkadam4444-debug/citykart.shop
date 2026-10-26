'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Banknote,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  Handshake,
  Info,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { useUrbanDirect } from '@/components/urbandirect-provider';
import { formatCurrency } from '@/lib/catalog-data';
import {
  CountryCallingRecord,
  getCountryRecordByCodeOrName,
  INTERNATIONAL_COUNTRIES,
  validatePhoneNumberForCountry,
} from '@/lib/countries-data';
import {
  auth,
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from '@/lib/firebase';
import {
  getAllCountries,
  getCitiesByCountryAndRegion,
  getRegionsByCountry,
} from '@/lib/location-service';
import {
  CityEligibleRevenueItem,
  CityPartnerRecord,
  CityRevenueAttributionSummary,
  PartnerApplicationRecord,
  PartnerKycAndPayoutInfo,
  PartnerMonthlySettlementRecord,
  PartnerNotificationRecord,
  PartnerSupportingDocument,
} from '@/lib/partner-program';
import {
  formatFirebasePhoneAuthError,
  readPartnerOnboardingContext,
  setActivePartnerConfirmationSession,
  writePartnerOnboardingContext,
} from '@/lib/partner-onboarding-context';

type PortalTab =
  | 'overview'
  | 'apply'
  | 'application-status'
  | 'partner-dashboard'
  | 'partner-stores'
  | 'partner-revenue'
  | 'partner-settlements';

interface PartnerDashboardApiResponse {
  ok: boolean;
  authenticated: boolean;
  isActivePartner: boolean;
  dashboardAccessAllowed: boolean;
  partnerRecord: CityPartnerRecord | null;
  latestApplication: PartnerApplicationRecord | null;
  cityMetrics?: {
    assignedCityId: string;
    assignedCityName: string;
    assignedStateRegion: string;
    assignedCountry: string;
    totalSellersCount: number;
    totalStoresCount: number;
    activeStoresCount: number;
    totalProductsCount: number;
    activePaidSubscriptionsCount: number;
    activeCampaignsCount: number;
    totalOrdersCount: number;
    deliveredOrdersCount: number;
  };
  cityStores?: Array<{
    id: string;
    name: string;
    sellerId: string;
    sellerName: string;
    category: string;
    neighborhood: string;
    cityName: string;
    cityId: string;
    isActive: boolean;
    isSuspended: boolean;
    verifiedSince: string;
    activeSkus: number;
    subscriptionTier: string;
  }>;
  recentCityOrders?: Array<{
    id: string;
    createdAt: string;
    storeId: string;
    storeName: string;
    sellerId: string;
    itemCount: number;
    subtotal: number;
    totalPlatformFee: number;
    total: number;
    paymentMethod: string;
    orderStatus: string;
    locality: string;
    city: string;
  }>;
  lifetimeRevenueReport?: CityRevenueAttributionSummary;
  periodRevenueReport?: CityRevenueAttributionSummary;
  settlements?: PartnerMonthlySettlementRecord[];
  notifications?: PartnerNotificationRecord[];
  error?: string;
}

export function CityPartnerPortal() {
  const router = useRouter();
  const {
    isMounted,
    authenticatedUser,
    showToast,
  } = useUrbanDirect();

  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [loadingPortal, setLoadingPortal] = useState<boolean>(true);
  const [portalData, setPortalData] =
    useState<PartnerDashboardApiResponse | null>(null);
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState<string>('ALL');

  // Canonical City Availability Checker & Application Location State
  const countries = useMemo(() => getAllCountries(), []);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('IN');
  const regions = useMemo(
    () => getRegionsByCountry(selectedCountryCode),
    [selectedCountryCode]
  );
  const [selectedStateRegion, setSelectedStateRegion] =
    useState<string>('Maharashtra');
  const canonicalCities = useMemo(
    () => getCitiesByCountryAndRegion(selectedCountryCode, selectedStateRegion),
    [selectedCountryCode, selectedStateRegion]
  );
  const [selectedCityId, setSelectedCityId] = useState<string>(
    'india-maharashtra-nanded'
  );

  const selectedCityDef = useMemo(
    () =>
      canonicalCities.find((c) => c.cityId === selectedCityId) ||
      canonicalCities[0] ||
      null,
    [canonicalCities, selectedCityId]
  );

  const [cityAvailability, setCityAvailability] = useState<{
    cityId: string;
    isAvailable: boolean;
    availabilityStatus: 'AVAILABLE' | 'ALLOCATED_TO_ACTIVE_PARTNER';
    activePartnerName?: string;
    pendingApplicationsCount: number;
  } | null>(null);
  const [checkingCity, setCheckingCity] = useState<boolean>(false);

  // Partner Application Form State
  const [fullLegalName, setFullLegalName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [residentialOrBusinessAddress, setResidentialOrBusinessAddress] =
    useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('431601');
  const [relevantExperience, setRelevantExperience] = useState<string>('');
  const [localGrowthPlan, setLocalGrowthPlan] = useState<string>('');

  // KYC & Payout Form State
  const [identityDocType, setIdentityDocType] =
    useState<PartnerKycAndPayoutInfo['identityDocType']>('PAN_CARD');
  const [identityDocNumber, setIdentityDocNumber] = useState<string>('');
  const [addressProofType, setAddressProofType] =
    useState<PartnerKycAndPayoutInfo['addressProofType']>('AADHAAR');
  const [addressProofReference, setAddressProofReference] =
    useState<string>('');
  const [panOrTaxId, setPanOrTaxId] = useState<string>('');
  const [bankAccountHolderName, setBankAccountHolderName] =
    useState<string>('');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [bankIfscOrRoutingCode, setBankIfscOrRoutingCode] =
    useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [supportingDocuments, setSupportingDocuments] = useState<
    PartnerSupportingDocument[]
  >([]);
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);

  const [submittingApp, setSubmittingApp] = useState<boolean>(false);
  const [appSubmitError, setAppSubmitError] = useState<string | null>(null);
  const [submittedConfirmation, setSubmittedConfirmation] =
    useState<PartnerApplicationRecord | null>(null);

  // Additional Information Response State
  const [additionalInfoResponse, setAdditionalInfoResponse] =
    useState<string>('');
  const [submittingInfo, setSubmittingInfo] = useState<boolean>(false);

  // Store filter in Partner Dashboard
  const [partnerStoreSearch, setPartnerStoreSearch] = useState<string>('');

  // Inline Partner Phone Entry State (Step 1 -> /partner/verify-otp)
  const [partnerPhoneCountry, setPartnerPhoneCountry] =
    useState<CountryCallingRecord>(INTERNATIONAL_COUNTRIES[0]);
  const [partnerMobileInput, setPartnerMobileInput] = useState<string>('');
  const [partnerPhoneError, setPartnerPhoneError] = useState<string | null>(
    null
  );
  const [sendingPartnerOtp, setSendingPartnerOtp] = useState<boolean>(false);
  const inlineRecaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const cleanupInlineRecaptcha = () => {
    if (inlineRecaptchaRef.current) {
      try {
        inlineRecaptchaRef.current.clear();
      } catch {
        // Ignore
      }
      inlineRecaptchaRef.current = null;
    }
    if (typeof document !== 'undefined') {
      const el = document.getElementById('partner-portal-recaptcha-container');
      if (el) el.innerHTML = '';
    }
  };

  useEffect(() => {
    return () => {
      cleanupInlineRecaptcha();
    };
  }, []);

  const buildCurrentDraftApplication = useCallback(() => {
    return {
      fullLegalName,
      email,
      residentialOrBusinessAddress,
      countryCode: selectedCountryCode,
      stateRegion: selectedStateRegion,
      cityId: selectedCityId,
      postalCode,
      relevantExperience,
      localGrowthPlan,
      identityDocType,
      addressProofType,
      bankAccountHolderName,
      bankName,
      bankIfscOrRoutingCode,
      consentAccepted,
    };
  }, [
    fullLegalName,
    email,
    residentialOrBusinessAddress,
    selectedCountryCode,
    selectedStateRegion,
    selectedCityId,
    postalCode,
    relevantExperience,
    localGrowthPlan,
    identityDocType,
    addressProofType,
    bankAccountHolderName,
    bankName,
    bankIfscOrRoutingCode,
    consentAccepted,
  ]);

  const navigateToPartnerOtpRoute = useCallback(
    (returnTab: 'overview' | 'apply' | 'application-status' = 'apply') => {
      writePartnerOnboardingContext({
        registrationIntent: 'partner',
        countryCode: partnerPhoneCountry.code,
        dialCode: partnerPhoneCountry.dialCode,
        mobileNumber: partnerMobileInput.replace(/\D/g, ''),
        verificationStep: 'PHONE_ENTRY',
        returnTab,
        draftApplication: buildCurrentDraftApplication(),
      });
      router.push('/partner/verify-otp');
    },
    [
      partnerPhoneCountry,
      partnerMobileInput,
      buildCurrentDraftApplication,
      router,
    ]
  );

  const handleRequestPartnerOtpInline = async () => {
    setPartnerPhoneError(null);
    const validation = validatePhoneNumberForCountry(
      partnerMobileInput,
      partnerPhoneCountry
    );
    if (!validation.isValid) {
      setPartnerPhoneError(
        validation.error || 'Please enter a valid mobile number.'
      );
      return;
    }

    setSendingPartnerOtp(true);
    try {
      const validateRes = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VALIDATE_PHONE',
          countryCode: partnerPhoneCountry.code,
          mobileNumber: validation.digitsOnly,
          registrationIntent: 'partner',
        }),
      });
      const validateData = await validateRes.json();

      if (!validateRes.ok || !validateData.success) {
        setPartnerPhoneError(
          validateData.error || 'Could not validate mobile number.'
        );
        setSendingPartnerOtp(false);
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
        cleanupInlineRecaptcha();
        const verifier = new RecaptchaVerifier(
          auth,
          'partner-portal-recaptcha-container',
          { size: 'invisible' }
        );
        inlineRecaptchaRef.current = verifier;
        confirmationResult = await signInWithPhoneNumber(
          auth,
          targetE164,
          verifier
        );
      } catch (firebaseErr: unknown) {
        cleanupInlineRecaptcha();
        const formatted = formatFirebasePhoneAuthError(firebaseErr);
        if (formatted.isConsoleConfigNotice) {
          previewFallback = true;
          noticeText = formatted.userMessage;
        } else {
          setPartnerPhoneError(formatted.userMessage);
          setSendingPartnerOtp(false);
          return;
        }
      }

      setActivePartnerConfirmationSession({
        phoneE164: targetE164,
        maskedPhone: targetMasked,
        countryCode: partnerPhoneCountry.code,
        dialCode: partnerPhoneCountry.dialCode,
        mobileNumber: validation.digitsOnly,
        confirmationResult,
        isPreviewTestFallback: previewFallback,
        consoleNotice: noticeText,
        resendAvailableAtMs,
        createdAtMs: Date.now(),
      });

      writePartnerOnboardingContext({
        registrationIntent: 'partner',
        countryCode: partnerPhoneCountry.code,
        dialCode: partnerPhoneCountry.dialCode,
        mobileNumber: validation.digitsOnly,
        phoneE164: targetE164,
        maskedPhone: targetMasked,
        verificationStep: 'OTP_SENT',
        resendAvailableAtMs,
        returnTab: 'apply',
        draftApplication: buildCurrentDraftApplication(),
      });

      setSendingPartnerOtp(false);
      router.push('/partner/verify-otp');
    } catch {
      setSendingPartnerOtp(false);
      setPartnerPhoneError(
        'Network error while requesting verification OTP. Please try again.'
      );
    }
  };

  // Restore saved partner application draft & URL tab parameter on mount
  useEffect(() => {
    if (!isMounted) return;
    const timer = setTimeout(() => {
      const saved = readPartnerOnboardingContext();
      if (saved) {
        setPartnerPhoneCountry(getCountryRecordByCodeOrName(saved.countryCode));
        if (saved.mobileNumber) setPartnerMobileInput(saved.mobileNumber);
        if (saved.draftApplication) {
          const d = saved.draftApplication;
          if (d.fullLegalName) setFullLegalName(d.fullLegalName);
          if (d.email) setEmail(d.email);
          if (d.residentialOrBusinessAddress)
            setResidentialOrBusinessAddress(d.residentialOrBusinessAddress);
          if (d.countryCode) setSelectedCountryCode(d.countryCode);
          if (d.stateRegion) setSelectedStateRegion(d.stateRegion);
          if (d.cityId) setSelectedCityId(d.cityId);
          if (d.postalCode) setPostalCode(d.postalCode);
          if (d.relevantExperience)
            setRelevantExperience(d.relevantExperience);
          if (d.localGrowthPlan) setLocalGrowthPlan(d.localGrowthPlan);
          if (d.identityDocType) setIdentityDocType(d.identityDocType);
          if (d.addressProofType) setAddressProofType(d.addressProofType);
          if (d.bankAccountHolderName)
            setBankAccountHolderName(d.bankAccountHolderName);
          if (d.bankName) setBankName(d.bankName);
          if (d.bankIfscOrRoutingCode)
            setBankIfscOrRoutingCode(d.bankIfscOrRoutingCode);
          if (d.consentAccepted) setConsentAccepted(d.consentAccepted);
        }
      }
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (
          tabParam === 'apply' ||
          tabParam === 'overview' ||
          tabParam === 'application-status'
        ) {
          setActiveTab(tabParam);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isMounted]);

  const checkSelectedCityAvailability = useCallback(async (cityId: string) => {
    if (!cityId) return;
    try {
      await Promise.resolve();
      setCheckingCity(true);
      const res = await fetch(
        `/api/partners/applications?cityId=${encodeURIComponent(cityId)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data?.cityAvailability) {
        setCityAvailability(data.cityAvailability);
      }
    } catch {
      // Ignore network error
    } finally {
      setCheckingCity(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCityDef?.cityId) return;
    const cityId = selectedCityDef.cityId;
    const timer = setTimeout(() => {
      void checkSelectedCityAvailability(cityId);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedCityDef?.cityId, checkSelectedCityAvailability]);

  const loadPartnerPortalData = useCallback(
    async (period: string = selectedPeriodMonth) => {
      try {
        await Promise.resolve();
        setLoadingPortal(true);
        const res = await fetch(
          `/api/partners/dashboard?periodMonth=${encodeURIComponent(period)}`,
          { cache: 'no-store' }
        );
        const data = (await res.json()) as PartnerDashboardApiResponse;
        setPortalData(data);

        if (data?.isActivePartner && data?.dashboardAccessAllowed) {
          setActiveTab((prev) =>
            prev === 'overview' || prev === 'apply'
              ? 'partner-dashboard'
              : prev
          );
        } else if (data?.latestApplication) {
          setActiveTab((prev) =>
            prev === 'overview' ? 'application-status' : prev
          );
        }
      } catch {
        // Unauthenticated or offline
      } finally {
        setLoadingPortal(false);
      }
    },
    [selectedPeriodMonth]
  );

  useEffect(() => {
    if (!isMounted) return;
    const timer = setTimeout(() => {
      void loadPartnerPortalData(selectedPeriodMonth);
    }, 0);
    return () => clearTimeout(timer);
  }, [isMounted, authenticatedUser?.phoneE164, selectedPeriodMonth, loadPartnerPortalData]);

  const handleAttachSupportingDocument = (
    docCategory: PartnerSupportingDocument['docCategory'],
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Supporting document must be under 5 MB.');
      return;
    }
    const uidFolder = authenticatedUser?.uid || authenticatedUser?.id || 'applicant';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const newDoc: PartnerSupportingDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      docCategory,
      fileName: file.name,
      storagePath: `/partner_kyc/${uidFolder}/${Date.now()}_${cleanFileName}`,
      mimeType: file.type || 'application/pdf',
      fileSizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };
    setSupportingDocuments((prev) => [
      ...prev.filter((d) => d.docCategory !== docCategory),
      newDoc,
    ]);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppSubmitError(null);

    if (!authenticatedUser) {
      navigateToPartnerOtpRoute('apply');
      return;
    }

    if (!selectedCityDef) {
      setAppSubmitError('Please select a valid canonical city from the directory.');
      return;
    }

    if (cityAvailability && !cityAvailability.isAvailable) {
      setAppSubmitError(
        `${selectedCityDef.cityName} already has an active City Partner. Please select an available city.`
      );
      return;
    }

    setSubmittingApp(true);
    try {
      const selectedCountry = countries.find(
        (c) => c.code === selectedCountryCode
      );
      const res = await fetch('/api/partners/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_APPLICATION',
          fullLegalName,
          phoneE164: authenticatedUser.phoneE164,
          maskedPhone: authenticatedUser.maskedPhone,
          email,
          residentialOrBusinessAddress,
          country: selectedCountry?.name || selectedCityDef.country,
          countryCode: selectedCountryCode,
          stateRegion: selectedCityDef.stateRegion,
          cityId: selectedCityDef.cityId,
          cityName: selectedCityDef.cityName,
          district: selectedCityDef.district,
          postalCode,
          relevantExperience,
          localGrowthPlan,
          identityDocType,
          identityDocNumber,
          addressProofType,
          addressProofReference,
          panOrTaxId,
          bankAccountHolderName,
          bankAccountNumber,
          bankIfscOrRoutingCode,
          bankName,
          supportingDocuments,
          consentAccepted,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setAppSubmitError(
          data?.error || 'Failed to submit partner application.'
        );
        return;
      }

      setSubmittedConfirmation(data.application);
      showToast(
        `Application ${data.application.referenceId} submitted for ${selectedCityDef.cityName}!`
      );
      await loadPartnerPortalData();
      setActiveTab('application-status');
    } catch (err) {
      setAppSubmitError(
        err instanceof Error ? err.message : 'Network error submitting form.'
      );
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleProvideAdditionalInfo = async (applicationId: string) => {
    if (!additionalInfoResponse.trim()) return;
    setSubmittingInfo(true);
    try {
      const res = await fetch('/api/partners/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PROVIDE_ADDITIONAL_INFO',
          applicationId,
          responseText: additionalInfoResponse.trim(),
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setAdditionalInfoResponse('');
        showToast('Additional information submitted for Super Admin review.');
        await loadPartnerPortalData();
      } else {
        showToast(data?.error || 'Could not submit response.');
      }
    } finally {
      setSubmittingInfo(false);
    }
  };

  const handleWithdrawApplication = async (applicationId: string) => {
    try {
      const res = await fetch('/api/partners/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'WITHDRAW_APPLICATION',
          applicationId,
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        showToast('Your partner application has been withdrawn.');
        await loadPartnerPortalData();
      } else {
        showToast(data?.error || 'Unable to withdraw application.');
      }
    } catch {}
  };

  const isActivePartner = Boolean(
    portalData?.isActivePartner &&
      portalData?.dashboardAccessAllowed &&
      portalData?.partnerRecord
  );
  const latestApp = portalData?.latestApplication || submittedConfirmation;
  const activePartner = portalData?.partnerRecord || null;
  const revenueReport =
    portalData?.periodRevenueReport || portalData?.lifetimeRevenueReport || null;

  const filteredPartnerStores = useMemo(() => {
    const list = portalData?.cityStores || [];
    const q = partnerStoreSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.sellerName.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q)
    );
  }, [portalData?.cityStores, partnerStoreSearch]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* ====================================================================
          TOP NAVIGATION HEADER
         ==================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
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
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#003B8E] font-bold mt-0.5">
                  City Partner Program
                </div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-blue-50 text-[#003B8E] font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Program Overview
              </button>
              {!isActivePartner && (
                <button
                  type="button"
                  onClick={() => setActiveTab('apply')}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    activeTab === 'apply'
                      ? 'bg-blue-50 text-[#003B8E] font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Apply for a City
                </button>
              )}
              {latestApp && (
                <button
                  type="button"
                  onClick={() => setActiveTab('application-status')}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    activeTab === 'application-status'
                      ? 'bg-blue-50 text-[#003B8E] font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Application Status ({latestApp.referenceId})
                </button>
              )}
              {isActivePartner && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('partner-dashboard')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      activeTab === 'partner-dashboard'
                        ? 'bg-emerald-50 text-emerald-800 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    City Dashboard ({activePartner?.assignedCityName})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('partner-revenue')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      activeTab === 'partner-revenue'
                        ? 'bg-emerald-50 text-emerald-800 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    50/50 Revenue Share
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('partner-settlements')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      activeTab === 'partner-settlements'
                        ? 'bg-emerald-50 text-emerald-800 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Monthly Settlements
                  </button>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {isMounted && authenticatedUser ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-bold text-slate-900">
                  {authenticatedUser.fullName}
                </span>
                <span className="font-mono text-slate-500">
                  {authenticatedUser.phoneE164}
                </span>
                {isActivePartner && (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                    PARTNER · {activePartner?.assignedCityName}
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                data-testid="partner-header-verify-otp-btn"
                onClick={() => navigateToPartnerOtpRoute('apply')}
                className="px-3.5 py-1.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Verify Mobile OTP (Partner Flow)</span>
              </button>
            )}

            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
        </div>

        {/* Mobile Tab Strip */}
        <div className="md:hidden px-4 py-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#003B8E] text-white font-bold'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Overview
          </button>
          {!isActivePartner && (
            <button
              type="button"
              onClick={() => setActiveTab('apply')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                activeTab === 'apply'
                  ? 'bg-[#F96302] text-white font-bold'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              Apply Now
            </button>
          )}
          {latestApp && (
            <button
              type="button"
              onClick={() => setActiveTab('application-status')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                activeTab === 'application-status'
                  ? 'bg-[#003B8E] text-white font-bold'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              My Application
            </button>
          )}
          {isActivePartner && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('partner-dashboard')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  activeTab === 'partner-dashboard'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                City Dashboard
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('partner-revenue')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  activeTab === 'partner-revenue'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                50/50 Revenue
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('partner-settlements')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  activeTab === 'partner-settlements'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Settlements
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* ====================================================================
            TAB 1: PROGRAM OVERVIEW & CANONICAL CITY AVAILABILITY CHECKER
           ==================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Hero Banner */}
            <section className="rounded-3xl bg-[#0B1120] text-white p-6 sm:p-10 border border-slate-800 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#F96302]/20 border border-[#F96302]/40 text-[#F96302] text-xs font-mono uppercase tracking-widest font-bold">
                  <Handshake className="w-3.5 h-3.5" />
                  <span>Exclusive City Franchise &amp; Growth Partnership</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                  Lead Citykart.shop in Your City.{' '}
                  <span className="text-[#F96302]">
                    Earn 50% of Net Eligible City Revenue.
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  Become the authorized City Partner for your city. Onboard local
                  retail shops, grow hyperlocal commerce, and share 50/50 in
                  Citykart&apos;s collected platform fees, seller subscriptions,
                  and sponsored placements attributed to your city.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {isActivePartner ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('partner-dashboard')}
                      className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Award className="w-4 h-4" />
                      <span>
                        Open My Partner Dashboard ({activePartner?.assignedCityName})
                      </span>
                    </button>
                  ) : latestApp ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('application-status')}
                      className="px-6 py-3 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg"
                    >
                      <FileText className="w-4 h-4" />
                      <span>
                        Track Application ({latestApp.referenceId} ·{' '}
                        {latestApp.status})
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('apply')}
                      className="px-6 py-3 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg"
                    >
                      <span>Start Partner Application</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Live Canonical City Availability Checker Card */}
              <div className="lg:col-span-5 bg-slate-900/95 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#F96302]" />
                    <span>Check Canonical City Availability</span>
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400">
                    1 Active Partner / City
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Country
                    </label>
                    <select
                      value={selectedCountryCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSelectedCountryCode(code);
                        const nextRegions = getRegionsByCountry(code);
                        if (nextRegions.length > 0) {
                          setSelectedStateRegion(nextRegions[0].name);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                    >
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      State / Province
                    </label>
                    <select
                      value={selectedStateRegion}
                      onChange={(e) => setSelectedStateRegion(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                    >
                      {regions.map((r) => (
                        <option key={r.code} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Canonical City
                    </label>
                    <select
                      value={selectedCityDef?.cityId || ''}
                      onChange={(e) => {
                        setSelectedCityId(e.target.value);
                        const match = canonicalCities.find(
                          (c) => c.cityId === e.target.value
                        );
                        if (match?.postalCode) {
                          setPostalCode(match.postalCode);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                    >
                      {canonicalCities.map((c) => (
                        <option key={c.cityId} value={c.cityId}>
                          {c.cityName}
                          {c.district ? ` (${c.district})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Availability Status Display */}
                {checkingCity ? (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Checking canonical city allocation...</span>
                  </div>
                ) : cityAvailability ? (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      cityAvailability.isAvailable
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        {cityAvailability.isAvailable ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-400" />
                        )}
                        <span>
                          {selectedCityDef?.cityName},{' '}
                          {selectedCityDef?.stateRegion}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-black/30">
                        {cityAvailability.isAvailable
                          ? 'AVAILABLE'
                          : 'ALLOCATED'}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90">
                      {cityAvailability.isAvailable
                        ? `This canonical city (${cityAvailability.cityId}) is currently open for Partner applications. Submitting an application does not reserve the city until Super Admin approval.`
                        : `This city is currently assigned to an active City Partner. Please select another available city.`}
                    </p>
                    {cityAvailability.isAvailable && !isActivePartner && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('apply')}
                        className="mt-2 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        Apply for {selectedCityDef?.cityName}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {/* Transparent 50/50 Revenue-Sharing Policy Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#003B8E] flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  1. Eligible Collected City Revenue
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Includes Citykart&apos;s actually collected pre-tax revenue
                  attributed to your canonical city: paid 2% order platform
                  fees, paid seller SaaS subscriptions (Growth &amp; Business
                  Pro), and paid sponsored ad campaigns.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F96302] flex items-center justify-center">
                  <Handshake className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  2. Transparent 50 / 50 Revenue Split
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-900">
                    Net Eligible City Revenue
                  </strong>{' '}
                  = Collected Eligible Revenue − Approved Refunds/Reversals −
                  Agreed Deductions. You earn{' '}
                  <strong className="text-[#003B8E] font-mono">50%</strong> and
                  Citykart retains{' '}
                  <strong className="text-slate-900 font-mono">50%</strong>.
                  Seller product sales (COD/UPI) and GST are excluded.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  3. Monthly Manual Bank Settlements
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  At the close of each monthly period, a settlement statement is
                  generated for your city, reviewed and approved by the Super
                  Admin, and settled via audited manual bank transfer
                  (NEFT/RTGS/IMPS) with full UTR reference tracking.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* ====================================================================
            TAB 2: PARTNER APPLICATION FORM (WITH OTP + KYC + CANONICAL LOCATION)
           ==================================================================== */}
        {activeTab === 'apply' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-[#003B8E] font-bold">
                    Official Partner Registration
                  </span>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
                    City Partner Application Form
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Complete all applicant, canonical city, and KYC payout
                    fields below. Applications enter{' '}
                    <code className="font-mono text-slate-700">
                      pending_review
                    </code>{' '}
                    and require Super Admin approval.
                  </p>
                </div>

                {/* Step 1: Mobile OTP Status Pill */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs min-w-[260px]">
                  <div id="partner-portal-recaptcha-container" aria-hidden="true" />
                  {authenticatedUser ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div>OTP Verified Mobile (Partner Flow)</div>
                          <div className="font-mono text-slate-900">
                            {authenticatedUser.phoneE164}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          writePartnerOnboardingContext({
                            registrationIntent: 'partner',
                            phoneE164: authenticatedUser.phoneE164,
                            maskedPhone: authenticatedUser.maskedPhone,
                            verificationStep: 'PHONE_ENTRY',
                            returnTab: 'apply',
                            draftApplication: buildCurrentDraftApplication(),
                          });
                          router.push('/partner/verify-otp?changePhone=1');
                        }}
                        className="text-[11px] font-bold text-[#003B8E] hover:underline cursor-pointer"
                      >
                        Change verified phone number
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="text-amber-800 font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Step 1: Verify Partner Mobile via OTP</span>
                      </div>
                      <div className="flex gap-1.5">
                        <select
                          aria-label="Country Dial Code"
                          value={partnerPhoneCountry.code}
                          onChange={(e) => {
                            setPartnerPhoneCountry(
                              getCountryRecordByCodeOrName(e.target.value)
                            );
                            setPartnerPhoneError(null);
                          }}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-800"
                        >
                          {INTERNATIONAL_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code} {c.dialCode}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          data-testid="partner-inline-phone-input"
                          value={partnerMobileInput}
                          onChange={(e) => {
                            setPartnerMobileInput(
                              e.target.value.replace(/[^\d\s-]/g, '')
                            );
                            setPartnerPhoneError(null);
                          }}
                          placeholder="10-digit mobile"
                          className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                        />
                      </div>
                      {partnerPhoneError && (
                        <div className="text-[11px] text-rose-700 font-semibold">
                          {partnerPhoneError}
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          data-testid="partner-inline-send-otp-btn"
                          disabled={sendingPartnerOtp}
                          onClick={handleRequestPartnerOtpInline}
                          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          {sendingPartnerOtp ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending Partner OTP...</span>
                            </>
                          ) : (
                            <>
                              <span>Send OTP &amp; Verify on /partner/verify-otp</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {appSubmitError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="font-semibold">{appSubmitError}</div>
                </div>
              )}

              <form onSubmit={handleSubmitApplication} className="space-y-8 text-xs">
                {/* SECTION A: APPLICANT INFORMATION */}
                <div className="space-y-4">
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    1. Applicant Information
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Full Legal Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={fullLegalName}
                        onChange={(e) => setFullLegalName(e.target.value)}
                        placeholder="As shown on PAN / Government ID"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#003B8E] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Verified Mobile Number (OTP){' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        disabled
                        value={
                          authenticatedUser?.phoneE164 ||
                          'Click "Verify Mobile via OTP" above'
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-mono font-bold text-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="partner@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#003B8E] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Postal / PIN Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="e.g. 431601"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900 focus:bg-white focus:border-[#003B8E] focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-800 mb-1">
                        Residential or Business Street Address{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={residentialOrBusinessAddress}
                        onChange={(e) =>
                          setResidentialOrBusinessAddress(e.target.value)
                        }
                        placeholder="Building, Street, Area / Locality"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#003B8E] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION B: CANONICAL CITY SELECTION & GROWTH PLAN */}
                <div className="space-y-4">
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    2. Requested Canonical City &amp; Local Growth Plan
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Country <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedCountryCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          setSelectedCountryCode(code);
                          const nextRegs = getRegionsByCountry(code);
                          if (nextRegs.length > 0) {
                            setSelectedStateRegion(nextRegs[0].name);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900"
                      >
                        {countries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        State / Province <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedStateRegion}
                        onChange={(e) => setSelectedStateRegion(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900"
                      >
                        {regions.map((r) => (
                          <option key={r.code} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        City Requested for Partnership{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedCityDef?.cityId || ''}
                        onChange={(e) => {
                          setSelectedCityId(e.target.value);
                          const match = canonicalCities.find(
                            (c) => c.cityId === e.target.value
                          );
                          if (match?.postalCode) {
                            setPostalCode(match.postalCode);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900"
                      >
                        {canonicalCities.map((c) => (
                          <option key={c.cityId} value={c.cityId}>
                            {c.cityName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedCityDef && cityAvailability && (
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        cityAvailability.isAvailable
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : 'bg-amber-50 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>
                          Canonical City ID:{' '}
                          <code className="font-mono font-bold">
                            {selectedCityDef.cityId}
                          </code>
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[11px]">
                        {cityAvailability.isAvailable
                          ? 'AVAILABLE FOR APPLICATION'
                          : 'ALREADY ALLOCATED'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Relevant Business or Marketing Experience{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={relevantExperience}
                        onChange={(e) => setRelevantExperience(e.target.value)}
                        placeholder="Describe your retail, distribution, merchant onboarding, or field sales experience..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#003B8E] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Local City Growth &amp; Seller Acquisition Plan{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={localGrowthPlan}
                        onChange={(e) => setLocalGrowthPlan(e.target.value)}
                        placeholder="How will you onboard local retail stores across categories in your city during your first 90 days?"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#003B8E] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION C: KYC & PAYOUT INFORMATION */}
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                      3. KYC Identity Verification &amp; Bank Payout Details
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-[#003B8E]" />
                      <span>
                        Restricted Storage · Reviewed Only by Super Admin
                      </span>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-slate-700 text-[11px] leading-relaxed">
                    <strong>Verification Policy:</strong> Mobile OTP
                    verification confirms your phone number only and does{' '}
                    <strong>not</strong> constitute KYC verification. Your
                    identity, tax ID (PAN), and bank details are manually
                    reviewed by the Super Admin before partner activation and
                    monthly manual settlements.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Identity Document Type{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={identityDocType}
                        onChange={(e) =>
                          setIdentityDocType(
                            e.target
                              .value as PartnerKycAndPayoutInfo['identityDocType']
                          )
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900"
                      >
                        <option value="PAN_CARD">PAN Card</option>
                        <option value="AADHAAR_MASKED">
                          Masked Aadhaar (Last 4 Digits)
                        </option>
                        <option value="PASSPORT">Passport</option>
                        <option value="DRIVING_LICENSE">Driving Licence</option>
                        <option value="VOTER_ID">Voter ID</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Identity Document Number{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={identityDocNumber}
                        onChange={(e) => setIdentityDocNumber(e.target.value)}
                        placeholder="Enter ID number"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        PAN / Tax Identification Number{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={panOrTaxId}
                        onChange={(e) =>
                          setPanOrTaxId(e.target.value.toUpperCase())
                        }
                        placeholder="ABCDE1234F"
                        maxLength={16}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono uppercase text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Address Verification Document{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={addressProofType}
                        onChange={(e) =>
                          setAddressProofType(
                            e.target
                              .value as PartnerKycAndPayoutInfo['addressProofType']
                          )
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900"
                      >
                        <option value="AADHAAR">Aadhaar Card</option>
                        <option value="UTILITY_BILL">
                          Electricity / Utility Bill
                        </option>
                        <option value="BANK_STATEMENT">Bank Statement</option>
                        <option value="RENT_AGREEMENT">
                          Registered Rent / Lease Agreement
                        </option>
                        <option value="BUSINESS_REGISTRATION">
                          GST / Shop Act Certificate
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Bank Account Holder Name{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={bankAccountHolderName}
                        onChange={(e) =>
                          setBankAccountHolderName(e.target.value)
                        }
                        placeholder="Exact name on bank account"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Bank Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. State Bank of India / HDFC Bank"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Bank Account Number{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder="Account number for NEFT/RTGS payouts"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        IFSC Code (Indian Payouts){' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={bankIfscOrRoutingCode}
                        onChange={(e) =>
                          setBankIfscOrRoutingCode(
                            e.target.value.toUpperCase()
                          )
                        }
                        placeholder="e.g. SBIN0001234"
                        maxLength={11}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono uppercase text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Supporting KYC Document (Optional Upload)
                      </label>
                      <label className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-dashed border-slate-300 hover:border-[#003B8E] text-slate-700 flex items-center justify-between cursor-pointer">
                        <span className="truncate">
                          {supportingDocuments.length > 0
                            ? `${supportingDocuments.length} file(s) attached`
                            : 'Attach PAN / ID proof'}
                        </span>
                        <Upload className="w-4 h-4 text-[#003B8E] shrink-0" />
                        <input
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) =>
                            handleAttachSupportingDocument('IDENTITY', e)
                          }
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* SECTION D: PRIVACY & CONSENT NOTICE */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(e) => setConsentAccepted(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      <strong>Consent &amp; Privacy Notice:</strong> I confirm
                      that the legal identity, PAN/tax, and bank payout
                      information provided above is accurate and belongs to me.
                      I consent to Citykart.shop storing these KYC records in
                      restricted storage solely for Partner Program eligibility
                      verification, audit compliance, and monthly manual bank
                      settlements. I understand that submitting this application
                      does not automatically grant partner rights or reserve a
                      city until approved by the Super Admin.
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submittingApp ||
                      (cityAvailability !== null &&
                        !cityAvailability.isAvailable)
                    }
                    className="px-6 py-2.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] disabled:opacity-50 text-white font-bold cursor-pointer shadow-sm"
                  >
                    {submittingApp
                      ? 'Submitting Application...'
                      : authenticatedUser
                        ? 'Submit Partner Application'
                        : 'Verify Mobile OTP & Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: APPLICATION STATUS TRACKER (FOR APPLICANTS)
           ==================================================================== */}
        {activeTab === 'application-status' && latestApp && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#003B8E] font-bold">
                    Application Reference · {latestApp.referenceId}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
                    {latestApp.cityName}, {latestApp.stateRegion} (
                    {latestApp.country})
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Submitted on{' '}
                    <span className="font-mono">
                      {new Date(latestApp.submittedAt).toLocaleString()}
                    </span>{' '}
                    · Canonical City ID:{' '}
                    <code className="font-mono text-slate-700">
                      {latestApp.cityId}
                    </code>
                  </p>
                </div>

                <span
                  className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold uppercase ${
                    latestApp.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : latestApp.status === 'rejected' ||
                          latestApp.status === 'withdrawn'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : latestApp.status === 'additional_information_required'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-100 text-[#003B8E] border border-blue-300'
                  }`}
                >
                  {latestApp.status.replace(/_/g, ' ')}
                </span>
              </div>

              {latestApp.statusReason && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-900">
                    Review Note / Status Reason:
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {latestApp.statusReason}
                  </p>
                </div>
              )}

              {/* Additional Info Request Action Box */}
              {latestApp.status === 'additional_information_required' && (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 text-xs">
                  <div className="font-extrabold text-amber-950 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>
                      Super Admin Requested Additional Information:
                    </span>
                  </div>
                  <p className="text-amber-900">
                    {latestApp.additionalInfoPrompt || latestApp.statusReason}
                  </p>
                  <textarea
                    rows={3}
                    value={additionalInfoResponse}
                    onChange={(e) => setAdditionalInfoResponse(e.target.value)}
                    placeholder="Enter the requested details or clarification..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-amber-300 text-slate-900"
                  />
                  <button
                    type="button"
                    disabled={submittingInfo || !additionalInfoResponse.trim()}
                    onClick={() => handleProvideAdditionalInfo(latestApp.id)}
                    className="px-4 py-2 rounded-xl bg-[#003B8E] text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {submittingInfo
                      ? 'Submitting Response...'
                      : 'Submit Additional Information'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Applicant</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {latestApp.fullLegalName}
                  </div>
                  <div className="font-mono text-slate-600 mt-0.5">
                    {latestApp.phoneE164}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">KYC Verification Status</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {latestApp.kyc.kycVerificationStatus}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    PAN: {latestApp.kyc.panOrTaxIdMasked}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Settlement Bank Account</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {latestApp.kyc.bankName}
                  </div>
                  <div className="font-mono text-slate-600 mt-0.5">
                    {latestApp.kyc.bankAccountNumberMasked} ·{' '}
                    {latestApp.kyc.bankIfscOrRoutingCode}
                  </div>
                </div>
              </div>

              {/* Status History Audit Trail */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Application Lifecycle History
                </h3>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden text-xs">
                  {latestApp.history.map((h) => (
                    <div
                      key={h.id}
                      className="p-3.5 bg-white flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#003B8E]">
                          {h.toStatus}
                        </span>
                        <span className="text-slate-600 ml-2">{h.note}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {(latestApp.status === 'pending_review' ||
                latestApp.status === 'additional_information_required') && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Need to cancel your application?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleWithdrawApplication(latestApp.id)}
                    className="text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                  >
                    Withdraw Application
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4, 5, 6: ACTIVE CITY PARTNER DASHBOARD (CITY-SCOPED)
           ==================================================================== */}
        {isActivePartner &&
          activePartner &&
          (activeTab === 'partner-dashboard' ||
            activeTab === 'partner-revenue' ||
            activeTab === 'partner-settlements') && (
            <div className="space-y-6">
              {/* Partner Executive Header Banner */}
              <div className="bg-[#0B1120] text-white rounded-3xl p-6 sm:p-8 border border-slate-800 flex flex-wrap items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Authorized City Partner · Exclusive City Scope:{' '}
                      {activePartner.assignedCityId}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {activePartner.assignedCityName},{' '}
                    {activePartner.assignedStateRegion}
                  </h1>
                  <p className="text-xs text-slate-300">
                    Partner: <strong>{activePartner.fullName}</strong> (
                    <span className="font-mono">{activePartner.phoneE164}</span>
                    ) · Activated{' '}
                    <span className="font-mono">
                      {new Date(activePartner.activatedAt).toLocaleDateString()}
                    </span>{' '}
                    · KYC:{' '}
                    <span className="font-mono text-emerald-400 font-bold">
                      {activePartner.kycVerificationStatus}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-right">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Your Revenue Share (50%)
                    </div>
                    <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-400">
                      {formatCurrency(
                        portalData?.lifetimeRevenueReport?.partnerShareAmount ||
                          0
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-right">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Citykart Retained (50%)
                    </div>
                    <div className="text-xl font-extrabold font-mono tabular-nums text-blue-400">
                      {formatCurrency(
                        portalData?.lifetimeRevenueReport
                          ?.citykartRetainedAmount || 0
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Navigation Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('partner-dashboard')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      activeTab === 'partner-dashboard'
                        ? 'bg-[#003B8E] text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    City Stores &amp; Activity
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('partner-revenue')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      activeTab === 'partner-revenue'
                        ? 'bg-[#003B8E] text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    50/50 Revenue-Share Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('partner-settlements')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      activeTab === 'partner-settlements'
                        ? 'bg-[#003B8E] text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Monthly Settlement Statements (
                    {(portalData?.settlements || []).length})
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-600">Period:</span>
                  <select
                    value={selectedPeriodMonth}
                    onChange={(e) => setSelectedPeriodMonth(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900"
                  >
                    <option value="ALL">All-Time Cumulative</option>
                    <option value="2026-10">2026-10 (Oct 2026)</option>
                    <option value="2026-09">2026-09 (Sep 2026)</option>
                    <option value="2026-08">2026-08 (Aug 2026)</option>
                  </select>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-500 font-semibold">
                    City Sellers
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                    {portalData?.cityMetrics?.totalSellersCount || 0}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-500 font-semibold">
                    Active Stores
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-700 mt-1">
                    {portalData?.cityMetrics?.activeStoresCount || 0}{' '}
                    <span className="text-xs text-slate-400">
                      / {portalData?.cityMetrics?.totalStoresCount || 0}
                    </span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-500 font-semibold">
                    City Products
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                    {portalData?.cityMetrics?.totalProductsCount || 0}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-500 font-semibold">
                    Paid Subscriptions
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-[#003B8E] mt-1">
                    {portalData?.cityMetrics?.activePaidSubscriptionsCount || 0}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-500 font-semibold">
                    Delivered Orders
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                    {portalData?.cityMetrics?.deliveredOrdersCount || 0}{' '}
                    <span className="text-xs text-slate-400">
                      / {portalData?.cityMetrics?.totalOrdersCount || 0}
                    </span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-500 font-semibold">
                    Net Eligible Revenue
                  </div>
                  <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-700 mt-1">
                    {formatCurrency(revenueReport?.netEligibleRevenue || 0)}
                  </div>
                </div>
              </div>

              {/* VIEW A: CITY STORES & MARKETPLACE ACTIVITY */}
              {activeTab === 'partner-dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900">
                          Stores in {activePartner.assignedCityName} (
                          {filteredPartnerStores.length})
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Strictly scoped to canonical city{' '}
                          <code className="font-mono">
                            {activePartner.assignedCityId}
                          </code>
                        </p>
                      </div>
                      <input
                        type="search"
                        value={partnerStoreSearch}
                        onChange={(e) => setPartnerStoreSearch(e.target.value)}
                        placeholder="Search city stores..."
                        className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-xs"
                      />
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2.5 pr-3 font-semibold">Store</th>
                            <th className="py-2.5 px-3 font-semibold">
                              Category
                            </th>
                            <th className="py-2.5 px-3 font-semibold">Plan</th>
                            <th className="py-2.5 pl-3 text-right font-semibold">
                              SKUs
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPartnerStores.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50">
                              <td className="py-2.5 pr-3">
                                <div className="font-bold text-slate-900">
                                  {st.name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {st.sellerName} · {st.neighborhood}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {st.category}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#003B8E]">
                                  {st.subscriptionTier}
                                </span>
                              </td>
                              <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-bold">
                                {st.activeSkus}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent City Orders & Partner Payout Profile */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Partner Payout &amp; KYC Profile
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-slate-500">Account Holder</div>
                          <div className="font-bold text-slate-900">
                            {activePartner.payoutSummary.bankAccountHolderName}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Bank &amp; IFSC</div>
                          <div className="font-mono font-bold text-slate-900">
                            {activePartner.payoutSummary.bankName} ·{' '}
                            {activePartner.payoutSummary.bankIfscOrRoutingCode}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Account Number</div>
                          <div className="font-mono text-slate-800">
                            {
                              activePartner.payoutSummary
                                .bankAccountNumberMasked
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">PAN / Tax ID</div>
                          <div className="font-mono text-slate-800">
                            {activePartner.payoutSummary.panOrTaxIdMasked}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Recent City Orders (
                        {(portalData?.recentCityOrders || []).length})
                      </h3>
                      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
                        {(portalData?.recentCityOrders || []).map((ord) => (
                          <div
                            key={ord.id}
                            className="py-2.5 flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="font-mono font-bold text-slate-900">
                                #{ord.id} · {ord.storeName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {ord.locality} · {ord.orderStatus}
                              </div>
                            </div>
                            <div className="text-right font-mono tabular-nums">
                              <div className="font-bold text-slate-900">
                                Fee: {formatCurrency(ord.totalPlatformFee)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Order GMV: {formatCurrency(ord.total)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW B: 50/50 REVENUE-SHARING & ATTRIBUTION BREAKDOWN */}
              {activeTab === 'partner-revenue' && revenueReport && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900">
                          50 / 50 City Revenue-Share Calculation (
                          {revenueReport.periodMonth === 'ALL'
                            ? 'All-Time'
                            : revenueReport.periodMonth}
                          )
                        </h2>
                        <p className="text-xs text-slate-500">
                          Calculated strictly from collected, pre-tax eligible
                          revenue attributed to{' '}
                          <code className="font-mono">
                            {revenueReport.cityId}
                          </code>
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-mono text-xs font-bold text-emerald-900">
                        Partner Share: {revenueReport.partnerSharePercent}% ·
                        Citykart Share: {revenueReport.citykartRetainedPercent}%
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-slate-500">
                          1. Collected Platform Fees
                        </div>
                        <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                          {formatCurrency(revenueReport.platformFeesCollected)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Paid 2% order platform fees
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-slate-500">
                          2. Collected Subscriptions (Pre-Tax)
                        </div>
                        <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                          {formatCurrency(
                            revenueReport.subscriptionRevenueCollected
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Growth &amp; Business Pro plans
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-slate-500">
                          3. Sponsored Ads &amp; Services (Pre-Tax)
                        </div>
                        <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                          {formatCurrency(
                            revenueReport.sponsoredAdRevenueCollected +
                              revenueReport.valueAddedServiceRevenueCollected
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Paid campaigns &amp; onboarding
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200">
                        <div className="text-rose-800">
                          4. Refunds, Reversals &amp; Deductions
                        </div>
                        <div className="text-lg font-extrabold font-mono tabular-nums text-rose-700 mt-1">
                          −
                          {formatCurrency(
                            revenueReport.refundsAndReversals +
                              revenueReport.agreedDeductions
                          )}
                        </div>
                        <div className="text-[11px] text-rose-700 mt-0.5">
                          Deducted before 50/50 split
                        </div>
                      </div>
                    </div>

                    {/* Net Eligible & 50/50 Split Box */}
                    <div className="p-5 rounded-2xl bg-slate-900 text-white grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="text-xs text-slate-400">
                          Net Eligible City Revenue
                        </div>
                        <div className="text-2xl font-extrabold font-mono tabular-nums text-white mt-1">
                          {formatCurrency(revenueReport.netEligibleRevenue)}
                        </div>
                      </div>
                      <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
                        <div className="text-xs text-emerald-400 font-bold">
                          Partner Share ({revenueReport.partnerSharePercent}%)
                        </div>
                        <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-400 mt-1">
                          {formatCurrency(revenueReport.partnerShareAmount)}
                        </div>
                      </div>
                      <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
                        <div className="text-xs text-blue-400 font-bold">
                          Citykart Retained Share (
                          {revenueReport.citykartRetainedPercent}%)
                        </div>
                        <div className="text-2xl font-extrabold font-mono tabular-nums text-blue-400 mt-1">
                          {formatCurrency(revenueReport.citykartRetainedAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Non-Eligible Excluded Figures Disclosure */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block">
                          Excluded GST / Taxes:
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCurrency(revenueReport.taxesExcludedTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Excluded Uncollected Platform Fees:
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCurrency(
                            revenueReport.uncollectedAccruedFeesExcluded
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Excluded Seller Product Sales (COD/UPI GMV):
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCurrency(
                            revenueReport.citySellerProductGmvExcluded
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2.5 pr-3">Date</th>
                            <th className="py-2.5 px-3">Source</th>
                            <th className="py-2.5 px-3">Store &amp; Details</th>
                            <th className="py-2.5 px-3 text-right">
                              Gross Collected
                            </th>
                            <th className="py-2.5 px-3 text-right">
                              Tax Excluded
                            </th>
                            <th className="py-2.5 pl-3 text-right">
                              Net Eligible
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {revenueReport.lineItems.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-6 text-center text-slate-500"
                              >
                                No collected eligible revenue items recorded for
                                this period yet.
                              </td>
                            </tr>
                          ) : (
                            revenueReport.lineItems.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="py-2.5 pr-3 font-mono text-slate-500">
                                  {item.collectedAt.slice(0, 10)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                                    {item.sourceType}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">
                                    {item.storeName}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {item.description}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                  {formatCurrency(
                                    item.grossAmountCollected,
                                    item.currency
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                                  {formatCurrency(
                                    item.taxAmountExcluded,
                                    item.currency
                                  )}
                                </td>
                                <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                                  {item.isRefundedOrReversed
                                    ? `−${formatCurrency(item.refundOrReversalAmount, item.currency)} (Reversed)`
                                    : formatCurrency(
                                        item.eligibleNetAmount,
                                        item.currency
                                      )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW C: MONTHLY SETTLEMENT STATEMENTS & MANUAL PAYOUT HISTORY */}
              {activeTab === 'partner-settlements' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Monthly Settlement Statements &amp; Manual Bank Payouts
                    </h2>
                    <p className="text-xs text-slate-500">
                      Monthly settlements are calculated at period close,
                      approved by the Super Admin, and paid via manual bank
                      transfer (NEFT/RTGS/IMPS).
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 pr-3">Statement #</th>
                          <th className="py-2.5 px-3">Period</th>
                          <th className="py-2.5 px-3 text-right">
                            Net Eligible Revenue
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            Partner 50% Share
                          </th>
                          <th className="py-2.5 px-3 text-right">Paid</th>
                          <th className="py-2.5 px-3 text-right">
                            Outstanding Balance
                          </th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 pl-3">
                            Manual Transfer References
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(portalData?.settlements || []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="py-8 text-center text-slate-500"
                            >
                              No monthly settlement statements have been
                              generated for your account yet.
                            </td>
                          </tr>
                        ) : (
                          (portalData?.settlements || []).map((stl) => (
                            <tr key={stl.id} className="hover:bg-slate-50">
                              <td className="py-3 pr-3 font-mono font-bold text-slate-900">
                                {stl.statementNumber}
                              </td>
                              <td className="py-3 px-3 font-mono">
                                {stl.periodMonth}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                {formatCurrency(
                                  stl.netEligibleRevenue,
                                  stl.currency
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                                {formatCurrency(
                                  stl.partnerPayableAmount,
                                  stl.currency
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                {formatCurrency(
                                  stl.previouslyPaidAmount,
                                  stl.currency
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                                {formatCurrency(
                                  stl.outstandingPayableBalance,
                                  stl.currency
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                                    stl.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : stl.status === 'APPROVED'
                                        ? 'bg-blue-100 text-[#003B8E]'
                                        : 'bg-amber-100 text-amber-900'
                                  }`}
                                >
                                  {stl.status}
                                </span>
                              </td>
                              <td className="py-3 pl-3">
                                {stl.payments.length === 0 ? (
                                  <span className="text-slate-400">
                                    Awaiting bank transfer
                                  </span>
                                ) : (
                                  <div className="space-y-1">
                                    {stl.payments.map((p) => (
                                      <div
                                        key={p.id}
                                        className="font-mono text-[11px] text-slate-700"
                                      >
                                        {p.paymentMethod} UTR:{' '}
                                        <strong>
                                          {p.paymentReferenceNumber}
                                        </strong>{' '}
                                        ({p.paymentDate})
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
      </main>
    </div>
  );
}
