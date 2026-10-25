import { NextRequest } from 'next/server';
import crypto from 'crypto';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlan,
  SubscriptionTierId,
} from './revenue-model';

export const DESIGNATED_SUPER_ADMIN_PHONE = '+918329306616';
export const DESIGNATED_SUPER_ADMIN_NAME = 'Platform Owner';
export const DESIGNATED_SUPER_ADMIN_ROLE = 'super_admin' as const;
export const DESIGNATED_PLATFORM_URL = 'https://citykart.shop';

export interface SuperAdminRecord {
  uid: string;
  phoneE164: string;
  displayName: string;
  role: 'super_admin';
  status: 'ACTIVE' | 'REVOKED';
  platform: string;
  grantedAt: string;
  grantedBy:
    | 'SERVER_BOOTSTRAP'
    | 'FIREBASE_CUSTOM_CLAIMS'
    | 'FIRESTORE_ADMIN_REGISTRY'
    | 'ADMIN_CONSOLE';
  customClaimsSynced: boolean;
  lastVerifiedAt: string;
}

export type AdminActionType =
  | 'SUPER_ADMIN_BOOTSTRAP'
  | 'SUSPEND_STORE'
  | 'RESTORE_STORE'
  | 'DELETE_STORE'
  | 'VERIFY_STORE_LOCATION'
  | 'SUSPEND_BUYER'
  | 'RESTORE_BUYER'
  | 'UNPUBLISH_PRODUCT'
  | 'RESTORE_PRODUCT'
  | 'TOGGLE_CATEGORY'
  | 'ADD_ORDER_ADMIN_NOTE'
  | 'UPDATE_SUBSCRIPTION_PLAN'
  | 'UPDATE_MERCHANT_SUBSCRIPTION'
  | 'UPDATE_PLATFORM_SETTINGS'
  | 'APPROVE_LOCATION_REQUEST'
  | 'REJECT_LOCATION_REQUEST'
  | 'SEED_DEMO_DATA'
  | 'REMOVE_DEMO_DATA';

export interface AdminAuditLogRecord {
  id: string;
  // Fields required by firestore.rules and SuperAdminDashboard
  action: AdminActionType;
  actorUid: string;
  actorPhone: string;
  actorName: string;
  actorRole: 'super_admin';
  targetType:
    | 'STORE'
    | 'SELLER'
    | 'BUYER'
    | 'PRODUCT'
    | 'CATEGORY'
    | 'ORDER'
    | 'SUBSCRIPTION_PLAN'
    | 'MERCHANT_SUBSCRIPTION'
    | 'PLATFORM_SETTINGS'
    | 'LOCATION'
    | 'LOCATION_REQUEST'
    | 'SYSTEM';
  targetId: string;
  targetLabel?: string;
  summary: string;
  createdAt: string;
  // Backwards-compatible server fields
  adminUid: string;
  adminDisplayName: string;
  adminRole: 'super_admin';
  actionType: AdminActionType;
  targetEntityType:
    | 'STORE'
    | 'SELLER'
    | 'BUYER'
    | 'PRODUCT'
    | 'CATEGORY'
    | 'ORDER'
    | 'SUBSCRIPTION_PLAN'
    | 'MERCHANT_SUBSCRIPTION'
    | 'PLATFORM_SETTINGS'
    | 'LOCATION'
    | 'LOCATION_REQUEST'
    | 'SYSTEM';
  targetEntityId: string;
  targetEntityName?: string;
  status: 'SUCCESS' | 'FAILURE';
  reason: string;
  metadata?: Record<string, string | number | boolean | null>;
  timestamp: string;
}

export interface PlatformSettingsConfig {
  platformName: string;
  publicWebsiteUrl: string;
  domain: string;
  supportPhone: string;
  supportEmail: string;
  merchantSupportEmail: string;
  defaultCurrency: string;
  marketplaceAvailable: boolean;
  allowNewSellerRegistrations: boolean;
  requireLocationVerificationForNewStores: boolean;
  excludeDemoFromProductionMetricsByDefault: boolean;
  excludeDemoRecordsFromProductionMetrics: boolean;
  maintenanceBannerEnabled: boolean;
  maintenanceBannerText: string;
  maintenanceBannerMessage: string;
  defaultFreeDeliveryThresholdInr: number;
  defaultStandardDeliveryFeeInr: number;
  maxProductImageSizeMb: number;
  fcmPushNotificationsEnabled: boolean;
  updatedAt: string;
  updatedByUid: string;
  updatedBy: string;
}

export interface SystemHealthEvent {
  id: string;
  category:
    | 'AUTH_ERROR'
    | 'FCM_NOTIFICATION'
    | 'ORDER_PROCESSING'
    | 'PAYMENT_FAILURE'
    | 'BACKEND_ERROR';
  type: 'AUTH' | 'NOTIFICATION' | 'WEBHOOK' | 'FIRESTORE' | 'ADMIN';
  severity: 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  entityId?: string;
  timestamp: string;
  createdAt: string;
}

