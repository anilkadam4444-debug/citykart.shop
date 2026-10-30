import { db, IS_PREVIEW_DUMMY_FIREBASE } from './firebase';
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  deleteDoc,
} from 'firebase/firestore';

export type FcmRecipientRole =
  | 'BUYER'
  | 'SELLER'
  | 'PARTNER'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'BOTH';

export interface FcmTokenRecord {
  token: string;
  uid?: string;
  sellerId?: string;
  partnerId?: string;
  buyerPhone?: string;
  phoneE164?: string;
  role?: FcmRecipientRole;
  roles?: string[];
  deviceId?: string;
  userAgent?: string;
  createdAt?: string;
  updatedAt: string;
  lastValidatedAt?: string;
}

declare global {
  var __serverFcmTokensMap: Map<string, FcmTokenRecord> | undefined;
}

// Persistent in-memory token store on server (keyed by raw FCM token)
export const serverFcmTokensMap: Map<string, FcmTokenRecord> =
  globalThis.__serverFcmTokensMap ||
  (globalThis.__serverFcmTokensMap = new Map<string, FcmTokenRecord>());

/**
 * Converts a raw FCM registration token into a Firestore-safe document ID
 * so tokens containing '/', '+', or ':' never fail Firestore path validation,
 * while supporting multiple devices per user without overwriting each other.
 */
export function toSafeTokenDocId(rawToken: string): string {
  return rawToken
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 240);
}

export function normalizePhoneKey(phone?: string): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[^\d+]/g, '').trim();
  if (!cleaned) return undefined;
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

export async function registerFcmToken(
  record: Omit<FcmTokenRecord, 'updatedAt'> & { updatedAt?: string }
): Promise<FcmTokenRecord> {
  const cleanToken = record.token.trim();
  const normalizedPhone = normalizePhoneKey(
    record.phoneE164 || record.buyerPhone
  );
  const nowIso = record.updatedAt || new Date().toISOString();

  // Deduplicate any stale token from the same deviceId + uid/phone so rotated tokens don't pile up
  if (record.deviceId) {
    for (const [existingTok, existingRec] of serverFcmTokensMap.entries()) {
      if (
        existingTok !== cleanToken &&
        existingRec.deviceId === record.deviceId &&
        ((record.uid && existingRec.uid === record.uid) ||
          (normalizedPhone &&
            normalizePhoneKey(existingRec.phoneE164 || existingRec.buyerPhone) ===
              normalizedPhone))
      ) {
        serverFcmTokensMap.delete(existingTok);
      }
    }
  }

  const existing = serverFcmTokensMap.get(cleanToken);
  const resolvedRole: FcmRecipientRole = record.role || existing?.role || 'BUYER';
  const mergedRoles = Array.from(
    new Set([
      ...(existing?.roles || []),
      ...(record.roles || []),
      resolvedRole,
    ])
  );

  const fullRecord: FcmTokenRecord = {
    token: cleanToken,
    ...(record.uid || existing?.uid
      ? { uid: (record.uid || existing?.uid)!.trim() }
      : {}),
    ...(record.sellerId || existing?.sellerId
      ? { sellerId: (record.sellerId || existing?.sellerId)!.trim() }
      : {}),
    ...(record.partnerId || existing?.partnerId
      ? { partnerId: (record.partnerId || existing?.partnerId)!.trim() }
      : {}),
    ...(normalizedPhone
      ? { buyerPhone: normalizedPhone, phoneE164: normalizedPhone }
      : {}),
    role: resolvedRole,
    roles: mergedRoles,
    ...(record.deviceId || existing?.deviceId
      ? { deviceId: (record.deviceId || existing?.deviceId)!.trim() }
      : {}),
    ...(record.userAgent || existing?.userAgent
      ? { userAgent: (record.userAgent || existing?.userAgent)!.slice(0, 250) }
      : {}),
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
    lastValidatedAt: nowIso,
  };

  serverFcmTokensMap.set(cleanToken, fullRecord);

  // Persist to Firestore (/fcm_tokens/{safeDocId}) for cross-instance durability
  const safeDocId = toSafeTokenDocId(cleanToken);
  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      await setDoc(doc(db, 'fcm_tokens', safeDocId), fullRecord, {
        merge: true,
      });
    } catch (err) {
      console.warn('[FCM Registry] Could not write token to Firestore:', err);
    }
  }

  return fullRecord;
}

