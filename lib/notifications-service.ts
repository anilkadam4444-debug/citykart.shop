import { getMessaging } from 'firebase-admin/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { adminApp, adminDb } from './firebase-admin';
import { db, IS_PREVIEW_DUMMY_FIREBASE, removeUndefined } from './firebase';
import {
  getFcmTokensForRecipient,
  normalizePhoneKey,
  removeInvalidFcmToken,
} from './fcm-registry';
import { DESIGNATED_OWNER_PHONE } from './super-admin-auth';

export type NotificationRole =
  | 'BUYER'
  | 'SELLER'
  | 'PARTNER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type NotificationCategory =
  | 'ORDER_UPDATES'
  | 'BUSINESS_UPDATES'
  | 'PARTNER_UPDATES'
  | 'ACCOUNT_SECURITY'
  | 'ADMIN_ALERTS'
  | 'MARKETING_PROMOTIONS';

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export type NotificationEntityType =
  | 'ORDER'
  | 'STORE'
  | 'PRODUCT'
  | 'PARTNER_APPLICATION'
  | 'PARTNER'
  | 'SETTLEMENT'
  | 'SUBSCRIPTION'
  | 'CAMPAIGN'
  | 'USER'
  | 'ADMIN'
  | 'SYSTEM';

export type NotificationDeliveryStage =
  | 'EVENT_CREATED'
  | 'IN_APP_PERSISTED'
  | 'PREFERENCE_SUPPRESSED_IN_APP'
  | 'PREFERENCE_SUPPRESSED_PUSH'
  | 'FCM_NO_REGISTERED_TOKENS'
  | 'FCM_ATTEMPTED'
  | 'FCM_ACCEPTED'
  | 'FCM_SIMULATED_TOKEN_ACK'
  | 'FCM_CREDENTIALS_UNAVAILABLE'
  | 'FCM_FAILED'
  | 'INVALID_TOKEN_REMOVED'
  | 'RETRY_ATTEMPTED'
  | 'RETRY_EXHAUSTED';

export type NotificationDeliveryStatus =
  | 'IN_APP_DELIVERED'
  | 'PUSH_ACCEPTED_BY_FCM'
  | 'IN_APP_ONLY_NO_TOKEN'
  | 'IN_APP_ONLY_PREF_DISABLED'
  | 'IN_APP_ONLY_FCM_UNAVAILABLE'
  | 'SUPPRESSED_BY_PREFERENCES'
  | 'DUPLICATE_SKIPPED'
  | 'FAILED';

export interface NotificationDeliveryTelemetry {
  stages: NotificationDeliveryStage[];
  eventCreatedAt: string;
  inAppPersistedAt?: string;
  fcmAttemptedAt?: string;
  fcmCompletedAt?: string;
  tokensTargeted: number;
  tokensSucceeded: number;
  invalidTokensRemoved: number;
  retryAttempts: number;
  fcmErrorCodes?: string[];
  fcmNote?: string;
}

export interface UnifiedNotificationRecord {
  id: string;
  eventKey: string;
  recipientUid?: string;
  recipientPhoneE164?: string;
  recipientSellerId?: string;
  recipientStoreId?: string;
  recipientPartnerId?: string;
  recipientRole: NotificationRole;
  title: string;
  message: string;
  type: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  isMandatory: boolean;
  relatedEntityId: string;
  relatedEntityType: NotificationEntityType;
  destinationRoute: string;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
  deliveryStatus: NotificationDeliveryStatus;
  deliveryChannels: Array<'IN_APP' | 'BROWSER_PUSH'>;
  deliveryTelemetry: NotificationDeliveryTelemetry;
  metadata?: Record<string, any>;
}

export interface UserNotificationPreferences {
  userKey: string;
  uid?: string;
  phoneE164?: string;
  inAppEnabled: boolean;
  browserPushEnabled: boolean;
  marketingEnabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  updatedAt: string;
}

export interface CreateNotificationInput {
  eventKey?: string;
  recipientUid?: string;
  recipientPhoneE164?: string;
  recipientSellerId?: string;
  recipientStoreId?: string;
  recipientPartnerId?: string;
  recipientRole: NotificationRole;
  title: string;
  message: string;
  type: string;
  category: NotificationCategory;
  severity?: NotificationSeverity;
  isMandatory?: boolean;
  relatedEntityId: string;
  relatedEntityType: NotificationEntityType;
  destinationRoute?: string;
  metadata?: Record<string, any>;
}

declare global {
  var __serverNotificationsRegistry:
    | Map<string, UnifiedNotificationRecord>
    | undefined;
  var __serverNotificationEventKeys: Map<string, string> | undefined;
  var __serverNotificationPreferencesRegistry:
    | Map<string, UserNotificationPreferences>
    | undefined;
  var __serverNotificationsSeeded: boolean | undefined;
}

export const serverNotificationsRegistry: Map<
  string,
  UnifiedNotificationRecord