export interface StoreAdminOverride {
  storeId: string;
  isSuspended: boolean;
  isActive: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  suspendedByUid?: string;
  locationVerified?: boolean;
  verificationStatus?: 'VERIFIED' | 'USER_PROVIDED_UNVERIFIED' | 'INCOMPLETE';
  updatedAt: string;
}

export interface ProductAdminOverride {
  productId: string;
  adminUnpublished: boolean;
  isAvailable: boolean;
  unpublishReason?: string;
  unpublishedAt?: string;
  unpublishedByUid?: string;
  updatedAt: string;
}

export interface BuyerAdminOverride {
  userId: string;
  phoneE164: string;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  suspensionReason?: string;
  suspendedAt?: string;
  suspendedByUid?: string;
  updatedAt: string;
}

declare global {
  var __serverSuperAdminsRegistry: Map<string, SuperAdminRecord> | undefined;
  var __serverAuditLogsRegistry: Map<string, AdminAuditLogRecord> | undefined;
  var __serverPlatformSettings: PlatformSettingsConfig | undefined;
  var __serverSubscriptionPlansOverride:
    | Record<SubscriptionTierId, SubscriptionPlan>
    | undefined;
  var __serverStoreOverridesRegistry:
    | Map<string, StoreAdminOverride>
    | undefined;
  var __serverProductOverridesRegistry:
    | Map<string, ProductAdminOverride>
    | undefined;
  var __serverBuyerOverridesRegistry:
    | Map<string, BuyerAdminOverride>
    | undefined;
  var __serverSystemEventsRegistry: Map<string, SystemHealthEvent> | undefined;
}

if (!globalThis.__serverSuperAdminsRegistry) {
  globalThis.__serverSuperAdminsRegistry = new Map<string, SuperAdminRecord>();
}
if (!globalThis.__serverAuditLogsRegistry) {
  globalThis.__serverAuditLogsRegistry = new Map<string, AdminAuditLogRecord>();
}
if (!globalThis.__serverPlatformSettings) {
  const nowIso = new Date().toISOString();
  globalThis.__serverPlatformSettings = {
    platformName: 'Citykart',
    publicWebsiteUrl: 'https://citykart.shop',
    domain: 'citykart.shop',
    supportPhone: '+918329306616',
    supportEmail: 'support@citykart.shop',
    merchantSupportEmail: 'merchants@citykart.shop',
    defaultCurrency: 'INR',
    marketplaceAvailable: true,
    allowNewSellerRegistrations: true,
    requireLocationVerificationForNewStores: false,
    excludeDemoFromProductionMetricsByDefault: true,
    excludeDemoRecordsFromProductionMetrics: true,
    maintenanceBannerEnabled: false,
    maintenanceBannerText: '',
    maintenanceBannerMessage: '',
    defaultFreeDeliveryThresholdInr: 199,
    defaultStandardDeliveryFeeInr: 25,
    maxProductImageSizeMb: 5,
    fcmPushNotificationsEnabled: true,
    updatedAt: nowIso,
    updatedByUid: 'system-default',
    updatedBy: DESIGNATED_SUPER_ADMIN_PHONE,
  };
}
if (!globalThis.__serverSubscriptionPlansOverride) {
  globalThis.__serverSubscriptionPlansOverride = JSON.parse(
    JSON.stringify(SUBSCRIPTION_PLANS)
  );
}
if (!globalThis.__serverStoreOverridesRegistry) {
  globalThis.__serverStoreOverridesRegistry = new Map<
    string,
    StoreAdminOverride
  >();
}
if (!globalThis.__serverProductOverridesRegistry) {
  globalThis.__serverProductOverridesRegistry = new Map<
    string,
    ProductAdminOverride
  >();
}
if (!globalThis.__serverBuyerOverridesRegistry) {
  globalThis.__serverBuyerOverridesRegistry = new Map<
    string,
    BuyerAdminOverride
  >();
}
if (!globalThis.__serverSystemEventsRegistry) {
  globalThis.__serverSystemEventsRegistry = new Map<string, SystemHealthEvent>();
}

export const serverSuperAdminsRegistry = globalThis.__serverSuperAdminsRegistry;
export const serverAuditLogsRegistry = globalThis.__serverAuditLogsRegistry;
export const serverStoreOverridesRegistry =
  globalThis.__serverStoreOverridesRegistry;
export const serverProductOverridesRegistry =
  globalThis.__serverProductOverridesRegistry;
export const serverBuyerOverridesRegistry =
  globalThis.__serverBuyerOverridesRegistry;
export const serverSystemEventsRegistry =
  globalThis.__serverSystemEventsRegistry;

export function getAuthoritativeSubscriptionPlans(): Record<
  SubscriptionTierId,
  SubscriptionPlan
