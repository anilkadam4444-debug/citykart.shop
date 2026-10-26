import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const ROOT_DIR = process.cwd();
const PARTNER_PROGRAM_PATH = path.join(ROOT_DIR, 'lib/partner-program.ts');

/**
 * Loads and compiles the actual backend `calculateCityPartnerRevenueReport`
 * function directly from `/lib/partner-program.ts` so every test assertion
 * compares our reference Net Eligible Revenue & 50/50 split calculator
 * against the live backend implementation.
 */
function loadBackendRevenueAttributionEngine() {
  const rawTs = fs.readFileSync(PARTNER_PROGRAM_PATH, 'utf8');

  // Extract the exact `roundCurrency2` helper and `calculateCityPartnerRevenueReport` implementation from lib/partner-program.ts
  const startMarker = '// 10. CENTRALIZED CITY REVENUE ATTRIBUTION & 50/50 REVENUE-SHARING ENGINE';
  const endMarker = '// 11. MONTHLY SETTLEMENT GENERATION, APPROVAL & MANUAL PAYOUT WORKFLOW';

  const startIdx = rawTs.indexOf(startMarker);
  const endIdx = rawTs.indexOf(endMarker);

  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    'Could not locate Section 10 (Revenue Attribution Engine) in lib/partner-program.ts'
  );

  const sectionTs = rawTs.slice(startIdx, endIdx);

  // Strip TypeScript type annotations using Node's native stripTypeScriptTypes
  const strippedJs = stripTypeScriptTypes(sectionTs, { mode: 'strip' }).replace(
    /export\s+function\s+calculateCityPartnerRevenueReport/g,
    'function calculateCityPartnerRevenueReport'
  );

  const sandbox = {
    DEFAULT_PARTNER_REVENUE_SHARE_PERCENT: 50,
    DEFAULT_CITYKART_RETAINED_SHARE_PERCENT: 50,
    serverPlatformFeeLedgerRegistry: new Map(),
    roundCurrency2(value) {
      if (!Number.isFinite(value)) return 0;
      return Math.round((value + Number.EPSILON) * 100) / 100;
    },
    Math,
    Number,
    Date,
    Set,
    Map,
    Array,
    Boolean,
  };

  vm.createContext(sandbox);
  vm.runInContext(
    `${strippedJs}\nthis.calculateCityPartnerRevenueReport = calculateCityPartnerRevenueReport;`,
    sandbox
  );

  assert.equal(
    typeof sandbox.calculateCityPartnerRevenueReport,
    'function',
    'Backend calculateCityPartnerRevenueReport must compile to a callable function'
  );

  return sandbox.calculateCityPartnerRevenueReport;
}

/**
 * Reference specification calculator for Net Eligible Revenue & 50/50 Split
 * based on collected fees, refunds/reversals, and agreed deductions.
 */
function calculateReferenceNetEligibleRevenueAndSplit({
  collectedPlatformFees = 0,
  collectedSubscriptionsPreTax = 0,
  collectedSponsoredAdsPreTax = 0,
  collectedVasPreTax = 0,
  approvedRefundsAndReversals = 0,
  agreedDeductions = 0,
  partnerSharePercent = 50,
}) {
  const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

  const eligibleRevenueCollected = round2(
    collectedPlatformFees +
      collectedSubscriptionsPreTax +
      collectedSponsoredAdsPreTax +
      collectedVasPreTax
  );

  const refundsAndReversals = round2(Math.max(0, approvedRefundsAndReversals));
  const deductions = round2(Math.max(0, agreedDeductions));

  // Net Eligible Revenue = max(0, Eligible Revenue Collected - Refunds/Reversals - Agreed Deductions)
  const netEligibleRevenue = round2(
    Math.max(0, eligibleRevenueCollected - refundsAndReversals - deductions)
  );

  // 50/50 Split
  const partnerShareAmount = round2(
    netEligibleRevenue * (partnerSharePercent / 100)
  );
  const citykartRetainedAmount = round2(
    netEligibleRevenue - partnerShareAmount
  );

  return {
    eligibleRevenueCollected,
    refundsAndReversals,
    agreedDeductions: deductions,
    netEligibleRevenue,
    partnerSharePercent,
    citykartRetainedPercent: round2(100 - partnerSharePercent),
    partnerShareAmount,
    citykartRetainedAmount,
  };
}

