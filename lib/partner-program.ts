import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  LocalStore,
  OrderRecord,
  Product,
  SellerProfile,
  UserAccount,
} from './catalog-data';
import {
  BillingTransaction,
  FeaturedCampaign,
  MerchantSubscription,
  PlatformFeeLedgerEntry,
} from './revenue-model';
import {
  CURATED_CANONICAL_CITIES,
  CityDef,
  normalizeCanonicalLocationId,
} from './global-locations-data';
import {
  getCountryByCodeOrName,
  getRegionByCodeOrName,
  loadCustomApprovedCities,
} from './location-service';
import { serverPlatformFeeLedgerRegistry } from './fees';
import {
  DESIGNATED_SUPER_ADMIN_PHONE,
  isDesignatedOwnerPhone,
  normalizePhoneE164,
  serverUserAccounts,
} from './super-admin-auth';
import { syncUserAccountToFirestore } from './firebase';

// ============================================================================
// 1. CONSTANTS & POLICY DEFINITIONS
// ============================================================================

export const DEFAULT_PARTNER_REVENUE_SHARE_PERCENT = 50;
export const DEFAULT_CITYKART_RETAINED_SHARE_PERCENT = 50;
export const PARTNER_CONSENT_VERSION = 'citykart-partner-program-terms-v1.0';

export type PartnerApplicationStatus =
  | 'draft'
  | 'pending_otp_verification'
  | 'pending_review'
  | 'additional_information_required'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type PartnerAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type PartnerKycVerificationStatus =
  | 'PENDING_MANUAL_REVIEW'
  | 'VERIFIED'
  | 'ADDITIONAL_DOCS_REQUIRED'
  | 'REJECTED';

export type PartnerSettlementStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'ON_HOLD';

export interface PartnerSupportingDocument {
  id: string;
  docCategory: 'IDENTITY' | 'ADDRESS' | 'TAX_PAN' | 'BANK_PROOF';
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export interface PartnerKycAndPayoutInfo {
  identityDocType:
    | 'PAN_CARD'
    | 'AADHAAR_MASKED'
    | 'PASSPORT'
    | 'DRIVING_LICENSE'
    | 'VOTER_ID'
    | 'NATIONAL_ID';
  identityDocNumber: string;
  identityDocNumberMasked: string;
  addressProofType:
    | 'AADHAAR'
    | 'UTILITY_BILL'
    | 'BANK_STATEMENT'
    | 'RENT_AGREEMENT'
    | 'BUSINESS_REGISTRATION';
  addressProofReference?: string;
  panOrTaxId: string;
  panOrTaxIdMasked: string;
  bankAccountHolderName: string;
  bankAccountNumber: string;
  bankAccountNumberMasked: string;
  bankIfscOrRoutingCode: string;
  bankName: string;
  supportingDocuments: PartnerSupportingDocument[];
  kycVerificationStatus: PartnerKycVerificationStatus;
  kycVerifiedByUid?: string;
  kycVerifiedByName?: string;
  kycVerifiedAt?: string;
  kycReviewNotes?: string;
}

export interface PartnerApplicationHistoryEntry {
  id: string;
  timestamp: string;
  fromStatus: PartnerApplicationStatus | 'NONE';
  toStatus: PartnerApplicationStatus;
  actorUid: string;
  actorName: string;
  actorRole: 'applicant' | 'super_admin' | 'admin';
  note: string;
}

export interface PartnerApplicationRecord {
  id: string;
  referenceId: string;
  applicantUid: string;
  fullLegalName: string;
  phoneE164: string;
  maskedPhone: string;
  otpVerified: boolean;
  otpVerifiedAt?: string;
  email: string;
  residentialOrBusinessAddress: string;
  country: string;
  countryCode: string;
  stateRegion: string;
  cityId: string;
  cityName: string;
  district?: string;
  postalCode: string;
  relevantExperience: string;
  localGrowthPlan: string;
  kyc: PartnerKycAndPayoutInfo;
  consentAccepted: boolean;
  consentAcceptedAt: string;
  consentVersion: string;
  status: PartnerApplicationStatus;
  statusReason?: string;
  additionalInfoPrompt?: string;
  applicantAdditionalResponse?: string;
  waitlisted?: boolean;
  assignedPartnerId?: string;
  history: PartnerApplicationHistoryEntry[];
  submittedAt: string;
  updatedAt: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewedAt?: string;
}

export interface CityPartnerAllocationRecord {
  cityId: string;
  cityName: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  status: 'ALLOCATED' | 'RELEASED';
  activePartnerId: string;
  partnerUid: string;
  partnerPhoneE164: string;
  partnerName: string;
  applicationId: string;
  allocatedAt: string;
  allocatedByUid: string;
  allocatedByPhone: string;
  updatedAt: string;
  previousAllocations?: Array<{
    partnerId: string;
    partnerPhoneE164: string;
    allocatedAt: string;
    releasedAt: string;
    reason: string;
    actedByUid: string;
  }>;
}

export interface CityPartnerRecord {
  id: string;
  applicationId: string;
  applicationReferenceId: string;
  partnerUid: string;
  phoneE164: string;
  maskedPhone: string;
  fullName: string;
  email: string;
  residentialOrBusinessAddress: string;
  role: 'partner';
  status: PartnerAccountStatus;
  statusReason?: string;
  assignedCityId: string;
  assignedCityName: string;
  assignedStateRegion: string;
  assignedCountry: string;
  assignedCountryCode: string;
  assignedDistrict?: string;
  assignedPostalCode?: string;
  revenueSharePercent: number;
  citykartRetainedPercent: number;
  kycVerificationStatus: PartnerKycVerificationStatus;
  payoutSummary: {
    bankAccountHolderName: string;
    bankAccountNumberMasked: string;
    bankIfscOrRoutingCode: string;
    bankName: string;
    panOrTaxIdMasked: string;
  };
  activatedAt: string;
  activatedByUid: string;
  activatedByPhone: string;
  suspendedAt?: string;
  suspendedByUid?: string;
  deactivatedAt?: string;
  deactivatedByUid?: string;
  updatedAt: string;
}

export type EligibleRevenueSourceType =
  | 'PLATFORM_FEE'
  | 'SELLER_SUBSCRIPTION'
  | 'SPONSORED_AD'
  | 'VALUE_ADDED_SERVICE';

export interface CityEligibleRevenueItem {
  id: string;
  sourceRecordId: string;
  sourceType: EligibleRevenueSourceType;
  cityId: string;
  cityName: string;
  storeId: string;
  storeName: string;
  sellerId: string;
  description: string;
  currency: 'INR' | 'USD';
  grossAmountCollected: number;
  taxAmountExcluded: number;
  eligibleNetAmount: number;
  isRefundedOrReversed: boolean;
  refundOrReversalAmount: number;
  periodMonth: string; // YYYY-MM
  collectedAt: string;
}

export interface CityRevenueAttributionSummary {
  cityId: string;
  cityName: string;
  periodMonth: string; // 'ALL' or 'YYYY-MM'
  currency: 'INR' | 'USD';
  partnerSharePercent: number;
  citykartRetainedPercent: number;
  // Collected Eligible Revenue by Category (Pre-tax, actually collected)
  platformFeesCollected: number;
  subscriptionRevenueCollected: number;
  sponsoredAdRevenueCollected: number;
  valueAddedServiceRevenueCollected: number;
  eligibleRevenueCollected: number;
  // Deductions & Reversals
  refundsAndReversals: number;
  agreedDeductions: number;
  // Net Eligible & 50/50 Split
  netEligibleRevenue: number;
  partnerShareAmount: number;
  citykartRetainedAmount: number;
  // Explicitly Excluded Figures (Reported for audit transparency, NEVER in eligible revenue)
  taxesExcludedTotal: number;
  uncollectedAccruedFeesExcluded: number;
  pendingOrFailedInvoicesExcluded: number;
  citySellerProductGmvExcluded: number;
  // Source Line Items
  lineItems: CityEligibleRevenueItem[];
}

export interface PartnerSettlementPaymentRecord {
  id: string;
  settlementId: string;
  partnerId: string;
  cityId: string;
  amountPaid: number;
  currency: 'INR' | 'USD';
  paymentDate: string;
  paymentMethod: 'NEFT' | 'RTGS' | 'IMPS' | 'BANK_TRANSFER';
  paymentReferenceNumber: string;
  notes?: string;
  proofDocumentUrl?: string;
  recordedByAdminUid: string;
  recordedByAdminPhone: string;
  recordedAt: string;
}

export interface PartnerMonthlySettlementRecord {
  id: string;
  statementNumber: string;
  partnerId: string;
  partnerUid: string;
  partnerName: string;
  partnerPhoneE164: string;
  assignedCityId: string;
  assignedCityName: string;
  periodMonth: string; // YYYY-MM
  currency: 'INR' | 'USD';
  beginningBalance: number;
  platformFeesCollected: number;
  subscriptionRevenueCollected: number;
  adAndServiceRevenueCollected: number;
  eligibleRevenueCollected: number;
  taxesExcluded: number;
  refundsAndReversals: number;
  agreedDeductions: number;
  deductionNotes?: string;
  netEligibleRevenue: number;
  partnerSharePercent: number;
  partnerPayableAmount: number;
  citykartRetainedAmount: number;
  totalPayableWithCarryover: number;
  previouslyPaidAmount: number;
  outstandingPayableBalance: number;
  sourceRevenueRecordIds: string[];
  status: PartnerSettlementStatus;
  generatedAt: string;
  generatedByUid: string;
  approvedAt?: string;
  approvedByUid?: string;
  approvedByPhone?: string;
  paidAt?: string;
  payments: PartnerSettlementPaymentRecord[];
  updatedAt: string;
}

export interface PartnerNotificationRecord {
  id: string;
  recipientUid?: string;
  recipientPhoneE164: string;
  partnerId?: string;
  applicationId?: string;
  type:
    | 'APPLICATION_SUBMITTED'
    | 'ADDITIONAL_INFO_REQUESTED'
    | 'APPLICATION_APPROVED'
    | 'APPLICATION_REJECTED'
    | 'CITY_ALLOCATED'
    | 'MONTHLY_STATEMENT_GENERATED'
    | 'SETTLEMENT_APPROVED'
    | 'SETTLEMENT_PAYOUT_RECORDED'
    | 'PARTNER_STATUS_CHANGED';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================================================
// 2. IN-MEMORY REGISTRIES (WITH FIRESTORE PERSISTENCE SYNC)
// ============================================================================

declare global {
  var __serverPartnerApplicationsRegistry:
    | Map<string, PartnerApplicationRecord>
    | undefined;
  var __serverCityPartnersRegistry:
    | Map<string, CityPartnerRecord>
    | undefined;
  var __serverCityAllocationsRegistry:
    | Map<string, CityPartnerAllocationRecord>
    | undefined;
  var __serverPartnerSettlementsRegistry:
    | Map<string, PartnerMonthlySettlementRecord>
    | undefined;
  var __serverPartnerNotificationsRegistry:
    | Map<string, PartnerNotificationRecord>
    | undefined;
  var __serverCityAllocationMutex: Set<string> | undefined;
  var __serverApplicantSubmissionMutex: Set<string> | undefined;
}

export const serverPartnerApplicationsRegistry: Map<
  string,
  PartnerApplicationRecord
> =
  globalThis.__serverPartnerApplicationsRegistry ||
  (globalThis.__serverPartnerApplicationsRegistry = new Map<
    string,
    PartnerApplicationRecord
  >());

export const serverCityPartnersRegistry: Map<string, CityPartnerRecord> =
  globalThis.__serverCityPartnersRegistry ||
  (globalThis.__serverCityPartnersRegistry = new Map<
    string,
    CityPartnerRecord
  >());

export const serverCityAllocationsRegistry: Map<
  string,
  CityPartnerAllocationRecord
> =
  globalThis.__serverCityAllocationsRegistry ||
  (globalThis.__serverCityAllocationsRegistry = new Map<
    string,
    CityPartnerAllocationRecord
  >());

export const serverPartnerSettlementsRegistry: Map<
  string,
  PartnerMonthlySettlementRecord
> =
  globalThis.__serverPartnerSettlementsRegistry ||
  (globalThis.__serverPartnerSettlementsRegistry = new Map<
    string,
    PartnerMonthlySettlementRecord
  >());

export const serverPartnerNotificationsRegistry: Map<
  string,
  PartnerNotificationRecord
> =
  globalThis.__serverPartnerNotificationsRegistry ||
  (globalThis.__serverPartnerNotificationsRegistry = new Map<
    string,
    PartnerNotificationRecord
  >());

const cityAllocationMutex: Set<string> =
  globalThis.__serverCityAllocationMutex ||
  (globalThis.__serverCityAllocationMutex = new Set<string>());

const applicantSubmissionMutex: Set<string> =
  globalThis.__serverApplicantSubmissionMutex ||
  (globalThis.__serverApplicantSubmissionMutex = new Set<string>());

// ============================================================================
// 3. HELPER & MASKING UTILITIES
// ============================================================================

export function roundCurrency2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function maskSensitiveIdentifier(
  raw: string,
  visibleTrailing: number = 4
): string {
  const clean = (raw || '').trim();
  if (!clean) return '••••';
  if (clean.length <= visibleTrailing) return `••••${clean}`;
  const trailing = clean.slice(-visibleTrailing);
  const leading = clean.slice(0, Math.min(2, clean.length - visibleTrailing));
  return `${leading}${'•'.repeat(Math.max(4, clean.length - visibleTrailing - leading.length))}${trailing}`;
}

export function sanitizeApplicationForApplicantView(
  app: PartnerApplicationRecord
): PartnerApplicationRecord {
  return {
    ...app,
    kyc: {
      ...app.kyc,
      identityDocNumber: app.kyc.identityDocNumberMasked,
      panOrTaxId: app.kyc.panOrTaxIdMasked,
      bankAccountNumber: app.kyc.bankAccountNumberMasked,
    },
  };
}

// ============================================================================
// 4. CANONICAL LOCATION VALIDATION & CITY AVAILABILITY
// ============================================================================

export function findCanonicalCityRecord(params: {
  cityId?: string;
  country?: string;
  countryCode?: string;
  stateRegion?: string;
  cityName?: string;
}): {
  valid: boolean;
  cityRecord?: CityDef;
  error?: string;
} {
  const customCities = loadCustomApprovedCities();
  const allCanonicalCities: CityDef[] = [
    ...CURATED_CANONICAL_CITIES,
    ...customCities,
  ];

  const reqCityId = (params.cityId || '').trim().toLowerCase();
  const reqCityName = (params.cityName || '').trim();
  const reqState = (params.stateRegion || '').trim();
  const reqCountry = (params.country || params.countryCode || '').trim();

  if (!reqCityId && (!reqCityName || !reqState || !reqCountry)) {
    return {
      valid: false,
      error:
        'Country, state/province, and canonical city selection are required.',
    };
  }

  // 1. Direct match by canonical cityId in directory
  if (reqCityId) {
    const exactMatch = allCanonicalCities.find(
      (c) => c.cityId.toLowerCase() === reqCityId
    );
    if (exactMatch) {
      // Verify state/country consistency if provided
      if (reqCountry) {
        const countryObj = getCountryByCodeOrName(reqCountry);
        if (
          countryObj &&
          exactMatch.countryCode.toLowerCase() !==
            countryObj.code.toLowerCase() &&
          exactMatch.country.toLowerCase() !== countryObj.name.toLowerCase()
        ) {
          return {
            valid: false,
            error: `Selected city "${exactMatch.cityName}" does not belong to country "${reqCountry}".`,
          };
        }
      }
      if (reqState) {
        const regionObj = getRegionByCodeOrName(
          exactMatch.countryCode,
          reqState
        );
        const expectedRegionName = (
          regionObj ? regionObj.name : reqState
        ).toLowerCase();
        if (
          exactMatch.stateRegion.toLowerCase() !== expectedRegionName &&
          (!regionObj ||
            exactMatch.stateRegion.toLowerCase() !==
              regionObj.code.toLowerCase())
        ) {
          return {
            valid: false,
            error: `Selected city "${exactMatch.cityName}" does not belong to state/region "${reqState}".`,
          };
        }
      }
      return { valid: true, cityRecord: exactMatch };
    }
  }

  // 2. Match by Country + State + City Name in canonical directory
  const countryDef = getCountryByCodeOrName(reqCountry);
  if (!countryDef) {
    return {
      valid: false,
      error: `Unrecognized country "${reqCountry}". Please select a valid country from the canonical directory.`,
    };
  }

  const regionDef = getRegionByCodeOrName(countryDef.code, reqState);
  if (!regionDef) {
    return {
      valid: false,
      error: `Unrecognized state/province "${reqState}" in ${countryDef.name}.`,
    };
  }

  const normalizedCandidateId = normalizeCanonicalLocationId(
    countryDef.name,
    regionDef.name,
    reqCityName
  );

  const byTriplet = allCanonicalCities.find(
    (c) =>
      c.cityId.toLowerCase() === normalizedCandidateId ||
      (c.countryCode.toLowerCase() === countryDef.code.toLowerCase() &&
        c.stateRegion.toLowerCase() === regionDef.name.toLowerCase() &&
        c.cityName.toLowerCase() === reqCityName.toLowerCase())
  );

  if (byTriplet) {
    return { valid: true, cityRecord: byTriplet };
  }

  return {
    valid: false,
    error: `City "${reqCityName}" was not found in the canonical location directory for ${regionDef.name}, ${countryDef.name}. Please select a canonical city.`,
  };
}

export function checkCityPartnerAvailability(cityId: string): {
  cityId: string;
  isAvailable: boolean;
  availabilityStatus: 'AVAILABLE' | 'ALLOCATED_TO_ACTIVE_PARTNER';
  activePartnerId?: string;
  activePartnerName?: string;
  allocatedAt?: string;
  pendingApplicationsCount: number;
} {
  const cleanCityId = (cityId || '').trim().toLowerCase();
  const allocation = serverCityAllocationsRegistry.get(cleanCityId);

  let isAllocated = false;
  let activePartnerId: string | undefined;
  let activePartnerName: string | undefined;
  let allocatedAt: string | undefined;

  if (allocation && allocation.status === 'ALLOCATED') {
    const partner = serverCityPartnersRegistry.get(allocation.activePartnerId);
    if (!partner || partner.status === 'ACTIVE' || partner.status === 'SUSPENDED') {
      isAllocated = true;
      activePartnerId = allocation.activePartnerId;
      activePartnerName = allocation.partnerName;
      allocatedAt = allocation.allocatedAt;
    }
  } else {
    // Also check active partners registry directly as a safeguard
    for (const p of serverCityPartnersRegistry.values()) {
      if (
        p.assignedCityId.toLowerCase() === cleanCityId &&
        (p.status === 'ACTIVE' || p.status === 'SUSPENDED')
      ) {
        isAllocated = true;
        activePartnerId = p.id;
        activePartnerName = p.fullName;
        allocatedAt = p.activatedAt;
        break;
      }
    }
  }

  let pendingCount = 0;
  for (const app of serverPartnerApplicationsRegistry.values()) {
    if (
      app.cityId.toLowerCase() === cleanCityId &&
      (app.status === 'pending_review' ||
        app.status === 'additional_information_required')
    ) {
      pendingCount += 1;
    }
  }

  return {
    cityId: cleanCityId,
    isAvailable: !isAllocated,
    availabilityStatus: isAllocated
      ? 'ALLOCATED_TO_ACTIVE_PARTNER'
      : 'AVAILABLE',
    activePartnerId,
    activePartnerName,
    allocatedAt,
    pendingApplicationsCount: pendingCount,
  };
}

// ============================================================================
// 5. APPLICATION LIFECYCLE STATE MACHINE
// ============================================================================

const ALLOWED_TRANSITIONS: Record<
  PartnerApplicationStatus,
  PartnerApplicationStatus[]
> = {
  draft: ['pending_otp_verification', 'pending_review', 'withdrawn'],
  pending_otp_verification: ['pending_review', 'withdrawn'],
  pending_review: [
    'additional_information_required',
    'approved',
    'rejected',
    'withdrawn',
  ],
  additional_information_required: [
    'pending_review',
    'approved',
    'rejected',
    'withdrawn',
  ],
  approved: [],
  rejected: ['pending_review'], // Only if re-opened or re-evaluated by Super Admin
  withdrawn: [],
};

export function validateApplicationStateTransition(params: {
  fromStatus: PartnerApplicationStatus;
  toStatus: PartnerApplicationStatus;
  actorRole: 'applicant' | 'super_admin' | 'admin';
  otpVerified: boolean;
}): { allowed: boolean; error?: string } {
  const { fromStatus, toStatus, actorRole, otpVerified } = params;

  const allowedNext = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowedNext.includes(toStatus)) {
    return {
      allowed: false,
      error: `Invalid application state transition from "${fromStatus}" to "${toStatus}".`,
    };
  }

