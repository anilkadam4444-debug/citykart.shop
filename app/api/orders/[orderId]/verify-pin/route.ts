import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db, syncOrderToFirestore } from '@/lib/firebase';
import { OrderRecord, OrderStatusHistoryEvent } from '@/lib/catalog-data';
import {
  SellerNotification,
  serverNotificationsRegistry,
  serverOrdersRegistry,
} from '@/lib/orders-registry';
import {
  sanitizeOrderForStorageAndListing,
  verifyOrderDeliveryPinAtomically,
  verifySellerOrDeliveryOrderAccess,
} from '@/lib/delivery-pin';
import { accruePlatformFeesForOrder } from '@/lib/fees';

interface VerifyPinRequestBody {
  pin: string;
  actorSellerId?: string;
  deliveryActorName?: string;
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

    const body = (await req.json()) as VerifyPinRequestBody;
    const submittedPin = String(body.pin || '').trim();
    const actorSellerId = body.actorSellerId
      ? String(body.actorSellerId).trim()
      : undefined;
    const deliveryActorName = body.deliveryActorName
      ? String(body.deliveryActorName).trim()
      : undefined;

    // 1. Load order from server registry or Firestore
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

    // 2. Verify Seller / Delivery Actor Authorization
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
            'Unauthorized: Only the store seller or assigned delivery person can verify delivery for this order.',
          errorCode: 'UNAUTHORIZED_SELLER_OR_DELIVERY_ACTOR',
        },
        { status: accessCheck.statusCode }
      );
    }

    // 3. Atomically verify the 6-digit Delivery PIN
    const pinVerification = await verifyOrderDeliveryPinAtomically({
      order,
      submittedPin,
      actorId: deliveryActorName
        ? `${accessCheck.actorId} (${deliveryActorName})`
        : accessCheck.actorId,
      actorRole: accessCheck.actorRole,
    });

    if (!pinVerification.ok) {
      // Persist updated attempt count / lock status on the order summary
      if (pinVerification.pinInfo) {
        const updatedWithAttempt = sanitizeOrderForStorageAndListing({
          ...order,
          deliveryPinInfo: pinVerification.pinInfo,
        });
        serverOrdersRegistry.set(orderId, updatedWithAttempt);
        await syncOrderToFirestore(updatedWithAttempt);
      }

      return NextResponse.json(
        {
          ok: false,
          error: pinVerification.error,
          errorCode: pinVerification.errorCode,
          remainingAttempts: pinVerification.remainingAttempts,
          deliveryPinInfo: pinVerification.pinInfo,
        },
        { status: pinVerification.statusCode }
      );
    }

    // 4. Verification succeeded: transition orderStatus to DELIVERED
    // CRITICAL RULE: Delivery PIN confirms delivery ONLY. It NEVER automatically marks paymentStatus as PAID.
    const verifiedAtIso = pinVerification.verifiedAt || new Date().toISOString();
    const preservedPaymentStatus = order.paymentStatus || 'PENDING';

    const historyEvent: OrderStatusHistoryEvent = {
      status: 'DELIVERED',
      timestamp: verifiedAtIso,
      note: `Delivery verified via buyer 6-digit Delivery PIN (v${pinVerification.pinInfo?.pinVersion || 1}). Payment status: ${preservedPaymentStatus}.`,
      actor: 'SELLER',
    };

    const deliveredOrder: OrderRecord = sanitizeOrderForStorageAndListing({
      ...order,
      orderStatus: 'DELIVERED',
      currentStepIndex: 3,
      deliveredAt: verifiedAtIso,
      deliveredByActor: accessCheck.actorId,
      deliveryPinVerified: true,
      deliveryPinInfo: pinVerification.pinInfo,
      paymentStatus: preservedPaymentStatus,
      statusHistory: [...(order.statusHistory || []), historyEvent],
    });

    serverOrdersRegistry.set(orderId, deliveredOrder);
    await syncOrderToFirestore(deliveredOrder);

    // Accrue platform fees on delivery confirmation
    await accruePlatformFeesForOrder(deliveredOrder);

    // Record in-app notification for seller ledger
    const notifId = `notif-${orderId}-delivered-pin`;
    const deliveredNotif: SellerNotification = {
      id: notifId,
      sellerId: order.sellerId,
      sellerUid: order.sellerUid,
      orderId,
      title: `Order #${orderId} Delivery Verified`,
      message: `Delivery of order #${orderId} to ${order.customer.fullName} was verified via 6-digit Delivery PIN. Payment status: ${preservedPaymentStatus}.`,
      type: 'ORDER_STATUS_CHANGED',
      isRead: false,
      createdAt: verifiedAtIso,
    };
    serverNotificationsRegistry.set(notifId, deliveredNotif);

    return NextResponse.json({
      ok: true,
      order: deliveredOrder,
      deliveryPinInfo: pinVerification.pinInfo,
      paymentStatus: preservedPaymentStatus,
      message: `Delivery PIN verified! Order #${orderId} is now marked as Delivered. Note: Delivery PIN confirms delivery only; payment status remains ${preservedPaymentStatus}.`,
    });
  } catch (error) {
    console.error('Error verifying delivery PIN:', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error while verifying Delivery PIN.',
      },
      { status: 500 }
    );
  }
}
