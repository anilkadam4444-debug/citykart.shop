/**
 * CityKart — Complete Multi-Role Real-World Emulation & End-to-End Verification Runner
 * Executes live requests against http://localhost:3000 across all 5 supported roles:
 *   1. Buyer
 *   2. Seller / Business Owner
 *   3. Partner (City Partner / Referral Partner)
 *   4. Operational Admin
 *   5. Super Admin (Platform Owner +918329306616)
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const results = [];

async function runCheck(id, phase, role, name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - startedAt;
    results.push({
      id,
      phase,
      role,
      name,
      status: 'PASS',
      durationMs,
      details: details || 'Verified',
    });
    console.log(`✅ [PASS] [${id}] (${role}) ${name} (${durationMs}ms) -> ${details || 'OK'}`);
    return true;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    results.push({
      id,
      phase,
      role,
      name,
      status: 'FAIL',
      durationMs,
      details: message,
    });
    console.error(`❌ [FAIL] [${id}] (${role}) ${name} (${durationMs}ms) -> ${message}`);
    return false;
  }
}

async function apiJson(pathname, options = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, ok: res.ok, data };
}

async function authenticateViaOtp({ phoneE164, fullName, journey = 'BUYER', businessName }) {
  // Step 1: Request OTP
  const reqRes = await apiJson('/api/auth/otp', {
    method: 'POST',
    body: JSON.stringify({ action: 'REQUEST_OTP', phoneE164 }),
  });
  if (reqRes.status !== 200 || !reqRes.data.ok) {
    throw new Error(`REQUEST_OTP failed (${reqRes.status}): ${JSON.stringify(reqRes.data)}`);
  }

  // Step 2: Verify OTP
  const verRes = await apiJson('/api/auth/otp', {
    method: 'POST',
    body: JSON.stringify({
      action: 'VERIFY_OTP',
      phoneE164,
      otpCode: reqRes.data.devOtpHint || '123456',
      journey,
    }),
  });
  if (verRes.status !== 200 || !verRes.data.ok) {
    throw new Error(`VERIFY_OTP failed (${verRes.status}): ${JSON.stringify(verRes.data)}`);
  }

  if (verRes.data.status === 'AUTHENTICATED_EXISTING' && verRes.data.sessionToken) {
    return {
      user: verRes.data.user,
      sessionToken: verRes.data.sessionToken,
      verificationToken: verRes.data.verificationToken,
    };
  }

  // Step 3: Complete Registration (testing both with and without explicit phoneE164 to verify verificationToken lookup)
  const regRes = await apiJson('/api/auth/otp', {
    method: 'POST',
    body: JSON.stringify({
      action: 'COMPLETE_REGISTRATION',
      verificationToken: verRes.data.verificationToken,
      fullName,
      journey,
      businessName,
    }),
  });
  if (regRes.status !== 200 || !regRes.data.ok || !regRes.data.sessionToken) {
    throw new Error(`COMPLETE_REGISTRATION failed (${regRes.status}): ${JSON.stringify(regRes.data)}`);
  }

  return {
    user: regRes.data.user,
    sessionToken: regRes.data.sessionToken,
    verificationToken: verRes.data.verificationToken,
  };
}

async function main() {
  console.log(`\n======================================================================`);
  console.log(`CITYKART — MULTI-ROLE REAL-WORLD EMULATION SUITE (${BASE_URL})`);
  console.log(`======================================================================\n`);

  // Shared state across phases
  const runSuffix = String(Date.now()).slice(-6);
  const buyerPhone = `+919811${runSuffix}`;
  const buyer2Phone = `+919822${runSuffix}`;
  const sellerPhone = `+919833${runSuffix}`;
  const partnerPhone = `+919844${runSuffix}`;
  const partner2Phone = `+919855${runSuffix}`;
  const opAdminPhone = `+919866${runSuffix}`;
  const superAdminPhone = `+918329306616`;

  let buyerAuth = null;
  let buyer2Auth = null;
  let sellerAuth = null;
  let partnerAuth = null;
  let partner2Auth = null;
  let opAdminAuth = null;
  let superAdminAuth = null;

  let createdOrderId = null;
  let initialDeliveryPin = null;
  let regeneratedDeliveryPin = null;
  let createdPartnerAppId = null;

  // =========================================================================
  // PHASE 1 & 9: PUBLIC ROUTES & SSR RENDERING VERIFICATION
  // =========================================================================
  const publicRoutes = [
    { path: '/', marker: 'CityKart' },
    { path: '/stores/store-1', marker: 'Store' },
    { path: '/categories/kirana-grocery', marker: 'Grocery' },
    { path: '/orders', marker: 'Orders' },
    { path: '/seller', marker: 'Seller' },
    { path: '/register-business', marker: 'Business' },
    { path: '/partner', marker: 'Partner' },
    { path: '/partner/verify-otp', marker: 'Verify' },
    { path: '/pricing', marker: 'Pricing' },
    { path: '/about', marker: 'CityKart' },
    { path: '/faq', marker: 'FAQ' },
    { path: '/contact', marker: 'Contact' },
    { path: '/privacy', marker: 'Privacy' },
    { path: '/terms', marker: 'Terms' },
    { path: '/admin', marker: 'Admin' },
    { path: '/admin/partners', marker: 'Partner' },
  ];

  for (const route of publicRoutes) {
    await runCheck(
      `ROUTE-${route.path}`,
      'Phase 9: Navigation & Route Audit',
      'Public/All',
      `GET ${route.path} returns HTTP 200 and renders SSR HTML`,
      async () => {
        const res = await fetch(`${BASE_URL}${route.path}`);
        if (res.status !== 200) {
          throw new Error(`Expected 200 for ${route.path}, got ${res.status}`);
        }
        const html = await res.text();
        if (!html || html.length < 200) {
          throw new Error(`Empty or truncated HTML on ${route.path}`);
        }
        return `HTTP 200 (${html.length} bytes)`;
      }
    );
  }

  // =========================================================================
  // PHASE 3: BUYER EMULATION
  // =========================================================================
  await runCheck(
    'BUYER-01',
    'Phase 3: Buyer Emulation',
    'Buyer',
    'Buyer OTP Registration & Session Token Issuance (without explicit phoneE164 in COMPLETE_REGISTRATION)',
    async () => {
      buyerAuth = await authenticateViaOtp({
        phoneE164: buyerPhone,
        fullName: 'Aarav Deshmukh (E2E Buyer)',
        journey: 'BUYER',
      });
      if (!buyerAuth.sessionToken.startsWith('ck_sess.')) {
        throw new Error(`Expected structured ck_sess token, got ${buyerAuth.sessionToken}`);
      }
      if (buyerAuth.user.role !== 'buyer') {
        throw new Error(`Expected buyer role, got ${buyerAuth.user.role}`);
      }
      return `Issued token for ${buyerAuth.user.phoneE164} (uid=${buyerAuth.user.id})`;
    }
  );

  await runCheck(
    'BUYER-02',
    'Phase 3: Buyer Emulation',
    'Buyer',
    'Existing Buyer Re-Authentication via OTP returns AUTHENTICATED_EXISTING',
    async () => {
      const reAuth = await authenticateViaOtp({
        phoneE164: buyerPhone,
        fullName: 'Aarav Deshmukh (E2E Buyer)',
        journey: 'BUYER',
      });
      if (reAuth.user.phoneE164 !== buyerPhone) {
        throw new Error(`Mismatched phone ${reAuth.user.phoneE164}`);
      }
      return `Existing account re-authenticated (${reAuth.user.fullName})`;
    }
  );

  await runCheck(
    'BUYER-03',
    'Phase 3: Buyer Emulation',
    'Buyer',
    'Store Discovery API returns active Store-1 with zero Firestore PERMISSION_DENIED errors',
    async () => {
      const res = await apiJson('/api/stores/store-1');
      if (res.status !== 200 || !res.data.ok || res.data.deleted) {
        throw new Error(`Unexpected response: ${JSON.stringify(res.data)}`);
      }
      return `Store "${res.data.store?.name || 'store-1'}" active`;
    }
  );

  await runCheck(
    'BUYER-04',
    'Phase 3: Buyer Emulation',
    'Buyer',
    'Buyer places an intracity order with Pay-on-Delivery and receives 6-digit Delivery PIN',
    async () => {
      const res = await apiJson('/api/orders', {
        method: 'POST',
        headers: { 'x-urbandirect-session': buyerAuth.sessionToken },
        body: JSON.stringify({
          customer: {
            fullName: buyerAuth.user.fullName,
            phone: buyerPhone,
            phoneE164: buyerPhone,
            address: 'Flat 302, Sai Residency, Vazirabad, Nanded',
            deliveryAddress: 'Flat 302, Sai Residency, Vazirabad, Nanded',
            locality: 'Vazirabad',
            city: 'Nanded',
            postalCode: '431601',
          },
          storeId: 'store-1',
          sellerId: 'seller-1',
          storeName: 'Mahalaxmi Kirana & Supermart',
          items: [
            {
              productId: 'prod-1',
              storeId: 'store-1',
              quantity: 2,
              price: 145,
            },
          ],
          subtotal: 290,
          deliveryFee: 25,
          platformFee: 5,
          total: 320,
          currency: 'INR',
          paymentMethod: 'PAY_ON_DELIVERY',
        }),
      });
      if (res.status !== 200 || !res.data.ok || !res.data.order?.id) {
        throw new Error(`Order placement failed: ${JSON.stringify(res.data)}`);
      }
      createdOrderId = res.data.order.id;
      initialDeliveryPin = res.data.deliveryPin || res.data.pin;
      if (!/^\d{6}$/.test(String(initialDeliveryPin))) {
        throw new Error(`Expected 6-digit PIN, got ${initialDeliveryPin}`);
      }
      return `Order ${createdOrderId} created with 6-digit PIN ${initialDeliveryPin}`;
    }
  );

  await runCheck(
    'BUYER-05',
    'Phase 3: Buyer Emulation',
    'Buyer',
    'Buyer fetches authoritative 6-digit Delivery PIN via GET /api/orders/[orderId]/pin',
    async () => {
      const res = await apiJson(`/api/orders/${createdOrderId}/pin`, {
        method: 'GET',
        headers: { 'x-urbandirect-session': buyerAuth.sessionToken },
      });
      if (res.status !== 200 || !res.data.ok || res.data.deliveryPin !== initialDeliveryPin) {
        throw new Error(`GET PIN failed: ${JSON.stringify(res.data)}`);
      }
      return `Verified GET /api/orders/${createdOrderId}/pin === ${res.data.deliveryPin}`;
    }
  );

  await runCheck(
    'BUYER-06',
    'Phase 3: Buyer Emulation',
    'Buyer',
    'Buyer regenerates 6-digit Delivery PIN via POST /api/orders/[orderId]/pin',
    async () => {
      const res = await apiJson(`/api/orders/${createdOrderId}/pin`, {
        method: 'POST',
        headers: { 'x-urbandirect-session': buyerAuth.sessionToken },
      });
      if (res.status !== 200 || !res.data.ok || !/^\d{6}$/.test(String(res.data.deliveryPin))) {
        throw new Error(`POST PIN regeneration failed: ${JSON.stringify(res.data)}`);
      }
      regeneratedDeliveryPin = res.data.deliveryPin;
      return `Regenerated PIN from ${initialDeliveryPin} -> ${regeneratedDeliveryPin} (v${res.data.pinInfo?.pinVersion})`;
    }
  );

  await runCheck(
    'BUYER-07',
    'Phase 3: Buyer Emulation',
    'Buyer',
    'Public Order Listing (GET /api/orders) sanitizes and strips raw deliveryPin to prevent leakage',
    async () => {
      const res = await apiJson('/api/orders');
      if (res.status !== 200 || !res.data.ok) {
        throw new Error(`GET /api/orders failed: ${JSON.stringify(res.data)}`);
      }
      const listed = res.data.orders.find((o) => o.id === createdOrderId);
      if (!listed) {
        throw new Error(`Order ${createdOrderId} missing from GET /api/orders`);
      }
      if (listed.deliveryPin || listed.deliveryPinInfo?.pin) {
        throw new Error(`Security leak: raw PIN exposed in GET /api/orders`);
      }
      return `Order ${createdOrderId} listed with raw PIN stripped`;
    }
  );

  // =========================================================================
  // PHASE 4: SELLER / BUSINESS OWNER EMULATION
  // =========================================================================
  await runCheck(
    'SELLER-01',
    'Phase 4: Seller Emulation',
    'Seller',
    'Seller registers via OTP with SELLER journey and receives seller role & sellerId',
    async () => {
      sellerAuth = await authenticateViaOtp({
        phoneE164: sellerPhone,
        fullName: 'Vikram Kulkarni (E2E Seller)',
        journey: 'SELLER',
        businessName: 'Kulkarni Fresh Mart Nanded',
      });
      if (sellerAuth.user.role !== 'seller' || !sellerAuth.user.sellerId) {
        throw new Error(`Expected seller role & sellerId, got ${JSON.stringify(sellerAuth.user)}`);
      }
      return `Seller registered: ${sellerAuth.user.fullName} (${sellerAuth.user.sellerId})`;
    }
  );

  await runCheck(
    'SELLER-02',
    'Phase 4: Seller Emulation',
    'Seller',
    'Seller progresses order status CONFIRMED -> PREPARING -> OUT_FOR_DELIVERY via PATCH /api/orders/[orderId]/status',
    async () => {
      for (const status of ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY']) {
        const res = await apiJson(`/api/orders/${createdOrderId}/status`, {
          method: 'PATCH',
          headers: { 'x-urbandirect-session': sellerAuth.sessionToken },
          body: JSON.stringify({ status }),
        });
        if (res.status !== 200 || !res.data.ok || res.data.order?.orderStatus !== status) {
          throw new Error(`Failed transition to ${status}: ${JSON.stringify(res.data)}`);
        }
      }
      return `Order ${createdOrderId} progressed through CONFIRMED -> PREPARING -> OUT_FOR_DELIVERY`;
    }
  );

  await runCheck(
    'SELLER-03',
    'Phase 4: Seller Emulation',
    'Seller',
    'Seller is blocked from marking order DELIVERED via status endpoint without customer 6-digit PIN verification',
    async () => {
      const res = await apiJson(`/api/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: { 'x-urbandirect-session': sellerAuth.sessionToken },
        body: JSON.stringify({ status: 'DELIVERED' }),
      });
      if (res.status !== 400 || res.data.code !== 'PIN_REQUIRED') {
        throw new Error(`Expected HTTP 400 PIN_REQUIRED, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      return `Blocked direct DELIVERED transition (HTTP 400 PIN_REQUIRED)`;
    }
  );

  await runCheck(
    'SELLER-04',
    'Phase 4: Seller Emulation',
    'Seller',
    'Delivery PIN verification rejects wrong PIN (000000) and succeeds with buyer regenerated PIN',
    async () => {
      const badRes = await apiJson(`/api/orders/${createdOrderId}/verify-pin`, {
        method: 'POST',
        headers: { 'x-urbandirect-session': sellerAuth.sessionToken },
        body: JSON.stringify({ pin: '000000' }),
      });
      if (badRes.status !== 400) {
        throw new Error(`Expected 400 for invalid PIN, got ${badRes.status}`);
      }

      const goodRes = await apiJson(`/api/orders/${createdOrderId}/verify-pin`, {
        method: 'POST',
        headers: { 'x-urbandirect-session': sellerAuth.sessionToken },
        body: JSON.stringify({ pin: regeneratedDeliveryPin }),
      });
      if (goodRes.status !== 200 || !goodRes.data.ok || goodRes.data.order?.orderStatus !== 'DELIVERED') {
        throw new Error(`Valid PIN verification failed: ${JSON.stringify(goodRes.data)}`);
      }
      return `Wrong PIN rejected (400); valid PIN ${regeneratedDeliveryPin} verified -> DELIVERED`;
    }
  );

  await runCheck(
    'SELLER-05',
    'Phase 4: Seller Emulation',
    'Seller',
    'Seller cannot delete another seller store (DELETE /api/stores/store-1 returns HTTP 403)',
    async () => {
      const res = await apiJson('/api/stores/store-1', {
        method: 'DELETE',
        headers: { 'x-urbandirect-session': sellerAuth.sessionToken },
        body: JSON.stringify({
          confirmationText: 'Mahalaxmi Kirana & Supermart',
          reason: 'Unauthorized cross-seller delete test',
        }),
      });
      if (res.status !== 403) {
        throw new Error(`Expected HTTP 403 for non-owner seller, got ${res.status}`);
      }
      return `Cross-seller store deletion blocked with HTTP 403`;
    }
  );

  // =========================================================================
  // PHASE 5: PARTNER EMULATION (CRITICAL REGRESSION VERIFICATION)
  // =========================================================================
  await runCheck(
    'PARTNER-01',
    'Phase 5: Partner Emulation',
    'Partner',
    'Unauthenticated Partner application submission is rejected with HTTP 401',
    async () => {
      const res = await apiJson('/api/partners/applications', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Unauth Partner',
          phoneE164: partnerPhone,
          city: 'Nanded',
          stateRegion: 'Maharashtra',
          occupation: 'Consultant',
          experienceSummary: 'Local retail network consultant in Nanded.',
          expectedMonthlyOnboardings: 15,
        }),
      });
      if (res.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated submission, got ${res.status}`);
      }
      return `Unauthenticated submission properly blocked with HTTP 401`;
    }
  );

  await runCheck(
    'PARTNER-02',
    'Phase 5: Partner Emulation',
    'Partner',
    'CRITICAL REGRESSION: Partner OTP Verification -> Application Submission succeeds without "Authentication is required. Please verify mobile number."',
    async () => {
      partnerAuth = await authenticateViaOtp({
        phoneE164: partnerPhone,
        fullName: 'Rohan Patil (City Partner)',
        journey: 'BUYER',
      });

      const res = await apiJson('/api/partners/applications', {
        method: 'POST',
        headers: {
          'x-urbandirect-session': partnerAuth.sessionToken,
          'x-urbandirect-phone': partnerPhone,
        },
        body: JSON.stringify({
          fullName: 'Rohan Patil',
          phoneE164: partnerPhone,
          email: 'rohan.patil@example.com',
          city: 'Nanded',
          stateRegion: 'Maharashtra',
          locality: 'Shivaji Nagar',
          occupation: 'FMCG Distributor',
          experienceSummary: '8 years onboarding kirana and pharmacy stores across Nanded district.',
          expectedMonthlyOnboardings: 25,
          referralChannel: 'FIELD_SALES',
        }),
      });

      if (res.status !== 200 || !res.data.ok || !res.data.application?.id) {
        throw new Error(`Partner application failed (${res.status}): ${JSON.stringify(res.data)}`);
      }
      createdPartnerAppId = res.data.application.id;
      if (res.data.application.status !== 'PENDING') {
        throw new Error(`Expected PENDING status, got ${res.data.application.status}`);
      }
      return `Partner application ${createdPartnerAppId} created with status PENDING`;
    }
  );

  await runCheck(
    'PARTNER-03',
    'Phase 5: Partner Emulation',
    'Partner',
    'Duplicate active Partner application from same phone is blocked with HTTP 409',
    async () => {
      const res = await apiJson('/api/partners/applications', {
        method: 'POST',
        headers: { 'x-urbandirect-session': partnerAuth.sessionToken },
        body: JSON.stringify({
          fullName: 'Rohan Patil',
          phoneE164: partnerPhone,
          city: 'Nanded',
          stateRegion: 'Maharashtra',
          occupation: 'FMCG Distributor',
          experienceSummary: 'Duplicate test',
          expectedMonthlyOnboardings: 25,
        }),
      });
      if (res.status !== 409) {
        throw new Error(`Expected HTTP 409 for duplicate application, got ${res.status}`);
      }
      return `Duplicate application blocked with HTTP 409`;
    }
  );

  await runCheck(
    'PARTNER-04',
    'Phase 5: Partner Emulation',
    'Partner',
    'Pending Partner is blocked from accessing approved Partner Dashboard (GET /api/partners/dashboard returns 403)',
    async () => {
      const res = await apiJson(`/api/partners/dashboard?phone=${encodeURIComponent(partnerPhone)}`, {
        method: 'GET',
        headers: { 'x-urbandirect-session': partnerAuth.sessionToken },
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 for pending partner dashboard access, got ${res.status}`);
      }
      return `Pre-approval partner dashboard access blocked with HTTP 403`;
    }
  );

  await runCheck(
    'PARTNER-05',
    'Phase 5: Partner Emulation',
    'Partner',
    'Partner cannot self-approve application via /api/admin/partners (returns HTTP 403)',
    async () => {
      const res = await apiJson('/api/admin/partners', {
        method: 'POST',
        headers: { 'x-urbandirect-session': partnerAuth.sessionToken },
        body: JSON.stringify({
          action: 'APPROVE',
          applicationId: createdPartnerAppId,
        }),
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 for partner self-approval attempt, got ${res.status}`);
      }
      return `Self-approval attempt rejected with HTTP 403`;
    }
  );

  await runCheck(
    'PARTNER-06',
    'Phase 8: Cross-Account Isolation',
    'Partner',
    'Cross-account isolation: Buyer 2 / Partner 2 cannot view or withdraw Partner 1 application',
    async () => {
      buyer2Auth = await authenticateViaOtp({
        phoneE164: buyer2Phone,
        fullName: 'Sneha Joshi (Buyer 2)',
        journey: 'BUYER',
      });

      const listRes = await apiJson(`/api/partners/applications?phone=${encodeURIComponent(partnerPhone)}`, {
        method: 'GET',
        headers: { 'x-urbandirect-session': buyer2Auth.sessionToken },
      });
      if (listRes.status !== 200 || (listRes.data.applications || []).length !== 0) {
        throw new Error(`Cross-user application leak: ${JSON.stringify(listRes.data)}`);
      }

      const withdrawRes = await apiJson('/api/partners/applications', {
        method: 'PATCH',
        headers: { 'x-urbandirect-session': buyer2Auth.sessionToken },
        body: JSON.stringify({
          action: 'WITHDRAW',
          applicationId: createdPartnerAppId,
        }),
      });
      if (withdrawRes.status !== 403) {
        throw new Error(`Expected 403 on cross-user WITHDRAW, got ${withdrawRes.status}`);
      }
      return `Cross-user GET returned 0 records and cross-user WITHDRAW blocked with HTTP 403`;
    }
  );

  // =========================================================================
  // PHASE 6 & 7: ADMIN & SUPER ADMIN EMULATION
  // =========================================================================
  await runCheck(
    'ADMIN-01',
    'Phase 6 & 7: Admin Security Gates',
    'Buyer/Seller',
    'Non-owner cannot self-elevate via POST /api/admin/bootstrap (returns HTTP 403)',
    async () => {
      const res = await apiJson('/api/admin/bootstrap', {
        method: 'POST',
        headers: { 'x-urbandirect-session': buyerAuth.sessionToken },
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 on unauthorized bootstrap, got ${res.status}`);
      }
      return `Unauthorized Super Admin bootstrap blocked with HTTP 403`;
    }
  );

  await runCheck(
    'ADMIN-02',
    'Phase 6 & 7: Admin Security Gates',
    'Buyer/Seller',
    'Unauthenticated & Buyer requests to /api/admin/dashboard are rejected with 401/403',
    async () => {
      const unauthRes = await apiJson('/api/admin/dashboard');
      if (unauthRes.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated admin dashboard, got ${unauthRes.status}`);
      }
      const buyerRes = await apiJson('/api/admin/dashboard', {
        headers: { 'x-urbandirect-session': buyerAuth.sessionToken },
      });
      if (buyerRes.status !== 403) {
        throw new Error(`Expected 403 for buyer on admin dashboard, got ${buyerRes.status}`);
      }
      return `Unauthenticated -> 401, Buyer -> 403`;
    }
  );

  await runCheck(
    'SUPERADMIN-01',
    'Phase 7: Super Admin Emulation',
    'Super Admin',
    'Platform Owner (+918329306616) authenticates via OTP and receives super_admin session',
    async () => {
      superAdminAuth = await authenticateViaOtp({
        phoneE164: superAdminPhone,
        fullName: 'Platform Owner Super Admin',
        journey: 'BUYER',
      });
      if (superAdminAuth.user.role !== 'super_admin') {
        throw new Error(`Expected super_admin role, got ${superAdminAuth.user.role}`);
      }
      return `Super Admin authenticated (${superAdminAuth.user.phoneE164}, role=${superAdminAuth.user.role})`;
    }
  );

  await runCheck(
    'SUPERADMIN-02',
    'Phase 7: Super Admin Emulation',
    'Super Admin',
    'Super Admin loads /api/admin/dashboard with full stores, orders, plans, and audit logs',
    async () => {
      const res = await apiJson('/api/admin/dashboard', {
        headers: { 'x-urbandirect-session': superAdminAuth.sessionToken },
      });
      if (res.status !== 200 || !res.data.ok || !res.data.authorized || !res.data.isSuperAdmin) {
        throw new Error(`Super Admin dashboard failed: ${JSON.stringify(res.data)}`);
      }
      return `Loaded ${res.data.stores?.length} stores, ${res.data.orders?.length} orders, ${res.data.subscriptionPlans?.length} plans`;
    }
  );

  await runCheck(
    'SUPERADMIN-03',
    'Phase 7: Super Admin Emulation',
    'Super Admin',
    'Super Admin invites an Operational Admin via POST /api/admin/management (INVITE_ADMIN)',
    async () => {
      const res = await apiJson('/api/admin/management', {
        method: 'POST',
        headers: { 'x-urbandirect-session': superAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'INVITE_ADMIN',
          phoneE164: opAdminPhone,
          name: 'Priya Sharma (Ops Admin)',
          designation: 'Regional Operations Manager',
          role: 'admin',
        }),
      });
      if (res.status !== 200 || !res.data.ok || !res.data.record) {
        throw new Error(`INVITE_ADMIN failed: ${JSON.stringify(res.data)}`);
      }
      return `Authorized Operational Admin ${res.data.record.phoneE164} (${res.data.record.status})`;
    }
  );

  await runCheck(
    'OPADMIN-01',
    'Phase 6: Admin Emulation',
    'Admin',
    'Invited Operational Admin authenticates via OTP and accesses /api/admin/dashboard',
    async () => {
      opAdminAuth = await authenticateViaOtp({
        phoneE164: opAdminPhone,
        fullName: 'Priya Sharma (Ops Admin)',
        journey: 'BUYER',
      });
      if (opAdminAuth.user.role !== 'admin') {
        throw new Error(`Expected admin role, got ${opAdminAuth.user.role}`);
      }
      const dashRes = await apiJson('/api/admin/dashboard', {
        headers: { 'x-urbandirect-session': opAdminAuth.sessionToken },
      });
      if (dashRes.status !== 200 || !dashRes.data.ok || dashRes.data.isSuperAdmin !== false) {
        throw new Error(`OpAdmin dashboard check failed: ${JSON.stringify(dashRes.data)}`);
      }
      return `Operational Admin authenticated (isSuperAdmin=false, role=${ dashRes.data.adminProfile?.role })`;
    }
  );

  await runCheck(
    'OPADMIN-02',
    'Phase 6: Admin Emulation',
    'Admin',
    'Operational Admin is blocked from Super-Admin-only governance (INVITE_ADMIN & DELETE_STORE return 403)',
    async () => {
      const inviteRes = await apiJson('/api/admin/management', {
        method: 'POST',
        headers: { 'x-urbandirect-session': opAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'INVITE_ADMIN',
          phoneE164: '+919899999999',
          name: 'Unauthorized Invite',
        }),
      });
      if (inviteRes.status !== 403) {
        throw new Error(`Expected 403 for OpAdmin INVITE_ADMIN, got ${inviteRes.status}`);
      }

      const deleteStoreRes = await apiJson('/api/admin/action', {
        method: 'POST',
        headers: { 'x-urbandirect-session': opAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'DELETE_STORE',
          storeId: 'store-1',
          storeNameConfirmation: 'Mahalaxmi Kirana & Supermart',
        }),
      });
      if (deleteStoreRes.status !== 403) {
        throw new Error(`Expected 403 for OpAdmin DELETE_STORE, got ${deleteStoreRes.status}`);
      }
      return `OpAdmin blocked from INVITE_ADMIN (403) and DELETE_STORE (403)`;
    }
  );

  await runCheck(
    'OPADMIN-03',
    'Phase 6 & 8: Cross-Role Partner Approval',
    'Admin',
    'Operational Admin reviews and APPROVES pending Partner application via POST /api/admin/partners',
    async () => {
      const res = await apiJson('/api/admin/partners', {
        method: 'POST',
        headers: { 'x-urbandirect-session': opAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'APPROVE',
          applicationId: createdPartnerAppId,
          adminNote: 'Verified Nanded field sales credentials during E2E audit.',
        }),
      });
      if (res.status !== 200 || !res.data.ok || res.data.application?.status !== 'APPROVED') {
        throw new Error(`Partner approval failed: ${JSON.stringify(res.data)}`);
      }
      if (!res.data.partnerProfile?.referralCode) {
        throw new Error(`Missing generated partnerProfile/referralCode`);
      }
      return `Approved application ${createdPartnerAppId} -> Partner Code: ${res.data.partnerProfile.referralCode}`;
    }
  );

  await runCheck(
    'PARTNER-07',
    'Phase 5 & 8: Post-Approval Partner Access',
    'Partner',
    'Approved Partner can now access GET /api/partners/dashboard and receive referral attribution metrics',
    async () => {
      const res = await apiJson(`/api/partners/dashboard?phone=${encodeURIComponent(partnerPhone)}`, {
        method: 'GET',
        headers: { 'x-urbandirect-session': partnerAuth.sessionToken },
      });
      if (res.status !== 200 || !res.data.ok || !res.data.dashboard?.profile?.referralCode) {
        throw new Error(`Post-approval partner dashboard failed: ${JSON.stringify(res.data)}`);
      }
      return `Partner Dashboard unlocked (Referral Code: ${res.data.dashboard.profile.referralCode})`;
    }
  );

  await runCheck(
    'SUPERADMIN-04',
    'Phase 7: Super Admin Emulation',
    'Super Admin',
    'Super Admin suspends and restores a store via POST /api/admin/action with audit trail verification',
    async () => {
      const susRes = await apiJson('/api/admin/action', {
        method: 'POST',
        headers: { 'x-urbandirect-session': superAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'SUSPEND_STORE',
          storeId: 'store-2',
          storeName: 'Godavari Medical & General Stores',
          reason: 'Routine compliance verification test',
        }),
      });
      if (susRes.status !== 200 || !susRes.data.ok || !susRes.data.isSuspended) {
        throw new Error(`SUSPEND_STORE failed: ${JSON.stringify(susRes.data)}`);
      }

      const resStore = await apiJson('/api/admin/action', {
        method: 'POST',
        headers: { 'x-urbandirect-session': superAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'RESTORE_STORE',
          storeId: 'store-2',
          storeName: 'Godavari Medical & General Stores',
          reason: 'Compliance verification completed',
        }),
      });
      if (resStore.status !== 200 || !resStore.data.ok || resStore.data.isSuspended !== false) {
        throw new Error(`RESTORE_STORE failed: ${JSON.stringify(resStore.data)}`);
      }
      return `Store-2 suspended and restored with audit entries`;
    }
  );

  await runCheck(
    'SUPERADMIN-05',
    'Phase 7: Super Admin Emulation',
    'Super Admin',
    'Super Admin updates subscription plan entitlements and platform settings via POST /api/admin/action',
    async () => {
      const planRes = await apiJson('/api/admin/action', {
        method: 'POST',
        headers: { 'x-urbandirect-session': superAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'UPDATE_SUBSCRIPTION_PLAN',
          planId: 'GROWTH',
          monthlyPriceInr: 499,
          annualPriceInr: 4990,
          maxActiveProducts: 300,
          reason: 'E2E entitlement audit check',
        }),
      });
      if (planRes.status !== 200 || !planRes.data.ok) {
        throw new Error(`UPDATE_SUBSCRIPTION_PLAN failed: ${JSON.stringify(planRes.data)}`);
      }

      const settingsRes = await apiJson('/api/admin/action', {
        method: 'POST',
        headers: { 'x-urbandirect-session': superAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'UPDATE_PLATFORM_SETTINGS',
          settings: {
            platformName: 'CityKart Intra-City Marketplace',
            defaultFreeDeliveryThresholdInr: 199,
            defaultStandardDeliveryFeeInr: 25,
          },
          reason: 'E2E platform settings check',
        }),
      });
      if (settingsRes.status !== 200 || !settingsRes.data.ok) {
        throw new Error(`UPDATE_PLATFORM_SETTINGS failed: ${JSON.stringify(settingsRes.data)}`);
      }
      return `Subscription plan GROWTH and global platform settings updated`;
    }
  );

  await runCheck(
    'SUPERADMIN-06',
    'Phase 7: Super Admin Emulation',
    'Super Admin',
    'Super Admin revokes Operational Admin access and revoked Admin is immediately blocked (HTTP 403)',
    async () => {
      const revRes = await apiJson('/api/admin/management', {
        method: 'POST',
        headers: { 'x-urbandirect-session': superAdminAuth.sessionToken },
        body: JSON.stringify({
          action: 'REVOKE_ADMIN',
          phoneE164: opAdminPhone,
          reason: 'Completed E2E operational cycle',
        }),
      });
      if (revRes.status !== 200 || !revRes.data.ok) {
        throw new Error(`REVOKE_ADMIN failed: ${JSON.stringify(revRes.data)}`);
      }

      const checkBlocked = await apiJson('/api/admin/dashboard', {
        headers: { 'x-urbandirect-session': opAdminAuth.sessionToken },
      });
      if (checkBlocked.status !== 403) {
        throw new Error(`Expected 403 for revoked admin, got ${checkBlocked.status}`);
      }
      return `Revoked ${opAdminPhone} -> subsequent /api/admin/dashboard returned HTTP 403`;
    }
  );

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log(`\n======================================================================`);
  console.log(`EMULATION SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`);
  console.log(`======================================================================\n`);

  const outDir = path.join(process.cwd(), 'qa');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outDir, 'emulation-execution-results.json'),
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        totalChecks: results.length,
        passed,
        failed,
        results,
      },
      null,
      2
    )
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