  // Applicants can NEVER approve, reject, or request info on themselves
  if (actorRole === 'applicant') {
    if (
      toStatus === 'approved' ||
      toStatus === 'rejected' ||
      toStatus === 'additional_information_required'
    ) {
      return {
        allowed: false,
        error:
          'Forbidden: Applicants cannot approve, reject, or review their own partner application.',
      };
    }
    if (toStatus === 'pending_review' && !otpVerified) {
      return {
        allowed: false,
        error:
          'Mobile number OTP verification is required before an application can enter pending_review.',
      };
    }
  }

  // Only Super Admin can approve an application and allocate a city
  if (toStatus === 'approved' && actorRole !== 'super_admin') {
    return {
      allowed: false,
      error:
        'Forbidden: Only the Platform Owner Super Admin can approve a City Partner application and allocate a city.',
    };
  }

  return { allowed: true };
}

// ============================================================================
// 6. FIRESTORE SYNC & HYDRATION HELPERS
// ============================================================================

export async function persistPartnerApplication(
  record: PartnerApplicationRecord
): Promise<void> {
  serverPartnerApplicationsRegistry.set(record.id, record);
  try {
    await setDoc(doc(db, 'partnerApplications', record.id), record, {
      merge: true,
    });
  } catch {
    // Preserved in serverPartnerApplicationsRegistry when client SDK rules restrict unprivileged write
  }
}

export async function persistCityPartner(
  record: CityPartnerRecord
): Promise<void> {
  serverCityPartnersRegistry.set(record.id, record);
  try {
    await setDoc(doc(db, 'cityPartners', record.id), record, { merge: true });
  } catch {}
}

export async function persistCityAllocation(
  record: CityPartnerAllocationRecord
): Promise<void> {
  serverCityAllocationsRegistry.set(record.cityId.toLowerCase(), record);
  try {
    await setDoc(
      doc(db, 'cityPartnerAllocations', record.cityId.toLowerCase()),
      record,
      { merge: true }
    );
  } catch {}
}

export async function persistPartnerSettlement(
  record: PartnerMonthlySettlementRecord
): Promise<void> {
  serverPartnerSettlementsRegistry.set(record.id, record);
  try {
    await setDoc(doc(db, 'partnerSettlements', record.id), record, {
      merge: true,
    });
  } catch {}
}

export async function createPartnerNotification(
  params: Omit<PartnerNotificationRecord, 'id' | 'isRead' | 'createdAt'>
): Promise<PartnerNotificationRecord> {
  const id = `pnotif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const notif: PartnerNotificationRecord = {
    ...params,
    id,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  serverPartnerNotificationsRegistry.set(id, notif);
  try {
    await setDoc(doc(db, 'partnerNotifications', id), notif, { merge: true });
  } catch {}
  return notif;
}

export async function hydratePartnerRegistriesFromFirestore(): Promise<void> {
  try {
    const [appsSnap, partnersSnap, allocsSnap, settlementsSnap, notifsSnap] =
      await Promise.all([
        getDocs(collection(db, 'partnerApplications')).catch(() => null),
        getDocs(collection(db, 'cityPartners')).catch(() => null),
        getDocs(collection(db, 'cityPartnerAllocations')).catch(() => null),
        getDocs(collection(db, 'partnerSettlements')).catch(() => null),
        getDocs(collection(db, 'partnerNotifications')).catch(() => null),
      ]);

    appsSnap?.forEach((d) => {
      const data = d.data() as PartnerApplicationRecord;
      if (data?.id && !serverPartnerApplicationsRegistry.has(data.id)) {
        serverPartnerApplicationsRegistry.set(data.id, data);
      }
    });
    partnersSnap?.forEach((d) => {
      const data = d.data() as CityPartnerRecord;
      if (data?.id && !serverCityPartnersRegistry.has(data.id)) {
        serverCityPartnersRegistry.set(data.id, data);
      }
    });
    allocsSnap?.forEach((d) => {
      const data = d.data() as CityPartnerAllocationRecord;
      if (
        data?.cityId &&
        !serverCityAllocationsRegistry.has(data.cityId.toLowerCase())
      ) {
        serverCityAllocationsRegistry.set(data.cityId.toLowerCase(), data);
      }
    });
    settlementsSnap?.forEach((d) => {
      const data = d.data() as PartnerMonthlySettlementRecord;
      if (data?.id && !serverPartnerSettlementsRegistry.has(data.id)) {
        serverPartnerSettlementsRegistry.set(data.id, data);
      }
    });
    notifsSnap?.forEach((d) => {
      const data = d.data() as PartnerNotificationRecord;
      if (data?.id && !serverPartnerNotificationsRegistry.has(data.id)) {
        serverPartnerNotificationsRegistry.set(data.id, data);
      }
    });
  } catch {
    // Continue with in-memory registries
  }
}

// ============================================================================
// 7. PARTNER ROLE RESOLUTION & ACCESS CONTROL
// ============================================================================

export function resolvePartnerStatusForUser(params: {
  uid?: string;
  phoneE164?: string;
}): {
  isActivePartner: boolean;
  partnerRecord: CityPartnerRecord | null;
  latestApplication: PartnerApplicationRecord | null;
} {
  const cleanPhone = (params.phoneE164 || '').trim();
  const cleanUid = (params.uid || '').trim();

  let partnerRecord: CityPartnerRecord | null = null;
  for (const p of serverCityPartnersRegistry.values()) {
    if (
      (cleanPhone && p.phoneE164 === cleanPhone) ||
      (cleanUid && p.partnerUid === cleanUid)
    ) {
      partnerRecord = p;
      if (p.status === 'ACTIVE') break;
    }
  }

  let latestApplication: PartnerApplicationRecord | null = null;
  for (const app of serverPartnerApplicationsRegistry.values()) {
    if (
      (cleanPhone && app.phoneE164 === cleanPhone) ||
      (cleanUid && app.applicantUid === cleanUid)
    ) {
      if (
        !latestApplication ||
        app.updatedAt.localeCompare(latestApplication.updatedAt) > 0
      ) {
        latestApplication = app;
      }
    }
  }

  return {
    isActivePartner: Boolean(
      partnerRecord && partnerRecord.status === 'ACTIVE'
    ),
    partnerRecord,
    latestApplication,
  };
}

/**
 * Enforces strict city-scoped authorization for an active Partner.
 * Ensures a Partner can ONLY read data for their single `assignedCityId`
 * and never access another city in the same state or country.
 */
export function verifyPartnerCityAccess(
  partner: CityPartnerRecord | null | undefined,
  requestedCityId?: string
): { allowed: boolean; assignedCityId?: string; error?: string } {
  if (!partner) {
    return {
      allowed: false,
      error: 'Forbidden: No partner authorization record found for caller.',
    };
  }
  if (partner.status !== 'ACTIVE') {
    return {
      allowed: false,
      error: `Forbidden: Partner account status is ${partner.status}. Only ACTIVE partners can access the Partner Dashboard.`,
    };
  }
  const assignedCityId = partner.assignedCityId.toLowerCase();
  if (
    requestedCityId &&
    requestedCityId.trim().toLowerCase() !== assignedCityId
  ) {
    return {
      allowed: false,
      assignedCityId,
      error: `Forbidden: City scope violation. Partner is authorized strictly for "${assignedCityId}" and cannot access "${requestedCityId}".`,
    };
  }
  return { allowed: true, assignedCityId };
}

// ============================================================================
// 8. PARTNER APPLICATION SUBMISSION & UPDATE WORKFLOW
// ============================================================================

export interface SubmitPartnerApplicationInput {
  applicantUid: string;
  fullLegalName: string;
  phoneE164: string;
  maskedPhone: string;
  otpVerified: boolean;
  email: string;
  residentialOrBusinessAddress: string;
  country: string;
  countryCode: string;
  stateRegion: string;
  cityId: string;
  cityName: string;
  district?: string;
  postalCode: string;
  relevantExperience: string;
  localGrowthPlan: string;
  identityDocType: PartnerKycAndPayoutInfo['identityDocType'];
  identityDocNumber: string;
  addressProofType: PartnerKycAndPayoutInfo['addressProofType'];
  addressProofReference?: string;
  panOrTaxId: string;
  bankAccountHolderName: string;
  bankAccountNumber: string;
  bankIfscOrRoutingCode: string;
  bankName: string;
  supportingDocuments?: PartnerSupportingDocument[];
  consentAccepted: boolean;
}

export async function submitPartnerApplication(
  input: SubmitPartnerApplicationInput
): Promise<{
  ok: boolean;
  application?: PartnerApplicationRecord;
  error?: string;
  statusCode?: number;
}> {
  const cleanPhone = (input.phoneE164 || '').trim();
  const cleanUid = (input.applicantUid || '').trim();

  if (!cleanPhone || !cleanPhone.startsWith('+')) {
    return {
      ok: false,
      error: 'A valid E.164 mobile number is required.',
      statusCode: 400,
    };
  }

  if (!input.otpVerified || !cleanUid) {
    return {
      ok: false,
      error:
        'Mobile number must be verified via Firebase Phone OTP before submitting a Partner Application.',
      statusCode: 400,
    };
  }

  const mutexKey = `${cleanPhone}:${cleanUid}`;
  if (applicantSubmissionMutex.has(mutexKey)) {
    return {
      ok: false,
      error:
        'A partner application submission is already in progress for this account.',
      statusCode: 409,
    };
  }

  applicantSubmissionMutex.add(mutexKey);
  try {
    // 1. Validate required applicant fields
    const fullLegalName = (input.fullLegalName || '').trim();
    const address = (input.residentialOrBusinessAddress || '').trim();
    const postalCode = (input.postalCode || '').trim();
    const experience = (input.relevantExperience || '').trim();
    const growthPlan = (input.localGrowthPlan || '').trim();

    if (fullLegalName.length < 3) {
      return {
        ok: false,
        error: 'Please enter your full legal name (at least 3 characters).',
        statusCode: 400,
      };
    }
    if (address.length < 8) {
      return {
        ok: false,
        error: 'Please enter a complete residential or business address.',
        statusCode: 400,
      };
    }
    if (!postalCode || postalCode.length < 4) {
      return {
        ok: false,
        error: 'Please enter a valid postal / PIN code.',
        statusCode: 400,
      };
    }
    if (experience.length < 15) {
      return {
        ok: false,
        error:
          'Please describe your relevant business or marketing experience (minimum 15 characters).',
        statusCode: 400,
      };
    }
    if (growthPlan.length < 20) {
      return {
        ok: false,
        error:
          'Please provide a short description of your local city growth plan (minimum 20 characters).',
        statusCode: 400,
      };
    }
    if (!input.consentAccepted) {
      return {
        ok: false,
        error:
          'You must accept the Citykart Partner Program data privacy and KYC verification consent notice.',
        statusCode: 400,
      };
    }

    // 2. Validate KYC & Bank Payout Fields
    const panOrTaxId = (input.panOrTaxId || '').trim().toUpperCase();
    const identityDocNumber = (input.identityDocNumber || '').trim();
    const bankHolder = (input.bankAccountHolderName || '').trim();
    const bankAccount = (input.bankAccountNumber || '').replace(/\s+/g, '');
    const bankIfsc = (input.bankIfscOrRoutingCode || '')
      .trim()
      .toUpperCase();
    const bankName = (input.bankName || '').trim();

    if (!identityDocNumber || identityDocNumber.length < 4) {
      return {
        ok: false,
        error: 'Valid identity verification document number is required.',
        statusCode: 400,
      };
    }
    if (!panOrTaxId || panOrTaxId.length < 5) {
      return {
        ok: false,
        error: 'Valid PAN or tax identification number is required.',
        statusCode: 400,
      };
    }
    if (
      (input.countryCode || 'IN').toUpperCase() === 'IN' &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panOrTaxId)
    ) {
      return {
        ok: false,
        error:
          'Please enter a valid 10-character Indian PAN (e.g., ABCDE1234F).',
        statusCode: 400,
      };
    }
    if (!bankHolder || bankHolder.length < 3) {
      return {
        ok: false,
        error: 'Bank account holder name is required for manual settlements.',
        statusCode: 400,
      };
    }
    if (!/^[0-9A-Z]{6,24}$/i.test(bankAccount)) {
      return {
        ok: false,
        error: 'Please enter a valid bank account number (6–24 digits).',
        statusCode: 400,
      };
    }
    if (
      (input.countryCode || 'IN').toUpperCase() === 'IN' &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)
    ) {
      return {
        ok: false,
        error:
          'Please enter a valid 11-character Indian Bank IFSC code (e.g., SBIN0001234).',
        statusCode: 400,
      };
    }

    // 3. Validate Canonical City against location directory
    const canonicalCheck = findCanonicalCityRecord({
      cityId: input.cityId,
      country: input.country,
      countryCode: input.countryCode,
      stateRegion: input.stateRegion,
      cityName: input.cityName,
    });

    if (!canonicalCheck.valid || !canonicalCheck.cityRecord) {
      return {
        ok: false,
        error:
          canonicalCheck.error ||
          'Selected city does not match canonical location records.',
        statusCode: 400,
      };
    }

    const canonicalCity = canonicalCheck.cityRecord;

    // 4. Check City Availability Policy (block new application if city already has an active partner)
    const availability = checkCityPartnerAvailability(canonicalCity.cityId);
    if (!availability.isAvailable) {
      return {
        ok: false,
        error: `${canonicalCity.cityName}, ${canonicalCity.stateRegion} already has an active City Partner. Please select another available city.`,
        statusCode: 409,
      };
    }

    // 5. Check whether the applicant already has an active partner role or an open/approved application
    for (const existingPartner of serverCityPartnersRegistry.values()) {
      if (
        (existingPartner.phoneE164 === cleanPhone ||
          existingPartner.partnerUid === cleanUid) &&
        existingPartner.status === 'ACTIVE'
      ) {
        return {
          ok: false,
          error: `You are already an active City Partner for ${existingPartner.assignedCityName}.`,
          statusCode: 409,
        };
      }
    }

    for (const existingApp of serverPartnerApplicationsRegistry.values()) {
      const sameApplicant =
        existingApp.phoneE164 === cleanPhone ||
        existingApp.applicantUid === cleanUid;
      if (
        sameApplicant &&
        (existingApp.status === 'pending_review' ||
          existingApp.status === 'additional_information_required' ||
          existingApp.status === 'approved')
      ) {
        return {
          ok: false,
          error: `You already have an active Partner Application (${existingApp.referenceId}) with status "${existingApp.status}". Duplicate applications are not permitted.`,
          statusCode: 409,
        };
      }
    }

    const nowIso = new Date().toISOString();
    const appId = `papp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const refRandom = Math.floor(100000 + Math.random() * 900000);
    const referenceId = `CKP-${new Date().getFullYear()}-${refRandom}`;

    const application: PartnerApplicationRecord = {
      id: appId,
      referenceId,
      applicantUid: cleanUid,
      fullLegalName,
      phoneE164: cleanPhone,
      maskedPhone:
        input.maskedPhone ||
        `${cleanPhone.slice(0, 3)} •••••• ${cleanPhone.slice(-4)}`,
      otpVerified: true,
      otpVerifiedAt: nowIso,
      email: (input.email || '').trim(),
      residentialOrBusinessAddress: address,
      country: canonicalCity.country,
      countryCode: canonicalCity.countryCode,
      stateRegion: canonicalCity.stateRegion,
      cityId: canonicalCity.cityId,
      cityName: canonicalCity.cityName,
      district: input.district || canonicalCity.district,
      postalCode,
      relevantExperience: experience,
      localGrowthPlan: growthPlan,
      kyc: {
        identityDocType: input.identityDocType,
        identityDocNumber,
        identityDocNumberMasked: maskSensitiveIdentifier(identityDocNumber, 4),
        addressProofType: input.addressProofType,
        addressProofReference: (input.addressProofReference || '').trim(),
        panOrTaxId,
        panOrTaxIdMasked: maskSensitiveIdentifier(panOrTaxId, 4),
        bankAccountHolderName: bankHolder,
        bankAccountNumber: bankAccount,
        bankAccountNumberMasked: maskSensitiveIdentifier(bankAccount, 4),
        bankIfscOrRoutingCode: bankIfsc,
        bankName: bankName || 'Indian Scheduled Bank',
        supportingDocuments: Array.isArray(input.supportingDocuments)
          ? input.supportingDocuments
          : [],
        // OTP verification NEVER constitutes KYC verification
        kycVerificationStatus: 'PENDING_MANUAL_REVIEW',
      },
      consentAccepted: true,
      consentAcceptedAt: nowIso,
      consentVersion: PARTNER_CONSENT_VERSION,
      status: 'pending_review',
      history: [
        {
          id: `hist_${Date.now()}`,
          timestamp: nowIso,
          fromStatus: 'NONE',
          toStatus: 'pending_review',
          actorUid: cleanUid,
          actorName: fullLegalName,
          actorRole: 'applicant',
          note: `Submitted City Partner application for ${canonicalCity.cityName}, ${canonicalCity.stateRegion} (${canonicalCity.cityId}) with verified mobile OTP.`,
        },
      ],
      submittedAt: nowIso,
      updatedAt: nowIso,
    };

    await persistPartnerApplication(application);
    await createPartnerNotification({
      recipientUid: cleanUid,
      recipientPhoneE164: cleanPhone,
      applicationId: application.id,
      type: 'APPLICATION_SUBMITTED',
      title: 'Partner Application Received',
      message: `Your City Partner application (${application.referenceId}) for ${canonicalCity.cityName} has been submitted and is pending Super Admin review.`,
    });

    return { ok: true, application };
  } finally {
    applicantSubmissionMutex.delete(mutexKey);
  }
}