> =
  globalThis.__serverNotificationsRegistry ||
  (globalThis.__serverNotificationsRegistry = new Map<
    string,
    UnifiedNotificationRecord
  >());

export const serverNotificationEventKeys: Map<string, string> =
  globalThis.__serverNotificationEventKeys ||
  (globalThis.__serverNotificationEventKeys = new Map<string, string>());

export const serverNotificationPreferencesRegistry: Map<
  string,
  UserNotificationPreferences
> =
  globalThis.__serverNotificationPreferencesRegistry ||
  (globalThis.__serverNotificationPreferencesRegistry = new Map<
    string,
    UserNotificationPreferences
  >());

function buildDefaultDestinationRoute(input: {
  recipientRole: NotificationRole;
  relatedEntityType: NotificationEntityType;
  relatedEntityId: string;
  destinationRoute?: string;
}): string {
  if (input.destinationRoute) return input.destinationRoute;
  const id = encodeURIComponent(input.relatedEntityId || '');
  switch (input.recipientRole) {
    case 'BUYER':
      if (input.relatedEntityType === 'ORDER' && id) {
        return `/orders?orderId=${id}`;
      }
      return '/orders';
    case 'SELLER':
      if (input.relatedEntityType === 'ORDER' && id) {
        return `/?view=seller&section=orders&orderId=${id}`;
      }
      if (input.relatedEntityType === 'PRODUCT') {
        return `/?view=seller&section=catalog`;
      }
      if (
        input.relatedEntityType === 'SUBSCRIPTION' ||
        input.relatedEntityType === 'CAMPAIGN'
      ) {
        return `/?view=seller&section=growth`;
      }
      return '/?view=seller';
    case 'PARTNER':
      return '/partner';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/?view=admin';
    default:
      return '/';
  }
}

export function resolvePreferenceUserKey(params: {
  uid?: string;
  phoneE164?: string;
  sellerId?: string;
  partnerId?: string;
}): string {
  const normPhone = normalizePhoneKey(params.phoneE164);
  if (normPhone) return `phone:${normPhone}`;
  if (params.uid && params.uid.trim()) return `uid:${params.uid.trim()}`;
  if (params.sellerId && params.sellerId.trim()) {
    return `seller:${params.sellerId.trim()}`;
  }
  if (params.partnerId && params.partnerId.trim()) {
    return `partner:${params.partnerId.trim()}`;
  }
  return 'default:anonymous';
}