export async function getFcmTokensForRecipient(params: {
  sellerId?: string;
  sellerUid?: string;
  buyerUid?: string;
  uid?: string;
  partnerId?: string;
  buyerPhone?: string;
  phoneE164?: string;
  role?: FcmRecipientRole;
}): Promise<string[]> {
  const matchedTokens = new Set<string>();
  const normalizedTargetPhone = normalizePhoneKey(
    params.phoneE164 || params.buyerPhone
  );
  const targetUid = params.uid || params.buyerUid || params.sellerUid;

  // 1. Check in-memory store
  for (const [token, rec] of serverFcmTokensMap.entries()) {
    if (params.sellerId && rec.sellerId === params.sellerId) {
      matchedTokens.add(token);
    }
    if (params.partnerId && rec.partnerId === params.partnerId) {
      matchedTokens.add(token);
    }
    if (targetUid && rec.uid === targetUid) {
      matchedTokens.add(token);
    }
    if (
      normalizedTargetPhone &&
      normalizePhoneKey(rec.phoneE164 || rec.buyerPhone) ===
        normalizedTargetPhone
    ) {
      matchedTokens.add(token);
    }
    if (
      params.role &&
      (params.role === 'ADMIN' || params.role === 'SUPER_ADMIN') &&
      (rec.role === params.role || rec.roles?.includes(params.role))
    ) {
      matchedTokens.add(token);
    }
  }

  // 2. Query Firestore /fcm_tokens collection for multi-device durability
  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      const tokensCol = collection(db, 'fcm_tokens');
      const queries = [];

      if (params.sellerId) {
        queries.push(
          getDocs(query(tokensCol, where('sellerId', '==', params.sellerId)))
        );
      }
      if (params.partnerId) {
        queries.push(
          getDocs(query(tokensCol, where('partnerId', '==', params.partnerId)))
        );
      }
      if (targetUid) {
        queries.push(getDocs(query(tokensCol, where('uid', '==', targetUid))));
      }
      if (normalizedTargetPhone) {
        queries.push(
          getDocs(
            query(tokensCol, where('buyerPhone', '==', normalizedTargetPhone))
          )
        );
      }

      const snapshots = await Promise.all(queries);
      for (const snap of snapshots) {
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Partial<FcmTokenRecord>;
          const rawTok =
            typeof data?.token === 'string' && data.token.trim().length > 0
              ? data.token.trim()
              : docSnap.id;
          matchedTokens.add(rawTok);
          if (data?.token) {
            serverFcmTokensMap.set(rawTok, {
              token: rawTok,
              uid: data.uid,
              sellerId: data.sellerId,
              partnerId: data.partnerId,
              buyerPhone: data.buyerPhone,
              phoneE164: data.phoneE164 || data.buyerPhone,
              role: data.role,
              roles: data.roles,
              deviceId: data.deviceId,
              userAgent: data.userAgent,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt || new Date().toISOString(),
            });
          }
        });
      }
    } catch (err) {
      console.warn('[FCM Registry] Could not query Firestore tokens:', err);
    }
  }

  return Array.from(matchedTokens);
}

export async function removeInvalidFcmToken(token: string): Promise<void> {
  const cleanToken = token.trim();
  if (!cleanToken) return;
  serverFcmTokensMap.delete(cleanToken);
  const safeDocId = toSafeTokenDocId(cleanToken);
  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      await deleteDoc(doc(db, 'fcm_tokens', safeDocId));
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function getAllRegisteredFcmTokensSummary(): {
  totalTokens: number;
  byRole: Record<string, number>;
} {
  const byRole: Record<string, number> = {
    BUYER: 0,
    SELLER: 0,
    PARTNER: 0,
    ADMIN: 0,
    SUPER_ADMIN: 0,
  };
  for (const rec of serverFcmTokensMap.values()) {
    const r = rec.role || 'BUYER';
    byRole[r] = (byRole[r] || 0) + 1;
  }
  return {
    totalTokens: serverFcmTokensMap.size,
    byRole,
  };
}