// ============================================================================
// 9. SUPER ADMIN APPLICATION REVIEW & ATOMIC CITY ALLOCATION
// ============================================================================

export async function approvePartnerApplicationAndAllocateCity(params: {
  applicationId: string;
  adminUid: string;
  adminPhone: string;
  adminName: string;
  isSuperAdmin: boolean;
  markKycVerified?: boolean;
  reviewNotes?: string;
}): Promise<{
  ok: boolean;
  application?: PartnerApplicationRecord;
  partner?: CityPartnerRecord;
  allocation?: CityPartnerAllocationRecord;
  error?: string;
  statusCode?: number;
}> {
  if (!params.isSuperAdmin) {
    return {
      ok: false,
      error:
        'Forbidden: Only the Platform Owner Super Admin (+918329306616) can approve Partner applications and allocate cities.',
      statusCode: 403,
    };
  }

  const app = serverPartnerApplicationsRegistry.get(params.applicationId);
  if (!app) {
    return {
      ok: false,
      error: 'Partner application not found.',
      statusCode: 404,
    };
  }

  // Validate state transition
  const transitionCheck = validateApplicationStateTransition({
    fromStatus: app.status,
    toStatus: 'approved',
    actorRole: 'super_admin',
    otpVerified: app.otpVerified,
  });
  if (!transitionCheck.allowed) {
    return {
      ok: false,
      error: transitionCheck.error,
      statusCode: 400,
    };
  }

  const cleanCityId = app.cityId.trim().toLowerCase();

  // Atomic Lock per canonical cityId to prevent concurrent duplicate allocations
  if (cityAllocationMutex.has(cleanCityId)) {
    return {
      ok: false,
      error: `Concurrent city allocation in progress for "${cleanCityId}". Request rejected to preserve city exclusivity.`,
      statusCode: 409,
    };
  }

  cityAllocationMutex.add(cleanCityId);
  try {
    // Step 1: Revalidate canonical city on backend
    const canonicalCheck = findCanonicalCityRecord({
      cityId: app.cityId,
      country: app.country,
      countryCode: app.countryCode,
      stateRegion: app.stateRegion,
      cityName: app.cityName,
    });
    if (!canonicalCheck.valid || !canonicalCheck.cityRecord) {
      return {
        ok: false,
        error:
          canonicalCheck.error ||
          'Application city failed backend canonical validation.',
        statusCode: 400,
      };
    }

    // Step 2: Revalidate city exclusivity on backend
    const availability = checkCityPartnerAvailability(cleanCityId);
    if (!availability.isAvailable) {
      return {
        ok: false,
        error: `City Exclusivity Conflict: ${app.cityName} (${cleanCityId}) is already allocated to active partner ${availability.activePartnerName || availability.activePartnerId}.`,
        statusCode: 409,
      };
    }

    // Step 3: Verify applicant does not already hold another active city
    for (const existingPartner of serverCityPartnersRegistry.values()) {
      if (
        (existingPartner.phoneE164 === app.phoneE164 ||
          existingPartner.partnerUid === app.applicantUid) &&
        existingPartner.status === 'ACTIVE'
      ) {
        return {
          ok: false,
          error: `Applicant already has an active City Partner assignment for ${existingPartner.assignedCityName}.`,
          statusCode: 409,
        };
      }
    }

    const nowIso = new Date().toISOString();
    const partnerId = `partner_${cleanCityId}_${Date.now().toString(36)}`;
    const kycStatus: PartnerKycVerificationStatus =
      params.markKycVerified !== false ? 'VERIFIED' : app.kyc.kycVerificationStatus;

    // Step 4: Create atomic CityPartnerAllocationRecord
    const allocation: CityPartnerAllocationRecord = {
      cityId: cleanCityId,
      cityName: canonicalCheck.cityRecord.cityName,
      stateRegion: canonicalCheck.cityRecord.stateRegion,
      country: canonicalCheck.cityRecord.country,
      countryCode: canonicalCheck.cityRecord.countryCode,
      status: 'ALLOCATED',
      activePartnerId: partnerId,
      partnerUid: app.applicantUid,
      partnerPhoneE164: app.phoneE164,
      partnerName: app.fullLegalName,
      applicationId: app.id,
      allocatedAt: nowIso,
      allocatedByUid: params.adminUid,
      allocatedByPhone: params.adminPhone,
      updatedAt: nowIso,
    };

    // Step 5: Create distinct Partner authorization record (CityPartnerRecord)
    const partnerRecord: CityPartnerRecord = {
      id: partnerId,
      applicationId: app.id,
      applicationReferenceId: app.referenceId,
      partnerUid: app.applicantUid,
      phoneE164: app.phoneE164,
      maskedPhone: app.maskedPhone,
      fullName: app.fullLegalName,
      email: app.email,
      residentialOrBusinessAddress: app.residentialOrBusinessAddress,
      role: 'partner',
      status: 'ACTIVE',
      assignedCityId: cleanCityId,
      assignedCityName: canonicalCheck.cityRecord.cityName,
      assignedStateRegion: canonicalCheck.cityRecord.stateRegion,
      assignedCountry: canonicalCheck.cityRecord.country,
      assignedCountryCode: canonicalCheck.cityRecord.countryCode,
      assignedDistrict: app.district || canonicalCheck.cityRecord.district,
      assignedPostalCode: app.postalCode,
      revenueSharePercent: DEFAULT_PARTNER_REVENUE_SHARE_PERCENT,
      citykartRetainedPercent: DEFAULT_CITYKART_RETAINED_SHARE_PERCENT,
      kycVerificationStatus: kycStatus,
      payoutSummary: {
        bankAccountHolderName: app.kyc.bankAccountHolderName,
        bankAccountNumberMasked: app.kyc.bankAccountNumberMasked,
        bankIfscOrRoutingCode: app.kyc.bankIfscOrRoutingCode,
        bankName: app.kyc.bankName,
        panOrTaxIdMasked: app.kyc.panOrTaxIdMasked,
      },
      activatedAt: nowIso,
      activatedByUid: params.adminUid,
      activatedByPhone: params.adminPhone,
      updatedAt: nowIso,
    };

    // Step 6: Update PartnerApplicationRecord status to 'approved'
    const updatedApp: PartnerApplicationRecord = {
      ...app,
      status: 'approved',
      statusReason:
        params.reviewNotes ||
        `Approved and allocated exclusive city partnership for ${canonicalCheck.cityRecord.cityName}.`,
      assignedPartnerId: partnerId,
      reviewedByUid: params.adminUid,
      reviewedByName: params.adminName,
      reviewedAt: nowIso,
      updatedAt: nowIso,
      kyc: {
        ...app.kyc,
        kycVerificationStatus: kycStatus,
        kycVerifiedByUid:
          kycStatus === 'VERIFIED' ? params.adminUid : app.kyc.kycVerifiedByUid,
        kycVerifiedByName:
          kycStatus === 'VERIFIED'
            ? params.adminName
            : app.kyc.kycVerifiedByName,
        kycVerifiedAt:
          kycStatus === 'VERIFIED' ? nowIso : app.kyc.kycVerifiedAt,
        kycReviewNotes: params.reviewNotes || app.kyc.kycReviewNotes,
      },
      history: [
        ...app.history,
        {
          id: `hist_${Date.now()}`,
          timestamp: nowIso,
          fromStatus: app.status,
          toStatus: 'approved',
          actorUid: params.adminUid,
          actorName: params.adminName,
          actorRole: 'super_admin',
          note:
            params.reviewNotes ||
            `Application approved and city "${canonicalCheck.cityRecord.cityName}" (${cleanCityId}) allocated exclusively.`,
        },
      ],
    };

    await Promise.all([
      persistCityAllocation(allocation),
      persistCityPartner(partnerRecord),
      persistPartnerApplication(updatedApp),
      createPartnerNotification({
        recipientUid: app.applicantUid,
        recipientPhoneE164: app.phoneE164,
        partnerId: partnerRecord.id,
        applicationId: app.id,
        type: 'APPLICATION_APPROVED',
        title: `Approved: City Partner for ${canonicalCheck.cityRecord.cityName}`,
        message: `Congratulations! Your Partner Application (${app.referenceId}) has been approved and ${canonicalCheck.cityRecord.cityName} has been allocated to your Partner Dashboard.`,
      }),
    ]);

    return {
      ok: true,
      application: updatedApp,
      partner: partnerRecord,
      allocation,
    };
  } finally {
    cityAllocationMutex.delete(cleanCityId);
  }
}