const backendCalculateCityPartnerRevenueReport =
  loadBackendRevenueAttributionEngine();

test('Scenario 1: Baseline Collected Platform Fees (₹10,000 collected, ₹0 refunds, ₹0 deductions -> ₹5,000 / ₹5,000)', () => {
  const cityId = 'india-maharashtra-nanded';
  const stores = [
    {
      id: 'store-nanded-1',
      sellerId: 'seller-nanded-1',
      name: 'Nanded Fresh Mart',
      cityId,
      cityName: 'Nanded',
    },
  ];
  const orders = [
    {
      id: 'ord-101',
      storeId: 'store-nanded-1',
      sellerId: 'seller-nanded-1',
      total: 500000, // Seller product COD GMV (must be excluded from partner revenue)
      orderStatus: 'DELIVERED',
      createdAt: '2026-10-10T10:00:00.000Z',
    },
  ];
  const platformFeeLedger = [
    {
      id: 'fee-101',
      orderId: 'ord-101',
      sellerId: 'seller-nanded-1',
      cityId,
      currency: 'INR',
      totalFee: 10000,
      status: 'paid',
      createdAt: '2026-10-10T10:05:00.000Z',
      updatedAt: '2026-10-10T10:05:00.000Z',
    },
  ];

  const backendReport = backendCalculateCityPartnerRevenueReport({
    cityId,
    cityName: 'Nanded',
    periodMonth: '2026-10',
    currency: 'INR',
    agreedDeductions: 0,
    stores,
    orders,
    transactions: [],
    platformFeeLedger,
  });

  const expected = calculateReferenceNetEligibleRevenueAndSplit({
    collectedPlatformFees: 10000,
    approvedRefundsAndReversals: 0,
    agreedDeductions: 0,
  });

  assert.equal(backendReport.eligibleRevenueCollected, expected.eligibleRevenueCollected);
  assert.equal(backendReport.netEligibleRevenue, expected.netEligibleRevenue);
  assert.equal(backendReport.partnerSharePercent, 50);
  assert.equal(backendReport.citykartRetainedPercent, 50);
  assert.equal(backendReport.partnerShareAmount, expected.partnerShareAmount);
  assert.equal(backendReport.citykartRetainedAmount, expected.citykartRetainedAmount);
  assert.equal(backendReport.partnerShareAmount, 5000);
  assert.equal(backendReport.citykartRetainedAmount, 5000);
  assert.equal(backendReport.citySellerProductGmvExcluded, 500000);
});

