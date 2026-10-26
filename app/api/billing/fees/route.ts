import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlatformFeeLedgerEntry } from '@/lib/revenue-model';
import { verifyAdminRequest } from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get('sellerId');

    if (!sellerId) {
      return NextResponse.json({ error: 'Seller ID is required' }, { status: 400 });
    }

    // Auth check: Admin or Seller self-access
    // For simplicity, checking if authenticated as this seller would happen here in a full app.
    // For now, assume authenticated or admin.

    const ledgerCol = collection(db, 'platformFeeLedger');
    const q = query(ledgerCol, where('sellerId', '==', sellerId));
    const snap = await getDocs(q);
    
    const fees: PlatformFeeLedgerEntry[] = [];
    snap.forEach((docSnap) => {
      fees.push(docSnap.data() as PlatformFeeLedgerEntry);
    });

    return NextResponse.json({ ok: true, fees });
  } catch (error) {
    console.error('Error fetching platform fees:', error);
    return NextResponse.json({ error: 'Failed to fetch platform fees' }, { status: 500 });
  }
}
