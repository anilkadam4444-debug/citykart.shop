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

describe('Super Admin Portal: Admin Onboarding, Authorization & Console Operations', () => {
  let superAdminToken = '';
  let opAdminToken = '';
  const opAdminPhone = `+919820${Math.floor(100000 + Math.random() * 900000)}`;
  const opAdminName = 'Ramesh Kulkarni';
  const opAdminDesignation = 'Senior Operations Lead';

  it('Step 1: Unauthenticated request to /api/admin/management is rejected with 401', async () => {
    const res = await getJson('/api/admin/management');
    assert.equal(res.status, 401);
    assert.equal(res.data.ok, false);
  });

  it('Step 2: Authenticate designated Super Admin (+918329306616) and bootstrap super_admin role', async () => {
    // 1. Resolve Super Admin via OTP endpoint
    const otpRes = await postJson('/api/auth/otp', {
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: '+918329306616',
    });
    assert.equal(otpRes.status, 200);
    assert.ok(otpRes.data.sessionToken);
    superAdminToken = otpRes.data.sessionToken;

    // 2. Complete Server Bootstrap
    const bootRes = await postJson(
      '/api/admin/bootstrap',
      {},
      { Authorization: `Bearer ${superAdminToken}` }
    );
    assert.equal(bootRes.status, 200);
    assert.equal(bootRes.data.ok, true);
    assert.equal(bootRes.data.role || bootRes.data.adminRecord?.role, 'super_admin');
    if (bootRes.data.sessionToken) {
      superAdminToken = bootRes.data.sessionToken;
    }
  });

  it('Step 3: Super Admin retrieves admin authorizations registry and audit logs', async () => {
    const res = await getJson('/api/admin/management', {
      Authorization: `Bearer ${superAdminToken}`,
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.isSuperAdmin, true);
    assert.ok(Array.isArray(res.data.adminAuthorizations));
    assert.ok(Array.isArray(res.data.auditLogs));
  });

  it('Step 4: Super Admin onboards and authorizes a new Operational Administrator', async () => {
    const res = await postJson(
      '/api/admin/management',
      {
        action: 'INVITE_ADMIN',
        phoneE164: opAdminPhone,
        name: opAdminName,
        designation: opAdminDesignation,
        role: 'admin',
      },
      { Authorization: `Bearer ${superAdminToken}` }
    );
    assert.equal(res.status, 200, `Invite failed: ${JSON.stringify(res.data)}`);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.record.phoneE164, opAdminPhone);
    assert.equal(res.data.record.role, 'admin');
    assert.equal(res.data.record.status, 'ACTIVE');
  });

  it('Step 5: Newly authorized admin signs in via Phone OTP and receives active admin session', async () => {
    const res = await postJson('/api/auth/otp', {
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: opAdminPhone,
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.sessionToken);
    assert.equal(res.data.user.role, 'admin');
    opAdminToken = res.data.sessionToken;
  });

  it('Step 6: Operational Admin can read admin dashboard metrics but cannot invite new admins (403)', async () => {
    // 1. Dashboard read works
    const dashRes = await getJson('/api/admin/dashboard', {
      Authorization: `Bearer ${opAdminToken}`,
    });
    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.data.ok, true);
    assert.equal(dashRes.data.isSuperAdmin, false);
    assert.equal(dashRes.data.adminRole, 'admin');

    // 2. Inviting new admin is forbidden for non-super_admin
    const inviteRes = await postJson(
      '/api/admin/management',
      {
        action: 'INVITE_ADMIN',
        phoneE164: '+919999988888',
        name: 'Unauthorized Attempt',
        role: 'admin',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(inviteRes.status, 403);
    assert.equal(inviteRes.data.ok, false);
    assert.ok(inviteRes.data.error.includes('Platform Owner Super Admin'));
  });

  it('Step 7: Operational Admin cannot permanently delete stores (403)', async () => {
    const delRes = await postJson(
      '/api/admin/action',
      {
        action: 'DELETE_STORE',
        storeId: 'store-1',
        storeNameConfirmation: 'Test Store',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(delRes.status, 403);
    assert.equal(delRes.data.ok, false);
  });

  it('Step 8: Operational Admin executes authorized store lifecycle operations (Suspend, Restore, Verify)', async () => {
    // 1. Suspend Store
    const suspRes = await postJson(
      '/api/admin/action',
      {
        action: 'SUSPEND_STORE',
        storeId: 'store-nanded-kirana-1',
        storeName: 'Nanded Central Supermarket',
        reason: 'Periodic quality review and documentation verification',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(suspRes.status, 200);
    assert.equal(suspRes.data.isSuspended, true);
    assert.equal(suspRes.data.isActive, false);

    // 2. Restore Store
    const restRes = await postJson(
      '/api/admin/action',
      {
        action: 'RESTORE_STORE',
        storeId: 'store-nanded-kirana-1',
        storeName: 'Nanded Central Supermarket',
        reason: 'Verification completed successfully',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(restRes.status, 200);
    assert.equal(restRes.data.isSuspended, false);
    assert.equal(restRes.data.isActive, true);

    // 3. Verify Store Location
    const verRes = await postJson(
      '/api/admin/action',
      {
        action: 'VERIFY_STORE_LOCATION',
        storeId: 'store-nanded-kirana-1',
        storeName: 'Nanded Central Supermarket',
        reason: 'Physical storefront and geolocation validated by city field agent',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(verRes.status, 200);
    assert.equal(verRes.data.ok, true);
  });

  it('Step 9: Operational Admin executes Product & Category management operations', async () => {
    // 1. Unpublish product from search & discovery
    const unpubRes = await postJson(
      '/api/admin/action',
      {
        action: 'UNPUBLISH_PRODUCT',
        productId: 'prod-1',
        productName: 'Sample Product 1',
        reason: 'Temporary stock audit',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(unpubRes.status, 200);
    assert.equal(unpubRes.data.adminUnpublished, true);

    // 2. Restore product to discovery
    const restProdRes = await postJson(
      '/api/admin/action',
      {
        action: 'RESTORE_PRODUCT',
        productId: 'prod-1',
        productName: 'Sample Product 1',
        reason: 'Stock replenished and validated',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(restProdRes.status, 200);
    assert.equal(restProdRes.data.adminUnpublished, false);

    // 3. Toggle Store Category
    const catRes = await postJson(
      '/api/admin/action',
      {
        action: 'TOGGLE_CATEGORY',
        categoryId: 'cat-01-grocery-daily-essentials',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(catRes.status, 200);
    assert.equal(catRes.data.ok, true);
  });

  it('Step 10: Operational Admin records order oversight notes and updates platform settings', async () => {
    // 1. Add order oversight note
    const noteRes = await postJson(
      '/api/admin/action',
      {
        action: 'ADD_ORDER_ADMIN_NOTE',
        orderId: 'ORD-1001',
        note: 'Customer contacted support regarding delivery address landmark confirmation.',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(noteRes.status, 200);
    assert.equal(noteRes.data.ok, true);
    assert.ok(noteRes.data.noteEntry?.id);

    // 2. Update platform configuration settings
    const settRes = await postJson(
      '/api/admin/action',
      {
        action: 'UPDATE_PLATFORM_SETTINGS',
        platformName: 'Citykart.shop Local Hyperlocal Marketplace',
        marketplaceAvailable: true,
        fcmPushNotificationsEnabled: true,
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(settRes.status, 200);
    assert.equal(settRes.data.ok, true);
  });

  it('Step 11: Super Admin updates operational administrator details (UPDATE_ADMIN)', async () => {
    const res = await postJson(
      '/api/admin/management',
      {
        action: 'UPDATE_ADMIN',
        phoneE164: opAdminPhone,
        name: 'Ramesh Kulkarni (Promoted)',
        designation: 'Principal Operations Lead',
      },
      { Authorization: `Bearer ${superAdminToken}` }
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.record.name, 'Ramesh Kulkarni (Promoted)');
    assert.equal(res.data.record.designation, 'Principal Operations Lead');
  });

  it('Step 12: Super Admin revokes administrator access; revoked admin is blocked immediately (403)', async () => {
    // 1. Super Admin revokes
    const revokeRes = await postJson(
      '/api/admin/management',
      {
        action: 'REVOKE_ADMIN',
        phoneE164: opAdminPhone,
        reason: 'Scheduled operational rotation',
      },
      { Authorization: `Bearer ${superAdminToken}` }
    );
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.data.record.status, 'REVOKED');

    // 2. Revoked admin attempts admin action with existing session -> 403 Forbidden
    const blockedRes = await postJson(
      '/api/admin/action',
      {
        action: 'SUSPEND_STORE',
        storeId: 'store-1',
        reason: 'Should be rejected',
      },
      { Authorization: `Bearer ${opAdminToken}` }
    );
    assert.equal(blockedRes.status, 403);
    assert.equal(blockedRes.data.ok, false);
  });

  it('Step 13: Super Admin reactivates administrator; access is restored', async () => {
    // 1. Super Admin reactivates
    const reactRes = await postJson(
      '/api/admin/management',
      {
        action: 'REACTIVATE_ADMIN',
        phoneE164: opAdminPhone,
        reason: 'Reinstated for city expansion',
      },
      { Authorization: `Bearer ${superAdminToken}` }
    );
    assert.equal(reactRes.status, 200);
    assert.equal(reactRes.data.record.status, 'ACTIVE');

    // 2. Reactivated admin logs in again
    const loginRes = await postJson('/api/auth/otp', {
      action: 'RESOLVE_FIREBASE_USER',
      phoneE164: opAdminPhone,
    });
    assert.equal(loginRes.status, 200);
    const newOpToken = loginRes.data.sessionToken;

    // 3. Reactivated admin can execute operations again
    const dashRes = await getJson('/api/admin/dashboard', {
      Authorization: `Bearer ${newOpToken}`,
    });
    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.data.ok, true);
  });

  it('Step 14: Platform Owner (+918329306616) cannot be revoked (Safety Guardrail)', async () => {
    const res = await postJson(
      '/api/admin/management',
      {
        action: 'REVOKE_ADMIN',
        phoneE164: '+918329306616',
        reason: 'Illegal revocation attempt',
      },
      { Authorization: `Bearer ${superAdminToken}` }
    );
    assert.equal(res.status, 400);
    assert.equal(res.data.ok, false);
    assert.ok(res.data.error.includes('Cannot revoke the primary Platform Owner'));
  });
});
