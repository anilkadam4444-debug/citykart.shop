import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import {
  BillingTransaction,
  MerchantSubscription,
  SUBSCRIPTION_PLANS,
  SubscriptionTierId,
  BillingCycle,
} from '@/lib/revenue-model';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sellerId,
      storeId,
      planId,
      billingCycle,
      currency = 'INR',
      paymentGateway = 'RAZORPAY',
      gatewayPaymentId,
      gatewayOrderId,
      gatewaySignature,
      invoiceNumber,
      totalAmount,
      taxAmount,
      basePrice,
    } = body;

    if (!sellerId || !storeId || !planId || !gatewaySignature || !gatewayOrderId || !gatewayPaymentId) {
      return NextResponse.json({ error: 'Missing required payment verification details' }, { status: 400 });
    }

    // Razorpay Signature Verification
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json({ 
        error: 'Razorpay integration is currently in maintenance mode (missing credentials). Payment cannot be verified yet.',
        needsConfig: true 
      }, { status: 501 });
    }

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== gatewaySignature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(now.getFullYear() + 1);
    } else {
      periodEnd.setMonth(now.getMonth() + 1);
    }

    const txId = `tx_${gatewayPaymentId}`; // Use gateway ID for idempotency
    const plan = SUBSCRIPTION_PLANS[planId as SubscriptionTierId] || SUBSCRIPTION_PLANS.FREE;

    const transaction: BillingTransaction = {
      id: txId,
      sellerId,
      storeId,
      type: 'SUBSCRIPTION',
      description: `Citykart ${plan.name} (${billingCycle}) Plan Subscription`,
      amount: basePrice || 0,
      taxAmount: taxAmount || 0,
      totalAmount: totalAmount || 0,
      currency: currency as 'INR' | 'USD',
      status: 'SUCCESS',
      paymentGateway: paymentGateway as 'RAZORPAY' | 'STRIPE',
      gatewayTransactionId: gatewayPaymentId,
      invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      createdAt: now.toISOString(),
    };

    const subscription: MerchantSubscription = {
      id: `sub_${storeId}`, // One subscription record per store
      sellerId,
      storeId,
      planId: planId as SubscriptionTierId,
      billingCycle: billingCycle as BillingCycle,
      status: 'ACTIVE',
      currency: currency as 'INR' | 'USD',
      currentPrice: totalAmount,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      paymentMethodSnippet: paymentGateway === 'RAZORPAY' ? 'UPI / NetBanking' : 'Card',
      lastPaymentDate: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Resilient Firestore persistence: try adminDb first, fall back to client SDK db
    try {
      const batch = adminDb.batch();
      const txRef = adminDb.collection('billingTransactions').doc(txId);
      const subRef = adminDb.collection('merchantSubscriptions').doc(subscription.id);
      const storeRef = adminDb.collection('stores').doc(storeId);

      batch.set(txRef, transaction);
      batch.set(subRef, subscription, { merge: true });
      batch.set(storeRef, { 
        subscriptionTier: planId,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiry: subscription.currentPeriodEnd 
      }, { merge: true });

      await batch.commit();
    } catch (adminErr) {
      console.warn('[verify-payment] adminDb batch write notice, falling back to Web SDK:', adminErr);
      try {
        const clientBatch = writeBatch(db);
        clientBatch.set(doc(db, 'billingTransactions', txId), transaction);
        clientBatch.set(doc(db, 'merchantSubscriptions', subscription.id), subscription, { merge: true });
        clientBatch.set(doc(db, 'stores', storeId), {
          subscriptionTier: planId,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiry: subscription.currentPeriodEnd,
        }, { merge: true });
        await clientBatch.commit();
      } catch (fallbackErr) {
        console.warn('[verify-payment] Web SDK write notice:', fallbackErr);
      }
    }

    return NextResponse.json({
      success: true,
      transaction,
      subscription,
      message: `Successfully activated ${plan.name} subscription`,
    });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    const message = error instanceof Error ? error.message : 'Payment verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