> {
  return globalThis.__serverSubscriptionPlansOverride || SUBSCRIPTION_PLANS;
}

export function setAuthoritativeSubscriptionPlan(
  planId: SubscriptionTierId,
  updatedPlan: SubscriptionPlan
): void {
  if (!globalThis.__serverSubscriptionPlansOverride) {
    globalThis.__serverSubscriptionPlansOverride = JSON.parse(
      JSON.stringify(SUBSCRIPTION_PLANS)
    );
  }
  globalThis.__serverSubscriptionPlansOverride![planId] = updatedPlan;
}

export function getAuthoritativePlatformSettings(): PlatformSettingsConfig {
  return globalThis.__serverPlatformSettings!;
}

export function updateAuthoritativePlatformSettings(
  patch: Partial<PlatformSettingsConfig>,
  adminUid: string
): PlatformSettingsConfig {
  const current = getAuthoritativePlatformSettings();
  const nowIso = new Date().toISOString();
  const excludeDemo =
    typeof patch.excludeDemoRecordsFromProductionMetrics === 'boolean'
      ? patch.excludeDemoRecordsFromProductionMetrics
      : typeof patch.excludeDemoFromProductionMetricsByDefault === 'boolean'
        ? patch.excludeDemoFromProductionMetricsByDefault
        : current.excludeDemoRecordsFromProductionMetrics;

  const bannerMsg =
    patch.maintenanceBannerMessage !== undefined
      ? patch.maintenanceBannerMessage
      : patch.maintenanceBannerText !== undefined
        ? patch.maintenanceBannerText
        : current.maintenanceBannerMessage;

  const updated: PlatformSettingsConfig = {
    ...current,
    ...patch,
    platformName:
      (patch.platformName || current.platformName).trim() || 'Citykart',
    publicWebsiteUrl:
      (patch.publicWebsiteUrl || current.publicWebsiteUrl).trim() ||
      'https://citykart.shop',
    domain: (patch.domain || current.domain).trim() || 'citykart.shop',
    supportPhone:
      (patch.supportPhone || current.supportPhone).trim() ||
      DESIGNATED_SUPER_ADMIN_PHONE,
    supportEmail:
      (patch.supportEmail || current.supportEmail).trim() ||
      'support@citykart.shop',
    defaultCurrency:
      (patch.defaultCurrency || current.defaultCurrency).trim() || 'INR',
    excludeDemoFromProductionMetricsByDefault: excludeDemo,
    excludeDemoRecordsFromProductionMetrics: excludeDemo,
    maintenanceBannerText: bannerMsg,
    maintenanceBannerMessage: bannerMsg,
    updatedAt: nowIso,
    updatedByUid: adminUid,
    updatedBy: DESIGNATED_SUPER_ADMIN_PHONE,
  };
  globalThis.__serverPlatformSettings = updated;
  return updated;
}

export function logSystemHealthEvent(
  event: Omit<SystemHealthEvent, 'id' | 'timestamp' | 'createdAt' | 'type'> & {
    type?: SystemHealthEvent['type'];
  }
): void {
  const id = `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();
  const mappedType: SystemHealthEvent['type'] =
    event.type ||
    (event.category === 'AUTH_ERROR'
      ? 'AUTH'
      : event.category === 'FCM_NOTIFICATION'
        ? 'NOTIFICATION'
        : 'ADMIN');

  const fullEvent: SystemHealthEvent = {
    ...event,
    id,
    type: mappedType,
    timestamp: nowIso,
    createdAt: nowIso,
  };
  serverSystemEventsRegistry.set(id, fullEvent);
  if (serverSystemEventsRegistry.size > 200) {
    const firstKey = serverSystemEventsRegistry.keys().next().value;
    if (firstKey) serverSystemEventsRegistry.delete(firstKey);
  }
}

export function normalizePhoneE164(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-()]/g, '').trim();
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return cleaned;
}

export function isDesignatedOwnerPhone(phone?: string | null): boolean {
  return normalizePhoneE164(phone) === DESIGNATED_SUPER_ADMIN_PHONE;
}

export function getServerHmacSecret(): string {
  return (
    process.env.OTP_HMAC_SECRET ||
    process.env.GEMINI_API_KEY ||
    'urbandirect-server-hmac-secret-key-2026'
  );
}

export interface SignedSessionPayload {
  userId: string;
  firebaseUid: string;
  phoneE164: string;
  roles: string[];
  role?: string;
  superAdminAuthorized?: boolean;
  sellerId?: string;
  iat: number;
}

export function createSignedSessionToken(payload: SignedSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getServerHmacSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySignedSessionToken(
  token?: string | null
): SignedSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getServerHmacSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedSessionPayload;
    if (decoded.iat && Date.now() - decoded.iat > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Initializes Firebase Admin SDK preferring Cloud Run Service Identity /
 * Application Default Credentials (ADC) without requiring a service account JSON key.
 */
function ensureAdminAppInitialized(): boolean {
  try {
    if (getApps().length === 0) {
      const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (saKey && saKey.trim().startsWith('{')) {
        const parsed = JSON.parse(saKey);
        initializeApp({
          credential: cert(parsed),
          projectId: firebaseConfig.projectId,
        });
      } else {
        try {
          initializeApp({
            credential: applicationDefault(),
            projectId: firebaseConfig.projectId,
          });
        } catch {
          initializeApp({
            projectId: firebaseConfig.projectId,
          });
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Cached Google SecureToken X.509 public certificates for zero-key RS256 verification
let cachedGoogleCerts: Record<string, string> | null = null;
let cachedGoogleCertsExpiresAt = 0;

async function getGoogleSecureTokenPublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && now < cachedGoogleCertsExpiresAt) {
    return cachedGoogleCerts;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { cache: 'no-store' }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Google SecureToken public certificates (${res.status})`);
  }
  const certs = (await res.json()) as Record<string, string>;
  cachedGoogleCerts = certs;
  // Cache for 1 hour by default
  cachedGoogleCertsExpiresAt = now + 60 * 60 * 1000;
  return certs;
}

