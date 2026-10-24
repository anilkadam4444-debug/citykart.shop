import { db } from './firebase';
import { doc, setDoc, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore';

export interface FcmTokenRecord {
  token: string;
  uid?: string;
  sellerId?: string;
  buyerPhone?: string;
  role?: 'BUYER' | 'SELLER' | 'BOTH';
  userAgent?: string;
  updatedAt: string;
}

// In-memory token store on server
const serverFcmTokensMap = new Map<string, FcmTokenRecord>();

export async function registerFcmToken(record: Omit<FcmTokenRecord, 'updatedAt'> & { updatedAt?: string }): Promise<FcmTokenRecord> {
  const fullRecord: FcmTokenRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  serverFcmTokensMap.set(record.token, fullRecord);

  // Sync to Firestore if in browser/server context safely
  try {
    if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'test') {
      await setDoc(doc(db, 'fcm_tokens', record.token), fullRecord, { merge: true });
    }
  } catch (err) {
    console.warn('[FCM Registry] Could not write token to Firestore:', err);
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

  // Check in-memory store first
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
    if (params.buyerPhone && rec.buyerPhone && rec.buyerPhone.replace(/\s+/g, '') === params.buyerPhone.replace(/\s+/g, '')) {
      matchedTokens.add(token);
    }
  }

  // Also query Firestore for tokens if needed
  try {
    const tokensCol = collection(db, 'fcm_tokens');
    if (params.sellerId) {
      const q = query(tokensCol, where('sellerId', '==', params.sellerId));
      const snap = await getDocs(q);
      snap.forEach((d) => matchedTokens.add(d.id));
    }
    if (params.sellerUid) {
      const q = query(tokensCol, where('uid', '==', params.sellerUid));
      const snap = await getDocs(q);
      snap.forEach((d) => matchedTokens.add(d.id));
    }
    if (params.buyerUid) {
      const q = query(tokensCol, where('uid', '==', params.buyerUid));
      const snap = await getDocs(q);
      snap.forEach((d) => matchedTokens.add(d.id));
    }
  } catch (err) {
    console.warn('[FCM Registry] Could not query Firestore tokens:', err);
  }

  return Array.from(matchedTokens);
}

export async function removeInvalidFcmToken(token: string): Promise<void> {
  serverFcmTokensMap.delete(token);
  try {
    await deleteDoc(doc(db, 'fcm_tokens', token));
  } catch {
    // Ignore
  }
}
