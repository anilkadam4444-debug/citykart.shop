import { NextRequest, NextResponse } from 'next/server';
import {
  normalizePhoneE164,
  resolveSuperAdminSessionFromRequest,
} from '@/lib/super-admin-auth';
import { partnerApplications } from '@/lib/partner-applications-registry';

export async function verifyPartnerCityAccess(req: NextRequest) {
  return resolveSuperAdminSessionFromRequest(req);
}

export async function GET(req: NextRequest) {
  const session = await verifyPartnerCityAccess(req);
  if (!session.authenticated || !session.phoneE164) {
    return NextResponse.json(
      { ok: false, error: 'Partner authentication required.' },
      { status: 401 }
    );
  }

  const callerPhone = normalizePhoneE164(session.phoneE164);
  const matchingApps = Array.from(partnerApplications.values()).filter(
    (a) => normalizePhoneE164(a.phoneE164) === callerPhone
  );

  const approvedApp = matchingApps.find((a) => a.status === 'APPROVED');
  const latestApp = approvedApp || matchingApps[matchingApps.length - 1] || null;

  if (!approvedApp && !session.isSuperAdmin) {
    return NextResponse.json(
      {
        ok: false,
        approved: false,
        applicationStatus: latestApp?.status || 'NONE',
        application: latestApp,
        error: latestApp
          ? `Your City Partner application for ${latestApp.cityName} is currently ${latestApp.status}. Full partner dashboard access unlocks upon approval.`
          : 'No approved City Partner allocation found for this phone number.',
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    approved: true,
    applicationStatus: approvedApp?.status || 'APPROVED',
    partner: {
      phoneE164: callerPhone,
      fullName: approvedApp?.fullName || session.fullName || 'City Partner',
      role: 'partner',
      cityId: approvedApp?.cityId || 'india-maharashtra-nanded',
      cityName: approvedApp?.cityName || 'Nanded',
      revenueSharePct: approvedApp?.commissionPct || 50,
      totalEarned: 12500,
      activeMerchants: 8,
      ordersThisMonth: 142,
    },
  });
}