export interface VerifiedFirebaseTokenClaims {
  uid: string;
  phoneE164: string;
  role?: string;
  super_admin?: boolean;
  roles?: string[];
  verifiedVia: 'ADMIN_ADC' | 'GOOGLE_X509_CERT';
}

/**
 * Verifies a Firebase ID Token cryptographically on the server WITHOUT requiring
 * a service account private key JSON:
 * 1. First attempts Firebase Admin SDK verification via Application Default Credentials (ADC).
 * 2. Falls back to cryptographic RS256 verification against Google's official
 *    `securetoken@system.gserviceaccount.com` X.509 public certificates.
 */
export async function verifyFirebaseIdTokenCryptographically(
  idToken: string
): Promise<VerifiedFirebaseTokenClaims | null> {
  if (!idToken || typeof idToken !== 'string') return null;

  // Path 1: Try Firebase Admin SDK (Application Default Credentials / Cloud Run Service Identity)
  if (ensureAdminAppInitialized()) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        phoneE164: normalizePhoneE164(decoded.phone_number),
        role: typeof decoded.role === 'string' ? decoded.role : undefined,
        super_admin: decoded.super_admin === true,
        roles: Array.isArray(decoded.roles) ? decoded.roles : undefined,
        verifiedVia: 'ADMIN_ADC',
      };
    } catch {
      // Proceed to Path 2 (direct Google X.509 RSA-SHA256 signature verification)
    }
  }

  // Path 2: Verify RS256 signature using Google's public X.509 certificates
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(
      Buffer.from(headerB64, 'base64url').toString('utf8')
    ) as { alg?: string; kid?: string };

    if (header.alg !== 'RS256' || !header.kid) {
      return null;
    }

    const claims = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as {
      iss?: string;
      aud?: string;
      sub?: string;
      user_id?: string;
      phone_number?: string;
      role?: string;
      super_admin?: boolean;
      roles?: string[];
      exp?: number;
      iat?: number;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    if (!claims.exp || claims.exp < nowSec - 60) {
      return null;
    }
    if (!claims.iat || claims.iat > nowSec + 300) {
      return null;
    }
    if (claims.aud !== firebaseConfig.projectId) {
      return null;
    }
    if (
      claims.iss !== `https://securetoken.google.com/${firebaseConfig.projectId}`
    ) {
      return null;
    }

    const uid = claims.user_id || claims.sub || '';
    if (!uid) return null;

    const certs = await getGoogleSecureTokenPublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();

    const signatureBuf = Buffer.from(signatureB64, 'base64url');
    const isSignatureValid = verifier.verify(certPem, signatureBuf);
    if (!isSignatureValid) {
      return null;
    }

    return {
      uid,
      phoneE164: normalizePhoneE164(claims.phone_number),
      role: claims.role,
      super_admin: claims.super_admin === true,
      roles: Array.isArray(claims.roles) ? claims.roles : undefined,
      verifiedVia: 'GOOGLE_X509_CERT',
    };
  } catch (err) {
    logSystemHealthEvent({
      category: 'AUTH_ERROR',
      severity: 'WARNING',
      title: 'Firebase ID Token Verification Failed',
      message:
        err instanceof Error
          ? err.message
          : 'Invalid or expired Firebase ID token.',
    });
    return null;
  }
}

export interface SuperAdminAuthVerificationResult {
  authorized: boolean;
  status: 200 | 401 | 403;
  reason: string;
  isVerifiedOwnerPhone: boolean;
  requiresBootstrap: boolean;
  adminRecord?: SuperAdminRecord;
  firebaseUid?: string;
  phoneE164?: string;
  authMethod?:
    | 'FIREBASE_CUSTOM_CLAIMS'
    | 'FIRESTORE_ADMIN_REGISTRY'
    | 'SERVER_SIGNED_SESSION';
}

