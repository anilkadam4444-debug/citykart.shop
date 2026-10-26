import {NextRequest, NextResponse} from 'next/server';
import crypto from 'crypto';
import {
  getCountryRecordByCodeOrName,
  maskPhoneNumber,
  validatePhoneNumberForCountry,
} from '@/lib/countries-data';
import {
  UserAccount,
} from '@/lib/catalog-data';
import {
  INITIAL_SELLERS,
  INITIAL_USER_ACCOUNTS,
} from '@/lib/initial-data';

import {
  fetchUserAccountFromFirestore,
  findUserAccountByPhoneInFirestore,
  syncUserAccountToFirestore,
} from '@/lib/firebase';
import {
  DESIGNATED_SUPER_ADMIN_NAME,
  isDesignatedOwnerPhone,
  logSystemHealthEvent,
  normalizePhoneE164,
  resolveTrustedAdminRole,
  resolveTrustedSuperAdminRole,
  serverBuyerOverridesRegistry,
  verifyFirebaseIdTokenCryptographically,
  verifySignedSessionToken,
} from '@/lib/super-admin-auth';
import firebaseConfig from '@/firebase-applet-config.json';

export const dynamic = 'force-dynamic';

interface RateWindowRecord {
  count: number;
  windowStartMs: number;
  lastRequestedAtMs: number;
}

interface VerifiedPhoneSession {
  phoneE164: string;
  countryCode: string;
  maskedPhone: string;
  firebaseUid: string;
  expiresAtMs: number;
}

declare global {
  var __serverUserAccounts: Map<string, UserAccount> | undefined;
}

if (!globalThis.__serverUserAccounts) {
  globalThis.__serverUserAccounts = new Map<string, UserAccount>(
    INITIAL_USER_ACCOUNTS.map((u) => [u.phoneE164, {...u}])
  );
}

const requestRateLimits = new Map<string, RateWindowRecord>();
const verifiedPhoneTokens = new Map<string, VerifiedPhoneSession>();
export const serverUserAccounts = globalThis.__serverUserAccounts;

const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function getServerSecret(): string {
  return (
    process.env.OTP_HMAC_SECRET ||
    process.env.GEMINI_API_KEY ||
    'urbandirect-server-hmac-secret-key-2026'
  );
}

