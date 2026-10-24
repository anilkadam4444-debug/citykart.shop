import { NextRequest, NextResponse } from 'next/server';
import { SUBSCRIPTION_PLANS, SubscriptionTierId, BillingCycle } from '@/lib/revenue-model';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sellerId, storeId, planId, billingCycle, currency = 'INR' } = body;

    if (!sellerId || !storeId || !planId || !billingCycle) {
      return NextResponse.json(
        { error: 'Missing required checkout parameters (sellerId, storeId, planId, billingCycle)' },
        { status: 400 }
      );
    }

    const plan = SUBSCRIPTION_PLANS[planId as SubscriptionTierId];
    if (!plan) {
      return NextResponse.json({ error: 'Invalid subscription tier selected' }, { status: 400 });
    }

    const isAnnual = billingCycle === 'ANNUAL';
    const basePrice = currency === 'USD'
      ? (isAnnual ? plan.annualPriceUsd : plan.monthlyPriceUsd)
      : (isAnnual ? plan.annualPriceInr : plan.monthlyPriceInr);

    // 18% GST for India INR transactions
    const taxRate = currency === 'INR' ? 0.18 : 0.0;
    const taxAmount = Math.round(basePrice * taxRate * 100) / 100;
    const totalAmount = Math.round((basePrice + taxAmount) * 100) / 100;

    const orderReferenceId = `ord_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    return NextResponse.json({
      success: true,
      checkoutSession: {
        orderReferenceId,
        invoiceNumber,
        sellerId,
        storeId,
        planId,
        planName: plan.name,
        billingCycle,
        currency,
        basePrice,
        taxAmount,
        totalAmount,
        // Mock gateway credentials structure for Razorpay/Stripe integration
        gatewayOptions: {
          key: process.env.RAZORPAY_KEY_ID || 'rzp_test_urbandirect_preview',
          amount: Math.round(totalAmount * 100), // in paise / cents
          currency,
          name: 'Citykart Merchant Services',
          description: `${plan.name} (${billingCycle.toLowerCase()}) Subscription`,
          notes: {
            storeId,
            sellerId,
            planId,
            billingCycle,
          },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
