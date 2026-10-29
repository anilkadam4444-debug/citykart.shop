import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { db, IS_PREVIEW_DUMMY_FIREBASE } from '@/lib/firebase';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { INITIAL_STORES, LocalStore } from '@/lib/catalog-data';
import { serverStoresRegistry } from '@/lib/stores-registry';
import {
  BillingTransaction,
  MerchantSubscription,
  SUBSCRIPTION_PLANS,
  SubscriptionTierId,
  BillingCycle,
} from '@/lib/revenue-model';
import {
  getAuthoritativeSubscriptionPlansAsync,
  verifyAdminRequest,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';
import {
  getReservedFeesForInvoice,
  markInvoicePlatformFeesPaid,
} from '@/lib/fees';

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
    } = body;

    if (
      !sellerId ||
      !storeId ||
      !planId ||
      !gatewaySignature ||
      !gatewayOrderId ||
      !gatewayPaymentId
    ) {
      return NextResponse.json(
        { error: 'Missing required payment verification details' },
        { status: 400 }
      );
    }

    // Verify caller session isolation and store-to-seller ownership
    const [caller, adminCheck] = await Promise.all([
      verifyAuthenticatedCaller(req),
      verifyAdminRequest(req),
    ]);

    if (
      caller.authenticated &&
      caller.sellerId &&
      caller.sellerId !== sellerId &&
      !adminCheck.authorized
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Authenticated seller session does not match the requested sellerId.',
        },
        { status: 403 }
      );
    }

    let targetStore: LocalStore | null =
      INITIAL_STORES.find((s) => s.id === storeId) ||
      serverStoresRegistry.get(storeId) ||
      null;
    if (!targetStore && !IS_PREVIEW_DUMMY_FIREBASE) {
      try {
        const snap = await getDoc(doc(db, 'stores', storeId));
        if (snap.exists()) {
          targetStore = snap.data() as LocalStore;
        }
      } catch {
        // Ignore Firestore read error if store is only in local state
      }
    }

    if (
      targetStore &&
      targetStore.sellerId &&
      targetStore.sellerId !== sellerId &&
      !adminCheck.authorized
    ) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Store ownership mismatch. Cannot bind subscription payment to a store owned by another seller.',
        },
        { status: 403 }
      );
    }

    // Razorpay Signature Verification
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json(
        {
          error:
            'Razorpay integration is currently in maintenance mode (missing credentials). Payment cannot be verified yet.',
          needsConfig: true,
        },
        { status: 501 }
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');

    const genBuf = Buffer.from(generatedSignature, 'utf8');
    const recBuf = Buffer.from(String(gatewaySignature), 'utf8');
    if (
      genBuf.length !== recBuf.length ||
      !crypto.timingSafeEqual(genBuf, recBuf)
    ) {
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    const plans = await getAuthoritativeSubscriptionPlansAsync();
    const plan =
      plans[planId as SubscriptionTierId] ||
      SUBSCRIPTION_PLANS[planId as SubscriptionTierId];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid subscription tier selected' },
        { status: 400 }
      );
    }

    const txId = `tx_${gatewayPaymentId}`; // Use gateway ID for idempotency

    // Idempotency check: if transaction already verified, return existing record
    if (!IS_PREVIEW_DUMMY_FIREBASE) {
      try {
        const existingTxSnap = await getDoc(doc(db, 'billingTransactions', txId));
        if (existingTxSnap.exists()) {
          const existingSubSnap = await getDoc(
            doc(db, 'merchantSubscriptions', `sub_${storeId}`)
          );
          return NextResponse.json({
            success: true,
            idempotentReplay: true,
            transaction: existingTxSnap.data(),
            subscription: existingSubSnap.exists()
              ? existingSubSnap.data()
              : undefined,
            message: `Subscription payment already verified (${plan.name}).`,
          });
        }
      } catch {
        // Proceed if check fails
      }
    }

    // Compute authoritative server-side pricing including any reserved platform fees for this invoice
    const isAnnual = billingCycle === 'ANNUAL';
    const basePrice =
      currency === 'USD'
        ? isAnnual
          ? plan.annualPriceUsd
          : plan.monthlyPriceUsd
        : isAnnual
          ? plan.annualPriceInr
          : plan.monthlyPriceInr;

    const { reservedFeeTotal } = await getReservedFeesForInvoice(
      sellerId,
      invoiceNumber,
      currency
    );

    const subtotalWithFees = Math.round((basePrice + reservedFeeTotal) * 100) / 100;
    const taxRate = currency === 'INR' ? 0.18 : 0.0;
    const taxAmount = Math.round(subtotalWithFees * taxRate * 100) / 100;
    const totalAmount = Math.round((subtotalWithFees + taxAmount) * 100) / 100;

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(now.getFullYear() + 1);
    } else {
      periodEnd.setMonth(now.getMonth() + 1);
    }

    const resolvedInvoiceNumber =
      invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;

    const transaction: BillingTransaction = {
      id: txId,
      sellerId,
      storeId,
      type: 'SUBSCRIPTION',
      description:
        reservedFeeTotal > 0
          ? `Citykart ${plan.name} (${billingCycle}) Plan Subscription + Platform Fees (₹${reservedFeeTotal.toFixed(2)})`
          : `Citykart ${plan.name} (${billingCycle}) Plan Subscription`,
      amount: subtotalWithFees,
      taxAmount,
      totalAmount,
      currency: currency as 'INR' | 'USD',
      status: 'SUCCESS',
      paymentGateway: paymentGateway as 'RAZORPAY' | 'STRIPE',
      gatewayTransactionId: gatewayPaymentId,
      invoiceNumber: resolvedInvoiceNumber,
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
      paymentMethodSnippet:
        paymentGateway === 'RAZORPAY' ? 'UPI / NetBanking' : 'Card',
      lastPaymentDate: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Resilient Firestore persistence: try adminDb first, fall back to client SDK db
    try {
      const batch = adminDb.batch();
      const txRef = adminDb.collection('billingTransactions').doc(txId);
      const subRef = adminDb
        .collection('merchantSubscriptions')
        .doc(subscription.id);
      const storeRef = adminDb.collection('stores').doc(storeId);

      batch.set(txRef, transaction);
      batch.set(subRef, subscription, { merge: true });
      batch.set(
        storeRef,
        {
          subscriptionTier: planId,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiry: subscription.currentPeriodEnd,
        },
        { merge: true }
      );

      await batch.commit();
    } catch (adminErr) {
      console.warn(
        '[verify-payment] adminDb batch write notice, falling back to Web SDK:',
        adminErr
      );
      if (!IS_PREVIEW_DUMMY_FIREBASE) {
        try {
          const clientBatch = writeBatch(db);
          clientBatch.set(doc(db, 'billingTransactions', txId), transaction);
          clientBatch.set(
            doc(db, 'merchantSubscriptions', subscription.id),
            subscription,
            { merge: true }
          );
          clientBatch.set(
            doc(db, 'stores', storeId),
            {
              subscriptionTier: planId,
              subscriptionStatus: 'ACTIVE',
              subscriptionExpiry: subscription.currentPeriodEnd,
            },
            { merge: true }
          );
          await clientBatch.commit();
        } catch (fallbackErr) {
          console.warn('[verify-payment] Web SDK write notice:', fallbackErr);
        }
      }
    }

    // Mark reserved platform fees for this invoice as 'paid' across all storage tiers
    await markInvoicePlatformFeesPaid(sellerId, invoiceNumber, txId);

    return NextResponse.json({
      success: true,
      transaction,
      subscription,
      message: `Successfully activated ${plan.name} subscription`,
    });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    const message =
      error instanceof Error ? error.message : 'Payment verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