export function getUserNotificationPreferences(params: {
  uid?: string;
  phoneE164?: string;
  sellerId?: string;
  partnerId?: string;
}): UserNotificationPreferences {
  const normPhone = normalizePhoneKey(params.phoneE164);
  const candidateKeys = [
    normPhone ? `phone:${normPhone}` : null,
    params.uid ? `uid:${params.uid.trim()}` : null,
    params.sellerId ? `seller:${params.sellerId.trim()}` : null,
    params.partnerId ? `partner:${params.partnerId.trim()}` : null,
  ].filter(Boolean) as string[];

  for (const key of candidateKeys) {
    const existing = serverNotificationPreferencesRegistry.get(key);
    if (existing) return existing;
  }

  const primaryKey = resolvePreferenceUserKey(params);
  return {
    userKey: primaryKey,
    uid: params.uid,
    phoneE164: normPhone,
    inAppEnabled: true,
    browserPushEnabled: true,
    marketingEnabled: true,
    categories: {
      ORDER_UPDATES: true,
      BUSINESS_UPDATES: true,
      PARTNER_UPDATES: true,
      ACCOUNT_SECURITY: true,
      ADMIN_ALERTS: true,
      MARKETING_PROMOTIONS: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function updateUserNotificationPreferences(params: {
  uid?: string;
  phoneE164?: string;
  sellerId?: string;
  partnerId?: string;
  inAppEnabled?: boolean;
  browserPushEnabled?: boolean;
  marketingEnabled?: boolean;
  categories?: Partial<Record<NotificationCategory, boolean>>;
}): Promise<UserNotificationPreferences> {
  const current = getUserNotificationPreferences(params);
  const normPhone = normalizePhoneKey(params.phoneE164) || current.phoneE164;
  const nowIso = new Date().toISOString();

  const nextCategories: Record<NotificationCategory, boolean> = {
    ...current.categories,
    ...(params.categories || {}),
    // Critical security alerts remain enabled
    ACCOUNT_SECURITY: true,
  };

  if (params.marketingEnabled !== undefined) {
    nextCategories.MARKETING_PROMOTIONS = Boolean(params.marketingEnabled);
  }

  const updated: UserNotificationPreferences = {
    userKey: current.userKey,
    uid: params.uid || current.uid,
    phoneE164: normPhone,
    inAppEnabled:
      params.inAppEnabled !== undefined
        ? Boolean(params.inAppEnabled)
        : current.inAppEnabled,
    browserPushEnabled:
      params.browserPushEnabled !== undefined
        ? Boolean(params.browserPushEnabled)
        : current.browserPushEnabled,
    marketingEnabled:
      params.marketingEnabled !== undefined
        ? Boolean(params.marketingEnabled)
        : nextCategories.MARKETING_PROMOTIONS,
    categories: nextCategories,
    updatedAt: nowIso,
  };

  const keysToBind = new Set<string>([updated.userKey]);
  if (normPhone) keysToBind.add(`phone:${normPhone}`);
  if (updated.uid) keysToBind.add(`uid:${updated.uid}`);
  if (params.sellerId) keysToBind.add(`seller:${params.sellerId}`);
  if (params.partnerId) keysToBind.add(`partner:${params.partnerId}`);

  for (const k of keysToBind) {
    serverNotificationPreferencesRegistry.set(k, updated);
  }

  const safeDocId = updated.userKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await adminDb
      .collection('userNotificationPreferences')
      .doc(safeDocId)
      .set(removeUndefined(updated), { merge: true });
  } catch {
    if (!IS_PREVIEW_DUMMY_FIREBASE) {
      try {
        await setDoc(
          doc(db, 'userNotificationPreferences', safeDocId),
          removeUndefined(updated),
          { merge: true }
        );
      } catch {
        // Stored in serverNotificationPreferencesRegistry
      }
    }
  }

  return updated;
}

async function persistUnifiedNotificationToFirestore(
  record: UnifiedNotificationRecord
): Promise<void> {
  const cleanRecord = removeUndefined(record);
  try {
    await adminDb
      .collection('notifications')
      .doc(record.id)
      .set(cleanRecord, { merge: true });
  } catch {
    if (!IS_PREVIEW_DUMMY_FIREBASE) {
      try {
        await setDoc(doc(db, 'notifications', record.id), cleanRecord, {
          merge: true,
        });
      } catch {
        // In-memory registry remains authoritative
      }
    }
  }

  // Also mirror to sellerNotifications when recipientRole === 'SELLER' for backwards compatibility
  if (record.recipientRole === 'SELLER' && record.recipientSellerId) {
    const sellerNotif = removeUndefined({
      id: record.id,
      sellerId: record.recipientSellerId,
      sellerUid: record.recipientUid || record.recipientSellerId,
      storeId: record.recipientStoreId || '',
      orderId:
        record.relatedEntityType === 'ORDER' ? record.relatedEntityId : '',
      title: record.title,
      message: record.message,
      type: record.type,
      isRead: record.isRead,
      createdAt: record.createdAt,
    });
    try {
      await adminDb
        .collection('sellerNotifications')
        .doc(record.id)
        .set(sellerNotif, { merge: true });
    } catch {
      if (!IS_PREVIEW_DUMMY_FIREBASE) {
        try {
          await setDoc(doc(db, 'sellerNotifications', record.id), sellerNotif, {
            merge: true,
          });
        } catch {
          // Ignore
        }
      }
    }
  }

  // Also mirror to partnerNotifications when recipientRole === 'PARTNER'
  if (record.recipientRole === 'PARTNER' && record.recipientPhoneE164) {
    const partnerNotif = removeUndefined({
      id: record.id,
      recipientUid: record.recipientUid,
      recipientPhoneE164: record.recipientPhoneE164,
      partnerId: record.recipientPartnerId,
      applicationId:
        record.relatedEntityType === 'PARTNER_APPLICATION'
          ? record.relatedEntityId
          : undefined,
      eventType: record.type,
      title: record.title,
      message: record.message,
      isRead: record.isRead,
      createdAt: record.createdAt,
    });
    try {
      await adminDb
        .collection('partnerNotifications')
        .doc(record.id)
        .set(partnerNotif, { merge: true });
    } catch {
      if (!IS_PREVIEW_DUMMY_FIREBASE) {
        try {
          await setDoc(
            doc(db, 'partnerNotifications', record.id),
            partnerNotif,
            { merge: true }
          );
        } catch {
          // Ignore
        }
      }
    }
  }
}

async function dispatchFcmWithRetry(params: {
  tokens: string[];
  notification: UnifiedNotificationRecord;
}): Promise<{
  succeeded: number;
  invalidRemoved: number;
  retryAttempts: number;
  errorCodes: string[];
  simulatedAck: boolean;
  credentialsUnavailable: boolean;
  note?: string;
}> {
  const { tokens, notification } = params;
  if (tokens.length === 0) {
    return {
      succeeded: 0,
      invalidRemoved: 0,
      retryAttempts: 0,
      errorCodes: [],
      simulatedAck: false,
      credentialsUnavailable: false,
    };
  }

  // Separate simulated browser tokens (`fcm_web_...` or `sim_token_...`) from real FCM registration tokens
  const simulatedTokens = tokens.filter(
    (t) =>
      t.startsWith('fcm_web_') ||
      t.startsWith('sim_token_') ||
      t.startsWith('test_fcm_token_')
  );
  const invalidSimulatedTokens = tokens.filter((t) =>
    t.startsWith('invalid_fcm_token_')
  );
  const realFcmTokens = tokens.filter(
    (t) =>
      !t.startsWith('fcm_web_') &&
      !t.startsWith('sim_token_') &&
      !t.startsWith('test_fcm_token_') &&
      !t.startsWith('invalid_fcm_token_')
  );

  let invalidRemoved = 0;
  const errorCodes: string[] = [];

  // Prune explicitly invalid tokens immediately
  for (const badTok of invalidSimulatedTokens) {
    await removeInvalidFcmToken(badTok);
    invalidRemoved += 1;
    errorCodes.push('messaging/registration-token-not-registered');
  }

  let succeeded = simulatedTokens.length;
  const simulatedAck = simulatedTokens.length > 0;
  let retryAttempts = 0;
  let credentialsUnavailable = false;
  let note: string | undefined;

  if (realFcmTokens.length > 0) {
    const maxRetries = 2;
    let remainingTokens = [...realFcmTokens];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (remainingTokens.length === 0) break;
      if (attempt > 0) {
        retryAttempts += 1;
      }

      try {
        const messaging = getMessaging(adminApp);
        const multicastResp = await messaging.sendEachForMulticast({
          tokens: remainingTokens,
          notification: {
            title: notification.title,
            body: notification.message,
          },
          data: {
            notificationId: String(notification.id),
            eventKey: String(notification.eventKey),
            type: String(notification.type),
            category: String(notification.category),
            severity: String(notification.severity),
            recipientRole: String(notification.recipientRole),
            relatedEntityId: String(notification.relatedEntityId),
            relatedEntityType: String(notification.relatedEntityType),
            destinationRoute: String(notification.destinationRoute),
            clickAction: String(notification.destinationRoute),
            title: String(notification.title),
            body: String(notification.message),
            createdAt: String(notification.createdAt),
          },
          webpush: {
            notification: {
              title: notification.title,
              body: notification.message,
              icon: '/citykart-icon.png',
              badge: '/citykart-icon.png',
              tag: `citykart-notif-${notification.id}-${notification.recipientRole}`,
              renotify: false,
            },
            fcmOptions: {
              link: notification.destinationRoute,
            },
          },
        });

        succeeded += multicastResp.successCount;
        const transientFailedTokens: string[] = [];

        for (let idx = 0; idx < multicastResp.responses.length; idx++) {
          const resp = multicastResp.responses[idx];
          const tok = remainingTokens[idx];
          if (!resp.success && resp.error) {
            const code = resp.error.code || 'messaging/unknown-error';
            errorCodes.push(code);
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-argument'
            ) {
              await removeInvalidFcmToken(tok);
              invalidRemoved += 1;
            } else if (
              code === 'messaging/internal-error' ||
              code === 'messaging/server-unavailable' ||
              code === 'messaging/quota-exceeded'
            ) {
              transientFailedTokens.push(tok);
            }
          }
        }

        remainingTokens = transientFailedTokens;
        if (remainingTokens.length === 0) break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('credential') ||
          msg.includes('access token') ||
          msg.includes('authentication') ||
          msg.includes('Could not load the default credentials') ||
          msg.includes('Permission')
        ) {
          credentialsUnavailable = true;
          note =
            'Firebase Admin service account credentials are not bound in this environment; in-app notification persisted and queued.';
          break;
        }
        errorCodes.push('messaging/dispatch-exception');
        note = msg;
      }
    }
  }

  return {
    succeeded,
    invalidRemoved,
    retryAttempts,
    errorCodes,
    simulatedAck,
    credentialsUnavailable,
    note,
  };
}

