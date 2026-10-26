import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db, syncOrderToFirestore } from '@/lib/firebase';
import { OrderRecord } from '@/lib/catalog-data';
import { serverOrdersRegistry } from '@/lib/orders-registry';
import {
  buildUnifiedBuyerOrderAndPinNotification,
  decryptPinFromBuyerVault,
  getOrderDeliveryPinRecord,
  issueDeliveryPinForOrder,
  MANDATORY_BUYER_PIN_WARNING,
  recordDeliveryPinAuditLog,
  sanitizeOrderForStorageAndListing,
  toPublicDeliveryPinInfo,
  verifyBuyerOrderAccess,
} from '@/lib/delivery-pin';

async function loadOrder(orderId: string): Promise<OrderRecord | null> {
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
  return order || null;
}

/**
 * GET /api/orders/[orderId]/pin
 * Exclusively allows the authenticated/verified buyer who placed the order
 * to retrieve their active 6-digit Delivery PIN.
 * Sellers, delivery actors, and other users are strictly blocked (403).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: 'Order ID is required.' },
      { status: 400 }
    );
  }

  const order = await loadOrder(orderId);
  if (!order) {
    return NextResponse.json(
      { ok: false, error: 'Order not found.' },
      { status: 404 }
    );
  }

  const buyerAccess = await verifyBuyerOrderAccess(req, order);
  if (!buyerAccess.authorized) {
    await recordDeliveryPinAuditLog({
      orderId: order.id,
      storeId: order.storeId,
      sellerId: order.sellerId,
      eventType: 'UNAUTHORIZED_PIN_ACCESS_BLOCKED',
      actorId: buyerAccess.actorId,
      actorRole: 'SYSTEM',
      pinVersion: order.deliveryPinInfo?.pinVersion || 1,
      summary: `Blocked unauthorized GET /api/orders/${order.id}/pin attempt.`,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          buyerAccess.reason ||
          'Access Denied: Only the buyer who placed this order can view its Delivery PIN.',
        errorCode: 'BUYER_AUTH_REQUIRED',
      },
      { status: 403 }
    );
  }

  let pinRecord = await getOrderDeliveryPinRecord(orderId);
  if (
    !pinRecord &&
    order.orderStatus !== 'DELIVERED' &&
    order.orderStatus !== 'CANCELLED' &&
    order.orderStatus !== 'REJECTED'
  ) {
    // Lazily provision if order predates PIN system
    const issued = await issueDeliveryPinForOrder({
      order,
      forceRegenerate: false,
      actorId: buyerAccess.actorId,
      actorRole: 'BUYER',
    });
    if (issued.ok && issued.pin) {
      return NextResponse.json({
        ok: true,
        orderId: order.id,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus || 'PENDING',
        deliveryPin: issued.pin,
        deliveryPinInfo: issued.pinInfo,
        unifiedBuyerNotification: issued.unifiedNotification,
        warning: MANDATORY_BUYER_PIN_WARNING,
        deliveryPinWarning: MANDATORY_BUYER_PIN_WARNING,
      });
    }
    pinRecord = await getOrderDeliveryPinRecord(orderId);
  }

  if (!pinRecord) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No Delivery PIN is active for this order.',
      },
      { status: 404 }
    );
  }

  const publicInfo = toPublicDeliveryPinInfo(pinRecord);
  const canRevealPin =
    publicInfo.status === 'ACTIVE' &&
    order.orderStatus !== 'DELIVERED' &&
    order.orderStatus !== 'CANCELLED' &&
    order.orderStatus !== 'REJECTED';

  const decryptedPin = canRevealPin
    ? decryptPinFromBuyerVault(pinRecord)
    : null;

  const unifiedBuyerNotification = decryptedPin
    ? buildUnifiedBuyerOrderAndPinNotification({
        order,
        pin: decryptedPin,
        pushStatus:
          publicInfo.notificationStatus === 'DELIVERED_IN_APP_AND_FCM'
            ? 'SENT_VIA_FCM_AND_IN_APP'
            : 'DELIVERED_IN_APP_AND_BROWSER_PUSH',
        smsStatus: publicInfo.notificationStatus,
        isRegenerated: publicInfo.pinVersion > 1,
      })
    : undefined;

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    orderStatus: order.orderStatus,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus || 'PENDING',
    deliveryPin: decryptedPin,
    deliveryPinInfo: publicInfo,
    unifiedBuyerNotification,
    warning: MANDATORY_BUYER_PIN_WARNING,
    deliveryPinWarning: MANDATORY_BUYER_PIN_WARNING,
  });
}

/**
 * POST /api/orders/[orderId]/pin
 * Allows the authenticated/verified buyer to regenerate/resend a new 6-digit Delivery PIN
 * before the order is delivered or cancelled. Atomically invalidates any previous PIN.
 */
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

    let body: { buyerAccessToken?: string } = {};
    try {
      body = (await req.json()) as { buyerAccessToken?: string };
    } catch {
      // Empty body is fine if header/cookie auth is used
    }

    const order = await loadOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    const buyerAccess = await verifyBuyerOrderAccess(
      req,
      order,
      body.buyerAccessToken
    );
    if (!buyerAccess.authorized) {
      await recordDeliveryPinAuditLog({
        orderId: order.id,
        storeId: order.storeId,
        sellerId: order.sellerId,
        eventType: 'UNAUTHORIZED_PIN_ACCESS_BLOCKED',
        actorId: buyerAccess.actorId,
        actorRole: 'SYSTEM',
        pinVersion: order.deliveryPinInfo?.pinVersion || 1,
        summary: `Blocked unauthorized POST /api/orders/${order.id}/pin regeneration attempt.`,
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            buyerAccess.reason ||
            'Access Denied: Only the buyer who placed this order can regenerate or resend its Delivery PIN.',
          errorCode: 'BUYER_AUTH_REQUIRED',
        },
        { status: 403 }
      );
    }

    const regenResult = await issueDeliveryPinForOrder({
      order,
      forceRegenerate: true,
      actorId: buyerAccess.actorId,
      actorRole: 'BUYER',
    });

    if (!regenResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: regenResult.error || 'Could not regenerate Delivery PIN.',
        },
        { status: regenResult.statusCode || 400 }
      );
    }

    const updatedOrder = sanitizeOrderForStorageAndListing({
      ...order,
      deliveryPinInfo: regenResult.pinInfo,
    });
    serverOrdersRegistry.set(orderId, updatedOrder);
    await syncOrderToFirestore(updatedOrder);

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      deliveryPin: regenResult.pin,
      buyerOrderAccessToken: regenResult.buyerAccessToken,
      deliveryPinInfo: regenResult.pinInfo,
      unifiedBuyerNotification: regenResult.unifiedNotification,
      warning: MANDATORY_BUYER_PIN_WARNING,
      deliveryPinWarning: MANDATORY_BUYER_PIN_WARNING,
      message:
        regenResult.unifiedNotification?.body ||
        `A new 6-digit Delivery PIN (v${regenResult.pinInfo?.pinVersion}) has been generated. Your previous PIN is now invalid.`,
    });
  } catch (error) {
    console.error('Error regenerating delivery PIN:', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal error while regenerating Delivery PIN.',
      },
      { status: 500 }
    );
  }
}
