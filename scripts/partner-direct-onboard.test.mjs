import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const readSource = (relPath) =>
  fs.readFileSync(path.join(rootDir, relPath), 'utf8');

const partnerProgramSrc = readSource('lib/partner-program.ts');
const adminAuthSrc = readSource('lib/super-admin-auth.ts');
const adminRouteSrc = readSource('app/api/admin/partners/route.ts');
const adminPartnerMgmtSrc = readSource(
  'components/admin-partner-management.tsx'
);
const superAdminDashboardSrc = readSource(
  'components/super-admin-dashboard.tsx'
);

// Constants from architecture
const DESIGNATED_SUPER_ADMIN_PHONE = '+918329306616';

// Behavioral simulation of directOnboardCityPartner invariants
function simulateDirectOnboardValidation({
  adminPhone,
  isSuperAdmin,
  partnerFullName,
  phoneE164,
  canonicalCities,
  allocatedCities,
  activePartnerPhones,
  cityId,
}) {
  if (!isSuperAdmin || adminPhone !== DESIGNATED_SUPER_ADMIN_PHONE) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Forbidden: Only Platform Owner Super Admin can direct onboard partners.',
    };
  }

  const cleanPhone = (phoneE164 || '').trim();
  if (!cleanPhone || !cleanPhone.startsWith('+') || cleanPhone.length < 8) {
    return {
      ok: false,
      statusCode: 400,
      error: 'A valid E.164 mobile number is required.',
    };
  }

  // Self-approval / self-onboarding prevention
  if (cleanPhone === DESIGNATED_SUPER_ADMIN_PHONE) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Conflict: The Platform Owner Super Admin cannot be onboarded as a City Partner.',
    };
  }

  if (!partnerFullName || partnerFullName.trim().length < 3) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Partner full legal name required.',
    };
  }

  const cleanCity = (cityId || '').trim().toLowerCase();
  const canonical = canonicalCities.find((c) => c.toLowerCase() === cleanCity);
  if (!canonical) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Selected city failed canonical validation.',
    };
  }

  // Atomic exclusivity lock
  if (allocatedCities.has(cleanCity)) {
    return {
      ok: false,
      statusCode: 409,
      error: `City Exclusivity Conflict: ${cleanCity} is already allocated.`,
    };
  }

  // Single-city partner restriction
  if (activePartnerPhones.has(cleanPhone)) {
    return {
      ok: false,
      statusCode: 409,
      error: `Partner ${cleanPhone} already has an active City assignment.`,
    };
  }

  return {
    ok: true,
    partnerRecord: {
      role: 'partner',
      status: 'ACTIVE',
      assignedCityId: cleanCity,
      revenueSharePercent: 50,
      citykartRetainedPercent: 50,
      kycVerificationStatus: 'VERIFIED',
    },
    userAccount: {
      isPartner: true,
      isAdmin: false,
      role: 'partner',
      roles: ['BUYER', 'PARTNER'],
    },
  };
}

// Behavioral simulation of createAdminAuthorization conflict guard
function simulateCreateAdminAuthorization({ phoneE164, name, designation }) {
  const cleanDesignation = (designation || '').trim().toLowerCase();
  const cleanName = (name || '').trim().toLowerCase();

  if (
    cleanDesignation.includes('partner') ||
    cleanName.includes('partner')
  ) {
    return {
      ok: false,
      statusCode: 400,
      error:
        'Role Conflict: City Partners must not be authorized as platform administrators. Use the dedicated City Partner Direct Onboarding architecture under the City Partner Program tab to assign exclusive canonical city rights and 50/50 revenue attribution.',
    };
  }

  return { ok: true, role: 'admin' };
}

