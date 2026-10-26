import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db, syncOrderToFirestore } from '@/lib/firebase';
import {
  OrderRecord,
  OrderStatusHistoryEvent,
  PaymentMethod,
  PaymentStatus,
} from '@/lib/catalog-data';
import { serverOrdersRegistry } from '@/lib/orders-registry';
import {
  recordDeliveryPinAuditLog,
  sanitizeOrderForStorageAndListing,
  verifySellerOrDeliveryOrderAccess,
} from '@/lib/delivery-pin';

interface UpdatePaymentStatusBody {
  paymentStatus: PaymentStatus;
  paymentCollectionMethod?: PaymentMethod;
  paymentReferenceNote?: string;
  actorSellerId?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: 'Order ID is required.' },
        { status: 400 }
      );
    }

    const body = (await req.json()) as UpdatePaymentStatusBody;
    const {
      paymentStatus,
      paymentCollectionMethod,
      paymentReferenceNote,
      actorSellerId,
    } = body;

    if (!['PENDING', 'PAID', 'DISPUTED'].includes(paymentStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid paymentStatus. Allowed values are PENDING, PAID, or DISPUTED.',
        },
        { status: 400 }
      );
    }

    let order = serverOrdersRegistry.get(orderId);
    if (!order) {
      try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) {
          order = snap.data() as OrderRecord;
          serverOrdersRegistry.set(orderId, order);
        }
      } catch {
        // Ignore read fallback error
      }
    }

    if (!order) {
      return NextResponse.json(
        { ok: false, error: `Order #${orderId} not found.` },
        { status: 404 }
      );
    }

    const accessCheck = await verifySellerOrDeliveryOrderAccess(
      req,
      order,
      actorSellerId
    );
    if (!accessCheck.authorized) {
      return NextResponse.json(
        {
          ok: false,
          error:
            accessCheck.reason ||
            'Unauthorized: Only the store seller or authorized delivery person can update payment collection status.',
        },
        { status: accessCheck.statusCode }
      );
    }

    if (
      order.orderStatus === 'CANCELLED' ||
      order.orderStatus === 'REJECTED'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot record payment collection for a ${order.orderStatus} order.`,
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const resolvedMethod = paymentCollectionMethod || order.paymentMethod;
    const cleanRef = paymentReferenceNote
      ? String(paymentReferenceNote).trim().slice(0, 160)
      : undefined;

    const noteLabel =
      paymentStatus === 'PAID'
        ? resolvedMethod === 'CASH_ON_DELIVERY'
          ? `Cash on Delivery (₹${order.total}) collected at doorstep${cleanRef ? ` — ${cleanRef}` : ''}`
          : resolvedMethod === 'UPI_ON_DELIVERY'
            ? `UPI on Delivery payment (₹${order.total}) confirmed${cleanRef ? ` (Ref: ${cleanRef})` : ''}`
            : `Payment (₹${order.total}) collected on delivery`
        : paymentStatus === 'DISPUTED'
          ? `Payment marked as Disputed${cleanRef ? `: ${cleanRef}` : ''}`
          : `Payment status set to Pending on Delivery`;

    const historyEvent: OrderStatusHistoryEvent = {
      status: order.orderStatus,
      timestamp: nowIso,
      note: noteLabel,
      actor: 'SELLER',
    };

    const updatedOrder: OrderRecord = sanitizeOrderForStorageAndListing({
      ...order,
      paymentStatus,
      paymentCollectionMethod: resolvedMethod,
      paymentCollectedAt: paymentStatus === 'PAID' ? nowIso : undefined,
      paymentCollectedBy:
        paymentStatus === 'PAID' ? accessCheck.actorId : undefined,
      paymentReferenceNote: cleanRef,
      statusHistory: [...(order.statusHistory || []), historyEvent],
    });

    serverOrdersRegistry.set(orderId, updatedOrder);
    await syncOrderToFirestore(updatedOrder);

    await recordDeliveryPinAuditLog({
      orderId: order.id,
      storeId: order.storeId,
      sellerId: order.sellerId,
      eventType: 'PAYMENT_STATUS_UPDATED',
      actorId: accessCheck.actorId,
      actorRole: accessCheck.actorRole,
      pinVersion: order.deliveryPinInfo?.pinVersion || 1,
      summary: noteLabel,
    });

    return NextResponse.json({
      ok: true,
      order: updatedOrder,
      paymentStatus,
      message: noteLabel,
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal error updating payment status.',
      },
      { status: 500 }
    );
  }
}
