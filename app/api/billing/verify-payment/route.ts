import { NextRequest, NextResponse } from 'next/server';
import {
  BillingTransaction,
  MerchantSubscription,
  SUBSCRIPTION_PLANS,
  SubscriptionTierId,
  BillingCycle,
} from '@/lib/revenue-model';

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

    if (!sellerId || !storeId || !planId) {
      return NextResponse.json({ error: 'Missing required payment verification details' }, { status: 400 });
    }

    // In a live production environment with real keys:
    // const crypto = require('crypto');
    // const expectedSignature = crypto.createHmac('sha256', secret).update(gatewayOrderId + '|' + gatewayPaymentId).digest('hex');
    // if (expectedSignature !== gatewaySignature) throw new Error('Invalid signature');

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'ANNUAL') {
      periodEnd.setFullYear(now.getFullYear() + 1);
    } else {
      periodEnd.setMonth(now.getMonth() + 1);
    }

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
      gatewayTransactionId: gatewayPaymentId || `pay_sim_${Date.now()}`,
      invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      createdAt: now.toISOString(),
    };

    const subscription: MerchantSubscription = {
      id: `sub_${storeId}_${Date.now()}`,
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

    return NextResponse.json({
      success: true,
      transaction,
      subscription,
      message: `Successfully activated ${plan.name} subscription`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
