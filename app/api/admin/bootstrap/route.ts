import { NextRequest, NextResponse } from 'next/server';
import {
  bootstrapSuperAdminAccount,
  DESIGNATED_PLATFORM_URL,
  DESIGNATED_SUPER_ADMIN_NAME,
  DESIGNATED_SUPER_ADMIN_PHONE,
  DESIGNATED_SUPER_ADMIN_ROLE,
  isDesignatedOwnerPhone,
  normalizePhoneE164,
  verifyFirebaseIdTokenCryptographically,
  verifySignedSessionToken,
  verifySuperAdminRequest,
} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const verification = await verifySuperAdminRequest(req);

  return NextResponse.json(
    {
      ok: verification.authorized,
      authorized: verification.authorized,
      status: verification.status,
      reason: verification.reason,
      isVerifiedOwnerPhone: verification.isVerifiedOwnerPhone,
      requiresBootstrap: verification.requiresBootstrap,
      firebaseUid: verification.firebaseUid || null,
      phoneE164: verification.phoneE164 || null,
      authMethod: verification.authMethod || null,
      adminRecord: verification.adminRecord || null,
      admin: verification.adminRecord || null,
      customClaimsConfigured: Boolean(
        verification.adminRecord?.customClaimsSynced
      ),
      designatedOwner: {
        displayName: DESIGNATED_SUPER_ADMIN_NAME,
        phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
        role: DESIGNATED_SUPER_ADMIN_ROLE,
        platform: DESIGNATED_PLATFORM_URL,
      },
      requiresEnvSecret: Boolean(
        process.env.SUPER_ADMIN_BOOTSTRAP_SECRET &&
          process.env.SUPER_ADMIN_BOOTSTRAP_SECRET.trim().length > 0
      ),
    },
    { status: verification.authorized ? 200 : verification.status }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bootstrapSecret =
      typeof body.bootstrapSecret === 'string'
        ? body.bootstrapSecret.trim()
        : undefined;

    // 1. Check cryptographically verified Bearer ID token or signed session cookie via verifySuperAdminRequest
    const verification = await verifySuperAdminRequest(req);

    let targetUid = verification.firebaseUid || '';
    let targetPhone = verification.phoneE164 || '';

    // 2. Also check if a Firebase ID token was passed in body.idToken and verify it cryptographically
    if ((!targetUid || !targetPhone) && typeof body.idToken === 'string') {
      const verifiedToken = await verifyFirebaseIdTokenCryptographically(
        body.idToken.trim()
      );
      if (verifiedToken) {
        targetUid = verifiedToken.uid;
        targetPhone = verifiedToken.phoneE164;
      }
    }

    // 3. Also inspect signed HttpOnly urbandirect_session HMAC cookie (never trust raw client body fields)
    if (!targetUid || !targetPhone) {
      const cookieVal = req.cookies.get('urbandirect_session')?.value;
      const parsedCookie = verifySignedSessionToken(cookieVal);
      if (parsedCookie) {
        targetUid = parsedCookie.firebaseUid || parsedCookie.userId;
        targetPhone = normalizePhoneE164(parsedCookie.phoneE164);
      }
    }

    if (!targetUid || !targetPhone) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Authentication required: You must first sign in and verify +918329306616 via Firebase Phone Authentication (OTP) so the server can cryptographically verify your session before bootstrapping the super_admin role.',
        },
        { status: 401 }
      );
    }

    if (!isDesignatedOwnerPhone(targetPhone)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Access Denied: Only the verified Platform Owner mobile number (+918329306616) can be bootstrapped as super_admin.',
        },
        { status: 403 }
      );
    }

    const result = await bootstrapSuperAdminAccount({
      firebaseUid: targetUid,
      phoneE164: targetPhone,
      bootstrapSecret,
    });

    if (!result.ok || !result.adminRecord || !result.sessionToken) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error ||
            'Could not complete super_admin role bootstrap.',
        },
        { status: 403 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      authorized: true,
      adminRecord: result.adminRecord,
      admin: result.adminRecord,
      message:
        'Super Admin role (super_admin) verified and activated on the server for Platform Owner (+918329306616).',
    });

    res.cookies.set('urbandirect_session', result.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal error during super_admin bootstrap.',
      },
      { status: 500 }
    );
  }
}
