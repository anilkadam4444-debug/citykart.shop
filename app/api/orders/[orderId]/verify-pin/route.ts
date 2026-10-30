import { NextRequest, NextResponse } from 'next/server';
import { serverOrderPinsVault, serverOrdersRegistry } from '@/lib/orders-registry';
import { sanitizeOrderForStorageAndListing } from '@/lib/delivery-pin';
import { notifyOrderStatusUpdated } from '@/lib/notification-events';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const body = await req.json();
    const { pin, deliveryPin } = body || {};
    const inputPin = String(pin || deliveryPin || '').trim();

    const order = serverOrdersRegistry.get(orderId);
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    }

    const authoritativePin = String(
      serverOrderPinsVault.get(orderId) || order.deliveryPin || order.deliveryPinInfo?.pin || ''
    ).trim();

    if (!inputPin || inputPin !== authoritativePin) {
      return NextResponse.json(
        { ok: false, error: 'Invalid delivery PIN. Please ask customer for correct 6-digit PIN.' },
        { status: 400 }
      );
    }

    const verifiedAtIso = new Date().toISOString();
    const updated = sanitizeOrderForStorageAndListing({
      ...order,
      orderStatus: 'DELIVERED',
      currentStepIndex: 3,
      estimatedMins: 0,
      deliveredAt: verifiedAtIso,
      deliveryPinVerified: true,
      deliveryPinInfo: {
        ...(order.deliveryPinInfo || {}),
        pin: authoritativePin,
        deliveryPin: authoritativePin,
        pinVersion: order.deliveryPinInfo?.pinVersion || 1,
        generatedAt: order.deliveryPinInfo?.generatedAt || verifiedAtIso,
        verifiedAt: verifiedAtIso,
        verifiedBy: 'DELIVERY_AGENT',
        attemptsCount: (order.deliveryPinInfo?.attemptsCount || 0) + 1,
        status: 'VERIFIED',
      },
      updatedAt: verifiedAtIso,
    });

    serverOrdersRegistry.set(orderId, updated);

    await notifyOrderStatusUpdated({
      order: updated,
      nextStatus: 'DELIVERED',
      reason: '6-digit Delivery PIN verified at doorstep',
    });

    return NextResponse.json({
      ok: true,
      message: 'Delivery PIN verified successfully. Order marked as DELIVERED.',
      order: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'PIN verification failed.' },
      { status: 500 }
    );
  }
}

