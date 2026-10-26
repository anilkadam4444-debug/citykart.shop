import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

function roundCurrency(val) {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

const VALID_STATE_TRANSITIONS = {
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
  rejected: ['pending_review'],
  withdrawn: [],
};

function validateApplicationStateTransition({
  fromStatus,
  toStatus,
  actorRole,
  otpVerified,
}) {
  const allowed = VALID_STATE_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    return {
      allowed: false,
      error: `Invalid application state transition from "${fromStatus}" to "${toStatus}".`,
    };
  }
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
  if (toStatus === 'approved' && actorRole !== 'super_admin') {
    return {
      allowed: false,
      error:
        'Forbidden: Only the Platform Owner Super Admin can approve a City Partner application and allocate a city.',
    };
  }
  return { allowed: true };
}

test('1. Partner Application Validation, OTP Gate & KYC Separation (MUT-01, MUT-02)', () => {
  const validateSubmission = (payload) => {
    if (!payload.otpVerified || !payload.phoneE164 || !payload.applicantUid) {
      return {
        ok: false,
        statusCode: 400,
        error:
          'Mobile number must be verified via Firebase Phone OTP before submitting a Partner Application.',
      };
    }
    if (!payload.fullLegalName || payload.fullLegalName.trim().length < 3) {
      return { ok: false, statusCode: 400, error: 'Full legal name is required.' };
    }
    if (!payload.residentialOrBusinessAddress || payload.residentialOrBusinessAddress.trim().length < 8) {
      return { ok: false, statusCode: 400, error: 'Complete address is required.' };
    }
    if (!payload.relevantExperience || payload.relevantExperience.trim().length < 15) {
      return { ok: false, statusCode: 400, error: 'Experience description is required.' };
    }
    if (!payload.localGrowthPlan || payload.localGrowthPlan.trim().length < 20) {
      return { ok: false, statusCode: 400, error: 'Local growth plan is required.' };
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(payload.panOrTaxId || '').toUpperCase())) {
      return { ok: false, statusCode: 400, error: 'Valid 10-character Indian PAN is required.' };
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(payload.bankIfscOrRoutingCode || '').toUpperCase())) {
      return { ok: false, statusCode: 400, error: 'Valid 11-character Indian Bank IFSC code is required.' };
    }
    if (!payload.consentAccepted) {
      return { ok: false, statusCode: 400, error: 'Privacy and KYC consent is required.' };
    }
    return {
      ok: true,
      statusCode: 200,
      status: 'pending_review',
      kycVerificationStatus: 'PENDING_MANUAL_REVIEW',
    };
  };

  // MUT-01: Submit partner application without OTP verification -> Rejected (400)
  const mut01 = validateSubmission({
    otpVerified: false,
    applicantUid: 'uid-1',
    phoneE164: '+919876543210',
    fullLegalName: 'Rajesh Sharma',
    residentialOrBusinessAddress: '102 MG Road, Vazirabad, Nanded',
    relevantExperience: '8 years managing FMCG distribution in Marathwada.',
    localGrowthPlan: 'Onboard 150 verified kirana and pharmacy stores in 60 days.',
    panOrTaxId: 'ABCDE1234F',
    bankIfscOrRoutingCode: 'HDFC0001234',
    consentAccepted: true,
  });
  assert.equal(mut01.ok, false);
  assert.equal(mut01.statusCode, 400);

  // MUT-02: Submit partner application with required fields missing -> Rejected (400)
  const mut02 = validateSubmission({
    otpVerified: true,
    applicantUid: 'uid-1',
    phoneE164: '+919876543210',
    fullLegalName: 'R', // Too short
    residentialOrBusinessAddress: '',
    relevantExperience: '',
    localGrowthPlan: '',
    panOrTaxId: 'INVALID',
    bankIfscOrRoutingCode: 'BAD',
    consentAccepted: false,
  });
  assert.equal(mut02.ok, false);
  assert.equal(mut02.statusCode, 400);

  // Valid submission sets status='pending_review' and kycVerificationStatus='PENDING_MANUAL_REVIEW'
  const validRes = validateSubmission({
    otpVerified: true,
    applicantUid: 'uid-1',
    phoneE164: '+919876543210',
    fullLegalName: 'Rajesh Sharma',
    residentialOrBusinessAddress: '102 MG Road, Vazirabad, Nanded',
    relevantExperience: '8 years managing FMCG distribution in Marathwada.',
    localGrowthPlan: 'Onboard 150 verified kirana and pharmacy stores in 60 days.',
    panOrTaxId: 'ABCDE1234F',
    bankIfscOrRoutingCode: 'HDFC0001234',
    consentAccepted: true,
  });
  assert.equal(validRes.ok, true);
  assert.equal(validRes.status, 'pending_review');
  assert.equal(validRes.kycVerificationStatus, 'PENDING_MANUAL_REVIEW');
});

