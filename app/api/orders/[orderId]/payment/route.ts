import { NextRequest, NextResponse } from 'next/server';
import {
  INITIAL_STORES,
  LocalStore,
  OrderRecord,
  PaymentMethod,
  PaymentStatus,
} from '@/lib/catalog-data';
import { serverOrdersRegistry } from '@/lib/orders-registry';
import { serverStoresRegistry } from '@/lib/stores-registry';
import {
  recordDeliveryPinAuditLog,
  sanitizeOrderForStorageAndListing,
  verifySellerOrDeliveryOrderAccess,
} from '@/lib/delivery-pin';
import { generateDynamicUpiQrForOrder } from '@/lib/upi-qr';
import { notifyOrderPaymentUpdated } from '@/lib/notification-events';

async function loadOrderById(orderId: string): Promise<OrderRecord | null> {
  const fromMem = serverOrdersRegistry.get(orderId);
  if (fromMem) return fromMem;
  return null;
}

async function loadStoreById(storeId: string): Promise<LocalStore | null> {
  const fromMem = serverStoresRegistry.get(storeId);
  if (fromMem) return fromMem;
  const fromInit = INITIAL_STORES.find((s) => s.id === storeId);
  if (fromInit) return fromInit;
  return null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'Order ID is required.' }, { status: 400 });
  }

  const order = await loadOrderById(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: `Order #${orderId} not found.` }, { status: 404 });
  }

  const store = await loadStoreById(order.storeId);
  const qrPayload = generateDynamicUpiQrForOrder({ order, store });

  if (!qrPayload.ok) {
    return NextResponse.json(
      { ok: false, error: qrPayload.error, paymentStatus: order.paymentStatus || 'PENDING' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    paymentStatus: order.paymentStatus || 'PENDING',
    qr: qrPayload,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const body = await req.json();
    const {
      paymentStatus,
      actorSellerId,
      collectionMethod,
      referenceNote,
    }: {
      paymentStatus?: PaymentStatus;
      actorSellerId?: string;
      collectionMethod?: string;
      referenceNote?: string;
    } = body || {};

    const validStatuses: PaymentStatus[] = ['PENDING', 'PAID', 'DISPUTED'];
    if (!paymentStatus || !validStatuses.includes(paymentStatus)) {
      return NextResponse.json(
        { ok: false, error: 'Valid paymentStatus (PENDING, PAID, or DISPUTED) is required.' },
        { status: 400 }
      );
    }

    const existingOrder = await loadOrderById(orderId);
    if (!existingOrder) {
      return NextResponse.json({ ok: false, error: `Order #${orderId} not found.` }, { status: 404 });
    }

    // 1. Verify strict Seller / Delivery Agent / Admin authorization (Buyers cannot mark orders as PAID)
    const accessCheck = await verifySellerOrDeliveryOrderAccess(req, existingOrder, actorSellerId);
    if (!accessCheck.authorized) {
      return NextResponse.json(
        {
          ok: false,
          error:
            accessCheck.reason ||
            'Unauthorized: Only the store seller or authorized delivery person can record payment collection.',
        },
        { status: accessCheck.statusCode }
      );
    }

    // 2. Block payment collection on cancelled or rejected orders
    if (existingOrder.orderStatus === 'CANCELLED' || existingOrder.orderStatus === 'REJECTED') {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot record payment for Order #${orderId} because it is ${existingOrder.orderStatus}.`,
        },
        { status: 400 }
      );
    }

    // 3. Prevent duplicate payment confirmation when already PAID
    if (existingOrder.paymentStatus === 'PAID' && paymentStatus === 'PAID') {
      return NextResponse.json(
        {
          ok: false,
          error: `Order #${orderId} has already been marked as PAID. Duplicate payment confirmation is blocked.`,
        },
        { status: 409 }
      );
    }

    // 4. Validate delivery-stage collection method (Strictly Cash on Delivery or UPI on Delivery)
    const rawMethod = (
      collectionMethod ||
      existingOrder.paymentCollectionMethod ||
      existingOrder.paymentMethod ||
      'CASH_ON_DELIVERY'
    )
      .toString()
      .trim()
      .toUpperCase();

    if (rawMethod === 'TAP_ON_DELIVERY' || rawMethod.includes('CARD')) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Card payment on delivery is not supported. Only Cash on Delivery (COD) and UPI on Delivery are allowed.',
        },
        { status: 400 }
      );
    }

    const resolvedCollectionMethod: PaymentMethod =
      rawMethod === 'UPI_ON_DELIVERY' ? 'UPI_ON_DELIVERY' : 'CASH_ON_DELIVERY';

    const nowIso = new Date().toISOString();
    const updatedOrder: OrderRecord = {
      ...existingOrder,
      paymentStatus,
      paymentMethod: paymentStatus === 'PAID' ? resolvedCollectionMethod : existingOrder.paymentMethod,
      paymentCollectionMethod: paymentStatus === 'PAID' ? resolvedCollectionMethod : undefined,
      paymentCollectedAt: paymentStatus === 'PAID' ? nowIso : undefined,
      paymentCollectedBy: paymentStatus === 'PAID' ? accessCheck.actorId : undefined,
      paymentReferenceNote: referenceNote || existingOrder.paymentReferenceNote,
    };

    const sanitized = sanitizeOrderForStorageAndListing(updatedOrder);
    serverOrdersRegistry.set(orderId, sanitized);

    await notifyOrderPaymentUpdated({
      order: sanitized,
      paymentStatus,
      collectionMethod: resolvedCollectionMethod,
      referenceNote,
    });

    await recordDeliveryPinAuditLog({
      orderId: existingOrder.id,
      storeId: existingOrder.storeId,
      sellerId: existingOrder.sellerId,
      eventType: 'PAYMENT_STATUS_UPDATED',
      actorId: accessCheck.actorId,
      actorRole: accessCheck.actorRole,
      pinVersion: existingOrder.deliveryPinInfo?.pinVersion || 1,
      summary: `Order #${orderId} payment status updated to ${paymentStatus}.`,
    });

    return NextResponse.json({
      ok: true,
      message:
        paymentStatus === 'PAID'
          ? resolvedCollectionMethod === 'UPI_ON_DELIVERY'
            ? `UPI payment of ₹${existingOrder.total} verified and recorded for Order #${orderId}.`
            : `Cash payment of ₹${existingOrder.total} recorded for Order #${orderId}.`
          : `Order #${orderId} payment status updated to ${paymentStatus}.`,
      order: sanitized,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to update order payment status.' },
      { status: 500 }
    );
  }
}