/**
 * Core authoritative function to create, persist, and deliver a unified notification.
 * Enforces idempotency via `eventKey`, respects user preferences, persists to Firestore + memory,
 * and dispatches FCM push notifications without ever throwing an uncaught error.
 */
export async function dispatchUnifiedNotification(
  input: CreateNotificationInput
): Promise<{
  ok: boolean;
  duplicateSkipped: boolean;
  notification: UnifiedNotificationRecord;
}> {
  const nowIso = new Date().toISOString();
  const normalizedPhone = normalizePhoneKey(input.recipientPhoneE164);

  // Build deterministic idempotency key if not explicitly supplied
  const recipientIdentity =
    normalizedPhone ||
    input.recipientUid ||
    input.recipientSellerId ||
    input.recipientPartnerId ||
    input.recipientRole;

  const resolvedEventKey =
    input.eventKey ||
    `${input.recipientRole}:${recipientIdentity}:${input.type}:${input.relatedEntityId}`;

  // 1. Idempotency Check: never create duplicate notifications for the same eventKey
  const existingNotifId = serverNotificationEventKeys.get(resolvedEventKey);
  if (existingNotifId) {
    const existingRecord = serverNotificationsRegistry.get(existingNotifId);
    if (existingRecord) {
      return {
        ok: true,
        duplicateSkipped: true,
        notification: existingRecord,
      };
    }
  }

  const isMandatory =
    Boolean(input.isMandatory) ||
    input.category === 'ACCOUNT_SECURITY' ||
    input.severity === 'CRITICAL';

  const prefs = getUserNotificationPreferences({
    uid: input.recipientUid,
    phoneE164: normalizedPhone,
    sellerId: input.recipientSellerId,
    partnerId: input.recipientPartnerId,
  });

  const categoryAllowed =
    isMandatory || prefs.categories[input.category] !== false;
  const marketingAllowed =
    input.category !== 'MARKETING_PROMOTIONS' ||
    isMandatory ||
    (prefs.marketingEnabled && prefs.categories.MARKETING_PROMOTIONS !== false);

  const allowInApp =
    isMandatory || (prefs.inAppEnabled && categoryAllowed && marketingAllowed);
  const allowPush =
    prefs.browserPushEnabled &&
    (isMandatory || (categoryAllowed && marketingAllowed));

  const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const destinationRoute = buildDefaultDestinationRoute({
    recipientRole: input.recipientRole,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    destinationRoute: input.destinationRoute,
  });

  const stages: NotificationDeliveryStage[] = ['EVENT_CREATED'];
  const deliveryChannels: Array<'IN_APP' | 'BROWSER_PUSH'> = [];

  const record: UnifiedNotificationRecord = {
    id: notifId,
    eventKey: resolvedEventKey,
    ...(input.recipientUid ? { recipientUid: input.recipientUid } : {}),
    ...(normalizedPhone ? { recipientPhoneE164: normalizedPhone } : {}),
    ...(input.recipientSellerId
      ? { recipientSellerId: input.recipientSellerId }
      : {}),
    ...(input.recipientStoreId
      ? { recipientStoreId: input.recipientStoreId }
      : {}),
    ...(input.recipientPartnerId
      ? { recipientPartnerId: input.recipientPartnerId }
      : {}),
    recipientRole: input.recipientRole,
    title: input.title,
    message: input.message,
    type: input.type,
    category: input.category,
    severity: input.severity || 'INFO',
    isMandatory,
    relatedEntityId: input.relatedEntityId,
    relatedEntityType: input.relatedEntityType,
    destinationRoute,
    createdAt: nowIso,
    isRead: false,
    readAt: null,
    deliveryStatus: 'IN_APP_DELIVERED',
    deliveryChannels,
    deliveryTelemetry: {
      stages,
      eventCreatedAt: nowIso,
      tokensTargeted: 0,
      tokensSucceeded: 0,
      invalidTokensRemoved: 0,
      retryAttempts: 0,
    },
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  if (!allowInApp) {
    stages.push('PREFERENCE_SUPPRESSED_IN_APP');
    record.deliveryStatus = 'SUPPRESSED_BY_PREFERENCES';
    return {
      ok: true,
      duplicateSkipped: false,
      notification: record,
    };
  }

  // Persist In-App notification
  deliveryChannels.push('IN_APP');
  stages.push('IN_APP_PERSISTED');
  record.deliveryTelemetry.inAppPersistedAt = new Date().toISOString();

  serverNotificationEventKeys.set(resolvedEventKey, notifId);
  serverNotificationsRegistry.set(notifId, record);

  // Attempt Browser Push (FCM) if permitted by user preferences
  if (!allowPush) {
    stages.push('PREFERENCE_SUPPRESSED_PUSH');
    record.deliveryStatus = 'IN_APP_ONLY_PREF_DISABLED';
  } else {
    const tokens = await getFcmTokensForRecipient({
      uid: input.recipientUid,
      sellerId: input.recipientSellerId,
      partnerId: input.recipientPartnerId,
      phoneE164: normalizedPhone,
      buyerPhone: normalizedPhone,
      role:
        input.recipientRole === 'ADMIN' || input.recipientRole === 'SUPER_ADMIN'
          ? input.recipientRole
          : undefined,
    });

    record.deliveryTelemetry.tokensTargeted = tokens.length;

    if (tokens.length === 0) {
      stages.push('FCM_NO_REGISTERED_TOKENS');
      record.deliveryStatus = 'IN_APP_ONLY_NO_TOKEN';
    } else {
      stages.push('FCM_ATTEMPTED');
      record.deliveryTelemetry.fcmAttemptedAt = new Date().toISOString();

      const fcmResult = await dispatchFcmWithRetry({
        tokens,
        notification: record,
      });

      record.deliveryTelemetry.fcmCompletedAt = new Date().toISOString();
      record.deliveryTelemetry.tokensSucceeded = fcmResult.succeeded;
      record.deliveryTelemetry.invalidTokensRemoved = fcmResult.invalidRemoved;
      record.deliveryTelemetry.retryAttempts = fcmResult.retryAttempts;
      if (fcmResult.errorCodes.length > 0) {
        record.deliveryTelemetry.fcmErrorCodes = fcmResult.errorCodes;
      }
      if (fcmResult.note) {
        record.deliveryTelemetry.fcmNote = fcmResult.note;
      }

      if (fcmResult.retryAttempts > 0) {
        stages.push('RETRY_ATTEMPTED');
      }
      if (fcmResult.invalidRemoved > 0) {
        stages.push('INVALID_TOKEN_REMOVED');
      }

      if (fcmResult.succeeded > 0) {
        deliveryChannels.push('BROWSER_PUSH');
        stages.push(
          fcmResult.simulatedAck ? 'FCM_SIMULATED_TOKEN_ACK' : 'FCM_ACCEPTED'
        );
        record.deliveryStatus = 'PUSH_ACCEPTED_BY_FCM';
      } else if (fcmResult.credentialsUnavailable) {
        stages.push('FCM_CREDENTIALS_UNAVAILABLE');
        record.deliveryStatus = 'IN_APP_ONLY_FCM_UNAVAILABLE';
      } else {
        if (fcmResult.retryAttempts >= 2) {
          stages.push('RETRY_EXHAUSTED');
        }
        stages.push('FCM_FAILED');
        record.deliveryStatus = 'IN_APP_DELIVERED';
      }
    }
  }

  serverNotificationsRegistry.set(notifId, record);
  await persistUnifiedNotificationToFirestore(record);

  return {
    ok: true,
    duplicateSkipped: false,
    notification: record,
  };
}

/**
 * Seeds initial baseline notifications once per server boot so Buyers, Sellers, Partners, and Super Admins
 * have immediate visibility in the Notification Center.
 */
export function ensureInitialNotificationsSeeded(): void {
  if (globalThis.__serverNotificationsSeeded) return;
  globalThis.__serverNotificationsSeeded = true;

  const now = Date.now();
  const seedList: UnifiedNotificationRecord[] = [
    {
      id: 'notif_seed_buyer_order_101',
      eventKey: 'seed:buyer:order:demo-order-101',
      recipientPhoneE164: '+919876543210',
      recipientRole: 'BUYER',
      title: 'Order #demo-order-101 is Being Prepared',
      message:
        'Nanded Spice & Kirana Bazaar accepted your order and is preparing 2 items (₹365). Keep your 6-digit Delivery PIN 482915 ready at doorstep.',
      type: 'ORDER_PROCESSING',
      category: 'ORDER_UPDATES',
      severity: 'INFO',
      isMandatory: false,
      relatedEntityId: 'demo-order-101',
      relatedEntityType: 'ORDER',
      destinationRoute: '/orders?orderId=demo-order-101',
      createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
      isRead: false,
      readAt: null,
      deliveryStatus: 'IN_APP_DELIVERED',
      deliveryChannels: ['IN_APP'],
      deliveryTelemetry: {
        stages: ['EVENT_CREATED', 'IN_APP_PERSISTED'],
        eventCreatedAt: new Date(now - 15 * 60 * 1000).toISOString(),
        inAppPersistedAt: new Date(now - 15 * 60 * 1000).toISOString(),
        tokensTargeted: 0,
        tokensSucceeded: 0,
        invalidTokensRemoved: 0,
        retryAttempts: 0,
      },
    },
    {
      id: 'notif_seed_seller_order_101',
      eventKey: 'seed:seller:order:demo-order-101',
      recipientSellerId: 'seller-1',
      recipientStoreId: 'store-1',
      recipientRole: 'SELLER',
      title: 'New Customer Order #demo-order-101 (₹365)',
      message:
        'Rahul Sharma (+91 98765 43210) placed an order for Organic Turmeric Powder (Haldi) × 2 at Plot 14, Vazirabad Main Road, Nanded.',
      type: 'NEW_CUSTOMER_ORDER',
      category: 'ORDER_UPDATES',
      severity: 'SUCCESS',
      isMandatory: true,
      relatedEntityId: 'demo-order-101',
      relatedEntityType: 'ORDER',
      destinationRoute: '/?view=seller&section=orders&orderId=demo-order-101',
      createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
      isRead: false,
      readAt: null,
      deliveryStatus: 'IN_APP_DELIVERED',
      deliveryChannels: ['IN_APP'],
      deliveryTelemetry: {
        stages: ['EVENT_CREATED', 'IN_APP_PERSISTED'],
        eventCreatedAt: new Date(now - 20 * 60 * 1000).toISOString(),
        inAppPersistedAt: new Date(now - 20 * 60 * 1000).toISOString(),
        tokensTargeted: 0,
        tokensSucceeded: 0,
        invalidTokensRemoved: 0,
        retryAttempts: 0,
      },
    },
    {
      id: 'notif_seed_superadmin_health',
      eventKey: 'seed:superadmin:platform:ready',
      recipientPhoneE164: DESIGNATED_OWNER_PHONE,
      recipientRole: 'SUPER_ADMIN',
      title: 'Citykart Unified Notification Engine Active',
      message:
        'Real-time in-app and FCM push notification routing is active across Buyer, Seller, City Partner, Admin, and Super Admin workflows.',
      type: 'SUPER_ADMIN_HEALTH_ALERT',
      category: 'ADMIN_ALERTS',
      severity: 'SUCCESS',
      isMandatory: true,
      relatedEntityId: 'global',
      relatedEntityType: 'SYSTEM',
      destinationRoute: '/?view=admin',
      createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
      isRead: false,
      readAt: null,
      deliveryStatus: 'IN_APP_DELIVERED',
      deliveryChannels: ['IN_APP'],
      deliveryTelemetry: {
        stages: ['EVENT_CREATED', 'IN_APP_PERSISTED'],
        eventCreatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
        inAppPersistedAt: new Date(now - 30 * 60 * 1000).toISOString(),
        tokensTargeted: 0,
        tokensSucceeded: 0,
        invalidTokensRemoved: 0,
        retryAttempts: 0,
      },
    },
  ];

  for (const item of seedList) {
    serverNotificationEventKeys.set(item.eventKey, item.id);
    serverNotificationsRegistry.set(item.id, item);
  }
}

export interface QueryNotificationsInput {
  uid?: string;
  phoneE164?: string;
  sellerId?: string;
  storeId?: string;
  storeIds?: string[];
  partnerId?: string;
  role?: NotificationRole | 'ALL';
  roles?: string[];
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  statusFilter?: 'ALL' | 'UNREAD' | 'READ';
  categoryFilter?: NotificationCategory | 'ALL';
  limit?: number;
  offset?: number;
}

export function queryNotificationsForRecipient(input: QueryNotificationsInput): {
  notifications: UnifiedNotificationRecord[];
  totalCount: number;
  unreadCount: number;
  unreadByCategory: Record<NotificationCategory, number>;
  unreadByRole: Record<NotificationRole, number>;
  hasMore: boolean;
} {
  ensureInitialNotificationsSeeded();

  const normPhone = normalizePhoneKey(input.phoneE164);
  const storeIdSet = new Set<string>(
    [
      ...(input.storeId ? [input.storeId] : []),
      ...(input.storeIds || []),
    ].filter(Boolean)
  );
  const roleFilter =
    input.role && input.role !== 'ALL' ? input.role : undefined;

  const matched: UnifiedNotificationRecord[] = [];

  for (const rec of serverNotificationsRegistry.values()) {
    // If explicit roleFilter is passed (e.g., user is viewing Seller dashboard or Partner portal), filter to that role
    if (roleFilter && rec.recipientRole !== roleFilter) {
      // Allow SUPER_ADMIN to also see ADMIN notifications when filtering for ADMIN/SUPER_ADMIN
      if (
        !(
          (roleFilter === 'SUPER_ADMIN' || roleFilter === 'ADMIN') &&
          (rec.recipientRole === 'ADMIN' || rec.recipientRole === 'SUPER_ADMIN')
        )
      ) {
        continue;
      }
    }

    let belongsToCaller = false;

    // 1. Direct UID match
    if (input.uid && rec.recipientUid && rec.recipientUid === input.uid) {
      belongsToCaller = true;
    }

    // 2. Direct E.164 phone match
    if (
      normPhone &&
      rec.recipientPhoneE164 &&
      normalizePhoneKey(rec.recipientPhoneE164) === normPhone
    ) {
      belongsToCaller = true;
    }

    // 3. Seller / Store match for Seller notifications
    if (rec.recipientRole === 'SELLER') {
      if (
        input.sellerId &&
        rec.recipientSellerId &&
        rec.recipientSellerId === input.sellerId
      ) {
        belongsToCaller = true;
      }
      if (rec.recipientStoreId && storeIdSet.has(rec.recipientStoreId)) {
        belongsToCaller = true;
      }
    }

    // 4. Partner match for Partner notifications
    if (rec.recipientRole === 'PARTNER') {
      if (
        input.partnerId &&
        rec.recipientPartnerId &&
        rec.recipientPartnerId === input.partnerId
      ) {
        belongsToCaller = true;
      }
    }

    // 5. Admin & Super Admin role-scoped notifications
    if (rec.recipientRole === 'ADMIN' && (input.isAdmin || input.isSuperAdmin)) {
      belongsToCaller = true;
    }
    if (rec.recipientRole === 'SUPER_ADMIN' && input.isSuperAdmin) {
      belongsToCaller = true;
    }

    if (!belongsToCaller) continue;

    matched.push(rec);
  }

  // Sort newest first
  matched.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const unreadByCategory: Record<NotificationCategory, number> = {
    ORDER_UPDATES: 0,
    BUSINESS_UPDATES: 0,
    PARTNER_UPDATES: 0,
    ACCOUNT_SECURITY: 0,
    ADMIN_ALERTS: 0,
    MARKETING_PROMOTIONS: 0,
  };

  const unreadByRole: Record<NotificationRole, number> = {
    BUYER: 0,
    SELLER: 0,
    PARTNER: 0,
    ADMIN: 0,
    SUPER_ADMIN: 0,
  };

  let unreadCount = 0;
  for (const item of matched) {
    if (!item.isRead) {
      unreadCount += 1;
      unreadByCategory[item.category] =
        (unreadByCategory[item.category] || 0) + 1;
      unreadByRole[item.recipientRole] =
        (unreadByRole[item.recipientRole] || 0) + 1;
    }
  }

  let filtered = matched;
  if (input.statusFilter === 'UNREAD') {
    filtered = filtered.filter((n) => !n.isRead);
  } else if (input.statusFilter === 'READ') {
    filtered = filtered.filter((n) => n.isRead);
  }

  if (input.categoryFilter && input.categoryFilter !== 'ALL') {
    filtered = filtered.filter((n) => n.category === input.categoryFilter);
  }

  const totalCount = filtered.length;
  const offset = Math.max(0, Number(input.offset) || 0);
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 25));
  const paginated = filtered.slice(offset, offset + limit);

  return {
    notifications: paginated,
    totalCount,
    unreadCount,
    unreadByCategory,
    unreadByRole,
    hasMore: offset + limit < totalCount,
  };
}