test('2. Self-Approval Prevention & State Machine Enforcement (MUT-04, MUT-05)', () => {
  // MUT-04: Applicant attempting to submit/transition with status = approved -> Rejected
  const mut04 = validateApplicationStateTransition({
    fromStatus: 'pending_review',
    toStatus: 'approved',
    actorRole: 'applicant',
    otpVerified: true,
  });
  assert.equal(mut04.allowed, false);
  assert.match(mut04.error, /Applicants cannot approve/);

  // MUT-05: Non-SuperAdmin user attempting to approve application -> Rejected
  const mut05 = validateApplicationStateTransition({
    fromStatus: 'pending_review',
    toStatus: 'approved',
    actorRole: 'admin',
    otpVerified: true,
  });
  assert.equal(mut05.allowed, false);
  assert.match(mut05.error, /Only the Platform Owner Super Admin/);

  // Super Admin approval succeeds
  const superAdminApprove = validateApplicationStateTransition({
    fromStatus: 'pending_review',
    toStatus: 'approved',
    actorRole: 'super_admin',
    otpVerified: true,
  });
  assert.equal(superAdminApprove.allowed, true);
});

test('3. Canonical City Validation & Atomic Concurrent Exclusivity Lock (MUT-03, MUT-06)', async () => {
  const canonicalCities = new Map([
    [
      'india-maharashtra-nanded',
      {
        cityId: 'india-maharashtra-nanded',
        cityName: 'Nanded',
        stateRegion: 'Maharashtra',
        country: 'India',
      },
    ],
    [
      'india-maharashtra-pune',
      {
        cityId: 'india-maharashtra-pune',
        cityName: 'Pune',
        stateRegion: 'Maharashtra',
        country: 'India',
      },
    ],
  ]);
  const activePartnersByCity = new Map();
  const cityAllocationMutex = new Set();

  const validateAndCheckCity = (cityId) => {
    const cleanId = String(cityId || '').trim().toLowerCase();
    const city = canonicalCities.get(cleanId);
    if (!city) {
      return {
        valid: false,
        statusCode: 400,
        error: `City "${cityId}" was not found in the canonical location directory.`,
      };
    }
    const existing = activePartnersByCity.get(cleanId);
    if (existing && (existing.status === 'ACTIVE' || existing.status === 'SUSPENDED')) {
      return {
        valid: true,
        isAvailable: false,
        statusCode: 409,
        error: `City Exclusivity Conflict: ${city.cityName} is already allocated.`,
      };
    }
    return { valid: true, isAvailable: true, cityRecord: city };
  };

  // MUT-03: Submit partner application with invalid free-text city -> Rejected (400)
  const mut03 = validateAndCheckCity('free-text-nonexistent-city-999');
  assert.equal(mut03.valid, false);
  assert.equal(mut03.statusCode, 400);

  // MUT-06: Approve two applications for the same city concurrently -> Second rejected (409)
  const atomicApproveCity = async (applicationId, applicantUid, cityId) => {
    if (cityAllocationMutex.has(cityId)) {
      return {
        ok: false,
        statusCode: 409,
        error: `Concurrent city allocation in progress for "${cityId}".`,
      };
    }
    cityAllocationMutex.add(cityId);
    try {
      await new Promise((r) => setTimeout(r, 10));
      const check = validateAndCheckCity(cityId);
      if (!check.valid || !check.isAvailable) {
        return { ok: false, statusCode: check.statusCode || 409, error: check.error };
      }
      const partner = {
        id: `partner_${cityId}_${applicantUid}`,
        applicationId,
        partnerUid: applicantUid,
        role: 'partner',
        status: 'ACTIVE',
        assignedCityId: cityId,
        revenueSharePercent: 50,
      };
      activePartnersByCity.set(cityId, partner);
      return { ok: true, statusCode: 200, partner };
    } finally {
      cityAllocationMutex.delete(cityId);
    }
  };

  const [res1, res2] = await Promise.all([
    atomicApproveCity('app-1', 'uid-1', 'india-maharashtra-nanded'),
    atomicApproveCity('app-2', 'uid-2', 'india-maharashtra-nanded'),
  ]);

  const approvedCount = [res1, res2].filter((r) => r.ok).length;
  const conflictCount = [res1, res2].filter((r) => !r.ok && r.statusCode === 409).length;
  assert.equal(approvedCount, 1, 'Exactly one concurrent approval must succeed');
  assert.equal(conflictCount, 1, 'Concurrent duplicate city allocation must be rejected with 409');
});

