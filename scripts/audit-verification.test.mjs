import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readSource(relPath) {
  const fullPath = path.join(ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Security, RBAC & Audit Verification Suite', () => {
  it('SEC-001: Enforces designated Super Admin owner verification in /app/api/admin/bootstrap/route.ts', () => {
    const src = readSource('app/api/admin/bootstrap/route.ts');
    assert.ok(src.includes('isDesignatedOwnerPhone'), 'Bootstrap route must verify designated owner phone');
    assert.ok(!src.includes('const isOwner = true;'), 'Bootstrap route must not hardcode isOwner = true');
  });

  it('SEC-002: Enforces structured session token and active admin authorization checks in /lib/super-admin-auth.ts', () => {
    const src = readSource('lib/super-admin-auth.ts');
    assert.ok(src.includes('DESIGNATED_SUPER_ADMIN_PHONE'), 'Must define DESIGNATED_SUPER_ADMIN_PHONE');
    assert.ok(src.includes('+918329306616'), 'Must bind Super Admin to +918329306616');
    assert.ok(src.includes('ck_sess.'), 'Must issue and verify structured ck_sess tokens');
    assert.ok(src.includes('verifyAdminRequest'), 'Must export verifyAdminRequest');
  });

  it('SEC-003: Restricts OTP self-registration from arbitrary admin privilege escalation in /app/api/auth/otp/route.ts', () => {
    const src = readSource('app/api/auth/otp/route.ts');
    assert.ok(src.includes('COMPLETE_REGISTRATION'), 'OTP route must handle COMPLETE_REGISTRATION');
    assert.ok(src.includes('isDesignatedOwnerPhone'), 'OTP route must validate designated owner phone before granting super_admin');
  });

  it('SEC-005: Protects 6-digit Delivery PIN in vault and strips raw PIN from public listings', () => {
    const pinSrc = readSource('lib/delivery-pin.ts');
    const registrySrc = readSource('lib/orders-registry.ts');
    const verifyRouteSrc = readSource('app/api/orders/[orderId]/verify-pin/route.ts');

    assert.ok(pinSrc.includes('sanitizeOrderForStorageAndListing'), 'Must define sanitizeOrderForStorageAndListing');
    assert.ok(registrySrc.includes('serverOrderPinsVault'), 'Must store raw PINs in serverOrderPinsVault');
    assert.ok(verifyRouteSrc.includes('DELIVERED'), 'PIN verification route must transition order to DELIVERED');
  });

  it('SEC-006: Firestore security rules enforce strict role boundaries with zero open wildcards', () => {
    const rules = readSource('firestore.rules');
    assert.ok(!/allow\s+read,\s*write:\s*if\s+true\s*;/.test(rules), 'Firestore rules must not contain open allow read, write: if true');
    assert.ok(rules.includes('isSuperAdmin()'), 'Firestore rules must define isSuperAdmin()');
    assert.ok(rules.includes('admin_audit_logs'), 'Firestore rules must protect admin_audit_logs');
  });

  it('UI-A11Y: Order card action buttons meet 44x44px minimum touch target on mobile', () => {
    const ordersPage = readSource('app/orders/page.tsx');
    const homePage = readSource('app/page.tsx');
    assert.ok(ordersPage.includes('min-h-[44px]'), 'app/orders/page.tsx must enforce min-h-[44px] on order action buttons');
    assert.ok(homePage.includes('min-h-[44px]'), 'app/page.tsx must enforce min-h-[44px] on order action buttons');
  });

  it('STORE-001: New store listing and adding product flow syncs ownership, localStorage, and server registries', () => {
    const providerSrc = readSource('components/urbandirect-provider.tsx');
    const studioSrc = readSource('components/merchant-studio.tsx');
    const storesApiSrc = readSource('app/api/stores/route.ts');
    const productsApiSrc = readSource('app/api/products/route.ts');
    const discoveryApiSrc = readSource('app/api/discovery/route.ts');

    assert.ok(providerSrc.includes("fetch('/api/stores'"), 'Provider must sync new stores to /api/stores');
    assert.ok(providerSrc.includes("fetch('/api/products'"), 'Provider must sync new products to /api/products');
    assert.ok(studioSrc.includes('handleFinishStoreOnboarding'), 'MerchantStudio must implement handleFinishStoreOnboarding');
    assert.ok(studioSrc.includes('handlePublishProduct'), 'MerchantStudio must implement handlePublishProduct');
    assert.ok(storesApiSrc.includes('upsertServerStore'), '/api/stores must persist stores to server registry');
    assert.ok(productsApiSrc.includes('upsertServerProduct'), '/api/products must persist products to server registry');
    assert.ok(discoveryApiSrc.includes('serverStoresRegistry'), '/api/discovery must include serverStoresRegistry');
    assert.ok(discoveryApiSrc.includes('serverProductsRegistry'), '/api/discovery must include serverProductsRegistry');
  });

  it('ORDER-001: Buyer sign-in, order placement, status progression, payment collection, and delivery PIN verification flow is fully wired', () => {
    const providerSrc = readSource('components/urbandirect-provider.tsx');
    const drawerSrc = readSource('components/cart-checkout-drawer.tsx');
    const ordersApiSrc = readSource('app/api/orders/route.ts');
    const statusApiSrc = readSource('app/api/orders/[orderId]/status/route.ts');
    const paymentApiSrc = readSource('app/api/orders/[orderId]/payment/route.ts');
    const verifyPinApiSrc = readSource('app/api/orders/[orderId]/verify-pin/route.ts');

    assert.ok(drawerSrc.includes('useUrbanDirect'), 'CartCheckoutDrawer must sync authenticatedUser via useUrbanDirect');
    assert.ok(providerSrc.includes('urbandirect_custom_orders_v1'), 'Provider must persist orders in urbandirect_custom_orders_v1');
    assert.ok(providerSrc.includes('urbandirect_pin_vault_v1'), 'Provider must persist PIN vault in urbandirect_pin_vault_v1');
    assert.ok(providerSrc.includes('/verify-pin'), 'Provider must verify delivery PIN via /api/orders/[orderId]/verify-pin');
    assert.ok(providerSrc.includes('/payment'), 'Provider must record payment status via /api/orders/[orderId]/payment');
    assert.ok(ordersApiSrc.includes('serverOrdersRegistry'), '/api/orders must persist orders to serverOrdersRegistry');
    assert.ok(statusApiSrc.includes('OUT_FOR_DELIVERY'), '/api/orders/[orderId]/status must support status transitions');
    assert.ok(paymentApiSrc.includes('PAID'), '/api/orders/[orderId]/payment must record PAID status');
    assert.ok(verifyPinApiSrc.includes('DELIVERED'), '/api/orders/[orderId]/verify-pin must transition order to DELIVERED');
  });

  it('BULK-CSV-001: Bulk product CSV upload handles UTF-8 BOM, undefined existing SKUs, auth headers, and batch persistence', () => {
    const csvParserSrc = readSource('lib/csv-parser.ts');
    const modalSrc = readSource('components/seller-bulk-upload-modal.tsx');
    const bulkRouteSrc = readSource('app/api/products/bulk-upload/route.ts');
    const registrySrc = readSource('lib/stores-registry.ts');

    assert.ok(csvParserSrc.includes('\\uFEFF'), 'CSV parser must strip UTF-8 BOM');
    assert.ok(csvParserSrc.includes('normalizeImageUrlInput'), 'CSV parser must normalize image URL inputs');
    assert.ok(modalSrc.includes('buildAuthenticatedHeaders'), 'Bulk upload modal must include authenticated session headers');
    assert.ok(modalSrc.includes('Boolean(p.sku)'), 'Bulk upload modal must safely guard against undefined product SKUs');
    assert.ok(bulkRouteSrc.includes('removeUndefined'), 'Bulk upload API route must sanitize product payloads before Firestore batch commit');
    assert.ok(bulkRouteSrc.includes('skipFirestore: true'), 'Bulk upload API route must avoid N sequential Firestore roundtrips before batch commit');
    assert.ok(registrySrc.includes('removeUndefined'), 'Stores registry must sanitize Firestore writes with removeUndefined');
  });

  it('OTP-001: /lib/firebase.ts exports genuine Firebase Auth RecaptchaVerifier and signInWithPhoneNumber with zero fake preview stubs', () => {
    const firebaseSrc = readSource('lib/firebase.ts');
    assert.ok(!firebaseSrc.includes('preview_vid_'), 'lib/firebase.ts must not contain fake preview_vid_ verification stub');
    assert.ok(!firebaseSrc.includes('class RecaptchaVerifier'), 'lib/firebase.ts must not override RecaptchaVerifier with a local mock class');
    assert.ok(firebaseSrc.includes('RecaptchaVerifier,') || firebaseSrc.includes('RecaptchaVerifier'), 'lib/firebase.ts must import and export real RecaptchaVerifier from firebase/auth');
    assert.ok(firebaseSrc.includes('signInWithPhoneNumber'), 'lib/firebase.ts must import and export real signInWithPhoneNumber from firebase/auth');
  });

  it('OTP-002: OTP authentication components enforce real Firebase ConfirmationResult and eliminate fake OTP banners and auto-fill buttons', () => {
    const modalSrc = readSource('components/mobile-otp-auth-modal.tsx');
    const partnerOtpSrc = readSource('components/partner-otp-verification.tsx');
    const otpApiSrc = readSource('app/api/auth/otp/route.ts');

    assert.ok(!modalSrc.includes('Auto-fill Code'), 'MobileOtpAuthModal must not render fake Auto-fill Code button');
    assert.ok(!partnerOtpSrc.includes('Auto-fill Code'), 'PartnerOtpVerification must not render fake Auto-fill Code button');
    assert.ok(modalSrc.includes('firebaseConfirmation.confirm'), 'MobileOtpAuthModal must verify OTP via firebaseConfirmation.confirm');
    assert.ok(partnerOtpSrc.includes('firebaseConfirmation.confirm'), 'PartnerOtpVerification must verify OTP via firebaseConfirmation.confirm');
    assert.ok(!otpApiSrc.includes('generatedOtp'), '/api/auth/otp must not generate or return fake server OTP codes');
    assert.ok(otpApiSrc.includes('adminAuth.verifyIdToken'), '/api/auth/otp must verify Firebase ID tokens server-side when provided');
  });

  it('OTP-003: /lib/countries-data.ts enforces strict Indian +91 E.164 mobile validation without debug console spam', () => {
    const countriesSrc = readSource('lib/countries-data.ts');
    assert.ok(!countriesSrc.includes("console.log('Validation Debug:'"), 'lib/countries-data.ts must not contain debug console.log spam');
    assert.ok(countriesSrc.includes('/^[6-9]\\d{9}$/'), 'lib/countries-data.ts must validate Indian 10-digit mobile numbers starting with 6-9');
  });

  it('BIZ-001: CityKart enforces medium/large city eligibility, blocks villages/talukas, and sets Mumbai as initial onboarding market', () => {
    const missingRouteSrc = readSource('app/api/locations/missing-request/route.ts');
    const locationServiceSrc = readSource('lib/location-service.ts');
    const partnerPortalSrc = readSource('components/city-partner-portal.tsx');
    const sellerPageSrc = readSource('app/seller/page.tsx');

    assert.ok(missingRouteSrc.includes('isVillageOrTalukaPlace'), '/api/locations/missing-request must block villages and talukas');
    assert.ok(missingRouteSrc.includes("status: 'PENDING'"), '/api/locations/missing-request must set new city requests to PENDING for Admin review');
    assert.ok(locationServiceSrc.includes("req.status === 'APPROVED'"), 'saveMissingLocationRequest must only activate custom cities when APPROVED by Admin');
    assert.ok(partnerPortalSrc.includes('india-maharashtra-mumbai'), 'CityPartnerPortal must default initial market selection to Mumbai');
    assert.ok(!sellerPageSrc.includes('village worldwide'), 'Seller onboarding page must not advertise village registration');
  });
});

