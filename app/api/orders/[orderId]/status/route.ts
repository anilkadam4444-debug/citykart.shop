import { NextRequest, NextResponse } from 'next/server';
import { OrderStatus } from '@/lib/catalog-data';
import { serverOrdersRegistry } from '@/lib/orders-registry';
import { sanitizeOrderForStorageAndListing } from '@/lib/delivery-pin';
import { notifyOrderStatusUpdated } from '@/lib/notification-events';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const body = await req.json();
    const {
      orderStatus,
      nextStatus,
      status,
      reason,
      cancellationReason,
      rejectionReason,
    } = body || {};

    const rawInput = String(nextStatus || orderStatus || status || '')
      .trim()
      .toUpperCase();
    const rawTarget = rawInput === 'ACCEPTED' ? 'CONFIRMED' : rawInput;
    const validStatuses = [
      'NEW',
      'PLACED',
      'CONFIRMED',
      'PREPARING',
      'PACKED',
      'DISPATCHED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'REJECTED',
    ];

    if (!rawTarget || !validStatuses.includes(rawTarget)) {
      return NextResponse.json(
        { ok: false, error: 'Valid status is required.' },
        { status: 400 }
      );
    }

    const order = serverOrdersRegistry.get(orderId);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    // Direct transition to DELIVERED without PIN verification is strictly prohibited
    if (
      rawTarget === 'DELIVERED' &&
      order.deliveryPinInfo?.status !== 'VERIFIED'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Orders cannot be marked DELIVERED directly without customer 6-digit delivery PIN verification.',
        },
        { status: 400 }
      );
    }

    const targetStatus = (
      rawTarget === 'PACKED' ? 'PREPARING' : rawTarget
    ) as OrderStatus;

    const updated = sanitizeOrderForStorageAndListing({
      ...order,
      orderStatus: targetStatus,
      cancellationReason:
        cancellationReason || reason || order.cancellationReason,
      rejectionReason: rejectionReason || reason || order.rejectionReason,
      paymentReferenceNote:
        reason ||
        cancellationReason ||
        rejectionReason ||
        order.paymentReferenceNote,
      updatedAt: new Date().toISOString(),
    });

    serverOrdersRegistry.set(orderId, updated);

    await notifyOrderStatusUpdated({
      order: updated,
      nextStatus: rawTarget as OrderStatus | 'PACKED',
      reason: cancellationReason || rejectionReason || reason,
    });

    return NextResponse.json({
      ok: true,
      order: updated,
      status: rawTarget,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Status update failed.',
      },
      { status: 500 }
    );
  }
}
