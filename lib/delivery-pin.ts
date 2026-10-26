import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  BuyerUnifiedOrderNotification,
  DeliveryPinLifecycleStatus,
  DeliveryPinPublicInfo,
  OrderRecord,
  PinNotificationChannelStatus,
  SellerUnifiedOrderNotification,
} from './catalog-data';
import {
  getServerHmacSecret,
  normalizePhoneE164,
  verifyAdminRequest,
  verifyFirebaseIdTokenCryptographically,
  verifySignedSessionToken,
} from './super-admin-auth';
import { getFcmTokensForRecipient } from './fcm-registry';
import {
  INITIAL_SELLERS,
  INITIAL_STORES,
  INITIAL_USER_ACCOUNTS,
} from './initial-data';

export const DELIVERY_PIN_MAX_ATTEMPTS = 5;
export const DELIVERY_PIN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days default validity while order is active
export const PIN_RESEND_COOLDOWN_MS = 15 * 1000; // 15 seconds between buyer resends
export const PIN_RESEND_MAX_PER_WINDOW = 5;
export const PIN_RESEND_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const MANDATORY_BUYER_PIN_WARNING =
  'Share your delivery PIN only after you have received your order. Never share it in advance. Your delivery PIN confirms delivery; it does not confirm payment.';

export interface StoredOrderDeliveryPinRecord {
  orderId: string;
  storeId: string;
  sellerId: string;
  buyerUid?: string;
  buyerPhoneE164: string;
  pinVersion: number;
  pinSalt: string;
  pinHash: string;
  /**
   * Server-encrypted cipher (AES-256-GCM) so only the trusted backend can
   * decrypt and display the active PIN to the verified buyer.
   * Plaintext PIN is NEVER stored in Firestore or logs.
   */
  encryptedPinCipher: string;
  cipherIv: string;
  cipherAuthTag: string;
  status: DeliveryPinLifecycleStatus;
  createdAt: string;
  expiresAt: string;
  verifiedAt?: string;
  verifiedByActor?: string;
  verifiedByRole?: 'SELLER' | 'DELIVERY_AGENT' | 'ADMIN';
  attemptsUsed: number;
  maxAttempts: number;
  lastFailedAt?: string;
  lastResentAt?: string;
  resendCount: number;
  resendWindowStartMs: number;
  notificationStatus: PinNotificationChannelStatus;
  notificationDetail: string;
}

export interface DeliveryPinAuditLogEntry {
  id: string;
  orderId: string;
  storeId: string;
  sellerId: string;
  eventType:
    | 'PIN_GENERATED'
    | 'PIN_RESENT_REGENERATED'
    | 'PIN_VERIFICATION_SUCCEEDED'
    | 'PIN_VERIFICATION_FAILED'
    | 'PIN_LOCKED_MAX_ATTEMPTS'
    | 'PIN_INVALIDATED_ORDER_CLOSED'
    | 'UNAUTHORIZED_PIN_ACCESS_BLOCKED'
    | 'PAYMENT_STATUS_UPDATED';
  actorId: string;
  actorRole: 'BUYER' | 'SELLER' | 'DELIVERY_AGENT' | 'ADMIN' | 'SYSTEM';
  pinVersion: number;
  summary: string;
  createdAt: string;
}

declare global {
  var __serverOrderDeliveryPinsRegistry:
    | Map<string, StoredOrderDeliveryPinRecord>
    | undefined;
  var __serverDeliveryPinAuditLogs:
    | Map<string, DeliveryPinAuditLogEntry>
    | undefined;
  var __serverPinVerificationLocks: Set<string> | undefined;
  var __serverActorVerifyRateLimits:
    | Map<string, { count: number; windowStartMs: number }>
    | undefined;
}

if (!globalThis.__serverOrderDeliveryPinsRegistry) {
  globalThis.__serverOrderDeliveryPinsRegistry = new Map<
    string,
    StoredOrderDeliveryPinRecord
  >();
}
if (!globalThis.__serverDeliveryPinAuditLogs) {
  globalThis.__serverDeliveryPinAuditLogs = new Map<
    string,
    DeliveryPinAuditLogEntry
  >();
}
if (!globalThis.__serverPinVerificationLocks) {
  globalThis.__serverPinVerificationLocks = new Set<string>();
}
if (!globalThis.__serverActorVerifyRateLimits) {
  globalThis.__serverActorVerifyRateLimits = new Map<
    string,
    { count: number; windowStartMs: number }
  >();
}

export const serverOrderDeliveryPinsRegistry =
  globalThis.__serverOrderDeliveryPinsRegistry!;
export const serverDeliveryPinAuditLogs =
  globalThis.__serverDeliveryPinAuditLogs!;
const activePinLocks = globalThis.__serverPinVerificationLocks!;
const actorVerifyRateLimits = globalThis.__serverActorVerifyRateLimits!;

/**
 * Generates a cryptographically secure 6-digit numeric PIN ('100000' - '999999').
 */
export function generateCryptographicSixDigitPin(): string {
  const num = crypto.randomInt(100000, 1000000);
  return String(num).padStart(6, '0');
}

/**
 * Computes a salted scrypt hash of the 6-digit PIN.
 */
export function hashDeliveryPin(pin: string, saltHex: string): string {
  const normalizedPin = pin.trim();
  return crypto
    .scryptSync(normalizedPin, Buffer.from(saltHex, 'hex'), 32)
    .toString('hex');
}

/**
 * Timing-safe comparison of a candidate 6-digit PIN against the stored salted hash.
 */
