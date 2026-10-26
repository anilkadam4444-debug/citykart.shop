import {
  doc,
  collection,
  setDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { PlatformFeeLedgerEntry } from './revenue-model';
import { OrderRecord } from './catalog-data';

export const PLATFORM_FEE_RATE = 0.02;
export const PLATFORM_FEE_MAX_PER_UNIT = 70;

/**
 * Calculates the platform fee for a single unit of a product.
 * Business Rule: min(price * 0.02, 70)
 */
export function calculatePlatformFeePerUnit(price: number): number {
  const fee = price * PLATFORM_FEE_RATE;
  return Math.min(fee, PLATFORM_FEE_MAX_PER_UNIT);
}

/**
 * Calculates total platform fee for a specific cart item.
 */
export function calculateItemPlatformFee(
  price: number,
  quantity: number
): number {
  return calculatePlatformFeePerUnit(price) * quantity;
}

export async function accruePlatformFeesForOrder(order: OrderRecord): Promise<void> {
  // Idempotency check: verify if ledger entries already exist for this order
  const ledgerCol = collection(db, 'platformFeeLedger');
  const q = query(ledgerCol, where('orderId', '==', order.id));
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const nowIso = new Date().toISOString();
  const batchPromises = order.items.map((item) => {
    const entry: PlatformFeeLedgerEntry = {
      id: `fee_${order.id}_${item.product.id}`,
      sellerId: order.sellerId,
      orderId: order.id,
      orderItemId: `${order.id}_${item.product.id}`,
      productId: item.product.id,
      unitPrice: item.product.price,
      quantity: item.quantity,
      feeRate: PLATFORM_FEE_RATE,
      feePerUnit: calculatePlatformFeePerUnit(item.product.price),
      totalFee: item.platformFee,
      currency: item.product.currency || 'INR',
      status: 'outstanding',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    return setDoc(doc(db, 'platformFeeLedger', entry.id), entry);
  });
  await Promise.all(batchPromises);
}
