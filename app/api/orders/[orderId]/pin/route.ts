import { NextRequest, NextResponse } from 'next/server';
import { serverOrderPinsVault, serverOrdersRegistry } from '@/lib/orders-registry';
import { generateDeliveryPin, sanitizeOrderForStorageAndListing } from '@/lib/delivery-pin';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const order = serverOrdersRegistry.get(orderId);
    let pin = serverOrderPinsVault.get(orderId) || order?.deliveryPin || order?.deliveryPinInfo?.pin;
    if (!pin && order) {
      pin = generateDeliveryPin();
      serverOrderPinsVault.set(orderId, pin);
    }
    if (!pin) {
      return NextResponse.json({ ok: false, error: 'Order PIN not found.' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      orderId,
      pin,
      deliveryPin: pin,
      pinInfo: order?.deliveryPinInfo,
      deliveryPinInfo: order?.deliveryPinInfo,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch PIN.' },
      { status: 500 }
    );
  }
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const order = serverOrdersRegistry.get(orderId);
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    }

    if (order.orderStatus === 'DELIVERED') {
      return NextResponse.json(
        { ok: false, error: 'Cannot regenerate PIN for already delivered order.' },
        { status: 400 }
      );
    }

    const newPin = generateDeliveryPin();
    const newVersion = (order.deliveryPinInfo?.pinVersion || 1) + 1;

    const pinInfo = {
      pin: newPin,
      deliveryPin: newPin,
      pinVersion: newVersion,
      generatedAt: new Date().toISOString(),
      attemptsCount: 0,
      status: 'PENDING_DELIVERY' as const,
    };

    serverOrderPinsVault.set(orderId, newPin);

    const updated = sanitizeOrderForStorageAndListing({
      ...order,
      deliveryPin: newPin,
      deliveryPinInfo: pinInfo,
      updatedAt: new Date().toISOString(),
    });

    serverOrdersRegistry.set(orderId, updated);

    return NextResponse.json({
      ok: true,
      pin: newPin,
      deliveryPin: newPin,
      pinInfo,
      deliveryPinInfo: pinInfo,
      unifiedNotification: `Your new 6-digit delivery PIN is ${newPin}.`,
      unifiedBuyerNotification: `Your new 6-digit delivery PIN is ${newPin}.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'PIN regeneration failed.' },
      { status: 500 }
    );
  }
}