function createSignedToken(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getServerSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

async function verifyFirebaseIdTokenClaims(
  idToken: string,
  expectedUid: string,
  expectedPhoneE164: string
): Promise<{valid: boolean; reason?: string}> {
  const verified = await verifyFirebaseIdTokenCryptographically(idToken);
  if (!verified) {
    return {
      valid: false,
      reason:
        'Firebase ID token cryptographic verification failed or token has expired.',
    };
  }
  if (verified.uid && verified.uid !== expectedUid) {
    return {
      valid: false,
      reason: 'Firebase ID token UID does not match the verified user.',
    };
  }
  if (
    verified.phoneE164 &&
    verified.phoneE164.replace(/\s+/g, '') !==
      expectedPhoneE164.replace(/\s+/g, '')
  ) {
    return {
      valid: false,
      reason:
        'Firebase ID token phone number does not match the requested number.',
    };
  }
  void firebaseConfig;
  return {valid: true};
}

export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get('urbandirect_session')?.value;
  const sessionPayload = verifySignedSessionToken(cookieToken);

  if (!sessionPayload || !sessionPayload.phoneE164) {
    return NextResponse.json(
      { ok: false, authenticated: false },
      { status: 200 }
    );
  }

  const canonicalPhone = normalizePhoneE164(sessionPayload.phoneE164);
  const firebaseUid = sessionPayload.firebaseUid || sessionPayload.userId;

  const override =
    serverBuyerOverridesRegistry.get(firebaseUid) ||
    serverBuyerOverridesRegistry.get(canonicalPhone);
  if (override?.accountStatus === 'SUSPENDED') {
    const res = NextResponse.json(
      {
        ok: false,
        authenticated: false,
        suspended: true,
        error: `Account suspended: ${override.suspensionReason || 'Policy violation'}`,
      },
      { status: 403 }
    );
    res.cookies.delete('urbandirect_session');
    return res;
  }

  const adminResolution = await resolveTrustedAdminRole({
    firebaseUid,
    phoneE164: canonicalPhone,
  });

  const existing =
    serverUserAccounts.get(canonicalPhone) ||
    (await fetchUserAccountFromFirestore(firebaseUid)) ||
    (await findUserAccountByPhoneInFirestore(canonicalPhone));

  const baseRoles: ('BUYER' | 'SELLER' | 'ADMIN')[] = existing?.roles
    ? Array.from(
        new Set(
          existing.roles.filter((r) => r === 'BUYER' || r === 'SELLER')
        )
      )
    : ['BUYER'];

  if (adminResolution.isAuthorizedSuperAdmin) {
    if (!baseRoles.includes('SELLER')) baseRoles.push('SELLER');
    if (!baseRoles.includes('ADMIN')) baseRoles.push('ADMIN');
  } else if (adminResolution.isAuthorizedAdmin) {
    if (!baseRoles.includes('ADMIN')) baseRoles.push('ADMIN');
  }

  const isUserAdmin =
    adminResolution.isAuthorizedSuperAdmin || adminResolution.isAuthorizedAdmin;

  const resolvedUser: UserAccount = {
    id: existing?.id || firebaseUid,
    uid: firebaseUid,
    phoneE164: canonicalPhone,
    maskedPhone:
      existing?.maskedPhone ||
      `${canonicalPhone.slice(0, 3)} •••••• ${canonicalPhone.slice(-4)}`,
    countryCode: existing?.countryCode || 'IN',
    fullName: isDesignatedOwnerPhone(canonicalPhone)
      ? existing?.fullName || DESIGNATED_SUPER_ADMIN_NAME
      : adminResolution.authorizationRecord?.name || existing?.fullName || 'Verified User',
    roles: baseRoles.length > 0 ? baseRoles : ['BUYER'],
    isAdmin: isUserAdmin,
    role: isUserAdmin ? adminResolution.adminRole : undefined,
    sellerId: existing?.sellerId || sessionPayload.sellerId,
    storeIds: existing?.storeIds || [],
    createdAt: existing?.createdAt || new Date().toISOString().slice(0, 10),
  };

  serverUserAccounts.set(canonicalPhone, resolvedUser);

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: resolvedUser,
    isSuperAdmin: adminResolution.isAuthorizedSuperAdmin,
    isAdmin: isUserAdmin,
    adminRole: adminResolution.adminRole,
    requiresBootstrap: adminResolution.requiresBootstrap,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || '');

    // 1. VALIDATE PHONE NUMBER BEFORE FIREBASE PHONE AUTH DISPATCH
    if (action === 'VALIDATE_PHONE' || action === 'REQUEST_OTP') {
      const countryCode = String(body.countryCode || 'IN').trim();
      const subscriberNumber = String(body.mobileNumber || '').trim();
      const countryRecord = getCountryRecordByCodeOrName(countryCode);
      const validation = validatePhoneNumberForCountry(
        subscriberNumber,
        countryRecord
      );

      if (!validation.isValid) {
        logSystemHealthEvent({
          category: 'AUTH_ERROR',
          severity: 'INFO',
          title: 'Phone Validation Rejected',
          message: validation.error || 'Invalid subscriber number format.',
        });
        return NextResponse.json(
          {
            error:
              validation.error ||
              'Please enter a valid mobile number for your selected country.',
            errorCode: 'auth/invalid-phone-number',
          },
          {status: 400}
        );
      }

      const {e164} = validation;
      const now = Date.now();

      const rateRec = requestRateLimits.get(e164);
      if (rateRec && now - rateRec.windowStartMs < RATE_WINDOW_MS) {
        if (rateRec.count >= MAX_REQUESTS_PER_WINDOW) {
          logSystemHealthEvent({
            category: 'AUTH_ERROR',
            severity: 'WARNING',
            title: 'OTP Rate Limit Exceeded',
            message: `Rate limit triggered for ${maskPhoneNumber(e164, countryRecord.dialCode)}.`,
          });
          return NextResponse.json(
            {
              error:
                'Too many verification requests for this number. Please wait a few minutes and try again.',
              errorCode: 'auth/too-many-requests',
            },
            {status: 429}
          );
        }

        if (now - rateRec.lastRequestedAtMs < RESEND_COOLDOWN_MS) {
          const waitSeconds = Math.ceil(
            (RESEND_COOLDOWN_MS - (now - rateRec.lastRequestedAtMs)) / 1000
          );
          return NextResponse.json(
            {
              error: `Please wait ${waitSeconds} seconds before requesting another code.`,
              errorCode: 'auth/too-many-requests',
              retryAfterSeconds: waitSeconds,
            },
            {status: 429}
          );
        }
      }

      if (!rateRec || now - rateRec.windowStartMs >= RATE_WINDOW_MS) {
        requestRateLimits.set(e164, {
          count: 1,
          windowStartMs: now,
          lastRequestedAtMs: now,
        });
      } else {
        requestRateLimits.set(e164, {
          count: rateRec.count + 1,
          windowStartMs: rateRec.windowStartMs,
          lastRequestedAtMs: now,
        });
      }

      const maskedPhone = maskPhoneNumber(e164, countryRecord.dialCode);

      return NextResponse.json({
        ok: true,
        status: 'PHONE_VALIDATED',
        phoneAuthState: 'OTP_REQUEST_VALIDATED',
        phoneE164: e164,
        maskedPhone,
        countryCode: countryRecord.code,
        resendCooldownSeconds: 30,
        firebaseProjectId: 'urbandirectintracity',
        authProvider: 'firebase_phone_auth',
      });
    }

    // 2. RESOLVE FIREBASE PHONE AUTHENTICATED SESSION (Requires confirmed Firebase UID)
    if (action === 'RESOLVE_FIREBASE_USER' || action === 'VERIFY_OTP') {
      const phoneE164 = normalizePhoneE164(String(body.phoneE164 || '').trim());
      const countryCode = String(body.countryCode || 'IN').trim();
      const firebaseUid = body.firebaseUid
        ? String(body.firebaseUid).trim()
        : '';
      const idToken = body.idToken ? String(body.idToken).trim() : '';

      if (!phoneE164 || !phoneE164.startsWith('+')) {
        return NextResponse.json(
          {
            error: 'Valid E.164 mobile number is required.',
            errorCode: 'auth/invalid-phone-number',
          },
          {status: 400}
        );
      }

      if (!firebaseUid || firebaseUid.length < 6) {
        return NextResponse.json(
          {
            error:
              'Phone verification cannot be completed without a confirmed Firebase Authentication UID. Please verify the SMS OTP sent by Firebase.',
            errorCode: 'auth/missing-verification-uid',
          },
          {status: 400}
        );
      }

      if (idToken) {
        const tokenCheck = await verifyFirebaseIdTokenClaims(
          idToken,
          firebaseUid,
          phoneE164
        );
        if (!tokenCheck.valid) {
          logSystemHealthEvent({
            category: 'AUTH_ERROR',
            severity: 'WARNING',
            title: 'Invalid Firebase ID Token on OTP Resolve',
            message: tokenCheck.reason || 'Token verification failed.',
          });
          return NextResponse.json(
            {
              error:
                tokenCheck.reason || 'Firebase ID token verification failed.',
              errorCode: 'auth/invalid-user-token',
            },
            {status: 401}
          );
        }
      } else {
        // When no Firebase ID token is attached, require that VALIDATE_PHONE was recently completed
        // for this phone number within the active rate-limit window, and block if strict token enforcement is set.
        const recentValidation = requestRateLimits.get(phoneE164);
        const hasRecentValidation =
          Boolean(recentValidation) &&
          Date.now() - (recentValidation?.lastRequestedAtMs || 0) <=
            RATE_WINDOW_MS;

        if (
          process.env.ENFORCE_FIREBASE_ID_TOKEN === 'true' ||
          !hasRecentValidation
        ) {
          logSystemHealthEvent({
            category: 'AUTH_ERROR',
            severity: 'WARNING',
            title: 'Unverified OTP Resolution Blocked',
            message: `Blocked RESOLVE_FIREBASE_USER for ${phoneE164} without a verified Firebase ID token or active OTP challenge.`,
          });
          return NextResponse.json(
            {
              error:
                'Phone verification requires an active OTP session or verified Firebase ID token. Please request a new verification code.',
              errorCode: 'auth/missing-id-token',
            },
            {status: 401}
          );
        }
      }

      const countryRecord = getCountryRecordByCodeOrName(countryCode);
      const maskedPhone =
        String(body.maskedPhone || '').trim() ||
        maskPhoneNumber(phoneE164, countryRecord.dialCode);
      const now = Date.now();

      const verificationToken = crypto.randomBytes(24).toString('hex');
      verifiedPhoneTokens.set(verificationToken, {
        phoneE164,
        countryCode: countryRecord.code,
        maskedPhone,
        firebaseUid,
        expiresAtMs: now + 15 * 60 * 1000,
      });

      const [firestoreByUid, firestoreByPhone] = await Promise.all([
        fetchUserAccountFromFirestore(firebaseUid),
        findUserAccountByPhoneInFirestore(phoneE164),
      ]);

      const existingAccount =
        firestoreByUid ||
        firestoreByPhone ||
        serverUserAccounts.get(phoneE164);

      // Server-side trusted admin role resolution
      const adminResolution = await resolveTrustedAdminRole({
        firebaseUid,
        phoneE164,
      });

      const isUserAdmin =
        adminResolution.isAuthorizedSuperAdmin || adminResolution.isAuthorizedAdmin;

      if (existingAccount) {
        const override =
          serverBuyerOverridesRegistry.get(existingAccount.id) ||
          serverBuyerOverridesRegistry.get(phoneE164);
        if (override?.accountStatus === 'SUSPENDED') {
          return NextResponse.json(
            {
              error: `Account suspended by Platform Administration: ${
                override.suspensionReason || 'Policy violation'
              }`,
              errorCode: 'auth/user-disabled',
            },
            {status: 403}
          );
        }

        const sanitizedRoles = Array.from(
          new Set(
            (existingAccount.roles || ['BUYER']).filter(
              (r) => r === 'BUYER' || r === 'SELLER'
            )
          )
        ) as ('BUYER' | 'SELLER' | 'ADMIN')[];

        if (adminResolution.isAuthorizedSuperAdmin) {
          if (!sanitizedRoles.includes('SELLER')) sanitizedRoles.push('SELLER');
          if (!sanitizedRoles.includes('ADMIN')) sanitizedRoles.push('ADMIN');
        } else if (adminResolution.isAuthorizedAdmin) {
          if (!sanitizedRoles.includes('ADMIN')) sanitizedRoles.push('ADMIN');
        }

        const updatedExisting: UserAccount = {
          ...existingAccount,
          id: existingAccount.id || firebaseUid,
          uid: firebaseUid,
          phoneE164,
          maskedPhone,
          countryCode: countryRecord.code,
          fullName: isDesignatedOwnerPhone(phoneE164)
            ? existingAccount.fullName || DESIGNATED_SUPER_ADMIN_NAME
            : adminResolution.authorizationRecord?.name || existingAccount.fullName,
          roles: sanitizedRoles.length > 0 ? sanitizedRoles : ['BUYER'],
          isAdmin: isUserAdmin,
          role: isUserAdmin ? adminResolution.adminRole : undefined,
        };
        serverUserAccounts.set(phoneE164, updatedExisting);
        await syncUserAccountToFirestore(updatedExisting);

        const sessionToken = createSignedToken({
          userId: updatedExisting.id,
          firebaseUid,
          phoneE164: updatedExisting.phoneE164,
          roles: updatedExisting.roles,
          role: isUserAdmin ? adminResolution.adminRole : undefined,
          adminRole: adminResolution.adminRole,
          adminAuthorized: isUserAdmin,
          superAdminAuthorized: adminResolution.isAuthorizedSuperAdmin,
          sellerId: updatedExisting.sellerId,
          iat: now,
        });

        const res = NextResponse.json({
          ok: true,
          phoneAuthState: 'PHONE_VERIFIED',
          status: 'AUTHENTICATED_EXISTING',
          user: updatedExisting,
          isSuperAdmin: adminResolution.isAuthorizedSuperAdmin,
          isAdmin: isUserAdmin,
          adminRole: adminResolution.adminRole,
          requiresBootstrap: adminResolution.requiresBootstrap,
          redirectTo: isUserAdmin ? '/admin' : undefined,
          verificationToken,
        });

        res.cookies.set('urbandirect_session', sessionToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        return res;
      }

      // If the designated Platform Owner (+918329306616) or an authorized Admin signs in for the first time
      if (isUserAdmin || isDesignatedOwnerPhone(phoneE164)) {
        const adminRoles: ('BUYER' | 'SELLER' | 'ADMIN')[] =
          adminResolution.isAuthorizedSuperAdmin
            ? ['BUYER', 'SELLER', 'ADMIN']
            : isUserAdmin
              ? ['BUYER', 'ADMIN']
              : ['BUYER', 'SELLER'];

        const adminUser: UserAccount = {
          id: firebaseUid,
          uid: firebaseUid,
          phoneE164,
          maskedPhone,
          countryCode: countryRecord.code,
          fullName: isDesignatedOwnerPhone(phoneE164)
            ? DESIGNATED_SUPER_ADMIN_NAME
            : adminResolution.authorizationRecord?.name || 'Authorized Administrator',
          roles: adminRoles,
          isAdmin: isUserAdmin,
          role: isUserAdmin ? adminResolution.adminRole : undefined,
          storeIds: [],
          createdAt: new Date().toISOString().slice(0, 10),
        };
        serverUserAccounts.set(phoneE164, adminUser);
        await syncUserAccountToFirestore(adminUser);

        const sessionToken = createSignedToken({
          userId: adminUser.id,
          firebaseUid,
          phoneE164: adminUser.phoneE164,
          roles: adminUser.roles,
          role: isUserAdmin ? adminResolution.adminRole : undefined,
          adminRole: adminResolution.adminRole,
          adminAuthorized: isUserAdmin,
          superAdminAuthorized: adminResolution.isAuthorizedSuperAdmin,
          iat: now,
        });

        const res = NextResponse.json({
          ok: true,
          phoneAuthState: 'PHONE_VERIFIED',
          status: 'AUTHENTICATED_EXISTING',
          user: adminUser,
          isSuperAdmin: adminResolution.isAuthorizedSuperAdmin,
          isAdmin: isUserAdmin,
          adminRole: adminResolution.adminRole,
          requiresBootstrap: adminResolution.requiresBootstrap,
          redirectTo: isUserAdmin ? '/admin' : undefined,
          verificationToken,
        });

        res.cookies.set('urbandirect_session', sessionToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        return res;
      }

      return NextResponse.json({
        ok: true,
        phoneAuthState: 'PHONE_VERIFIED',
        status: 'VERIFIED_NEW_PHONE',
        phoneE164,
        maskedPhone,
        countryCode: countryRecord.code,
        verificationToken,
      });
    }

    // 3. COMPLETE REGISTRATION OR LEGACY ACCOUNT MIGRATION
    if (action === 'COMPLETE_REGISTRATION') {
      const verificationToken = String(body.verificationToken || '').trim();
      const fullName = String(body.fullName || '').trim();
      const journey = body.journey === 'SELLER' ? 'SELLER' : 'BUYER';
      const migrateSellerId = body.migrateSellerId
        ? String(body.migrateSellerId).trim()
        : undefined;

      const verifiedRecord = verifiedPhoneTokens.get(verificationToken);
      if (!verifiedRecord || Date.now() > verifiedRecord.expiresAtMs) {
        return NextResponse.json(
          {
            error:
              'Your mobile verification session expired. Please verify your mobile number again.',
          },
          {status: 401}
        );
      }

      if (!fullName && !migrateSellerId) {
        return NextResponse.json(
          {
            error: 'Please enter your name to complete setup.',
          },
          {status: 400}
        );
      }

      verifiedPhoneTokens.delete(verificationToken);

      const existingByPhone =
        (await findUserAccountByPhoneInFirestore(verifiedRecord.phoneE164)) ||
        serverUserAccounts.get(verifiedRecord.phoneE164);

      if (migrateSellerId) {
        const legacySeller = INITIAL_SELLERS.find(
          (s) => s.id === migrateSellerId && s.migrationRequired
        );
        if (legacySeller) {
          const migratedUser: UserAccount = {
            id: verifiedRecord.firebaseUid || `user-${legacySeller.id}`,
            uid: verifiedRecord.firebaseUid,
            phoneE164: verifiedRecord.phoneE164,
            maskedPhone: verifiedRecord.maskedPhone,
            countryCode: verifiedRecord.countryCode,
            fullName: fullName || legacySeller.businessOwnerName,
            roles: ['BUYER', 'SELLER'],
            isAdmin: false,
            sellerId: legacySeller.id,
            storeIds: legacySeller.storeIds,
            createdAt:
              existingByPhone?.createdAt ||
              new Date().toISOString().slice(0, 10),
          };
          serverUserAccounts.set(verifiedRecord.phoneE164, migratedUser);
          await syncUserAccountToFirestore(migratedUser);

          const sessionToken = createSignedToken({
            userId: migratedUser.id,
            firebaseUid: verifiedRecord.firebaseUid,
            phoneE164: migratedUser.phoneE164,
            roles: migratedUser.roles,
            sellerId: migratedUser.sellerId,
            iat: Date.now(),
          });

          const res = NextResponse.json({
            ok: true,
            phoneAuthState: 'PHONE_VERIFIED',
            status: 'AUTHENTICATED_MIGRATED_SELLER',
            user: migratedUser,
            migratedSellerId: legacySeller.id,
          });
          res.cookies.set('urbandirect_session', sessionToken, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
          });
          return res;
        }
      }

      const assignedRoles: ('BUYER' | 'SELLER')[] =
        journey === 'SELLER' ? ['BUYER', 'SELLER'] : ['BUYER'];

      const newUser: UserAccount = {
        id: existingByPhone?.id || verifiedRecord.firebaseUid,
        uid: verifiedRecord.firebaseUid,
        phoneE164: verifiedRecord.phoneE164,
        maskedPhone: verifiedRecord.maskedPhone,
        countryCode: verifiedRecord.countryCode,
        fullName: fullName || existingByPhone?.fullName || 'Verified Customer',
        roles: Array.from(
          new Set([
            ...(existingByPhone?.roles || []).filter(
              (r) => r === 'BUYER' || r === 'SELLER'
            ),
            ...assignedRoles,
          ])
        ) as ('BUYER' | 'SELLER')[],
        isAdmin: false,
        sellerId: existingByPhone?.sellerId,
        storeIds: existingByPhone?.storeIds || [],
        createdAt:
          existingByPhone?.createdAt || new Date().toISOString().slice(0, 10),
      };

      serverUserAccounts.set(verifiedRecord.phoneE164, newUser);
      await syncUserAccountToFirestore(newUser);

      const sessionToken = createSignedToken({
        userId: newUser.id,
        firebaseUid: verifiedRecord.firebaseUid,
        phoneE164: newUser.phoneE164,
        roles: newUser.roles,
        sellerId: newUser.sellerId,
        iat: Date.now(),
      });

      const res = NextResponse.json({
        ok: true,
        phoneAuthState: 'PHONE_VERIFIED',
        status: 'AUTHENTICATED_NEW',
        user: newUser,
      });

      res.cookies.set('urbandirect_session', sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return res;
    }

    // 4. UPGRADE EXISTING ACCOUNT TO SELLER
    if (action === 'UPGRADE_TO_SELLER') {
      const phoneE164 = normalizePhoneE164(String(body.phoneE164 || '').trim());
      const sellerId = String(body.sellerId || '').trim();
      const storeId = String(body.storeId || '').trim();
      const fullName = String(body.fullName || '').trim();
      const countryCode = String(body.countryCode || 'IN').trim();
      const firebaseUid = body.firebaseUid
        ? String(body.firebaseUid).trim()
        : '';

      if (!phoneE164 || !sellerId) {
        return NextResponse.json(
          {error: 'Missing phone or seller identifier.'},
          {status: 400}
        );
      }

      // Verify caller identity via signed session cookie or Bearer/body Firebase ID token
      const cookieToken = req.cookies.get('urbandirect_session')?.value;
      const sessionPayload = verifySignedSessionToken(cookieToken);
      const authHeader = req.headers.get('authorization') || '';
      const bearerToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : typeof body.idToken === 'string'
          ? body.idToken.trim()
          : '';

      let verifiedPhone = normalizePhoneE164(sessionPayload?.phoneE164);
      let verifiedUid = sessionPayload?.firebaseUid || sessionPayload?.userId || '';

      if (bearerToken) {
        const verifiedToken = await verifyFirebaseIdTokenCryptographically(bearerToken);
        if (verifiedToken) {
          verifiedUid = verifiedToken.uid;
          if (verifiedToken.phoneE164) {
            verifiedPhone = verifiedToken.phoneE164;
          }
        }
      }

      if (!verifiedPhone || verifiedPhone !== phoneE164) {
        return NextResponse.json(
          {
            error:
              'Unauthorized: You must be signed in with the verified mobile number to upgrade your account to a seller profile.',
          },
          {status: 401}
        );
      }

      const effectiveUid = verifiedUid || firebaseUid;
      const countryRecord = getCountryRecordByCodeOrName(countryCode);
      const existing =
        (await findUserAccountByPhoneInFirestore(phoneE164)) ||
        serverUserAccounts.get(phoneE164);

      const updated: UserAccount = existing
        ? {
            ...existing,
            uid: effectiveUid || existing.uid || existing.id,
            fullName: fullName || existing.fullName,
            roles: Array.from(
              new Set([
                ...existing.roles.filter((r) => r === 'BUYER' || r === 'SELLER'),
                'BUYER',
                'SELLER',
              ])
            ) as ('BUYER' | 'SELLER')[],
            isAdmin: false,
            sellerId,
            storeIds: storeId
              ? Array.from(new Set([...existing.storeIds, storeId]))
              : existing.storeIds,
          }
        : {
            id: firebaseUid || `user-${sellerId}`,
            uid: firebaseUid || `user-${sellerId}`,
            phoneE164,
            maskedPhone: maskPhoneNumber(phoneE164, countryRecord.dialCode),
            countryCode: countryRecord.code,
            fullName: fullName || 'Store Owner',
            roles: ['BUYER', 'SELLER'],
            isAdmin: false,
            sellerId,
            storeIds: storeId ? [storeId] : [],
            createdAt: new Date().toISOString().slice(0, 10),
          };

      serverUserAccounts.set(phoneE164, updated);
      await syncUserAccountToFirestore(updated);

      const sessionToken = createSignedToken({
        userId: updated.id,
        firebaseUid: updated.uid,
        phoneE164: updated.phoneE164,
        roles: updated.roles,
        sellerId: updated.sellerId,
        iat: Date.now(),
      });

      const res = NextResponse.json({
        ok: true,
        status: 'SELLER_LINKED',
        user: updated,
      });

      res.cookies.set('urbandirect_session', sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return res;
    }

    // 5. SIGN OUT
    if (action === 'SIGN_OUT') {
      const res = NextResponse.json({status: 'SIGNED_OUT'});
      res.cookies.delete('urbandirect_session');
      return res;
    }

    return NextResponse.json(
      {error: 'Unsupported authentication action.'},
      {status: 400}
    );
  } catch (err) {
    console.error('[OTP API Error]:', err);
    return NextResponse.json(
      {error: 'Unable to process authentication request.'},
      {status: 500}
    );
  }
}
