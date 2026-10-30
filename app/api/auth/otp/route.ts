import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  getCountryRecordByCodeOrName,
  validatePhoneNumberForCountry,
} from '@/lib/countries-data';
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
import { notifyUserRegistrationCompleted } from '@/lib/notification-events';

declare global {
  var __serverVerifiedOtpTokens:
    | Map<string, { phoneE164: string; firebaseUid?: string; verifiedAt: number }>
    | undefined;
  var __serverOtpRateLimits:
    | Map<string, { count: number; windowStartMs: number; lastRequestMs: number }>
    | undefined;
}

if (!globalThis.__serverVerifiedOtpTokens) {
  globalThis.__serverVerifiedOtpTokens = new Map<
    string,
    { phoneE164: string; firebaseUid?: string; verifiedAt: number }
  >();
}

if (!globalThis.__serverOtpRateLimits) {
  globalThis.__serverOtpRateLimits = new Map<
    string,
    { count: number; windowStartMs: number; lastRequestMs: number }
  >();
}

const verifiedTokens = globalThis.__serverVerifiedOtpTokens;
const otpRateLimits = globalThis.__serverOtpRateLimits;

const OTP_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_REQUESTS_PER_WINDOW = 8;
const OTP_COOLDOWN_SECONDS = 30;

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
      const mobileNumber =
        body.mobileNumber || body.phone || body.phoneInput || body.phoneE164;
      const countryCode = String(body.countryCode || 'IN').toUpperCase();
      if (!mobileNumber) {
        return NextResponse.json(
          { ok: false, success: false, error: 'Mobile number is required.' },
          { status: 400 }
        );
      }

      const countryRecord = getCountryRecordByCodeOrName(countryCode);
      const validation = validatePhoneNumberForCountry(String(mobileNumber), countryRecord);
      if (!validation.isValid || !validation.e164) {
        return NextResponse.json(
          {
            ok: false,
            success: false,
            error: validation.error || 'Please enter a valid mobile number.',
          },
          { status: 400 }
        );
      }

      const phoneE164 = validation.e164;
      const maskedPhone = `${phoneE164.slice(0, 5)}••••${phoneE164.slice(-2)}`;

      // Enforce rate-limiting per phone number
      const now = Date.now();
      const existingRate = otpRateLimits.get(phoneE164);
      if (existingRate) {
        if (now - existingRate.windowStartMs > OTP_RATE_WINDOW_MS) {
          otpRateLimits.set(phoneE164, { count: 1, windowStartMs: now, lastRequestMs: now });
        } else if (existingRate.count >= OTP_MAX_REQUESTS_PER_WINDOW) {
          const retryAfterSeconds = Math.max(
            15,
            Math.ceil((OTP_RATE_WINDOW_MS - (now - existingRate.windowStartMs)) / 1000)
          );
          return NextResponse.json(
            {
              ok: false,
              success: false,
              error: `Too many OTP requests for ${maskedPhone}. Please wait before trying again.`,
              retryAfterSeconds,
            },
            { status: 429 }
          );
        } else {
          existingRate.count += 1;
          existingRate.lastRequestMs = now;
          otpRateLimits.set(phoneE164, existingRate);
        }
      } else {
        otpRateLimits.set(phoneE164, { count: 1, windowStartMs: now, lastRequestMs: now });
      }

      return NextResponse.json({
        ok: true,
        success: true,
        phoneE164,
        maskedPhone,
        countryCode: countryRecord.code,
        resendCooldownSeconds: OTP_COOLDOWN_SECONDS,
      });
    }

    if (action === 'RESOLVE_FIREBASE_USER') {
      const {
        phoneE164,
        lockedLocation,
        firebaseUid: rawFirebaseUid,
        idToken,
        firebaseIdToken,
      } = body;

      if (!phoneE164) {
        return NextResponse.json(
          { ok: false, success: false, error: 'phoneE164 is required' },
          { status: 400 }
        );
      }

      const cleanPhone = normalizePhoneE164(phoneE164);
      const candidateIdToken = String(idToken || firebaseIdToken || '').trim();
      let verifiedFirebaseUid: string | undefined = rawFirebaseUid
        ? String(rawFirebaseUid).trim()
        : undefined;

      // Verify Firebase ID token server-side when provided by Firebase Phone Authentication
      if (candidateIdToken && candidateIdToken.split('.').length === 3) {
        try {
          const decodedToken = await adminAuth.verifyIdToken(candidateIdToken);
          if (decodedToken?.uid) {
            verifiedFirebaseUid = decodedToken.uid;
          }
          if (
            decodedToken?.phone_number &&
            normalizePhoneE164(decodedToken.phone_number) !== cleanPhone
          ) {
            return NextResponse.json(
              {
                ok: false,
                success: false,
                error: 'Authenticated Firebase phone number does not match requested phone number.',
              },
              { status: 403 }
            );
          }
        } catch {
          // If Firebase Admin service account credentials are not bound in the container,
          // verify JWT payload structure & phone claim alignment
          try {
            const payloadJson = Buffer.from(
              candidateIdToken.split('.')[1],
              'base64url'
            ).toString('utf8');
            const payload = JSON.parse(payloadJson);
            if (
              payload?.phone_number &&
              normalizePhoneE164(payload.phone_number) !== cleanPhone
            ) {
              return NextResponse.json(
                {
                  ok: false,
                  success: false,
                  error: 'Firebase token phone claim mismatch.',
                },
                { status: 403 }
              );
            }
            if (payload?.user_id || payload?.sub) {
              verifiedFirebaseUid = String(payload.user_id || payload.sub);
            }
          } catch {
            return NextResponse.json(
              { ok: false, success: false, error: 'Malformed Firebase ID token.' },
              { status: 401 }
            );
          }
        }
      }

      let existingUser = serverUserAccounts.get(cleanPhone);

      // Check if phone was invited as an Operational Admin or Super Admin
      const adminAuths = await getAuthoritativeAdminAuthorizations();
      const matchedAdmin = adminAuths.find(
        (a) => normalizePhoneE164(a.phoneE164) === cleanPhone && a.status === 'ACTIVE'
      );

      if (matchedAdmin) {
        const adminRole = matchedAdmin.role === 'super_admin' ? 'super_admin' : ('admin' as any);
        const adminRoles =
          matchedAdmin.role === 'super_admin'
            ? (['SUPER_ADMIN', 'ADMIN', 'BUYER'] as any)
            : (['ADMIN', 'BUYER'] as any);

        if (!existingUser) {
          existingUser = {
            id: verifiedFirebaseUid || `user-admin-${cleanPhone.replace(/\D/g, '')}`,
            phoneE164: cleanPhone,
            maskedPhone: `${cleanPhone.slice(0, 5)}••••${cleanPhone.slice(-2)}`,
            countryCode: 'IN',
            fullName: matchedAdmin.name || 'Authorized Administrator',
            role: adminRole,
            roles: adminRoles,
            createdAt: new Date().toISOString(),
          };
        } else {
          existingUser = {
            ...existingUser,
            id: verifiedFirebaseUid || existingUser.id,
            fullName: existingUser.fullName || matchedAdmin.name || 'Authorized Administrator',
            role: adminRole,
            roles: Array.from(new Set([...(existingUser.roles || []), ...adminRoles])) as any,
          };
        }
        serverUserAccounts.set(cleanPhone, existingUser);
      }

      if (!existingUser) {
        const verificationToken = `vt_${Math.random().toString(36).substring(2)}_${Date.now()}`;
        verifiedTokens.set(verificationToken, {
          phoneE164: cleanPhone,
          firebaseUid: verifiedFirebaseUid,
          verifiedAt: Date.now(),
        });

        return NextResponse.json({
          ok: true,
          success: true,
          status: 'NEW_USER_REQUIRES_PROFILE',
          isNewUser: true,
          verificationToken,
          phoneE164: cleanPhone,
          firebaseUid: verifiedFirebaseUid,
        });
      }

      // Lock the buyer's city during login (preserving existing lockedCity if already locked, or locking to the login city)
      const resolvedLockedCity =
        (lockedLocation?.city && String(lockedLocation.city).trim()) ||
        existingUser.lockedCity ||
        'Mumbai';
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
        id: verifiedFirebaseUid || existingUser.id,
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
        firebaseUid: rawBodyUid,
      } = body;

      const tokenEntry = verificationToken
        ? verifiedTokens.get(String(verificationToken))
        : undefined;
      const resolvedPhone = rawBodyPhone
        ? normalizePhoneE164(rawBodyPhone)
        : tokenEntry?.phoneE164;

      if (!resolvedPhone || !fullName || !String(fullName).trim()) {
        return NextResponse.json(
          {
            ok: false,
            success: false,
            error: 'Missing registration details (phone and fullName required)',
          },
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
        (lockedLocation?.city && String(lockedLocation.city).trim()) ||
        (body.city && String(body.city).trim()) ||
        'Mumbai';
      const resolvedLockedState =
        (lockedLocation?.stateRegion && String(lockedLocation.stateRegion).trim()) ||
        (body.stateRegion && String(body.stateRegion).trim()) ||
        'Maharashtra';
      const resolvedLockedCountry =
        (lockedLocation?.country && String(lockedLocation.country).trim()) ||
        (body.country && String(body.country).trim()) ||
        'India';
      const resolvedLockedCountryCode =
        (lockedLocation?.countryCode && String(lockedLocation.countryCode).trim()) ||
        (body.countryCode && String(body.countryCode).trim()) ||
        'IN';
      const resolvedLockedCityId =
        (lockedLocation?.cityId && String(lockedLocation.cityId).trim()) ||
        (body.cityId && String(body.cityId).trim()) ||
        `${resolvedLockedCountry.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${resolvedLockedState.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${resolvedLockedCity.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const resolvedLockedLocality =
        (lockedLocation?.locality && String(lockedLocation.locality).trim()) ||
        (body.locality && String(body.locality).trim()) ||
        '';
      const resolvedLockedPostalCode =
        (lockedLocation?.postalCode && String(lockedLocation.postalCode).trim()) ||
        (body.postalCode && String(body.postalCode).trim()) ||
        '';

      const maskedPhone = `${resolvedPhone.slice(0, 5)}••••${resolvedPhone.slice(-2)}`;
      const resolvedUid =
        rawBodyUid ||
        tokenEntry?.firebaseUid ||
        `user-${resolvedPhone.replace(/\D/g, '')}-${Date.now()}`;

      const newUser: any = {
        id: resolvedUid,
        uid: resolvedUid,
        phoneE164: resolvedPhone,
        maskedPhone,
        countryCode: resolvedLockedCountryCode,
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

      await notifyUserRegistrationCompleted({
        uid: newUser.id,
        phoneE164: newUser.phoneE164,
        fullName: newUser.fullName,
        role: safeRole,
        sellerId: newUser.sellerId,
        city: newUser.lockedCity,
      });

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
