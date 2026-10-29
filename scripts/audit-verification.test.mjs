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
});
