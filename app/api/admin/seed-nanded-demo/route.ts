import {NextRequest, NextResponse} from 'next/server';
import {
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  fetchStoresAndProductsFromFirestore,
} from '@/lib/firebase';
import {
  removeNandedDemoCatalogFromFirestore,
  seedNandedDemoCatalogToFirestore,
} from '@/lib/seeders';
import {getNandedDemoDatasetSummary} from '@/lib/nanded-demo-data';
import {recordAdminAuditLog, verifySuperAdminRequest} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json(
      {ok: false, error: authCheck.reason},
      {status: authCheck.status}
    );
  }

  try {
    const summary = getNandedDemoDatasetSummary();
    const liveData = await fetchStoresAndProductsFromFirestore();
    const demoStoresInFirestore = liveData.stores.filter(
      (s) => s.isDemo && s.demoBatchId === summary.batchId
    ).length;
    const demoProductsInFirestore = liveData.products.filter(
      (p) => p.isDemo && p.demoBatchId === summary.batchId
    ).length;

    return NextResponse.json({
      ok: true,
      projectId: FIREBASE_PROJECT_ID,
      firestoreDatabaseId: FIRESTORE_DATABASE_ID,
      summary,
      firestoreCounts: {
        totalStoresInFirestore: liveData.stores.length,
        totalProductsInFirestore: liveData.products.length,
        demoStoresInFirestore,
        demoProductsInFirestore,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to query Firestore demo status.',
      },
      {status: 500}
    );
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await verifySuperAdminRequest(req);
  if (!authCheck.authorized || !authCheck.firebaseUid) {
    return NextResponse.json(
      {ok: false, error: authCheck.reason},
      {status: authCheck.status}
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'SEED').toUpperCase();

    if (action === 'REMOVE_DEMO' || action === 'REMOVE') {
      const removed = await removeNandedDemoCatalogFromFirestore();
      await recordAdminAuditLog({
        adminUid: authCheck.firebaseUid,
        actionType: 'REMOVE_DEMO_DATA',
        targetEntityType: 'SYSTEM',
        targetEntityId: 'nanded-25-cat-demo-v1',
        status: 'SUCCESS',
        reason: 'Removed Nanded demo dataset via admin endpoint.',
        metadata: removed,
      });
      return NextResponse.json({
        ok: true,
        status: 'DEMO_DATA_REMOVED',
        projectId: FIREBASE_PROJECT_ID,
        ...removed,
      });
    }

    const result = await seedNandedDemoCatalogToFirestore();
    const summary = getNandedDemoDatasetSummary();
    await recordAdminAuditLog({
      adminUid: authCheck.firebaseUid,
      actionType: 'SEED_DEMO_DATA',
      targetEntityType: 'SYSTEM',
      targetEntityId: result.batchId,
      status: 'SUCCESS',
      reason: 'Seeded Nanded demo dataset via admin endpoint.',
      metadata: {
        storesWritten: result.storesWritten,
        productsWritten: result.productsWritten,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'DEMO_DATA_SEEDED',
      projectId: FIREBASE_PROJECT_ID,
      firestoreDatabaseId: FIRESTORE_DATABASE_ID,
      ...result,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to seed Nanded demo data into Firestore.',
      },
      {status: 500}
    );
  }
}
