import {NextRequest, NextResponse} from 'next/server';
import {OrderRecord, OrderStatusHistoryEvent} from '@/lib/catalog-data';
import {serverOrdersRegistry, serverNotificationsRegistry, SellerNotification} from '@/lib/orders-registry';

interface StatusUpdateBody {
  nextStatus: OrderRecord['orderStatus'];
  actor?: 'SELLER' | 'BUYER' | 'ADMIN';
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
    const {nextStatus, actorSellerId} = body;
    const reasonText = body.cancellationReason || body.reason;
    const actor = body.actor || (body.actorBuyerUid ? 'BUYER' : 'SELLER');

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

    // Retrieve order from in-memory registry or handle live order
    let order = serverOrdersRegistry.get(orderId);
    if (!order) {
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
        sellerId: actorSellerId || 'seller-1',
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

    // Authorization checks:
    // If SELLER: must match order.sellerId unless ADMIN
    if (actor === 'SELLER') {
      if (actorSellerId && order.sellerId && actorSellerId !== order.sellerId) {
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

    // Compute step index
    let stepIndex = order.currentStepIndex;
    if (nextStatus === 'NEW' || nextStatus === 'CONFIRMED') {
      stepIndex = 0;
    } else if (nextStatus === 'PREPARING') {
      stepIndex = 1;
    } else if (nextStatus === 'OUT_FOR_DELIVERY') {
      stepIndex = 2;
    } else if (nextStatus === 'DELIVERED') {
      stepIndex = 3;
    }

    const nowIso = new Date().toISOString();
    const defaultNote =
      nextStatus === 'CONFIRMED'
        ? 'Order accepted by store'
        : nextStatus === 'PREPARING'
          ? 'Items being packed at store'
          : nextStatus === 'OUT_FOR_DELIVERY'
            ? 'Order dispatched with delivery rider'
            : nextStatus === 'DELIVERED'
              ? 'Order delivered and payment collected'
              : nextStatus === 'CANCELLED'
                ? reasonText || 'Order cancelled'
                : reasonText || 'Order rejected by merchant';

    const historyEvent: OrderStatusHistoryEvent = {
      status: nextStatus,
      timestamp: nowIso,
      note: reasonText ? `${defaultNote} (${reasonText})` : defaultNote,
      actor: actor === 'BUYER' ? 'BUYER' : 'SELLER',
    };

    const updatedOrder: OrderRecord = {
      ...order,
      orderStatus: nextStatus,
      currentStepIndex: stepIndex,
      statusHistory: [...(order.statusHistory || []), historyEvent],
      cancellationReason:
        nextStatus === 'CANCELLED' ? reasonText || order.cancellationReason : order.cancellationReason,
      rejectionReason:
        nextStatus === 'REJECTED' ? reasonText || order.rejectionReason : order.rejectionReason,
    };

    serverOrdersRegistry.set(orderId, updatedOrder);

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
