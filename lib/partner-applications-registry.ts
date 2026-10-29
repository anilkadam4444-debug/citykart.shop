import { PartnerApplicationRecord, PartnerApplicationStatus } from '@/lib/partner-program';

export interface PartnerApplication extends PartnerApplicationRecord {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  cityName: string;
  cityId: string;
  investmentTier?: string;
  status: PartnerApplicationStatus;
  createdAt: string;
  phoneE164: string;
  commissionPct?: number;
  submittedAt: string;
}

const seedCreatedAt = new Date().toISOString();

export const partnerApplications = new Map<string, PartnerApplication>([
  [
    'PART-001',
    {
      id: 'PART-001',
      referenceId: 'CK-PARTNER-2026-0001',
      fullName: 'Anil Kadam',
      fullLegalName: 'Anil Kadam',
      phone: '+918329306616',
      phoneE164: '+918329306616',
      otpVerified: true,
      email: 'anilkadam4444@gmail.com',
      residentialOrBusinessAddress: 'Shivaji Nagar, Nanded, Maharashtra 431602',
      countryCode: 'IN',
      stateRegion: 'Maharashtra',
      cityName: 'Nanded',
      cityId: 'nanded-in',
      district: 'Nanded',
      postalCode: '431602',
      relevantExperience: 'Local retail operations & hyperlocal merchant onboarding across Nanded.',
      localGrowthPlan: 'Onboard 150+ verified neighborhood stores across Nanded within 90 days.',
      investmentTier: 'EXCLUSIVE_CITY_PARTNER',
      status: 'APPROVED',
      commissionPct: 50,
      kyc: {
        identityDocType: 'PAN_CARD',
        identityDocNumber: 'ABCDE1234F',
        addressProofType: 'AADHAAR',
        panOrTaxId: 'ABCDE1234F',
        bankAccountHolderName: 'Anil Kadam',
        bankAccountNumber: 'XXXX4416',
        bankIfscOrRoutingCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        kycVerificationStatus: 'VERIFIED',
      },
      createdAt: seedCreatedAt,
      submittedAt: seedCreatedAt,
    },
  ],
]);

export function getPartnerApplications(): PartnerApplication[] {
  return Array.from(partnerApplications.values());
}

export function savePartnerApplication(app: PartnerApplication): void {
  partnerApplications.set(app.id, app);
}

export function updatePartnerApplicationStatus(
  id: string,
  status: PartnerApplicationStatus
): boolean {
  const match = partnerApplications.get(id);
  if (match) {
    match.status = status;
    return true;
  }
  return false;
}

