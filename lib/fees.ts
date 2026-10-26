import {
  doc,
  collection,
  setDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { FeeStatus, PlatformFeeLedgerEntry } from './revenue-model';
import { OrderRecord } from './catalog-data';

export const PLATFORM_FEE_RATE = 0.02;
export const PLATFORM_FEE_MAX_PER_UNIT = 70;

declare global {
  var __serverPlatformFeeLedgerRegistry:
    | Map<string, PlatformFeeLedgerEntry>
    | undefined;
}

export const serverPlatformFeeLedgerRegistry: Map<
  string,
  PlatformFeeLedgerEntry
> =
  globalThis.__serverPlatformFeeLedgerRegistry ||
  (globalThis.__serverPlatformFeeLedgerRegistry = new Map<
    string,
    PlatformFeeLedgerEntry
  >());

/**
 * Calculates the platform fee for a single unit of a product.
 * Business Rule: min(price * 0.02, 70), rounded to 2 decimal places.
 */
export function calculatePlatformFeePerUnit(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const fee = Math.min(price * PLATFORM_FEE_RATE, PLATFORM_FEE_MAX_PER_UNIT);
  return Math.round(fee * 100) / 100;
}

/**
 * Calculates total platform fee for a specific cart item.
 * Business Rule: min(price * 0.02, 70) * quantity, rounded to 2 decimal places.
 */
export function calculateItemPlatformFee(
  price: number,
  quantity: number
): number {
  const validQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  if (validQty === 0) return 0;
  return Math.round(calculatePlatformFeePerUnit(price) * validQty * 100) / 100;
}

async function persistLedgerEntry(entry: PlatformFeeLedgerEntry): Promise<void> {
  serverPlatformFeeLedgerRegistry.set(entry.id, entry);
  try {
    await setDoc(doc(db, 'platformFeeLedger', entry.id), entry, { merge: true });
  } catch {
    // Kept in serverPlatformFeeLedgerRegistry if Firestore client rules or network block direct write
  }
}

/**
 * Idempotently accrues 2% platform fees (capped at ₹70/unit) when an order is verified DELIVERED.
 */
export async function accruePlatformFeesForOrder(
  order: OrderRecord
): Promise<PlatformFeeLedgerEntry[]> {
  if (!order || !order.id || !Array.isArray(order.items) || order.items.length === 0) {
    return [];
  }

  // 1. Check in-memory registry for existing non-reversed entries for this order
  const existingInMemory = Array.from(serverPlatformFeeLedgerRegistry.values()).filter(
    (e) => e.orderId === order.id && e.status !== 'reversed'
  );
  if (existingInMemory.length >= order.items.length) {
    return existingInMemory;
  }

  // 2. Check Firestore for existing entries
  try {
    const ledgerCol = collection(db, 'platformFeeLedger');
    const q = query(ledgerCol, where('orderId', '==', order.id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const existing: PlatformFeeLedgerEntry[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as PlatformFeeLedgerEntry;
        serverPlatformFeeLedgerRegistry.set(data.id, data);
        if (data.status !== 'reversed') {
          existing.push(data);
        }
      });
      if (existing.length > 0) return existing;
    }
  } catch {
    // Proceed with accrual using in-memory + fallback persistence
  }

  const nowIso = new Date().toISOString();
  const createdEntries: PlatformFeeLedgerEntry[] = [];

  for (const item of order.items) {
    const unitPrice = Number(item.product?.price) || 0;
    const quantity = Number(item.quantity) || 0;
    const feePerUnit = calculatePlatformFeePerUnit(unitPrice);
    const totalFee =
      typeof item.platformFee === 'number' && Number.isFinite(item.platformFee)
        ? Math.round(item.platformFee * 100) / 100
        : calculateItemPlatformFee(unitPrice, quantity);

    const entryId = `fee_${order.id}_${item.product.id}`;
    const entry: PlatformFeeLedgerEntry = {
      id: entryId,
      sellerId: order.sellerId,
      orderId: order.id,
      orderItemId: `${order.id}_${item.product.id}`,
      productId: item.product.id,
      unitPrice,
      quantity,
      feeRate: PLATFORM_FEE_RATE,
      feePerUnit,
      totalFee,
      currency: item.product.currency || 'INR',
      status: 'outstanding',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    createdEntries.push(entry);
    await persistLedgerEntry(entry);
  }

  return createdEntries;
}

/**
 * Fetches all platform fee ledger entries for a seller, merging Firestore and in-memory state.
 */
export async function getSellerPlatformFees(
  sellerId: string,
  statusFilter?: FeeStatus
): Promise<PlatformFeeLedgerEntry[]> {
  const merged = new Map<string, PlatformFeeLedgerEntry>();

  for (const entry of serverPlatformFeeLedgerRegistry.values()) {
    if (entry.sellerId === sellerId) {
      merged.set(entry.id, entry);
    }
  }

  try {
    const ledgerCol = collection(db, 'platformFeeLedger');
    const q = query(ledgerCol, where('sellerId', '==', sellerId));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data() as PlatformFeeLedgerEntry;
      if (data && data.id) {
        merged.set(data.id, data);
        serverPlatformFeeLedgerRegistry.set(data.id, data);
      }
    });
  } catch {
    // Return in-memory entries if Firestore is unreachable or restricted
  }

  const results = Array.from(merged.values()).filter((entry) =>
    statusFilter ? entry.status === statusFilter : true
  );
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}