/**
 * Verifies that an incoming HTTP request is from the authenticated and
 * server-authorized Platform Owner (`+918329306616`, role: `super_admin`).
 *
 * Security Invariants:
 * 1. A phone number passed in query params or request body is NEVER trusted.
 * 2. The caller must have a cryptographically verified session (`urbandirect_session` HMAC cookie)
 *    and/or a cryptographically verified Firebase ID token (`Authorization: Bearer <token>`).
 * 3. The verified phone number must match `+918329306616`.
 * 4. Even when the phone matches `+918329306616`, administrative access is granted ONLY
 *    after the `super_admin` role is provisioned in `/admins/{uid}`, Firebase Custom Claims,
 *    or the server-bootstrapped `serverSuperAdminsRegistry`.
 */
export async function verifySuperAdminRequest(
  req: NextRequest
): Promise<SuperAdminAuthVerificationResult> {
  const cookieToken = req.cookies.get('urbandirect_session')?.value;
  const sessionPayload = verifySignedSessionToken(cookieToken);

  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  let verifiedUid = sessionPayload?.firebaseUid || sessionPayload?.userId || '';
  let verifiedPhone = normalizePhoneE164(sessionPayload?.phoneE164);
  let hasCustomClaimSuperAdmin = false;

  if (bearerToken) {
    const verifiedToken = await verifyFirebaseIdTokenCryptographically(bearerToken);
    if (verifiedToken) {
      verifiedUid = verifiedToken.uid;
      if (verifiedToken.phoneE164) {
        verifiedPhone = verifiedToken.phoneE164;
      }
      if (
        verifiedToken.role === 'super_admin' ||
        verifiedToken.super_admin === true ||
        (Array.isArray(verifiedToken.roles) &&
          verifiedToken.roles.includes('super_admin'))
      ) {
        hasCustomClaimSuperAdmin = true;
      }
    }
  }

  // 1. Check authentication presence
  if (!verifiedUid || !verifiedPhone) {
    return {
      authorized: false,
      status: 401,
      reason:
        'Authentication required. Please sign in with Firebase Phone Authentication (+918329306616).',
      isVerifiedOwnerPhone: false,
      requiresBootstrap: false,
    };
  }

  // 2. Confirm phone number strictly matches the designated Platform Owner (+918329306616)
  if (!isDesignatedOwnerPhone(verifiedPhone)) {
    logSystemHealthEvent({
      category: 'AUTH_ERROR',
      severity: 'WARNING',
      title: 'Unauthorized Admin Access Attempt Blocked',
      message: `Authenticated user (${verifiedUid}) with non-owner phone attempted to access Super Admin resource.`,
      entityId: verifiedUid,
    });
    return {
      authorized: false,
      status: 403,
      reason:
        'Access Denied: Your authenticated mobile number is not authorized for Platform Owner Super Admin access.',
      isVerifiedOwnerPhone: false,
      requiresBootstrap: false,
      firebaseUid: verifiedUid,
      phoneE164: verifiedPhone,
    };
  }

  // 3. Phone matches +918329306616. Verify server-controlled `super_admin` role grant!
  // Check (A): Firebase Custom Claims
  if (hasCustomClaimSuperAdmin) {
    const rec: SuperAdminRecord = {
      uid: verifiedUid,
      phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
      displayName: DESIGNATED_SUPER_ADMIN_NAME,
      role: 'super_admin',
      status: 'ACTIVE',
      platform: DESIGNATED_PLATFORM_URL,
      grantedAt: new Date().toISOString(),
      grantedBy: 'FIREBASE_CUSTOM_CLAIMS',
      customClaimsSynced: true,
      lastVerifiedAt: new Date().toISOString(),
    };
    serverSuperAdminsRegistry.set(verifiedUid, rec);
    return {
      authorized: true,
      status: 200,
      reason: 'Authorized via Firebase Custom Claims (super_admin).',
      isVerifiedOwnerPhone: true,
      requiresBootstrap: false,
      adminRecord: rec,
      firebaseUid: verifiedUid,
      phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
      authMethod: 'FIREBASE_CUSTOM_CLAIMS',
    };
  }

  // Check (B): In-memory server registry
  const memoryRecord = serverSuperAdminsRegistry.get(verifiedUid);
  if (memoryRecord && memoryRecord.status === 'ACTIVE') {
    return {
      authorized: true,
      status: 200,
      reason: 'Authorized via Server Super Admin Registry.',
      isVerifiedOwnerPhone: true,
      requiresBootstrap: false,
      adminRecord: memoryRecord,
      firebaseUid: verifiedUid,
      phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
      authMethod: 'FIRESTORE_ADMIN_REGISTRY',
    };
  }

  // Check (C): Cryptographically signed server session with superAdminAuthorized
  if (
    sessionPayload?.superAdminAuthorized === true &&
    sessionPayload?.role === 'super_admin' &&
    isDesignatedOwnerPhone(sessionPayload.phoneE164)
  ) {
    const rec: SuperAdminRecord = {
      uid: verifiedUid,
      phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
      displayName: DESIGNATED_SUPER_ADMIN_NAME,
      role: 'super_admin',
      status: 'ACTIVE',
      platform: DESIGNATED_PLATFORM_URL,
      grantedAt: new Date(sessionPayload.iat).toISOString(),
      grantedBy: 'SERVER_BOOTSTRAP',
      customClaimsSynced: false,
      lastVerifiedAt: new Date().toISOString(),
    };
    serverSuperAdminsRegistry.set(verifiedUid, rec);
    return {
      authorized: true,
      status: 200,
      reason: 'Authorized via cryptographically signed super_admin session.',
      isVerifiedOwnerPhone: true,
      requiresBootstrap: false,
      adminRecord: rec,
      firebaseUid: verifiedUid,
      phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
      authMethod: 'SERVER_SIGNED_SESSION',
    };
  }

  // Check (D): Authoritative Firestore `/admins/{verifiedUid}` document
  try {
    const adminSnap = await getDoc(doc(db, 'admins', verifiedUid));
    if (adminSnap.exists()) {
      const data = adminSnap.data() as Partial<SuperAdminRecord>;
      if (
        data.role === 'super_admin' &&
        data.status === 'ACTIVE' &&
        isDesignatedOwnerPhone(data.phoneE164)
      ) {
        const rec: SuperAdminRecord = {
          uid: verifiedUid,
          phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
          displayName: data.displayName || DESIGNATED_SUPER_ADMIN_NAME,
          role: 'super_admin',
          status: 'ACTIVE',
          platform: DESIGNATED_PLATFORM_URL,
          grantedAt: data.grantedAt || new Date().toISOString(),
          grantedBy: data.grantedBy || 'FIRESTORE_ADMIN_REGISTRY',
          customClaimsSynced: Boolean(data.customClaimsSynced),
          lastVerifiedAt: new Date().toISOString(),
        };
        serverSuperAdminsRegistry.set(verifiedUid, rec);
        return {
          authorized: true,
          status: 200,
          reason: 'Authorized via Firestore /admins registry.',
          isVerifiedOwnerPhone: true,
          requiresBootstrap: false,
          adminRecord: rec,
          firebaseUid: verifiedUid,
          phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
          authMethod: 'FIRESTORE_ADMIN_REGISTRY',
        };
      }
    }
  } catch {
    // Ignore Firestore lookup fallback error
  }

  // Owner phone is verified via OTP, but the `super_admin` role has not been bootstrapped yet.
  return {
    authorized: false,
    status: 403,
    reason:
      'Verified Platform Owner mobile (+918329306616), awaiting server-side super_admin role bootstrap.',
    isVerifiedOwnerPhone: true,
    requiresBootstrap: true,
    firebaseUid: verifiedUid,
    phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
  };
}

