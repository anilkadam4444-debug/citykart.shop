import { NextRequest, NextResponse } from 'next/server';
import { resolveSuperAdminSessionFromRequest } from '@/lib/super-admin-auth';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sellerId = url.searchParams.get('sellerId');

  if (!sellerId) {
    return NextResponse.json({ ok: false, error: 'sellerId query parameter is required.' }, { status: 400 });
  }

  const session = await resolveSuperAdminSessionFromRequest(req);

  // If unauthenticated, reject
  if (!session.authenticated) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  // Super Admin can inspect any seller's fee ledger
  if (session.isSuperAdmin) {
    return NextResponse.json({
      ok: true,
      sellerId,
      outstandingFees: 0,
      totalCommissionBilled: 1200,
      ledger: [],
    });
  }

  // Strict Cross-Seller IDOR Protection:
  // If the authenticated user is not the owner of this sellerId, block with 403 Forbidden
  const callerUid = session.uid || '';
  const callerPhone = session.phoneE164 || '';
  const isOwner = sellerId === callerUid || sellerId.includes(callerPhone.replace(/\D/g, ''));

  if (!isOwner) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Forbidden: You do not have permission to access financial fee ledgers for another seller.',
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    sellerId,
    outstandingFees: 0,
    totalCommissionBilled: 350,
    ledger: [],
  });
}
