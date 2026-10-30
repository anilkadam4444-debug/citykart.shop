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

describe('Mandatory Seller Subscription Selection & Marketplace Publication Gate', () => {
  const sellerPhone = `+919830${Math.floor(100000 + Math.random() * 900000)}`;
  let sellerToken = '';
  let sellerId = '';
  let createdStoreId = '';

  it('Step 0: Authenticate and register new seller via OTP & complete registration', async () => {
    // 1. Resolve phone
    const resolveRes = await postJson('/api/auth/otp', {
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: sellerPhone,
    });
    assert.equal(resolveRes.status, 200);

    let sessionToken = resolveRes.data.sessionToken;
    let registeredSellerId = resolveRes.data.user?.sellerId;

    if (!sessionToken && resolveRes.data.verificationToken) {
      // 2. Complete registration
      const regRes = await postJson('/api/auth/otp', {
        action: 'COMPLETE_REGISTRATION',
        verificationToken: resolveRes.data.verificationToken,
        phoneE164: sellerPhone,
        fullName: 'Quality Mart Owner',
        role: 'seller',
      });
      assert.equal(regRes.status, 200);
      assert.ok(regRes.data.sessionToken);
      sessionToken = regRes.data.sessionToken;
      registeredSellerId = regRes.data.user?.sellerId || `seller-${Date.now()}`;
    }

    assert.ok(sessionToken, 'Must have a valid seller session token');
    sellerToken = sessionToken;
    sellerId = registeredSellerId || `seller-${Date.now()}`;
  });

  it('Scenario B: Store created with skipped subscription defaults to pending_subscription and is excluded from discovery', async () => {
    createdStoreId = `test-store-${Date.now()}`;
    const newStorePayload = {
      store: {
        id: createdStoreId,
        sellerId: sellerId,
        name: 'Quality Organics Mart',
        category: 'Grocery & Essentials',
        categoryId: 'grocery-staples',
        country: 'India',
        countryCode: 'IN',
        stateRegion: 'Maharashtra',
        cityName: 'Mumbai',
        cityId: 'india-maharashtra-mumbai',
        city: 'Mumbai · Andheri West',
        neighborhood: 'Andheri West',
        address: 'Shop 12, Link Road, Andheri West',
        locationVerified: true,
        locationSource: 'PRESET',
        // Commercial Gate: Defaults to pending_subscription
        status: 'pending_subscription',
        isPublished: false,
        subscriptionStatus: 'PENDING',
      },
    };

    const storeRes = await postJson('/api/stores', newStorePayload, {
      Authorization: `Bearer ${sellerToken}`,
    });
    assert.equal(storeRes.status, 200);
    assert.equal(storeRes.data.store?.status, 'pending_subscription');
    assert.equal(storeRes.data.store?.isPublished, false);

    // Verify public discovery omits the unpublished store
    const discRes = await getJson('/api/discovery?cityId=india-maharashtra-mumbai');
    assert.equal(discRes.status, 200);
    const foundInDiscovery = (discRes.data.stores || []).some(
      (s) => s.id === createdStoreId
    );
    assert.equal(foundInDiscovery, false, 'Unpublished store must NOT be in discovery');
  });

  it('Scenario C: Paid plan checkout enforces live gateway and rejects fake auto-activation', async () => {
    const checkoutRes = await postJson(
      '/api/billing/create-checkout',
      {
        sellerId: sellerId,
        storeId: createdStoreId,
        planId: 'GROWTH',
        billingCycle: 'MONTHLY',
        currency: 'INR',
      },
      { Authorization: `Bearer ${sellerToken}` }
    );

    // Paid plans require live Razorpay credentials; never auto-activates
    if (checkoutRes.status === 501) {
      assert.equal(checkoutRes.data.needsConfig, true);
    } else {
      assert.ok(
        checkoutRes.data.checkoutSession?.gatewayOrderId ||
          checkoutRes.data.checkoutSession?.orderReferenceId
      );
    }

    // Verify store is STILL unpublished (no fake auto-activation occurred)
    const discRes = await getJson('/api/discovery?cityId=india-maharashtra-mumbai');
    const foundInDiscovery = (discRes.data.stores || []).some(
      (s) => s.id === createdStoreId
    );
    assert.equal(foundInDiscovery, false, 'Paid store must remain unpublished until verified payment');
  });

  it('Scenario D: Fake payment callback with forged HMAC signature is rejected', async () => {
    const fakeVerifyRes = await postJson(
      '/api/billing/verify-payment',
      {
        sellerId: sellerId,
        storeId: createdStoreId,
        planId: 'GROWTH',
        billingCycle: 'MONTHLY',
        currency: 'INR',
        paymentGateway: 'RAZORPAY',
        gatewayPaymentId: 'pay_fake_123456789',
        gatewayOrderId: 'order_fake_123456789',
        gatewaySignature: 'forged_hmac_sha256_signature_that_must_fail',
        totalAmount: 2948.82,
        basePrice: 2499,
        taxAmount: 449.82,
      },
      { Authorization: `Bearer ${sellerToken}` }
    );

    // Must fail signature verification or missing secret
    assert.equal(fakeVerifyRes.ok, false);
    assert.ok(fakeVerifyRes.status >= 400);
  });

  it('Scenario A: Free plan activation successfully publishes store and makes it discoverable', async () => {
    const freeCheckoutRes = await postJson(
      '/api/billing/create-checkout',
      {
        sellerId: sellerId,
        storeId: createdStoreId,
        planId: 'FREE',
        billingCycle: 'MONTHLY',
        currency: 'INR',
      },
      { Authorization: `Bearer ${sellerToken}` }
    );

    assert.equal(freeCheckoutRes.status, 200);
    assert.equal(freeCheckoutRes.data.success, true);
    assert.equal(freeCheckoutRes.data.published, true);
    assert.equal(freeCheckoutRes.data.subscription?.status, 'ACTIVE');

    // Verify store is now published in discovery
    const discRes = await getJson('/api/discovery?cityId=india-maharashtra-mumbai');
    assert.equal(discRes.status, 200);
    const foundStore = (discRes.data.stores || []).find(
      (s) => s.id === createdStoreId
    );
    assert.ok(foundStore, 'Free plan activated store MUST appear in public discovery');
    assert.equal(foundStore.isPublished, true);
    assert.equal(foundStore.status, 'active');
  });

  it('Scenario G: Unauthorized mutation of another seller store is rejected with 403', async () => {
    // Generate a different user
    const otherPhone = '+919999888877';
    const otherResolve = await postJson('/api/auth/otp', {
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: otherPhone,
    });
    let otherToken = otherResolve.data.sessionToken;
    if (!otherToken && otherResolve.data.verificationToken) {
      const otherReg = await postJson('/api/auth/otp', {
        action: 'COMPLETE_REGISTRATION',
        verificationToken: otherResolve.data.verificationToken,
        phoneE164: otherPhone,
        fullName: 'Intruder Buyer',
        role: 'buyer',
      });
      otherToken = otherReg.data.sessionToken;
    }

    const tamperRes = await postJson(
      '/api/billing/create-checkout',
      {
        sellerId: 'other-seller-attacker',
        storeId: createdStoreId,
        planId: 'FREE',
        billingCycle: 'MONTHLY',
        currency: 'INR',
      },
      { Authorization: `Bearer ${otherToken}` }
    );

    assert.equal(tamperRes.status, 403);
    assert.equal(tamperRes.ok, false);
  });

  it('Scenario I: Products belonging to unpublished store are excluded from public discovery', async () => {
    const unpubStoreId = `unpub-store-${Date.now()}`;
    await postJson(
      '/api/stores',
      {
        store: {
          id: unpubStoreId,
          sellerId: sellerId,
          name: 'Hidden Corner Store',
          category: 'Grocery & Essentials',
          categoryId: 'grocery-staples',
          country: 'India',
          stateRegion: 'Maharashtra',
          cityName: 'Mumbai',
          cityId: 'india-maharashtra-mumbai',
          address: '100 Secret Alley',
          status: 'pending_subscription',
          isPublished: false,
          subscriptionStatus: 'PENDING',
        },
      },
      { Authorization: `Bearer ${sellerToken}` }
    );

    // Add product for unpublished store
    await postJson(
      '/api/products',
      {
        product: {
          id: `prod-${Date.now()}`,
          storeId: unpubStoreId,
          sellerId: sellerId,
          name: 'Invisible Mystery Tea',
          price: 250,
          category: 'Grocery & Essentials',
          status: 'ACTIVE',
        },
      },
      { Authorization: `Bearer ${sellerToken}` }
    );

    // Discovery should NOT return any product from unpubStoreId
    const discRes = await getJson('/api/discovery?cityId=india-maharashtra-mumbai');
    const foundProduct = (discRes.data.products || []).some(
      (p) => p.storeId === unpubStoreId
    );
    assert.equal(foundProduct, false, 'Products from unpublished store must NOT be in discovery');
  });

  it('Scenario J: Suspended or unpublished store cannot accept customer orders (returns 403)', async () => {
    const orderRes = await postJson('/api/orders', {
      order: {
        id: `ord-test-${Date.now()}`,
        storeId: 'unregistered-or-suspended-store',
        storeName: 'Unknown Store',
        sellerId: 'unknown-seller',
        customer: {
          fullName: 'Test Buyer',
          phone: '+919876543210',
          phoneE164: '+919876543210',
          address: 'Flat 101, Test Road',
          city: 'Mumbai',
        },
        items: [{ productId: 'p1', title: 'Milk', price: 60, quantity: 1 }],
        totalAmount: 60,
        currency: 'INR',
        paymentMethod: 'CASH_ON_DELIVERY',
      },
    });

    assert.equal(orderRes.status, 403);
    assert.equal(orderRes.data.success, false);
    assert.ok(orderRes.data.error.includes('not currently active or published'));
  });

  it('Scenario E: Expired subscription store is omitted from public discovery', async () => {
    const expiredStoreId = `expired-store-${Date.now()}`;
    await postJson(
      '/api/stores',
      {
        store: {
          id: expiredStoreId,
          sellerId: sellerId,
          name: 'Past Due Emporium',
          category: 'Grocery & Essentials',
          categoryId: 'grocery-staples',
          country: 'India',
          stateRegion: 'Maharashtra',
          cityName: 'Mumbai',
          cityId: 'india-maharashtra-mumbai',
          address: '45 Expired Road',
          status: 'expired',
          isPublished: false,
          subscriptionStatus: 'EXPIRED',
          subscriptionExpiry: new Date(Date.now() - 86400000).toISOString(),
        },
      },
      { Authorization: `Bearer ${sellerToken}` }
    );

    const discRes = await getJson('/api/discovery?cityId=india-maharashtra-mumbai');
    const foundExpired = (discRes.data.stores || []).some(
      (s) => s.id === expiredStoreId
    );
    assert.equal(foundExpired, false, 'Expired store must NOT be in discovery');
  });

  it('Scenario F: Valid renewal activates and republishes expired store', async () => {
    const renewedStoreId = `renew-store-${Date.now()}`;
    await postJson(
      '/api/stores',
      {
        store: {
          id: renewedStoreId,
          sellerId: sellerId,
          name: 'Revitalized Mart',
          category: 'Grocery & Essentials',
          categoryId: 'grocery-staples',
          country: 'India',
          stateRegion: 'Maharashtra',
          cityName: 'Mumbai',
          cityId: 'india-maharashtra-mumbai',
          address: '77 Renewal Blvd',
          status: 'expired',
          isPublished: false,
          subscriptionStatus: 'EXPIRED',
        },
      },
      { Authorization: `Bearer ${sellerToken}` }
    );

    // Renew via Free Plan checkout
    const renewRes = await postJson(
      '/api/billing/create-checkout',
      {
        sellerId: sellerId,
        storeId: renewedStoreId,
        planId: 'FREE',
        billingCycle: 'MONTHLY',
        currency: 'INR',
      },
      { Authorization: `Bearer ${sellerToken}` }
    );

    assert.equal(renewRes.status, 200);
    assert.equal(renewRes.data.published, true);

    const discRes = await getJson('/api/discovery?cityId=india-maharashtra-mumbai');
    const foundRenewed = (discRes.data.stores || []).find(
      (s) => s.id === renewedStoreId
    );
    assert.ok(foundRenewed, 'Renewed store must be republished in discovery');
    assert.equal(foundRenewed.isPublished, true);
  });

  it('Scenario H: Direct store route guard returns 404 for unpublished or unverified store', async () => {
    const directRes = await fetch(`${BASE_URL}/stores/non-existent-unpublished-store`);
    assert.equal(directRes.status, 404, 'Direct access to non-existent or unpublished store must return 404');
  });
});
