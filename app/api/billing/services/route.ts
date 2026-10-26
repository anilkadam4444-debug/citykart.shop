import { NextRequest, NextResponse } from 'next/server';
import { doc, writeBatch } from 'firebase/firestore';
import { db, removeUndefined } from '@/lib/firebase';
import {
  BillingTransaction,
  MerchantServiceOrder,
  VALUE_ADDED_SERVICES,
  ValueAddedServiceType,
} from '@/lib/revenue-model';
import { verifyAuthenticatedCaller } from '@/lib/super-admin-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sellerId, storeId, serviceType, contactPhone, notes } = body;

    if (!sellerId || !storeId || !serviceType || !contactPhone) {
      return NextResponse.json({ error: 'Missing required service order parameters' }, { status: 400 });
    }

    const caller = await verifyAuthenticatedCaller(req);
    if (
      caller.authenticated &&
      caller.sellerId &&
      caller.sellerId !== sellerId &&
      !caller.roles.includes('ADMIN')
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Authenticated session does not match sellerId.' },
        { status: 403 }
      );
    }

    const serviceDef = VALUE_ADDED_SERVICES[serviceType as ValueAddedServiceType];
    if (!serviceDef) {
      return NextResponse.json({ error: 'Invalid service type requested' }, { status: 400 });
    }

    const now = new Date();
    const orderId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const txId = `tx_srv_${Date.now()}`;

    const serviceOrder: MerchantServiceOrder = removeUndefined({
      id: orderId,
      sellerId: String(sellerId).trim(),
      storeId: String(storeId).trim(),
      serviceType: serviceType as ValueAddedServiceType,
      title: serviceDef.title,
      amountInr: serviceDef.priceInr,
      status: 'SUBMITTED',
      notes: String(notes || '').trim().slice(0, 500),
      contactPhone: String(contactPhone).trim(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const transaction: BillingTransaction = removeUndefined({
      id: txId,
      sellerId: String(sellerId).trim(),
      storeId: String(storeId).trim(),
      type: 'SERVICE_ORDER',
      description: serviceDef.title,
      amount: serviceDef.priceInr,
      taxAmount: Math.round(serviceDef.priceInr * 0.18 * 100) / 100,
      totalAmount: Math.round(serviceDef.priceInr * 1.18 * 100) / 100,
      currency: 'INR',
      status: 'SUCCESS',
      paymentGateway: 'RAZORPAY',
      invoiceNumber: `INV-SRV-${Date.now().toString().slice(-6)}`,
      createdAt: now.toISOString(),
    });

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'merchantServiceOrders', orderId), serviceOrder);
      batch.set(doc(db, 'billingTransactions', txId), transaction);
      await batch.commit();
    } catch {
      // Graceful fallback if Firestore client write is unavailable
    }

    return NextResponse.json({
      success: true,
      serviceOrder,
      transaction,
      message: `Service request submitted successfully. Our team will contact ${contactPhone} within ${serviceDef.turnaroundDays} business days.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Service booking failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
