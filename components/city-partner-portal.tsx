'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  Handshake,
  Landmark,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Loader2,
  Navigation,
} from 'lucide-react';
import { CURATED_CANONICAL_CITIES } from '@/lib/global-locations-data';
import { buildAuthenticatedHeaders } from '@/lib/firebase';
import { useUrbanDirect } from './urbandirect-provider';
import {
  writePartnerOnboardingContext,
  readPartnerOnboardingContext,
  PARTNER_OTP_ROUTE,
} from '@/lib/partner-onboarding-context';

interface PartnerConsoleData {
  partnerId: string;
  partnerCode: string;
  phoneE164: string;
  fullName: string;
  role: string;
  cityId: string;
  cityName: string;
  stateRegion: string;
  country: string;
  exclusivityModel: string;
  exclusivityStatus: string;
  revenueSharePct: number;
  platformRetainedSharePct: number;
  grossCityRevenue: number;
  netEligibleRevenue: number;
  totalEarned: number;
  unsettledBalance: number;
  activeMerchants: number;
  ordersThisMonth: number;
  nextSettlementDate: string;
  referralLink: string;
  kyc?: {
    status: string;
    bankAccountHolderName: string;
    bankAccountNumber: string;
    bankIfscOrRoutingCode: string;
    bankName: string;
  };
}

interface ApplicationData {
  id: string;
  referenceId?: string;
  fullName: string;
  cityName: string;
  cityId: string;
  status: string;
  submittedAt?: string;
  createdAt?: string;
}

function CityPartnerPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticatedUser, showToast } = useUrbanDirect();

  const [view, setView] = useState<'scheme' | 'application' | 'console'>('scheme');
  const [partnerData, setPartnerData] = useState<PartnerConsoleData | null>(null);
  const [pendingApplication, setPendingApplication] = useState<ApplicationData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(true);

  const [fullName, setFullName] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('india-maharashtra-mumbai');
  const [localGrowthPlan, setLocalGrowthPlan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [detectedPartnerStreetAddress, setDetectedPartnerStreetAddress] = useState<string>('');

  const handleDetectPartnerGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingGps(true);
    setErrorMessage(null);
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
            const street = data.streetAddress || data.formattedAddress || '';
            setDetectedPartnerStreetAddress(street);
            const matched = CURATED_CANONICAL_CITIES.find(
              (c) =>
                c.cityId === data.cityId ||
                c.cityName.toLowerCase() === String(data.city).toLowerCase()
            );
            if (matched) {
              setSelectedCityId(matched.cityId);
            } else if (data.cityId) {
              setSelectedCityId(data.cityId);
            }
          } else {
            setErrorMessage(
              data?.error ||
                'Could not auto-detect your city. Please select manually.'
            );
          }
        } catch {
          setErrorMessage('Network error while detecting GPS location.');
        } finally {
          setIsDetectingGps(false);
        }
      },
      (geoErr) => {
        setIsDetectingGps(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setErrorMessage(
            'Location permission was denied. Please allow location access or select your city manually.'
          );
        } else {
          setErrorMessage(
            'Unable to retrieve your GPS location. Please select manually.'
          );
        }
      },
      {enableHighAccuracy: true, timeout: 10000}
    );
  };

  const checkPartnerStatus = useCallback(async () => {
    setIsLoadingDashboard(true);
    try {
      const headers = await buildAuthenticatedHeaders();
      const res = await fetch('/api/partners/dashboard', { headers });
      const data = await res.json();

      if (res.ok && data.ok && data.approved && data.partner) {
        setPartnerData(data.partner);
        setPendingApplication(null);
        setView('console');
        return;
      }

      if (data.application) {
        setPendingApplication(data.application);
        if (data.application.status !== 'APPROVED') {
          setView('console');
        }
        return;
      }
    } catch {
      // Non-blocking dashboard check
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    checkPartnerStatus();
  }, [checkPartnerStatus]);

  useEffect(() => {
    const onboardingCtx = readPartnerOnboardingContext();
    const isOtpVerifiedQuery = searchParams?.get('otpVerified') === '1';

    if (onboardingCtx?.draftApplication) {
      if (
        onboardingCtx.draftApplication.fullLegalName &&
        onboardingCtx.draftApplication.fullLegalName !== 'City Partner Applicant'
      ) {
        setFullName(onboardingCtx.draftApplication.fullLegalName);
      }
      if (onboardingCtx.draftApplication.cityId) {
        setSelectedCityId(onboardingCtx.draftApplication.cityId);
      }
    }

    if (authenticatedUser) {
      if (
        authenticatedUser.fullName &&
        authenticatedUser.fullName !== 'City Partner Applicant' &&
        authenticatedUser.fullName !== 'Verified User'
      ) {
        setFullName(authenticatedUser.fullName);
      }
      if (authenticatedUser.phoneE164) {
        setPhoneE164(authenticatedUser.phoneE164);
      }
    } else if (onboardingCtx?.phoneE164) {
      setPhoneE164(onboardingCtx.phoneE164);
    }

    if (
      !partnerData &&
      !pendingApplication &&
      (isOtpVerifiedQuery || onboardingCtx?.verificationStep === 'PHONE_VERIFIED')
    ) {
      setView('application');
    }
  }, [authenticatedUser, searchParams, partnerData, pendingApplication]);

  const proceedToAuth = () => {
    const onboardingCtx = readPartnerOnboardingContext();
    const hasVerifiedPhone = Boolean(
      authenticatedUser?.phoneE164 ||
        (onboardingCtx?.verificationStep === 'PHONE_VERIFIED' &&
          onboardingCtx?.phoneE164)
    );

    if (!hasVerifiedPhone) {
      writePartnerOnboardingContext({
        registrationIntent: 'partner',
        verificationStep: 'PHONE_ENTRY',
        returnTab: 'apply',
      });
      router.push(PARTNER_OTP_ROUTE);
    } else {
      setView('application');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full legal name.');
      return;
    }
    if (!phoneE164.trim()) {
      setErrorMessage('Please verify your mobile number first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmissionSuccess(null);

    try {
      const headers = await buildAuthenticatedHeaders();
      const res = await fetch('/api/partners/applications', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneE164: phoneE164.trim(),
          cityId: selectedCityId,
          localGrowthPlan: localGrowthPlan.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && (data.ok || data.success)) {
        const cityObj = CURATED_CANONICAL_CITIES.find(
          (c) => c.cityId === selectedCityId
        );
        const msg = `Your City Partner application for ${cityObj?.cityName || selectedCityId} has been submitted for Super Admin review!`;
        setSubmissionSuccess(msg);
        showToast(msg);
        await checkPartnerStatus();
      } else {
        setErrorMessage(data.error || 'Failed to submit partner application.');
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Network error while submitting application.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawApplication = async (appId: string) => {
    try {
      const headers = await buildAuthenticatedHeaders();
      const res = await fetch('/api/partners/applications', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'WITHDRAW',
          applicationId: appId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast('Application withdrawn successfully.');
        setPendingApplication(null);
        setView('scheme');
      } else {
        showToast(data.error || 'Could not withdraw application.');
      }
    } catch {
      showToast('Network error while withdrawing application.');
    }
  };

  const handleCopyReferral = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedReferral(true);
      showToast('Partner referral link copied to clipboard!');
      setTimeout(() => setCopiedReferral(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Top Partner Portal Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
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
                  <span className="text-slate-500 font-semibold text-xs">.shop</span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold mt-0.5">
                  City Partner 50/50 Revenue Program
                </div>
              </div>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setView('scheme')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                view === 'scheme'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Scheme Details
            </button>

            {!partnerData && (
              <button
                type="button"
                onClick={() => setView('application')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  view === 'application'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Apply for City
              </button>
            )}

            {(partnerData || pendingApplication) && (
              <button
                type="button"
                onClick={() => setView('console')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                  view === 'console'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Partner Console</span>
                {partnerData && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {pendingApplication && !partnerData && (
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>
            )}

            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Storefront</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto py-8 px-4 sm:px-6 space-y-8">
        {view === 'console' ? (
          /* =========================================================
             VIEW MODE 3: CITY PARTNER CONSOLE & TERRITORY OPERATIONS
             ========================================================= */
          <div className="space-y-6">
            {partnerData ? (
              <>
                {/* Active City Partner Hero Card */}
                <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#064E3B] text-white rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Approved Exclusive Territory Partner</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-bold text-slate-200">
                        {partnerData.partnerCode}
                      </span>
                      <button
                        type="button"
                        onClick={checkPartnerStatus}
                        disabled={isLoadingDashboard}
                        title="Refresh Console Metrics"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDashboard ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                      {partnerData.fullName} ·{' '}
                      <span className="text-emerald-400">{partnerData.cityName} Territory Hub</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                      Exclusive City Partner for <strong>{partnerData.cityName}, {partnerData.stateRegion}</strong> ({partnerData.country}). You receive an automated 50% revenue share across all merchant subscriptions and customer order fees in this hub.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-emerald-200 font-semibold">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30">
                      <Handshake className="w-3.5 h-3.5 text-emerald-400" />
                      <span>50/50 Revenue Attribution Active</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>One City = One Exclusive Partner</span>
                    </span>
                  </div>
                </div>

                {/* 4 Financial & Operational Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                    <div className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      <span>Partner Earnings</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-700">
                      ₹{partnerData.totalEarned.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Next weekly payout: <strong>{partnerData.nextSettlementDate}</strong>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                    <div className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-[#003B8E]" />
                      <span>Net City Platform Revenue</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-slate-900">
                      ₹{partnerData.netEligibleRevenue.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Split: <strong>50% Partner</strong> / 50% CityKart
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                    <div className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-purple-600" />
                      <span>Active Stores</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-slate-900">
                      {partnerData.activeMerchants}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Stores onboarded in {partnerData.cityName}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
                    <div className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-amber-600" />
                      <span>City Orders</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-slate-900">
                      {partnerData.ordersThisMonth}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Local orders fulfilled this period
                    </div>
                  </div>
                </div>

                {/* Operations Grid: Merchant Onboarding & Referral Tooling */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Merchant Onboarding & Referral Link */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
                    <div className="space-y-1">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                        <Store className="w-4 h-4" />
                        <span>Merchant Growth &amp; Referral</span>
                      </div>
                      <h2 className="text-lg font-black text-slate-900">
                        Onboard Local Merchants in {partnerData.cityName}
                      </h2>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Share your dedicated partner onboarding link with neighborhood shop owners. Stores registered through your link are permanently attributed to your 50/50 territory share.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Your Exclusive Merchant Referral Link
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={partnerData.referralLink}
                          className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyReferral(partnerData.referralLink)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedReferral ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/seller?refPartner=${encodeURIComponent(partnerData.partnerId)}`}
                        className="px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>Open Store Onboarding Portal</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Right: Bank Payout & Settlement KYC Summary */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
                    <div className="space-y-1">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                        <Landmark className="w-4 h-4" />
                        <span>Direct Bank &amp; UPI Settlement</span>
                      </div>
                      <h2 className="text-lg font-black text-slate-900">
                        Weekly Automated Payouts
                      </h2>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Your 50% territory revenue is settled weekly directly into your verified bank account via NEFT / RTGS.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Bank Name:</span>
                        <strong className="text-slate-900 font-semibold">
                          {partnerData.kyc?.bankName || 'State Bank of India'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Account Number:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {partnerData.kyc?.bankAccountNumber || 'XXXX4416'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">IFSC / Branch:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {partnerData.kyc?.bankIfscOrRoutingCode || 'SBIN0001234'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-500 font-medium">KYC Verification Status:</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>{partnerData.kyc?.status || 'VERIFIED'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-[#003B8E] shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        Need to update your bank payout details or tax residency documentation? Contact Super Admin at{' '}
                        <strong>anilkadam4444@gmail.com</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : pendingApplication ? (
              /* Pending Application Tracker Card */
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 max-w-2xl mx-auto">
                <div className="space-y-1.5 border-b border-slate-100 pb-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Application Status · {pendingApplication.status}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    City Partner Application Under Review
                  </h2>
                  <p className="text-xs text-slate-600">
                    Your application for the <strong>{pendingApplication.cityName}</strong> territory has been submitted and is currently being reviewed by Citykart Super Admin.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Applicant Name:</span>
                    <strong className="text-slate-900">{pendingApplication.fullName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Target Territory:</span>
                    <strong className="text-slate-900">{pendingApplication.cityName}</strong>
                  </div>
                  {pendingApplication.referenceId && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Reference ID:</span>
                      <span className="font-mono font-bold text-[#003B8E]">
                        {pendingApplication.referenceId}
                      </span>
                    </div>
                  )}
                  {pendingApplication.submittedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Submitted At:</span>
                      <span className="text-slate-700">
                        {new Date(pendingApplication.submittedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={checkPartnerStatus}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Review Status</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleWithdrawApplication(pendingApplication.id)}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Withdraw Application
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : view === 'scheme' ? (
          /* =========================================================
             VIEW MODE 1: FULL SCHEME ELABORATION & EARNINGS BREAKDOWN
             ========================================================= */
          <div className="space-y-6">
            {/* Hero Scheme Card */}
            <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#064E3B] text-white rounded-3xl p-6 sm:p-10 shadow-lg space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <Handshake className="w-4 h-4" />
                <span>Exclusive Territory City Partner Scheme</span>
              </div>

              <div className="space-y-3 max-w-3xl">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                  Become a Citykart Partner:{' '}
                  <span className="text-emerald-400">50/50 Revenue Share</span> in Your City
                </h1>
                <p className="text-xs sm:text-base text-slate-200 leading-relaxed">
                  Lead local merchant onboarding and neighborhood commerce growth in your canonical city. As an approved City Partner, you receive a transparent, automated <strong>50% share of net platform revenue</strong> generated across every active store in your assigned city.
                </p>
              </div>

              {/* 3 Pillars of the 50/50 Scheme */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-white/10 border border-white/15 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                    <Coins className="w-4 h-4" />
                    <span>1. Order Platform Fees</span>
                  </div>
                  <div className="text-lg font-black text-white">50% Partner Share</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Earn 50% of the platform fee collected on every completed buyer order fulfilled by local stores in your city.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/10 border border-white/15 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                    <Store className="w-4 h-4" />
                    <span>2. Merchant Subscriptions</span>
                  </div>
                  <div className="text-lg font-black text-white">50% Recurring Split</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Receive 50% of monthly &amp; annual Growth and Enterprise store subscription plans purchased by merchants in your city.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/10 border border-white/15 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    <span>3. Sponsored Placements</span>
                  </div>
                  <div className="text-lg font-black text-white">50% Ad Attribution</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Get 50% of local Featured Store and Sponsored Product ad campaign revenue booked within your city hub.
                  </p>
                </div>
              </div>
            </div>

            {/* Estimated Weekly Earnings Breakdown */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    <span>Partner Earnings Projection</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    Estimated Weekly Earnings Breakdown
                  </h2>
                </div>
                <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 font-mono">
                  Weekly Direct Bank / UPI Payouts
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase">
                    Tier 1 · Emerging Town (25–50 Stores)
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    ₹6,500 – ₹12,000
                    <span className="text-xs font-sans font-semibold text-slate-500"> / week</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Based on ~150 daily city orders + 25 active local kirana, pharmacy, and bakery merchants.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-500/40 space-y-2 relative">
                  <div className="text-xs font-extrabold text-emerald-800 uppercase">
                    Tier 2 · District Hub (75–150 Stores)
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-950">
                    ₹15,000 – ₹28,000
                    <span className="text-xs font-sans font-semibold text-emerald-700"> / week</span>
                  </div>
                  <p className="text-xs text-emerald-900/80 leading-relaxed">
                    Based on ~450 daily city orders + merchant Pro subscriptions and local featured store campaigns.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase">
                    Tier 3 · Metro City (250+ Stores)
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    ₹35,000 – ₹65,000+
                    <span className="text-xs font-sans font-semibold text-slate-500"> / week</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    High-volume intra-city marketplace activity across all 25 retail categories with recurring ad spend.
                  </p>
                </div>
              </div>

              {/* How Onboarding Works (Single-Pass Verification) */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#003B8E] shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <div className="font-bold text-slate-900">
                      Streamlined 2-Step Onboarding (No Duplicate Data Entry)
                    </div>
                    <p>
                      Step 1: Verify your mobile number via 6-digit OTP. Step 2: Select your target city and enter your legal name once to submit for Super Admin approval.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={proceedToAuth}
                  data-testid="proceed-to-partner-auth-btn"
                  className="w-full sm:w-auto shrink-0 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <span>Proceed to Authentication and Application</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             VIEW MODE 2: STREAMLINED PARTNER APPLICATION FORM
             (Phone already verified via OTP — asks Name & City only once)
             ========================================================= */
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 max-w-2xl mx-auto">
            <div className="space-y-1.5 border-b border-slate-100 pb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Step 2 of 2 · Mobile Identity Verified</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Complete Your City Partner Application
              </h2>
              <p className="text-xs text-slate-600">
                Your mobile number is verified. Provide your full legal name and select the canonical city you wish to manage under the 50/50 revenue share program.
              </p>
            </div>

            {submissionSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div>{submissionSuccess}</div>
                  <div className="text-[11px] text-emerald-800 font-normal">
                    Status: <strong className="font-mono">PENDING_REVIEW</strong>. Once approved by the Super Admin, your 50/50 City Partner Console will activate automatically.
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Verified Mobile Number (Read-Only Badge — Not asked twice!) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      OTP-Verified Partner Mobile
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900">
                      {phoneE164 || 'Not verified'}
                    </div>
                  </div>
                </div>
                <Link
                  href="/partner/verify-otp?changePhone=1"
                  className="text-xs font-bold text-[#003B8E] hover:underline"
                >
                  Change Phone
                </Link>
              </div>

              <div>
                <label
                  htmlFor="partner-legal-name"
                  className="text-xs font-bold text-slate-700 block mb-1.5"
                >
                  Full Legal Name *
                </label>
                <input
                  id="partner-legal-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full legal name as per PAN / ID"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>

              {/* Explicit Partner Location Permission Request Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-slate-800 space-y-2.5 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      City Territory Location Permission Requested
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                      Allow location access to auto-detect your current canonical city and auto-select your 50/50 revenue attribution territory.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDetectPartnerGps}
                  disabled={isDetectingGps}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isDetectingGps ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Detecting Territory &amp; Precise Address...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Allow Location Permission &amp; Auto-Detect Territory</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <label
                  htmlFor="partner-target-city"
                  className="text-xs font-bold text-slate-700 block mb-1.5"
                >
                  Target Canonical City (50/50 Territory) *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="partner-target-city"
                    value={selectedCityId}
                    onChange={(e) => setSelectedCityId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    {CURATED_CANONICAL_CITIES.map((c) => (
                      <option key={c.cityId} value={c.cityId}>
                        {c.cityName}, {c.stateRegion} ({c.country})
                      </option>
                    ))}
                  </select>
                </div>
                {detectedPartnerStreetAddress && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-mono">
                    <strong className="text-emerald-900 font-sans">Precise GPS Address Detected:</strong> {detectedPartnerStreetAddress}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="partner-growth-plan"
                  className="text-xs font-bold text-slate-700 block mb-1.5"
                >
                  Local Merchant Onboarding Experience (Optional)
                </label>
                <textarea
                  id="partner-growth-plan"
                  rows={3}
                  value={localGrowthPlan}
                  onChange={(e) => setLocalGrowthPlan(e.target.value)}
                  placeholder="Briefly share your local network or plan to onboard retail stores in your city..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-sm shadow-sm transition-colors cursor-pointer"
              >
                {isSubmitting
                  ? 'Submitting Partner Application...'
                  : 'Submit City Partner Application'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export function CityPartnerPortal() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-slate-600 text-sm font-semibold">
          Loading City Partner Portal...
        </div>
      }
    >
      <CityPartnerPortalContent />
    </Suspense>
  );
}

