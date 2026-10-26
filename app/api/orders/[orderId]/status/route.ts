import {NextRequest, NextResponse} from 'next/server';
import {doc, getDoc} from 'firebase/firestore';
import {db, syncOrderToFirestore} from '@/lib/firebase';
import {OrderRecord, OrderStatusHistoryEvent} from '@/lib/catalog-data';
import {serverOrdersRegistry, serverNotificationsRegistry, SellerNotification} from '@/lib/orders-registry';
import {
  normalizePhoneE164,
  verifyAdminRequest,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';
import {
  invalidateOrderDeliveryPin,
  sanitizeOrderForStorageAndListing,
} from '@/lib/delivery-pin';

interface StatusUpdateBody {
  nextStatus: OrderRecord['orderStatus'];
  actor?: 'SELLER' | 'BUYER' | 'ADMIN';
  actorRole?: 'SELLER' | 'BUYER' | 'ADMIN';
  actorSellerId?: string;
  actorBuyerUid?: string;
  actorPhone?: string;
  cancellationReason?: string;
  reason?: string;
}

export async function PATCH(
  req: NextRequest,
  context: {params: Promise<{orderId: string}>}
) {
  return handleStatusUpdate(req, context);
}

export async function POST(
  req: NextRequest,
  context: {params: Promise<{orderId: string}>}
) {
  return handleStatusUpdate(req, context);
}

async function handleStatusUpdate(
  req: NextRequest,
  {params}: {params: Promise<{orderId: string}>}
) {
  try {
    const {orderId} = await params;
    const body = (await req.json()) as StatusUpdateBody;
    const {nextStatus, actorSellerId, actorBuyerUid, actorPhone} = body;
    const reasonText = body.cancellationReason || body.reason;
    const actor =
      body.actor ||
      body.actorRole ||
      (body.actorBuyerUid ? 'BUYER' : 'SELLER');

    if (!orderId) {
      return NextResponse.json(
        {ok: false, error: 'Order ID is required.'},
        {status: 400}
      );
    }

    const validStatuses: OrderRecord['orderStatus'][] = [
      'NEW',
      'CONFIRMED',
      'PREPARING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'REJECTED',
    ];

    if (!validStatuses.includes(nextStatus)) {
      return NextResponse.json(
        {ok: false, error: `Invalid nextStatus: "${nextStatus}".`},
        {status: 400}
      );
    }

    const [caller, adminCheck] = await Promise.all([
      verifyAuthenticatedCaller(req),
      verifyAdminRequest(req),
    ]);

    // Authorization check for ADMIN actor before any state lookup or mutation
    if (actor === 'ADMIN' && !adminCheck.authorized) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Forbidden: Administrator authorization is required.',
        },
        {status: 403}
      );
    }

    // Retrieve order from in-memory registry or Firestore
    let order = serverOrdersRegistry.get(orderId);
    if (!order) {
      try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) {
          order = snap.data() as OrderRecord;
          serverOrdersRegistry.set(orderId, order);
        }
      } catch {
        // Ignore
      }
    }

    if (!order) {
      if (!caller.authenticated && !adminCheck.authorized && !actorSellerId && !actorBuyerUid) {
        return NextResponse.json(
          {ok: false, error: 'Order not found.'},
          {status: 404}
        );
      }
      // If order was created on client before server reboot, allow initializing stub if matching format
      order = {
        id: orderId,
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        createdAtIso: new Date().toISOString(),
        storeId: 'store-1',
        storeName: 'Local Store',
        sellerId: caller.sellerId || actorSellerId || 'seller-1',
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        discount: 0,
        total: 0,
        paymentMethod: 'UPI_ON_DELIVERY',
        customer: {
          fullName: 'Customer',
          phone: '',
          country: 'India',
          stateRegion: 'Maharashtra',
          city: 'Local',
          locality: 'Local',
          address: 'Local',
          postalCode: '',
          notes: '',
        },
        currentStepIndex: 0,
        orderStatus: 'NEW',
        statusHistory: [],
        estimatedMins: 25,
      };
      serverOrdersRegistry.set(orderId, order);
    }

    // If SELLER: must match order.sellerId or order.sellerUid unless verified ADMIN
    if (actor === 'SELLER' && !adminCheck.authorized) {
      const effectiveSellerId = caller.sellerId || actorSellerId;
      const matchesSellerId = Boolean(
        effectiveSellerId && order.sellerId && effectiveSellerId === order.sellerId
      );
      const matchesSellerUid = Boolean(
        caller.uid && order.sellerUid && caller.uid === order.sellerUid
      );
      if (!matchesSellerId && !matchesSellerUid) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Unauthorized. You can only view and update orders assigned to your own store.',
          },
          {status: 403}
        );
      }
    }

    // If BUYER: can only cancel order if it is NEW or CONFIRMED (before being prepared/dispatched)
    if (actor === 'BUYER') {
      if (nextStatus !== 'CANCELLED') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Customers can only request order cancellation.',
          },
          {status: 403}
        );
      }

      // If order is bound to a specific buyerUid, verify caller or actorBuyerUid matches
      if (order.buyerUid && !adminCheck.authorized) {
        const effectiveBuyerUid = caller.uid || actorBuyerUid;
        const effectiveBuyerPhone = normalizePhoneE164(
          caller.phoneE164 || actorPhone
        );
        const orderPhone = normalizePhoneE164(order.customer?.phone);
        if (
          effectiveBuyerUid !== order.buyerUid &&
          (!orderPhone || effectiveBuyerPhone !== orderPhone)
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Unauthorized: You can only cancel your own orders.',
            },
            {status: 403}
          );
        }
      }

      if (order.orderStatus === 'DELIVERED') {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Delivered orders cannot be cancelled. Please contact the store directly for returns.',
          },
          {status: 400}
        );
      }

      if (
        order.orderStatus === 'PREPARING' ||
        order.orderStatus === 'OUT_FOR_DELIVERY'
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'This order is already being packed or out for delivery. To modify or cancel, please call the store directly.',
          },
          {status: 400}
        );
      }

      if (order.orderStatus === 'CANCELLED') {
        return NextResponse.json(
          {ok: false, error: 'This order is already cancelled.'},
          {status: 400}
        );
      }
    }

    // Check terminal state: once DELIVERED, cannot revert
    if (order.orderStatus === 'DELIVERED' && nextStatus !== 'DELIVERED') {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Order has already been marked as DELIVERED (terminal state). State cannot be reverted.',
        },
        {status: 400}
      );
    }

    // Check terminal state: once CANCELLED or REJECTED, cannot transition to active fulfillment
    if (
      (order.orderStatus === 'CANCELLED' || order.orderStatus === 'REJECTED') &&
      nextStatus !== order.orderStatus
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Order #${orderId} is already ${order.orderStatus} and cannot be moved to ${nextStatus}.`,
        },
        {status: 400}
      );
    }

    // MANDATORY SECURITY RULE: Direct status transition to DELIVERED without buyer 6-digit Delivery PIN verification is prohibited
    if (nextStatus === 'DELIVERED') {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Direct transition to DELIVERED is not permitted. Please enter the buyer’s 6-digit Delivery PIN in the Delivery PIN Verification control (/api/orders/' +
            orderId +
            '/verify-pin) after handing over the order.',
          errorCode: 'DELIVERY_PIN_REQUIRED',
        },
        {status: 403}
      );
    }

    // Compute step index
    let stepIndex = order.currentStepIndex;
    if (nextStatus === 'NEW' || nextStatus === 'CONFIRMED') {
      stepIndex = 0;
    } else if (nextStatus === 'PREPARING') {
      stepIndex = 1;
    } else if (nextStatus === 'OUT_FOR_DELIVERY') {
      stepIndex = 2;
    }

    const nowIso = new Date().toISOString();
    const defaultNote =
      nextStatus === 'CONFIRMED'
        ? 'Order accepted by store'
        : nextStatus === 'PREPARING'
          ? 'Items being packed at store'
          : nextStatus === 'OUT_FOR_DELIVERY'
            ? 'Order dispatched with delivery rider'
            : nextStatus === 'CANCELLED'
              ? reasonText || 'Order cancelled'
              : reasonText || 'Order rejected by merchant';

    const historyEvent: OrderStatusHistoryEvent = {
      status: nextStatus,
      timestamp: nowIso,
      note: reasonText ? `${defaultNote} (${reasonText})` : defaultNote,
      actor: actor === 'BUYER' ? 'BUYER' : 'SELLER',
    };

    let updatedPinInfo = order.deliveryPinInfo;
    if (nextStatus === 'CANCELLED' || nextStatus === 'REJECTED') {
      updatedPinInfo =
        (await invalidateOrderDeliveryPin(
          orderId,
          defaultNote,
          caller.uid || actorSellerId || actorBuyerUid || actor
        )) || order.deliveryPinInfo;
    }

    const updatedOrder: OrderRecord = sanitizeOrderForStorageAndListing({
      ...order,
      orderStatus: nextStatus,
      currentStepIndex: stepIndex,
      deliveryPinInfo: updatedPinInfo,
      statusHistory: [...(order.statusHistory || []), historyEvent],
      cancellationReason:
        nextStatus === 'CANCELLED' ? reasonText || order.cancellationReason : order.cancellationReason,
      rejectionReason:
        nextStatus === 'REJECTED' ? reasonText || order.rejectionReason : order.rejectionReason,
    });

    serverOrdersRegistry.set(orderId, updatedOrder);
    await syncOrderToFirestore(updatedOrder);

    // Record notification for seller if buyer cancelled or status changed
    if (order.sellerId) {
      const notifId = `notif-${orderId}-${nextStatus.toLowerCase()}`;
      const notifTitle =
        nextStatus === 'CANCELLED'
          ? `Order #${orderId} Cancelled by Customer`
          : nextStatus === 'REJECTED'
          ? `Order #${orderId} Rejected`
          : `Order #${orderId} Status: ${nextStatus}`;
      const notifMsg =
        nextStatus === 'CANCELLED'
          ? `Customer ${order.customer.fullName} cancelled order #${orderId}. Reason: ${reasonText || 'No reason provided'}.`
          : `Order #${orderId} for ${order.customer.fullName} was updated to ${nextStatus}.`;

      const statusNotif: SellerNotification = {
        id: notifId,
        sellerId: order.sellerId,
        sellerUid: order.sellerUid,
        orderId,
        title: notifTitle,
        message: notifMsg,
        type: nextStatus === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
        isRead: false,
        createdAt: nowIso,
      };
      serverNotificationsRegistry.set(notifId, statusNotif);
    }

    return NextResponse.json({
      ok: true,
      order: updatedOrder,
      message: `Order #${orderId} status updated to ${nextStatus}.`,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal error updating status.',
      },
      {status: 500}
    );
  }
}