// ============================================================================
// 9B. DEDICATED DIRECT CITY PARTNER ONBOARDING ARCHITECTURE
// ============================================================================

export interface DirectOnboardPartnerInput {
  adminUid: string;
  adminPhone: string;
  adminName: string;
  isSuperAdmin: boolean;
  partnerFullName: string;
  phoneE164: string;
  email?: string;
  residentialOrBusinessAddress?: string;
  country?: string;
  countryCode?: string;
  stateRegion?: string;
  cityId: string;
  cityName?: string;
  district?: string;
  postalCode?: string;
  panOrTaxId?: string;
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  bankIfscOrRoutingCode?: string;
  bankName?: string;
  notes?: string;
}

/**
 * Dedicated Architecture for direct Super Admin onboarding of City Partners.
 * Strictly isolates Partner role (`role: 'partner'`, `isPartner: true`, city-scoped)
 * from Platform Administrator rights (`isAdmin: false`, never touches `admin_authorizations`).
 * Atomically verifies canonical city validity, locks exclusive allocation, captures KYC,
 * initializes 50/50 revenue attribution, and creates auto-approved audit records.
 */
export async function directOnboardCityPartner(
  params: DirectOnboardPartnerInput
): Promise<{
  ok: boolean;
  partner?: CityPartnerRecord;
  allocation?: CityPartnerAllocationRecord;
  application?: PartnerApplicationRecord;
  error?: string;
  statusCode?: number;
}> {
  // 1. Authorization Guard: Only Platform Owner Super Admin can direct onboard partners
  const adminPhone = normalizePhoneE164(params.adminPhone);
  if (!params.isSuperAdmin || !isDesignatedOwnerPhone(adminPhone)) {
    return {
      ok: false,
      error:
        'Forbidden: Only the Platform Owner Super Admin (+918329306616) can direct onboard City Partners.',
      statusCode: 403,
    };
  }

  // 2. Partner Phone Validation & Normalization
  const targetPhone = normalizePhoneE164(params.phoneE164);
  if (!targetPhone || targetPhone.length < 8) {
    return {
      ok: false,
      error:
        'A valid mobile number with country code in E.164 format (e.g. +919876543210) is required.',
      statusCode: 400,
    };
  }

  // 3. Self-Approval & Role Separation Guard: Super Admin cannot direct onboard themselves
  if (isDesignatedOwnerPhone(targetPhone)) {
    return {
      ok: false,
      error:
        'Conflict: The Platform Owner Super Admin (+918329306616) cannot be onboarded as a City Partner. Platform Admin and City Partner roles are strictly isolated.',
      statusCode: 400,
    };
  }

  // 4. Partner Legal Name Validation
  const fullName = (params.partnerFullName || '').trim();
  if (fullName.length < 3) {
    return {
      ok: false,
      error: "Please enter the partner's full legal name (at least 3 characters).",
      statusCode: 400,
    };
  }

  // 5. Canonical City Record Validation
  const canonicalCheck = findCanonicalCityRecord({
    cityId: params.cityId,
    country: params.country,
    countryCode: params.countryCode,
    stateRegion: params.stateRegion,
    cityName: params.cityName,
  });
  if (!canonicalCheck.valid || !canonicalCheck.cityRecord) {
    return {
      ok: false,
      error:
        canonicalCheck.error ||
        'Selected city failed canonical location directory validation.',
      statusCode: 400,
    };
  }

  const canonicalCity = canonicalCheck.cityRecord;
  const cleanCityId = canonicalCity.cityId.toLowerCase();

  // 6. City Exclusivity Mutex & Allocation Lock Check
  if (cityAllocationMutex.has(cleanCityId)) {
    return {
      ok: false,
      error: `Concurrent city allocation in progress for "${cleanCityId}". Request rejected to preserve city exclusivity.`,
      statusCode: 409,
    };
  }

  cityAllocationMutex.add(cleanCityId);
  try {
    const availability = checkCityPartnerAvailability(cleanCityId);
    if (!availability.isAvailable) {
      return {
        ok: false,
        error: `City Exclusivity Conflict: ${canonicalCity.cityName} (${cleanCityId}) is already allocated to active partner ${availability.activePartnerName || availability.activePartnerId}.`,
        statusCode: 409,
      };
    }

    // 7. Check if phone number already holds an active City Partner assignment
    for (const existingPartner of serverCityPartnersRegistry.values()) {
      if (
        existingPartner.phoneE164 === targetPhone &&
        existingPartner.status === 'ACTIVE'
      ) {
        return {
          ok: false,
          error: `Partner with mobile number ${targetPhone} already has an active City Partner assignment for ${existingPartner.assignedCityName}.`,
          statusCode: 409,
        };
      }
    }

    const nowIso = new Date().toISOString();
    const cleanIdSuffix = Date.now().toString(36);
    const partnerId = `partner_${cleanCityId}_${cleanIdSuffix}`;
    const appId = `app_direct_${cleanCityId}_${cleanIdSuffix}`;
    const refId = `CKP-${cleanCityId.slice(0, 4).toUpperCase()}-${cleanIdSuffix.slice(-4).toUpperCase()}`;

    const pan = (params.panOrTaxId || '').trim().toUpperCase();
    const bankAccount = (params.bankAccountNumber || '')
      .trim()
      .replace(/\s+/g, '');
    const bankHolder = (params.bankAccountHolderName || fullName).trim();
    const bankIfsc = (params.bankIfscOrRoutingCode || '').trim().toUpperCase();
    const bankName = (params.bankName || 'Direct Scheduled Bank').trim();
    const email =
      (params.email || '').trim().toLowerCase() ||
      `${targetPhone.replace(/[^0-9]/g, '')}@partner.citykart.shop`;
    const address =
      (params.residentialOrBusinessAddress || '').trim() ||
      `${canonicalCity.cityName}, ${canonicalCity.stateRegion}`;
    const postalCode = (params.postalCode || '').trim() || '400001';

    // 8. Create Atomic CityPartnerAllocationRecord
    const allocation: CityPartnerAllocationRecord = {
      cityId: cleanCityId,
      cityName: canonicalCity.cityName,
      stateRegion: canonicalCity.stateRegion,
      country: canonicalCity.country,
      countryCode: canonicalCity.countryCode,
      status: 'ALLOCATED',
      activePartnerId: partnerId,
      partnerUid: targetPhone,
      partnerPhoneE164: targetPhone,
      partnerName: fullName,
      applicationId: appId,
      allocatedAt: nowIso,
      allocatedByUid: params.adminUid,
      allocatedByPhone: adminPhone,
      updatedAt: nowIso,
    };

    // 9. Create Distinct CityPartnerRecord (Role: partner, 50/50 revenue attribution, STRICTLY NOT admin)
    const partnerRecord: CityPartnerRecord = {
      id: partnerId,
      applicationId: appId,
      applicationReferenceId: refId,
      partnerUid: targetPhone,
      phoneE164: targetPhone,
      maskedPhone: maskSensitiveIdentifier(targetPhone, 4),
      fullName,
      email,
      residentialOrBusinessAddress: address,
      role: 'partner',
      status: 'ACTIVE',
      assignedCityId: cleanCityId,
      assignedCityName: canonicalCity.cityName,
      assignedStateRegion: canonicalCity.stateRegion,
      assignedCountry: canonicalCity.country,
      assignedCountryCode: canonicalCity.countryCode,
      assignedDistrict: params.district || canonicalCity.district,
      assignedPostalCode: postalCode,
      revenueSharePercent: DEFAULT_PARTNER_REVENUE_SHARE_PERCENT,
      citykartRetainedPercent: DEFAULT_CITYKART_RETAINED_SHARE_PERCENT,
      kycVerificationStatus: 'VERIFIED',
      payoutSummary: {
        bankAccountHolderName: bankHolder,
        bankAccountNumberMasked: maskSensitiveIdentifier(
          bankAccount || '0000',
          4
        ),
        bankIfscOrRoutingCode: bankIfsc || 'N/A',
        bankName,
        panOrTaxIdMasked: maskSensitiveIdentifier(pan || 'DIRECT', 4),
      },
      activatedAt: nowIso,
      activatedByUid: params.adminUid,
      activatedByPhone: adminPhone,
      updatedAt: nowIso,
    };

    // 10. Create Auto-Approved PartnerApplicationRecord for Audit Trail & Complete Lifecycle Record
    const application: PartnerApplicationRecord = {
      id: appId,
      referenceId: refId,
      applicantUid: targetPhone,
      fullLegalName: fullName,
      phoneE164: targetPhone,
      maskedPhone: maskSensitiveIdentifier(targetPhone, 4),
      otpVerified: true,
      otpVerifiedAt: nowIso,
      email,
      residentialOrBusinessAddress: address,
      country: canonicalCity.country,
      countryCode: canonicalCity.countryCode,
      stateRegion: canonicalCity.stateRegion,
      cityId: cleanCityId,
      cityName: canonicalCity.cityName,
      district: params.district || canonicalCity.district,
      postalCode,
      relevantExperience: 'Direct onboarding by Platform Owner Super Admin.',
      localGrowthPlan: `Authoritative direct city partner allocation for ${canonicalCity.cityName}.`,
      kyc: {
        identityDocType: 'PAN_CARD',
        identityDocNumber: pan || 'DIRECT_ONBOARDED',
        identityDocNumberMasked: maskSensitiveIdentifier(
          pan || 'DIRECT',
          4
        ),
        addressProofType: 'BUSINESS_REGISTRATION',
        panOrTaxId: pan || 'DIRECT_ONBOARDED',
        panOrTaxIdMasked: maskSensitiveIdentifier(pan || 'DIRECT', 4),
        bankAccountHolderName: bankHolder,
        bankAccountNumber: bankAccount || 'DIRECT_ONBOARDED',
        bankAccountNumberMasked: maskSensitiveIdentifier(
          bankAccount || '0000',
          4
        ),
        bankIfscOrRoutingCode: bankIfsc || 'N/A',
        bankName,
        supportingDocuments: [],
        kycVerificationStatus: 'VERIFIED',
        kycVerifiedByUid: params.adminUid,
        kycVerifiedByName: params.adminName,
        kycVerifiedAt: nowIso,
        kycReviewNotes:
          params.notes ||
          'Directly onboarded and authorized by Platform Owner Super Admin.',
      },
      consentAccepted: true,
      consentAcceptedAt: nowIso,
      consentVersion: PARTNER_CONSENT_VERSION,
      status: 'approved',
      statusReason:
        params.notes ||
        `Direct onboarding authorized for ${canonicalCity.cityName}.`,
      assignedPartnerId: partnerId,
      history: [
        {
          id: `hist_${Date.now()}`,
          timestamp: nowIso,
          fromStatus: 'NONE',
          toStatus: 'approved',
          actorUid: params.adminUid,
          actorName: params.adminName,
          actorRole: 'super_admin',
          note: `Directly onboarded as City Partner for ${canonicalCity.cityName} (${cleanCityId}). Exclusive allocation locked with 50/50 revenue attribution.`,
        },
      ],
      submittedAt: nowIso,
      updatedAt: nowIso,
      reviewedByUid: params.adminUid,
      reviewedByName: params.adminName,
      reviewedAt: nowIso,
    };

    // 11. Persist to Firestore and Memory Registries (Never write to admin_authorizations)
    await Promise.all([
      persistCityAllocation(allocation),
      persistCityPartner(partnerRecord),
      persistPartnerApplication(application),
      createPartnerNotification({
        recipientUid: targetPhone,
        recipientPhoneE164: targetPhone,
        partnerId: partnerRecord.id,
        applicationId: appId,
        type: 'APPLICATION_APPROVED',
        title: `Welcome to Citykart Partner Program: ${canonicalCity.cityName}`,
        message: `You have been directly onboarded as the authorized City Partner for ${canonicalCity.cityName}. Access your Partner Dashboard at /partner.`,
      }),
    ]);

    // 12. Synchronize user account without granting administrative rights
    const existingUser = serverUserAccounts.get(targetPhone);
    const updatedRoles = Array.from(
      new Set([...(existingUser?.roles || ['BUYER']), 'PARTNER'])
    ) as UserAccount['roles'];
    const updatedUser: UserAccount = {
      ...(existingUser || {
        id: targetPhone,
        uid: targetPhone,
        phoneE164: targetPhone,
        maskedPhone: maskSensitiveIdentifier(targetPhone, 4),
        countryCode: canonicalCity.countryCode || 'IN',
        fullName,
        roles: ['BUYER'],
        storeIds: [],
        createdAt: nowIso,
      }),
      roles: updatedRoles,
      isPartner: true,
      partnerId: partnerRecord.id,
      assignedCityId: cleanCityId,
      assignedCityName: canonicalCity.cityName,
      isAdmin: existingUser?.isAdmin || false,
      role: existingUser?.isAdmin ? existingUser.role : 'partner',
    };
    serverUserAccounts.set(targetPhone, updatedUser);
    try {
      await syncUserAccountToFirestore(updatedUser);
    } catch {}

    return {
      ok: true,
      partner: partnerRecord,
      allocation,
      application,
    };
  } finally {
    cityAllocationMutex.delete(cleanCityId);
  }
}