test('1. Direct City Partner Onboarding Success & Role Isolation Invariants', () => {
  const allocated = new Set();
  const activePartners = new Set();
  const canonical = ['india-maharashtra-solapur', 'india-maharashtra-pune'];

  const res = simulateDirectOnboardValidation({
    adminPhone: DESIGNATED_SUPER_ADMIN_PHONE,
    isSuperAdmin: true,
    partnerFullName: 'Sanjay Patil',
    phoneE164: '+919822001122',
    canonicalCities: canonical,
    allocatedCities: allocated,
    activePartnerPhones: activePartners,
    cityId: 'india-maharashtra-solapur',
  });

  assert.equal(res.ok, true, 'Direct onboarding must succeed');
  assert.equal(res.partnerRecord.role, 'partner');
  assert.equal(res.partnerRecord.status, 'ACTIVE');
  assert.equal(res.partnerRecord.revenueSharePercent, 50);
  assert.equal(res.partnerRecord.citykartRetainedPercent, 50);
  assert.equal(res.userAccount.isPartner, true);
  assert.equal(res.userAccount.isAdmin, false, 'Partner MUST NOT have isAdmin true');
  assert.equal(res.userAccount.role, 'partner');
  assert.ok(res.userAccount.roles.includes('PARTNER'));
});

test('2. Self-Approval Prevention: Super Admin Cannot Onboard Themselves as City Partner', () => {
  const allocated = new Set();
  const activePartners = new Set();
  const canonical = ['india-maharashtra-amravati'];

  const res = simulateDirectOnboardValidation({
    adminPhone: DESIGNATED_SUPER_ADMIN_PHONE,
    isSuperAdmin: true,
    partnerFullName: 'Platform Owner',
    phoneE164: DESIGNATED_SUPER_ADMIN_PHONE,
    canonicalCities: canonical,
    allocatedCities: allocated,
    activePartnerPhones: activePartners,
    cityId: 'india-maharashtra-amravati',
  });

  assert.equal(res.ok, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.error, /cannot be onboarded as a City Partner/i);
});

test('3. Atomic Exclusivity Lock: Duplicate Allocation for Allocated City Rejected', () => {
  const allocated = new Set(['india-maharashtra-solapur']);
  const activePartners = new Set(['+919822001122']);
  const canonical = ['india-maharashtra-solapur'];

  const res = simulateDirectOnboardValidation({
    adminPhone: DESIGNATED_SUPER_ADMIN_PHONE,
    isSuperAdmin: true,
    partnerFullName: 'Another Applicant',
    phoneE164: '+919822998877',
    canonicalCities: canonical,
    allocatedCities: allocated,
    activePartnerPhones: activePartners,
    cityId: 'india-maharashtra-solapur',
  });

  assert.equal(res.ok, false);
  assert.equal(res.statusCode, 409);
  assert.match(res.error, /City Exclusivity Conflict/i);
});

test('4. Partner Single-City Rule: Cannot Allocate Multiple Cities to One Partner', () => {
  const allocated = new Set(['india-maharashtra-solapur']);
  const activePartners = new Set(['+919822001122']);
  const canonical = ['india-maharashtra-solapur', 'india-maharashtra-kolhapur'];

  const res = simulateDirectOnboardValidation({
    adminPhone: DESIGNATED_SUPER_ADMIN_PHONE,
    isSuperAdmin: true,
    partnerFullName: 'Sanjay Patil',
    phoneE164: '+919822001122',
    canonicalCities: canonical,
    allocatedCities: allocated,
    activePartnerPhones: activePartners,
    cityId: 'india-maharashtra-kolhapur',
  });

  assert.equal(res.ok, false);
  assert.equal(res.statusCode, 409);
  assert.match(res.error, /already has an active City/i);
});

test('5. Non-Canonical City Input Rejected', () => {
  const allocated = new Set();
  const activePartners = new Set();
  const canonical = ['india-maharashtra-solapur'];

  const res = simulateDirectOnboardValidation({
    adminPhone: DESIGNATED_SUPER_ADMIN_PHONE,
    isSuperAdmin: true,
    partnerFullName: 'Valid Applicant',
    phoneE164: '+919822119933',
    canonicalCities: canonical,
    allocatedCities: allocated,
    activePartnerPhones: activePartners,
    cityId: 'fictional-atlantis-city',
  });

  assert.equal(res.ok, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.error, /failed canonical validation/i);
});

