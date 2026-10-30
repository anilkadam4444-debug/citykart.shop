import { NextRequest, NextResponse } from 'next/server';
import {
  INITIAL_STORES,
  isStoreEligibleForSelectedCity,
  LocalStore,
  OrderRecord,
} from '@/lib/catalog-data';
import { serverOrderPinsVault, serverOrdersRegistry } from '@/lib/orders-registry';
import { serverStoresRegistry } from '@/lib/stores-registry';
import {
  createInitialDeliveryPinInfo,
  generateDeliveryPin,
  sanitizeOrderForStorageAndListing,
} from '@/lib/delivery-pin';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/super-admin-auth';
import { notifyOrderPlaced } from '@/lib/notification-events';

export async function GET() {
  const allOrders = Array.from(serverOrdersRegistry.values());
  return NextResponse.json({ ok: true, orders: allOrders });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const body = rawBody?.order && typeof rawBody.order === 'object' ? rawBody.order : rawBody;
    const customer = body?.customer || {
      fullName: body?.customerName || body?.buyerName || '',
      phone: body?.customerPhone || body?.buyerPhone || '',
      phoneE164: body?.buyerPhone || body?.customerPhone || '',
      deliveryAddress: body?.deliveryAddress || body?.address || '',
      address: body?.deliveryAddress || body?.address || '',
      city: body?.city || 'Nanded',
      locality: body?.neighborhood || body?.locality || '',
      stateRegion: body?.stateRegion || 'Maharashtra',
      country: body?.country || 'India',
    };
    const {
      storeId,
      storeData,
      sellerId,
      storeName,
      items,
      subtotal,
      deliveryFee,
      platformFee,
      total,
      currency = 'INR',
      paymentMethod = 'PAY_ON_DELIVERY',
    } = body || {};

    const phoneVal = String(customer?.phoneE164 || customer?.phone || '').trim();
    const addressVal = String(customer?.deliveryAddress || customer?.address || '').trim();
    const customerCity = String(customer?.city || '').trim();

    if (!customer?.fullName || !phoneVal || !addressVal) {
      return NextResponse.json(
        { ok: false, error: 'Customer name, phone, and delivery address are required.' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Order must contain at least one item.' },
        { status: 400 }
      );
    }

    // 1. Validate against authenticated buyer's locked city (if session token present)
    const token =
      req.headers.get('x-urbandirect-session') ||
      req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const sessionCheck = token ? await verifySessionToken(token) : null;
    const sessionUser = sessionCheck?.user;
    if (
      sessionUser?.lockedCity &&
      customerCity &&
      sessionUser.lockedCity.trim().toLowerCase() !== customerCity.toLowerCase()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Hyperlocal city lock violation: Your account city is locked to ${sessionUser.lockedCity}. Delivery of products is strictly within ${sessionUser.lockedCity} only.`,
        },
        { status: 400 }
      );
    }

    // 2. Validate that the target store serves the delivery city (intra-city delivery only)
    const resolvedStore: LocalStore | undefined =
      (storeData as LocalStore | undefined) ||
      (storeId ? serverStoresRegistry.get(storeId) : undefined) ||
      INITIAL_STORES.find((s) => s.id === storeId);
    const effectiveCity =
      sessionUser?.lockedCity || customerCity || resolvedStore?.cityName || 'Nanded';

    if (
      resolvedStore &&
      effectiveCity &&
      !isStoreEligibleForSelectedCity(resolvedStore, {
        mode: 'SELECTED_LOCATION',
        city: effectiveCity,
        stateRegion: customer?.stateRegion || resolvedStore.stateRegion || 'Maharashtra',
        country: customer?.country || resolvedStore.country || 'India',
        locality: customer?.locality || '',
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Intra-city delivery restriction: ${resolvedStore.name} operates in ${resolvedStore.cityName} and cannot deliver to ${effectiveCity}.`,
        },
        { status: 400 }
      );
    }

    // Generate authoritative 6-digit PIN
    const pin = generateDeliveryPin();
    const pinInfo = createInitialDeliveryPinInfo(pin);
    const orderId = body.id || `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`;

    const newOrder: OrderRecord = {
      id: orderId,
      orderNumber: orderId,
      buyerUid: body.buyerUid || sessionUser?.uid,
      customer: {
        fullName: String(customer.fullName).trim(),
        phone: phoneVal,
        phoneE164: phoneVal,
        address: addressVal,
        deliveryAddress: addressVal,
        locality: customer.locality || '',
        city: customer.city || 'Nanded',
        stateRegion: customer.stateRegion || 'Maharashtra',
        country: customer.country || 'India',
        postalCode: customer.postalCode || '431601',
        notes: customer.notes || '',
      },
      sellerId: sellerId || 'seller-01',
      storeId: storeId || 'store-1',
      storeName: storeName || 'Neighborhood Store',
      items,
      subtotal: Number(subtotal) || 0,
      deliveryFee: Number(deliveryFee) || 0,
      platformFee: Number(platformFee) || 0,
      total: Number(total) || 0,
      currency,
      orderStatus: 'NEW',
      currentStepIndex: 0,
      estimatedMins: 25,
      paymentMethod: paymentMethod || 'PAY_ON_DELIVERY',
      paymentStatus: 'PENDING',
      deliveryPin: pin,
      deliveryPinInfo: pinInfo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    serverOrderPinsVault.set(orderId, pin);
    const sanitized = sanitizeOrderForStorageAndListing(newOrder);
    serverOrdersRegistry.set(orderId, sanitized);

    await notifyOrderPlaced(newOrder, pin);

    return NextResponse.json({
      ok: true,
      order: {
        ...sanitized,
        deliveryPin: pin,
      },
      deliveryPin: pin,
      pin,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Order creation failed.' },
      { status: 500 }
    );
  }
}