export async function rejectOrRequestInfoOnPartnerApplication(params: {
  applicationId: string;
  targetStatus: 'rejected' | 'additional_information_required';
  reasonOrPrompt: string;
  waitlisted?: boolean;
  adminUid: string;
  adminName: string;
  isSuperAdmin: boolean;
}): Promise<{
  ok: boolean;
  application?: PartnerApplicationRecord;
  error?: string;
  statusCode?: number;
}> {
  if (!params.isSuperAdmin) {
    return {
      ok: false,
      error: 'Forbidden: Super Admin authorization required.',
      statusCode: 403,
    };
  }

  const app = serverPartnerApplicationsRegistry.get(params.applicationId);
  if (!app) {
    return {
      ok: false,
      error: 'Partner application not found.',
      statusCode: 404,
    };
  }

  const cleanReason = (params.reasonOrPrompt || '').trim();
  if (!cleanReason) {
    return {
      ok: false,
      error:
        params.targetStatus === 'rejected'
          ? 'A rejection reason is required.'
          : 'Please specify what additional information is required from the applicant.',
      statusCode: 400,
    };
  }

  const transitionCheck = validateApplicationStateTransition({
    fromStatus: app.status,
    toStatus: params.targetStatus,
    actorRole: 'super_admin',
    otpVerified: app.otpVerified,
  });

  if (!transitionCheck.allowed) {
    return {
      ok: false,
      error: transitionCheck.error,
      statusCode: 400,
    };
  }

  const nowIso = new Date().toISOString();
  const updatedApp: PartnerApplicationRecord = {
    ...app,
    status: params.targetStatus,
    statusReason: cleanReason,
    additionalInfoPrompt:
      params.targetStatus === 'additional_information_required'
        ? cleanReason
        : app.additionalInfoPrompt,
    waitlisted:
      params.waitlisted !== undefined ? params.waitlisted : app.waitlisted,
    reviewedByUid: params.adminUid,
    reviewedByName: params.adminName,
    reviewedAt: nowIso,
    updatedAt: nowIso,
    kyc: {
      ...app.kyc,
      kycVerificationStatus:
        params.targetStatus === 'rejected'
          ? 'REJECTED'
          : 'ADDITIONAL_DOCS_REQUIRED',
      kycReviewNotes: cleanReason,
    },
    history: [
      ...app.history,
      {
        id: `hist_${Date.now()}`,
        timestamp: nowIso,
        fromStatus: app.status,
        toStatus: params.targetStatus,
        actorUid: params.adminUid,
        actorName: params.adminName,
        actorRole: 'super_admin',
        note: cleanReason,
      },
    ],
  };

  await persistPartnerApplication(updatedApp);
  await createPartnerNotification({
    recipientUid: app.applicantUid,
    recipientPhoneE164: app.phoneE164,
    applicationId: app.id,
    type:
      params.targetStatus === 'rejected'
        ? 'APPLICATION_REJECTED'
        : 'ADDITIONAL_INFO_REQUESTED',
    title:
      params.targetStatus === 'rejected'
        ? `Application Update (${app.referenceId})`
        : `Additional Information Requested (${app.referenceId})`,
    message: cleanReason,
  });

  return { ok: true, application: updatedApp };
}