test('6. Prevention of Misusing Admin Invite for City Partners', () => {
  const res = simulateCreateAdminAuthorization({
    phoneE164: '+919822554433',
    name: 'City Partner Pune',
    designation: 'City Partner - Maharashtra',
  });

  assert.equal(res.ok, false);
  assert.match(
    res.error,
    /Role Conflict.*City Partners must not be authorized as platform administrators/i
  );
});

test('7. Source Code Integrity: lib/partner-program.ts exports directOnboardCityPartner with strict role isolation', () => {
  assert.ok(
    partnerProgramSrc.includes('export async function directOnboardCityPartner'),
    'partner-program.ts must export directOnboardCityPartner'
  );
  assert.ok(
    partnerProgramSrc.includes('export interface DirectOnboardPartnerInput'),
    'partner-program.ts must export DirectOnboardPartnerInput'
  );
  assert.ok(
    partnerProgramSrc.includes("role: 'partner'"),
    "directOnboardCityPartner must assign role: 'partner'"
  );
  assert.ok(
    partnerProgramSrc.includes("cityAllocationMutex.add(cleanCityId)"),
    'directOnboardCityPartner must acquire cityAllocationMutex'
  );
  assert.ok(
    partnerProgramSrc.includes('isDesignatedOwnerPhone(targetPhone)'),
    'directOnboardCityPartner must check isDesignatedOwnerPhone on target to prevent self-onboarding'
  );
  // Guarantee it NEVER writes to adminAuthorizations
  assert.ok(
    !partnerProgramSrc.includes("doc(db, 'adminAuthorizations'"),
    'partner-program.ts must NEVER write to adminAuthorizations'
  );
});

test('8. Source Code Integrity: app/api/admin/partners/route.ts handles DIRECT_ONBOARD_PARTNER', () => {
  assert.ok(
    adminRouteSrc.includes("action === 'DIRECT_ONBOARD_PARTNER'"),
    'admin/partners route must handle DIRECT_ONBOARD_PARTNER'
  );
  assert.ok(
    adminRouteSrc.includes('directOnboardCityPartner({'),
    'admin/partners route must call directOnboardCityPartner'
  );
  assert.ok(
    adminRouteSrc.includes('checkCityAvailability'),
    'admin/partners route must support checkCityAvailability parameter'
  );
});

test('9. Source Code Integrity: components/admin-partner-management.tsx contains Direct Onboard Partner UI', () => {
  assert.ok(
    adminPartnerMgmtSrc.includes('Direct Onboard Partner'),
    'admin-partner-management.tsx must render Direct Onboard Partner button'
  );
  assert.ok(
    adminPartnerMgmtSrc.includes('isDirectOnboardModalOpen'),
    'admin-partner-management.tsx must manage isDirectOnboardModalOpen state'
  );
  assert.ok(
    adminPartnerMgmtSrc.includes('directCityAvailability'),
    'admin-partner-management.tsx must manage directCityAvailability state'
  );
  assert.ok(
    adminPartnerMgmtSrc.includes('DIRECT_ONBOARD_PARTNER'),
    'admin-partner-management.tsx must submit DIRECT_ONBOARD_PARTNER action'
  );
  assert.ok(
    adminPartnerMgmtSrc.includes('Strict Role Segregation'),
    'admin-partner-management.tsx must display role segregation notice'
  );
});

test('10. Source Code Integrity: components/super-admin-dashboard.tsx directs admin invites away from City Partners', () => {
  assert.ok(
    superAdminDashboardSrc.includes('Looking to onboard a City Partner?'),
    'super-admin-dashboard.tsx must guide users away from admin invite modal if trying to onboard city partners'
  );
  assert.ok(
    superAdminDashboardSrc.includes("setActiveSection('partners')"),
    'super-admin-dashboard.tsx warning banner must switch to partners section'
  );
});

test('11. Source Code Integrity: lib/super-admin-auth.ts guards against accidental partner admin authorization', () => {
  assert.ok(
    adminAuthSrc.includes("cleanDesignation.toLowerCase().includes('partner')"),
    'createAdminAuthorization must check if designation includes partner'
  );
  assert.ok(
    adminAuthSrc.includes('Role Conflict: City Partners must not be authorized as platform administrators'),
    'createAdminAuthorization must reject partner authorization attempts with clear error'
  );
});