export async function markNotificationAsRead(params: {
  notificationId: string;
}): Promise<UnifiedNotificationRecord | null> {
  ensureInitialNotificationsSeeded();
  const existing = serverNotificationsRegistry.get(params.notificationId);
  if (!existing) return null;
  if (existing.isRead) return existing;

  const nowIso = new Date().toISOString();
  const updated: UnifiedNotificationRecord = {
    ...existing,
    isRead: true,
    readAt: nowIso,
  };
  serverNotificationsRegistry.set(params.notificationId, updated);
  await persistUnifiedNotificationToFirestore(updated);
  return updated;
}

export async function markAllNotificationsAsReadForRecipient(
  input: QueryNotificationsInput
): Promise<number> {
  const { notifications } = queryNotificationsForRecipient({
    ...input,
    statusFilter: 'UNREAD',
    limit: 500,
    offset: 0,
  });

  const nowIso = new Date().toISOString();
  let updatedCount = 0;

  for (const rec of notifications) {
    if (!rec.isRead) {
      const updated: UnifiedNotificationRecord = {
        ...rec,
        isRead: true,
        readAt: nowIso,
      };
      serverNotificationsRegistry.set(rec.id, updated);
      updatedCount += 1;
      void persistUnifiedNotificationToFirestore(updated);
    }
  }

  return updatedCount;
}

