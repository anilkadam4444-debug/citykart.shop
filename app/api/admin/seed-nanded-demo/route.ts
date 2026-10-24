import {NextRequest, NextResponse} from 'next/server';
import {
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  fetchStoresAndProductsFromFirestore,
  removeNandedDemoCatalogFromFirestore,
  seedNandedDemoCatalogToFirestore,
} from '@/lib/firebase';
import {getNandedDemoDatasetSummary} from '@/lib/nanded-demo-data';

export async function GET() {
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
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'SEED');

    if (action === 'REMOVE_DEMO') {
      const removed = await removeNandedDemoCatalogFromFirestore();
      return NextResponse.json({
        status: 'DEMO_DATA_REMOVED',
        projectId: FIREBASE_PROJECT_ID,
        ...removed,
      });
    }

    const result = await seedNandedDemoCatalogToFirestore();
    const summary = getNandedDemoDatasetSummary();

    return NextResponse.json({
      status: 'DEMO_DATA_SEEDED',
      projectId: FIREBASE_PROJECT_ID,
      firestoreDatabaseId: FIRESTORE_DATABASE_ID,
      ...result,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to seed Nanded demo data into Firestore.',
      },
      {status: 500}
    );
  }
}
