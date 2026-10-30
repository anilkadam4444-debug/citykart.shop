import { NextRequest, NextResponse } from 'next/server';
import {
  DESIGNATED_OWNER_PHONE,
  isDesignatedOwnerPhone,
  issueSessionTokenForUser,
  normalizePhoneE164,
  resolveSuperAdminSessionFromRequest,
  verifyAdminRequest,
} from '@/lib/super-admin-auth';

export async function GET(req: NextRequest) {
  try {
    const check = await verifyAdminRequest(req);
    return NextResponse.json({
      ok: true,
      authenticated: check.authenticated,
      authorized: check.authorized,
      isSuperAdmin: check.isSuperAdmin,
      requiresBootstrap: false,
      customClaimsConfigured: true,
      role: check.role,
      phoneE164: check.phoneE164,
      adminRecord: check.superAdminRecord,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        authorized: false,
        isSuperAdmin: false,
        requiresBootstrap: false,
        error: err instanceof Error ? err.message : 'Status check failed.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveSuperAdminSessionFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const candidatePhone = normalizePhoneE164(
      session.phoneE164 || body?.phoneE164 || ''
    );

    if (!session.authenticated || !isDesignatedOwnerPhone(candidatePhone)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Forbidden: Only the designated Platform Owner phone (+918329306616) can bootstrap Super Admin.',
        },
        { status: session.authenticated ? 403 : 401 }
      );
    }

    const sessionToken = issueSessionTokenForUser({
      id: 'uid-8329306616',
      phoneE164: candidatePhone || DESIGNATED_OWNER_PHONE,
      fullName: 'Platform Owner',
      role: 'super_admin',
      roles: ['SUPER_ADMIN', 'ADMIN'],
    });

    const response = NextResponse.json({
      ok: true,
      message: 'Super Admin successfully authorized and bootstrapped.',
      sessionToken,
      role: 'super_admin',
      adminRecord: {
        uid: 'uid-8329306616',
        phoneE164: candidatePhone || DESIGNATED_OWNER_PHONE,
        role: 'super_admin',
        customClaimsSynced: true,
      },
    });

    response.cookies.set('urbandirect_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Bootstrap failed.' },
      { status: 500 }
    );
  }
}