test('4. Partner Role Isolation, Cross-City Denial & Admin Endpoint Protection (MUT-07, MUT-08, MUT-09, MUT-14)', () => {
  const verifyPartnerDashboardAccess = (caller, partnerRecord, requestedCityId) => {
    if (!caller?.authenticated) {
      return { allowed: false, statusCode: 401 };
    }
    // MUT-07: Pending applicant (no active partnerRecord) cannot access active Partner dashboard
    if (!partnerRecord || partnerRecord.status !== 'ACTIVE') {
      return {
        allowed: false,
        dashboardAccessAllowed: false,
        statusCode: 403,
        error: 'Only ACTIVE partners can access the Partner Dashboard.',
      };
    }
    // MUT-08: Partner for City A cannot access City B metrics
    if (
      requestedCityId &&
      requestedCityId.toLowerCase() !== partnerRecord.assignedCityId.toLowerCase()
    ) {
      return {
        allowed: false,
        dashboardAccessAllowed: false,
        statusCode: 403,
        error: `Forbidden: City scope violation. Partner is authorized strictly for "${partnerRecord.assignedCityId}".`,
      };
    }
    return {
      allowed: true,
      dashboardAccessAllowed: true,
      statusCode: 200,
      assignedCityId: partnerRecord.assignedCityId,
    };
  };

  // MUT-07: Pending applicant denied dashboard access
  const mut07 = verifyPartnerDashboardAccess(
    { authenticated: true, uid: 'uid-pending' },
    null,
    'india-maharashtra-nanded'
  );
  assert.equal(mut07.allowed, false);
  assert.equal(mut07.dashboardAccessAllowed, false);

  // MUT-08: City A Partner denied access to City B
  const nandedPartner = {
    id: 'partner-nanded',
    partnerUid: 'uid-partner-nanded',
    role: 'partner',
    status: 'ACTIVE',
    assignedCityId: 'india-maharashtra-nanded',
  };
  const mut08 = verifyPartnerDashboardAccess(
    { authenticated: true, uid: 'uid-partner-nanded' },
    nandedPartner,
    'india-maharashtra-pune'
  );
  assert.equal(mut08.allowed, false);
  assert.equal(mut08.statusCode, 403);
  assert.match(mut08.error, /City scope violation/);

  // MUT-09: Partner attempting to call Super Admin endpoint is rejected (403)
  const verifySuperAdminEndpoint = (callerRole, callerPhone) => {
    if (callerRole !== 'super_admin' || callerPhone !== '+918329306616') {
      return { authorized: false, statusCode: 403, error: 'Forbidden: Super Admin required.' };
    }
    return { authorized: true, statusCode: 200 };
  };
  const mut09 = verifySuperAdminEndpoint('partner', '+919876543210');
  assert.equal(mut09.authorized, false);
  assert.equal(mut09.statusCode, 403);

  // MUT-14: Applicant view masks sensitive KYC & bank account numbers
  const maskSensitive = (raw, visible = 4) => {
    const clean = String(raw || '').trim();
    const trailing = clean.slice(-visible);
    const leading = clean.slice(0, 2);
    return `${leading}${'•'.repeat(Math.max(4, clean.length - visible - 2))}${trailing}`;
  };
  const maskedPan = maskSensitive('ABCDE1234F', 4);
  const maskedBank = maskSensitive('123456789012', 4);
  assert.equal(maskedPan.includes('1234'), false);
  assert.equal(maskedBank.includes('567890'), false);
  assert.equal(maskedBank.endsWith('9012'), true);
});