export async function updateActivePartnerLifecycle(params: {
  partnerId: string;
  action: 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE' | 'REASSIGN_CITY';
  reason: string;
  newCityId?: string;
  newCountry?: string;
  newStateRegion?: string;
  newCityName?: string;
  adminUid: string;
  adminPhone: string;
  adminName: string;
  isSuperAdmin: boolean;
}): Promise<{
  ok: boolean;
  partner?: CityPartnerRecord;
  error?: string;
  statusCode?: number;
}> {
  if (!params.isSuperAdmin) {
    return {
      ok: false,
      error: 'Forbidden: Only Super Admin can modify active Partner status or city allocation.',
      statusCode: 403,
    };
  }

  const partner = serverCityPartnersRegistry.get(params.partnerId);
  if (!partner) {
    return {
      ok: false,
      error: 'Active partner record not found.',
      statusCode: 404,
    };
  }

  const cleanReason = (params.reason || '').trim();
  if (!cleanReason) {
    return {
      ok: false,
      error: 'An administrative reason is required for audit logging.',
      statusCode: 400,
    };
  }

  const nowIso = new Date().toISOString();

  if (params.action === 'SUSPEND') {
    const updated: CityPartnerRecord = {
      ...partner,
      status: 'SUSPENDED',
      statusReason: cleanReason,
      suspendedAt: nowIso,
      suspendedByUid: params.adminUid,
      updatedAt: nowIso,
    };
    await persistCityPartner(updated);
    await createPartnerNotification({
      recipientUid: partner.partnerUid,
      recipientPhoneE164: partner.phoneE164,
      partnerId: partner.id,
      type: 'PARTNER_STATUS_CHANGED',
      title: 'Partner Account Suspended',
      message: `Your City Partner account for ${partner.assignedCityName} has been suspended. Reason: ${cleanReason}`,
    });
    return { ok: true, partner: updated };
  }

  if (params.action === 'REACTIVATE') {
    // Ensure city has not been allocated to someone else if they were deactivated
    const availability = checkCityPartnerAvailability(partner.assignedCityId);
    if (
      !availability.isAvailable &&
      availability.activePartnerId !== partner.id
    ) {
      return {
        ok: false,
        error: `Cannot reactivate: ${partner.assignedCityName} is currently allocated to another partner (${availability.activePartnerName}).`,
        statusCode: 409,
      };
    }

    const updated: CityPartnerRecord = {
      ...partner,
      status: 'ACTIVE',
      statusReason: cleanReason,
      updatedAt: nowIso,
    };
    await persistCityPartner(updated);
    await persistCityAllocation({
      cityId: partner.assignedCityId,
      cityName: partner.assignedCityName,
      stateRegion: partner.assignedStateRegion,
      country: partner.assignedCountry,
      countryCode: partner.assignedCountryCode,
      status: 'ALLOCATED',
      activePartnerId: partner.id,
      partnerUid: partner.partnerUid,
      partnerPhoneE164: partner.phoneE164,
      partnerName: partner.fullName,
      applicationId: partner.applicationId,
      allocatedAt: partner.activatedAt,
      allocatedByUid: params.adminUid,
      allocatedByPhone: params.adminPhone,
      updatedAt: nowIso,
    });
    return { ok: true, partner: updated };
  }

  if (params.action === 'DEACTIVATE') {
    const updated: CityPartnerRecord = {
      ...partner,
      status: 'DEACTIVATED',
      statusReason: cleanReason,
      deactivatedAt: nowIso,
      deactivatedByUid: params.adminUid,
      updatedAt: nowIso,
    };
    await persistCityPartner(updated);

    const currentAlloc = serverCityAllocationsRegistry.get(
      partner.assignedCityId.toLowerCase()
    );
    if (currentAlloc && currentAlloc.activePartnerId === partner.id) {
      await persistCityAllocation({
        ...currentAlloc,
        status: 'RELEASED',
        updatedAt: nowIso,
        previousAllocations: [
          ...(currentAlloc.previousAllocations || []),
          {
            partnerId: partner.id,
            partnerPhoneE164: partner.phoneE164,
            allocatedAt: currentAlloc.allocatedAt,
            releasedAt: nowIso,
            reason: cleanReason,
            actedByUid: params.adminUid,
          },
        ],
      });
    }
    return { ok: true, partner: updated };
  }

  if (params.action === 'REASSIGN_CITY') {
    const canonicalCheck = findCanonicalCityRecord({
      cityId: params.newCityId,
      country: params.newCountry || partner.assignedCountry,
      stateRegion: params.newStateRegion,
      cityName: params.newCityName,
    });
    if (!canonicalCheck.valid || !canonicalCheck.cityRecord) {
      return {
        ok: false,
        error:
          canonicalCheck.error || 'Target reassignment city is not a valid canonical city.',
        statusCode: 400,
      };
    }

    const newCity = canonicalCheck.cityRecord;
    const newCityId = newCity.cityId.toLowerCase();
    const availability = checkCityPartnerAvailability(newCityId);
    if (!availability.isAvailable && availability.activePartnerId !== partner.id) {
      return {
        ok: false,
        error: `Cannot reassign: ${newCity.cityName} is already allocated to active partner ${availability.activePartnerName}.`,
        statusCode: 409,
      };
    }

    // Release old city allocation
    const oldCityId = partner.assignedCityId.toLowerCase();
    const oldAlloc = serverCityAllocationsRegistry.get(oldCityId);
    if (oldAlloc && oldAlloc.activePartnerId === partner.id) {
      await persistCityAllocation({
        ...oldAlloc,
        status: 'RELEASED',
        updatedAt: nowIso,
        previousAllocations: [
          ...(oldAlloc.previousAllocations || []),
          {
            partnerId: partner.id,
            partnerPhoneE164: partner.phoneE164,
            allocatedAt: oldAlloc.allocatedAt,
            releasedAt: nowIso,
            reason: `Reassigned to ${newCityId}: ${cleanReason}`,
            actedByUid: params.adminUid,
          },
        ],
      });
    }

    // Allocate new city
    await persistCityAllocation({
      cityId: newCityId,
      cityName: newCity.cityName,
      stateRegion: newCity.stateRegion,
      country: newCity.country,
      countryCode: newCity.countryCode,
      status: 'ALLOCATED',
      activePartnerId: partner.id,
      partnerUid: partner.partnerUid,
      partnerPhoneE164: partner.phoneE164,
      partnerName: partner.fullName,
      applicationId: partner.applicationId,
      allocatedAt: nowIso,
      allocatedByUid: params.adminUid,
      allocatedByPhone: params.adminPhone,
      updatedAt: nowIso,
    });

    const updatedPartner: CityPartnerRecord = {
      ...partner,
      assignedCityId: newCityId,
      assignedCityName: newCity.cityName,
      assignedStateRegion: newCity.stateRegion,
      assignedCountry: newCity.country,
      assignedCountryCode: newCity.countryCode,
      assignedDistrict: newCity.district,
      statusReason: `Reassigned to ${newCity.cityName}: ${cleanReason}`,
      updatedAt: nowIso,
    };
    await persistCityPartner(updatedPartner);
    await createPartnerNotification({
      recipientUid: partner.partnerUid,
      recipientPhoneE164: partner.phoneE164,
      partnerId: partner.id,
      type: 'CITY_ALLOCATED',
      title: `City Reassigned: ${newCity.cityName}`,
      message: `Your City Partner assignment has been updated to ${newCity.cityName}, ${newCity.stateRegion}. Reason: ${cleanReason}`,
    });

    return { ok: true, partner: updatedPartner };
  }

  return { ok: false, error: 'Unsupported partner lifecycle action.', statusCode: 400 };
}

// ============================================================================
// 10. CENTRALIZED CITY REVENUE ATTRIBUTION & 50/50 REVENUE-SHARING ENGINE
// ============================================================================

export interface CalculateCityPartnerRevenueParams {
  cityId: string;
  cityName?: string;
  periodMonth?: string; // 'ALL' or 'YYYY-MM'
  currency?: 'INR' | 'USD';
  partnerSharePercent?: number;
  agreedDeductions?: number;
  stores: LocalStore[];
  orders: OrderRecord[];
  transactions: BillingTransaction[];
  platformFeeLedger?: PlatformFeeLedgerEntry[];
  campaigns?: FeaturedCampaign[];
  subscriptions?: MerchantSubscription[];
}

function extractYearMonth(isoOrDateStr?: string): string {
  if (!isoOrDateStr) return new Date().toISOString().slice(0, 7);
  const clean = isoOrDateStr.trim();
  if (/^\d{4}-\d{2}/.test(clean)) {
    return clean.slice(0, 7);
  }
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 7);
  }
  return new Date().toISOString().slice(0, 7);
}

/**
 * Centralized, auditable calculation of Citykart's Net Eligible City Revenue
 * and the 50/50 Partner Revenue Share for a specific canonical `cityId`.
 *
 * STRICT POLICY ENFORCEMENT:
 * 1. Includes ONLY revenue actually collected by Citykart (`paid` platform fees,
 *    `SUCCESS` seller subscriptions, `SUCCESS` sponsored ad campaigns & value-added services)
 *    attributed to the canonical `cityId`.
 * 2. Excludes government taxes (`taxAmount` / 18% GST) — uses pre-tax `amount`.
 * 3. Excludes seller product sales (`COD`, `UPI_ON_DELIVERY` order GMV).
 * 4. Excludes uncollected/outstanding platform fees and pending/failed invoices.
 * 5. Deducts approved refunds and reversals (`REFUNDED` transactions, reversed paid fees).
 */
