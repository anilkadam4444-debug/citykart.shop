import { NextRequest, NextResponse } from 'next/server';
import { getSellerPlatformFees } from '@/lib/fees';
import {
  verifyAdminRequest,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get('sellerId')?.trim();

    if (!sellerId) {
      return NextResponse.json(
        { ok: false, error: 'Seller ID is required' },
        { status: 400 }
      );
    }

    const [caller, adminCheck] = await Promise.all([
      verifyAuthenticatedCaller(req),
      verifyAdminRequest(req),
    ]);

    if (
      caller.authenticated &&
      caller.sellerId &&
      caller.sellerId !== sellerId &&
      !adminCheck.authorized
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Forbidden: You can only view platform fee ledger records for your own seller account.',
        },
        { status: 403 }
      );
    }

    const fees = await getSellerPlatformFees(sellerId);

    return NextResponse.json({ ok: true, fees });
  } catch (error) {
    console.error('Error fetching platform fees:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch platform fees' },
      { status: 500 }
    );
  }
}
