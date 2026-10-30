import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3000';

async function postJson(endpoint, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function getJson(endpoint, headers = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: { ...headers },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

describe('E2E City Partner Onboarding & Partner Console Operations', () => {
  const testPhone = `+919820${Math.floor(100000 + Math.random() * 900000)}`;
  const withdrawPhone = `+919830${Math.floor(100000 + Math.random() * 900000)}`;
  let applicantToken = '';
  let applicationId = '';
  let adminToken = '';

  it('Step 1: Unauthenticated request to /api/partners/dashboard is rejected with 401', async () => {
    const res = await getJson('/api/partners/dashboard');
    assert.equal(res.status, 401, 'Expected 401 Unauthorized without credentials');
    assert.equal(res.data.ok, false);
    assert.equal(res.data.error, 'Partner authentication required.');
  });

  it('Step 2: Partner applicant verifies mobile phone and registers session', async () => {
    const resolveRes = await postJson('/api/auth/otp', {
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: testPhone,
      registrationIntent: 'partner',
    });
    assert.equal(resolveRes.status, 200, 'Expected resolve to succeed');

    if (resolveRes.data.isNewUser) {
      const verificationToken = resolveRes.data.verificationToken;
      assert.ok(verificationToken, 'Expected verification token');

      const regRes = await postJson('/api/auth/otp', {
        action: 'COMPLETE_REGISTRATION',
        phoneE164: testPhone,
        verificationToken,
        fullName: 'Rohan Deshmukh',
        registrationIntent: 'partner',
        role: 'partner',
      });
      assert.equal(regRes.status, 200, 'Expected registration to succeed');
      assert.ok(regRes.data.sessionToken, 'Expected session token in response');
      applicantToken = regRes.data.sessionToken;
    } else {
      assert.ok(resolveRes.data.sessionToken, 'Expected existing session token');
      applicantToken = resolveRes.data.sessionToken;
    }
  });

  it('Step 3: New applicant without application gets 403 on dashboard with NONE status', async () => {
    const res = await getJson('/api/partners/dashboard', {
      Authorization: `Bearer ${applicantToken}`,
    });
    assert.equal(res.status, 403, 'Expected 403 before application is submitted');
    assert.equal(res.data.approved, false);
    assert.equal(res.data.applicationStatus, 'NONE');
  });

  it('Step 4: Partner applicant submits application for Pune', async () => {
    const res = await postJson(
      '/api/partners/applications',
      {
        fullName: 'Rohan Deshmukh',
        phoneE164: testPhone,
        email: `rohan.${testPhone.slice(-6)}@citykart.shop`,
        cityId: 'india-maharashtra-pune',
        cityName: 'Pune',
        stateRegion: 'Maharashtra',
        countryCode: 'IN',
        relevantExperience: '10 years retail and FMCG distribution experience across Maharashtra',
        localGrowthPlan: 'Onboard 50 stores in Kothrud and Shivaji Nagar within 30 days',
        kyc: {
          identityDocType: 'PAN_CARD',
          identityDocNumber: 'ABCDE1234F',
          addressProofType: 'AADHAAR',
          addressProofNumber: 'XXXX-XXXX-1234',
          bankAccountHolderName: 'Rohan Deshmukh',
          bankAccountNumber: '987654321012',
          bankIfscOrRoutingCode: 'HDFC0000123',
          bankName: 'HDFC Bank',
        },
      },
      { Authorization: `Bearer ${applicantToken}` }
    );

    assert.ok(res.status === 200 || res.status === 201, `Failed to create application: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.application?.id, 'Expected application ID');
    assert.equal(res.data.application?.status, 'PENDING');
    applicationId = res.data.application.id;
  });

  it('Step 5: Pending applicant receives 403 with application tracker status on dashboard', async () => {
    const res = await getJson('/api/partners/dashboard', {
      Authorization: `Bearer ${applicantToken}`,
    });
    assert.equal(res.status, 403, 'Expected 403 while application is pending');
    assert.equal(res.data.approved, false);
    assert.equal(res.data.applicationStatus, 'PENDING');
    assert.ok(res.data.application, 'Expected application object in tracker response');
    assert.equal(res.data.application.cityName, 'Pune');
  });

  it('Step 6: Super Admin logs in and approves partner application', async () => {
    assert.ok(applicationId, 'Expected applicationId to be set from Step 4');
    // Admin login via RESOLVE_FIREBASE_USER for Anil Kadam
    const adminResolve = await postJson('/api/auth/otp', {
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: '+918329306616',
    });
    assert.equal(adminResolve.status, 200);
    assert.ok(adminResolve.data.sessionToken, 'Expected session token for admin');
    adminToken = adminResolve.data.sessionToken;

    // Admin approves the application
    const approveRes = await postJson(
      '/api/admin/partners',
      {
        action: 'APPROVE_APPLICATION',
        applicationId,
        reviewNotes: 'Approved for Pune territory by Super Admin Anil Kadam',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.equal(approveRes.status, 200, `Approval failed: ${JSON.stringify(approveRes.data)}`);
    assert.equal(approveRes.data.application?.status, 'APPROVED');
  });

  it('Step 7: Approved partner accesses /api/partners/dashboard with full 50/50 console KPIs', async () => {
    const res = await getJson('/api/partners/dashboard', {
      Authorization: `Bearer ${applicantToken}`,
    });

    assert.equal(res.status, 200, `Dashboard request failed: ${JSON.stringify(res.data)}`);
    assert.equal(res.data.approved, true);
    assert.equal(res.data.partner.revenueSharePct, 50, 'Revenue share must be exactly 50%');
    assert.equal(res.data.partner.exclusivityModel, 'ONE_CITY_ONE_PARTNER');
    assert.ok(res.data.partner.partnerCode, 'Expected assigned partner code');
    assert.equal(res.data.partner.cityId, 'india-maharashtra-pune');

    // KPI verification
    assert.equal(typeof res.data.partner.totalEarned, 'number');
    assert.equal(typeof res.data.partner.activeMerchants, 'number');
    assert.equal(typeof res.data.partner.ordersThisMonth, 'number');

    // Operations tooling verification
    assert.ok(res.data.partner.referralLink?.includes('refPartner='), 'Expected referral link with partner ID');
    assert.ok(res.data.partner.nextSettlementDate, 'Expected next settlement date');
    assert.equal(res.data.partner.kyc.status, 'VERIFIED');
  });

  it('Step 8: Founder Super Admin (+918329306616) pre-approved partner console is active for Nanded', async () => {
    const res = await getJson('/api/partners/dashboard', {
      Authorization: `Bearer ${adminToken}`,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.approved, true);
    assert.equal(res.data.partner.partnerId, 'PART-001');
    assert.equal(res.data.partner.partnerCode, 'CK-PARTNER-2026-0001');
    assert.equal(res.data.partner.cityId, 'nanded-in');
    assert.equal(res.data.partner.revenueSharePct, 50);
  });

  it('Step 9: Applicant withdrawal flow functions cleanly', async () => {
    const resolveRes = await postJson('/api/auth/otp', {
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: withdrawPhone,
      registrationIntent: 'partner',
    });
    const regRes = await postJson('/api/auth/otp', {
      action: 'COMPLETE_REGISTRATION',
      phoneE164: withdrawPhone,
      verificationToken: resolveRes.data.verificationToken,
      fullName: 'Candidate Test',
      registrationIntent: 'partner',
    });
    const withdrawToken = regRes.data.sessionToken;

    // Submit
    const subRes = await postJson(
      '/api/partners/applications',
      {
        fullName: 'Candidate Test',
        phoneE164: withdrawPhone,
        email: `cand.${withdrawPhone.slice(-6)}@citykart.shop`,
        cityId: 'india-maharashtra-nashik',
        cityName: 'Nashik',
      },
      { Authorization: `Bearer ${withdrawToken}` }
    );
    assert.ok(subRes.status === 200 || subRes.status === 201);
    const appId = subRes.data.application.id;

    // Withdraw
    const withdrawRes = await postJson(
      '/api/partners/applications',
      {
        action: 'WITHDRAW',
        applicationId: appId,
      },
      { Authorization: `Bearer ${withdrawToken}` }
    );
    assert.equal(withdrawRes.status, 200);
    assert.equal(withdrawRes.data.ok, true);
    assert.equal(withdrawRes.data.message, 'Application withdrawn.');

    // Confirm dashboard reflects withdrawn status
    const postWithdrawDash = await getJson('/api/partners/dashboard', {
      Authorization: `Bearer ${withdrawToken}`,
    });
    assert.equal(postWithdrawDash.status, 403);
    assert.equal(postWithdrawDash.data.applicationStatus, 'NONE');
  });
});
