import {NextRequest, NextResponse} from 'next/server';
import crypto from 'crypto';
import {
  getCountryRecordByCodeOrName,
  maskPhoneNumber,
  validatePhoneNumberForCountry,
} from '@/lib/countries-data';
import {
  INITIAL_SELLERS,
  INITIAL_USER_ACCOUNTS,
  UserAccount,
} from '@/lib/catalog-data';

interface RateWindowRecord {
  count: number;
  windowStartMs: number;
  lastRequestedAtMs: number;
}

interface VerifiedPhoneSession {
  phoneE164: string;
  countryCode: string;
  maskedPhone: string;
  firebaseUid?: string;
  expiresAtMs: number;
}

// Server-side in-memory stores for rate limiting and verified Firebase Phone Auth sessions
// Note: No custom OTP codes are generated or stored on the server; OTP generation and verification
// are handled natively by Firebase Phone Authentication on project `urbandirectintracity`.
const requestRateLimits = new Map<string, RateWindowRecord>();
const verifiedPhoneTokens = new Map<string, VerifiedPhoneSession>();
const serverUserAccounts = new Map<string, UserAccount>(
  INITIAL_USER_ACCOUNTS.map((u) => [u.phoneE164, u])
);

const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function getServerSecret(): string {
  return (
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
        return NextResponse.json(
          {
            error:
              validation.error ||
              'Please enter a valid mobile number for your selected country.',
          },
          {status: 400}
        );
      }

      const {e164} = validation;
      const now = Date.now();

      // Check rate limit window (max 5 requests per 10 mins per number)
      const rateRec = requestRateLimits.get(e164);
      if (rateRec && now - rateRec.windowStartMs < RATE_WINDOW_MS) {
        if (rateRec.count >= MAX_REQUESTS_PER_WINDOW) {
          return NextResponse.json(
            {
              error:
                'Too many verification requests for this number. Please wait a few minutes and try again.',
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
        status: 'PHONE_VALIDATED',
        phoneE164: e164,
        maskedPhone,
        countryCode: countryRecord.code,
        resendCooldownSeconds: 30,
        firebaseProjectId: 'urbandirectintracity',
        authProvider: 'firebase_phone_auth',
      });
    }

    // 2. RESOLVE FIREBASE PHONE AUTHENTICATED SESSION
    if (action === 'RESOLVE_FIREBASE_USER' || action === 'VERIFY_OTP') {
      const phoneE164 = String(body.phoneE164 || '').trim();
      const countryCode = String(body.countryCode || 'IN').trim();
      const firebaseUid = body.firebaseUid
        ? String(body.firebaseUid).trim()
        : undefined;

      if (!phoneE164 || !phoneE164.startsWith('+')) {
        return NextResponse.json(
          {
            error: 'Valid E.164 mobile number is required.',
          },
          {status: 400}
        );
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

      const existingAccount = serverUserAccounts.get(phoneE164);

      if (existingAccount) {
        const updatedExisting: UserAccount = firebaseUid
          ? {...existingAccount, id: existingAccount.id || firebaseUid}
          : existingAccount;
        serverUserAccounts.set(phoneE164, updatedExisting);

        const sessionToken = createSignedToken({
          userId: updatedExisting.id,
          firebaseUid,
          phoneE164: updatedExisting.phoneE164,
          roles: updatedExisting.roles,
          sellerId: updatedExisting.sellerId,
          iat: now,
        });

        const res = NextResponse.json({
          status: 'AUTHENTICATED_EXISTING',
          user: updatedExisting,
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
      const journey = String(body.journey || 'BUYER');
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

      if (!fullName) {
        return NextResponse.json(
          {
            error: 'Please enter your name to complete setup.',
          },
          {status: 400}
        );
      }

      // Check if migrating an existing unverified seller account (e.g., seller-5)
      if (migrateSellerId) {
        const legacySeller = INITIAL_SELLERS.find(
          (s) => s.id === migrateSellerId && s.migrationRequired
        );
        if (legacySeller) {
          const migratedUser: UserAccount = {
            id: verifiedRecord.firebaseUid || `user-${legacySeller.id}`,
            phoneE164: verifiedRecord.phoneE164,
            maskedPhone: verifiedRecord.maskedPhone,
            countryCode: verifiedRecord.countryCode,
            fullName: fullName || legacySeller.businessOwnerName,
            roles: ['BUYER', 'SELLER'],
            sellerId: legacySeller.id,
            storeIds: legacySeller.storeIds,
            createdAt: new Date().toISOString().slice(0, 10),
          };
          serverUserAccounts.set(verifiedRecord.phoneE164, migratedUser);
          verifiedPhoneTokens.delete(verificationToken);

          const sessionToken = createSignedToken({
            userId: migratedUser.id,
            firebaseUid: verifiedRecord.firebaseUid,
            phoneE164: migratedUser.phoneE164,
            roles: migratedUser.roles,
            sellerId: migratedUser.sellerId,
            iat: Date.now(),
          });

          const res = NextResponse.json({
            status: 'AUTHENTICATED_MIGRATED',
            user: migratedUser,
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

      const isSellerJourney = journey === 'SELLER';
      const newSellerId = isSellerJourney
        ? `seller-${Date.now()}`
        : undefined;
      const newUser: UserAccount = {
        id: verifiedRecord.firebaseUid || `user-${Date.now()}`,
        phoneE164: verifiedRecord.phoneE164,
        maskedPhone: verifiedRecord.maskedPhone,
        countryCode: verifiedRecord.countryCode,
        fullName,
        roles: isSellerJourney ? ['BUYER', 'SELLER'] : ['BUYER'],
        sellerId: newSellerId,
        storeIds: [],
        createdAt: new Date().toISOString().slice(0, 10),
      };

      serverUserAccounts.set(verifiedRecord.phoneE164, newUser);
      verifiedPhoneTokens.delete(verificationToken);

      const sessionToken = createSignedToken({
        userId: newUser.id,
        firebaseUid: verifiedRecord.firebaseUid,
        phoneE164: newUser.phoneE164,
        roles: newUser.roles,
        sellerId: newUser.sellerId,
        iat: Date.now(),
      });

      const res = NextResponse.json({
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

    // 4. UPGRADE EXISTING ACCOUNT TO SELLER WHEN STORE IS REGISTERED (No duplicate accounts)
    if (action === 'UPGRADE_TO_SELLER') {
      const phoneE164 = String(body.phoneE164 || '').trim();
      const sellerId = String(body.sellerId || '').trim();
      const storeId = String(body.storeId || '').trim();
      const fullName = String(body.fullName || '').trim();

      if (!phoneE164 || !sellerId || !storeId) {
        return NextResponse.json(
          {error: 'Missing phoneE164, sellerId, or storeId.'},
          {status: 400}
        );
      }

      const existing = serverUserAccounts.get(phoneE164);
      const nextStoreIds = existing
        ? Array.from(new Set([...existing.storeIds, storeId]))
        : [storeId];

      const upgradedUser: UserAccount = existing
        ? {
            ...existing,
            fullName: fullName || existing.fullName,
            roles: Array.from(new Set([...existing.roles, 'BUYER', 'SELLER'])),
            sellerId,
            storeIds: nextStoreIds,
          }
        : {
            id: `user-${sellerId}`,
            phoneE164,
            maskedPhone: `${phoneE164.slice(0, 3)} •••••• ${phoneE164.slice(-4)}`,
            countryCode: String(body.countryCode || 'IN'),
            fullName: fullName || 'Store Owner',
            roles: ['BUYER', 'SELLER'],
            sellerId,
            storeIds: [storeId],
            createdAt: new Date().toISOString().slice(0, 10),
          };

      serverUserAccounts.set(phoneE164, upgradedUser);

      const sessionToken = createSignedToken({
        userId: upgradedUser.id,
        phoneE164: upgradedUser.phoneE164,
        roles: upgradedUser.roles,
        sellerId: upgradedUser.sellerId,
        iat: Date.now(),
      });

      const res = NextResponse.json({
        status: 'UPGRADED_TO_SELLER',
        user: upgradedUser,
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

    return NextResponse.json({error: 'Unsupported action.'}, {status: 400});
  } catch {
    return NextResponse.json(
      {
        error:
          'Unable to process mobile verification right now. Please try again.',
      },
      {status: 500}
    );
  }
}