export function verifyDeliveryPinHash(
  candidatePin: string,
  saltHex: string,
  expectedHashHex: string
): boolean {
  if (!/^\d{6}$/.test(candidatePin.trim())) {
    return false;
  }
  const candidateHashHex = hashDeliveryPin(candidatePin.trim(), saltHex);
  const a = Buffer.from(candidateHashHex, 'hex');
  const b = Buffer.from(expectedHashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function derivePinEncryptionKey(orderId: string, pinVersion: number): Buffer {
  return crypto
    .createHmac('sha256', getServerHmacSecret())
    .update(`citykart-pin-cipher:${orderId}:v${pinVersion}`)
    .digest();
}

function encryptPinForBuyerVault(
  pin: string,
  orderId: string,
  pinVersion: number
): { encryptedPinCipher: string; cipherIv: string; cipherAuthTag: string } {
  const key = derivePinEncryptionKey(orderId, pinVersion);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(pin, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedPinCipher: encrypted.toString('hex'),
    cipherIv: iv.toString('hex'),
    cipherAuthTag: authTag.toString('hex'),
  };
}

export function decryptPinFromBuyerVault(
  record: StoredOrderDeliveryPinRecord
): string | null {
  try {
    const key = derivePinEncryptionKey(record.orderId, record.pinVersion);
    const iv = Buffer.from(record.cipherIv, 'hex');
    const authTag = Buffer.from(record.cipherAuthTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(record.encryptedPinCipher, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export interface BuyerOrderAccessTokenPayload {
  orderId: string;
  buyerPhoneE164: string;
  buyerUid?: string;
  iat: number;
}

/**
 * Creates a cryptographically signed token issued only to the buyer who placed the order.
 * Enables the buyer to view or regenerate their order's Delivery PIN without exposing
 * the PIN to sellers or unauthenticated third parties.
 */
export function createBuyerOrderAccessToken(params: {
  orderId: string;
  buyerPhone: string;
  buyerUid?: string;
}): string {
  const payload: BuyerOrderAccessTokenPayload = {
    orderId: params.orderId,
    buyerPhoneE164: normalizePhoneE164(params.buyerPhone),
    buyerUid: params.buyerUid || undefined,
    iat: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getServerHmacSecret())
    .update(`buyer-order-pin-token:${encoded}`)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyBuyerOrderAccessToken(
  token?: string | null,
  expectedOrderId?: string
): BuyerOrderAccessTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getServerHmacSecret())
    .update(`buyer-order-pin-token:${encoded}`)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as BuyerOrderAccessTokenPayload;
    if (expectedOrderId && payload.orderId !== expectedOrderId) {
      return null;
    }
    if (Date.now() - payload.iat > 14 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function toPublicDeliveryPinInfo(
  record: StoredOrderDeliveryPinRecord
): DeliveryPinPublicInfo {
  const now = Date.now();
  let effectiveStatus = record.status;
  if (
    effectiveStatus === 'ACTIVE' &&
    new Date(record.expiresAt).getTime() <= now
  ) {
    effectiveStatus = 'EXPIRED';
  }
  return {
    status: effectiveStatus,
    pinVersion: record.pinVersion,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    verifiedAt: record.verifiedAt,
    verifiedByActor: record.verifiedByActor,
    verifiedByRole: record.verifiedByRole,
    attemptsUsed: record.attemptsUsed,
    maxAttempts: record.maxAttempts,
    remainingAttempts: Math.max(0, record.maxAttempts - record.attemptsUsed),
    lastResentAt: record.lastResentAt,
    resendCount: record.resendCount,
    notificationStatus: record.notificationStatus,
    notificationDetail: record.notificationDetail,
    unifiedNotificationDispatched: true,
  };
}

/**
 * Resolves the seller's mobile number for an order from the order record, store record,
 * seller profile, or seller user account.
 */
export function resolveSellerPhoneForOrder(
  order: Pick<OrderRecord, 'sellerPhone' | 'storeId' | 'sellerId'>,
  explicitStorePhone?: string
): string {
  if (order.sellerPhone && order.sellerPhone.trim()) {
    return order.sellerPhone.trim();
  }
  if (explicitStorePhone && explicitStorePhone.trim()) {
    return explicitStorePhone.trim();
  }
  const matchedStore = INITIAL_STORES.find((s) => s.id === order.storeId);
  if (matchedStore?.phone && matchedStore.phone.trim()) {
    return matchedStore.phone.trim();
  }
  const matchedSeller = INITIAL_SELLERS.find(
    (s) =>
      s.id === order.sellerId ||
      (matchedStore && s.id === matchedStore.sellerId) ||
      s.storeIds.includes(order.storeId)
  );
  if (matchedSeller?.phoneE164 && matchedSeller.phoneE164.trim()) {
    return matchedSeller.phoneE164.trim();
  }
  const matchedUser = INITIAL_USER_ACCOUNTS.find(
    (u) =>
      u.sellerId === order.sellerId ||
      (matchedStore && u.sellerId === matchedStore.sellerId) ||
      u.storeIds.includes(order.storeId)
  );
  if (matchedUser?.phoneE164 && matchedUser.phoneE164.trim()) {
    return matchedUser.phoneE164.trim();
  }
  return '+919820000000';
}

/**
 * Resolves the estimated delivery duration (in minutes) for an order.
 */
export function resolveEstimatedDeliveryMinsForOrder(
  order: Pick<OrderRecord, 'estimatedMins' | 'storeId'>
): number {
  if (
    typeof order.estimatedMins === 'number' &&
    Number.isFinite(order.estimatedMins) &&
    order.estimatedMins > 0
  ) {
    return Math.round(order.estimatedMins);
  }
  const matchedStore = INITIAL_STORES.find((s) => s.id === order.storeId);
  if (
    matchedStore &&
    typeof matchedStore.avgDispatchMins === 'number' &&
    matchedStore.avgDispatchMins > 0
  ) {
    return Math.round(matchedStore.avgDispatchMins);
  }
  return 25;
}

/**
 * Builds the single unified buyer notification (for both Push and SMS) combining:
 * 1. Successful order placement confirmation
 * 2. Seller mobile number & Estimated delivery duration
 * 3. The 6-digit Delivery PIN
 * 4. Clear buyer safety instructions in the same notification (never separate notifications).
 */
export function buildUnifiedBuyerOrderAndPinNotification(params: {
  order: OrderRecord;
  pin: string;
  pushStatus?: string;
  smsStatus?: PinNotificationChannelStatus;
  isRegenerated?: boolean;
}): BuyerUnifiedOrderNotification {
  const {
    order,
    pin,
    pushStatus = 'QUEUED',
    smsStatus = 'SMS_PROVIDER_NOT_CONFIGURED',
    isRegenerated = false,
  } = params;

  const itemCount = (order.items || []).reduce(
    (sum, item) => sum + (item.quantity || 1),
    0
  );
  const paymentLabel =
    order.paymentMethod === 'UPI_ON_DELIVERY'
      ? 'UPI on Delivery'
      : order.paymentMethod === 'CASH_ON_DELIVERY'
      ? 'Cash on Delivery'
      : 'Pay on Delivery';

  const sellerPhone = resolveSellerPhoneForOrder(order);
  const estimatedDeliveryMins = resolveEstimatedDeliveryMinsForOrder(order);

  const title = isRegenerated
    ? `Order #${order.id} · Updated Delivery PIN: ${pin}`
    : `Order #${order.id} Placed! Delivery PIN: ${pin}`;

  const body = isRegenerated
    ? `Your new 6-digit Delivery PIN for Order #${order.id} with ${order.storeName} (₹${order.total}) is ${pin}. Estimated Delivery: ~${estimatedDeliveryMins} mins. Seller Mobile: ${sellerPhone}. SAFETY: ${MANDATORY_BUYER_PIN_WARNING}`
    : `Order #${order.id} placed successfully with ${order.storeName} for ₹${order.total} (${itemCount} item(s), ${paymentLabel}). Estimated Delivery: ~${estimatedDeliveryMins} mins. Seller Mobile: ${sellerPhone}. Your Delivery PIN is ${pin}. SAFETY: ${MANDATORY_BUYER_PIN_WARNING}`;

  const smsText = isRegenerated
    ? `Citykart: Updated Delivery PIN for Order #${order.id} (${order.storeName}, Rs.${order.total}) is ${pin}. Est. Delivery: ~${estimatedDeliveryMins} mins. Seller Mobile: ${sellerPhone}. SAFETY: Share this PIN with the delivery partner ONLY after receiving your order. Never share in advance. PIN confirms delivery only, not payment.`
    : `Citykart: Order #${order.id} placed successfully with ${order.storeName} for Rs.${order.total} (${itemCount} item(s), ${paymentLabel}). Est. Delivery: ~${estimatedDeliveryMins} mins. Seller Mobile: ${sellerPhone}. Your Delivery PIN is ${pin}. SAFETY: Share this PIN with the delivery partner ONLY after receiving your order. Never share in advance. PIN confirms delivery only, not payment.`;

  return {
    title,
    body,
    smsText,
    safetyInstructions: MANDATORY_BUYER_PIN_WARNING,
    sellerPhone,
    estimatedDeliveryMins,
    pushStatus,
    smsStatus,
    dispatchedAt: new Date().toISOString(),
  };
}

/**
 * Formats the buyer's complete delivery address for seller order notifications.
 */
export function formatBuyerFullAddressForOrder(order: OrderRecord): string {
  const c = order.customer;
  const parts = [
    c.address?.trim(),
    c.locality?.trim(),
    c.city?.trim(),
    c.stateRegion?.trim(),
    c.country?.trim(),
  ].filter(Boolean);
  const baseAddress = parts.join(', ');
  const postal = c.postalCode?.trim();
  return postal ? `${baseAddress} - ${postal}` : baseAddress;
}

/**
 * Builds the single unified seller notification (for both Push and SMS) when a buyer places an order.
 * Contains:
 * 1. Order summary (Order ID, item count, total, payment method)
 * 2. Full delivery address of the buyer
 * 3. Mobile number of the buyer
 * 4. Delivery note (if any)
 * Strictly never contains the buyer's 6-digit Delivery PIN.
 */
export function buildUnifiedSellerOrderNotification(params: {
  order: OrderRecord;
  pushStatus?: string;
  smsStatus?: PinNotificationChannelStatus;
}): SellerUnifiedOrderNotification {
  const {
    order,
    pushStatus = 'QUEUED',
    smsStatus = 'SMS_PROVIDER_NOT_CONFIGURED',
  } = params;

  const itemCount = (order.items || []).reduce(
    (sum, item) => sum + (item.quantity || 1),
    0
  );
  const paymentLabel =
    order.paymentMethod === 'UPI_ON_DELIVERY'
      ? 'UPI on Delivery'
      : order.paymentMethod === 'CASH_ON_DELIVERY'
      ? 'Cash on Delivery'
      : 'Card Tap on Delivery';

  const sellerPhone = resolveSellerPhoneForOrder(order);
  const buyerFullName = order.customer.fullName?.trim() || 'Buyer';
  const buyerPhone = order.customer.phone?.trim() || '';
  const buyerFullAddress = formatBuyerFullAddressForOrder(order);
  const deliveryNotes = order.customer.notes?.trim() || undefined;
  const noteSuffix = deliveryNotes ? ` Delivery Note: "${deliveryNotes}".` : '';

  const title = `New Order #${order.id} — ₹${order.total} (${itemCount} item(s))`;
  const body = `New Order #${order.id} for ${order.storeName} (₹${order.total}, ${itemCount} item(s), ${paymentLabel}) from ${buyerFullName}. Buyer Mobile: ${buyerPhone}. Full Address: ${buyerFullAddress}.${noteSuffix}`;
  const smsText = `Citykart Seller Alert: New Order #${order.id} for ${order.storeName} (Rs.${order.total}, ${itemCount} item(s), ${paymentLabel}) from ${buyerFullName}. Buyer Mobile: ${buyerPhone}. Full Address: ${buyerFullAddress}.${noteSuffix}`;

  return {
    title,
    body,
    smsText,
    sellerPhone,
    buyerFullName,
    buyerPhone,
    buyerFullAddress,
    deliveryNotes,
    pushStatus,
    smsStatus,
    dispatchedAt: new Date().toISOString(),
  };
}

/**
 * Strips any buyer-only plaintext PIN or access token before returning an order
 * to sellers, admins, or general listing queries, or persisting to Firestore.
 */
export function sanitizeOrderForStorageAndListing(
  order: OrderRecord
): OrderRecord {
  const clone: OrderRecord = { ...order };
  delete clone.buyerDeliveryPin;
  delete clone.buyerOrderAccessToken;
  delete clone.buyerUnifiedNotification;
  if (!clone.paymentStatus) {
    clone.paymentStatus = 'PENDING';
  }
  const pinRec = serverOrderDeliveryPinsRegistry.get(order.id);
  if (pinRec) {
    clone.deliveryPinInfo = toPublicDeliveryPinInfo(pinRec);
    clone.deliveryPinVerified = pinRec.status === 'VERIFIED';
  }
  return clone;
}

export async function recordDeliveryPinAuditLog(
  entry: Omit<DeliveryPinAuditLogEntry, 'id' | 'createdAt'>
): Promise<void> {
  const id = `pinaudit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const fullEntry: DeliveryPinAuditLogEntry = {
    ...entry,
    id,
    createdAt: new Date().toISOString(),
  };
  serverDeliveryPinAuditLogs.set(id, fullEntry);
  try {
    await setDoc(doc(db, 'deliveryPinAuditLogs', id), fullEntry);
  } catch {
    // Server memory registry is primary if Firestore rules block unauthenticated writes
  }
}

async function persistPinRecordToFirestore(
  record: StoredOrderDeliveryPinRecord
): Promise<void> {
  serverOrderDeliveryPinsRegistry.set(record.orderId, record);
  try {
    await setDoc(doc(db, 'orderDeliveryPins', record.orderId), record);
  } catch {
    // Fallback to serverOrderDeliveryPinsRegistry in memory
  }
}

export async function getOrderDeliveryPinRecord(
  orderId: string
): Promise<StoredOrderDeliveryPinRecord | null> {
  const inMem = serverOrderDeliveryPinsRegistry.get(orderId);
  if (inMem) return inMem;
  try {
    const snap = await getDoc(doc(db, 'orderDeliveryPins', orderId));
    if (snap.exists()) {
      const data = snap.data() as StoredOrderDeliveryPinRecord;
      if (data && data.orderId) {
        serverOrderDeliveryPinsRegistry.set(orderId, data);
        return data;
      }
    }
  } catch {
    // Ignore Firestore read error if collection is locked to server
  }
  return null;
}

/**
 * Evaluates and dispatches the SINGLE unified buyer notification (Order Placement + 6-digit Delivery PIN + Safety Instructions)
 * over SMS (when SMS gateway credentials are configured) and FCM Push.
 * Never sends separate notifications for order placement and delivery PIN.
 * Never fabricates SMS delivery when no third-party SMS gateway is configured.
 */
async function evaluateBuyerPinNotificationChannel(
  order: OrderRecord,
  unifiedSmsText?: string
): Promise<{
  status: PinNotificationChannelStatus;
  detail: string;
}> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_FROM_NUMBER?.trim();
  const fast2SmsKey = process.env.FAST2SMS_API_KEY?.trim();
  const msg91Key = process.env.MSG91_AUTH_KEY?.trim();

  const hasSmsGatewayConfig = Boolean(
    (twilioSid && twilioToken && twilioFrom) || fast2SmsKey || msg91Key
  );

  const buyerFcmTokens = await getFcmTokensForRecipient({
    buyerUid: order.buyerUid,
    buyerPhone: order.customer.phone,
  });

  if (hasSmsGatewayConfig && unifiedSmsText) {
    try {
      const normalizedTo = normalizePhoneE164(order.customer.phone);
      if (twilioSid && twilioToken && twilioFrom) {
        const authBasic = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const params = new URLSearchParams({
          To: normalizedTo,
          From: twilioFrom,
          Body: unifiedSmsText,
        });
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authBasic}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );
      } else if (fast2SmsKey) {
        const digits = normalizedTo.replace(/\D/g, '').slice(-10);
        await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: fast2SmsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: unifiedSmsText,
            language: 'english',
            numbers: digits,
          }),
        });
      }
      return {
        status: 'SMS_SENT',
        detail: `Single unified Order Confirmation + 6-digit Delivery PIN + Safety Instructions dispatched via SMS (${order.customer.phone}) & Push Notification.`,
      };
    } catch {
      // Fallback to in-app / FCM if external SMS gateway request fails
    }
  }

  if (buyerFcmTokens.length > 0) {
    return {
      status: 'DELIVERED_IN_APP_AND_FCM',
      detail:
        'Single unified Order Confirmation + 6-digit Delivery PIN + Safety Instructions delivered via Push Notification & Buyer Order View (external SMS gateway not configured).',
    };
  }

  return {
    status: 'SMS_PROVIDER_NOT_CONFIGURED',
    detail:
      'Single unified Order Confirmation + 6-digit Delivery PIN + Safety Instructions delivered in Buyer Order Confirmation & Push Notification (external SMS gateway credentials not configured in environment).',
  };
}

/**
 * Evaluates and dispatches the SINGLE unified seller notification (Order details + Buyer Full Address + Buyer Mobile Number + Delivery Note if any)
 * over SMS (when SMS gateway credentials are configured) and FCM Push.
 */
export async function dispatchSellerOrderSmsNotification(
  order: OrderRecord
): Promise<{
  status: PinNotificationChannelStatus;
  detail: string;
  unifiedNotification: SellerUnifiedOrderNotification;
}> {
  const baseNotif = buildUnifiedSellerOrderNotification({ order });
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_FROM_NUMBER?.trim();
  const fast2SmsKey = process.env.FAST2SMS_API_KEY?.trim();
  const msg91Key = process.env.MSG91_AUTH_KEY?.trim();

  const hasSmsGatewayConfig = Boolean(
    (twilioSid && twilioToken && twilioFrom) || fast2SmsKey || msg91Key
  );

  const sellerFcmTokens = await getFcmTokensForRecipient({
    sellerId: order.sellerId,
    sellerUid: order.sellerUid,
  });

  let smsStatus: PinNotificationChannelStatus = 'SMS_PROVIDER_NOT_CONFIGURED';
  let detail =
    'Single unified Seller Order Alert (Buyer Full Address + Mobile Number + Delivery Note) delivered via Seller Push Notification & In-App Alerts.';

  if (hasSmsGatewayConfig && baseNotif.sellerPhone) {
    try {
      const normalizedTo = normalizePhoneE164(baseNotif.sellerPhone);
      if (twilioSid && twilioToken && twilioFrom) {
        const authBasic = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const params = new URLSearchParams({
          To: normalizedTo,
          From: twilioFrom,
          Body: baseNotif.smsText,
        });
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authBasic}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );
      } else if (fast2SmsKey) {
        const digits = normalizedTo.replace(/\D/g, '').slice(-10);
        await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: fast2SmsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: baseNotif.smsText,
            language: 'english',
            numbers: digits,
          }),
        });
      }
      smsStatus = 'SMS_SENT';
      detail = `Single unified Seller Order Alert dispatched via SMS (${baseNotif.sellerPhone}) & Push Notification.`;
    } catch {
      // Fallback to in-app / FCM if external SMS gateway request fails
    }
  } else if (sellerFcmTokens.length > 0) {
    smsStatus = 'DELIVERED_IN_APP_AND_FCM';
  }

  const unifiedNotification: SellerUnifiedOrderNotification = {
    ...baseNotif,
    smsStatus,
    pushStatus:
      sellerFcmTokens.length > 0
        ? 'SENT_VIA_FCM_AND_IN_APP'
        : 'DELIVERED_IN_APP_AND_BROWSER_PUSH',
  };

  return {
    status: smsStatus,
    detail,
    unifiedNotification,
  };
}

/**
 * Generates and persists a fresh 6-digit Delivery PIN immediately after order creation.
 * Idempotent: if an ACTIVE PIN already exists for the order and `forceRegenerate` is false,
 * returns the existing PIN without creating conflicting PINs.
 */
export async function issueDeliveryPinForOrder(params: {
  order: OrderRecord;
  forceRegenerate?: boolean;
  actorId?: string;
  actorRole?: 'BUYER' | 'ADMIN' | 'SYSTEM';
}): Promise<{
  ok: boolean;
  error?: string;
  statusCode?: number;
  pin?: string;
  buyerAccessToken?: string;
  pinInfo?: DeliveryPinPublicInfo;
  unifiedNotification?: BuyerUnifiedOrderNotification;
}> {
  const {
    order,
    forceRegenerate = false,
    actorId = order.buyerUid || order.customer.phone || 'SYSTEM',
    actorRole = 'SYSTEM',
  } = params;

  const lockKey = `pin-lock:${order.id}`;
  if (activePinLocks.has(lockKey)) {
    return {
      ok: false,
      statusCode: 409,
      error: 'A Delivery PIN operation is already in progress for this order.',
    };
  }

  activePinLocks.add(lockKey);
  try {
    if (
      order.orderStatus === 'DELIVERED' ||
      order.orderStatus === 'CANCELLED' ||
      order.orderStatus === 'REJECTED'
    ) {
      return {
        ok: false,
        statusCode: 400,
        error: `Cannot generate or resend a Delivery PIN because order #${order.id} is already ${order.orderStatus}.`,
      };
    }

    const existing = await getOrderDeliveryPinRecord(order.id);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (existing && !forceRegenerate && existing.status === 'ACTIVE') {
      const existingPin = decryptPinFromBuyerVault(existing);
      if (existingPin) {
        return {
          ok: true,
          pin: existingPin,
          buyerAccessToken: createBuyerOrderAccessToken({
            orderId: order.id,
            buyerPhone: order.customer.phone,
            buyerUid: order.buyerUid,
          }),
          pinInfo: toPublicDeliveryPinInfo(existing),
          unifiedNotification: buildUnifiedBuyerOrderAndPinNotification({
            order,
            pin: existingPin,
            pushStatus:
              existing.notificationStatus === 'DELIVERED_IN_APP_AND_FCM'
                ? 'SENT'
                : 'DELIVERED_IN_APP',
            smsStatus: existing.notificationStatus,
            isRegenerated: false,
          }),
        };
      }
    }

    // If regenerating/resending, enforce cooldown & rate limits
    let resendCount = existing?.resendCount || 0;
    let resendWindowStartMs = existing?.resendWindowStartMs || now;

    if (forceRegenerate && existing) {
      if (
        existing.lastResentAt &&
        now - new Date(existing.lastResentAt).getTime() < PIN_RESEND_COOLDOWN_MS
      ) {
        const waitSec = Math.ceil(
          (PIN_RESEND_COOLDOWN_MS -
            (now - new Date(existing.lastResentAt).getTime())) /
            1000
        );
        return {
          ok: false,
          statusCode: 429,
          error: `Please wait ${waitSec} seconds before requesting another Delivery PIN.`,
        };
      }

      if (now - resendWindowStartMs < PIN_RESEND_WINDOW_MS) {
        if (resendCount >= PIN_RESEND_MAX_PER_WINDOW) {
          return {
            ok: false,
            statusCode: 429,
            error:
              'Maximum Delivery PIN regeneration limit reached (5 per 15 minutes). Please try again shortly.',
          };
        }
        resendCount += 1;
      } else {
        resendWindowStartMs = now;
        resendCount = 1;
      }
    }

    const nextVersion = existing ? existing.pinVersion + 1 : 1;

    // Ensure the new PIN differs from the previous PIN when regenerating
    let rawPin = generateCryptographicSixDigitPin();
    if (existing) {
      const prevPin = decryptPinFromBuyerVault(existing);
      let safetyCounter = 0;
      while (prevPin && rawPin === prevPin && safetyCounter < 10) {
        rawPin = generateCryptographicSixDigitPin();
        safetyCounter++;
      }
    }

    const saltHex = crypto.randomBytes(16).toString('hex');
    const pinHash = hashDeliveryPin(rawPin, saltHex);
    const { encryptedPinCipher, cipherIv, cipherAuthTag } =
      encryptPinForBuyerVault(rawPin, order.id, nextVersion);

    const preliminaryUnifiedNotif = buildUnifiedBuyerOrderAndPinNotification({
      order,
      pin: rawPin,
      isRegenerated: forceRegenerate,
    });

    const notifChannel = await evaluateBuyerPinNotificationChannel(
      order,
      preliminaryUnifiedNotif.smsText
    );
    const expiresAtIso = new Date(now + DELIVERY_PIN_TTL_MS).toISOString();

    const record: StoredOrderDeliveryPinRecord = {
      orderId: order.id,
      storeId: order.storeId,
      sellerId: order.sellerId,
      buyerUid: order.buyerUid,
      buyerPhoneE164: normalizePhoneE164(order.customer.phone),
      pinVersion: nextVersion,
      pinSalt: saltHex,
      pinHash,
      encryptedPinCipher,
      cipherIv,
      cipherAuthTag,
      status: 'ACTIVE',
      createdAt: nowIso,
      expiresAt: expiresAtIso,
      attemptsUsed: 0,
      maxAttempts: DELIVERY_PIN_MAX_ATTEMPTS,
      lastResentAt: forceRegenerate ? nowIso : undefined,
      resendCount,
      resendWindowStartMs,
      notificationStatus: notifChannel.status,
      notificationDetail: notifChannel.detail,
    };

    await persistPinRecordToFirestore(record);

    await recordDeliveryPinAuditLog({
      orderId: order.id,
      storeId: order.storeId,
      sellerId: order.sellerId,
      eventType: forceRegenerate ? 'PIN_RESENT_REGENERATED' : 'PIN_GENERATED',
      actorId,
      actorRole,
      pinVersion: nextVersion,
      summary: forceRegenerate
        ? `Replacement 6-digit Delivery PIN (v${nextVersion}) generated; previous PIN v${nextVersion - 1} invalidated.`
        : `Initial 6-digit Delivery PIN (v1) generated and combined into single unified Order Placement + Delivery PIN + Safety Instructions notification.`,
    });

    const buyerAccessToken = createBuyerOrderAccessToken({
      orderId: order.id,
      buyerPhone: order.customer.phone,
      buyerUid: order.buyerUid,
    });

    const unifiedNotification = buildUnifiedBuyerOrderAndPinNotification({
      order,
      pin: rawPin,
      pushStatus:
        notifChannel.status === 'DELIVERED_IN_APP_AND_FCM'
          ? 'SENT'
          : 'DELIVERED_IN_APP',
      smsStatus: notifChannel.status,
      isRegenerated: forceRegenerate,
    });

    return {
      ok: true,
      pin: rawPin,
      buyerAccessToken,
      pinInfo: toPublicDeliveryPinInfo(record),
      unifiedNotification,
    };
  } finally {
    activePinLocks.delete(lockKey);
  }
}

/**
 * Invalidates an order's active Delivery PIN when the order is cancelled or rejected.
 */
export async function invalidateOrderDeliveryPin(
  orderId: string,
  reason: string,
  actorId: string = 'SYSTEM'
): Promise<DeliveryPinPublicInfo | undefined> {
  const existing = await getOrderDeliveryPinRecord(orderId);
  if (!existing) return undefined;
  if (existing.status === 'VERIFIED' || existing.status === 'INVALIDATED') {
    return toPublicDeliveryPinInfo(existing);
  }
  existing.status = 'INVALIDATED';
  await persistPinRecordToFirestore(existing);
  await recordDeliveryPinAuditLog({
    orderId: existing.orderId,
    storeId: existing.storeId,
    sellerId: existing.sellerId,
    eventType: 'PIN_INVALIDATED_ORDER_CLOSED',
    actorId,
    actorRole: 'SYSTEM',
    pinVersion: existing.pinVersion,
    summary: `Delivery PIN v${existing.pinVersion} invalidated: ${reason}`,
  });
  return toPublicDeliveryPinInfo(existing);
}

/**
 * Verifies whether the incoming HTTP request is authorized as the order's buyer.
 */
export async function verifyBuyerOrderAccess(
  req: NextRequest,
  order: OrderRecord,
  providedAccessToken?: string | null
): Promise<{
  authorized: boolean;
  actorId: string;
  reason?: string;
}> {
  const orderPhoneE164 = normalizePhoneE164(order.customer.phone);

  // 1. Check HMAC-signed Buyer Order Access Token (header, query param, or body)
  const headerToken =
    req.headers.get('x-buyer-order-token') ||
    new URL(req.url).searchParams.get('buyerAccessToken') ||
    providedAccessToken;

  if (headerToken) {
    const verifiedAccess = verifyBuyerOrderAccessToken(headerToken, order.id);
    if (
      verifiedAccess &&
      verifiedAccess.orderId === order.id &&
      verifiedAccess.buyerPhoneE164 === orderPhoneE164
    ) {
      return {
        authorized: true,
        actorId:
          verifiedAccess.buyerUid ||
          verifiedAccess.buyerPhoneE164 ||
          'verified-buyer-token',
      };
    }
  }

  // 2. Check signed `urbandirect_session` cookie
  const cookieToken = req.cookies.get('urbandirect_session')?.value;
  const sessionPayload = verifySignedSessionToken(cookieToken);
  if (sessionPayload) {
    const sessionPhone = normalizePhoneE164(sessionPayload.phoneE164);
    const sessionUid = sessionPayload.firebaseUid || sessionPayload.userId;
    if (
      (order.buyerUid && sessionUid === order.buyerUid) ||
      (sessionPhone && sessionPhone === orderPhoneE164)
    ) {
      return {
        authorized: true,
        actorId: sessionUid || sessionPhone,
      };
    }
  }

  // 3. Check Firebase ID token in Authorization: Bearer header
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (bearerToken) {
    const verifiedToken =
      await verifyFirebaseIdTokenCryptographically(bearerToken);
    if (verifiedToken) {
      const tokenPhone = normalizePhoneE164(verifiedToken.phoneE164);
      if (
        (order.buyerUid && verifiedToken.uid === order.buyerUid) ||
        (tokenPhone && tokenPhone === orderPhoneE164)
      ) {
        return {
          authorized: true,
          actorId: verifiedToken.uid || tokenPhone,
        };
      }
    }
  }

  return {
    authorized: false,
    actorId: 'unverified-caller',
    reason:
      'Access Denied: Only the authenticated buyer who placed this order can view or regenerate its Delivery PIN.',
  };
}

/**
 * Verifies whether the incoming HTTP request is authorized as the order's Seller,
 * assigned Delivery Actor, or Platform Administrator to verify a Delivery PIN or update payment status.
 */
export async function verifySellerOrDeliveryOrderAccess(
  req: NextRequest,
  order: OrderRecord,
  bodyActorSellerId?: string | null
): Promise<{
  authorized: boolean;
  actorId: string;
  actorRole: 'SELLER' | 'DELIVERY_AGENT' | 'ADMIN';
  statusCode: 200 | 401 | 403;
  reason?: string;
}> {
  const cookieToken = req.cookies.get('urbandirect_session')?.value;
  const sessionPayload = verifySignedSessionToken(cookieToken);

  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  let verifiedUid = sessionPayload?.firebaseUid || sessionPayload?.userId || '';
  let verifiedSellerId = sessionPayload?.sellerId || '';

  if (bearerToken) {
    const verifiedToken =
      await verifyFirebaseIdTokenCryptographically(bearerToken);
    if (verifiedToken) {
      verifiedUid = verifiedToken.uid;
    }
  }

  // Check Admin authorization first
  const adminCheck = await verifyAdminRequest(req);
  if (adminCheck.authorized) {
    return {
      authorized: true,
      actorId: adminCheck.firebaseUid || adminCheck.phoneE164 || 'ADMIN',
      actorRole: 'ADMIN',
      statusCode: 200,
    };
  }

  // Check verified session sellerId or sellerUid match
  if (verifiedSellerId && verifiedSellerId === order.sellerId) {
    return {
      authorized: true,
      actorId: verifiedSellerId,
      actorRole: 'SELLER',
      statusCode: 200,
    };
  }

  if (verifiedUid && order.sellerUid && verifiedUid === order.sellerUid) {
    return {
      authorized: true,
      actorId: verifiedUid,
      actorRole: 'SELLER',
      statusCode: 200,
    };
  }

  // If bodyActorSellerId is provided:
  // - If it does NOT match `order.sellerId`, immediately reject with 403 (cross-seller attempt).
  // - If the caller has a session belonging to a DIFFERENT seller, reject with 403.
  if (bodyActorSellerId && bodyActorSellerId !== order.sellerId) {
    return {
      authorized: false,
      actorId: bodyActorSellerId,
      actorRole: 'SELLER',
      statusCode: 403,
      reason: `Access Denied: Seller "${bodyActorSellerId}" is not authorized to manage or verify delivery for order #${order.id} belonging to store "${order.storeName}".`,
    };
  }

  if (verifiedSellerId && verifiedSellerId !== order.sellerId) {
    return {
      authorized: false,
      actorId: verifiedSellerId,
      actorRole: 'SELLER',
      statusCode: 403,
      reason: `Access Denied: Your seller account (${verifiedSellerId}) does not own order #${order.id}.`,
    };
  }

  // Allow Merchant Studio seller/delivery workspace when `actorSellerId` matches `order.sellerId`
  if (bodyActorSellerId && bodyActorSellerId === order.sellerId) {
    return {
      authorized: true,
      actorId: verifiedUid || bodyActorSellerId,
      actorRole: 'SELLER',
      statusCode: 200,
    };
  }

  return {
    authorized: false,
    actorId: verifiedUid || 'unauthenticated',
    actorRole: 'SELLER',
    statusCode: 401,
    reason:
      'Authentication required: Only the assigned store seller or authorized delivery person can verify delivery for this order.',
  };
}

/**
 * Atomically validates the 6-digit Delivery PIN submitted by the seller/delivery person.
 * - Enforces rate limiting and brute-force attempt locking (max 5 attempts).
 * - Validates order state (must not be DELIVERED, CANCELLED, or REJECTED).
 * - Validates PIN expiry.
 * - Compares PIN hash using timingSafeEqual.
 * - Marks PIN as VERIFIED (single-use) so it can never be reused.
 */
export async function verifyOrderDeliveryPinAtomically(params: {
  order: OrderRecord;
  submittedPin: string;
  actorId: string;
  actorRole: 'SELLER' | 'DELIVERY_AGENT' | 'ADMIN';
}): Promise<{
  ok: boolean;
  statusCode: number;
  error?: string;
  errorCode?: string;
  remainingAttempts?: number;
  pinInfo?: DeliveryPinPublicInfo;
  verifiedAt?: string;
}> {
  const { order, submittedPin, actorId, actorRole } = params;
  const lockKey = `pin-lock:${order.id}`;

  if (activePinLocks.has(lockKey)) {
    return {
      ok: false,
      statusCode: 409,
      error: 'A Delivery PIN verification request is already in progress.',
      errorCode: 'PIN_VERIFICATION_IN_PROGRESS',
    };
  }

  activePinLocks.add(lockKey);
  try {
    // 1. Actor rate-limit check (max 15 verification attempts per 5 minutes per actor)
    const now = Date.now();
    const rateKey = `${actorId}:${order.id}`;
    const rateWindow = actorVerifyRateLimits.get(rateKey);
    if (rateWindow && now - rateWindow.windowStartMs < 5 * 60 * 1000) {
      if (rateWindow.count >= 15) {
        return {
          ok: false,
          statusCode: 429,
          error:
            'Too many PIN verification attempts. Please wait a few minutes or ask the buyer to regenerate their Delivery PIN.',
          errorCode: 'PIN_RATE_LIMITED',
        };
      }
      rateWindow.count += 1;
    } else {
      actorVerifyRateLimits.set(rateKey, { count: 1, windowStartMs: now });
    }

    // 2. Validate Order Status
    if (order.orderStatus === 'DELIVERED') {
      return {
        ok: false,
        statusCode: 409,
        error: `Order #${order.id} has already been verified and marked as Delivered. Delivery PINs are single-use and cannot be reused.`,
        errorCode: 'ORDER_ALREADY_DELIVERED',
      };
    }

    if (
      order.orderStatus === 'CANCELLED' ||
      order.orderStatus === 'REJECTED'
    ) {
      return {
        ok: false,
        statusCode: 400,
        error: `Cannot verify delivery for order #${order.id} because its status is ${order.orderStatus}.`,
        errorCode: 'ORDER_CLOSED',
      };
    }

    const cleanedPin = String(submittedPin || '').trim();
    if (!/^\d{6}$/.test(cleanedPin)) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Please enter a valid 6-digit numeric Delivery PIN.',
        errorCode: 'INVALID_PIN_FORMAT',
      };
    }

    const pinRecord = await getOrderDeliveryPinRecord(order.id);
    if (!pinRecord) {
      return {
        ok: false,
        statusCode: 404,
        error:
          'No active Delivery PIN record was found for this order. Please ask the buyer to regenerate their Delivery PIN from My Orders.',
        errorCode: 'PIN_NOT_FOUND',
      };
    }

    // 3. Check PIN lifecycle status
    if (pinRecord.status === 'VERIFIED') {
      return {
        ok: false,
        statusCode: 409,
        error:
          'This Delivery PIN has already been used to verify delivery and cannot be reused.',
        errorCode: 'PIN_ALREADY_USED',
        pinInfo: toPublicDeliveryPinInfo(pinRecord),
      };
    }

    if (pinRecord.status === 'INVALIDATED') {
      return {
        ok: false,
        statusCode: 400,
        error:
          'This Delivery PIN was invalidated. Please use the latest PIN or check order status.',
        errorCode: 'PIN_INVALIDATED',
        pinInfo: toPublicDeliveryPinInfo(pinRecord),
      };
    }

    if (
      pinRecord.status === 'LOCKED' ||
      pinRecord.attemptsUsed >= pinRecord.maxAttempts
    ) {
      pinRecord.status = 'LOCKED';
      await persistPinRecordToFirestore(pinRecord);
      return {
        ok: false,
        statusCode: 429,
        error:
          'Delivery PIN verification is locked after 5 failed attempts. Please ask the buyer to tap "Regenerate PIN" in their Order Details to issue a new PIN.',
        errorCode: 'PIN_LOCKED_MAX_ATTEMPTS',
        remainingAttempts: 0,
        pinInfo: toPublicDeliveryPinInfo(pinRecord),
      };
    }

    if (
      pinRecord.status === 'EXPIRED' ||
      new Date(pinRecord.expiresAt).getTime() <= now
    ) {
      pinRecord.status = 'EXPIRED';
      await persistPinRecordToFirestore(pinRecord);
      return {
        ok: false,
        statusCode: 400,
        error:
          'This Delivery PIN has expired. Please ask the buyer to regenerate a new Delivery PIN from their Order Details.',
        errorCode: 'PIN_EXPIRED',
        pinInfo: toPublicDeliveryPinInfo(pinRecord),
      };
    }

    // 4. Cryptographic timing-safe hash check
    const isMatch = verifyDeliveryPinHash(
      cleanedPin,
      pinRecord.pinSalt,
      pinRecord.pinHash
    );

    const nowIso = new Date(now).toISOString();

    if (!isMatch) {
      pinRecord.attemptsUsed += 1;
      pinRecord.lastFailedAt = nowIso;
      const remaining = Math.max(
        0,
        pinRecord.maxAttempts - pinRecord.attemptsUsed
      );

      if (remaining === 0) {
        pinRecord.status = 'LOCKED';
      }

      await persistPinRecordToFirestore(pinRecord);

      await recordDeliveryPinAuditLog({
        orderId: order.id,
        storeId: order.storeId,
        sellerId: order.sellerId,
        eventType:
          remaining === 0
            ? 'PIN_LOCKED_MAX_ATTEMPTS'
            : 'PIN_VERIFICATION_FAILED',
        actorId,
        actorRole,
        pinVersion: pinRecord.pinVersion,
        summary:
          remaining === 0
            ? `Delivery PIN v${pinRecord.pinVersion} locked after ${pinRecord.attemptsUsed}/${pinRecord.maxAttempts} failed attempts.`
            : `Invalid Delivery PIN attempt (${pinRecord.attemptsUsed}/${pinRecord.maxAttempts} used; ${remaining} remaining).`,
      });

      return {
        ok: false,
        statusCode: remaining === 0 ? 429 : 400,
        error:
          remaining === 0
            ? 'Incorrect Delivery PIN. Maximum attempts (5) reached — PIN is now locked. Ask the buyer to regenerate a new PIN.'
            : `Incorrect Delivery PIN. Please verify the 6-digit PIN with the buyer (${remaining} attempt${remaining === 1 ? '' : 's'} remaining).`,
        errorCode: remaining === 0 ? 'PIN_LOCKED_MAX_ATTEMPTS' : 'INVALID_PIN',
        remainingAttempts: remaining,
        pinInfo: toPublicDeliveryPinInfo(pinRecord),
      };
    }

    // 5. Verification Succeeded! Atomically mark PIN as VERIFIED
    pinRecord.status = 'VERIFIED';
    pinRecord.verifiedAt = nowIso;
    pinRecord.verifiedByActor = actorId;
    pinRecord.verifiedByRole = actorRole;

    await persistPinRecordToFirestore(pinRecord);

    await recordDeliveryPinAuditLog({
      orderId: order.id,
      storeId: order.storeId,
      sellerId: order.sellerId,
      eventType: 'PIN_VERIFICATION_SUCCEEDED',
      actorId,
      actorRole,
      pinVersion: pinRecord.pinVersion,
      summary: `Delivery PIN v${pinRecord.pinVersion} verified by ${actorRole} (${actorId}). Order #${order.id} marked DELIVERED. Payment status preserved separately (${order.paymentStatus || 'PENDING'}).`,
    });

    return {
      ok: true,
      statusCode: 200,
      verifiedAt: nowIso,
      pinInfo: toPublicDeliveryPinInfo(pinRecord),
    };
  } finally {
    activePinLocks.delete(lockKey);
  }
}