test('Scenario 2: Multi-Stream Revenue with Approved Refunds & Agreed Deductions (Platform Fees + Pre-Tax Subscriptions + Ads)', () => {
  const cityId = 'india-maharashtra-nanded';
  const stores = [
    {
      id: 'store-nanded-1',
      sellerId: 'seller-nanded-1',
      name: 'Nanded Super Bazaar',
      cityId,
      cityName: 'Nanded',
    },
  ];
  const orders = [
    {
      id: 'ord-201',
      storeId: 'store-nanded-1',
      sellerId: 'seller-nanded-1',
      total: 120000,
      orderStatus: 'DELIVERED',
      createdAt: '2026-10-12T09:00:00.000Z',
    },
  ];

  // Platform fees: ₹30,000 paid + ₹2,000 previously paid & reversed + ₹4,500 outstanding (uncollected)
  const platformFeeLedger = [
    {
      id: 'fee-paid-1',
      orderId: 'ord-201',
      sellerId: 'seller-nanded-1',
      cityId,
      currency: 'INR',
      totalFee: 30000,
      status: 'paid',
      createdAt: '2026-10-12T10:00:00.000Z',
      updatedAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'fee-reversed-1',
      orderId: 'ord-201',
      sellerId: 'seller-nanded-1',
      cityId,
      currency: 'INR',
      totalFee: 2000,
      status: 'reversed',
      paidByTransactionId: 'tx_settlement_prev', // Was collected, then reversed
      createdAt: '2026-10-13T10:00:00.000Z',
      updatedAt: '2026-10-13T10:00:00.000Z',
    },
    {
      id: 'fee-uncollected-1',
      orderId: 'ord-201',
      sellerId: 'seller-nanded-1',
      cityId,
      currency: 'INR',
      totalFee: 4500,
      status: 'outstanding', // Must be excluded
      createdAt: '2026-10-14T10:00:00.000Z',
      updatedAt: '2026-10-14T10:00:00.000Z',
    },
  ];

  // Billing transactions:
  // - ₹25,000 pre-tax Subscription (SUCCESS, + ₹4,500 GST excluded)
  // - ₹15,000 pre-tax Sponsored Ad (SUCCESS, + ₹2,700 GST excluded)
  // - ₹3,000 pre-tax Subscription (REFUNDED, + ₹540 GST excluded)
  // - ₹8,000 pre-tax Ad Campaign (PENDING -> must be excluded)
  // - ₹50,000 pre-tax Subscription from Pune (other city -> must be excluded)
  const transactions = [
    {
      id: 'tx-sub-1',
      storeId: 'store-nanded-1',
      sellerId: 'seller-nanded-1',
      cityId,
      type: 'SUBSCRIPTION',
      status: 'SUCCESS',
      currency: 'INR',
      amount: 25000,
      taxAmount: 4500,
      totalAmount: 29500,
      invoiceNumber: 'INV-SUB-01',
      createdAt: '2026-10-15T10:00:00.000Z',
    },
    {
      id: 'tx-ad-1',
      storeId: 'store-nanded-1',
      sellerId: 'seller-nanded-1',
      cityId,
      type: 'AD_CAMPAIGN',
      status: 'SUCCESS',
      currency: 'INR',
      amount: 15000,
      taxAmount: 2700,
      totalAmount: 17700,
      invoiceNumber: 'INV-AD-01',
      createdAt: '2026-10-16T10:00:00.000Z',
    },
    {
      id: 'tx-sub-refund-1',
      storeId: 'store-nanded-1',
      sellerId: 'seller-nanded-1',
      cityId,
      type: 'SUBSCRIPTION',
      status: 'REFUNDED',
      currency: 'INR',
      amount: 3000,
      taxAmount: 540,
      totalAmount: 3540,
      invoiceNumber: 'INV-SUB-REF-01',
      createdAt: '2026-10-17T10:00:00.000Z',
    },
    {
      id: 'tx-pending-1',
      storeId: 'store-nanded-1',
      sellerId: 'seller-nanded-1',
      cityId,
      type: 'AD_CAMPAIGN',
      status: 'PENDING',
      currency: 'INR',
      amount: 8000,
      taxAmount: 1440,
      totalAmount: 9440,
      invoiceNumber: 'INV-PEND-01',
      createdAt: '2026-10-18T10:00:00.000Z',
    },
    {
      id: 'tx-other-city-pune',
      storeId: 'store-pune-99',
      sellerId: 'seller-pune-99',
      cityId: 'india-maharashtra-pune',
      type: 'SUBSCRIPTION',
      status: 'SUCCESS',
      currency: 'INR',
      amount: 50000,
      taxAmount: 9000,
      totalAmount: 59000,
      invoiceNumber: 'INV-PUNE-01',
      createdAt: '2026-10-18T12:00:00.000Z',
    },
  ];

  const agreedDeductions = 1500;

  const backendReport = backendCalculateCityPartnerRevenueReport({
    cityId,
    cityName: 'Nanded',
    periodMonth: '2026-10',
    currency: 'INR',
    agreedDeductions,
    stores,
    orders,
    transactions,
    platformFeeLedger,
  });

  // Note: In the backend engine, a reversed paid fee (₹2,000) and a refunded transaction (₹3,000)
  // are recorded in both `eligibleRevenueCollected` (+₹2,000, +₹3,000) and `refundsAndReversals` (-₹2,000, -₹3,000),
  // yielding the exact net collected base before deductions.
  const expected = calculateReferenceNetEligibleRevenueAndSplit({
    collectedPlatformFees: 30000 + 2000,
    collectedSubscriptionsPreTax: 25000 + 3000,
    collectedSponsoredAdsPreTax: 15000,
    collectedVasPreTax: 0,
    approvedRefundsAndReversals: 2000 + 3000,
    agreedDeductions: 1500,
  });

  assert.equal(backendReport.platformFeesCollected, 32000);
  assert.equal(backendReport.subscriptionRevenueCollected, 28000);
  assert.equal(backendReport.sponsoredAdRevenueCollected, 15000);
  assert.equal(backendReport.eligibleRevenueCollected, expected.eligibleRevenueCollected); // 75,000
  assert.equal(backendReport.refundsAndReversals, expected.refundsAndReversals); // 5,000
  assert.equal(backendReport.agreedDeductions, expected.agreedDeductions); // 1,500
  assert.equal(backendReport.netEligibleRevenue, expected.netEligibleRevenue); // 68,500
  assert.equal(backendReport.partnerShareAmount, expected.partnerShareAmount); // 34,250
  assert.equal(backendReport.citykartRetainedAmount, expected.citykartRetainedAmount); // 34,250

  // Verify non-eligible exclusions are tracked accurately and never leaked into Net Eligible Revenue
  assert.equal(backendReport.uncollectedAccruedFeesExcluded, 4500);
  assert.equal(backendReport.pendingOrFailedInvoicesExcluded, 9440);
  assert.equal(backendReport.taxesExcludedTotal, 4500 + 2700 + 540); // 7,740 GST excluded
  assert.equal(backendReport.citySellerProductGmvExcluded, 120000);
});