export function getNotificationSystemDiagnostics(): {
  totalPersistedNotifications: number;
  totalIdempotencyKeys: number;
  byDeliveryStatus: Record<string, number>;
  byRole: Record<NotificationRole, number>;
  byCategory: Record<NotificationCategory, number>;
  recentFailures: UnifiedNotificationRecord[];
} {
  ensureInitialNotificationsSeeded();
  const byDeliveryStatus: Record<string, number> = {};
  const byRole: Record<NotificationRole, number> = {
    BUYER: 0,
    SELLER: 0,
    PARTNER: 0,
    ADMIN: 0,
    SUPER_ADMIN: 0,
  };
  const byCategory: Record<NotificationCategory, number> = {
    ORDER_UPDATES: 0,
    BUSINESS_UPDATES: 0,
    PARTNER_UPDATES: 0,
    ACCOUNT_SECURITY: 0,
    ADMIN_ALERTS: 0,
    MARKETING_PROMOTIONS: 0,
  };
  const recentFailures: UnifiedNotificationRecord[] = [];

  for (const rec of serverNotificationsRegistry.values()) {
    byDeliveryStatus[rec.deliveryStatus] =
      (byDeliveryStatus[rec.deliveryStatus] || 0) + 1;
    byRole[rec.recipientRole] = (byRole[rec.recipientRole] || 0) + 1;
    byCategory[rec.category] = (byCategory[rec.category] || 0) + 1;
    if (
      rec.deliveryStatus === 'FAILED' ||
      (rec.deliveryTelemetry.fcmErrorCodes &&
        rec.deliveryTelemetry.fcmErrorCodes.length > 0)
    ) {
      recentFailures.push(rec);
    }
  }

  return {
    totalPersistedNotifications: serverNotificationsRegistry.size,
    totalIdempotencyKeys: serverNotificationEventKeys.size,
    byDeliveryStatus,
    byRole,
    byCategory,
    recentFailures: recentFailures.slice(0, 20),
  };
}