/**
 * Checks whether the verified Platform Owner account (`+918329306616`) has already
 * been provisioned with the `super_admin` role in `/admins/{uid}` or the server registry.
 *
 * Security Invariants (Requirement #7):
 * - Never trusts client-supplied role fields.
 * - Never grants administrator privileges based solely on a phone number match at login;
 *   initial Super Admin provisioning requires completing the server-side bootstrap at `/api/admin/bootstrap`.
 */
export async function resolveTrustedSuperAdminRole(params: {
  firebaseUid: string;
  phoneE164: string;
}): Promise<{
  isDesignatedOwner: boolean;
  isAuthorizedSuperAdmin: boolean;
  requiresBootstrap: boolean;
  adminRecord?: SuperAdminRecord;
}> {
  const canonicalPhone = normalizePhoneE164(params.phoneE164);
  const firebaseUid = (params.firebaseUid || '').trim();

  if (!firebaseUid || !isDesignatedOwnerPhone(canonicalPhone)) {
    return {
      isDesignatedOwner: false,
      isAuthorizedSuperAdmin: false,
      requiresBootstrap: false,
    };
  }

  if (process.env.SUPER_ADMIN_ROLE_REVOKED === 'true') {
    return {
      isDesignatedOwner: true,
      isAuthorizedSuperAdmin: false,
      requiresBootstrap: true,
    };
  }

  // 1. Check in-memory server registry
  const existingMemory = serverSuperAdminsRegistry.get(firebaseUid);
  if (existingMemory) {
    if (
      existingMemory.status === 'ACTIVE' &&
      existingMemory.role === 'super_admin'
    ) {
      return {
        isDesignatedOwner: true,
        isAuthorizedSuperAdmin: true,
        requiresBootstrap: false,
        adminRecord: existingMemory,
      };
    }
    return {
      isDesignatedOwner: true,
      isAuthorizedSuperAdmin: false,
      requiresBootstrap: true,
    };
  }

  // 2. Check Firestore `/admins/{firebaseUid}`
  try {
    const adminSnap = await getDoc(doc(db, 'admins', firebaseUid));
    if (adminSnap.exists()) {
      const data = adminSnap.data() as Partial<SuperAdminRecord>;
      if (
        data.role === 'super_admin' &&
        data.status === 'ACTIVE' &&
        isDesignatedOwnerPhone(data.phoneE164)
      ) {
        const rec: SuperAdminRecord = {
          uid: firebaseUid,
          phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
          displayName: data.displayName || DESIGNATED_SUPER_ADMIN_NAME,
          role: 'super_admin',
          status: 'ACTIVE',
          platform: DESIGNATED_PLATFORM_URL,
          grantedAt: data.grantedAt || new Date().toISOString(),
          grantedBy: data.grantedBy || 'SERVER_BOOTSTRAP',
          customClaimsSynced: Boolean(data.customClaimsSynced),
          lastVerifiedAt: new Date().toISOString(),
        };
        serverSuperAdminsRegistry.set(firebaseUid, rec);
        return {
          isDesignatedOwner: true,
          isAuthorizedSuperAdmin: true,
          requiresBootstrap: false,
          adminRecord: rec,
        };
      }
    }
  } catch {
    // Ignore Firestore lookup error
  }

  // 3. Not yet provisioned: require explicit server-side bootstrap at /api/admin/bootstrap
  // so a phone number match alone never automatically grants Super Admin privileges.
  return {
    isDesignatedOwner: true,
    isAuthorizedSuperAdmin: false,
    requiresBootstrap: true,
  };
}

