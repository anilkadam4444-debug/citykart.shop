import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminAuthorization,
  getAdminAuditLogs,
  getAuthoritativeAdminAuthorizations,
  reactivateAdminAuthorization,
  revokeAdminAuthorization,
  updateAdminAuthorization,
  verifyAdminRequest,
} from '@/lib/super-admin-auth';
import { notifyAdminAndSuperAdminGovernance } from '@/lib/notification-events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        requiresBootstrap: authCheck.requiresBootstrap,
        isSuperAdmin: authCheck.isSuperAdmin,
        adminRole: authCheck.role,
        error: authCheck.reason,
      },
      { status: authCheck.status }
    );
  }

  const authorizations = authCheck.isSuperAdmin
    ? await getAuthoritativeAdminAuthorizations()
    : authCheck.authorizationRecord
    ? [authCheck.authorizationRecord]
    : [];

  const auditLogs = await getAdminAuditLogs(100);

  return NextResponse.json({
    ok: true,
    authorized: true,
    fetchedAt: new Date().toISOString(),
    isSuperAdmin: authCheck.isSuperAdmin,
    adminRole: authCheck.role,
    adminRecord: authCheck.superAdminRecord,
    adminAuthorizations: authorizations,
    authorizations,
    auditLogs,
  });
}

export async function POST(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized || !authCheck.firebaseUid) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        error: authCheck.reason,
      },
      { status: authCheck.status }
    );
  }

  if (!authCheck.isSuperAdmin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Forbidden: Only the Platform Owner Super Admin (+918329306616) is authorized to perform admin management governance.',
      },
      { status: 403 }
    );
  }

  const adminUid = authCheck.firebaseUid;
  const adminPhone = authCheck.phoneE164;

  try {
    const body = await req.json();
    const actionType = String(body.action || '').trim();

    if (actionType === 'INVITE_ADMIN') {
      const phoneE164 = String(body.phoneE164 || '').trim();
      const name = String(body.name || '').trim();
      const designation = String(body.designation || '').trim();
      const role = body.role === 'super_admin' ? 'super_admin' : 'admin';

      const result = await createAdminAuthorization({
        callerAdminUid: adminUid,
        callerPhone: adminPhone,
        phoneE164,
        name,
        designation,
        role,
      });

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      await notifyAdminAndSuperAdminGovernance({
        action: 'INVITE_ADMIN',
        targetId: result.record?.phoneE164 || phoneE164,
        targetName: name || phoneE164,
        targetPhoneE164: result.record?.phoneE164 || phoneE164,
        actorUid: adminUid,
        actorPhone: adminPhone || undefined,
        reason: `Designated ${role} (${designation || 'Admin'})`,
      }).catch((err) => console.warn('[admin/management] Notification warning:', err));

      const allAdmins = await getAuthoritativeAdminAuthorizations();
      return NextResponse.json({
        ok: true,
        message: `Administrator authorization created for ${result.record?.phoneE164}.`,
        record: result.record,
        authorizations: allAdmins,
        adminAuthorizations: allAdmins,
      });
    }

    if (actionType === 'REVOKE_ADMIN') {
      const phoneE164 = String(body.phoneE164 || '').trim();
      const revokeReason = String(body.reason || 'Revoked by Platform Owner').trim();

      const result = await revokeAdminAuthorization({
        callerAdminUid: adminUid,
        callerPhone: adminPhone,
        phoneE164,
        reason: revokeReason,
      });

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      await notifyAdminAndSuperAdminGovernance({
        action: 'REVOKE_ADMIN',
        targetId: phoneE164,
        targetName: result.record?.name || phoneE164,
        targetPhoneE164: phoneE164,
        actorUid: adminUid,
        actorPhone: adminPhone || undefined,
        reason: revokeReason,
      }).catch((err) => console.warn('[admin/management] Notification warning:', err));

      const allAdmins = await getAuthoritativeAdminAuthorizations();
      return NextResponse.json({
        ok: true,
        message: `Administrator authorization revoked for ${phoneE164}.`,
        record: result.record,
        authorizations: allAdmins,
        adminAuthorizations: allAdmins,
      });
    }

    if (actionType === 'REACTIVATE_ADMIN') {
      const phoneE164 = String(body.phoneE164 || '').trim();
      const reactivateReason = String(body.reason || 'Reactivated by Platform Owner').trim();

      const result = await reactivateAdminAuthorization({
        callerAdminUid: adminUid,
        callerPhone: adminPhone,
        phoneE164,
        reason: reactivateReason,
      });

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      await notifyAdminAndSuperAdminGovernance({
        action: 'REACTIVATE_ADMIN',
        targetId: phoneE164,
        targetName: result.record?.name || phoneE164,
        targetPhoneE164: phoneE164,
        actorUid: adminUid,
        actorPhone: adminPhone || undefined,
        reason: reactivateReason,
      }).catch((err) => console.warn('[admin/management] Notification warning:', err));

      const allAdmins = await getAuthoritativeAdminAuthorizations();
      return NextResponse.json({
        ok: true,
        message: `Administrator authorization reactivated for ${phoneE164}.`,
        record: result.record,
        authorizations: allAdmins,
        adminAuthorizations: allAdmins,
      });
    }

    if (actionType === 'UPDATE_ADMIN') {
      const phoneE164 = String(body.phoneE164 || '').trim();
      const name = body.name !== undefined ? String(body.name).trim() : undefined;
      const designation = body.designation !== undefined ? String(body.designation).trim() : undefined;

      const result = await updateAdminAuthorization({
        callerAdminUid: adminUid,
        callerPhone: adminPhone,
        phoneE164,
        name,
        designation,
      });

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      await notifyAdminAndSuperAdminGovernance({
        action: 'UPDATE_ADMIN',
        targetId: phoneE164,
        targetName: result.record?.name || phoneE164,
        targetPhoneE164: phoneE164,
        actorUid: adminUid,
        actorPhone: adminPhone || undefined,
        reason: `Updated administrator profile (${result.record?.designation || designation || 'Admin'})`,
      }).catch((err) => console.warn('[admin/management] Notification warning:', err));

      const allAdmins = await getAuthoritativeAdminAuthorizations();
      return NextResponse.json({
        ok: true,
        message: `Administrator details updated for ${phoneE164}.`,
        record: result.record,
        authorizations: allAdmins,
        adminAuthorizations: allAdmins,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unsupported action: ${actionType}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal error processing admin management action.',
      },
      { status: 500 }
    );
  }
}
