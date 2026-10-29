'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Coins,
  Handshake,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
} from 'lucide-react';
import { CURATED_CANONICAL_CITIES } from '@/lib/global-locations-data';
import { buildAuthenticatedHeaders } from '@/lib/firebase';
import { useUrbanDirect } from './urbandirect-provider';
import {
  writePartnerOnboardingContext,
  readPartnerOnboardingContext,
  PARTNER_OTP_ROUTE,
} from '@/lib/partner-onboarding-context';

function CityPartnerPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticatedUser, showToast } = useUrbanDirect();

  const [view, setView] = useState<'scheme' | 'application'>('scheme');
  const [fullName, setFullName] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('india-maharashtra-nanded');
  const [localGrowthPlan, setLocalGrowthPlan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      isOtpVerifiedQuery ||
      onboardingCtx?.verificationStep === 'PHONE_VERIFIED'
    ) {
      setView('application');
    }
  }, [authenticatedUser, searchParams]);

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

          <div className="flex items-center gap-2">
            {view === 'application' && (
              <button
                type="button"
                onClick={() => setView('scheme')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>View Scheme Details</span>
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
        {view === 'scheme' ? (
          /* =========================================================
             STEP 1: FULL SCHEME ELABORATION & ESTIMATED WEEKLY EARNINGS
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
             STEP 2: STREAMLINED PARTNER APPLICATION FORM
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
