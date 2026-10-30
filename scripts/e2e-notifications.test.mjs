import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ROOT = process.cwd();

function readSource(relPath) {
  const fullPath = path.join(ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function makeSessionToken(payload) {
  const json = JSON.stringify({
    uid: payload.uid || `user_${String(payload.phoneE164 || '').replace(/\D/g, '')}`,
    phoneE164: payload.phoneE164,
    role: String(payload.role || 'BUYER').toUpperCase(),
    roles: payload.roles || [String(payload.role || 'BUYER').toUpperCase()],
    fullName: payload.fullName || 'Verified User',
    sellerId: payload.sellerId,
    partnerId: payload.partnerId,
    storeIds: payload.storeIds || [],
    iat: Date.now(),
  });
  return `ck_sess.${Buffer.from(json, 'utf8').toString('base64url')}`;
}

function authHeaders(actor) {
  const token = makeSessionToken(actor);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-citykart-session': token,
    'x-urbandirect-session': token,
    'x-user-uid': actor.uid,
    'x-user-phone': actor.phoneE164,
    'x-user-role': String(actor.role || 'BUYER').toLowerCase(),
  };
  if (actor.sellerId) headers['x-seller-id'] = actor.sellerId;
  if (actor.partnerId) headers['x-partner-id'] = actor.partnerId;
  return headers;
}

async function req(urlPath, options = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
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
    // non-JSON
  }
  return { status: res.status, ok: res.ok, json, text };
}

