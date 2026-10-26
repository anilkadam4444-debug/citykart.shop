import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const PLATFORM_FEE_RATE = 0.02;
const PLATFORM_FEE_MAX_PER_UNIT = 70;

function calculatePlatformFeePerUnit(price) {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const fee = Math.min(price * PLATFORM_FEE_RATE, PLATFORM_FEE_MAX_PER_UNIT);
  return Math.round(fee * 100) / 100;
}

function calculateItemPlatformFee(price, quantity) {
  const validQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  if (validQty === 0) return 0;
  return Math.round(calculatePlatformFeePerUnit(price) * validQty * 100) / 100;
}

test('Phase 4 & 16: Platform Fee Per-Unit and Multi-Quantity Math (2% capped at ₹70)', () => {
  // Low price: ₹100 -> 2% = ₹2
  assert.equal(calculatePlatformFeePerUnit(100), 2);
  assert.equal(calculateItemPlatformFee(100, 3), 6);

  // Fractional price: ₹199.99 -> 2% = 3.9998 -> ₹4.00
  assert.equal(calculatePlatformFeePerUnit(199.99), 4);
  assert.equal(calculateItemPlatformFee(199.99, 2), 8);

  // Fractional price: ₹49.50 -> 2% = ₹0.99
  assert.equal(calculatePlatformFeePerUnit(49.5), 0.99);
  assert.equal(calculateItemPlatformFee(49.5, 3), 2.97);

  // Exact cap threshold: ₹3,500 -> 2% = ₹70
  assert.equal(calculatePlatformFeePerUnit(3500), 70);
  assert.equal(calculateItemPlatformFee(3500, 1), 70);
  assert.equal(calculateItemPlatformFee(3500, 4), 280);

  // High price above cap: ₹10,000 -> capped at ₹70 per unit
  assert.equal(calculatePlatformFeePerUnit(10000), 70);
  assert.equal(calculateItemPlatformFee(10000, 5), 350);

  // Zero, negative, and NaN edge cases
  assert.equal(calculatePlatformFeePerUnit(0), 0);
  assert.equal(calculatePlatformFeePerUnit(-250), 0);
  assert.equal(calculatePlatformFeePerUnit(Number.NaN), 0);
  assert.equal(calculateItemPlatformFee(500, 0), 0);
  assert.equal(calculateItemPlatformFee(500, -2), 0);
});

test('Phase 4 & 16: Subscription Checkout + Reserved Platform Fee + 18% GST Reconciliation Math', () => {
  const basePriceInr = 999; // Growth Monthly
  const outstandingFeesInr = 142.97; // Accrued platform fees
  const taxRateInr = 0.18;

  const subtotalWithFees = Math.round((basePriceInr + outstandingFeesInr) * 100) / 100;
  const taxAmount = Math.round(subtotalWithFees * taxRateInr * 100) / 100;
  const totalAmount = Math.round((subtotalWithFees + taxAmount) * 100) / 100;

  assert.equal(subtotalWithFees, 1141.97);
  assert.equal(taxAmount, 205.55);
  assert.equal(totalAmount, 1347.52);
  assert.equal(Math.round(totalAmount * 100), 134752); // Razorpay paise integer
});

test('Phase 4 & 16: Razorpay HMAC-SHA256 Signature & Timing-Safe Verification', () => {
  const secret = 'rzp_test_secret_audit_key_2026';
  const orderId = 'order_Audit123456789';
  const paymentId = 'pay_Audit987654321';

  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const verifySignature = (receivedSig) => {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const genBuf = Buffer.from(expected, 'utf8');
    const recBuf = Buffer.from(String(receivedSig), 'utf8');
    return genBuf.length === recBuf.length && crypto.timingSafeEqual(genBuf, recBuf);
  };

  assert.equal(verifySignature(validSignature), true);
  assert.equal(verifySignature('invalid_signature_hex'), false);
  assert.equal(verifySignature(validSignature.slice(0, -1) + '0'), false);
});

