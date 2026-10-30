import { NextRequest, NextResponse } from 'next/server';
import { LocalStore, SellerProfile, UserRole } from '@/lib/catalog-data';
import { serverUserAccounts } from '@/lib/initial-data';
import {
  getAllServerSellers,
  getAllServerStores,
  recordStoreDeletedServer,
  serverStoresRegistry,
  upsertServerStore,
} from '@/lib/stores-registry';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    stores: getAllServerStores(),
    sellers: getAllServerSellers(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = body?.store as LocalStore | undefined;
    const seller = body?.seller as SellerProfile | undefined;

    if (!store || !store.id || !store.name) {
      return NextResponse.json(
        { ok: false, error: 'Valid store object with id and name is required.' },
        { status: 400 }
      );
    }

    const token =
      req.headers.get('x-urbandirect-session') ||
      req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const sessionCheck = token ? await verifySessionToken(token) : null;
    const sessionUser = sessionCheck?.user;

    const enrichedStore: LocalStore = {
      ...store,
      ownerUid: store.ownerUid || sessionUser?.id || sessionUser?.uid,
      phone: store.phone || seller?.phoneE164 || sessionUser?.phoneE164,
      isActive: store.isActive !== false,
    };

    await upsertServerStore(enrichedStore, seller);

    // Also link the store & seller to the user account in serverUserAccounts if present
    const targetPhone =
      sessionUser?.phoneE164 || seller?.phoneE164 || enrichedStore.phone;
    if (targetPhone) {
      const existingAccount = serverUserAccounts.get(targetPhone);
      if (existingAccount) {
        const nextRoles: UserRole[] = Array.from(
          new Set([...(existingAccount.roles || ['BUYER']), 'SELLER'])
        ) as UserRole[];
        const nextStoreIds = Array.from(
          new Set([...(existingAccount.storeIds || []), enrichedStore.id])
        );
        serverUserAccounts.set(targetPhone, {
          ...existingAccount,
          role: 'seller',
          roles: nextRoles,
          sellerId: seller?.id || enrichedStore.sellerId || existingAccount.sellerId,
          storeIds: nextStoreIds,
        });
      }
    }

    // Invalidate discovery cache so new store is immediately visible
    globalThis.__discoveryCatalogCache = undefined;

    return NextResponse.json({
      ok: true,
      store: enrichedStore,
      seller,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to save store.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = body?.store as LocalStore | undefined;
    if (!store || !store.id) {
      return NextResponse.json(
        { ok: false, error: 'Store id is required.' },
        { status: 400 }
      );
    }

    const existing = serverStoresRegistry.get(store.id);
    const merged: LocalStore = {
      ...(existing || {}),
      ...store,
    };
    await upsertServerStore(merged);
    globalThis.__discoveryCatalogCache = undefined;

    return NextResponse.json({
      ok: true,
      store: merged,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to update store.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = (searchParams.get('storeId') || '').trim();
    if (!storeId) {
      return NextResponse.json(
        { ok: false, error: 'storeId query parameter is required.' },
        { status: 400 }
      );
    }
    const existing = serverStoresRegistry.get(storeId);
    await recordStoreDeletedServer(storeId, {
      storeName: existing?.name || 'Store',
      deletedAt: new Date().toISOString(),
    });
    globalThis.__discoveryCatalogCache = undefined;

    return NextResponse.json({
      ok: true,
      storeId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to delete store.',
      },
      { status: 500 }
    );
  }
}