/**
 * Executes the trusted server-side bootstrap to assign the `super_admin` role
 * exclusively to the verified owner (`+918329306616`).
 */
export async function bootstrapSuperAdminAccount(params: {
  firebaseUid: string;
  phoneE164: string;
  bootstrapSecret?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  adminRecord?: SuperAdminRecord;
  sessionToken?: string;
}> {
  const { firebaseUid, phoneE164, bootstrapSecret } = params;

  if (!firebaseUid || !isDesignatedOwnerPhone(phoneE164)) {
    return {
      ok: false,
      error:
        'Bootstrap rejected: Only the authenticated Platform Owner (+918329306616) can be assigned the super_admin role.',
    };
  }

  const configuredEnvSecret = process.env.SUPER_ADMIN_BOOTSTRAP_SECRET;
  if (
    configuredEnvSecret &&
    configuredEnvSecret.trim().length > 0 &&
    bootstrapSecret !== configuredEnvSecret.trim()
  ) {
    await recordAdminAuditLog({
      adminUid: firebaseUid,
      actionType: 'SUPER_ADMIN_BOOTSTRAP',
      targetEntityType: 'SYSTEM',
      targetEntityId: firebaseUid,
      status: 'FAILURE',
      reason: 'Invalid SUPER_ADMIN_BOOTSTRAP_SECRET provided during bootstrap.',
    });
    return {
      ok: false,
      error:
        'Invalid server bootstrap secret. Please enter the configured SUPER_ADMIN_BOOTSTRAP_SECRET.',
    };
  }

  // Attempt to sync Firebase Custom Claims via Application Default Credentials (if IAM allows)
  let customClaimsSynced = false;
  if (ensureAdminAppInitialized()) {
    try {
      await getAdminAuth().setCustomUserClaims(firebaseUid, {
        role: 'super_admin',
        super_admin: true,
        phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
      });
      customClaimsSynced = true;
    } catch {
      customClaimsSynced = false;
    }
  }

  const nowIso = new Date().toISOString();
  const adminRecord: SuperAdminRecord = {
    uid: firebaseUid,
    phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
    displayName: DESIGNATED_SUPER_ADMIN_NAME,
    role: 'super_admin',
    status: 'ACTIVE',
    platform: DESIGNATED_PLATFORM_URL,
    grantedAt: nowIso,
    grantedBy: 'SERVER_BOOTSTRAP',
    customClaimsSynced,
    lastVerifiedAt: nowIso,
  };

  serverSuperAdminsRegistry.set(firebaseUid, adminRecord);

  try {
    await setDoc(doc(db, 'admins', firebaseUid), adminRecord, { merge: true });
  } catch {
    // Client SDK write to /admins requires authenticated user token context;
    // serverSuperAdminsRegistry + HMAC session cookie + client-side authenticated sync handles persistence.
  }

  const sessionToken = createSignedSessionToken({
    userId: firebaseUid,
    firebaseUid,
    phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
    roles: ['BUYER', 'SELLER', 'ADMIN'],
    role: 'super_admin',
    superAdminAuthorized: true,
    iat: Date.now(),
  });

  await recordAdminAuditLog({
    adminUid: firebaseUid,
    actionType: 'SUPER_ADMIN_BOOTSTRAP',
    targetEntityType: 'SYSTEM',
    targetEntityId: firebaseUid,
    targetEntityName: `${DESIGNATED_SUPER_ADMIN_NAME} (${DESIGNATED_SUPER_ADMIN_PHONE})`,
    status: 'SUCCESS',
    reason:
      'Initial server-controlled super_admin role bootstrap completed for designated Platform Owner.',
    metadata: {
      customClaimsSynced,
      platform: DESIGNATED_PLATFORM_URL,
    },
  });

  return {
    ok: true,
    adminRecord,
    sessionToken,
  };
}

/**
 * Writes an immutable audit log entry for privileged Super Admin operations.
 * Never stores OTPs, passwords, tokens, or raw secrets.
 */
export async function recordAdminAuditLog(params: {
  adminUid: string;
  actionType: AdminActionType;
  targetEntityType: AdminAuditLogRecord['targetEntityType'];
  targetEntityId: string;
  targetEntityName?: string;
  status: 'SUCCESS' | 'FAILURE';
  reason: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<AdminAuditLogRecord> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();
  const cleanReason = params.reason.slice(0, 500);

  const record: AdminAuditLogRecord = {
    id,
    action: params.actionType,
    actorUid: params.adminUid,
    actorPhone: DESIGNATED_SUPER_ADMIN_PHONE,
    actorName: DESIGNATED_SUPER_ADMIN_NAME,
    actorRole: 'super_admin',
    targetType: params.targetEntityType,
    targetId: params.targetEntityId,
    targetLabel: params.targetEntityName,
    summary: cleanReason,
    createdAt: nowIso,
    adminUid: params.adminUid,
    adminDisplayName: DESIGNATED_SUPER_ADMIN_NAME,
    adminRole: 'super_admin',
    actionType: params.actionType,
    targetEntityType: params.targetEntityType,
    targetEntityId: params.targetEntityId,
    targetEntityName: params.targetEntityName,
    status: params.status,
    reason: cleanReason,
    metadata: params.metadata,
    timestamp: nowIso,
  };

  serverAuditLogsRegistry.set(id, record);

  try {
    await setDoc(doc(db, 'auditLogs', id), record);
  } catch {
    // Fallback to server memory registry if Firestore write requires client auth context
  }

  return record;
}

export async function getAdminAuditLogs(
  maxLimit: number = 100
): Promise<AdminAuditLogRecord[]> {
  const merged = new Map<string, AdminAuditLogRecord>();
  for (const [id, rec] of serverAuditLogsRegistry.entries()) {
    merged.set(id, rec);
  }

  try {
    const q = query(
      collection(db, 'auditLogs'),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const raw = docSnap.data() as Partial<AdminAuditLogRecord>;
      if (raw && raw.id) {
        const normalized: AdminAuditLogRecord = {
          id: raw.id,
          action: (raw.action || raw.actionType || 'SUPER_ADMIN_BOOTSTRAP') as AdminActionType,
          actorUid: raw.actorUid || raw.adminUid || '',
          actorPhone: raw.actorPhone || DESIGNATED_SUPER_ADMIN_PHONE,
          actorName: raw.actorName || raw.adminDisplayName || DESIGNATED_SUPER_ADMIN_NAME,
          actorRole: 'super_admin',
          targetType: (raw.targetType || raw.targetEntityType || 'SYSTEM') as AdminAuditLogRecord['targetType'],
          targetId: raw.targetId || raw.targetEntityId || '',
          targetLabel: raw.targetLabel || raw.targetEntityName,
          summary: raw.summary || raw.reason || '',
          createdAt: raw.createdAt || raw.timestamp || new Date().toISOString(),
          adminUid: raw.adminUid || raw.actorUid || '',
          adminDisplayName: raw.adminDisplayName || raw.actorName || DESIGNATED_SUPER_ADMIN_NAME,
          adminRole: 'super_admin',
          actionType: (raw.actionType || raw.action || 'SUPER_ADMIN_BOOTSTRAP') as AdminActionType,
          targetEntityType: (raw.targetEntityType || raw.targetType || 'SYSTEM') as AdminAuditLogRecord['targetEntityType'],
          targetEntityId: raw.targetEntityId || raw.targetId || '',
          targetEntityName: raw.targetEntityName || raw.targetLabel,
          status: raw.status || 'SUCCESS',
          reason: raw.reason || raw.summary || '',
          metadata: raw.metadata,
          timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
        };
        merged.set(normalized.id, normalized);
        serverAuditLogsRegistry.set(normalized.id, normalized);
      }
    });
  } catch {
    // Ignore Firestore read error if collection is empty
  }

  return Array.from(merged.values())
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, maxLimit);
}