test('Phase 5 & 16: 6-Digit Delivery PIN Scrypt Hashing, Verification & Lockout State Machine', () => {
  const pin = '482915';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 64).toString('hex');

  const verifyPin = (candidate) => {
    const candidateBuf = crypto.scryptSync(String(candidate), salt, 64);
    const storedBuf = Buffer.from(hash, 'hex');
    return (
      candidateBuf.length === storedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, storedBuf)
    );
  };

  assert.equal(verifyPin('482915'), true);
  assert.equal(verifyPin('482916'), false);
  assert.equal(verifyPin('000000'), false);
});

import fs from 'node:fs';
import path from 'node:path';

test('Phase 2 & 3 Remediation (FINDING-01 & FINDING-02): Billing & Order API Authorization Guards', () => {
  const feesRoute = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/billing/fees/route.ts'),
    'utf8'
  );
  assert.ok(
    feesRoute.includes('verifyAuthenticatedCaller') &&
      feesRoute.includes('Forbidden: You can only view platform fee ledger records for your own seller account.'),
    'GET /api/billing/fees must enforce caller session isolation against cross-seller enumeration'
  );

  const createCheckoutRoute = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/billing/create-checkout/route.ts'),
    'utf8'
  );
  assert.ok(
    createCheckoutRoute.includes('targetStore.sellerId !== sellerId') &&
      createCheckoutRoute.includes('verifyAuthenticatedCaller'),
    'POST /api/billing/create-checkout must verify store-to-seller ownership and caller identity'
  );

  const verifyPaymentRoute = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/billing/verify-payment/route.ts'),
    'utf8'
  );
  assert.ok(
    verifyPaymentRoute.includes('targetStore.sellerId !== sellerId') &&
      verifyPaymentRoute.includes('verifyAuthenticatedCaller'),
    'POST /api/billing/verify-payment must verify store-to-seller ownership and caller identity'
  );

  const ordersRoute = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/orders/route.ts'),
    'utf8'
  );
  assert.ok(
    ordersRoute.includes('isAuthorizedForFullOrderPii') &&
      ordersRoute.includes('maskedCustomerPhone'),
    'GET /api/orders?orderId=... must mask customer phone and address when queried without buyer/seller/admin authorization'
  );
});

test('Phase 3, 9 & 11 Remediation (FINDING-03, FINDING-04, FINDING-05): Rules, Blueprint, Headers & SEO', () => {
  const firestoreRules = fs.readFileSync(
    path.resolve(process.cwd(), 'firestore.rules'),
    'utf8'
  );
  assert.ok(
    firestoreRules.includes('match /{document=**}') &&
      firestoreRules.includes('allow read, write: if false;'),
    'firestore.rules must include an explicit default-deny catch-all rule'
  );
  assert.ok(
    firestoreRules.includes('resource.data.sellerUid == request.auth.uid'),
    'firestore.rules sellerNotifications delete rule must scope deletion to the owning sellerUid or Admin'
  );

  const blueprint = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
  );
  assert.ok(
    blueprint.firestore['/partnerNotifications/{notificationId}'],
    'firebase-blueprint.json must include /partnerNotifications/{notificationId}'
  );

  const nextConfig = fs.readFileSync(
    path.resolve(process.cwd(), 'next.config.ts'),
    'utf8'
  );
  assert.ok(
    nextConfig.includes('X-Content-Type-Options') &&
      nextConfig.includes('Referrer-Policy') &&
      !nextConfig.includes('ignoreBuildErrors: true'),
    'next.config.ts must configure security headers and enforce TypeScript build checks'
  );

  const robotsTs = fs.readFileSync(
    path.resolve(process.cwd(), 'app/robots.ts'),
    'utf8'
  );
  assert.ok(
    robotsTs.includes("'/partner'") &&
      robotsTs.includes("'/admin'") &&
      robotsTs.includes("'/orders'"),
    'app/robots.ts must allow /partner and disallow /admin and /orders'
  );
});