/**
 * Reserves all 'outstanding' platform fees for a seller in the matching currency
 * and binds them to an invoiceNumber during subscription checkout.
 */
export async function reserveSellerOutstandingFeesForInvoice(
  sellerId: string,
  currency: string,
  invoiceNumber: string
): Promise<{
  outstandingFees: number;
  reservedEntries: PlatformFeeLedgerEntry[];
}> {
  const allEntries = await getSellerPlatformFees(sellerId);
  const nowIso = new Date().toISOString();
  let outstandingFees = 0;
  const reservedEntries: PlatformFeeLedgerEntry[] = [];

  for (const entry of allEntries) {
    if (
      (entry.status === 'outstanding' ||
        (entry.status === 'reserved_for_invoice' &&
          entry.invoiceNumber === invoiceNumber)) &&
      entry.currency === currency
    ) {
      outstandingFees = Math.round((outstandingFees + entry.totalFee) * 100) / 100;
      const updated: PlatformFeeLedgerEntry = {
        ...entry,
        status: 'reserved_for_invoice',
        invoiceNumber,
        updatedAt: nowIso,
      };
      reservedEntries.push(updated);
      await persistLedgerEntry(updated);
    }
  }

  return { outstandingFees, reservedEntries };
}

/**
 * Calculates the total reserved platform fees for a given invoiceNumber (or sellerId).
 */
export async function getReservedFeesForInvoice(
  sellerId: string,
  invoiceNumber?: string,
  currency: string = 'INR'
): Promise<{ reservedFeeTotal: number; entries: PlatformFeeLedgerEntry[] }> {
  const allEntries = await getSellerPlatformFees(sellerId);
  const matching = allEntries.filter((entry) => {
    if (entry.currency !== currency) return false;
    if (invoiceNumber && entry.invoiceNumber === invoiceNumber) {
      return entry.status === 'reserved_for_invoice' || entry.status === 'paid';
    }
    return entry.status === 'reserved_for_invoice';
  });

  const reservedFeeTotal = matching.reduce(
    (sum, item) => Math.round((sum + item.totalFee) * 100) / 100,
    0
  );
  return { reservedFeeTotal, entries: matching };
}

/**
 * Marks reserved platform fee entries as 'paid' once subscription payment is verified or captured.
 */
export async function markInvoicePlatformFeesPaid(
  sellerId: string,
  invoiceNumber?: string,
  transactionId?: string
): Promise<{ paidFeeTotal: number; count: number }> {
  const allEntries = await getSellerPlatformFees(sellerId);
  const nowIso = new Date().toISOString();
  let paidFeeTotal = 0;
  let count = 0;

  for (const entry of allEntries) {
    const matchesInvoice = invoiceNumber
      ? entry.invoiceNumber === invoiceNumber &&
        (entry.status === 'reserved_for_invoice' || entry.status === 'outstanding')
      : entry.status === 'reserved_for_invoice';

    if (matchesInvoice) {
      paidFeeTotal = Math.round((paidFeeTotal + entry.totalFee) * 100) / 100;
      count += 1;
      const updated: PlatformFeeLedgerEntry = {
        ...entry,
        status: 'paid',
        paidByTransactionId: transactionId || entry.paidByTransactionId,
        updatedAt: nowIso,
      };
      await persistLedgerEntry(updated);
    }
  }

  return { paidFeeTotal, count };
}

/**
 * Releases 'reserved_for_invoice' fees back to 'outstanding' if a payment fails.
 */
export async function releaseReservedInvoicePlatformFees(
  sellerId: string,
  invoiceNumber?: string
): Promise<number> {
  const allEntries = await getSellerPlatformFees(sellerId);
  const nowIso = new Date().toISOString();
  let count = 0;

  for (const entry of allEntries) {
    if (
      entry.status === 'reserved_for_invoice' &&
      (!invoiceNumber || entry.invoiceNumber === invoiceNumber)
    ) {
      count += 1;
      const updated: PlatformFeeLedgerEntry = {
        ...entry,
        status: 'outstanding',
        invoiceNumber: undefined,
        updatedAt: nowIso,
      };
      await persistLedgerEntry(updated);
    }
  }

  return count;
}

/**
 * Reverses any unpaid platform fees for an order if the order is cancelled or refunded.
 */
export async function reversePlatformFeesForOrder(orderId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  let count = 0;

  for (const entry of serverPlatformFeeLedgerRegistry.values()) {
    if (entry.orderId === orderId && entry.status !== 'paid' && entry.status !== 'reversed') {
      count += 1;
      const updated: PlatformFeeLedgerEntry = {
        ...entry,
        status: 'reversed',
        updatedAt: nowIso,
      };
      await persistLedgerEntry(updated);
    }
  }

  return count;
}
