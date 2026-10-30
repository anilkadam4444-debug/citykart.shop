import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db, IS_PREVIEW_DUMMY_FIREBASE, removeUndefined } from '@/lib/firebase';
import {
  BillingTransaction,
  MerchantServiceOrder,
  VALUE_ADDED_SERVICES,
  ValueAddedServiceDef,
  ValueAddedServiceType,
} from '@/lib/revenue-model';
import { verifyAuthenticatedCaller } from '@/lib/super-admin-auth';
import { notifySellerBillingEvent } from '@/lib/notification-events';

export const dynamic = 'force-dynamic';

function resolveServiceDefinition(serviceType: string): ValueAddedServiceDef | undefined {
  const byKey = (VALUE_ADDED_SERVICES as Record<string, ValueAddedServiceDef>)[serviceType];
  if (byKey) return byKey;
  if (Array.isArray(VALUE_ADDED_SERVICES)) {
    return VALUE_ADDED_SERVICES.find(
      (s) => s.type === serviceType || s.id === serviceType
    );
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action = 'BOOK_SERVICE',
      sellerId,
      storeId,
      serviceType,
      contactPhone,
      notes,
      initiateRazorpayOrder = false,
      orderId: existingOrderId,
      gatewayPaymentId,
      gatewayOrderId,
      gatewaySignature,
      invoiceNumber: existingInvoiceNumber,
    } = body;

    // Action 1: Verify Razorpay Payment Signature for Service Order
    if (action === 'VERIFY_PAYMENT') {
      if (
        !sellerId ||
        !storeId ||
        !serviceType ||
        !gatewayPaymentId ||
        !gatewayOrderId ||
        !gatewaySignature
      ) {
        return NextResponse.json(
          { error: 'Missing required payment verification parameters' },
          { status: 400 }
        );
      }

      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Razorpay secret is not configured on the server.' },
          { status: 501 }
        );
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${gatewayOrderId}|${gatewayPaymentId}`)
        .digest('hex');

      const sigBuf = Buffer.from(String(gatewaySignature), 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');
      if (
        sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)
      ) {
        return NextResponse.json(
          { error: 'Invalid Razorpay payment signature.' },
          { status: 400 }
        );
      }

      const serviceDef = resolveServiceDefinition(String(serviceType));
      if (!serviceDef) {
        return NextResponse.json(
          { error: 'Invalid service type requested' },
          { status: 400 }
        );
      }

      const txId = `tx_srv_${gatewayPaymentId}`;
      if (!IS_PREVIEW_DUMMY_FIREBASE) {
        try {
          const existingTx = await getDoc(doc(db, 'billingTransactions', txId));
          if (existingTx.exists()) {
            return NextResponse.json({
              success: true,
              idempotent: true,
              transaction: existingTx.data(),
              message: `Service payment already verified for ${serviceDef.title}.`,
            });
          }
        } catch {
          // Proceed
        }
      }

      const now = new Date();
      const resolvedOrderId =
        existingOrderId ||
        `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const taxAmount = Math.round(serviceDef.priceInr * 0.18 * 100) / 100;
      const totalAmount = Math.round((serviceDef.priceInr + taxAmount) * 100) / 100;

      const serviceOrder: MerchantServiceOrder = removeUndefined({
        id: resolvedOrderId,
        sellerId: String(sellerId).trim(),
        storeId: String(storeId).trim(),
        serviceType: serviceDef.type,
        title: serviceDef.title,
        amountInr: serviceDef.priceInr,
        total: totalAmount,
        status: 'PAID_AND_SUBMITTED',
        notes: String(notes || '').trim().slice(0, 500),
        contactPhone: String(contactPhone || '').trim(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      const transaction: BillingTransaction = removeUndefined({
        id: txId,
        sellerId: String(sellerId).trim(),
        storeId: String(storeId).trim(),
        type: 'SERVICE_ORDER',
        description: `${serviceDef.title} (One-Time Assisted Service)`,
        amount: serviceDef.priceInr,
        taxAmount,
        totalAmount,
        currency: 'INR',
        status: 'SUCCESS',
        paymentGateway: 'RAZORPAY',
        gatewayTransactionId: gatewayPaymentId,
        invoiceNumber:
          existingInvoiceNumber || `INV-SRV-${Date.now().toString().slice(-6)}`,
        createdAt: now.toISOString(),
      });

      if (!IS_PREVIEW_DUMMY_FIREBASE) {
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'merchantServiceOrders', resolvedOrderId), serviceOrder);
          batch.set(doc(db, 'billingTransactions', txId), transaction);
          await batch.commit();
        } catch {
          // Graceful fallback if Firestore client write is unavailable
        }
      }

      await notifySellerBillingEvent({
        sellerId: String(sellerId).trim(),
        storeId: String(storeId).trim(),
        event: 'SERVICE_BOOKED',
        planOrServiceName: serviceDef.title,
        amountInr: totalAmount,
        invoiceNumber: transaction.invoiceNumber,
      }).catch((err) => console.warn('[billing/services] Notification warning:', err));

      return NextResponse.json({
        success: true,
        serviceOrder,
        transaction,
        message: `Payment verified! Our onboarding team will contact ${contactPhone} within ${serviceDef.turnaroundDays} business days.`,
      });
    }

    // Action 2: Book Service (Initiating Razorpay Order if configured, or direct sandbox submission)
    if (!sellerId || !storeId || !serviceType || !contactPhone) {
      return NextResponse.json(
        { error: 'Missing required service order parameters' },
        { status: 400 }
      );
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

    const serviceDef = resolveServiceDefinition(String(serviceType));
    if (!serviceDef) {
      return NextResponse.json(
        { error: 'Invalid service type requested' },
        { status: 400 }
      );
    }

    const now = new Date();
    const orderId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const invoiceNumber = `INV-SRV-${Date.now().toString().slice(-6)}`;
    const taxAmount = Math.round(serviceDef.priceInr * 0.18 * 100) / 100;
    const totalAmount = Math.round((serviceDef.priceInr + taxAmount) * 100) / 100;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const hasLiveOrTestKeys = Boolean(
      keyId &&
        keySecret &&
        !keyId.includes('placeholder') &&
        !keySecret.includes('placeholder') &&
        !keyId.includes('your_')
    );

    if (initiateRazorpayOrder && hasLiveOrTestKeys) {
      try {
        const razorpay = new Razorpay({
          key_id: keyId!,
          key_secret: keySecret!,
        });

        const rzpOrder = await razorpay.orders.create({
          amount: Math.round(totalAmount * 100), // paise
          currency: 'INR',
          receipt: invoiceNumber,
          notes: {
            orderId,
            sellerId: String(sellerId).trim(),
            storeId: String(storeId).trim(),
            serviceType: serviceDef.type,
            contactPhone: String(contactPhone).trim(),
            invoiceNumber,
            type: 'SERVICE_ORDER',
          },
        });

        return NextResponse.json({
          success: true,
          requiresRazorpayCheckout: true,
          orderId,
          invoiceNumber,
          gatewayOptions: {
            key: keyId,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            name: 'Citykart Assisted Services',
            description: serviceDef.title,
            order_id: rzpOrder.id,
            prefill: {
              contact: String(contactPhone).trim(),
            },
            theme: {
              color: '#003B8E',
            },
            notes: rzpOrder.notes,
          },
        });
      } catch (rzpErr: unknown) {
        const statusCode = (rzpErr as { statusCode?: number })?.statusCode;
        if (statusCode !== 401) {
          throw rzpErr;
        }
      }
    }

    const txId = `tx_srv_${Date.now()}`;

    const serviceOrder: MerchantServiceOrder = removeUndefined({
      id: orderId,
      sellerId: String(sellerId).trim(),
      storeId: String(storeId).trim(),
      serviceType: serviceDef.type,
      title: serviceDef.title,
      amountInr: serviceDef.priceInr,
      total: totalAmount,
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
      taxAmount,
      totalAmount,
      currency: 'INR',
      status: 'SUCCESS',
      paymentGateway: 'RAZORPAY',
      invoiceNumber,
      createdAt: now.toISOString(),
    });

    if (!IS_PREVIEW_DUMMY_FIREBASE) {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'merchantServiceOrders', orderId), serviceOrder);
        batch.set(doc(db, 'billingTransactions', txId), transaction);
        await batch.commit();
      } catch {
        // Graceful fallback if Firestore client write is unavailable
      }
    }

    await notifySellerBillingEvent({
      sellerId: String(sellerId).trim(),
      storeId: String(storeId).trim(),
      event: 'SERVICE_BOOKED',
      planOrServiceName: serviceDef.title,
      amountInr: totalAmount,
      invoiceNumber,
    }).catch((err) => console.warn('[billing/services] Notification warning:', err));

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
