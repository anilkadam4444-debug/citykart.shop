'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Handshake,
  Landmark,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/catalog-data';
import {
  getAllCountries,
  getCitiesByCountryAndRegion,
  getRegionsByCountry,
} from '@/lib/location-service';
import {
  CityPartnerAllocationRecord,
  CityPartnerRecord,
  CityRevenueAttributionSummary,
  PartnerApplicationRecord,
  PartnerApplicationStatus,
  PartnerMonthlySettlementRecord,
} from '@/lib/partner-program';

interface AdminPartnersPayload {
  ok: boolean;
  isSuperAdmin: boolean;
  applications: PartnerApplicationRecord[];
  partners: CityPartnerRecord[];
  allocations: CityPartnerAllocationRecord[];
  settlements: PartnerMonthlySettlementRecord[];
  cityRevenueByPartnerId: Record<string, CityRevenueAttributionSummary>;
  cityPerformanceByPartnerId: Record<
    string,
    {
      storesCount: number;
      activeStoresCount: number;
      ordersCount: number;
      deliveredOrdersCount: number;
    }
  >;
}

export function AdminPartnerManagement({
  isSuperAdmin,
  onActionCompleted,
}: {
  isSuperAdmin: boolean;
  onActionCompleted?: (message: string) => void;
}) {
  const [subTab, setSubTab] = useState<
    'applications' | 'active-partners' | 'settlements'
  >('applications');
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AdminPartnersPayload | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Filters for Applications
  const [appSearch, setAppSearch] = useState<string>('');
  const [appStatusFilter, setAppStatusFilter] = useState<
    'ALL' | PartnerApplicationStatus
  >('ALL');
  const [appCityFilter, setAppCityFilter] = useState<string>('ALL');
  const [appDateFilter, setAppDateFilter] = useState<string>('');

  // Inspected Application Modal
  const [inspectedAppId, setInspectedAppId] = useState<string | null>(null);
  const [reviewActionNote, setReviewActionNote] = useState<string>('');
  const [markKycVerifiedOnApprove, setMarkKycVerifiedOnApprove] =
    useState<boolean>(true);

  // Active Partner Action Modal (Suspend / Deactivate / Reactivate / Reassign City)
  const [partnerModal, setPartnerModal] = useState<{
    partner: CityPartnerRecord;
    mode: 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE' | 'REASSIGN_CITY';
  } | null>(null);
  const [partnerActionReason, setPartnerActionReason] = useState<string>('');
  const countries = useMemo(() => getAllCountries(), []);
  const [reassignCountryCode, setReassignCountryCode] = useState<string>('IN');
  const reassignRegions = useMemo(
    () => getRegionsByCountry(reassignCountryCode),
    [reassignCountryCode]
  );
  const [reassignStateRegion, setReassignStateRegion] =
    useState<string>('Maharashtra');
  const reassignCities = useMemo(
    () =>
      getCitiesByCountryAndRegion(reassignCountryCode, reassignStateRegion),
    [reassignCountryCode, reassignStateRegion]
  );
  const [reassignCityId, setReassignCityId] = useState<string>(
    'india-maharashtra-pune'
  );

  // Monthly Settlement Generation & Manual Payout Modals
  const [genPartnerId, setGenPartnerId] = useState<string>('');
  const [genPeriodMonth, setGenPeriodMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [genDeductions, setGenDeductions] = useState<string>('0');
  const [genDeductionNotes, setGenDeductionNotes] = useState<string>('');

  const [payoutModalSettlement, setPayoutModalSettlement] =
    useState<PartnerMonthlySettlementRecord | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutDate, setPayoutDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [payoutMethod, setPayoutMethod] = useState<
    'NEFT' | 'RTGS' | 'IMPS' | 'BANK_TRANSFER'
  >('NEFT');
  const [payoutReferenceNumber, setPayoutReferenceNumber] =
    useState<string>('');
  const [payoutNotes, setPayoutNotes] = useState<string>('');
  const [payoutProofUrl, setPayoutProofUrl] = useState<string>('');

  // Dedicated Direct City Partner Onboarding Architecture State
  const [isDirectOnboardModalOpen, setIsDirectOnboardModalOpen] =
    useState<boolean>(false);
  const [directFullName, setDirectFullName] = useState<string>('');
  const [directCountryDialCode, setDirectCountryDialCode] =
    useState<string>('+91');
  const [directPhoneSubscriber, setDirectPhoneSubscriber] =
    useState<string>('');
  const [directEmail, setDirectEmail] = useState<string>('');
  const [directAddress, setDirectAddress] = useState<string>('');
  const [directCountryCode, setDirectCountryCode] = useState<string>('IN');
  const directRegions = useMemo(
    () => getRegionsByCountry(directCountryCode),
    [directCountryCode]
  );
  const [directStateRegion, setDirectStateRegion] =
    useState<string>('Maharashtra');
  const directCities = useMemo(
    () =>
      getCitiesByCountryAndRegion(directCountryCode, directStateRegion),
    [directCountryCode, directStateRegion]
  );
  const [directCityId, setDirectCityId] = useState<string>(
    'india-maharashtra-pune'
  );
  const [directDistrict, setDirectDistrict] = useState<string>('');
  const [directPostalCode, setDirectPostalCode] = useState<string>('');
  const [directPanOrTaxId, setDirectPanOrTaxId] = useState<string>('');
  const [directBankAccountHolderName, setDirectBankAccountHolderName] =
    useState<string>('');
  const [directBankAccountNumber, setDirectBankAccountNumber] =
    useState<string>('');
  const [directBankIfsc, setDirectBankIfsc] = useState<string>('');
  const [directBankName, setDirectBankName] = useState<string>(
    'State Bank of India'
  );
  const [directNotes, setDirectNotes] = useState<string>('');
  const [directAgreeTerms, setDirectAgreeTerms] = useState<boolean>(true);
  const [directCityChecking, setDirectCityChecking] = useState<boolean>(false);
  const [directCityAvailability, setDirectCityAvailability] = useState<{
    isAvailable: boolean;
    activePartnerName?: string;
  } | null>(null);

  const fetchPartnersData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/partners', { cache: 'no-store' });
      const json = await res.json();
      if (json?.ok) {
        setData(json as AdminPartnersPayload);
        setGenPartnerId((prev) =>
          !prev && json.partners?.length > 0 ? json.partners[0].id : prev
        );
      }
    } catch {
      // Ignore network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPartnersData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPartnersData]);

  const executePartnerAdminAction = async (
    payload: Record<string, unknown>,
    successMsg?: string
  ): Promise<boolean> => {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setActionError(json?.error || 'Failed to execute partner action.');
        return false;
      }
      await fetchPartnersData();
      if (onActionCompleted) {
        onActionCompleted(successMsg || json.message || 'Partner updated.');
      }
      return true;
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Network error executing action.'
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Live availability check when selected city changes in Direct Onboarding modal
  useEffect(() => {
    if (!directCityId || !isDirectOnboardModalOpen) {
      return;
    }
    let cancelled = false;
    const fetchCityAvailability = async () => {
      try {
        setDirectCityChecking(true);
        const res = await fetch(
          `/api/admin/partners?checkCityAvailability=${encodeURIComponent(directCityId)}`
        );
        const resData = await res.json();
        if (!cancelled && resData?.ok && resData.availability) {
          setDirectCityAvailability({
            isAvailable: Boolean(resData.availability.isAvailable),
            activePartnerName: resData.availability.activePartnerName,
          });
        }
      } catch {
        // Ignore network check errors
      } finally {
        if (!cancelled) setDirectCityChecking(false);
      }
    };
    void fetchCityAvailability();
    return () => {
      cancelled = true;
    };
  }, [directCityId, isDirectOnboardModalOpen]);

  const handleDirectOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directAgreeTerms) {
      setActionError(
        'Please confirm the 50/50 net eligible revenue share agreement.'
      );
      return;
    }
    const cleanSubscriber = directPhoneSubscriber.replace(/[^0-9]/g, '');
    if (cleanSubscriber.length < 8) {
      setActionError(
        'Please enter a valid mobile number with at least 8 digits.'
      );
      return;
    }
    const phoneE164 = `${directCountryDialCode}${cleanSubscriber}`;
    const selectedCity = directCities.find((c) => c.cityId === directCityId);

    const ok = await executePartnerAdminAction(
      {
        action: 'DIRECT_ONBOARD_PARTNER',
        partnerFullName: directFullName.trim(),
        phoneE164,
        email: directEmail.trim(),
        residentialOrBusinessAddress: directAddress.trim(),
        countryCode: directCountryCode,
        stateRegion: directStateRegion,
        cityId: directCityId,
        cityName: selectedCity?.cityName,
        district: directDistrict.trim() || selectedCity?.district,
        postalCode: directPostalCode.trim() || '400001',
        panOrTaxId: directPanOrTaxId.trim().toUpperCase(),
        bankAccountHolderName:
          directBankAccountHolderName.trim() || directFullName.trim(),
        bankAccountNumber: directBankAccountNumber.trim(),
        bankIfscOrRoutingCode: directBankIfsc.trim().toUpperCase(),
        bankName: directBankName.trim(),
        notes:
          directNotes.trim() ||
          'Direct onboarding authorized by Super Admin.',
      },
      `Successfully onboarded ${directFullName} as City Partner for ${selectedCity?.cityName || directCityId}.`
    );

    if (ok) {
      setIsDirectOnboardModalOpen(false);
      setDirectFullName('');
      setDirectPhoneSubscriber('');
      setDirectEmail('');
      setDirectAddress('');
      setDirectPostalCode('');
      setDirectPanOrTaxId('');
      setDirectBankAccountHolderName('');
      setDirectBankAccountNumber('');
      setDirectBankIfsc('');
      setDirectNotes('');
    }
  };

  const applications = useMemo(() => data?.applications || [], [data?.applications]);
  const partners = useMemo(() => data?.partners || [], [data?.partners]);
  const settlements = useMemo(() => data?.settlements || [], [data?.settlements]);

  const distinctApplicationCities = useMemo(() => {
    const map = new Map<string, string>();
    applications.forEach((a) => {
      map.set(a.cityId, `${a.cityName}, ${a.stateRegion}`);
    });
    return Array.from(map.entries());
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (appStatusFilter !== 'ALL' && app.status !== appStatusFilter) {
        return false;
      }
      if (appCityFilter !== 'ALL' && app.cityId !== appCityFilter) {
        return false;
      }
      if (
        appDateFilter &&
        !app.submittedAt.startsWith(appDateFilter)
      ) {
        return false;
      }
      if (appSearch.trim()) {
        const q = appSearch.trim().toLowerCase();
        const matchName = app.fullLegalName.toLowerCase().includes(q);
        const matchRef = app.referenceId.toLowerCase().includes(q);
        const matchPhone = app.phoneE164.toLowerCase().includes(q);
        const matchCity = app.cityName.toLowerCase().includes(q);
        return matchName || matchRef || matchPhone || matchCity;
      }
      return true;
    });
  }, [
    applications,
    appStatusFilter,
    appCityFilter,
    appDateFilter,
    appSearch,
  ]);

  const inspectedApp = useMemo(
    () => applications.find((a) => a.id === inspectedAppId) || null,
    [applications, inspectedAppId]
  );

  const pendingAppsCount = useMemo(
    () =>
      applications.filter(
        (a) =>
          a.status === 'pending_review' ||
          a.status === 'additional_information_required'
      ).length,
    [applications]
  );

  const activePartnersCount = useMemo(
    () => partners.filter((p) => p.status === 'ACTIVE').length,
    [partners]
  );

  return (
    <div className="space-y-6">
      {/* Top Summary Banner & Sub-Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#003B8E] text-white flex items-center justify-center shrink-0">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                City Partner Program Governance &amp; 50/50 Revenue Settlements
              </h2>
              <p className="text-xs text-slate-500">
                Review partner applications, verify KYC, atomically allocate
                exclusive cities, and record monthly manual bank settlements.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsDirectOnboardModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <UserPlus className="w-4 h-4 text-amber-300" />
                <span>Direct Onboard Partner</span>
              </button>
            )}
            <button
              type="button"
              onClick={fetchPartnersData}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Pending Applications</div>
            <div className="text-xl font-extrabold font-mono tabular-nums text-[#F96302] mt-1">
              {pendingAppsCount}{' '}
              <span className="text-xs text-slate-400">
                / {applications.length} total
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Active City Partners</div>
            <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-700 mt-1">
              {activePartnersCount}{' '}
              <span className="text-xs text-slate-400">
                / {partners.length} total
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Revenue Split Policy</div>
            <div className="text-xl font-extrabold font-mono tabular-nums text-[#003B8E] mt-1">
              50% / 50%
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Monthly Settlement Statements</div>
            <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900 mt-1">
              {settlements.length}
            </div>
          </div>
        </div>

        {/* Sub-Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSubTab('applications')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              subTab === 'applications'
                ? 'bg-[#003B8E] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Partner Applications ({applications.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('active-partners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              subTab === 'active-partners'
                ? 'bg-[#003B8E] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Active Partners &amp; City Allocations ({partners.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('settlements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              subTab === 'settlements'
                ? 'bg-[#003B8E] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Monthly Settlements &amp; Manual Payouts ({settlements.length})
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ====================================================================
          SUB-TAB 1: PARTNER APPLICATION MANAGEMENT
         ==================================================================== */}
      {subTab === 'applications' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search applicant name, CKP ref, phone..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
              />
            </div>

            <select
              value={appStatusFilter}
              onChange={(e) =>
                setAppStatusFilter(
                  e.target.value as 'ALL' | PartnerApplicationStatus
                )
              }
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
            >
              <option value="ALL">All Statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="additional_information_required">
                Additional Info Required
              </option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>

            <select
              value={appCityFilter}
              onChange={(e) => setAppCityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
            >
              <option value="ALL">All Requested Cities</option>
              {distinctApplicationCities.map(([cId, cLabel]) => (
                <option key={cId} value={cId}>
                  {cLabel} ({cId})
                </option>
              ))}
            </select>

            <input
              type="date"
              value={appDateFilter}
              onChange={(e) => setAppDateFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3">Ref ID</th>
                  <th className="py-2.5 px-3">Applicant &amp; Mobile</th>
                  <th className="py-2.5 px-3">Requested Canonical City</th>
                  <th className="py-2.5 px-3">KYC Status</th>
                  <th className="py-2.5 px-3">Submitted</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-slate-500"
                    >
                      No partner applications match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-3 font-mono font-bold text-[#003B8E]">
                        {app.referenceId}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {app.fullLegalName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {app.phoneE164} · OTP:{' '}
                          {app.otpVerified ? 'Verified' : 'Pending'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {app.cityName}, {app.stateRegion}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {app.cityId}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {app.kyc.kycVerificationStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {app.submittedAt.slice(0, 10)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            app.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-900'
                              : app.status === 'rejected' ||
                                  app.status === 'withdrawn'
                                ? 'bg-rose-100 text-rose-900'
                                : app.status ===
                                    'additional_information_required'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-blue-100 text-[#003B8E]'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedAppId(app.id);
                            setReviewActionNote('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#003B8E] text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect &amp; Review</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          SUB-TAB 2: ACTIVE PARTNERS & CITY ALLOCATIONS
         ==================================================================== */}
      {subTab === 'active-partners' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3">Partner</th>
                  <th className="py-2.5 px-3">Assigned Canonical City</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">City Performance</th>
                  <th className="py-2.5 px-3 text-right">
                    Net Eligible Revenue
                  </th>
                  <th className="py-2.5 px-3 text-right">Partner 50% Share</th>
                  <th className="py-2.5 pl-3 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-slate-500"
                    >
                      No approved City Partners yet. Approve a pending
                      application in the Partner Applications tab to allocate a
                      city.
                    </td>
                  </tr>
                ) : (
                  partners.map((p) => {
                    const perf = data?.cityPerformanceByPartnerId?.[p.id];
                    const rev = data?.cityRevenueByPartnerId?.[p.id];
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-3">
                          <div className="font-bold text-slate-900">
                            {p.fullName}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {p.phoneE164} · Ref: {p.applicationReferenceId}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">
                            {p.assignedCityName}, {p.assignedStateRegion}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {p.assignedCityId} · Activated{' '}
                            {p.activatedAt.slice(0, 10)}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-900'
                                : p.status === 'SUSPENDED'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-rose-100 text-rose-900'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <div>
                            {perf?.activeStoresCount ?? 0} stores ·{' '}
                            {perf?.deliveredOrdersCount ?? 0} delivered orders
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatCurrency(rev?.netEligibleRevenue || 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                          {formatCurrency(rev?.partnerShareAmount || 0)}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          {isSuperAdmin && (
                            <div className="inline-flex items-center gap-1.5">
                              {p.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPartnerModal({
                                      partner: p,
                                      mode: 'SUSPEND',
                                    });
                                    setPartnerActionReason('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-bold cursor-pointer"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPartnerModal({
                                      partner: p,
                                      mode: 'REACTIVATE',
                                    });
                                    setPartnerActionReason('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 font-bold cursor-pointer"
                                >
                                  Reactivate
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setPartnerModal({
                                    partner: p,
                                    mode: 'REASSIGN_CITY',
                                  });
                                  setPartnerActionReason('');
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold cursor-pointer"
                              >
                                Reassign City
                              </button>
                              {p.status !== 'DEACTIVATED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPartnerModal({
                                      partner: p,
                                      mode: 'DEACTIVATE',
                                    });
                                    setPartnerActionReason('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-rose-300 bg-rose-50 text-rose-900 font-bold cursor-pointer"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          SUB-TAB 3: MONTHLY SETTLEMENTS & MANUAL BANK PAYOUTS
         ==================================================================== */}
      {subTab === 'settlements' && (
        <div className="space-y-6">
          {/* Generate Monthly Settlement Card */}
          {isSuperAdmin && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900">
                Generate Monthly Partner Settlement Statement
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs items-end">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Active Partner
                  </label>
                  <select
                    value={genPartnerId}
                    onChange={(e) => setGenPartnerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                  >
                    <option value="">Select partner...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} — {p.assignedCityName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Period Month (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    value={genPeriodMonth}
                    onChange={(e) => setGenPeriodMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Agreed Deductions (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={genDeductions}
                    onChange={(e) => setGenDeductions(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Deduction Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={genDeductionNotes}
                    onChange={(e) => setGenDeductionNotes(e.target.value)}
                    placeholder="e.g. Adjustment note"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    disabled={submitting || !genPartnerId || !genPeriodMonth}
                    onClick={() =>
                      executePartnerAdminAction({
                        action: 'GENERATE_MONTHLY_SETTLEMENT',
                        partnerId: genPartnerId,
                        periodMonth: genPeriodMonth,
                        agreedDeductions: Number(genDeductions) || 0,
                        deductionNotes: genDeductionNotes,
                      })
                    }
                    className="w-full py-2.5 px-4 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] disabled:opacity-50 text-white font-bold cursor-pointer"
                  >
                    Generate Statement
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settlements Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3">Statement #</th>
                    <th className="py-2.5 px-3">Partner &amp; City</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3 text-right">
                      Net Eligible Revenue
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      Partner 50% Share
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      Citykart 50% Retained
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      Outstanding Payable
                    </th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 pl-3 text-right">
                      Settlement &amp; Manual Payout Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settlements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-8 text-center text-slate-500"
                      >
                        No monthly settlement statements generated yet.
                      </td>
                    </tr>
                  ) : (
                    settlements.map((stl) => (
                      <tr key={stl.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-3 font-mono font-bold text-slate-900">
                          {stl.statementNumber}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">
                            {stl.partnerName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {stl.assignedCityName} ({stl.assignedCityId})
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {stl.periodMonth}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {formatCurrency(stl.netEligibleRevenue, stl.currency)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                          {formatCurrency(
                            stl.partnerPayableAmount,
                            stl.currency
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-700">
                          {formatCurrency(
                            stl.citykartRetainedAmount,
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
                        <td className="py-3 pl-3 text-right">
                          {isSuperAdmin && (
                            <div className="inline-flex items-center gap-1.5">
                              {stl.status === 'PENDING_APPROVAL' && (
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() =>
                                    executePartnerAdminAction({
                                      action: 'APPROVE_SETTLEMENT',
                                      settlementId: stl.id,
                                    })
                                  }
                                  className="px-3 py-1 rounded-lg bg-[#003B8E] text-white font-bold cursor-pointer"
                                >
                                  Approve Statement
                                </button>
                              )}
                              {stl.status === 'APPROVED' &&
                                stl.outstandingPayableBalance > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayoutModalSettlement(stl);
                                      setPayoutAmount(
                                        String(stl.outstandingPayableBalance)
                                      );
                                      setPayoutReferenceNumber('');
                                      setPayoutNotes('');
                                      setPayoutProofUrl('');
                                    }}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                                  >
                                    Record Manual Bank Transfer
                                  </button>
                                )}
                              {stl.status === 'PAID' &&
                                stl.payments.length > 0 && (
                                  <span className="font-mono text-[11px] text-emerald-700 font-bold">
                                    UTR: {stl.payments[0].paymentReferenceNumber}
                                  </span>
                                )}
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
        </div>
      )}

      {/* ====================================================================
          MODAL 1: INSPECT APPLICATION & RESTRICTED KYC REVIEW + APPROVE/REJECT
         ==================================================================== */}
      {inspectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#003B8E] font-bold">
                  Restricted Super Admin KYC &amp; Application Review ·{' '}
                  {inspectedApp.referenceId}
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                  {inspectedApp.fullLegalName} — {inspectedApp.cityName},{' '}
                  {inspectedApp.stateRegion}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedAppId(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-extrabold text-slate-900 uppercase">
                  Applicant &amp; Canonical Location
                </div>
                <div>
                  <strong>Mobile (OTP Verified):</strong>{' '}
                  <span className="font-mono">{inspectedApp.phoneE164}</span>
                </div>
                <div>
                  <strong>Email:</strong> {inspectedApp.email || '—'}
                </div>
                <div>
                  <strong>Address:</strong>{' '}
                  {inspectedApp.residentialOrBusinessAddress} (PIN:{' '}
                  {inspectedApp.postalCode})
                </div>
                <div>
                  <strong>Canonical City ID:</strong>{' '}
                  <code className="font-mono font-bold text-[#003B8E]">
                    {inspectedApp.cityId}
                  </code>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5">
                <div className="font-extrabold text-slate-900 uppercase flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#003B8E]" />
                  <span>Restricted KYC &amp; Bank Payout Details</span>
                </div>
                <div>
                  <strong>Identity Doc:</strong>{' '}
                  {inspectedApp.kyc.identityDocType} —{' '}
                  <span className="font-mono font-bold">
                    {inspectedApp.kyc.identityDocNumber}
                  </span>
                </div>
                <div>
                  <strong>PAN / Tax ID:</strong>{' '}
                  <span className="font-mono font-bold">
                    {inspectedApp.kyc.panOrTaxId}
                  </span>
                </div>
                <div>
                  <strong>Address Proof:</strong>{' '}
                  {inspectedApp.kyc.addressProofType}
                </div>
                <div>
                  <strong>Bank Account:</strong> {inspectedApp.kyc.bankName} ·{' '}
                  <span className="font-mono font-bold">
                    {inspectedApp.kyc.bankAccountNumber}
                  </span>{' '}
                  (IFSC:{' '}
                  <span className="font-mono font-bold">
                    {inspectedApp.kyc.bankIfscOrRoutingCode}
                  </span>
                  )
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-800 mb-1">
                  Business / Marketing Experience:
                </div>
                <p className="text-slate-600">
                  {inspectedApp.relevantExperience}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-800 mb-1">
                  Local City Growth Plan:
                </div>
                <p className="text-slate-600">{inspectedApp.localGrowthPlan}</p>
              </div>
            </div>

            {inspectedApp.applicantAdditionalResponse && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <div className="font-bold text-emerald-950">
                  Applicant Additional Info Response:
                </div>
                <p className="text-emerald-900 mt-0.5">
                  {inspectedApp.applicantAdditionalResponse}
                </p>
              </div>
            )}

            {isSuperAdmin &&
              (inspectedApp.status === 'pending_review' ||
                inspectedApp.status === 'additional_information_required') && (
                <div className="space-y-4 pt-3 border-t border-slate-200 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Review Note / Rejection Reason / Additional Info Prompt
                    </label>
                    <textarea
                      rows={2}
                      value={reviewActionNote}
                      onChange={(e) => setReviewActionNote(e.target.value)}
                      placeholder="Enter review notes, reason for rejection, or specific additional information needed..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markKycVerifiedOnApprove}
                      onChange={(e) =>
                        setMarkKycVerifiedOnApprove(e.target.checked)
                      }
                    />
                    <span className="font-semibold text-slate-800">
                      Mark KYC &amp; Bank Payout Details as VERIFIED upon
                      approval
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={async () => {
                        if (!reviewActionNote.trim()) {
                          setActionError(
                            'Please specify what additional information is required.'
                          );
                          return;
                        }
                        const ok = await executePartnerAdminAction({
                          action: 'REQUEST_ADDITIONAL_INFO',
                          applicationId: inspectedApp.id,
                          prompt: reviewActionNote.trim(),
                        });
                        if (ok) setInspectedAppId(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold cursor-pointer"
                    >
                      Request Additional Info
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={async () => {
                        if (!reviewActionNote.trim()) {
                          setActionError(
                            'A recorded rejection reason is required.'
                          );
                          return;
                        }
                        const ok = await executePartnerAdminAction({
                          action: 'REJECT_APPLICATION',
                          applicationId: inspectedApp.id,
                          reason: reviewActionNote.trim(),
                        });
                        if (ok) setInspectedAppId(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                    >
                      Reject Application
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={async () => {
                        const ok = await executePartnerAdminAction({
                          action: 'APPROVE_APPLICATION',
                          applicationId: inspectedApp.id,
                          markKycVerified: markKycVerifiedOnApprove,
                          reviewNotes:
                            reviewActionNote.trim() ||
                            `Approved and allocated ${inspectedApp.cityName} (${inspectedApp.cityId}).`,
                        });
                        if (ok) setInspectedAppId(null);
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                    >
                      Approve &amp; Allocate {inspectedApp.cityName}
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: PARTNER LIFECYCLE & AUDITED CITY REASSIGNMENT
         ==================================================================== */}
      {partnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {partnerModal.mode.replace(/_/g, ' ')} —{' '}
                {partnerModal.partner.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setPartnerModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {partnerModal.mode === 'REASSIGN_CITY' && (
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Country
                  </label>
                  <select
                    value={reassignCountryCode}
                    onChange={(e) => setReassignCountryCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    State / Province
                  </label>
                  <select
                    value={reassignStateRegion}
                    onChange={(e) => setReassignStateRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
                  >
                    {reassignRegions.map((r) => (
                      <option key={r.code} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    New Canonical City
                  </label>
                  <select
                    value={reassignCityId}
                    onChange={(e) => setReassignCityId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
                  >
                    {reassignCities.map((c) => (
                      <option key={c.cityId} value={c.cityId}>
                        {c.cityName} ({c.cityId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Administrative Reason (Recorded in Audit Log){' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={partnerActionReason}
                onChange={(e) => setPartnerActionReason(e.target.value)}
                placeholder="Enter reason for this action..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPartnerModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !partnerActionReason.trim()}
                onClick={async () => {
                  const actionMap = {
                    SUSPEND: 'SUSPEND_PARTNER',
                    REACTIVATE: 'REACTIVATE_PARTNER',
                    DEACTIVATE: 'DEACTIVATE_PARTNER',
                    REASSIGN_CITY: 'REASSIGN_PARTNER_CITY',
                  };
                  const targetCityObj = reassignCities.find(
                    (c) => c.cityId === reassignCityId
                  );
                  const ok = await executePartnerAdminAction({
                    action: actionMap[partnerModal.mode],
                    partnerId: partnerModal.partner.id,
                    reason: partnerActionReason.trim(),
                    newCityId:
                      partnerModal.mode === 'REASSIGN_CITY'
                        ? reassignCityId
                        : undefined,
                    newCountry: targetCityObj?.country,
                    newStateRegion: targetCityObj?.stateRegion,
                    newCityName: targetCityObj?.cityName,
                  });
                  if (ok) setPartnerModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#003B8E] text-white font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm {partnerModal.mode}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: RECORD MANUAL BANK TRANSFER PAYOUT
         ==================================================================== */}
      {payoutModalSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="font-mono text-[10px] text-emerald-700 font-bold uppercase">
                  Manual Bank Transfer Settlement
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {payoutModalSettlement.statementNumber} (
                  {payoutModalSettlement.partnerName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPayoutModalSettlement(null)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Amount Paid ({payoutModalSettlement.currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transfer Date *
                </label>
                <input
                  type="date"
                  value={payoutDate}
                  onChange={(e) => setPayoutDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transfer Mode *
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) =>
                    setPayoutMethod(
                      e.target.value as
                        | 'NEFT'
                        | 'RTGS'
                        | 'IMPS'
                        | 'BANK_TRANSFER'
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                >
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="IMPS">IMPS</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  UTR / Bank Reference # *
                </label>
                <input
                  type="text"
                  required
                  value={payoutReferenceNumber}
                  onChange={(e) => setPayoutReferenceNumber(e.target.value)}
                  placeholder="e.g. SBIN22629984120"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Proof of Payment Reference / URL (Optional)
              </label>
              <input
                type="text"
                value={payoutProofUrl}
                onChange={(e) => setPayoutProofUrl(e.target.value)}
                placeholder="/partner_settlement_proofs/..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Settlement Notes
              </label>
              <input
                type="text"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="Manual monthly partner payout completed"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayoutModalSettlement(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !payoutReferenceNumber.trim()}
                onClick={async () => {
                  const ok = await executePartnerAdminAction({
                    action: 'RECORD_MANUAL_PAYOUT',
                    settlementId: payoutModalSettlement.id,
                    amountPaid: Number(payoutAmount) || 0,
                    currency: payoutModalSettlement.currency,
                    paymentDate: payoutDate,
                    paymentMethod: payoutMethod,
                    paymentReferenceNumber: payoutReferenceNumber.trim(),
                    notes: payoutNotes.trim(),
                    proofDocumentUrl: payoutProofUrl.trim(),
                  });
                  if (ok) setPayoutModalSettlement(null);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm &amp; Mark Settlement Paid
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ====================================================================
          MODAL 4: DIRECT ONBOARD CITY PARTNER (DEDICATED ARCHITECTURE)
         ==================================================================== */}
      {isDirectOnboardModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full my-8 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#003B8E] text-white flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Direct Onboard City Partner
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dedicated Architecture · Canonical City Exclusivity · 50/50 Revenue Attribution
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectOnboardModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Strict Role Isolation Notice */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-[#003B8E]">
                <ShieldCheck className="w-4 h-4 text-[#003B8E] shrink-0" />
                <span>Strict Role Segregation &amp; City-Scoped Access</span>
              </div>
              <p className="text-[11px] text-blue-900 leading-relaxed">
                City Partners are onboarded into the dedicated partner architecture (<code className="font-mono">/cityPartners</code> &amp; <code className="font-mono">/cityPartnerAllocations</code>) with <code className="font-mono">role: &apos;partner&apos;</code>. They receive city-scoped visibility and are <strong>strictly excluded from Platform Administrator privileges</strong>.
              </p>
            </div>

            <form onSubmit={handleDirectOnboardSubmit} className="space-y-5 text-xs">
              {/* SECTION 1: CANONICAL CITY EXCLUSIVITY */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#003B8E]" />
                    <span>Canonical City Allocation &amp; Exclusivity Lock</span>
                  </h4>
                  {directCityChecking ? (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Checking availability...
                    </span>
                  ) : directCityAvailability ? (
                    directCityAvailability.isAvailable ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        <Check className="w-3 h-3" />
                        Available for Allocation
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                        <AlertCircle className="w-3 h-3" />
                        Already Allocated ({directCityAvailability.activePartnerName || 'Active Partner'})
                      </span>
                    )
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Country
                    </label>
                    <select
                      value={directCountryCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setDirectCountryCode(code);
                        const reg = getRegionsByCountry(code);
                        if (reg.length > 0) {
                          setDirectStateRegion(reg[0].name);
                          const cities = getCitiesByCountryAndRegion(code, reg[0].name);
                          if (cities.length > 0) setDirectCityId(cities[0].cityId);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                    >
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      State / Region
                    </label>
                    <select
                      value={directStateRegion}
                      onChange={(e) => {
                        const reg = e.target.value;
                        setDirectStateRegion(reg);
                        const cities = getCitiesByCountryAndRegion(directCountryCode, reg);
                        if (cities.length > 0) setDirectCityId(cities[0].cityId);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                    >
                      {directRegions.map((r) => (
                        <option key={r.code || r.name} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Canonical City <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={directCityId}
                      onChange={(e) => setDirectCityId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-[#003B8E]"
                    >
                      {directCities.map((c) => (
                        <option key={c.cityId} value={c.cityId}>
                          {c.cityName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      District / Sub-Division (Optional)
                    </label>
                    <input
                      type="text"
                      value={directDistrict}
                      onChange={(e) => setDirectDistrict(e.target.value)}
                      placeholder="e.g. Pune Urban"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Postal / PIN Code
                    </label>
                    <input
                      type="text"
                      value={directPostalCode}
                      onChange={(e) => setDirectPostalCode(e.target.value)}
                      placeholder="e.g. 411001"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: PARTNER APPLICANT PROFILE */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#003B8E]" />
                  <span>Partner Identity &amp; Contact Information</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Full Legal Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={directFullName}
                      onChange={(e) => setDirectFullName(e.target.value)}
                      placeholder="e.g. Sunita Deshmukh"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mobile Number (E.164) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={directCountryDialCode}
                        onChange={(e) => setDirectCountryDialCode(e.target.value)}
                        className="w-24 px-2 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-800"
                      >
                        <option value="+91">🇮🇳 +91</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+971">🇦🇪 +971</option>
                      </select>
                      <input
                        type="tel"
                        required
                        value={directPhoneSubscriber}
                        onChange={(e) => setDirectPhoneSubscriber(e.target.value)}
                        placeholder="9876543210"
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={directEmail}
                      onChange={(e) => setDirectEmail(e.target.value)}
                      placeholder="sunita@example.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Residential or Business Address
                    </label>
                    <input
                      type="text"
                      value={directAddress}
                      onChange={(e) => setDirectAddress(e.target.value)}
                      placeholder="Commercial Complex, FC Road, Pune"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: KYC & BANK SETTLEMENT ACCOUNT */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-[#003B8E]" />
                  <span>KYC Verification &amp; Bank Settlement Account</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      PAN / Tax Identification #
                    </label>
                    <input
                      type="text"
                      value={directPanOrTaxId}
                      onChange={(e) => setDirectPanOrTaxId(e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={directBankName}
                      onChange={(e) => setDirectBankName(e.target.value)}
                      placeholder="State Bank of India / HDFC Bank"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={directBankAccountHolderName}
                      onChange={(e) => setDirectBankAccountHolderName(e.target.value)}
                      placeholder="As per bank passbook"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      value={directBankAccountNumber}
                      onChange={(e) => setDirectBankAccountNumber(e.target.value)}
                      placeholder="987654321012"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      IFSC / Routing Code
                    </label>
                    <input
                      type="text"
                      value={directBankIfsc}
                      onChange={(e) => setDirectBankIfsc(e.target.value.toUpperCase())}
                      placeholder="SBIN0001234"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: ADMINISTRATIVE NOTES */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Administrative Onboarding Notes (logged in audit trail)
                </label>
                <input
                  type="text"
                  value={directNotes}
                  onChange={(e) => setDirectNotes(e.target.value)}
                  placeholder="Direct onboarding authorized by Super Admin for exclusive city growth"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              {/* SECTION 5: 50/50 REVENUE AGREEMENT */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directAgreeTerms}
                    onChange={(e) => setDirectAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded text-[#003B8E]"
                  />
                  <span className="text-[11px] text-amber-950 leading-relaxed font-semibold">
                    Confirm 50/50 Net Eligible Revenue Split Agreement: 50% of net eligible collected platform fees (2% capped at ₹70/unit) and SaaS subscription revenue in this canonical city will be attributed to this City Partner.
                  </span>
                </label>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDirectOnboardModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !directAgreeTerms ||
                    Boolean(directCityAvailability && !directCityAvailability.isAvailable)
                  }
                  className="px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4 text-amber-300" />
                  <span>
                    {submitting ? 'Onboarding Partner...' : 'Direct Onboard & Allocate City'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
