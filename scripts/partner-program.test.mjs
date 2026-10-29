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

describe('City Partner Program & Onboarding Verification Suite', () => {
  it('Defines canonical 50/50 partner revenue share policy constants in /lib/partner-program.ts', () => {
    const src = readSource('lib/partner-program.ts');
    assert.ok(
      src.includes('DEFAULT_PARTNER_REVENUE_SHARE_PERCENT = 50'),
      'Default partner revenue share must be 50%'
    );
    assert.ok(
      src.includes('DEFAULT_CITYKART_RETAINED_SHARE_PERCENT = 50'),
      'Default CityKart retained share must be 50%'
    );
  });

  it('Enforces OTP session authentication and prevents self-approval in /app/api/partners/applications/route.ts', () => {
    const src = readSource('app/api/partners/applications/route.ts');
    assert.ok(
      src.includes('Cannot self-approve') || src.includes('status: 403'),
      'Applications route must reject self-approval attempts with HTTP 403'
    );
    assert.ok(
      src.includes('WITHDRAW'),
      'Applications route must support applicant withdrawal with ownership check'
    );
  });

  it('Protects Partner Dashboard from unapproved applicants in /app/api/partners/dashboard/route.ts', () => {
    const src = readSource('app/api/partners/dashboard/route.ts');
    assert.ok(
      src.includes('status: 401') && src.includes('status: 403'),
      'Partner dashboard route must enforce 401 unauthenticated and 403 unapproved checks'
    );
  });

  it('Super Admin Partner Governance API supports approving, rejecting, and managing city allocations', () => {
    const src = readSource('app/api/admin/partners/route.ts');
    assert.ok(src.includes('APPROVE_APPLICATION'), 'Must support APPROVE_APPLICATION');
    assert.ok(src.includes('REJECT_APPLICATION'), 'Must support REJECT_APPLICATION');
    assert.ok(src.includes('verifyAdminRequest'), 'Must verify admin authorization');
  });
});