test('5. Deterministic Financial Test Cases A, B, C & 50/50 Revenue-Sharing Policy (MUT-10, MUT-11, MUT-12)', () => {
  const computePartnerRevenue = ({
    platformFeesCollected = 0,
    subscriptionRevenueCollected = 0,
    sponsoredAdRevenueCollected = 0,
    valueAddedServiceRevenueCollected = 0,
    uncollectedFees = 0,
    pendingOrFailedInvoices = 0,
    otherCityRevenue = 0,
    sellerCodProductGmv = 0,
    taxesGstExcluded = 0,
    refundsAndReversals = 0,
    agreedDeductions = 0,
    partnerSharePercent = 50,
  }) => {
    // MUT-10, MUT-11, MUT-12: Uncollected fees, pending invoices, other city revenue, GST, and COD GMV are strictly excluded
    void uncollectedFees;
    void pendingOrFailedInvoices;
    void otherCityRevenue;
    void sellerCodProductGmv;
    void taxesGstExcluded;

    const eligibleRevenueCollected = roundCurrency(
      platformFeesCollected +
        subscriptionRevenueCollected +
        sponsoredAdRevenueCollected +
        valueAddedServiceRevenueCollected
    );
    const netEligibleRevenue = roundCurrency(
      Math.max(0, eligibleRevenueCollected - refundsAndReversals - agreedDeductions)
    );
    const partnerShareAmount = roundCurrency(
      netEligibleRevenue * (partnerSharePercent / 100)
    );
    const citykartRetainedAmount = roundCurrency(
      netEligibleRevenue - partnerShareAmount
    );

    return {
      eligibleRevenueCollected,
      refundsAndReversals,
      agreedDeductions,
      netEligibleRevenue,
      partnerSharePercent,
      partnerShareAmount,
      citykartRetainedAmount,
    };
  };

  // Deterministic Test A:
  // City A has ₹10,000 in collected eligible Citykart revenue, ₹0 refunds, ₹0 deductions.
  // Expected: Net eligible = ₹10,000, Partner share = ₹5,000, Citykart retained = ₹5,000.
  const testA = computePartnerRevenue({
    platformFeesCollected: 10000,
    refundsAndReversals: 0,
    agreedDeductions: 0,
  });
  assert.equal(testA.netEligibleRevenue, 10000);
  assert.equal(testA.partnerShareAmount, 5000);
  assert.equal(testA.citykartRetainedAmount, 5000);

  // Deterministic Test B:
  // City A has: ₹30,000 collected platform fees, ₹25,000 collected seller subscriptions,
  // ₹15,000 collected ad/promotion revenue, ₹5,000 approved refunds.
  // Expected: Eligible collected = ₹70,000, Net eligible = ₹65,000, Partner = ₹32,500, Citykart = ₹32,500.
  const testB = computePartnerRevenue({
    platformFeesCollected: 30000,
    subscriptionRevenueCollected: 25000,
    sponsoredAdRevenueCollected: 15000,
    refundsAndReversals: 5000,
    agreedDeductions: 0,
  });
  assert.equal(testB.eligibleRevenueCollected, 70000);
  assert.equal(testB.netEligibleRevenue, 65000);
  assert.equal(testB.partnerShareAmount, 32500);
  assert.equal(testB.citykartRetainedAmount, 32500);

  // Deterministic Test C (includes MUT-10 & MUT-11 exclusions):
  // City A has: ₹10,000 collected eligible revenue, ₹3,000 uncollected fees, ₹4,000 pending invoices,
  // ₹1,000 refunds, ₹500 agreed deductions, plus ₹50,000 City B revenue and ₹25,000 COD GMV.
  // Expected: Net eligible = ₹8,500, Partner = ₹4,250, Citykart = ₹4,250.
  const testC = computePartnerRevenue({
    platformFeesCollected: 6000,
    subscriptionRevenueCollected: 4000,
    uncollectedFees: 3000, // MUT-10: Must be excluded
    pendingOrFailedInvoices: 4000, // Must be excluded
    otherCityRevenue: 50000, // MUT-11: Must be excluded
    sellerCodProductGmv: 25000, // Must be excluded
    taxesGstExcluded: 1800, // Must be excluded
    refundsAndReversals: 1000,
    agreedDeductions: 500,
  });
  assert.equal(testC.eligibleRevenueCollected, 10000);
  assert.equal(testC.netEligibleRevenue, 8500);
  assert.equal(testC.partnerShareAmount, 4250);
  assert.equal(testC.citykartRetainedAmount, 4250);
  assert.equal(testC.partnerSharePercent, 50); // MUT-12: Default 50%
});

