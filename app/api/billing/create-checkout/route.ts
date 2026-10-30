import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db, IS_PREVIEW_DUMMY_FIREBASE, removeUndefined } from '@/lib/firebase';
import { INITIAL_STORES, LocalStore } from '@/lib/catalog-data';
import { serverStoresRegistry } from '@/lib/stores-registry';
import {
  BillingCycle,
  BillingTransaction,
  MerchantSubscription,
  SubscriptionTierId,
} from '@/lib/revenue-model';
import {
  getAuthoritativeSubscriptionPlansAsync,
  serverBillingTransactionsRegistry,
  serverSubscriptionsRegistry,
  verifyAdminRequest,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';
import { reserveSellerOutstandingFeesForInvoice } from '@/lib/fees';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // Use placeholders to prevent the Razorpay SDK from throwing an 'oauthToken is mandatory' error during instantiation
  const razorpay = new Razorpay({
    key_id: keyId || 'rzp_test_placeholder',
    key_secret: keySecret || 'placeholder_secret',
  });

  try {
    const body = await req.json();
    const {
      sellerId,
      storeId,
      planId,
      billingCycle,
      currency = 'INR',
      prefillName = '',
      prefillPhone = '',
      prefillEmail = '',
    } = body;

    if (!sellerId || !storeId || !planId || !billingCycle) {
      return NextResponse.json(
        { error: 'Missing required checkout parameters' },
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
            'Forbidden: Store ownership mismatch. You can only initiate subscription checkout for your own store.',
        },
        { status: 403 }
      );
    }

    const authoritativePlans = await getAuthoritativeSubscriptionPlansAsync();
    const plan = authoritativePlans[planId as SubscriptionTierId];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid subscription tier selected' },
        { status: 400 }
      );
    }

    const isAnnual = billingCycle === 'ANNUAL';
    const basePrice =
      currency === 'USD'
        ? isAnnual
          ? plan.annualPriceUsd
          : plan.monthlyPriceUsd
        : isAnnual
          ? plan.annualPriceInr
          : plan.monthlyPriceInr;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Calculate and reserve outstanding platform fees for this invoice
    const { outstandingFees } = await reserveSellerOutstandingFeesForInvoice(
      sellerId,
      currency,
      invoiceNumber
    );

    const taxRate = currency === 'INR' ? 0.18 : 0.0;
    const taxAmount =
      Math.round((basePrice + outstandingFees) * taxRate * 100) / 100;
    const totalAmount =
      Math.round((basePrice + outstandingFees + taxAmount) * 100) / 100;

    const now = new Date();
    const periodEnd = new Date(now);
    if (isAnnual) {
      periodEnd.setFullYear(now.getFullYear() + 1);
    } else {
      periodEnd.setMonth(now.getMonth() + 1);
    }

    // Direct activation for zero-amount switches (e.g., switching to Free Tier with 0 outstanding fees)
    if (totalAmount <= 0) {
      const freeSubscription: MerchantSubscription = removeUndefined({
        id: `sub_${storeId}`,
        sellerId,
        storeId,
        planId: planId as SubscriptionTierId,
        billingCycle: billingCycle as BillingCycle,
        status: 'ACTIVE',
        currency: currency as 'INR' | 'USD',
        currentPrice: 0,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        cancelAtPeriodEnd: false,
        paymentMethodSnippet: 'No Charge (Free Plan)',
        lastPaymentDate: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      serverSubscriptionsRegistry.set(storeId, freeSubscription);
      const existingRegStore = serverStoresRegistry.get(storeId) || targetStore;
      if (existingRegStore) {
        serverStoresRegistry.set(storeId, {
          ...existingRegStore,
          subscriptionTier: planId as SubscriptionTierId,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiry: freeSubscription.currentPeriodEnd,
        } as LocalStore);
      }

      if (!IS_PREVIEW_DUMMY_FIREBASE) {
        try {
          const clientBatch = writeBatch(db);
          clientBatch.set(
            doc(db, 'merchantSubscriptions', freeSubscription.id),
            freeSubscription,
            { merge: true }
          );
          clientBatch.set(
            doc(db, 'stores', storeId),
            {
              subscriptionTier: planId,
              subscriptionStatus: 'ACTIVE',
              subscriptionExpiry: freeSubscription.currentPeriodEnd,
            },
            { merge: true }
          );
          await clientBatch.commit();
        } catch {
          // Local storage fallback on client
        }
      }

      return NextResponse.json({
        success: true,
        directActivation: true,
        subscription: freeSubscription,
        message: `Your store has been switched to ${plan.name}.`,
      });
    }

    const isPlaceholderCreds =
      !keyId ||
      !keySecret ||
      keyId.includes('placeholder') ||
      keySecret.includes('placeholder') ||
      keyId.includes('your_');

    // Build sandbox preview records when live Razorpay keys are not yet configured
    const buildSandboxFallback = async () => {
      const txId = `tx_sub_sandbox_${Date.now()}`;
      const sandboxSubscription: MerchantSubscription = removeUndefined({
        id: `sub_${storeId}`,
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
        paymentMethodSnippet: 'Sandbox Preview (No Live Charge)',
        lastPaymentDate: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      const sandboxTransaction: BillingTransaction = removeUndefined({
        id: txId,
        sellerId,
        storeId,
        type: 'SUBSCRIPTION',
        description: `[Sandbox Preview — No Live Charge] Citykart ${plan.name} (${billingCycle}) Plan Subscription`,
        amount: Math.round((basePrice + outstandingFees) * 100) / 100,
        taxAmount,
        totalAmount,
        currency: currency as 'INR' | 'USD',
        status: 'SUCCESS',
        paymentGateway: 'RAZORPAY',
        gatewayTransactionId: `sandbox_${Date.now().toString(36)}`,
        invoiceNumber,
        createdAt: now.toISOString(),
      });

      serverSubscriptionsRegistry.set(storeId, sandboxSubscription);
      serverBillingTransactionsRegistry.set(txId, sandboxTransaction);
      const existingRegStore = serverStoresRegistry.get(storeId) || targetStore;
      if (existingRegStore) {
        serverStoresRegistry.set(storeId, {
          ...existingRegStore,
          subscriptionTier: planId as SubscriptionTierId,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiry: sandboxSubscription.currentPeriodEnd,
        } as LocalStore);
      }

      if (!IS_PREVIEW_DUMMY_FIREBASE) {
        try {
          const clientBatch = writeBatch(db);
          clientBatch.set(doc(db, 'billingTransactions', txId), sandboxTransaction);
          clientBatch.set(
            doc(db, 'merchantSubscriptions', sandboxSubscription.id),
            sandboxSubscription,
            { merge: true }
          );
          clientBatch.set(
            doc(db, 'stores', storeId),
            {
              subscriptionTier: planId,
              subscriptionStatus: 'ACTIVE',
              subscriptionExpiry: sandboxSubscription.currentPeriodEnd,
            },
            { merge: true }
          );
          await clientBatch.commit();
        } catch {
          // Ignore Firestore error when using server registry
        }
      }

      return { sandboxSubscription, sandboxTransaction };
    };

    // If credentials are missing or placeholders, return 'needsConfig' along with sandbox preview records
    if (isPlaceholderCreds) {
      const { sandboxSubscription, sandboxTransaction } = await buildSandboxFallback();
      return NextResponse.json({
        success: true,
        needsConfig: true,
        sandboxSubscription,
        sandboxTransaction,
        message:
          'Razorpay credentials are not yet configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.',
        checkoutSession: {
          invoiceNumber,
          sellerId,
          storeId,
          planId,
          planName: plan.name,
          billingCycle,
          currency,
          totalAmount,
          taxAmount,
          basePrice,
          outstandingFees,
        },
      });
    }

    // Create Razorpay Order
    let razorpayOrder: {
      id: string;
      amount: number | string;
      currency: string;
      notes?: unknown;
    };
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.max(100, Math.round(totalAmount * 100)), // in paise (minimum 100 paise = ₹1)
        currency: currency as string,
        receipt: invoiceNumber,
        notes: {
          storeId,
          sellerId,
          planId,
          billingCycle,
          invoiceNumber,
          outstandingFees: String(outstandingFees),
          type: 'SUBSCRIPTION',
        },
      });
    } catch (rzpErr: unknown) {
      const statusCode = (rzpErr as { statusCode?: number })?.statusCode;
      if (statusCode === 401) {
        const { sandboxSubscription, sandboxTransaction } = await buildSandboxFallback();
        return NextResponse.json({
          success: true,
          needsConfig: true,
          sandboxSubscription,
          sandboxTransaction,
          message:
            'Razorpay API credentials could not be authenticated (HTTP 401). Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment configuration.',
          checkoutSession: {
            invoiceNumber,
            sellerId,
            storeId,
            planId,
            planName: plan.name,
            billingCycle,
            currency,
            totalAmount,
            taxAmount,
            basePrice,
            outstandingFees,
          },
        });
      }
      throw rzpErr;
    }

    return NextResponse.json({
      success: true,
      checkoutSession: {
        orderReferenceId: razorpayOrder.id,
        invoiceNumber,
        sellerId,
        storeId,
        planId,
        planName: plan.name,
        billingCycle,
        currency,
        basePrice,
        outstandingFees,
        taxAmount,
        totalAmount,
        gatewayOptions: {
          key: keyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: 'Citykart Merchant Services',
          description: `${plan.name} (${billingCycle.toLowerCase()}) Subscription`,
          order_id: razorpayOrder.id,
          prefill: {
            name: prefillName || targetStore?.name || '',
            email: prefillEmail || '',
            contact: prefillPhone || caller.phoneE164 || '',
          },
          theme: {
            color: '#003B8E',
          },
          notes: razorpayOrder.notes,
        },
      },
    });
  } catch (error) {
    console.error('Create Checkout Error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
