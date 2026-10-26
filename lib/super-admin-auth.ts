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
import { adminDb } from './firebase-admin';
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

export type AdminRole = 'super_admin' | 'admin';
export type AdminAuthorizationStatus = 'INVITED' | 'ACTIVE' | 'REVOKED';

export interface AdminAuthorizationRecord {
  id: string; // E.164 canonical phone number (e.g. +918329306616)
  phoneE164: string;
  name: string;
  designation: string;
  role: AdminRole;
  status: AdminAuthorizationStatus;
  isPermanentSuperAdmin: boolean;
  invitedByUid: string;
  invitedByPhone: string;
  invitedAt: string;
  activatedAt?: string;
  assignedUid?: string;
  lastLoginAt?: string;
  revokedAt?: string;
  revokedByUid?: string;
  revokedReason?: string;
  customClaimsSynced: boolean;
  updatedAt: string;
}

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
  | 'INVITE_ADMIN'
  | 'REVOKE_ADMIN'
  | 'REACTIVATE_ADMIN'
  | 'UPDATE_ADMIN'
  | 'ADMIN_ACTIVATED'
  | 'UNAUTHORIZED_ADMIN_MANAGEMENT_ATTEMPT'
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
  | 'REMOVE_DEMO_DATA'
  | 'UPDATE_SPONSORED_PRICING'
  | 'MODERATE_SPONSORED_CAMPAIGN'
  | 'APPROVE_PARTNER_APPLICATION'
  | 'REJECT_PARTNER_APPLICATION'
  | 'REQUEST_PARTNER_ADDITIONAL_INFO'
  | 'SUSPEND_PARTNER'
  | 'REACTIVATE_PARTNER'
  | 'DEACTIVATE_PARTNER'
  | 'REASSIGN_PARTNER_CITY'
  | 'GENERATE_PARTNER_SETTLEMENT'
  | 'APPROVE_PARTNER_SETTLEMENT'
  | 'RECORD_PARTNER_SETTLEMENT_PAYOUT';

