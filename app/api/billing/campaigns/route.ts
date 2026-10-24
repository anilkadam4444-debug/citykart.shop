import { NextRequest, NextResponse } from 'next/server';
import {
  BillingTransaction,
  FeaturedCampaign,
  FEATURED_STORE_PACKAGES,
  SPONSORED_PRODUCT_PACKAGES,
} from '@/lib/revenue-model';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sellerId,
      storeId,
      storeName,
      type, // 'FEATURED_STORE' | 'SPONSORED_PRODUCT'
      targetProductId,
      targetProductName,
      cityId,
      cityName,
      durationDays,
    } = body;

    if (!sellerId || !storeId || !type || !cityId || !durationDays) {
      return NextResponse.json({ error: 'Missing required campaign parameters' }, { status: 400 });
    }

    const packages = type === 'FEATURED_STORE' ? FEATURED_STORE_PACKAGES : SPONSORED_PRODUCT_PACKAGES;
    const selectedPkg = packages.find((p) => p.days === Number(durationDays)) || packages[0];

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + selectedPkg.days);

    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const txId = `tx_camp_${Date.now()}`;

    const campaign: FeaturedCampaign = {
      id: campaignId,
      sellerId,
      storeId,
      storeName: storeName || 'Local Store',
      type,
      targetProductId: targetProductId || undefined,
      targetProductName: targetProductName || undefined,
      cityId,
      cityName: cityName || 'City',
      status: 'ACTIVE',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      durationDays: selectedPkg.days,
      budgetInr: selectedPkg.priceInr,
      impressions: 0,
      clicks: 0,
      createdAt: now.toISOString(),
    };

    const transaction: BillingTransaction = {
      id: txId,
      sellerId,
      storeId,
      type: 'AD_CAMPAIGN',
      description: `${type === 'FEATURED_STORE' ? 'Featured Store' : 'Sponsored Product'} (${selectedPkg.days} days boost) in ${cityName}`,
      amount: selectedPkg.priceInr,
      taxAmount: Math.round(selectedPkg.priceInr * 0.18 * 100) / 100,
      totalAmount: Math.round(selectedPkg.priceInr * 1.18 * 100) / 100,
      currency: 'INR',
      status: 'SUCCESS',
      paymentGateway: 'RAZORPAY',
      invoiceNumber: `INV-AD-${Date.now().toString().slice(-6)}`,
      createdAt: now.toISOString(),
    };

    return NextResponse.json({
      success: true,
      campaign,
      transaction,
      message: `Campaign launched successfully for ${selectedPkg.days} days`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign creation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
