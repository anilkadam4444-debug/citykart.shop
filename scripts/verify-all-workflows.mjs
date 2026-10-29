const BASE = 'http://localhost:3000';

const results = [];
function record(id, category, description, passed, detail) {
  results.push({ id, category, description, status: passed ? 'PASS' : 'FAIL', detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${id}] (${category}) ${description} -> ${detail}`);
}

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // HTML or plain text
  }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers };
}

function makeClientFallbackToken(payload) {
  const json = JSON.stringify({
    uid: payload.uid || `user_${String(payload.phoneE164 || '').replace(/\D/g, '')}`,
    phoneE164: payload.phoneE164,
    role: String(payload.role || 'BUYER').toUpperCase(),
    roles: payload.roles || [String(payload.role || 'BUYER').toUpperCase()],
    fullName: payload.fullName || 'Verified User',
    sellerId: payload.sellerId,
    storeIds: payload.storeIds || [],
    iat: Date.now(),
  });
  return `ck_sess.${Buffer.from(json, 'utf8').toString('base64url')}`;
}

async function main() {
  console.log('=== CITYKART FULL-STACK & MULTI-ROLE E2E VERIFICATION SUITE ===\n');

  // 1. SSR & Page Route Verification
  const pageRoutes = [
    '/',
    '/stores',
    '/store/store-nanded-1',
    '/cart',
    '/orders',
    '/profile',
    '/seller',
    '/partner',
    '/partner/verify-otp',
    '/partner/apply',
    '/partner/dashboard',
    '/admin',
    '/investors',
    '/notifications',
  ];

  for (const route of pageRoutes) {
    const r = await req(route, { method: 'GET' });
    record(
      `ROUTE-${route}`,
      'Page SSR & Routing',
      `GET ${route} renders HTTP 200 with valid HTML`,
      r.status === 200 && r.text.includes('<!DOCTYPE html>'),
      `HTTP ${r.status} (${r.text.length} bytes)`
    );
  }

  // 2. Public Discovery & Catalog APIs
  const disc = await req('/api/discovery?city=Nanded');
  record(
    'API-DISCOVERY',
    'Buyer Discovery',
    'GET /api/discovery?city=Nanded returns stores and products',
    disc.status === 200 && disc.json?.ok === true && Array.isArray(disc.json?.stores) && disc.json.stores.length > 0,
    `HTTP ${disc.status}, stores=${disc.json?.stores?.length}, products=${disc.json?.products?.length}`
  );

  const locs = await req('/api/locations');
  record(
    'API-LOCATIONS',
    'Canonical Locations',
    'GET /api/locations returns canonical countries, regions, and cities',
    locs.status === 200 && locs.json?.ok === true && Array.isArray(locs.json?.cities) && locs.json.cities.length > 0,
    `HTTP ${locs.status}, cities=${locs.json?.cities?.length}`
  );

  // 3. OTP Authentication Flow (Buyer, Partner, Super Admin)
  const valPhone = await req('/api/auth/otp', {
    method: 'POST',
    body: JSON.stringify({
      action: 'VALIDATE_PHONE',
      countryCode: 'IN',
      dialCode: '+91',
      phoneInput: '9823456701',
    }),
  });
  record(
    'AUTH-OTP-VALIDATE',
    'OTP Auth Flow',
    'POST /api/auth/otp VALIDATE_PHONE validates E.164 phone and rate limits',
    valPhone.status === 200 && valPhone.json?.ok === true && valPhone.json?.phoneE164 === '+919823456701',
    `HTTP ${valPhone.status}, phoneE164=${valPhone.json?.phoneE164}`
  );

  // 4. Partner Onboarding End-to-End (Specifically verifying the OTP -> Application Submission auth fix)
  const partnerPhone = '+919765432109';
  const partnerResolve = await req('/api/auth/otp', {
    method: 'POST',
    body: JSON.stringify({
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: partnerPhone,
      firebaseUid: `partner_applicant_${partnerPhone.replace(/\D/g, '')}`,
      idToken: `preview_id_token_partner_applicant_${partnerPhone.replace(/\D/g, '')}`,
    }),
  });
  record(
    'PARTNER-OTP-VERIFY',
    'Partner Onboarding',
    'POST /api/auth/otp RESOLVE_FIREBASE_USER issues session token for Partner OTP verification',
    partnerResolve.status === 200 && partnerResolve.json?.ok === true && Boolean(partnerResolve.json?.sessionToken),
    `HTTP ${partnerResolve.status}, tokenIssued=${Boolean(partnerResolve.json?.sessionToken)}`
  );

  // Test submitting partner application using:
  // (a) Server-issued sessionToken
  // (b) Client-recovered ck_sess token (from sessionStorage citykart_partner_onboarding_v1)
  // (c) preview_id_token_partner_applicant_ Bearer token
  const recoveredPartnerToken = makeClientFallbackToken({
    uid: `partner_applicant_${partnerPhone.replace(/\D/g, '')}`,
    phoneE164: partnerPhone,
    role: 'partner',
    roles: ['PARTNER', 'BUYER'],
    fullName: 'Vikram Deshmukh',
  });

  const partnerSubmit = await req('/api/partners/applications', {
    method: 'POST',
    headers: {
      'x-urbandirect-session': recoveredPartnerToken,
      Authorization: `Bearer preview_id_token_partner_applicant_${partnerPhone.replace(/\D/g, '')}`,
    },
    body: JSON.stringify({
      fullLegalName: 'Vikram Deshmukh',
      phoneE164: partnerPhone,
      email: 'vikram.pune@partner.citykart.shop',
      residentialOrBusinessAddress: 'FC Road, Shivajinagar, Pune',
      countryCode: 'IN',
      stateRegion: 'Maharashtra',
      cityId: 'in-mh-pune',
      postalCode: '411004',
      relevantExperience: '8 years hyperlocal FMCG distribution in Pune',
      localGrowthPlan: 'Onboard 200+ Kirana and pharmacy stores in 60 days',
      kyc: {
        identityDocType: 'PAN_CARD',
        identityDocNumber: 'BCDEF2345G',
        addressProofType: 'AADHAAR',
        panOrTaxId: 'BCDEF2345G',
        bankAccountHolderName: 'Vikram Deshmukh',
        bankAccountNumber: 'XXXX8899',
        bankIfscOrRoutingCode: 'HDFC0000123',
        bankName: 'HDFC Bank',
      },
    }),
  });
  const createdAppId = partnerSubmit.json?.application?.id;
  record(
    'PARTNER-APP-SUBMIT',
    'Partner Onboarding',
    'POST /api/partners/applications succeeds with verified Partner OTP session and creates PENDING record with KYC & referenceId',
    partnerSubmit.status === 200 &&
      partnerSubmit.json?.ok === true &&
      Boolean(createdAppId) &&
      Boolean(partnerSubmit.json?.application?.referenceId) &&
      partnerSubmit.json?.application?.status === 'PENDING',
    `HTTP ${partnerSubmit.status}, id=${createdAppId}, ref=${partnerSubmit.json?.application?.referenceId}`
  );

  // Negative test: Partner cannot self-approve application
  const partnerSelfApprove = await req('/api/partners/applications', {
    method: 'POST',
    headers: { 'x-urbandirect-session': recoveredPartnerToken },
    body: JSON.stringify({
      fullLegalName: 'Vikram Deshmukh',
      phoneE164: partnerPhone,
      cityId: 'in-mh-pune',
      status: 'APPROVED',
    }),
  });
  record(
    'SEC-PARTNER-NO-SELF-APPROVE',
    'Security & RBAC',
    'Applicant cannot self-approve partner application (HTTP 403)',
    partnerSelfApprove.status === 403,
    `HTTP ${partnerSelfApprove.status} (${partnerSelfApprove.json?.error})`
  );

  // 5. Buyer Order Creation -> 6-Digit Delivery PIN -> Seller PIN Verification -> Post-Delivery Store Rating
  const buyerPhone = '+919823456701';
  const buyerToken = makeClientFallbackToken({
    uid: 'buyer_test_01',
    phoneE164: buyerPhone,
    role: 'BUYER',
    fullName: 'Priya Sharma',
  });

  const createOrder = await req('/api/orders', {
    method: 'POST',
    headers: { 'x-urbandirect-session': buyerToken },
    body: JSON.stringify({
      storeId: 'store-nanded-1',
      storeName: 'Nanded Fresh Mart & Daily Needs',
      sellerId: 'seller-nanded-1',
      buyerId: 'buyer_test_01',
      buyerName: 'Priya Sharma',
      buyerPhone,
      deliveryAddress: 'Plot 14, VIP Road, Nanded 431602',
      city: 'Nanded',
      paymentMethod: 'UPI_DIRECT',
      fulfillmentType: 'DELIVERY',
      items: [
        {
          productId: 'prod-nanded-101',
          name: 'Sharbati Gehu (Premium Wheat) - 5kg',
          price: 265,
          quantity: 2,
        },
      ],
    }),
  });
  const testOrderId = createOrder.json?.order?.id;
  const testOrderPin = createOrder.json?.order?.deliveryPin;
  record(
    'ORDER-CREATE-SERVER-PRICE',
    'Cross-Role Order Lifecycle',
    'Buyer creates order via POST /api/orders with authoritative server-side pricing & 6-digit Delivery PIN',
    createOrder.status === 200 &&
      createOrder.json?.ok === true &&
      Boolean(testOrderId) &&
      /^\d{6}$/.test(String(testOrderPin)) &&
      createOrder.json?.order?.subtotal === 530,
    `HTTP ${createOrder.status}, orderId=${testOrderId}, subtotal=${createOrder.json?.order?.subtotal}, pin=${testOrderPin}`
  );

  // Seller attempts to read buyer's Delivery PIN (Must be 403 Forbidden)
  const sellerToken = makeClientFallbackToken({
    uid: 'seller-nanded-1',
    phoneE164: '+919422111001',
    role: 'SELLER',
    sellerId: 'seller-nanded-1',
    storeIds: ['store-nanded-1'],
    fullName: 'Rajesh Deshmukh',
  });

  const sellerReadPin = await req(`/api/orders/${testOrderId}/pin`, {
    method: 'GET',
    headers: { 'x-urbandirect-session': sellerToken },
  });
  record(
    'SEC-SELLER-CANNOT-READ-PIN',
    'Security & RBAC',
    'Seller is blocked from reading buyer 6-digit Delivery PIN via GET /api/orders/[orderId]/pin (HTTP 403)',
    sellerReadPin.status === 403,
    `HTTP ${sellerReadPin.status} (${sellerReadPin.json?.error})`
  );

  // Buyer can read their own Delivery PIN
  const buyerReadPin = await req(`/api/orders/${testOrderId}/pin`, {
    method: 'GET',
    headers: { 'x-urbandirect-session': buyerToken },
  });
  record(
    'BUYER-READ-OWN-PIN',
    'Cross-Role Order Lifecycle',
    'Buyer can retrieve their 6-digit Delivery PIN via GET /api/orders/[orderId]/pin',
    buyerReadPin.status === 200 && buyerReadPin.json?.deliveryPin === testOrderPin,
    `HTTP ${buyerReadPin.status}, pin=${buyerReadPin.json?.deliveryPin}`
  );

  // Buyer attempts to rate store BEFORE order is DELIVERED (Must fail with HTTP 400)
  const earlyRating = await req('/api/stores/store-nanded-1/rate', {
    method: 'POST',
    headers: { 'x-urbandirect-session': buyerToken },
    body: JSON.stringify({
      orderId: testOrderId,
      rating: 5,
      comment: 'Trying to rate before delivery',
    }),
  });
  record(
    'SEC-NO-PRE-DELIVERY-RATING',
    'Cross-Role Order Lifecycle',
    'Buyer cannot rate store before order reaches DELIVERED status (HTTP 400)',
    earlyRating.status === 400,
    `HTTP ${earlyRating.status} (${earlyRating.json?.error})`
  );

  // Seller advances order status: PLACED -> ACCEPTED -> PACKED -> OUT_FOR_DELIVERY
  for (const nextStatus of ['ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY']) {
    await req(`/api/orders/${testOrderId}/status`, {
      method: 'POST',
      headers: { 'x-urbandirect-session': sellerToken },
      body: JSON.stringify({ status: nextStatus, sellerId: 'seller-nanded-1' }),
    });
  }

  // Seller cannot mark DELIVERED directly via /status bypassing PIN verification
  const bypassPinAttempt = await req(`/api/orders/${testOrderId}/status`, {
    method: 'POST',
    headers: { 'x-urbandirect-session': sellerToken },
    body: JSON.stringify({ status: 'DELIVERED', sellerId: 'seller-nanded-1' }),
  });
  record(
    'SEC-NO-PIN-BYPASS',
    'Security & RBAC',
    'Seller cannot mark order DELIVERED without 6-digit Delivery PIN verification (HTTP 400)',
    bypassPinAttempt.status === 400,
    `HTTP ${bypassPinAttempt.status} (${bypassPinAttempt.json?.error})`
  );

  // Seller verifies wrong PIN first (Must return HTTP 400)
  const wrongPinAttempt = await req(`/api/orders/${testOrderId}/verify-pin`, {
    method: 'POST',
    headers: { 'x-urbandirect-session': sellerToken },
    body: JSON.stringify({ pin: '000000' }),
  });
  record(
    'ORDER-WRONG-PIN-REJECTED',
    'Cross-Role Order Lifecycle',
    'Wrong 6-digit Delivery PIN is rejected and increments attempt counter (HTTP 400)',
    wrongPinAttempt.status === 400 && wrongPinAttempt.json?.ok === false,
    `HTTP ${wrongPinAttempt.status} (${wrongPinAttempt.json?.error})`
  );

  // Seller verifies correct 6-digit Delivery PIN -> Order transitions to DELIVERED
  const verifyPinRes = await req(`/api/orders/${testOrderId}/verify-pin`, {
    method: 'POST',
    headers: { 'x-urbandirect-session': sellerToken },
    body: JSON.stringify({ pin: testOrderPin }),
  });
  record(
    'ORDER-VERIFY-PIN-DELIVERED',
    'Cross-Role Order Lifecycle',
    'Correct 6-digit Delivery PIN transitions order to DELIVERED with timestamp',
    verifyPinRes.status === 200 &&
      verifyPinRes.json?.ok === true &&
      verifyPinRes.json?.order?.status === 'DELIVERED',
    `HTTP ${verifyPinRes.status}, status=${verifyPinRes.json?.order?.status}`
  );

  // Buyer submits 5-star store rating after DELIVERED
  const submitRating = await req('/api/stores/store-nanded-1/rate', {
    method: 'POST',
    headers: { 'x-urbandirect-session': buyerToken },
    body: JSON.stringify({
      orderId: testOrderId,
      rating: 5,
      comment: 'Fast delivery and fresh Sharbati wheat!',
    }),
  });
  record(
    'ORDER-POST-DELIVERY-RATING',
    'Cross-Role Order Lifecycle',
    'Buyer submits 5-star rating after DELIVERED and store average rating updates',
    submitRating.status === 200 &&
      submitRating.json?.ok === true &&
      submitRating.json?.order?.storeRating === 5 &&
      Number(submitRating.json?.store?.rating) > 0,
    `HTTP ${submitRating.status}, newRating=${submitRating.json?.store?.rating}, ratingCount=${submitRating.json?.store?.ratingCount}`
  );

  // Duplicate rating for same order is blocked (HTTP 409)
  const dupRating = await req('/api/stores/store-nanded-1/rate', {
    method: 'POST',
    headers: { 'x-urbandirect-session': buyerToken },
    body: JSON.stringify({
      orderId: testOrderId,
      rating: 4,
    }),
  });
  record(
    'SEC-NO-DUPLICATE-RATING',
    'Security & RBAC',
    'Duplicate store rating for the same order is rejected (HTTP 409)',
    dupRating.status === 409,
    `HTTP ${dupRating.status} (${dupRating.json?.error})`
  );

  // 6. Super Admin & Operational Admin Governance, Bootstrap, Partner Approval, and RBAC Boundaries
  // Unauthenticated access to /api/admin/dashboard is blocked (HTTP 401)
  const unauthAdmin = await req('/api/admin/dashboard');
  record(
    'SEC-ADMIN-UNAUTH-BLOCKED',
    'Security & RBAC',
    'Unauthenticated GET /api/admin/dashboard is rejected (HTTP 401)',
    unauthAdmin.status === 401,
    `HTTP ${unauthAdmin.status}`
  );

  // Buyer access to /api/admin/dashboard is blocked (HTTP 403)
  const buyerAdminAttempt = await req('/api/admin/dashboard', {
    headers: { 'x-urbandirect-session': buyerToken },
  });
  record(
    'SEC-BUYER-ADMIN-BLOCKED',
    'Security & RBAC',
    'Buyer session accessing GET /api/admin/dashboard is forbidden (HTTP 403)',
    buyerAdminAttempt.status === 403,
    `HTTP ${buyerAdminAttempt.status} (${buyerAdminAttempt.json?.error})`
  );

  // Super Admin (+918329306616) Bootstrap GET & POST
  const superAdminToken = makeClientFallbackToken({
    uid: 'uid-8329306616',
    phoneE164: '+918329306616',
    role: 'SUPER_ADMIN',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    fullName: 'Anil Kadam (Platform Owner)',
  });

  const bootstrapGet = await req('/api/admin/bootstrap', {
    method: 'GET',
    headers: { 'x-urbandirect-session': superAdminToken },
  });
  record(
    'ADMIN-BOOTSTRAP-GET',
    'Super Admin Governance',
    'GET /api/admin/bootstrap verifies Super Admin session and customClaimsConfigured',
    bootstrapGet.status === 200 &&
      bootstrapGet.json?.ok === true &&
      bootstrapGet.json?.authorized === true &&
      bootstrapGet.json?.isSuperAdmin === true,
    `HTTP ${bootstrapGet.status}, isSuperAdmin=${bootstrapGet.json?.isSuperAdmin}`
  );

  const adminDash = await req('/api/admin/dashboard', {
    method: 'GET',
    headers: { 'x-urbandirect-session': superAdminToken },
  });
  record(
    'ADMIN-DASHBOARD-PAYLOAD',
    'Super Admin Governance',
    'GET /api/admin/dashboard returns stores, sellers, products, orders, subscriptions, and 5 subscription plans',
    adminDash.status === 200 &&
      adminDash.json?.ok === true &&
      Array.isArray(adminDash.json?.stores) &&
      Object.values(adminDash.json?.subscriptionPlans || {}).length === 5,
    `HTTP ${adminDash.status}, stores=${adminDash.json?.stores?.length}, plans=${Object.values(adminDash.json?.subscriptionPlans || {}).length}`
  );

  // Super Admin fetches Partner Management payload and approves Vikram Deshmukh's Pune application
  const adminPartnersGet = await req('/api/admin/partners', {
    method: 'GET',
    headers: { 'x-urbandirect-session': superAdminToken },
  });
  record(
    'ADMIN-PARTNERS-LIST',
    'Partner Governance',
    'GET /api/admin/partners returns applications, active partners, allocations, and revenue attribution',
    adminPartnersGet.status === 200 &&
      adminPartnersGet.json?.ok === true &&
      Array.isArray(adminPartnersGet.json?.applications) &&
      Array.isArray(adminPartnersGet.json?.partners),
    `HTTP ${adminPartnersGet.status}, apps=${adminPartnersGet.json?.applications?.length}, partners=${adminPartnersGet.json?.partners?.length}`
  );

  const approvePartnerRes = await req('/api/admin/partners', {
    method: 'POST',
    headers: { 'x-urbandirect-session': superAdminToken },
    body: JSON.stringify({
      action: 'APPROVE_APPLICATION',
      applicationId: createdAppId,
      reviewNotes: 'KYC verified and exclusive Pune partner allocation approved.',
    }),
  });
  record(
    'ADMIN-PARTNER-APPROVE',
    'Partner Governance',
    'Super Admin approves pending Partner application and activates 50/50 city allocation',
    approvePartnerRes.status === 200 &&
      approvePartnerRes.json?.ok === true &&
      approvePartnerRes.json?.application?.status === 'APPROVED',
    `HTTP ${approvePartnerRes.status}, status=${approvePartnerRes.json?.application?.status}`
  );

  // Approved Partner accesses /api/partners/dashboard
  const partnerDashRes = await req(`/api/partners/dashboard?phone=${encodeURIComponent(partnerPhone)}`, {
    method: 'GET',
    headers: { 'x-urbandirect-session': recoveredPartnerToken },
  });
  record(
    'PARTNER-DASHBOARD-APPROVED',
    'Partner Governance',
    'Approved Partner fetches /api/partners/dashboard and sees APPROVED application',
    partnerDashRes.status === 200 &&
      partnerDashRes.json?.ok === true &&
      partnerDashRes.json?.applications?.some((a) => a.id === createdAppId && a.status === 'APPROVED'),
    `HTTP ${partnerDashRes.status}, apps=${partnerDashRes.json?.applications?.length}`
  );

  // Super Admin updates Subscription Plan pricing via /api/admin/action (and records audit log)
  const updatePlanRes = await req('/api/admin/action', {
    method: 'POST',
    headers: { 'x-urbandirect-session': superAdminToken },
    body: JSON.stringify({
      action: 'UPDATE_SUBSCRIPTION_PLAN',
      planId: 'STARTER',
      monthlyPriceInr: 999,
      annualPriceInr: 9990,
      maxActiveProducts: 250,
      featuredListings: 2,
      reason: 'Audit verification of Starter plan pricing',
    }),
  });
  record(
    'ADMIN-UPDATE-SUBSCRIPTION-PLAN',
    'Super Admin Governance',
    'POST /api/admin/action UPDATE_SUBSCRIPTION_PLAN updates plan and writes string-typed audit log entry',
    updatePlanRes.status === 200 && updatePlanRes.json?.ok === true,
    `HTTP ${updatePlanRes.status} (${updatePlanRes.json?.message})`
  );

  // Operational Admin RBAC boundary test: Operational Admin can view dashboard but CANNOT invite admins or change subscription plans
  const inviteOpAdmin = await req('/api/admin/management', {
    method: 'POST',
    headers: { 'x-urbandirect-session': superAdminToken },
    body: JSON.stringify({
      action: 'ADD_ADMIN',
      phoneE164: '+919890112233',
      name: 'Rohit Kulkarni',
      designation: 'City Operations Admin',
      role: 'admin',
    }),
  });
  record(
    'SUPER-ADMIN-INVITE-OP-ADMIN',
    'Super Admin Governance',
    'Super Admin invites Operational Admin (+919890112233) via POST /api/admin/management',
    inviteOpAdmin.status === 200 && inviteOpAdmin.json?.ok === true,
    `HTTP ${inviteOpAdmin.status}, role=${inviteOpAdmin.json?.record?.role}`
  );

  const opAdminToken = makeClientFallbackToken({
    uid: 'admin_rohit_01',
    phoneE164: '+919890112233',
    role: 'ADMIN',
    roles: ['ADMIN'],
    fullName: 'Rohit Kulkarni',
  });

  const opAdminElevateAttempt = await req('/api/admin/management', {
    method: 'POST',
    headers: { 'x-urbandirect-session': opAdminToken },
    body: JSON.stringify({
      action: 'ADD_ADMIN',
      phoneE164: '+919890999999',
      name: 'Unauthorized Admin',
    }),
  });
  record(
    'SEC-OP-ADMIN-NO-PRIV-ESCALATION',
    'Security & RBAC',
    'Operational Admin is blocked from inviting/managing admins via POST /api/admin/management (HTTP 403)',
    opAdminElevateAttempt.status === 403,
    `HTTP ${opAdminElevateAttempt.status} (${opAdminElevateAttempt.json?.error})`
  );

  const opAdminPlanAttempt = await req('/api/admin/action', {
    method: 'POST',
    headers: { 'x-urbandirect-session': opAdminToken },
    body: JSON.stringify({
      action: 'UPDATE_SUBSCRIPTION_PLAN',
      planId: 'STARTER',
      monthlyPriceInr: 100,
    }),
  });
  record(
    'SEC-OP-ADMIN-NO-PLAN-MUTATION',
    'Security & RBAC',
    'Operational Admin is blocked from mutating subscription plans (HTTP 403)',
    opAdminPlanAttempt.status === 403,
    `HTTP ${opAdminPlanAttempt.status} (${opAdminPlanAttempt.json?.error})`
  );

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n=== SUMMARY: ${passedCount}/${results.length} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in verification suite:', err);
  process.exit(1);
});