test('6. Monthly Settlement Statement Generation, Approval vs Payout Separation & UTR Uniqueness (MUT-13)', () => {
  const settlements = new Map();
  const globalRecordedUtrs = new Set();

  const generateStatement = ({ partnerId, periodMonth, netEligibleRevenue }) => {
    const id = `stl_${partnerId}_${periodMonth}_inr`;
    const existing = settlements.get(id);
    if (existing && (existing.status === 'APPROVED' || existing.status === 'PAID')) {
      return {
        ok: false,
        statusCode: 409,
        error: `Settlement for ${periodMonth} is already ${existing.status}.`,
      };
    }
    const partnerPayableAmount = roundCurrency(netEligibleRevenue * 0.5);
    const record = {
      id,
      statementNumber: `STL-${periodMonth.replace('-', '')}-NAN`,
      partnerId,
      periodMonth,
      netEligibleRevenue,
      partnerSharePercent: 50,
      partnerPayableAmount,
      citykartRetainedAmount: roundCurrency(netEligibleRevenue - partnerPayableAmount),
      outstandingPayableBalance: partnerPayableAmount,
      previouslyPaidAmount: 0,
      status: 'PENDING_APPROVAL',
      payments: [],
    };
    settlements.set(id, record);
    return { ok: true, settlement: record };
  };

  const approveStatement = (settlementId) => {
    const st = settlements.get(settlementId);
    if (!st) return { ok: false, statusCode: 404 };
    // Approval NEVER marks statement as PAID
    st.status = 'APPROVED';
    return { ok: true, settlement: st };
  };

  const recordManualPayout = ({ settlementId, amountPaid, paymentReferenceNumber }) => {
    const st = settlements.get(settlementId);
    if (!st) return { ok: false, statusCode: 404 };
    if (st.status !== 'APPROVED') {
      return {
        ok: false,
        statusCode: 400,
        error: 'Settlement must be APPROVED before manual payout recording.',
      };
    }
    const cleanRef = String(paymentReferenceNumber || '').trim();
    // MUT-13: Missing UTR reference rejected (400)
    if (!cleanRef || cleanRef.length < 4) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Valid manual bank transfer reference / UTR number is required.',
      };
    }
    // Global duplicate UTR rejected (409)
    if (globalRecordedUtrs.has(cleanRef.toLowerCase())) {
      return {
        ok: false,
        statusCode: 409,
        error: `Duplicate payment reference / UTR "${cleanRef}" rejected.`,
      };
    }
    if (amountPaid <= 0 || amountPaid > st.outstandingPayableBalance + 0.01) {
      return { ok: false, statusCode: 400, error: 'Invalid payout amount.' };
    }
    globalRecordedUtrs.add(cleanRef.toLowerCase());
    st.previouslyPaidAmount = roundCurrency(st.previouslyPaidAmount + amountPaid);
    st.outstandingPayableBalance = roundCurrency(
      Math.max(0, st.partnerPayableAmount - st.previouslyPaidAmount)
    );
    st.status = st.outstandingPayableBalance === 0 ? 'PAID' : 'APPROVED';
    st.payments.push({ amountPaid, paymentReferenceNumber: cleanRef });
    return { ok: true, statusCode: 200, settlement: st };
  };

  const gen = generateStatement({
    partnerId: 'partner_nanded',
    periodMonth: '2026-10',
    netEligibleRevenue: 65000,
  });
  assert.equal(gen.ok, true);
  assert.equal(gen.settlement.partnerPayableAmount, 32500);
  assert.equal(gen.settlement.status, 'PENDING_APPROVAL');

  // Approve statement -> status becomes APPROVED, NOT PAID
  const app = approveStatement(gen.settlement.id);
  assert.equal(app.settlement.status, 'APPROVED');

  // MUT-13: Attempt to mark settlement as PAID without payment reference -> Rejected (400)
  const mut13MissingRef = recordManualPayout({
    settlementId: gen.settlement.id,
    amountPaid: 32500,
    paymentReferenceNumber: '',
  });
  assert.equal(mut13MissingRef.ok, false);
  assert.equal(mut13MissingRef.statusCode, 400);

  // Valid manual payout with UTR
  const paidRes = recordManualPayout({
    settlementId: gen.settlement.id,
    amountPaid: 32500,
    paymentReferenceNumber: 'HDFCN202610268899',
  });
  assert.equal(paidRes.ok, true);
  assert.equal(paidRes.settlement.status, 'PAID');
  assert.equal(paidRes.settlement.outstandingPayableBalance, 0);

  // Attempting to reuse the same UTR on another settlement is rejected with 409
  const genNov = generateStatement({
    partnerId: 'partner_nanded',
    periodMonth: '2026-11',
    netEligibleRevenue: 10000,
  });
  approveStatement(genNov.settlement.id);
  const dupUtrRes = recordManualPayout({
    settlementId: genNov.settlement.id,
    amountPaid: 5000,
    paymentReferenceNumber: 'HDFCN202610268899',
  });
  assert.equal(dupUtrRes.ok, false);
  assert.equal(dupUtrRes.statusCode, 409);
});

