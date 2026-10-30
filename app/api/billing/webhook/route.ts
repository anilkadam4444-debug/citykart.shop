import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { db, IS_PREVIEW_DUMMY_FIREBASE, removeUndefined } from '@/lib/firebase';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import {
  BillingCycle,
  BillingTransaction,
  FeaturedCampaign,
  MerchantSubscription,
  SUBSCRIPTION_PLANS,
  SubscriptionTierId,
} from '@/lib/revenue-model';
import { getAuthoritativeSubscriptionPlansAsync } from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 400 }
      );
    }

    if (!secret) {
      return NextResponse.json(
        { error: 'Razorpay webhook secret not configured' },
        { status: 501 }
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      console.warn('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    const event = JSON.parse(body);
    const eventType: string = event.event || '';

    // =========================================================================
    // 1. PAYMENT CAPTURED OR ORDER PAID (SUBSCRIPTION, AD_CAMPAIGN, SERVICE_ORDER)
    // =========================================================================
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const payment = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      if (!payment) {
        return NextResponse.json({ status: 'ignored_no_entity' });
      }
      const orderId: string = payment.order_id || orderEntity?.id || '';
      const paymentId: string = payment.id || '';
      const notes = { ...(orderEntity?.notes || {}), ...(payment.notes || {}) };

      const {
        storeId,
        sellerId,
        planId,
        billingCycle,
        campaignId,
        type,
      } = notes;

      // Branch A: Sponsored Product / Featured Store Ad Campaign
      if (type === 'AD_CAMPAIGN' && campaignId && paymentId) {
        const txId = `tx_ad_${paymentId}`;

        // Idempotency check
        let alreadyProcessed = Boolean(
          globalThis.__serverCampaignTransactionsRegistry?.has(txId)
        );
        if (!alreadyProcessed && !IS_PREVIEW_DUMMY_FIREBASE) {
          try {
            const clientDoc = await getDoc(doc(db, 'billingTransactions', txId));
            alreadyProcessed = clientDoc.exists();
          } catch {
            alreadyProcessed = false;
          }
        }

        if (alreadyProcessed) {
          return NextResponse.json({
            status: 'ok',
            idempotent: true,
            message: 'Ad campaign webhook event already processed',
          });
        }

        let storedCampaign: FeaturedCampaign | null =
          globalThis.__serverCampaignsRegistry?.get(campaignId) || null;
        if (!storedCampaign && !IS_PREVIEW_DUMMY_FIREBASE) {
          try {
            const campSnap = await getDoc(
              doc(db, 'featuredCampaigns', campaignId)
            );
            if (campSnap.exists()) {
              storedCampaign = campSnap.data() as FeaturedCampaign;
            }
          } catch {
            // Memory fallback
          }
        }

        if (!storedCampaign) {
          return NextResponse.json(
            { error: `Campaign ${campaignId} not found for webhook activation` },
            { status: 404 }
          );
        }

        // Verify Razorpay orderId matches the campaign's orderId
        if (
          storedCampaign.razorpayOrderId &&
          orderId &&
          storedCampaign.razorpayOrderId !== orderId
        ) {
          return NextResponse.json(
            { error: 'Order ID mismatch for campaign webhook' },
            { status: 400 }
          );
        }

        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + Number(storedCampaign.durationDays || 7));

        const activatedCampaign: FeaturedCampaign = removeUndefined({
          ...storedCampaign,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          paymentStatus: 'PAID',
          paymentReferenceId: paymentId,
          razorpayOrderId: orderId || storedCampaign.razorpayOrderId,
          isSandboxProposal: false,
          startDate: now.toISOString(),
          endDate: endDate.toISOString(),
          updatedAt: now.toISOString(),
        });

        const totalPaidInr =
          typeof payment.amount === 'number'
            ? payment.amount / 100
            : storedCampaign.budgetInr;
        const taxPaidInr =
          typeof payment.tax === 'number'
            ? payment.tax / 100
            : storedCampaign.taxAmountInr || 0;

        const transaction: BillingTransaction = removeUndefined({
          id: txId,
          sellerId: storedCampaign.sellerId,
          storeId: storedCampaign.storeId,
          type: 'AD_CAMPAIGN',
          description: `${storedCampaign.placementLabel || 'Sponsored Product'} (${storedCampaign.durationDays} days) — ${storedCampaign.targetProductName || storedCampaign.storeName} (via Webhook)`,
          amount: Math.max(0, totalPaidInr - taxPaidInr),
          taxAmount: taxPaidInr,
          totalAmount: totalPaidInr,
          currency: (payment.currency as 'INR' | 'USD') || 'INR',
          status: 'SUCCESS',
          paymentGateway: 'RAZORPAY',
          gatewayTransactionId: paymentId,
          invoiceNumber:
            storedCampaign.invoiceNumber ||
            `INV-ADW-${Date.now().toString().slice(-6)}`,
          createdAt: now.toISOString(),
        });

        globalThis.__serverCampaignsRegistry?.set(
          campaignId,
          activatedCampaign
        );
        globalThis.__serverCampaignTransactionsRegistry?.set(txId, transaction);

        if (!IS_PREVIEW_DUMMY_FIREBASE) {
          try {
            const clientBatch = writeBatch(db);
            clientBatch.set(
              doc(db, 'featuredCampaigns', campaignId),
              activatedCampaign
            );
            clientBatch.set(doc(db, 'billingTransactions', txId), transaction);
            await clientBatch.commit();
          } catch (err) {
            console.warn('[webhook] Ad campaign Firestore write notice:', err);
          }
        }

        return NextResponse.json({
          status: 'ok',
          campaignId,
          activated: true,
        });
      }

      // Branch B: Merchant SaaS Subscription
      if (
        type === 'SUBSCRIPTION' &&
        storeId &&
        sellerId &&
        planId &&
        billingCycle
      ) {
        const now = new Date();
        const periodEnd = new Date(now);
        if (billingCycle === 'ANNUAL') {
          periodEnd.setFullYear(now.getFullYear() + 1);
        } else {
          periodEnd.setMonth(now.getMonth() + 1);
        }

        const txId = `tx_${paymentId}`;
        const authoritativePlans = await getAuthoritativeSubscriptionPlansAsync();
        const plan =
          authoritativePlans[planId as SubscriptionTierId] ||
          SUBSCRIPTION_PLANS[planId as SubscriptionTierId] ||
          SUBSCRIPTION_PLANS.FREE;

        // Check if already processed (idempotency)
        let alreadyExists = false;
        try {
          const txDoc = await adminDb
            .collection('billingTransactions')
            .doc(txId)
            .get();
          alreadyExists = txDoc.exists;
        } catch {
          if (!IS_PREVIEW_DUMMY_FIREBASE) {
            try {
              const clientDoc = await getDoc(
                doc(db, 'billingTransactions', txId)
              );
              alreadyExists = clientDoc.exists();
            } catch {
              alreadyExists = false;
            }
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
          amount: payment.amount / 100 - (payment.tax / 100 || 0),
          taxAmount: payment.tax / 100 || 0,
          totalAmount: payment.amount / 100,
          currency: payment.currency as 'INR' | 'USD',
          status: 'SUCCESS',
          paymentGateway: 'RAZORPAY',
          gatewayTransactionId: paymentId,
          invoiceNumber: notes.invoiceNumber || `INV-W-${Date.now().toString().slice(-6)}`,
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
          batch.set(
            adminDb.collection('billingTransactions').doc(txId),
            transaction
          );
          batch.set(
            adminDb.collection('merchantSubscriptions').doc(subscription.id),
            subscription,
            { merge: true }
          );
          batch.set(
            adminDb.collection('stores').doc(storeId),
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
            '[webhook] adminDb write notice, falling back to Web SDK:',
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
              console.warn('[webhook] Web SDK write notice:', fallbackErr);
            }
          }
        }

        const { markInvoicePlatformFeesPaid } = await import('@/lib/fees');
        await markInvoicePlatformFeesPaid(
          sellerId,
          notes.invoiceNumber,
          txId
        );
      }
    }

    // =========================================================================
    // 2. PAYMENT FAILED OR REFUND PROCESSED FOR AD_CAMPAIGN / SUBSCRIPTION
    // =========================================================================
    if (eventType === 'payment.failed' || eventType === 'refund.processed') {
      const entity =
        event.payload?.payment?.entity || event.payload?.refund?.entity;
      const notes = entity?.notes || {};
      const campaignId = notes.campaignId;

      if (notes.type === 'SUBSCRIPTION' && notes.sellerId && eventType === 'payment.failed') {
        const { releaseReservedInvoicePlatformFees } = await import('@/lib/fees');
        await releaseReservedInvoicePlatformFees(notes.sellerId, notes.invoiceNumber);
      }

      if (notes.type === 'AD_CAMPAIGN' && campaignId) {
        const nowIso = new Date().toISOString();
        const isRefund = eventType === 'refund.processed';
        const nextStatus = isRefund ? 'REFUNDED' : 'PENDING_PAYMENT';
        const nextPaymentStatus = isRefund ? 'REFUNDED' : 'FAILED';

        const existing = globalThis.__serverCampaignsRegistry?.get(campaignId);
        if (existing) {
          globalThis.__serverCampaignsRegistry?.set(campaignId, {
            ...existing,
            status: nextStatus,
            paymentStatus: nextPaymentStatus,
            updatedAt: nowIso,
          });
        }

        if (!IS_PREVIEW_DUMMY_FIREBASE) {
          try {
            await setDoc(
              doc(db, 'featuredCampaigns', campaignId),
              {
                status: nextStatus,
                paymentStatus: nextPaymentStatus,
                updatedAt: nowIso,
              },
              { merge: true }
            );
          } catch {
            // Ignore
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
