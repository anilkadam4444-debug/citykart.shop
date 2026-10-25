import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { SUBSCRIPTION_PLANS, SubscriptionTierId } from '@/lib/revenue-model';

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
    const { sellerId, storeId, planId, billingCycle, currency = 'INR' } = body;

    if (!sellerId || !storeId || !planId || !billingCycle) {
      return NextResponse.json(
        { error: 'Missing required checkout parameters' },
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

    const taxRate = currency === 'INR' ? 0.18 : 0.0;
    const taxAmount = Math.round(basePrice * taxRate * 100) / 100;
    const totalAmount = Math.round((basePrice + taxAmount) * 100) / 100;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // If credentials are missing, return a special 'needsConfig' response
    if (!keyId || !keySecret) {
      return NextResponse.json({
        success: true,
        needsConfig: true,
        message: 'Razorpay credentials are not yet configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables.',
        checkoutSession: {
          invoiceNumber,
          totalAmount,
          taxAmount,
          basePrice,
        }
      });
    }

    // Create Razorpay Order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // in paise
      currency: currency as string,
      receipt: invoiceNumber,
      notes: {
        storeId,
        sellerId,
        planId,
        billingCycle,
        type: 'SUBSCRIPTION',
      },
    });

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
            name: '',
            email: '', 
            contact: '',
          },
          notes: razorpayOrder.notes,
        },
      },
    });
  } catch (error) {
    console.error('Create Checkout Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