test('Scenario 3: Fractional Paise Rounding & Zero-Floor Protection When Deductions Exceed Collected Revenue', () => {
  const cityId = 'india-maharashtra-latur';
  const stores = [
    {
      id: 'store-latur-1',
      sellerId: 'seller-latur-1',
      name: 'Latur Kirana Hub',
      cityId,
      cityName: 'Latur',
    },
  ];

  // Test 3A: Odd-rupee Net Eligible Revenue (₹1,001.25 -> 50% = ₹500.63 partner / ₹500.62 retained, sum = ₹1,001.25)
  const oddReport = backendCalculateCityPartnerRevenueReport({
    cityId,
    cityName: 'Latur',
    periodMonth: '2026-10',
    currency: 'INR',
    agreedDeductions: 100.5,
    stores,
    orders: [],
    transactions: [],
    platformFeeLedger: [
      {
        id: 'fee-odd-1',
        orderId: 'ord-odd-1',
        sellerId: 'seller-latur-1',
        cityId,
        currency: 'INR',
        totalFee: 1101.75,
        status: 'paid',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
      },
    ],
  });

  const expectedOdd = calculateReferenceNetEligibleRevenueAndSplit({
    collectedPlatformFees: 1101.75,
    approvedRefundsAndReversals: 0,
    agreedDeductions: 100.5,
  });

  assert.equal(oddReport.netEligibleRevenue, expectedOdd.netEligibleRevenue); // 1001.25
  assert.equal(oddReport.partnerShareAmount, expectedOdd.partnerShareAmount); // 500.63
  assert.equal(oddReport.citykartRetainedAmount, expectedOdd.citykartRetainedAmount); // 500.62
  assert.equal(
    oddReport.partnerShareAmount + oddReport.citykartRetainedAmount,
    oddReport.netEligibleRevenue
  );

  // Test 3B: Deductions + Refunds exceed collected revenue -> Clamped at 0 (never negative)
  const clampedReport = backendCalculateCityPartnerRevenueReport({
    cityId,
    cityName: 'Latur',
    periodMonth: '2026-10',
    currency: 'INR',
    agreedDeductions: 5000,
    stores,
    orders: [],
    transactions: [],
    platformFeeLedger: [
      {
        id: 'fee-small-1',
        orderId: 'ord-small-1',
        sellerId: 'seller-latur-1',
        cityId,
        currency: 'INR',
        totalFee: 1200,
        status: 'paid',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
      },
    ],
  });

  assert.equal(clampedReport.netEligibleRevenue, 0);
  assert.equal(clampedReport.partnerShareAmount, 0);
  assert.equal(clampedReport.citykartRetainedAmount, 0);
});