export interface AdminAuditLogRecord {
  id: string;
  // Fields required by firestore.rules and SuperAdminDashboard
  action: AdminActionType;
  actorUid: string;
  actorPhone: string;
  actorName: string;
  actorRole: AdminRole;
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
    | 'ADMIN_USER'
    | 'SPONSORED_CAMPAIGN'
    | 'PARTNER'
    | 'PARTNER_APPLICATION'
    | 'PARTNER_SETTLEMENT'
    | 'SYSTEM';
  targetId: string;
  targetLabel?: string;
  summary: string;
  createdAt: string;
  // Backwards-compatible server fields
  adminUid: string;
  adminDisplayName: string;
  adminRole: AdminRole;
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
    | 'ADMIN_USER'
    | 'SPONSORED_CAMPAIGN'
    | 'PARTNER'
    | 'PARTNER_APPLICATION'
    | 'PARTNER_SETTLEMENT'
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
  var __serverAdminAuthorizationsRegistry:
    | Map<string, AdminAuthorizationRecord>
    | undefined;
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

if (!globalThis.__serverAdminAuthorizationsRegistry) {
  const reg = new Map<string, AdminAuthorizationRecord>();
  const nowIso = new Date().toISOString();
  reg.set(DESIGNATED_SUPER_ADMIN_PHONE, {
    id: DESIGNATED_SUPER_ADMIN_PHONE,
    phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
    name: DESIGNATED_SUPER_ADMIN_NAME,
    designation: 'Platform Owner',
    role: 'super_admin',
    status: 'ACTIVE',
    isPermanentSuperAdmin: true,
    invitedByUid: 'SYSTEM_BOOTSTRAP',
    invitedByPhone: 'SYSTEM',
    invitedAt: '2026-01-01T00:00:00.000Z',
    activatedAt: '2026-01-01T00:00:00.000Z',
    customClaimsSynced: true,
    updatedAt: nowIso,
  });
  globalThis.__serverAdminAuthorizationsRegistry = reg;
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

export const serverAdminAuthorizationsRegistry =
  globalThis.__serverAdminAuthorizationsRegistry!;
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

export async function getAuthoritativeSubscriptionPlansAsync(): Promise<
  Record<SubscriptionTierId, SubscriptionPlan>
> {
  try {
    const snap = await adminDb.doc('platformSettings/subscriptionPlans').get();
    if (snap.exists) {
      const data = snap.data() as Record<SubscriptionTierId, SubscriptionPlan>;
      if (data && data.FREE && data.GROWTH && data.BUSINESS_PRO) {
        globalThis.__serverSubscriptionPlansOverride = data;
        return data;
      }
    }
  } catch {
    try {
      const snap = await getDoc(
        doc(db, 'platformSettings', 'subscriptionPlans')
      );
      if (snap.exists()) {
        const data = snap.data() as Record<SubscriptionTierId, SubscriptionPlan>;
        if (data && data.FREE && data.GROWTH && data.BUSINESS_PRO) {
          globalThis.__serverSubscriptionPlansOverride = data;
          return data;
        }
      }
    } catch {
      // Memory fallback
    }
  }

  if (!globalThis.__serverSubscriptionPlansOverride) {
    globalThis.__serverSubscriptionPlansOverride = JSON.parse(
      JSON.stringify(SUBSCRIPTION_PLANS)
    );
  }
  return globalThis.__serverSubscriptionPlansOverride!;
}

export async function setAuthoritativeSubscriptionPlan(
  planId: SubscriptionTierId,
  updatedPlan: SubscriptionPlan
): Promise<void> {
  if (!globalThis.__serverSubscriptionPlansOverride) {
    globalThis.__serverSubscriptionPlansOverride = JSON.parse(
      JSON.stringify(SUBSCRIPTION_PLANS)
    );
  }
  const currentOverrides = globalThis.__serverSubscriptionPlansOverride!;
  currentOverrides[planId] = updatedPlan;

  try {
    await adminDb
      .doc('platformSettings/subscriptionPlans')
      .set(currentOverrides, { merge: true });
  } catch {
    try {
      await setDoc(
        doc(db, 'platformSettings', 'subscriptionPlans'),
        currentOverrides,
        { merge: true }
      );
    } catch {
      // Memory fallback
    }
  }
}

export function getAuthoritativePlatformSettings(): PlatformSettingsConfig {
  return (
    globalThis.__serverPlatformSettings || {
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
      updatedAt: new Date().toISOString(),
      updatedByUid: 'system-default',
      updatedBy: DESIGNATED_SUPER_ADMIN_PHONE,
    }
  );
}

export async function getAuthoritativePlatformSettingsAsync(): Promise<PlatformSettingsConfig> {
  try {
    const snap = await adminDb.doc('platformSettings/global').get();
    if (snap.exists) {
      globalThis.__serverPlatformSettings = {
        ...getAuthoritativePlatformSettings(),
        ...(snap.data() as PlatformSettingsConfig),
      };
    }
  } catch {
    try {
      const snap = await getDoc(doc(db, 'platformSettings', 'global'));
      if (snap.exists()) {
        globalThis.__serverPlatformSettings = {
          ...getAuthoritativePlatformSettings(),
          ...(snap.data() as PlatformSettingsConfig),
        };
      }
    } catch {
      // Memory fallback
    }
  }
  return getAuthoritativePlatformSettings();
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
  try {
    void adminDb.doc('platformSettings/global').set(updated, { merge: true });
  } catch {
    try {
      void setDoc(doc(db, 'platformSettings', 'global'), updated, { merge: true });
    } catch {
      // Memory fallback
    }
  }
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
  adminRole?: AdminRole;
  superAdminAuthorized?: boolean;
  adminAuthorized?: boolean;
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
  adminPhone?: string;
  adminName?: string;
  adminRole?: AdminRole;
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

  const actorRole: AdminRole = params.adminRole || 'super_admin';
  const actorPhone =
    params.adminPhone ||
    (actorRole === 'super_admin' ? DESIGNATED_SUPER_ADMIN_PHONE : '');
  const actorName =
    params.adminName ||
    (actorRole === 'super_admin'
      ? DESIGNATED_SUPER_ADMIN_NAME
      : 'Authorized Administrator');

  const record: AdminAuditLogRecord = {
    id,
    action: params.actionType,
    actorUid: params.adminUid,
    actorPhone,
    actorName,
    actorRole,
    targetType: params.targetEntityType,
    targetId: params.targetEntityId,
    targetLabel: params.targetEntityName,
    summary: cleanReason,
    createdAt: nowIso,
    adminUid: params.adminUid,
    adminDisplayName: actorName,
    adminRole: actorRole,
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
    await adminDb.doc(`auditLogs/${id}`).set(record);
  } catch {
    try {
      await setDoc(doc(db, 'auditLogs', id), record);
    } catch {
      // Fallback to server memory registry if Firestore write requires client auth context
    }
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
          actorRole: (raw.actorRole || raw.adminRole || 'super_admin') as AdminRole,
          targetType: (raw.targetType || raw.targetEntityType || 'SYSTEM') as AdminAuditLogRecord['targetType'],
          targetId: raw.targetId || raw.targetEntityId || '',
          targetLabel: raw.targetLabel || raw.targetEntityName,
          summary: raw.summary || raw.reason || '',
          createdAt: raw.createdAt || raw.timestamp || new Date().toISOString(),
          adminUid: raw.adminUid || raw.actorUid || '',
          adminDisplayName: raw.adminDisplayName || raw.actorName || DESIGNATED_SUPER_ADMIN_NAME,
          adminRole: (raw.adminRole || raw.actorRole || 'super_admin') as AdminRole,
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

// =============================================================================
// ADMIN AUTHORIZATION & GOVERNANCE SUBSYSTEM
// =============================================================================

/**
 * Returns all admin authorizations from in-memory registry and Firestore `/adminAuthorizations`.
 * Guarantees that the Platform Owner (+918329306616) is permanently registered as super_admin.
 */
export async function getAuthoritativeAdminAuthorizations(): Promise<
  AdminAuthorizationRecord[]
> {
  const map = new Map<string, AdminAuthorizationRecord>();

  // Ensure designated permanent super admin is always present
  const ownerRecord: AdminAuthorizationRecord = {
    id: DESIGNATED_SUPER_ADMIN_PHONE,
    phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
    name: DESIGNATED_SUPER_ADMIN_NAME,
    designation: 'Platform Owner',
    role: 'super_admin',
    status: 'ACTIVE',
    isPermanentSuperAdmin: true,
    invitedByUid: 'SYSTEM_BOOTSTRAP',
    invitedByPhone: 'SYSTEM',
    invitedAt: '2026-01-01T00:00:00.000Z',
    activatedAt: '2026-01-01T00:00:00.000Z',
    customClaimsSynced: true,
    updatedAt: new Date().toISOString(),
  };
  map.set(DESIGNATED_SUPER_ADMIN_PHONE, ownerRecord);
  serverAdminAuthorizationsRegistry.set(DESIGNATED_SUPER_ADMIN_PHONE, ownerRecord);

  // Load from memory
  for (const [phone, rec] of serverAdminAuthorizationsRegistry.entries()) {
    map.set(phone, rec);
  }

  // Load from Firestore
  try {
    const snap = await getDocs(collection(db, 'adminAuthorizations'));
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Partial<AdminAuthorizationRecord>;
      if (data && data.phoneE164) {
        const canonicalPhone = normalizePhoneE164(data.phoneE164);
        if (canonicalPhone) {
          const isOwner = canonicalPhone === DESIGNATED_SUPER_ADMIN_PHONE;
          const mergedRec: AdminAuthorizationRecord = {
            id: canonicalPhone,
            phoneE164: canonicalPhone,
            name: isOwner ? DESIGNATED_SUPER_ADMIN_NAME : data.name || 'Authorized Administrator',
            designation: isOwner ? 'Platform Owner' : data.designation || 'Administrator',
            role: isOwner ? 'super_admin' : data.role === 'super_admin' ? 'super_admin' : 'admin',
            status: isOwner ? 'ACTIVE' : data.status || 'ACTIVE',
            isPermanentSuperAdmin: isOwner,
            invitedByUid: data.invitedByUid || 'SYSTEM',
            invitedByPhone: data.invitedByPhone || DESIGNATED_SUPER_ADMIN_PHONE,
            invitedAt: data.invitedAt || new Date().toISOString(),
            activatedAt: data.activatedAt,
            assignedUid: data.assignedUid,
            lastLoginAt: data.lastLoginAt,
            revokedAt: isOwner ? undefined : data.revokedAt,
            revokedByUid: isOwner ? undefined : data.revokedByUid,
            revokedReason: isOwner ? undefined : data.revokedReason,
            customClaimsSynced: Boolean(data.customClaimsSynced),
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
          map.set(canonicalPhone, mergedRec);
          serverAdminAuthorizationsRegistry.set(canonicalPhone, mergedRec);
        }
      }
    });
  } catch {
    // Graceful fallback to memory registry if Firestore read fails
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isPermanentSuperAdmin) return -1;
    if (b.isPermanentSuperAdmin) return 1;
    return new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime();
  });
}

/**
 * Finds an admin authorization record by normalized phone number.
 */
export async function findAdminAuthorizationByPhone(
  phone?: string | null
): Promise<AdminAuthorizationRecord | null> {
  const canonical = normalizePhoneE164(phone);
  if (!canonical) return null;

  if (canonical === DESIGNATED_SUPER_ADMIN_PHONE) {
    const existing = serverAdminAuthorizationsRegistry.get(DESIGNATED_SUPER_ADMIN_PHONE);
    if (existing) return existing;
    return {
      id: DESIGNATED_SUPER_ADMIN_PHONE,
      phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
      name: DESIGNATED_SUPER_ADMIN_NAME,
      designation: 'Platform Owner',
      role: 'super_admin',
      status: 'ACTIVE',
      isPermanentSuperAdmin: true,
      invitedByUid: 'SYSTEM_BOOTSTRAP',
      invitedByPhone: 'SYSTEM',
      invitedAt: '2026-01-01T00:00:00.000Z',
      activatedAt: '2026-01-01T00:00:00.000Z',
      customClaimsSynced: true,
      updatedAt: new Date().toISOString(),
    };
  }

  const memory = serverAdminAuthorizationsRegistry.get(canonical);
  if (memory) return memory;

  try {
    const snap = await getDoc(doc(db, 'adminAuthorizations', canonical));
    if (snap.exists()) {
      const data = snap.data() as AdminAuthorizationRecord;
      serverAdminAuthorizationsRegistry.set(canonical, data);
      return data;
    }
  } catch {
    // Fallback
  }

  return null;
}

/**
 * Authorizes a new administrator using their mobile number.
 * Security Invariant: Only the Super Admin (+918329306616) can authorize administrators.
 */
export async function createAdminAuthorization(params: {
  callerAdminUid: string;
  callerPhone: string;
  phoneE164: string;
  name?: string;
  designation?: string;
  role?: AdminRole;
}): Promise<{ ok: boolean; error?: string; record?: AdminAuthorizationRecord }> {
  const callerPhone = normalizePhoneE164(params.callerPhone);
  if (!isDesignatedOwnerPhone(callerPhone)) {
    await recordAdminAuditLog({
      adminUid: params.callerAdminUid,
      adminPhone: callerPhone,
      adminRole: 'admin',
      actionType: 'UNAUTHORIZED_ADMIN_MANAGEMENT_ATTEMPT',
      targetEntityType: 'ADMIN_USER',
      targetEntityId: params.phoneE164,
      status: 'FAILURE',
      reason: 'Non-Super Admin attempted to authorize a new administrator.',
    });
    return {
      ok: false,
      error: 'Permission Denied: Only the Platform Owner Super Admin can authorize new administrators.',
    };
  }

  const canonicalTargetPhone = normalizePhoneE164(params.phoneE164);
  if (!canonicalTargetPhone || canonicalTargetPhone.length < 8) {
    return {
      ok: false,
      error: 'Please provide a valid mobile number with country code in E.164 format (e.g. +919876543210).',
    };
  }

  if (canonicalTargetPhone === DESIGNATED_SUPER_ADMIN_PHONE) {
    return {
      ok: false,
      error: 'The Platform Owner (+918329306616) is already permanently configured as Super Admin.',
    };
  }

  const existing = await findAdminAuthorizationByPhone(canonicalTargetPhone);
  if (existing) {
    if (existing.status === 'ACTIVE') {
      return {
        ok: false,
        error: `An active administrator with mobile number ${canonicalTargetPhone} already exists (${existing.name}).`,
      };
    }
    if (existing.status === 'INVITED') {
      return {
        ok: false,
        error: `An invitation for mobile number ${canonicalTargetPhone} is already pending activation.`,
      };
    }
  }

  const nowIso = new Date().toISOString();
  const assignedRole: AdminRole = params.role === 'super_admin' ? 'super_admin' : 'admin';
  const cleanName = (params.name || '').trim() || 'Authorized Administrator';
  const cleanDesignation = (params.designation || '').trim() || 'Administrator';

  const newRecord: AdminAuthorizationRecord = {
    id: canonicalTargetPhone,
    phoneE164: canonicalTargetPhone,
    name: cleanName,
    designation: cleanDesignation,
    role: assignedRole,
    status: 'INVITED',
    isPermanentSuperAdmin: false,
    invitedByUid: params.callerAdminUid,
    invitedByPhone: callerPhone,
    invitedAt: nowIso,
    customClaimsSynced: false,
    updatedAt: nowIso,
  };

  serverAdminAuthorizationsRegistry.set(canonicalTargetPhone, newRecord);

  try {
    await setDoc(doc(db, 'adminAuthorizations', canonicalTargetPhone), newRecord);
  } catch {
    // Client SDK / memory fallback
  }

  await recordAdminAuditLog({
    adminUid: params.callerAdminUid,
    adminPhone: callerPhone,
    adminRole: 'super_admin',
    actionType: 'INVITE_ADMIN',
    targetEntityType: 'ADMIN_USER',
    targetEntityId: canonicalTargetPhone,
    targetEntityName: `${cleanName} (${canonicalTargetPhone})`,
    status: 'SUCCESS',
    reason: `Authorized new ${assignedRole} via mobile number ${canonicalTargetPhone} (${cleanDesignation}).`,
    metadata: {
      phoneE164: canonicalTargetPhone,
      role: assignedRole,
      designation: cleanDesignation,
    },
  });

  return { ok: true, record: newRecord };
}

/**
 * Revokes an administrator's access.
 * Security Invariant: The Platform Owner (+918329306616) cannot be revoked under any circumstances.
 */
export async function revokeAdminAuthorization(params: {
  callerAdminUid: string;
  callerPhone: string;
  phoneE164: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string; record?: AdminAuthorizationRecord }> {
  const callerPhone = normalizePhoneE164(params.callerPhone);
  if (!isDesignatedOwnerPhone(callerPhone)) {
    return {
      ok: false,
      error: 'Permission Denied: Only the Platform Owner Super Admin can revoke administrators.',
    };
  }

  const canonicalTargetPhone = normalizePhoneE164(params.phoneE164);
  if (canonicalTargetPhone === DESIGNATED_SUPER_ADMIN_PHONE) {
    return {
      ok: false,
      error: 'Protected Invariant: The Platform Owner Super Admin (+918329306616) cannot be revoked, downgraded, or deleted.',
    };
  }

  const existing = await findAdminAuthorizationByPhone(canonicalTargetPhone);
  if (!existing) {
    return {
      ok: false,
      error: `No administrator authorization found for ${canonicalTargetPhone}.`,
    };
  }

  const nowIso = new Date().toISOString();
  const cleanReason = (params.reason || '').trim() || 'Access revoked by Platform Owner';

  const updatedRecord: AdminAuthorizationRecord = {
    ...existing,
    status: 'REVOKED',
    revokedAt: nowIso,
    revokedByUid: params.callerAdminUid,
    revokedReason: cleanReason,
    customClaimsSynced: false,
    updatedAt: nowIso,
  };

  serverAdminAuthorizationsRegistry.set(canonicalTargetPhone, updatedRecord);

  try {
    await setDoc(doc(db, 'adminAuthorizations', canonicalTargetPhone), updatedRecord, { merge: true });
  } catch {
    // Memory fallback
  }

  // Clear custom claims if Firebase Admin SDK is available and user has an assigned UID
  if (existing.assignedUid && ensureAdminAppInitialized()) {
    try {
      await getAdminAuth().setCustomUserClaims(existing.assignedUid, {
        role: null,
        admin: false,
        super_admin: false,
      });
    } catch {
      // Ignore claims error
    }
  }

  await recordAdminAuditLog({
    adminUid: params.callerAdminUid,
    adminPhone: callerPhone,
    adminRole: 'super_admin',
    actionType: 'REVOKE_ADMIN',
    targetEntityType: 'ADMIN_USER',
    targetEntityId: canonicalTargetPhone,
    targetEntityName: `${existing.name} (${canonicalTargetPhone})`,
    status: 'SUCCESS',
    reason: `Revoked administrator access for ${canonicalTargetPhone}: ${cleanReason}`,
    metadata: {
      phoneE164: canonicalTargetPhone,
      revokedReason: cleanReason,
    },
  });

  return { ok: true, record: updatedRecord };
}

/**
 * Reactivates a previously revoked administrator.
 */
export async function reactivateAdminAuthorization(params: {
  callerAdminUid: string;
  callerPhone: string;
  phoneE164: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string; record?: AdminAuthorizationRecord }> {
  const callerPhone = normalizePhoneE164(params.callerPhone);
  if (!isDesignatedOwnerPhone(callerPhone)) {
    return {
      ok: false,
      error: 'Permission Denied: Only the Platform Owner Super Admin can reactivate administrators.',
    };
  }

  const canonicalTargetPhone = normalizePhoneE164(params.phoneE164);
  const existing = await findAdminAuthorizationByPhone(canonicalTargetPhone);
  if (!existing) {
    return {
      ok: false,
      error: `No administrator authorization found for ${canonicalTargetPhone}.`,
    };
  }

  const nowIso = new Date().toISOString();
  const nextStatus: AdminAuthorizationStatus = existing.assignedUid ? 'ACTIVE' : 'INVITED';

  const updatedRecord: AdminAuthorizationRecord = {
    ...existing,
    status: nextStatus,
    revokedAt: undefined,
    revokedByUid: undefined,
    revokedReason: undefined,
    updatedAt: nowIso,
  };

  serverAdminAuthorizationsRegistry.set(canonicalTargetPhone, updatedRecord);

  try {
    await setDoc(doc(db, 'adminAuthorizations', canonicalTargetPhone), updatedRecord, { merge: true });
  } catch {
    // Memory fallback
  }

  // Restore custom claims if user already has assigned UID
  if (existing.assignedUid && ensureAdminAppInitialized()) {
    try {
      await getAdminAuth().setCustomUserClaims(existing.assignedUid, {
        role: existing.role,
        admin: true,
      });
      updatedRecord.customClaimsSynced = true;
    } catch {
      // Ignore
    }
  }

  await recordAdminAuditLog({
    adminUid: params.callerAdminUid,
    adminPhone: callerPhone,
    adminRole: 'super_admin',
    actionType: 'REACTIVATE_ADMIN',
    targetEntityType: 'ADMIN_USER',
    targetEntityId: canonicalTargetPhone,
    targetEntityName: `${existing.name} (${canonicalTargetPhone})`,
    status: 'SUCCESS',
    reason: `Reactivated administrator access for ${canonicalTargetPhone}.`,
  });

  return { ok: true, record: updatedRecord };
}

/**
 * Updates an administrator's profile (name, designation).
 */
export async function updateAdminAuthorization(params: {
  callerAdminUid: string;
  callerPhone: string;
  phoneE164: string;
  name?: string;
  designation?: string;
}): Promise<{ ok: boolean; error?: string; record?: AdminAuthorizationRecord }> {
  const callerPhone = normalizePhoneE164(params.callerPhone);
  if (!isDesignatedOwnerPhone(callerPhone)) {
    return {
      ok: false,
      error: 'Permission Denied: Only the Platform Owner Super Admin can edit administrator details.',
    };
  }

  const canonicalTargetPhone = normalizePhoneE164(params.phoneE164);
  const existing = await findAdminAuthorizationByPhone(canonicalTargetPhone);
  if (!existing) {
    return {
      ok: false,
      error: `No administrator authorization found for ${canonicalTargetPhone}.`,
    };
  }

  const nowIso = new Date().toISOString();
  const updatedRecord: AdminAuthorizationRecord = {
    ...existing,
    name: params.name !== undefined ? params.name.trim() || existing.name : existing.name,
    designation:
      params.designation !== undefined
        ? params.designation.trim() || existing.designation
        : existing.designation,
    updatedAt: nowIso,
  };

  serverAdminAuthorizationsRegistry.set(canonicalTargetPhone, updatedRecord);

  try {
    await setDoc(doc(db, 'adminAuthorizations', canonicalTargetPhone), updatedRecord, { merge: true });
  } catch {
    // Memory fallback
  }

  await recordAdminAuditLog({
    adminUid: params.callerAdminUid,
    adminPhone: callerPhone,
    adminRole: 'super_admin',
    actionType: 'UPDATE_ADMIN',
    targetEntityType: 'ADMIN_USER',
    targetEntityId: canonicalTargetPhone,
    targetEntityName: `${updatedRecord.name} (${canonicalTargetPhone})`,
    status: 'SUCCESS',
    reason: `Updated administrator metadata for ${canonicalTargetPhone}.`,
  });

  return { ok: true, record: updatedRecord };
}

export interface TrustedAdminRoleResolution {
  isDesignatedOwner: boolean;
  isAuthorizedSuperAdmin: boolean;
  isAuthorizedAdmin: boolean;
  adminRole?: AdminRole;
  requiresBootstrap: boolean;
  authorizationRecord?: AdminAuthorizationRecord;
  superAdminRecord?: SuperAdminRecord;
}

/**
 * Authoritatively resolves whether an authenticated phone number holds Super Admin
 * or additional Admin privileges.
 *
 * If an invited admin signs in via OTP, this function automatically activates their
 * authorization record from 'INVITED' to 'ACTIVE' and records an audit log.
 */
export async function resolveTrustedAdminRole(params: {
  firebaseUid: string;
  phoneE164: string;
}): Promise<TrustedAdminRoleResolution> {
  const canonicalPhone = normalizePhoneE164(params.phoneE164);
  const firebaseUid = (params.firebaseUid || '').trim();

  // 1. Designated Owner Platform Super Admin (+918329306616)
  if (isDesignatedOwnerPhone(canonicalPhone)) {
    const superAdminRes = await resolveTrustedSuperAdminRole({
      firebaseUid,
      phoneE164: canonicalPhone,
    });
    return {
      isDesignatedOwner: true,
      isAuthorizedSuperAdmin: superAdminRes.isAuthorizedSuperAdmin,
      isAuthorizedAdmin: superAdminRes.isAuthorizedSuperAdmin,
      adminRole: 'super_admin',
      requiresBootstrap: superAdminRes.requiresBootstrap,
      superAdminRecord: superAdminRes.adminRecord,
    };
  }

  // 2. Additional Authorized Administrators
  const authRecord = await findAdminAuthorizationByPhone(canonicalPhone);
  if (!authRecord) {
    return {
      isDesignatedOwner: false,
      isAuthorizedSuperAdmin: false,
      isAuthorizedAdmin: false,
      requiresBootstrap: false,
    };
  }

  if (authRecord.status === 'REVOKED') {
    return {
      isDesignatedOwner: false,
      isAuthorizedSuperAdmin: false,
      isAuthorizedAdmin: false,
      adminRole: undefined,
      requiresBootstrap: false,
      authorizationRecord: authRecord,
    };
  }

  const nowIso = new Date().toISOString();

  // If status is INVITED, automatically activate upon successful phone OTP verification!
  if (authRecord.status === 'INVITED') {
    const activated: AdminAuthorizationRecord = {
      ...authRecord,
      status: 'ACTIVE',
      activatedAt: nowIso,
      assignedUid: firebaseUid,
      lastLoginAt: nowIso,
      updatedAt: nowIso,
    };

    serverAdminAuthorizationsRegistry.set(canonicalPhone, activated);

    try {
      await setDoc(doc(db, 'adminAuthorizations', canonicalPhone), activated, { merge: true });
    } catch {
      // Memory fallback
    }

    if (firebaseUid && ensureAdminAppInitialized()) {
      try {
        await getAdminAuth().setCustomUserClaims(firebaseUid, {
          role: activated.role,
          admin: true,
        });
        activated.customClaimsSynced = true;
      } catch {
        // Claims fallback
      }
    }

    await recordAdminAuditLog({
      adminUid: firebaseUid,
      adminPhone: canonicalPhone,
      adminRole: activated.role,
      actionType: 'ADMIN_ACTIVATED',
      targetEntityType: 'ADMIN_USER',
      targetEntityId: canonicalPhone,
      targetEntityName: `${activated.name} (${canonicalPhone})`,
      status: 'SUCCESS',
      reason: `Invited administrator (${canonicalPhone}) successfully authenticated and activated admin access.`,
    });

    return {
      isDesignatedOwner: false,
      isAuthorizedSuperAdmin: activated.role === 'super_admin',
      isAuthorizedAdmin: true,
      adminRole: activated.role,
      requiresBootstrap: false,
      authorizationRecord: activated,
    };
  }

  // If already ACTIVE, update lastLoginAt and assignedUid
  if (authRecord.status === 'ACTIVE') {
    const updated: AdminAuthorizationRecord = {
      ...authRecord,
      assignedUid: authRecord.assignedUid || firebaseUid,
      lastLoginAt: nowIso,
      updatedAt: nowIso,
    };
    serverAdminAuthorizationsRegistry.set(canonicalPhone, updated);

    return {
      isDesignatedOwner: false,
      isAuthorizedSuperAdmin: authRecord.role === 'super_admin',
      isAuthorizedAdmin: true,
      adminRole: authRecord.role,
      requiresBootstrap: false,
      authorizationRecord: updated,
    };
  }

  return {
    isDesignatedOwner: false,
    isAuthorizedSuperAdmin: false,
    isAuthorizedAdmin: false,
    requiresBootstrap: false,
  };
}

export interface AdminAuthVerificationResult {
  authorized: boolean;
  status: 200 | 401 | 403;
  reason: string;
  isSuperAdmin: boolean;
  role: AdminRole;
  phoneE164: string;
  firebaseUid: string;
  requiresBootstrap?: boolean;
  authorizationRecord?: AdminAuthorizationRecord;
  superAdminRecord?: SuperAdminRecord;
}

/**
 * Verifies that an incoming HTTP request is from an authorized Administrator
 * (either the Platform Super Admin or an authorized Admin).
 */
export async function verifyAdminRequest(
  req: NextRequest
): Promise<AdminAuthVerificationResult> {
  const cookieToken = req.cookies.get('urbandirect_session')?.value;
  const sessionPayload = verifySignedSessionToken(cookieToken);

  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  let verifiedUid = sessionPayload?.firebaseUid || sessionPayload?.userId || '';
  let verifiedPhone = normalizePhoneE164(sessionPayload?.phoneE164);

  if (bearerToken) {
    const verifiedToken = await verifyFirebaseIdTokenCryptographically(bearerToken);
    if (verifiedToken) {
      verifiedUid = verifiedToken.uid;
      if (verifiedToken.phoneE164) {
        verifiedPhone = verifiedToken.phoneE164;
      }
    }
  }

  if (!verifiedUid || !verifiedPhone) {
    return {
      authorized: false,
      status: 401,
      reason: 'Authentication required. Please sign in with Firebase Phone Authentication.',
      isSuperAdmin: false,
      role: 'admin',
      phoneE164: '',
      firebaseUid: '',
    };
  }

  const resolution = await resolveTrustedAdminRole({
    firebaseUid: verifiedUid,
    phoneE164: verifiedPhone,
  });

  if (resolution.isDesignatedOwner && resolution.requiresBootstrap) {
    return {
      authorized: false,
      status: 403,
      reason: 'Verified Platform Owner mobile (+918329306616), awaiting server-side super_admin role bootstrap.',
      isSuperAdmin: false,
      role: 'super_admin',
      phoneE164: verifiedPhone,
      firebaseUid: verifiedUid,
      requiresBootstrap: true,
    };
  }

  if (resolution.isAuthorizedSuperAdmin) {
    return {
      authorized: true,
      status: 200,
      reason: 'Authorized as Platform Owner Super Admin.',
      isSuperAdmin: true,
      role: 'super_admin',
      phoneE164: verifiedPhone,
      firebaseUid: verifiedUid,
      superAdminRecord: resolution.superAdminRecord,
    };
  }

  if (resolution.isAuthorizedAdmin) {
    return {
      authorized: true,
      status: 200,
      reason: 'Authorized as Administrator.',
      isSuperAdmin: false,
      role: 'admin',
      phoneE164: verifiedPhone,
      firebaseUid: verifiedUid,
      authorizationRecord: resolution.authorizationRecord,
    };
  }

  return {
    authorized: false,
    status: 403,
    reason: 'Access Denied: Your mobile number is not authorized for administrator access.',
    isSuperAdmin: false,
    role: 'admin',
    phoneE164: verifiedPhone,
    firebaseUid: verifiedUid,
  };
}

export interface VerifiedCallerIdentity {
  authenticated: boolean;
  uid: string;
  phoneE164: string;
  sellerId?: string;
  storeIds?: string[];
  roles: string[];
}

/**
 * Verifies an authenticated user (Seller, Buyer, or Admin) from either the
 * cryptographically signed `urbandirect_session` cookie or a Firebase Bearer ID token.
 */
export async function verifyAuthenticatedCaller(
  req: NextRequest
): Promise<VerifiedCallerIdentity> {
  const cookieToken = req.cookies.get('urbandirect_session')?.value;
  const sessionPayload = verifySignedSessionToken(cookieToken);

  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  let uid = sessionPayload?.firebaseUid || sessionPayload?.userId || '';
  let phoneE164 = normalizePhoneE164(sessionPayload?.phoneE164);
  const sellerId = sessionPayload?.sellerId;
  let roles = Array.isArray(sessionPayload?.roles) ? sessionPayload.roles : [];

  if (bearerToken) {
    const verifiedToken = await verifyFirebaseIdTokenCryptographically(bearerToken);
    if (verifiedToken) {
      uid = verifiedToken.uid;
      if (verifiedToken.phoneE164) {
        phoneE164 = verifiedToken.phoneE164;
      }
      if (Array.isArray(verifiedToken.roles)) {
        roles = verifiedToken.roles;
      }
    }
  }

  return {
    authenticated: Boolean(uid && phoneE164),
    uid,
    phoneE164,
    sellerId,
    roles,
  };
}

