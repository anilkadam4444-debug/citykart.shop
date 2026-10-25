import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
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
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    if (!secret) {
      return NextResponse.json({ error: 'Razorpay webhook secret not configured' }, { status: 501 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log('Razorpay Webhook Event:', event.event);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const notes = payment.notes;

      // Extract metadata from notes
      const { storeId, sellerId, planId, billingCycle, type } = notes || {};

      if (type === 'SUBSCRIPTION' && storeId && sellerId && planId && billingCycle) {
        const now = new Date();
        const periodEnd = new Date(now);
        if (billingCycle === 'ANNUAL') {
          periodEnd.setFullYear(now.getFullYear() + 1);
        } else {
          periodEnd.setMonth(now.getMonth() + 1);
        }

        const txId = `tx_${paymentId}`;
        const plan = SUBSCRIPTION_PLANS[planId as SubscriptionTierId] || SUBSCRIPTION_PLANS.FREE;

        // Check if already processed (idempotency)
        let alreadyExists = false;
        try {
          const txDoc = await adminDb.collection('billingTransactions').doc(txId).get();
          alreadyExists = txDoc.exists;
        } catch {
          try {
            const clientDoc = await getDoc(doc(db, 'billingTransactions', txId));
            alreadyExists = clientDoc.exists();
          } catch {
            alreadyExists = false;
          }
        }

        if (alreadyExists) {
          return NextResponse.json({ message: 'Event already processed' });
        }

        const transaction: BillingTransaction = {
          id: txId,
          sellerId,
          storeId,
          type: 'SUBSCRIPTION',
          description: `Citykart ${plan.name} (${billingCycle}) Plan Subscription (via Webhook)`,
          amount: payment.amount / 100 - (payment.tax / 100 || 0), // Razorpay amount is in paise
          taxAmount: payment.tax / 100 || 0,
          totalAmount: payment.amount / 100,
          currency: payment.currency as 'INR' | 'USD',
          status: 'SUCCESS',
          paymentGateway: 'RAZORPAY',
          gatewayTransactionId: paymentId,
          invoiceNumber: `INV-W-${Date.now().toString().slice(-6)}`,
          createdAt: now.toISOString(),
        };

        const subscription: MerchantSubscription = {
          id: `sub_${storeId}`,
          sellerId,
          storeId,
          planId: planId as SubscriptionTierId,
          billingCycle: billingCycle as BillingCycle,
          status: 'ACTIVE',
          currency: payment.currency as 'INR' | 'USD',
          currentPrice: payment.amount / 100,
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          cancelAtPeriodEnd: false,
          paymentMethodSnippet: 'Razorpay Webhook',
          lastPaymentDate: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        try {
          const batch = adminDb.batch();
          batch.set(adminDb.collection('billingTransactions').doc(txId), transaction);
          batch.set(adminDb.collection('merchantSubscriptions').doc(subscription.id), subscription, { merge: true });
          batch.set(adminDb.collection('stores').doc(storeId), { 
            subscriptionTier: planId,
            subscriptionStatus: 'ACTIVE',
            subscriptionExpiry: subscription.currentPeriodEnd 
          }, { merge: true });

          await batch.commit();
          console.log(`Webhook: Activated subscription for store ${storeId}`);
        } catch (adminErr) {
          console.warn('[webhook] adminDb write notice, falling back to Web SDK:', adminErr);
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
            console.warn('[webhook] Web SDK write notice:', fallbackErr);
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

