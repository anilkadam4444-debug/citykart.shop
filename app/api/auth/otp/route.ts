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

  const superAdminResolution = await resolveTrustedSuperAdminRole({
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

  if (superAdminResolution.isAuthorizedSuperAdmin) {
    if (!baseRoles.includes('SELLER')) baseRoles.push('SELLER');
    if (!baseRoles.includes('ADMIN')) baseRoles.push('ADMIN');
  }

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
      : existing?.fullName || 'Verified User',
    roles: baseRoles.length > 0 ? baseRoles : ['BUYER'],
    isAdmin: superAdminResolution.isAuthorizedSuperAdmin,
    role: superAdminResolution.isAuthorizedSuperAdmin
      ? 'super_admin'
      : undefined,
    sellerId: existing?.sellerId || sessionPayload.sellerId,
    storeIds: existing?.storeIds || [],
    createdAt: existing?.createdAt || new Date().toISOString().slice(0, 10),
  };

  serverUserAccounts.set(canonicalPhone, resolvedUser);

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: resolvedUser,
    isSuperAdmin: superAdminResolution.isAuthorizedSuperAdmin,
    requiresBootstrap: superAdminResolution.requiresBootstrap,
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

      // Server-side trusted super_admin role verification for +918329306616
      const superAdminResolution = await resolveTrustedSuperAdminRole({
        firebaseUid,
        phoneE164,
      });

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

        if (superAdminResolution.isAuthorizedSuperAdmin) {
          if (!sanitizedRoles.includes('SELLER')) sanitizedRoles.push('SELLER');
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
            : existingAccount.fullName,
          roles: sanitizedRoles.length > 0 ? sanitizedRoles : ['BUYER'],
          isAdmin: superAdminResolution.isAuthorizedSuperAdmin,
          role: superAdminResolution.isAuthorizedSuperAdmin
            ? 'super_admin'
            : undefined,
        };
        serverUserAccounts.set(phoneE164, updatedExisting);
        await syncUserAccountToFirestore(updatedExisting);

        const sessionToken = createSignedToken({
          userId: updatedExisting.id,
          firebaseUid,
          phoneE164: updatedExisting.phoneE164,
          roles: updatedExisting.roles,
          role: superAdminResolution.isAuthorizedSuperAdmin
            ? 'super_admin'
            : undefined,
          superAdminAuthorized: superAdminResolution.isAuthorizedSuperAdmin,
          sellerId: updatedExisting.sellerId,
          iat: now,
        });

        const res = NextResponse.json({
          ok: true,
          phoneAuthState: 'PHONE_VERIFIED',
          status: 'AUTHENTICATED_EXISTING',
          user: updatedExisting,
          isSuperAdmin: superAdminResolution.isAuthorizedSuperAdmin,
          requiresBootstrap: superAdminResolution.requiresBootstrap,
          redirectTo: superAdminResolution.isAuthorizedSuperAdmin
            ? '/admin'
            : undefined,
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

      // If the designated Platform Owner (+918329306616) signs in for the first time,
      // automatically create their base UserAccount profile and attach server-verified super_admin role.
      if (isDesignatedOwnerPhone(phoneE164)) {
        const ownerRoles: ('BUYER' | 'SELLER' | 'ADMIN')[] =
          superAdminResolution.isAuthorizedSuperAdmin
            ? ['BUYER', 'SELLER', 'ADMIN']
            : ['BUYER', 'SELLER'];

        const ownerUser: UserAccount = {
          id: firebaseUid,
          uid: firebaseUid,
          phoneE164,
          maskedPhone,
          countryCode: countryRecord.code,
          fullName: DESIGNATED_SUPER_ADMIN_NAME,
          roles: ownerRoles,
          isAdmin: superAdminResolution.isAuthorizedSuperAdmin,
          role: superAdminResolution.isAuthorizedSuperAdmin
            ? 'super_admin'
            : undefined,
          storeIds: [],
          createdAt: new Date().toISOString().slice(0, 10),
        };
        serverUserAccounts.set(phoneE164, ownerUser);
        await syncUserAccountToFirestore(ownerUser);

        const sessionToken = createSignedToken({
          userId: ownerUser.id,
          firebaseUid,
          phoneE164: ownerUser.phoneE164,
          roles: ownerUser.roles,
          role: superAdminResolution.isAuthorizedSuperAdmin
            ? 'super_admin'
            : undefined,
          superAdminAuthorized: superAdminResolution.isAuthorizedSuperAdmin,
          iat: now,
        });

        const res = NextResponse.json({
          ok: true,
          phoneAuthState: 'PHONE_VERIFIED',
          status: 'AUTHENTICATED_EXISTING',
          user: ownerUser,
          isSuperAdmin: superAdminResolution.isAuthorizedSuperAdmin,
          requiresBootstrap: superAdminResolution.requiresBootstrap,
          redirectTo: superAdminResolution.isAuthorizedSuperAdmin
            ? '/admin'
            : undefined,
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
      const phoneE164 = String(body.phoneE164 || '').trim();
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

      const countryRecord = getCountryRecordByCodeOrName(countryCode);
      const existing =
        (await findUserAccountByPhoneInFirestore(phoneE164)) ||
        serverUserAccounts.get(phoneE164);

      const updated: UserAccount = existing
        ? {
            ...existing,
            uid: firebaseUid || existing.uid || existing.id,
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
