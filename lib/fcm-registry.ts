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

export interface FcmTokenRecord {
  token: string;
  uid?: string;
  sellerId?: string;
  buyerPhone?: string;
  role?: 'BUYER' | 'SELLER' | 'BOTH';
  deviceId?: string;
  userAgent?: string;
  updatedAt: string;
}

// In-memory token store on server (keyed by raw FCM token)
const serverFcmTokensMap = new Map<string, FcmTokenRecord>();

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
  return cleaned.length > 0 ? cleaned : undefined;
}

export async function registerFcmToken(
  record: Omit<FcmTokenRecord, 'updatedAt'> & {updatedAt?: string}
): Promise<FcmTokenRecord> {
  const cleanToken = record.token.trim();
  const normalizedPhone = normalizePhoneKey(record.buyerPhone);

  const fullRecord: FcmTokenRecord = {
    token: cleanToken,
    ...(record.uid ? {uid: record.uid.trim()} : {}),
    ...(record.sellerId ? {sellerId: record.sellerId.trim()} : {}),
    ...(normalizedPhone ? {buyerPhone: normalizedPhone} : {}),
    role: record.role || 'BUYER',
    ...(record.deviceId ? {deviceId: record.deviceId.trim()} : {}),
    ...(record.userAgent ? {userAgent: record.userAgent.slice(0, 250)} : {}),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };

  serverFcmTokensMap.set(cleanToken, fullRecord);

  // Persist to Firestore (/fcm_tokens/{safeDocId}) for cross-instance durability
  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      const safeDocId = toSafeTokenDocId(cleanToken);
      await setDoc(doc(db, 'fcm_tokens', safeDocId), fullRecord, {merge: true});
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
  buyerPhone?: string;
}): Promise<string[]> {
  const matchedTokens = new Set<string>();
  const normalizedTargetPhone = normalizePhoneKey(params.buyerPhone);

  // 1. Check in-memory store
  for (const [token, rec] of serverFcmTokensMap.entries()) {
    if (params.sellerId && rec.sellerId === params.sellerId) {
      matchedTokens.add(token);
    }
    if (params.sellerUid && rec.uid === params.sellerUid) {
      matchedTokens.add(token);
    }
    if (params.buyerUid && rec.uid === params.buyerUid) {
      matchedTokens.add(token);
    }
    if (
      normalizedTargetPhone &&
      rec.buyerPhone &&
      normalizePhoneKey(rec.buyerPhone) === normalizedTargetPhone
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
    if (params.sellerUid) {
      queries.push(
        getDocs(query(tokensCol, where('uid', '==', params.sellerUid)))
      );
    }
    if (params.buyerUid) {
      queries.push(
        getDocs(query(tokensCol, where('uid', '==', params.buyerUid)))
      );
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
            buyerPhone: data.buyerPhone,
            role: data.role,
            deviceId: data.deviceId,
            userAgent: data.userAgent,
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
  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      const safeDocId = toSafeTokenDocId(cleanToken);
      await deleteDoc(doc(db, 'fcm_tokens', safeDocId));
    } catch {
      // Ignore cleanup errors
    }
  }
}