export function calculateCityPartnerRevenueReport(
  params: CalculateCityPartnerRevenueParams
): CityRevenueAttributionSummary {
  const targetCityId = (params.cityId || '').trim().toLowerCase();
  const periodFilter = (params.periodMonth || 'ALL').trim();
  const targetCurrency = params.currency || 'INR';
  const partnerSharePercent =
    typeof params.partnerSharePercent === 'number' &&
    params.partnerSharePercent >= 0 &&
    params.partnerSharePercent <= 100
      ? params.partnerSharePercent
      : DEFAULT_PARTNER_REVENUE_SHARE_PERCENT;
  const citykartRetainedPercent = roundCurrency2(100 - partnerSharePercent);

  // Map stores by ID and identify stores canonically attributed to `targetCityId`
  const storesById = new Map<string, LocalStore>();
  const cityStoreIds = new Set<string>();
  const sellerToCityStoreMap = new Map<string, LocalStore>();

  for (const st of params.stores) {
    storesById.set(st.id, st);
    if ((st.cityId || '').trim().toLowerCase() === targetCityId) {
      cityStoreIds.add(st.id);
      if (!sellerToCityStoreMap.has(st.sellerId)) {
        sellerToCityStoreMap.set(st.sellerId, st);
      }
    }
  }

  // Map orders by ID for platform fee attribution and GMV exclusion reporting
  const ordersById = new Map<string, OrderRecord>();
  let citySellerProductGmvExcluded = 0;

  for (const ord of params.orders) {
    ordersById.set(ord.id, ord);
    const ordStore = storesById.get(ord.storeId);
    const ordCityId = (
      (ord as unknown as { cityId?: string }).cityId ||
      ordStore?.cityId ||
      ''
    )
      .trim()
      .toLowerCase();

    if (ordCityId === targetCityId) {
      const ordMonth = extractYearMonth(ord.createdAt);
      if (periodFilter === 'ALL' || ordMonth === periodFilter) {
        if (ord.orderStatus !== 'CANCELLED') {
          // Seller product sales (COD / UPI_ON_DELIVERY) are NEVER Citykart revenue;
          // tracked strictly in `citySellerProductGmvExcluded`.
          citySellerProductGmvExcluded = roundCurrency2(
            citySellerProductGmvExcluded + (Number(ord.total) || 0)
          );
        }
      }
    }
  }

  let platformFeesCollected = 0;
  let subscriptionRevenueCollected = 0;
  let sponsoredAdRevenueCollected = 0;
  let valueAddedServiceRevenueCollected = 0;
  let refundsAndReversals = 0;
  let taxesExcludedTotal = 0;
  let uncollectedAccruedFeesExcluded = 0;
  let pendingOrFailedInvoicesExcluded = 0;

  const lineItems: CityEligibleRevenueItem[] = [];

  // 1. Evaluate Platform Fee Ledger Entries
  const ledgerList =
    params.platformFeeLedger ||
    Array.from(serverPlatformFeeLedgerRegistry.values());

  const seenLedgerIds = new Set<string>();
  for (const entry of ledgerList) {
    if (!entry || !entry.id || seenLedgerIds.has(entry.id)) continue;
    seenLedgerIds.add(entry.id);

    const entryCurrency = (entry.currency || 'INR').toUpperCase();
    if (entryCurrency !== targetCurrency) continue;

    // Resolve immutable city attribution via order -> store -> seller
    const linkedOrder = ordersById.get(entry.orderId);
    const linkedStore = linkedOrder
      ? storesById.get(linkedOrder.storeId)
      : sellerToCityStoreMap.get(entry.sellerId);

    const attributedCityId = (
      (entry as unknown as { cityId?: string }).cityId ||
      (linkedOrder as unknown as { cityId?: string })?.cityId ||
      linkedStore?.cityId ||
      ''
    )
      .trim()
      .toLowerCase();

    if (attributedCityId !== targetCityId) continue;

    const entryMonth = extractYearMonth(entry.updatedAt || entry.createdAt);
    if (periodFilter !== 'ALL' && entryMonth !== periodFilter) continue;

    const feeAmount = roundCurrency2(Number(entry.totalFee) || 0);
    if (feeAmount <= 0) continue;

    if (entry.status === 'paid') {
      platformFeesCollected = roundCurrency2(platformFeesCollected + feeAmount);
      lineItems.push({
        id: `rev_fee_${entry.id}`,
        sourceRecordId: entry.id,
        sourceType: 'PLATFORM_FEE',
        cityId: targetCityId,
        cityName:
          params.cityName || linkedStore?.cityName || targetCityId,
        storeId: linkedStore?.id || linkedOrder?.storeId || 'unknown',
        storeName:
          linkedStore?.name || linkedOrder?.storeName || 'City Merchant',
        sellerId: entry.sellerId,
        description: `Collected 2% order platform fee (Order #${entry.orderId})`,
        currency: targetCurrency,
        grossAmountCollected: feeAmount,
        taxAmountExcluded: 0,
        eligibleNetAmount: feeAmount,
        isRefundedOrReversed: false,
        refundOrReversalAmount: 0,
        periodMonth: entryMonth,
        collectedAt: entry.updatedAt || entry.createdAt,
      });
    } else if (
      entry.status === 'reversed' &&
      Boolean(entry.paidByTransactionId)
    ) {
      // Only a fee that was previously collected (`paidByTransactionId` present)
      // and subsequently reversed counts as a collected revenue reversal.
      platformFeesCollected = roundCurrency2(platformFeesCollected + feeAmount);
      refundsAndReversals = roundCurrency2(refundsAndReversals + feeAmount);
      lineItems.push({
        id: `rev_fee_reversal_${entry.id}`,
        sourceRecordId: entry.id,
        sourceType: 'PLATFORM_FEE',
        cityId: targetCityId,
        cityName:
          params.cityName || linkedStore?.cityName || targetCityId,
        storeId: linkedStore?.id || linkedOrder?.storeId || 'unknown',
        storeName:
          linkedStore?.name || linkedOrder?.storeName || 'City Merchant',
        sellerId: entry.sellerId,
        description: `Reversed previously collected platform fee (Order #${entry.orderId})`,
        currency: targetCurrency,
        grossAmountCollected: feeAmount,
        taxAmountExcluded: 0,
        eligibleNetAmount: 0,
        isRefundedOrReversed: true,
        refundOrReversalAmount: feeAmount,
        periodMonth: entryMonth,
        collectedAt: entry.updatedAt || entry.createdAt,
      });
    } else if (
      entry.status === 'outstanding' ||
      entry.status === 'pending_eligibility' ||
      entry.status === 'reserved_for_invoice'
    ) {
      // Uncollected platform fees MUST NOT be counted as collected partner revenue
      uncollectedAccruedFeesExcluded = roundCurrency2(
        uncollectedAccruedFeesExcluded + feeAmount
      );
    }
  }

  // 2. Evaluate Billing Transactions (Subscriptions, Sponsored Ads, Value-Added Services)
  const seenTxIds = new Set<string>();
  for (const tx of params.transactions) {
    if (!tx || !tx.id || seenTxIds.has(tx.id)) continue;
    seenTxIds.add(tx.id);

    const txCurrency = (tx.currency || 'INR').toUpperCase();
    if (txCurrency !== targetCurrency) continue;

    const txStore = storesById.get(tx.storeId);
    const attributedCityId = (
      (tx as unknown as { cityId?: string }).cityId ||
      txStore?.cityId ||
      ''
    )
      .trim()
      .toLowerCase();

    if (attributedCityId !== targetCityId) continue;

    const txMonth = extractYearMonth(tx.createdAt);
    if (periodFilter !== 'ALL' && txMonth !== periodFilter) continue;

    const grossTotal = roundCurrency2(Number(tx.totalAmount) || 0);
    const rawTax = roundCurrency2(Number(tx.taxAmount) || 0);
    // Pre-tax eligible base amount (strictly excluding GST / government taxes)
    const rawBaseAmount =
      typeof tx.amount === 'number' && Number.isFinite(tx.amount) && tx.amount > 0
        ? roundCurrency2(tx.amount)
        : roundCurrency2(Math.max(0, grossTotal - rawTax));
    const effectiveTax = roundCurrency2(Math.max(0, grossTotal - rawBaseAmount));

    const sourceType: EligibleRevenueSourceType =
      tx.type === 'SUBSCRIPTION'
        ? 'SELLER_SUBSCRIPTION'
        : tx.type === 'AD_CAMPAIGN'
          ? 'SPONSORED_AD'
          : 'VALUE_ADDED_SERVICE';

    if (tx.status === 'SUCCESS') {
      taxesExcludedTotal = roundCurrency2(taxesExcludedTotal + effectiveTax);

      if (sourceType === 'SELLER_SUBSCRIPTION') {
        subscriptionRevenueCollected = roundCurrency2(
          subscriptionRevenueCollected + rawBaseAmount
        );
      } else if (sourceType === 'SPONSORED_AD') {
        sponsoredAdRevenueCollected = roundCurrency2(
          sponsoredAdRevenueCollected + rawBaseAmount
        );
      } else {
        valueAddedServiceRevenueCollected = roundCurrency2(
          valueAddedServiceRevenueCollected + rawBaseAmount
        );
      }

      lineItems.push({
        id: `rev_tx_${tx.id}`,
        sourceRecordId: tx.id,
        sourceType,
        cityId: targetCityId,
        cityName: params.cityName || txStore?.cityName || targetCityId,
        storeId: tx.storeId,
        storeName: txStore?.name || 'City Merchant',
        sellerId: tx.sellerId,
        description: tx.description || `${tx.type} (${tx.invoiceNumber})`,
        currency: targetCurrency,
        grossAmountCollected: grossTotal,
        taxAmountExcluded: effectiveTax,
        eligibleNetAmount: rawBaseAmount,
        isRefundedOrReversed: false,
        refundOrReversalAmount: 0,
        periodMonth: txMonth,
        collectedAt: tx.createdAt,
      });
    } else if (tx.status === 'REFUNDED') {
      // A refunded transaction was collected and then refunded: record in both collected and refundsAndReversals
      taxesExcludedTotal = roundCurrency2(taxesExcludedTotal + effectiveTax);
      if (sourceType === 'SELLER_SUBSCRIPTION') {
        subscriptionRevenueCollected = roundCurrency2(
          subscriptionRevenueCollected + rawBaseAmount
        );
      } else if (sourceType === 'SPONSORED_AD') {
        sponsoredAdRevenueCollected = roundCurrency2(
          sponsoredAdRevenueCollected + rawBaseAmount
        );
      } else {
        valueAddedServiceRevenueCollected = roundCurrency2(
          valueAddedServiceRevenueCollected + rawBaseAmount
        );
      }
      refundsAndReversals = roundCurrency2(refundsAndReversals + rawBaseAmount);

      lineItems.push({
        id: `rev_tx_refund_${tx.id}`,
        sourceRecordId: tx.id,
        sourceType,
        cityId: targetCityId,
        cityName: params.cityName || txStore?.cityName || targetCityId,
        storeId: tx.storeId,
        storeName: txStore?.name || 'City Merchant',
        sellerId: tx.sellerId,
        description: `REFUNDED: ${tx.description || tx.invoiceNumber}`,
        currency: targetCurrency,
        grossAmountCollected: grossTotal,
        taxAmountExcluded: effectiveTax,
        eligibleNetAmount: 0,
        isRefundedOrReversed: true,
        refundOrReversalAmount: rawBaseAmount,
        periodMonth: txMonth,
        collectedAt: tx.createdAt,
      });
    } else if (tx.status === 'PENDING' || tx.status === 'FAILED') {
      pendingOrFailedInvoicesExcluded = roundCurrency2(
        pendingOrFailedInvoicesExcluded + grossTotal
      );
    }
  }

  const eligibleRevenueCollected = roundCurrency2(
    platformFeesCollected +
      subscriptionRevenueCollected +
      sponsoredAdRevenueCollected +
      valueAddedServiceRevenueCollected
  );

  const agreedDeductions = roundCurrency2(
    Math.max(0, Number(params.agreedDeductions) || 0)
  );

  // Formula: Net eligible city revenue = Eligible revenue actually collected - Approved refunds/reversals - Agreed deductions
  const netEligibleRevenue = roundCurrency2(
    Math.max(
      0,
      eligibleRevenueCollected - refundsAndReversals - agreedDeductions
    )
  );

  // Formula: Partner share = Net eligible city revenue * 50%
  const partnerShareAmount = roundCurrency2(
    netEligibleRevenue * (partnerSharePercent / 100)
  );

  // Formula: Citykart retained share = Net eligible city revenue - Partner share
  const citykartRetainedAmount = roundCurrency2(
    netEligibleRevenue - partnerShareAmount
  );

  lineItems.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));

  return {
    cityId: targetCityId,
    cityName: params.cityName || targetCityId,
    periodMonth: periodFilter,
    currency: targetCurrency,
    partnerSharePercent,
    citykartRetainedPercent,
    platformFeesCollected,
    subscriptionRevenueCollected,
    sponsoredAdRevenueCollected,
    valueAddedServiceRevenueCollected,
    eligibleRevenueCollected,
    refundsAndReversals,
    agreedDeductions,
    netEligibleRevenue,
    partnerShareAmount,
    citykartRetainedAmount,
    taxesExcludedTotal,
    uncollectedAccruedFeesExcluded,
    pendingOrFailedInvoicesExcluded,
    citySellerProductGmvExcluded,
    lineItems,
  };
}

// ============================================================================
// 11. MONTHLY SETTLEMENT GENERATION, APPROVAL & MANUAL PAYOUT WORKFLOW
// ============================================================================