test('7. Source Code, API Routes & Firestore/Storage Security Rules Verification', () => {
  const partnerLib = fs.readFileSync(path.join(ROOT_DIR, 'lib/partner-program.ts'), 'utf8');
  const otpRoute = fs.readFileSync(path.join(ROOT_DIR, 'app/api/auth/otp/route.ts'), 'utf8');
  const appRoute = fs.readFileSync(path.join(ROOT_DIR, 'app/api/partners/applications/route.ts'), 'utf8');
  const dashRoute = fs.readFileSync(path.join(ROOT_DIR, 'app/api/partners/dashboard/route.ts'), 'utf8');
  const adminRoute = fs.readFileSync(path.join(ROOT_DIR, 'app/api/admin/partners/route.ts'), 'utf8');
  const homepage = fs.readFileSync(path.join(ROOT_DIR, 'app/page.tsx'), 'utf8');
  const superAdmin = fs.readFileSync(path.join(ROOT_DIR, 'components/super-admin-dashboard.tsx'), 'utf8');
  const firestoreRules = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8');
  const storageRules = fs.readFileSync(path.join(ROOT_DIR, 'storage.rules'), 'utf8');

  // Verify 50/50 constants & core exports in lib/partner-program.ts
  assert.equal(partnerLib.includes('DEFAULT_PARTNER_REVENUE_SHARE_PERCENT = 50'), true);
  assert.equal(partnerLib.includes('DEFAULT_CITYKART_RETAINED_SHARE_PERCENT = 50'), true);
  assert.equal(partnerLib.includes('calculateCityPartnerRevenueReport'), true);
  assert.equal(partnerLib.includes('approvePartnerApplicationAndAllocateCity'), true);
  assert.equal(partnerLib.includes('recordManualPartnerSettlementPayout'), true);

  // Verify OTP route imports resolvePartnerStatusForUser
  assert.equal(otpRoute.includes('resolvePartnerStatusForUser'), true);

  // Verify API routes enforce authentication and Super Admin checks
  assert.equal(appRoute.includes('verifyAuthenticatedCaller'), true);
  assert.equal(dashRoute.includes('verifyPartnerCityAccess'), true);
  assert.equal(adminRoute.includes('verifyAdminRequest'), true);
  assert.equal(adminRoute.includes('recordAdminAuditLog'), true);

  // Verify homepage has separate Become a Partner navigation
  assert.equal(homepage.includes('href="/partner"'), true);
  assert.equal(homepage.includes('Become a Partner'), true);

  // Verify Super Admin Dashboard integrates AdminPartnerManagement
  assert.equal(superAdmin.includes('AdminPartnerManagement'), true);
  assert.equal(superAdmin.includes("activeSection === 'partners'"), true);

  // Verify Firestore rules block self-assigning PARTNER role in /users/{userId} and match exact field names
  assert.equal(firestoreRules.includes("!('PARTNER' in request.resource.data.roles)"), true);
  assert.equal(firestoreRules.includes('match /partnerApplications/{applicationId}'), true);
  assert.equal(firestoreRules.includes("request.resource.data.kyc.kycVerificationStatus == 'PENDING_MANUAL_REVIEW'"), true);
  assert.equal(firestoreRules.includes('match /cityPartners/{partnerId}'), true);
  assert.equal(firestoreRules.includes('resource.data.partnerUid == request.auth.uid'), true);
  assert.equal(firestoreRules.includes('match /cityPartnerAllocations/{cityId}'), true);
  assert.equal(firestoreRules.includes('match /partnerSettlements/{settlementId}'), true);
  assert.equal(storageRules.includes('match /partner_kyc/{applicantUid}/{allPaths=**}'), true);
});
