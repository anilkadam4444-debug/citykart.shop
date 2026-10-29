export const PLATFORM_FEE_INR = 10;

export function calculateOrderFees(subtotalInr: number, deliveryFeeInr = 0, discountInr = 0) {
  const safeSubtotal = Math.max(0, Number(subtotalInr) || 0);
  const safeDelivery = Math.max(0, Number(deliveryFeeInr) || 0);
  const safeDiscount = Math.max(0, Number(discountInr) || 0);
  const platformFee = safeSubtotal > 0 ? PLATFORM_FEE_INR : 0;
  const total = Math.max(0, safeSubtotal + safeDelivery + platformFee - safeDiscount);
  return {
    subtotal: safeSubtotal,
    deliveryFee: safeDelivery,
    platformFee,
    discount: safeDiscount,
    total,
  };
}

export type FeeStatus =
  | 'COLLECTED'
  | 'PENDING'
  | 'REFUNDED'
  | 'PAID'
  | 'paid'
  | 'reversed'
  | 'outstanding'
  | 'pending_eligibility'
  | 'reserved_for_invoice';

export interface PlatformFeeLedgerEntry {
  id: string;
  orderId: string;
  storeId: string;
  sellerId?: string;
  amount: number;
  totalFee?: number;
  currency?: string;
  status: FeeStatus;
  createdAt: string;
  updatedAt?: string;
  paidByTransactionId?: string;
}

declare global {
  var __serverPlatformFeeLedgerRegistry: Map<string, PlatformFeeLedgerEntry> | undefined;
}

if (!globalThis.__serverPlatformFeeLedgerRegistry) {
  globalThis.__serverPlatformFeeLedgerRegistry = new Map<string, PlatformFeeLedgerEntry>();
}

export const serverPlatformFeeLedgerRegistry = globalThis.__serverPlatformFeeLedgerRegistry;

export async function getReservedFeesForInvoice(
  _sellerId: string,
  _invoiceId?: string,
  _currency?: string
) {
  const entries = Array.from(serverPlatformFeeLedgerRegistry.values()).filter(
    (e) => e.sellerId === _sellerId
  );
  const reservedFeeTotal = entries.reduce(
    (sum, e) => sum + Number(e.totalFee ?? e.amount ?? 0),
    0
  );
  return Object.assign(entries, { reservedFeeTotal, entries });
}

export async function markInvoicePlatformFeesPaid(
  _sellerId: string,
  _invoiceIdOrTxId?: string,
  _transactionId?: string
) {
  for (const entry of serverPlatformFeeLedgerRegistry.values()) {
    if (entry.sellerId === _sellerId) {
      entry.status = 'PAID';
      entry.paidByTransactionId = _transactionId || _invoiceIdOrTxId;
      entry.updatedAt = new Date().toISOString();
    }
  }
  return { ok: true };
}

export async function reserveSellerOutstandingFeesForInvoice(
  _sellerId: string,
  _currencyOrInvoiceId?: string,
  _invoiceId?: string
) {
  const entries = Array.from(serverPlatformFeeLedgerRegistry.values()).filter(
    (e) => e.sellerId === _sellerId && (e.status === 'PENDING' || e.status === 'outstanding')
  );
  const outstandingFees = entries.reduce(
    (sum, e) => sum + Number(e.totalFee ?? e.amount ?? 0),
    0
  );
  return { ok: true, outstandingFees, entries };
}

export async function releaseReservedInvoicePlatformFees(
  _sellerId: string,
  _invoiceId?: string
) {
  return { ok: true };
}

