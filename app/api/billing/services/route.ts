import { NextRequest, NextResponse } from 'next/server';
import {
  BillingTransaction,
  MerchantServiceOrder,
  VALUE_ADDED_SERVICES,
  ValueAddedServiceType,
} from '@/lib/revenue-model';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sellerId, storeId, serviceType, contactPhone, notes } = body;

    if (!sellerId || !storeId || !serviceType || !contactPhone) {
      return NextResponse.json({ error: 'Missing required service order parameters' }, { status: 400 });
    }

    const serviceDef = VALUE_ADDED_SERVICES[serviceType as ValueAddedServiceType];
    if (!serviceDef) {
      return NextResponse.json({ error: 'Invalid service type requested' }, { status: 400 });
    }

    const now = new Date();
    const orderId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const txId = `tx_srv_${Date.now()}`;

    const serviceOrder: MerchantServiceOrder = {
      id: orderId,
      sellerId,
      storeId,
      serviceType: serviceType as ValueAddedServiceType,
      title: serviceDef.title,
      amountInr: serviceDef.priceInr,
      status: 'SUBMITTED',
      notes: notes || '',
      contactPhone,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const transaction: BillingTransaction = {
      id: txId,
      sellerId,
      storeId,
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
    };

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
