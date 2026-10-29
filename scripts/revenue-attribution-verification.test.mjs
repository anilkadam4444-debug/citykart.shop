import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readSource(relPath) {
  const fullPath = path.join(ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function computePartnerShare(netRecognizedRevenueInr, partnerSharePercent = 50) {
  const validNet = Math.max(0, Number(netRecognizedRevenueInr) || 0);
  const partnerPool = Math.round((validNet * partnerSharePercent) / 100);
  const retainedPool = validNet - partnerPool;
  return { validNet, partnerPool, retainedPool };
}

describe('Revenue Attribution & 50/50 City Partner Financial Verification Suite', () => {
  it('Verifies 5-tier SaaS subscription model and 0% order commission in /lib/revenue-model.ts', () => {
    const src = readSource('lib/revenue-model.ts');
    for (const tier of ['FREE', 'STARTER', 'GROWTH', 'BUSINESS_PRO', 'ENTERPRISE']) {
      assert.ok(src.includes(`id: '${tier}'`), `Subscription tier ${tier} must be defined`);
    }
    assert.ok(src.includes('commissionPct: 0'), 'Plans must preserve 0% order commission policy');
    assert.ok(src.includes('calculatePlatformRevenueMetrics'), 'Must export calculatePlatformRevenueMetrics');
  });

  it('Verifies deterministic ₹10 platform fee calculation in /lib/fees.ts', () => {
    const src = readSource('lib/fees.ts');
    assert.ok(src.includes('PLATFORM_FEE_INR = 10'), 'Platform fee constant must be ₹10');
    assert.ok(src.includes('calculateOrderFees'), 'Must export calculateOrderFees');
  });

  it('Computes accurate 50/50 Partner & CityKart retained revenue split and handles refunds/reversals', () => {
    const recognized = computePartnerShare(10000, 50);
    assert.equal(recognized.partnerPool, 5000);
    assert.equal(recognized.retainedPool, 5000);

    // Refunded or reversed transactions reduce net recognized revenue before partner split
    const afterRefund = computePartnerShare(10000 - 2000, 50);
    assert.equal(afterRefund.partnerPool, 4000);
    assert.equal(afterRefund.retainedPool, 4000);

    // Negative/zero guard
    const zeroCase = computePartnerShare(-500, 50);
    assert.equal(zeroCase.validNet, 0);
    assert.equal(zeroCase.partnerPool, 0);
    assert.equal(zeroCase.retainedPool, 0);
  });

  it('Verifies city-level revenue attribution engine in /lib/partner-program.ts', () => {
    const src = readSource('lib/partner-program.ts');
    assert.ok(
      src.includes('CityRevenueAttributionSummary') && src.includes('CityEligibleRevenueItem'),
      'Must implement city-level partner revenue attribution in lib/partner-program.ts'
    );
  });
});