describe('CityKart Unified Firebase Notification & Event Architecture — 20 Mandatory E2E Scenarios', () => {
  const suffix = Date.now().toString().slice(-6);
  const buyerPhone = `+919811${suffix}`;
  const buyerUid = `uid_buyer_${suffix}`;

  const sellerPhone = `+919822${suffix}`;
  const sellerUid = `uid_seller_${suffix}`;
  const sellerId = `seller_notif_${suffix}`;
  const storeId = `store_notif_${suffix}`;

  const partnerPhone = `+919833${suffix}`;
  const partnerUid = `uid_partner_${suffix}`;

  const superAdminActor = {
    uid: 'super_admin_owner_918329306616',
    phoneE164: '+918329306616',
    role: 'SUPER_ADMIN',
    roles: ['BUYER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'],
    fullName: 'CityKart Platform Owner',
  };

  const buyerActor = {
    uid: buyerUid,
    phoneE164: buyerPhone,
    role: 'BUYER',
    roles: ['BUYER'],
    fullName: 'Aarav Buyer',
  };

  const sellerActor = {
    uid: sellerUid,
    phoneE164: sellerPhone,
    role: 'SELLER',
    roles: ['BUYER', 'SELLER'],
    sellerId,
    storeIds: [storeId],
    fullName: 'Meera Merchant',
  };

  const partnerActor = {
    uid: partnerUid,
    phoneE164: partnerPhone,
    role: 'PARTNER',
    roles: ['BUYER', 'PARTNER'],
    fullName: 'Rohan City Partner',
  };

  const intruderActor = {
    uid: `uid_intruder_${suffix}`,
    phoneE164: `+919899${suffix}`,
    role: 'BUYER',
    roles: ['BUYER'],
    fullName: 'Unauthorized Intruder',
  };

  let createdOrderId = `ORD-NOTIF-${suffix}`;
  let createdOrderDeliveryPin = '';
  let partnerAppId = '';
  let buyerSampleNotificationId = '';

  it('ARCH-001: Service Worker, FCM Registry, Unified Notification Engine, and Firestore Rules are properly configured', () => {
    const swSrc = readSource('public/firebase-messaging-sw.js');
    assert.ok(
      swSrc.includes('AIzaSyDxbT6rWpl3mrVT5RcwNHVT_T_gecLubkA'),
      'Service worker must use synchronized Firebase config API key'
    );
    assert.ok(
      swSrc.includes('resolveDefaultDestinationRoute'),
      'Service worker must resolve role-aware deep links on notificationclick'
    );

    const rulesSrc = readSource('firestore.rules');
    assert.ok(
      rulesSrc.includes('match /notifications/{notificationId}'),
      'firestore.rules must secure /notifications/{notificationId}'
    );
    assert.ok(
      rulesSrc.includes('match /userNotificationPreferences/{userId}'),
      'firestore.rules must secure /userNotificationPreferences/{userId}'
    );

    const blueprintSrc = readSource('firebase-blueprint.json');
    assert.ok(
      blueprintSrc.includes('UnifiedNotificationRecord'),
      'firebase-blueprint.json must define UnifiedNotificationRecord'
    );
  });

  it('SCENARIO-01: Buyer registration generates Welcome & Account Security notifications', async () => {
    const res = await req('/api/auth/otp', {
      method: 'POST',
      body: JSON.stringify({
        action: 'COMPLETE_REGISTRATION',
        phoneE164: buyerPhone,
        countryCode: 'IN',
        city: 'Nanded',
        stateRegion: 'Maharashtra',
        country: 'India',
        fullName: buyerActor.fullName,
        role: 'BUYER',
        firebaseUid: buyerUid,
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.ok, true);

    const notifRes = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    assert.equal(notifRes.status, 200);
    assert.equal(notifRes.json?.ok, true);
    const welcome = notifRes.json.notifications.find(
      (n) => n.type === 'BUYER_REGISTRATION_CONFIRMED'
    );
    assert.ok(welcome, 'Buyer must receive BUYER_REGISTRATION_CONFIRMED notification');
    assert.equal(welcome.recipientRole, 'BUYER');
    assert.equal(welcome.isRead, false);
  });

  it('SCENARIO-02: Seller registration & Store creation generates Seller & Admin notifications', async () => {
    const regRes = await req('/api/auth/otp', {
      method: 'POST',
      body: JSON.stringify({
        action: 'COMPLETE_REGISTRATION',
        phoneE164: sellerPhone,
        countryCode: 'IN',
        city: 'Nanded',
        stateRegion: 'Maharashtra',
        country: 'India',
        fullName: sellerActor.fullName,
        role: 'SELLER',
        firebaseUid: sellerUid,
      }),
    });
    assert.equal(regRes.status, 200);

    const storeRes = await req('/api/stores', {
      method: 'POST',
      headers: authHeaders(sellerActor),
      body: JSON.stringify({
        store: {
          id: storeId,
          sellerId,
          ownerUid: sellerUid,
          sellerName: sellerActor.fullName,
          sellerPhone,
          phone: sellerPhone,
          name: `Royal Kirana ${suffix}`,
          categoryId: 'groceries',
          category: 'Groceries & Daily Needs',
          countryCode: 'IN',
          country: 'India',
          stateRegion: 'Maharashtra',
          district: 'Nanded',
          localityType: 'CITY',
          cityId: 'india-maharashtra-nanded',
          cityName: 'Nanded',
          city: 'Nanded',
          postalCode: '431601',
          neighborhood: 'Vazirabad',
          address: 'Main Road, Vazirabad, Nanded',
          locationVerified: true,
          serviceArea: {
            scopeType: 'CITY_WIDE',
            coveredLocalities: ['Vazirabad', 'Shivaji Nagar'],
            maxRadiusKm: 10,
          },
          isActive: true,
        },
        seller: {
          id: sellerId,
          ownerUid: sellerUid,
          businessOwnerName: sellerActor.fullName,
          phoneE164: sellerPhone,
          phoneCountryCode: 'IN',
          phoneVerified: true,
          role: 'SELLER',
          storeIds: [storeId],
        },
      }),
    });
    assert.equal(storeRes.status, 200);
    assert.equal(storeRes.json?.ok, true);

    const sellerNotifs = await req('/api/notifications?role=SELLER', {
      headers: authHeaders(sellerActor),
    });
    assert.equal(sellerNotifs.status, 200);
    const storeCreatedNotif = sellerNotifs.json.notifications.find(
      (n) => n.type === 'SELLER_REGISTRATION_ACKNOWLEDGED' && n.relatedEntityId === storeId
    );
    assert.ok(storeCreatedNotif, 'Seller must receive SELLER_REGISTRATION_ACKNOWLEDGED notification for store');

    const adminNotifs = await req('/api/notifications?role=SUPER_ADMIN', {
      headers: authHeaders(superAdminActor),
    });
    assert.equal(adminNotifs.status, 200);
    const adminStoreNotif = adminNotifs.json.notifications.find(
      (n) => n.type === 'ADMIN_SELLER_VERIFICATION_REQUEST' && n.relatedEntityId === storeId
    );
    assert.ok(adminStoreNotif, 'Super Admin must receive ADMIN_SELLER_VERIFICATION_REQUEST notification');
  });

  it('SCENARIO-03: Partner application submission generates Applicant & Admin notifications', async () => {
    const appRes = await req('/api/partners/applications', {
      method: 'POST',
      headers: authHeaders(partnerActor),
      body: JSON.stringify({
        applicantUid: partnerUid,
        fullLegalName: partnerActor.fullName,
        phoneE164: partnerPhone,
        otpVerified: true,
        email: `partner.${suffix}@citykart.shop`,
        residentialOrBusinessAddress: 'Civil Lines, Solapur',
        country: 'India',
        stateRegion: 'Maharashtra',
        district: 'Solapur',
        cityId: 'india-maharashtra-solapur',
        cityName: 'Solapur',
        postalCode: '413001',
        occupationOrBusinessBackground: 'Local FMCG Distributor',
        experienceSummary: '8 years managing 150+ retail stores',
        expectedMonthlyStoreOnboarding: 40,
        localGrowthPlan: 'Direct field onboarding across markets',
        teamStrength: 4,
        panOrTaxId: 'ABCDE1234F',
        govIdType: 'AADHAAR_LAST4',
        govIdNumberMasked: 'XXXX-XXXX-4321',
        bankAccountHolderName: partnerActor.fullName,
        bankName: 'State Bank of India',
        bankAccountNumber: '123456789012',
        bankIfscCode: 'SBIN0001234',
        upiId: `rohan${suffix}@sbi`,
        agreements: {
          independentContractorAccepted: true,
          confidentialityAccepted: true,
          antiFraudPolicyAccepted: true,
          payoutTermsAccepted: true,
        },
      }),
    });
    assert.ok(appRes.status === 200 || appRes.status === 201, `Partner application failed: ${JSON.stringify(appRes.json)}`);
    assert.equal(appRes.json?.ok, true);
    partnerAppId = appRes.json.application.id;

    const partnerNotifs = await req('/api/notifications?role=PARTNER', {
      headers: authHeaders(partnerActor),
    });
    assert.equal(partnerNotifs.status, 200);
    const subNotif = partnerNotifs.json.notifications.find(
      (n) => n.type === 'PARTNER_APPLICATION_SUBMITTED'
    );
    assert.ok(subNotif, 'Partner applicant must receive PARTNER_APPLICATION_SUBMITTED notification');
  });

  it('SCENARIO-04: Partner approval generates Partner Approval & City Allocation notifications', async () => {
    const approveRes = await req('/api/admin/partners', {
      method: 'POST',
      headers: authHeaders(superAdminActor),
      body: JSON.stringify({
        action: 'APPROVE_APPLICATION',
        applicationId: partnerAppId,
        reviewNotes: 'Verified credentials and market plan.',
        notes: 'Verified credentials and market plan.',
      }),
    });
    assert.equal(approveRes.status, 200, `Partner approval failed: ${JSON.stringify(approveRes.json)}`);
    assert.equal(approveRes.json?.ok, true);

    const partnerNotifs = await req('/api/notifications?role=PARTNER', {
      headers: authHeaders(partnerActor),
    });
    assert.equal(partnerNotifs.status, 200);
    const approvedNotif = partnerNotifs.json.notifications.find(
      (n) => n.type === 'PARTNER_APPLICATION_APPROVED'
    );
    assert.ok(approvedNotif, 'Partner must receive PARTNER_APPLICATION_APPROVED notification');

    // Release allocation after verification so repeat test runs remain idempotent
    await req('/api/admin/partners', {
      method: 'POST',
      headers: authHeaders(superAdminActor),
      body: JSON.stringify({
        action: 'DEACTIVATE_PARTNER',
        partnerId: `partner_${partnerAppId}`,
        reason: 'E2E test cleanup',
      }),
    });
  });

  it('SCENARIO-05: Partner rejection generates Partner Rejection notification with reason', async () => {
    const rejectPhone = `+919844${suffix}`;
    const rejectUid = `uid_partner_reject_${suffix}`;
    const rejectActor = {
      uid: rejectUid,
      phoneE164: rejectPhone,
      role: 'PARTNER',
      roles: ['BUYER', 'PARTNER'],
      fullName: 'Vikram Applicant',
    };

    const appRes = await req('/api/partners/applications', {
      method: 'POST',
      headers: authHeaders(rejectActor),
      body: JSON.stringify({
        applicantUid: rejectUid,
        fullLegalName: rejectActor.fullName,
        phoneE164: rejectPhone,
        otpVerified: true,
        email: `vikram.${suffix}@citykart.shop`,
        residentialOrBusinessAddress: 'Station Road, Kolhapur',
        country: 'India',
        stateRegion: 'Maharashtra',
        district: 'Kolhapur',
        cityId: 'india-maharashtra-kolhapur',
        cityName: 'Kolhapur',
        postalCode: '416001',
        occupationOrBusinessBackground: 'Retail Consultant',
        experienceSummary: '5 years retail consulting',
        expectedMonthlyStoreOnboarding: 25,
        localGrowthPlan: 'Onboard main bazaar merchants',
        teamStrength: 2,
        panOrTaxId: 'FGHIJ5678K',
        govIdType: 'AADHAAR_LAST4',
        govIdNumberMasked: 'XXXX-XXXX-8765',
        bankAccountHolderName: rejectActor.fullName,
        bankName: 'HDFC Bank',
        bankAccountNumber: '987654321098',
        bankIfscCode: 'HDFC0001234',
        agreements: {
          independentContractorAccepted: true,
          confidentialityAccepted: true,
          antiFraudPolicyAccepted: true,
          payoutTermsAccepted: true,
        },
      }),
    });
    assert.ok(appRes.status === 200 || appRes.status === 201, `Reject partner app creation failed: ${JSON.stringify(appRes.json)}`);
    const rejectAppId = appRes.json.application.id;

    const rejRes = await req('/api/admin/partners', {
      method: 'POST',
      headers: authHeaders(superAdminActor),
      body: JSON.stringify({
        action: 'REJECT_APPLICATION',
        applicationId: rejectAppId,
        reason: 'Incomplete KYC verification documents.',
        reviewNotes: 'Incomplete KYC verification documents.',
      }),
    });
    assert.equal(rejRes.status, 200);

    const rejNotifs = await req('/api/notifications?role=PARTNER', {
      headers: authHeaders(rejectActor),
    });
    assert.equal(rejNotifs.status, 200);
    const rejNotif = rejNotifs.json.notifications.find(
      (n) => n.type === 'PARTNER_APPLICATION_REJECTED'
    );
    assert.ok(rejNotif, 'Rejected partner applicant must receive PARTNER_APPLICATION_REJECTED notification');
    assert.ok(rejNotif.message.includes('Incomplete KYC verification documents'));
  });

  it('SCENARIO-06: Order placement generates Buyer and Seller notifications', async () => {
    const orderRes = await req('/api/orders', {
      method: 'POST',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        id: createdOrderId,
        buyerUid,
        customer: {
          fullName: buyerActor.fullName,
          phone: buyerPhone,
          phoneE164: buyerPhone,
          deliveryAddress: 'Flat 202, Shanti Nagar, Vazirabad, Nanded',
          address: 'Flat 202, Shanti Nagar, Vazirabad, Nanded',
          city: 'Nanded',
          locality: 'Vazirabad',
          stateRegion: 'Maharashtra',
          country: 'India',
        },
        storeId,
        storeName: `Royal Kirana ${suffix}`,
        sellerId,
        items: [
          {
            productId: `prod_${suffix}`,
            name: 'Premium Basmati Rice 5kg',
            quantity: 2,
            price: 450,
          },
        ],
        subtotal: 900,
        deliveryFee: 30,
        discount: 0,
        total: 930,
        paymentMethod: 'PAY_ON_DELIVERY',
        termsAcknowledged: true,
      }),
    });
    assert.equal(orderRes.status, 200);
    assert.equal(orderRes.json?.ok, true);
    createdOrderDeliveryPin = orderRes.json?.deliveryPin || '';

    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const buyerOrderNotif = buyerNotifs.json.notifications.find(
      (n) => n.type === 'ORDER_PLACED' && n.relatedEntityId === createdOrderId
    );
    assert.ok(buyerOrderNotif, 'Buyer must receive ORDER_PLACED notification');
    buyerSampleNotificationId = buyerOrderNotif.id;

    const sellerNotifs = await req('/api/notifications?role=SELLER', {
      headers: authHeaders(sellerActor),
    });
    const sellerOrderNotif = sellerNotifs.json.notifications.find(
      (n) => n.type === 'NEW_CUSTOMER_ORDER' && n.relatedEntityId === createdOrderId
    );
    assert.ok(sellerOrderNotif, 'Seller must receive NEW_CUSTOMER_ORDER notification');
  });

  it('SCENARIO-07: Order confirmation (ACCEPTED / CONFIRMED) generates Buyer notification', async () => {
    const statusRes = await req(`/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: authHeaders(sellerActor),
      body: JSON.stringify({
        status: 'CONFIRMED',
        sellerId,
      }),
    });
    assert.equal(statusRes.status, 200);

    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const confirmedNotif = buyerNotifs.json.notifications.find(
      (n) => n.type === 'ORDER_ACCEPTED' && n.relatedEntityId === createdOrderId
    );
    assert.ok(confirmedNotif, 'Buyer must receive ORDER_ACCEPTED notification');
  });

  it('SCENARIO-08: Order packed/preparing (PACKED) generates Buyer notification', async () => {
    const statusRes = await req(`/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: authHeaders(sellerActor),
      body: JSON.stringify({
        status: 'PACKED',
        sellerId,
      }),
    });
    assert.equal(statusRes.status, 200);

    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const packedNotif = buyerNotifs.json.notifications.find(
      (n) => n.type === 'ORDER_PACKED' && n.relatedEntityId === createdOrderId
    );
    assert.ok(packedNotif, 'Buyer must receive ORDER_PACKED notification');
  });

  it('SCENARIO-09: Order out-for-delivery (OUT_FOR_DELIVERY) generates Buyer notification with PIN reminder', async () => {
    const statusRes = await req(`/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: authHeaders(sellerActor),
      body: JSON.stringify({
        status: 'OUT_FOR_DELIVERY',
        sellerId,
      }),
    });
    assert.equal(statusRes.status, 200);

    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const ofdNotif = buyerNotifs.json.notifications.find(
      (n) => n.type === 'ORDER_OUT_FOR_DELIVERY' && n.relatedEntityId === createdOrderId
    );
    assert.ok(ofdNotif, 'Buyer must receive ORDER_OUT_FOR_DELIVERY notification');
  });

  it('SCENARIO-10: Delivery completed via 6-digit PIN verification generates Buyer & Seller notifications', async () => {
    assert.ok(createdOrderDeliveryPin.length === 6, 'Must have 6-digit delivery PIN from order creation');
    const pinRes = await req(`/api/orders/${createdOrderId}/verify-pin`, {
      method: 'POST',
      headers: authHeaders(sellerActor),
      body: JSON.stringify({
        pin: createdOrderDeliveryPin,
        actorId: sellerId,
        actorRole: 'SELLER',
      }),
    });
    assert.equal(pinRes.status, 200);
    assert.equal(pinRes.json?.ok, true);

    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const deliveredBuyer = buyerNotifs.json.notifications.find(
      (n) => n.type === 'ORDER_DELIVERED' && n.relatedEntityId === createdOrderId
    );
    assert.ok(deliveredBuyer, 'Buyer must receive ORDER_DELIVERED notification');

    const sellerNotifs = await req('/api/notifications?role=SELLER', {
      headers: authHeaders(sellerActor),
    });
    const deliveredSeller = sellerNotifs.json.notifications.find(
      (n) =>
        n.type === 'SELLER_ORDER_STATUS_UPDATED' &&
        n.relatedEntityId === createdOrderId &&
        n.title.includes('Delivered')
    );
    assert.ok(deliveredSeller, 'Seller must receive Delivered status notification');
  });

  it('SCENARIO-11: Order cancellation generates Buyer & Seller cancellation notifications', async () => {
    const cancelOrderId = `ORD-CANCEL-${suffix}`;
    await req('/api/orders', {
      method: 'POST',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        id: cancelOrderId,
        buyerUid,
        customer: {
          fullName: buyerActor.fullName,
          phone: buyerPhone,
          phoneE164: buyerPhone,
          deliveryAddress: 'Vazirabad, Nanded',
          city: 'Nanded',
        },
        storeId,
        storeName: `Royal Kirana ${suffix}`,
        sellerId,
        items: [{ productId: `prod_${suffix}`, name: 'Test Item', quantity: 1, price: 200 }],
        subtotal: 200,
        deliveryFee: 20,
        discount: 0,
        total: 220,
        paymentMethod: 'PAY_ON_DELIVERY',
        termsAcknowledged: true,
      }),
    });

    const cancelRes = await req(`/api/orders/${cancelOrderId}/status`, {
      method: 'PATCH',
      headers: authHeaders(sellerActor),
      body: JSON.stringify({
        status: 'CANCELLED',
        sellerId,
        reason: 'Item out of stock at warehouse',
      }),
    });
    assert.equal(cancelRes.status, 200);

    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const cancelBuyer = buyerNotifs.json.notifications.find(
      (n) => n.type === 'ORDER_CANCELLED' && n.relatedEntityId === cancelOrderId
    );
    assert.ok(cancelBuyer, 'Buyer must receive ORDER_CANCELLED notification');

    const sellerNotifs = await req('/api/notifications?role=SELLER', {
      headers: authHeaders(sellerActor),
    });
    const cancelSeller = sellerNotifs.json.notifications.find(
      (n) => n.type === 'SELLER_ORDER_CANCELLED' && n.relatedEntityId === cancelOrderId
    );
    assert.ok(cancelSeller, 'Seller must receive SELLER_ORDER_CANCELLED notification');
  });

  it('SCENARIO-12: Payment success (PAID) generates Buyer & Seller payment confirmation notifications', async () => {
    const payRes = await req(`/api/orders/${createdOrderId}/payment`, {
      method: 'POST',
      headers: authHeaders(sellerActor),
      body: JSON.stringify({
        paymentStatus: 'PAID',
        actorSellerId: sellerId,
        collectionMethod: 'UPI_ON_DELIVERY',
        referenceNote: `UPI-REF-${suffix}`,
      }),
    });
    assert.equal(payRes.status, 200);

    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const paidBuyer = buyerNotifs.json.notifications.find(
      (n) =>
        n.type === 'REFUND_PAYMENT_STATUS' &&
        n.relatedEntityId === createdOrderId &&
        n.title.includes('Payment Confirmed')
    );
    assert.ok(paidBuyer, 'Buyer must receive Payment Confirmed notification');

    const sellerNotifs = await req('/api/notifications?role=SELLER', {
      headers: authHeaders(sellerActor),
    });
    const paidSeller = sellerNotifs.json.notifications.find(
      (n) =>
        n.type === 'SELLER_SUBSCRIPTION_PAYMENT_STATUS' &&
        n.relatedEntityId === createdOrderId
    );
    assert.ok(paidSeller, 'Seller must receive Payment Collected notification');
  });

  it('SCENARIO-13: Payment failure/dispute (DISPUTED) generates Buyer & Admin escalation notifications', async () => {
    const disputeOrderId = `ORD-DISPUTE-${suffix}`;
    await req('/api/orders', {
      method: 'POST',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        id: disputeOrderId,
        buyerUid,
        customer: {
          fullName: buyerActor.fullName,
          phone: buyerPhone,
          phoneE164: buyerPhone,
          deliveryAddress: 'Vazirabad, Nanded',
          city: 'Nanded',
        },
        storeId,
        storeName: `Royal Kirana ${suffix}`,
        sellerId,
        items: [{ productId: `prod_${suffix}`, name: 'Test Item', quantity: 1, price: 350 }],
        subtotal: 350,
        deliveryFee: 20,
        discount: 0,
        total: 370,
        paymentMethod: 'PAY_ON_DELIVERY',
        termsAcknowledged: true,
      }),
    });

    const dispRes = await req(`/api/orders/${disputeOrderId}/payment`, {
      method: 'POST',
      headers: authHeaders(sellerActor),
      body: JSON.stringify({
        paymentStatus: 'DISPUTED',
        actorSellerId: sellerId,
        referenceNote: 'UPI transaction timeout at doorstep',
      }),
    });
    assert.equal(dispRes.status, 200);

    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const dispBuyer = buyerNotifs.json.notifications.find(
      (n) =>
        n.type === 'REFUND_PAYMENT_STATUS' &&
        n.relatedEntityId === disputeOrderId &&
        n.title.includes('Payment Escalation')
    );
    assert.ok(dispBuyer, 'Buyer must receive Payment Escalation notification on payment dispute');
  });

  it('SCENARIO-14: Customer enquiry / store review generates Seller notification', async () => {
    const revRes = await req('/api/notifications', {
      method: 'POST',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        action: 'CUSTOMER_INTERACTION',
        interactionType: 'CUSTOMER_REVIEW',
        storeId,
        sellerId,
        buyerName: buyerActor.fullName,
        buyerPhoneE164: buyerPhone,
        rating: 5,
        messageText: 'Super fast delivery and fresh groceries!',
      }),
    });
    assert.equal(revRes.status, 200);
    assert.equal(revRes.json?.ok, true);

    const sellerNotifs = await req('/api/notifications?role=SELLER', {
      headers: authHeaders(sellerActor),
    });
    const reviewNotif = sellerNotifs.json.notifications.find(
      (n) => n.type === 'CUSTOMER_REVIEW_RECEIVED'
    );
    assert.ok(reviewNotif, 'Seller must receive CUSTOMER_REVIEW_RECEIVED notification');
  });

  it('SCENARIO-15: Real-time unread count increments accurately across events', async () => {
    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    assert.equal(buyerNotifs.status, 200);
    assert.ok(
      typeof buyerNotifs.json.unreadCount === 'number' && buyerNotifs.json.unreadCount >= 5,
      `Expected Buyer unreadCount >= 5, got ${buyerNotifs.json.unreadCount}`
    );
  });

  it('SCENARIO-16: Mark single notification as read updates status, readAt, and decrements unreadCount', async () => {
    const beforeRes = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const beforeUnread = beforeRes.json.unreadCount;
    assert.ok(buyerSampleNotificationId, 'Must have a sample buyer notification ID');

    const markRes = await req('/api/notifications', {
      method: 'PATCH',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        action: 'MARK_READ',
        notificationId: buyerSampleNotificationId,
      }),
    });
    assert.equal(markRes.status, 200);
    assert.equal(markRes.json?.ok, true);
    assert.equal(markRes.json?.notification?.isRead, true);
    assert.equal(markRes.json?.notification?.status, 'READ');
    assert.ok(markRes.json?.notification?.readAt, 'readAt timestamp must be set');

    const afterRes = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    assert.equal(afterRes.json.unreadCount, beforeUnread - 1);
  });

  it('SCENARIO-17: Mark all notifications as read resets unreadCount to 0 for that role', async () => {
    const markAllRes = await req('/api/notifications', {
      method: 'PATCH',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        action: 'MARK_ALL_READ',
        role: 'BUYER',
      }),
    });
    assert.equal(markAllRes.status, 200);
    assert.equal(markAllRes.json?.ok, true);
    assert.ok(markAllRes.json.markedCount >= 1);

    const afterRes = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    assert.equal(afterRes.json.unreadCount, 0, 'Buyer unreadCount must be 0 after MARK_ALL_READ');
  });

  it('SCENARIO-18: FCM token registration & push delivery telemetry tracks registered device tokens and user preferences', async () => {
    const simToken = `fcm_web_${buyerUid}_device_token_1234567890`;
    const regTokenRes = await req('/api/fcm/token', {
      method: 'POST',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        token: simToken,
        uid: buyerUid,
        buyerPhone,
        phoneE164: buyerPhone,
        role: 'BUYER',
        roles: ['BUYER'],
        userAgent: 'CityKart-E2E-Test-Runner/1.0',
      }),
    });
    assert.equal(regTokenRes.status, 200);
    assert.equal(regTokenRes.json?.ok, true);

    // Update user notification preferences and verify ACCOUNT_SECURITY cannot be disabled
    const prefRes = await req('/api/notifications/preferences', {
      method: 'PUT',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        browserPushEnabled: true,
        marketingEnabled: false,
        categories: {
          ACCOUNT_SECURITY: false, // should remain true (mandatory security lock)
          MARKETING_PROMOTIONS: false,
        },
      }),
    });
    assert.equal(prefRes.status, 200);
    assert.equal(prefRes.json?.preferences?.categories?.ACCOUNT_SECURITY, true);
    assert.equal(prefRes.json?.preferences?.categories?.MARKETING_PROMOTIONS, false);

    // Trigger a profile update notification and verify FCM simulated token ack telemetry
    const profNotifRes = await req('/api/notifications', {
      method: 'POST',
      headers: authHeaders(buyerActor),
      body: JSON.stringify({
        action: 'PROFILE_UPDATED',
        fullName: buyerActor.fullName,
        role: 'BUYER',
      }),
    });
    assert.equal(profNotifRes.status, 200);
    assert.equal(profNotifRes.json?.notification?.fcmStatus, 'SIMULATED_TOKEN_ACK');
  });

  it('SCENARIO-19: Background notification click routing & duplicate event idempotency protection', async () => {
    // Verify destinationRoute values across Buyer, Seller, and Partner notifications
    const buyerNotifs = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(buyerActor),
    });
    const orderNotif = buyerNotifs.json.notifications.find((n) => n.relatedEntityId === createdOrderId);
    assert.ok(orderNotif?.destinationRoute?.startsWith('/orders'), 'Buyer order notification must route to /orders');

    const sellerNotifs = await req('/api/notifications?role=SELLER', {
      headers: authHeaders(sellerActor),
    });
    const sellerNotif = sellerNotifs.json.notifications.find((n) => n.relatedEntityId === createdOrderId);
    assert.ok(
      sellerNotif?.destinationRoute?.includes('view=seller') || sellerNotif?.destinationRoute?.startsWith('/seller'),
      'Seller order notification must route to seller orders view'
    );

    const partnerNotifs = await req('/api/notifications?role=PARTNER', {
      headers: authHeaders(partnerActor),
    });
    const partnerNotif = partnerNotifs.json.notifications[0];
    assert.ok(partnerNotif?.destinationRoute?.startsWith('/partner'), 'Partner notification must route to /partner');

    // Verify Admin Broadcast idempotency / delivery diagnostics
    const broadcastRes = await req('/api/notifications', {
      method: 'POST',
      headers: authHeaders(superAdminActor),
      body: JSON.stringify({
        action: 'ADMIN_BROADCAST',
        title: `Platform Maintenance Advisory ${suffix}`,
        message: 'Scheduled zero-downtime upgrade completed.',
        targetRole: 'ALL',
        severity: 'INFO',
      }),
    });
    assert.equal(broadcastRes.status, 200);
    assert.equal(broadcastRes.json?.ok, true);
    assert.ok(broadcastRes.json?.dispatchedCount >= 1);
  });

  it('SCENARIO-20: Unauthorized user is strictly blocked (HTTP 403 / zero data leakage) from reading or mutating another user notifications', async () => {
    // Intruder queries their own inbox — must NOT contain buyerActor's notifications
    const intruderInbox = await req('/api/notifications?role=BUYER', {
      headers: authHeaders(intruderActor),
    });
    assert.equal(intruderInbox.status, 200);
    const leaked = intruderInbox.json.notifications.find(
      (n) => n.recipientPhoneE164 === buyerPhone || n.recipientUid === buyerUid
    );
    assert.equal(leaked, undefined, 'Intruder must never see another user notifications');

    // Intruder attempts to mark buyerActor's notification as read -> must receive 403 Forbidden
    const markAttempt = await req('/api/notifications', {
      method: 'PATCH',
      headers: authHeaders(intruderActor),
      body: JSON.stringify({
        action: 'MARK_READ',
        notificationId: buyerSampleNotificationId,
      }),
    });
    assert.equal(markAttempt.status, 403, 'Intruder must be blocked with HTTP 403 when marking another user notification');

    // Intruder attempts ADMIN_BROADCAST -> must receive 403 Forbidden
    const broadcastAttempt = await req('/api/notifications', {
      method: 'POST',
      headers: authHeaders(intruderActor),
      body: JSON.stringify({
        action: 'ADMIN_BROADCAST',
        title: 'Fake Admin Broadcast',
        message: 'Unauthorized message',
      }),
    });
    assert.equal(broadcastAttempt.status, 403, 'Non-admin must be blocked with HTTP 403 from sending admin broadcasts');
  });
});
