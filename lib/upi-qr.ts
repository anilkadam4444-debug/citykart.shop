import { LocalStore, OrderRecord } from './catalog-data';

export interface DynamicUpiQrResult {
  ok: boolean;
  upiUri?: string;
  qrImageUrl?: string;
  payeeVpa?: string;
  payeeName?: string;
  amount?: number;
  orderId?: string;
  error?: string;
  amountFormatted?: string;
  orderReference?: string;
  merchantName?: string;
  merchantUpiId?: string;
  qrMatrix?: boolean[][];
}

export function buildDynamicUpiUri({
  vpa,
  payeeName,
  amount,
  transactionNote,
  orderId,
}: {
  vpa: string;
  payeeName: string;
  amount: number;
  transactionNote: string;
  orderId: string;
}): string {
  const cleanVpa = vpa.trim();
  const cleanName = payeeName.trim();
  const cleanAmount = amount.toFixed(2);
  const cleanNote = transactionNote.slice(0, 50).trim();

  const params = new URLSearchParams({
    pa: cleanVpa,
    pn: cleanName,
    am: cleanAmount,
    cu: 'INR',
    tn: cleanNote,
    tr: orderId,
  });

  return `upi://pay?${params.toString()}`;
}

export function generateDynamicUpiQrForOrder({
  order,
  store,
  overrideMerchantUpiId,
  overrideMerchantName,
}: {
  order: OrderRecord;
  store?: Pick<LocalStore, 'id' | 'name' | 'sellerName' | 'upiId'> | null;
  overrideMerchantUpiId?: string;
  overrideMerchantName?: string;
}): DynamicUpiQrResult {
  if (!order || !order.id) {
    return { ok: false, error: 'Valid order is required.' };
  }

  const vpa = overrideMerchantUpiId || store?.upiId || order.upiId || 'citykart.pay@okaxis';
  const payeeName = overrideMerchantName || store?.name || order.storeName || 'CityKart Hyperlocal Store';
  const amount = Number(order.total) || 0;

  if (amount <= 0) {
    return { ok: false, error: 'Order total must be greater than zero.' };
  }

  const upiUri = buildDynamicUpiUri({
    vpa,
    payeeName,
    amount,
    transactionNote: `Order ${order.id} Delivery Payment`,
    orderId: order.id,
  });

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    upiUri
  )}`;

  // Generate a mock 21x21 boolean matrix for QR rendering if component expects qrMatrix
  const matrixSize = 21;
  const qrMatrix: boolean[][] = Array.from({ length: matrixSize }, (_, r) =>
    Array.from({ length: matrixSize }, (_, c) => {
      // Finder pattern corners mock
      const isTopLeft = r < 7 && c < 7;
      const isTopRight = r < 7 && c >= matrixSize - 7;
      const isBottomLeft = r >= matrixSize - 7 && c < 7;
      if (isTopLeft || isTopRight || isBottomLeft) {
        return (r % 2 === 0 && c % 2 === 0) || r === 0 || r === 6 || c === 0 || c === 6;
      }
      return (r + c) % 3 === 0;
    })
  );

  const amountFormatted = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    ok: true,
    upiUri,
    qrImageUrl,
    payeeVpa: vpa,
    payeeName,
    amount,
    orderId: order.id,
    amountFormatted,
    orderReference: order.id,
    merchantName: payeeName,
    merchantUpiId: vpa,
    qrMatrix,
  };
}