export async function generateOrUpdateMonthlyPartnerSettlement(params: {
  partnerId: string;
  periodMonth: string; // YYYY-MM
  currency?: 'INR' | 'USD';
  agreedDeductions?: number;
  deductionNotes?: string;
  stores: LocalStore[];
  orders: OrderRecord[];
  transactions: BillingTransaction[];
  platformFeeLedger?: PlatformFeeLedgerEntry[];
  adminUid: string;
  isSuperAdmin: boolean;
}): Promise<{
  ok: boolean;
  settlement?: PartnerMonthlySettlementRecord;
  error?: string;
  statusCode?: number;
}> {
  if (!params.isSuperAdmin) {
    return {
      ok: false,
      error: 'Forbidden: Only Super Admin can generate monthly partner settlement statements.',
      statusCode: 403,
    };
  }

  const partner = serverCityPartnersRegistry.get(params.partnerId);
  if (!partner) {
    return {
      ok: false,
      error: 'Partner record not found.',
      statusCode: 404,
    };
  }

  const periodMonth = (params.periodMonth || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
    return {
      ok: false,
      error: 'Valid settlement period in YYYY-MM format is required (e.g., 2026-10).',
      statusCode: 400,
    };
  }

  const currency = params.currency || 'INR';
  const deterministicId = `stl_${partner.id}_${periodMonth}_${currency.toLowerCase()}`;

  // Prevent duplicate conflicting settlement records for the same partner + period + currency
  const existing = serverPartnerSettlementsRegistry.get(deterministicId);
  if (
    existing &&
    (existing.status === 'APPROVED' || existing.status === 'PAID')
  ) {
    return {
      ok: false,
      error: `Settlement statement ${existing.statementNumber} for ${periodMonth} is already ${existing.status}. Approved or paid settlements cannot be overwritten.`,
      statusCode: 409,
    };
  }

  // Calculate carry-over unpaid balance from prior approved/unpaid settlements before this period
  let beginningBalance = 0;
  for (const s of serverPartnerSettlementsRegistry.values()) {
    if (
      s.partnerId === partner.id &&
      s.currency === currency &&
      s.periodMonth < periodMonth &&
      (s.status === 'APPROVED' || s.status === 'PENDING_APPROVAL')
    ) {
      beginningBalance = roundCurrency2(
        beginningBalance + s.outstandingPayableBalance
      );
    }
  }

  const revenueReport = calculateCityPartnerRevenueReport({
    cityId: partner.assignedCityId,
    cityName: partner.assignedCityName,
    periodMonth,
    currency,
    partnerSharePercent: partner.revenueSharePercent,
    agreedDeductions: params.agreedDeductions,
    stores: params.stores,
    orders: params.orders,
    transactions: params.transactions,
    platformFeeLedger: params.platformFeeLedger,
  });

  const nowIso = new Date().toISOString();
  const statementNumber =
    existing?.statementNumber ||
    `STL-${periodMonth.replace('-', '')}-${partner.assignedCityName
      .slice(0, 3)
      .toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const totalPayableWithCarryover = roundCurrency2(
    beginningBalance + revenueReport.partnerShareAmount
  );
  const previouslyPaidAmount = roundCurrency2(
    existing?.previouslyPaidAmount || 0
  );
  const outstandingPayableBalance = roundCurrency2(
    Math.max(0, totalPayableWithCarryover - previouslyPaidAmount)
  );

  const settlement: PartnerMonthlySettlementRecord = {
    id: deterministicId,
    statementNumber,
    partnerId: partner.id,
    partnerUid: partner.partnerUid,
    partnerName: partner.fullName,
    partnerPhoneE164: partner.phoneE164,
    assignedCityId: partner.assignedCityId,
    assignedCityName: partner.assignedCityName,
    periodMonth,
    currency,
    beginningBalance,
    platformFeesCollected: revenueReport.platformFeesCollected,
    subscriptionRevenueCollected: revenueReport.subscriptionRevenueCollected,
    adAndServiceRevenueCollected: roundCurrency2(
      revenueReport.sponsoredAdRevenueCollected +
        revenueReport.valueAddedServiceRevenueCollected
    ),
    eligibleRevenueCollected: revenueReport.eligibleRevenueCollected,
    taxesExcluded: revenueReport.taxesExcludedTotal,
    refundsAndReversals: revenueReport.refundsAndReversals,
    agreedDeductions: revenueReport.agreedDeductions,
    deductionNotes: params.deductionNotes,
    netEligibleRevenue: revenueReport.netEligibleRevenue,
    partnerSharePercent: revenueReport.partnerSharePercent,
    partnerPayableAmount: revenueReport.partnerShareAmount,
    citykartRetainedAmount: revenueReport.citykartRetainedAmount,
    totalPayableWithCarryover,
    previouslyPaidAmount,
    outstandingPayableBalance,
    sourceRevenueRecordIds: revenueReport.lineItems.map(
      (li) => li.sourceRecordId
    ),
    status: 'PENDING_APPROVAL',
    generatedAt: existing?.generatedAt || nowIso,
    generatedByUid: params.adminUid,
    payments: existing?.payments || [],
    updatedAt: nowIso,
  };

  await persistPartnerSettlement(settlement);
  await createPartnerNotification({
    recipientUid: partner.partnerUid,
    recipientPhoneE164: partner.phoneE164,
    partnerId: partner.id,
    type: 'MONTHLY_STATEMENT_GENERATED',
    title: `Monthly Settlement Statement (${periodMonth})`,
    message: `Your monthly settlement statement ${statementNumber} for ${partner.assignedCityName} (${periodMonth}) has been generated and is pending review.`,
  });

  return { ok: true, settlement };
}

export async function approvePartnerSettlementStatement(params: {
  settlementId: string;
  adminUid: string;
  adminPhone: string;
  isSuperAdmin: boolean;
}): Promise<{
  ok: boolean;
  settlement?: PartnerMonthlySettlementRecord;
  error?: string;
  statusCode?: number;
}> {
  if (!params.isSuperAdmin) {
    return {
      ok: false,
      error: 'Forbidden: Only Super Admin can approve partner settlement statements.',
      statusCode: 403,
    };
  }

  const settlement = serverPartnerSettlementsRegistry.get(params.settlementId);
  if (!settlement) {
    return {
      ok: false,
      error: 'Settlement statement not found.',
      statusCode: 404,
    };
  }

  if (settlement.status === 'PAID') {
    return {
      ok: false,
      error: 'Settlement statement is already marked as PAID.',
      statusCode: 400,
    };
  }

  const nowIso = new Date().toISOString();
  // IMPORTANT: Approving a settlement statement does NOT mark it as PAID.
  // Payment requires a separate manual bank transfer recording step.
  const updated: PartnerMonthlySettlementRecord = {
    ...settlement,
    status: 'APPROVED',
    approvedAt: nowIso,
    approvedByUid: params.adminUid,
    approvedByPhone: params.adminPhone,
    updatedAt: nowIso,
  };

  await persistPartnerSettlement(updated);
  await createPartnerNotification({
    recipientUid: settlement.partnerUid,
    recipientPhoneE164: settlement.partnerPhoneE164,
    partnerId: settlement.partnerId,
    type: 'SETTLEMENT_APPROVED',
    title: `Settlement Approved (${settlement.statementNumber})`,
    message: `Your monthly settlement statement ${settlement.statementNumber} (${settlement.periodMonth}) has been approved for manual bank transfer payout.`,
  });

  return { ok: true, settlement: updated };
}

export async function recordManualPartnerSettlementPayout(params: {
  settlementId: string;
  amountPaid: number;
  currency: 'INR' | 'USD';
  paymentDate: string;
  paymentMethod: 'NEFT' | 'RTGS' | 'IMPS' | 'BANK_TRANSFER';
  paymentReferenceNumber: string;
  notes?: string;
  proofDocumentUrl?: string;
  adminUid: string;
  adminPhone: string;
  isSuperAdmin: boolean;
}): Promise<{
  ok: boolean;
  settlement?: PartnerMonthlySettlementRecord;
  payment?: PartnerSettlementPaymentRecord;
  error?: string;
  statusCode?: number;
}> {
  if (!params.isSuperAdmin) {
    return {
      ok: false,
      error: 'Forbidden: Only Super Admin can record manual bank transfer payouts.',
      statusCode: 403,
    };
  }

  const settlement = serverPartnerSettlementsRegistry.get(params.settlementId);
  if (!settlement) {
    return {
      ok: false,
      error: 'Settlement statement not found.',
      statusCode: 404,
    };
  }

  if (settlement.status !== 'APPROVED' && settlement.status !== 'PAID') {
    return {
      ok: false,
      error: `Settlement ${settlement.statementNumber} must be APPROVED before a manual bank transfer payout can be recorded (current status: ${settlement.status}).`,
      statusCode: 400,
    };
  }

  const cleanRef = (params.paymentReferenceNumber || '').trim();
  if (!cleanRef || cleanRef.length < 4) {
    return {
      ok: false,
      error:
        'A valid manual bank transfer reference / UTR number is required before marking a settlement as paid.',
      statusCode: 400,
    };
  }

  // Prevent duplicate payment reference numbers (UTR) across ALL settlements
  for (const existingStl of serverPartnerSettlementsRegistry.values()) {
    if (
      existingStl.payments.some(
        (p) => p.paymentReferenceNumber.toLowerCase() === cleanRef.toLowerCase()
      )
    ) {
      return {
        ok: false,
        error: `Payment reference / UTR "${cleanRef}" has already been recorded on settlement ${existingStl.statementNumber}. Duplicate payment references are rejected.`,
        statusCode: 409,
      };
    }
  }

  const amountPaid = roundCurrency2(Number(params.amountPaid) || 0);
  if (amountPaid <= 0) {
    return {
      ok: false,
      error: 'Payout amount must be greater than zero.',
      statusCode: 400,
    };
  }

  if (amountPaid > roundCurrency2(settlement.outstandingPayableBalance + 0.01)) {
    return {
      ok: false,
      error: `Payout amount (${amountPaid}) cannot exceed the outstanding payable balance (${settlement.outstandingPayableBalance}).`,
      statusCode: 400,
    };
  }

  const nowIso = new Date().toISOString();
  const paymentRecord: PartnerSettlementPaymentRecord = {
    id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    settlementId: settlement.id,
    partnerId: settlement.partnerId,
    cityId: settlement.assignedCityId,
    amountPaid,
    currency: params.currency || settlement.currency,
    paymentDate: params.paymentDate || nowIso.slice(0, 10),
    paymentMethod: params.paymentMethod || 'NEFT',
    paymentReferenceNumber: cleanRef,
    notes: (params.notes || '').trim(),
    proofDocumentUrl: (params.proofDocumentUrl || '').trim(),
    recordedByAdminUid: params.adminUid,
    recordedByAdminPhone: params.adminPhone,
    recordedAt: nowIso,
  };

  const newPreviouslyPaid = roundCurrency2(
    settlement.previouslyPaidAmount + amountPaid
  );
  const newOutstanding = roundCurrency2(
    Math.max(0, settlement.totalPayableWithCarryover - newPreviouslyPaid)
  );
  const isFullyPaid = newOutstanding <= 0.009;

  const updated: PartnerMonthlySettlementRecord = {
    ...settlement,
    previouslyPaidAmount: newPreviouslyPaid,
    outstandingPayableBalance: isFullyPaid ? 0 : newOutstanding,
    status: isFullyPaid ? 'PAID' : 'APPROVED',
    paidAt: isFullyPaid ? nowIso : settlement.paidAt,
    payments: [...settlement.payments, paymentRecord],
    updatedAt: nowIso,
  };

  await persistPartnerSettlement(updated);
  await createPartnerNotification({
    recipientUid: settlement.partnerUid,
    recipientPhoneE164: settlement.partnerPhoneE164,
    partnerId: settlement.partnerId,
    type: 'SETTLEMENT_PAYOUT_RECORDED',
    title: `Manual Payout Recorded (${settlement.statementNumber})`,
    message: `A manual bank transfer of ${updated.currency} ${amountPaid} (UTR/Ref: ${cleanRef}) has been recorded for statement ${settlement.statementNumber}.`,
  });

  return { ok: true, settlement: updated, payment: paymentRecord };
}

export async function markPartnerNotificationRead(params: {
  notificationId: string;
  callerUid: string;
  callerPhoneE164: string;
}): Promise<boolean> {
  const existing = serverPartnerNotificationsRegistry.get(
    params.notificationId
  );
  if (!existing) return false;
  if (
    existing.recipientPhoneE164 !== params.callerPhoneE164 &&
    existing.recipientUid !== params.callerUid
  ) {
    return false;
  }
  const updated: PartnerNotificationRecord = {
    ...existing,
    isRead: true,
  };
  serverPartnerNotificationsRegistry.set(params.notificationId, updated);
  try {
    await setDoc(doc(db, 'partnerNotifications', updated.id), updated, {
      merge: true,
    });
  } catch {}
  return true;
}

