import { NextRequest, NextResponse } from 'next/server';
import {
  DESIGNATED_OWNER_PHONE,
  LEGACY_OWNER_PHONE,
  isDesignatedOwnerPhone,
  issueSessionTokenForUser,
  normalizePhoneE164,
  serverUserAccounts,
  verifySessionToken,
  getAuthoritativeAdminAuthorizations,
} from '@/lib/super-admin-auth';

declare global {
  var __serverVerifiedOtpTokens:
    | Map<string, { phoneE164: string; verifiedAt: number }>
    | undefined;
}

if (!globalThis.__serverVerifiedOtpTokens) {
  globalThis.__serverVerifiedOtpTokens = new Map<
    string,
    { phoneE164: string; verifiedAt: number }
  >();
}

const verifiedTokens = globalThis.__serverVerifiedOtpTokens;

// Ensure default Super Admin accounts are seeded in shared serverUserAccounts
for (const ownerPhone of [DESIGNATED_OWNER_PHONE, LEGACY_OWNER_PHONE]) {
  if (!serverUserAccounts.has(ownerPhone)) {
    serverUserAccounts.set(ownerPhone, {
      id: `user-super-admin-${ownerPhone.replace(/\D/g, '')}`,
      phoneE164: ownerPhone,
      maskedPhone: `${ownerPhone.slice(0, 5)}••••${ownerPhone.slice(-2)}`,
      countryCode: 'IN',
      fullName: 'Platform Owner',
      role: 'super_admin',
      roles: ['SUPER_ADMIN', 'ADMIN', 'SELLER', 'BUYER'] as any,
      createdAt: '2025-01-01',
    });
  }
}

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get('x-urbandirect-session') || '';
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const cookieToken = req.cookies.get('urbandirect_session')?.value || '';
  const token = headerToken || cookieToken || bearerToken;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session || !session.ok || !session.user) {
    return NextResponse.json({ ok: false, error: 'Session expired or invalid' }, { status: 401 });
  }

  const sessionPhone = normalizePhoneE164(session.user.phoneE164);
  const sessionRole = String(session.user.role || 'buyer').toLowerCase();
  const existing = serverUserAccounts.get(sessionPhone);
  const user = existing
    ? {
        ...existing,
        lockedCity: session.user.lockedCity || existing.lockedCity,
        lockedCityId: session.user.lockedCityId || existing.lockedCityId,
        lockedStateRegion: session.user.lockedStateRegion || existing.lockedStateRegion,
        lockedCountry: session.user.lockedCountry || existing.lockedCountry,
        lockedCountryCode: session.user.lockedCountryCode || existing.lockedCountryCode,
        lockedLocality: session.user.lockedLocality || existing.lockedLocality,
        lockedPostalCode: session.user.lockedPostalCode || existing.lockedPostalCode,
        cityLockedAt: session.user.cityLockedAt || existing.cityLockedAt,
      }
    : {
        id: session.user.uid || `user-${sessionPhone.replace(/\D/g, '')}`,
        phoneE164: sessionPhone,
        maskedPhone: `${sessionPhone.slice(0, 5)}••••${sessionPhone.slice(-2)}`,
        countryCode: 'IN',
        fullName:
          session.user.fullName ||
          (isDesignatedOwnerPhone(sessionPhone) ? 'Platform Owner' : 'Verified User'),
        role: sessionRole as any,
        roles: session.user.roles || [sessionRole.toUpperCase()],
        sellerId: session.user.sellerId,
        storeIds: session.user.storeIds || [],
        lockedCity: session.user.lockedCity,
        lockedCityId: session.user.lockedCityId,
        lockedStateRegion: session.user.lockedStateRegion,
        lockedCountry: session.user.lockedCountry,
        lockedCountryCode: session.user.lockedCountryCode,
        lockedLocality: session.user.lockedLocality,
        lockedPostalCode: session.user.lockedPostalCode,
        cityLockedAt: session.user.cityLockedAt,
        createdAt: new Date().toISOString(),
      };

  return NextResponse.json({
    ok: true,
    success: true,
    user,
    sessionToken: token,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body || {};

    if (action === 'VALIDATE_PHONE') {
      const { mobileNumber, countryCode = 'IN' } = body;
      if (!mobileNumber) {
        return NextResponse.json(
          { ok: false, success: false, error: 'Mobile number required' },
          { status: 400 }
        );
      }
      const digits = String(mobileNumber).replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        return NextResponse.json(
          { ok: false, success: false, error: 'Please enter a valid mobile number.' },
          { status: 400 }
        );
      }
      const phoneE164 =
        countryCode === 'IN'
          ? digits.startsWith('91') && digits.length === 12
            ? `+${digits}`
            : `+91${digits.slice(-10)}`
          : `+${digits}`;
      const maskedPhone = `${phoneE164.slice(0, 5)}••••${phoneE164.slice(-2)}`;

      return NextResponse.json({
        ok: true,
        success: true,
        phoneE164,
        maskedPhone,
        countryCode,
        resendCooldownSeconds: 30,
      });
    }

    if (action === 'RESOLVE_FIREBASE_USER') {
      const { phoneE164, lockedLocation } = body;
      if (!phoneE164) {
        return NextResponse.json(
          { ok: false, success: false, error: 'phoneE164 is required' },
          { status: 400 }
        );
      }

      const cleanPhone = normalizePhoneE164(phoneE164);
      let existingUser = serverUserAccounts.get(cleanPhone);

      // Check if phone was invited as an Operational Admin or Super Admin
      const adminAuths = await getAuthoritativeAdminAuthorizations();
      const matchedAdmin = adminAuths.find(
        (a) => normalizePhoneE164(a.phoneE164) === cleanPhone && a.status === 'ACTIVE'
      );

      if (!existingUser && matchedAdmin) {
        existingUser = {
          id: `user-admin-${cleanPhone.replace(/\D/g, '')}`,
          phoneE164: cleanPhone,
          maskedPhone: `${cleanPhone.slice(0, 5)}••••${cleanPhone.slice(-2)}`,
          countryCode: 'IN',
          fullName: matchedAdmin.name || 'Authorized Administrator',
          role: matchedAdmin.role === 'super_admin' ? 'super_admin' : ('admin' as any),
          roles:
            matchedAdmin.role === 'super_admin'
              ? (['SUPER_ADMIN', 'ADMIN', 'BUYER'] as any)
              : (['ADMIN', 'BUYER'] as any),
          createdAt: new Date().toISOString(),
        };
        serverUserAccounts.set(cleanPhone, existingUser);
      }

      if (!existingUser) {
        const verificationToken = `vt_${Math.random().toString(36).substring(2)}_${Date.now()}`;
        verifiedTokens.set(verificationToken, {
          phoneE164: cleanPhone,
          verifiedAt: Date.now(),
        });

        return NextResponse.json({
          ok: true,
          success: true,
          status: 'NEW_USER_REQUIRES_PROFILE',
          isNewUser: true,
          verificationToken,
          phoneE164: cleanPhone,
        });
      }

      // Lock the buyer's city during login (preserving existing lockedCity if already locked, or locking to the login city)
      const resolvedLockedCity =
        (lockedLocation?.city && String(lockedLocation.city).trim()) ||
        existingUser.lockedCity ||
        'Nanded';
      const resolvedLockedState =
        (lockedLocation?.stateRegion && String(lockedLocation.stateRegion).trim()) ||
        existingUser.lockedStateRegion ||
        'Maharashtra';
      const resolvedLockedCountry =
        (lockedLocation?.country && String(lockedLocation.country).trim()) ||
        existingUser.lockedCountry ||
        'India';
      const resolvedLockedCountryCode =
        (lockedLocation?.countryCode && String(lockedLocation.countryCode).trim()) ||
        existingUser.lockedCountryCode ||
        'IN';
      const resolvedLockedCityId =
        (lockedLocation?.cityId && String(lockedLocation.cityId).trim()) ||
        existingUser.lockedCityId ||
        `${resolvedLockedCountry.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${resolvedLockedState.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${resolvedLockedCity.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const resolvedLockedLocality =
        lockedLocation?.locality !== undefined
          ? String(lockedLocation.locality).trim()
          : existingUser.lockedLocality || '';
      const resolvedLockedPostalCode =
        lockedLocation?.postalCode !== undefined
          ? String(lockedLocation.postalCode).trim()
          : existingUser.lockedPostalCode || '';

      existingUser = {
        ...existingUser,
        lockedCity: resolvedLockedCity,
        lockedCityId: resolvedLockedCityId,
        lockedStateRegion: resolvedLockedState,
        lockedCountry: resolvedLockedCountry,
        lockedCountryCode: resolvedLockedCountryCode,
        lockedLocality: resolvedLockedLocality,
        lockedPostalCode: resolvedLockedPostalCode,
        cityLockedAt: existingUser.cityLockedAt || new Date().toISOString(),
      };
      serverUserAccounts.set(cleanPhone, existingUser);

      const sessionToken = issueSessionTokenForUser(existingUser);
      const isOwner = isDesignatedOwnerPhone(cleanPhone);

      const response = NextResponse.json({
        ok: true,
        success: true,
        status: 'AUTHENTICATED_EXISTING',
        isNewUser: false,
        sessionToken,
        requiresBootstrap: isOwner && (existingUser as any).role !== 'super_admin',
        user: existingUser,
      });

      response.cookies.set('urbandirect_session', sessionToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600,
      });

      return response;
    }

    if (action === 'COMPLETE_REGISTRATION') {
      const {
        phoneE164: rawBodyPhone,
        verificationToken,
        fullName,
        journey,
        registrationIntent,
        role,
        lockedLocation,
      } = body;

      const tokenEntry = verificationToken
        ? verifiedTokens.get(String(verificationToken))
        : undefined;
      const resolvedPhone = rawBodyPhone
        ? normalizePhoneE164(rawBodyPhone)
        : tokenEntry?.phoneE164;

      if (!resolvedPhone || !fullName || !String(fullName).trim()) {
        return NextResponse.json(
          { ok: false, success: false, error: 'Missing registration details (phone and fullName required)' },
          { status: 400 }
        );
      }

      const rawRole = String(role || journey || registrationIntent || 'buyer').toLowerCase();
      // Prevent arbitrary privilege escalation via COMPLETE_REGISTRATION
      const safeRole =
        rawRole === 'seller'
          ? 'seller'
          : rawRole === 'partner'
            ? 'partner'
            : isDesignatedOwnerPhone(resolvedPhone)
              ? 'super_admin'
              : 'buyer';

      const upperRoles =
        safeRole === 'seller'
          ? ['BUYER', 'SELLER']
          : safeRole === 'partner'
            ? ['BUYER', 'PARTNER']
            : safeRole === 'super_admin'
              ? ['SUPER_ADMIN', 'ADMIN', 'BUYER']
              : ['BUYER'];

      const resolvedLockedCity =
        (lockedLocation?.city && String(lockedLocation.city).trim()) || 'Nanded';
      const resolvedLockedState =
        (lockedLocation?.stateRegion && String(lockedLocation.stateRegion).trim()) || 'Maharashtra';
      const resolvedLockedCountry =
        (lockedLocation?.country && String(lockedLocation.country).trim()) || 'India';
      const resolvedLockedCountryCode =
        (lockedLocation?.countryCode && String(lockedLocation.countryCode).trim()) || 'IN';
      const resolvedLockedCityId =
        (lockedLocation?.cityId && String(lockedLocation.cityId).trim()) ||
        `${resolvedLockedCountry.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${resolvedLockedState.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${resolvedLockedCity.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const resolvedLockedLocality =
        (lockedLocation?.locality && String(lockedLocation.locality).trim()) || '';
      const resolvedLockedPostalCode =
        (lockedLocation?.postalCode && String(lockedLocation.postalCode).trim()) || '';

      const maskedPhone = `${resolvedPhone.slice(0, 5)}••••${resolvedPhone.slice(-2)}`;
      const newUser: any = {
        id: `user-${resolvedPhone.replace(/\D/g, '')}-${Date.now()}`,
        phoneE164: resolvedPhone,
        maskedPhone,
        countryCode: 'IN',
        fullName: String(fullName).trim(),
        role: safeRole,
        roles: upperRoles,
        primaryRole: safeRole.toUpperCase(),
        sellerId: safeRole === 'seller' ? `seller-${Date.now()}` : undefined,
        storeIds: [],
        lockedCity: resolvedLockedCity,
        lockedCityId: resolvedLockedCityId,
        lockedStateRegion: resolvedLockedState,
        lockedCountry: resolvedLockedCountry,
        lockedCountryCode: resolvedLockedCountryCode,
        lockedLocality: resolvedLockedLocality,
        lockedPostalCode: resolvedLockedPostalCode,
        cityLockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      serverUserAccounts.set(resolvedPhone, newUser);
      if (verificationToken) {
        verifiedTokens.delete(String(verificationToken));
      }

      const sessionToken = issueSessionTokenForUser(newUser);

      const response = NextResponse.json({
        ok: true,
        success: true,
        status: 'REGISTERED_NEW_USER',
        user: newUser,
        sessionToken,
      });

      response.cookies.set('urbandirect_session', sessionToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600,
      });

      return response;
    }

    return NextResponse.json(
      { ok: false, success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'OTP handling failed' },
      { status: 500 }
    );
  }
}
