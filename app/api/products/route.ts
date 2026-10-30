import { NextRequest, NextResponse } from 'next/server';
import { Product } from '@/lib/catalog-data';
import {
  deleteServerProduct,
  getAllServerProducts,
  serverProductsRegistry,
  upsertServerProduct,
} from '@/lib/stores-registry';
import { notifyLowStockInventoryAlert } from '@/lib/notification-events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = (searchParams.get('storeId') || '').trim();
  const sellerId = (searchParams.get('sellerId') || '').trim();

  let products = getAllServerProducts();
  if (storeId) {
    products = products.filter((p) => p.storeId === storeId);
  }
  if (sellerId) {
    products = products.filter((p) => p.sellerId === sellerId);
  }

  return NextResponse.json({
    ok: true,
    products,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product = body?.product as Product | undefined;

    if (!product || !product.id || !product.name || !product.storeId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Valid product object with id, name, and storeId is required.',
        },
        { status: 400 }
      );
    }

    const saved = await upsertServerProduct(product);
    globalThis.__discoveryCatalogCache = undefined;

    if (typeof saved.stock === 'number' && saved.stock <= 5) {
      await notifyLowStockInventoryAlert({
        product: saved,
        storeId: saved.storeId,
        sellerId: saved.sellerId,
      });
    }

    return NextResponse.json({
      ok: true,
      product: saved,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to save product.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const product = body?.product as Partial<Product> & { id?: string } | undefined;

    if (!product || !product.id) {
      return NextResponse.json(
        { ok: false, error: 'Product id is required.' },
        { status: 400 }
      );
    }

    const existing = serverProductsRegistry.get(product.id);
    if (!existing && (!product.name || !product.storeId)) {
      return NextResponse.json(
        { ok: false, error: 'Product not found in server registry.' },
        { status: 404 }
      );
    }

    const merged = {
      ...(existing || {}),
      ...product,
    } as Product;

    const saved = await upsertServerProduct(merged);
    globalThis.__discoveryCatalogCache = undefined;

    if (typeof saved.stock === 'number' && saved.stock <= 5) {
      await notifyLowStockInventoryAlert({
        product: saved,
        storeId: saved.storeId,
        sellerId: saved.sellerId,
      });
    }

    return NextResponse.json({
      ok: true,
      product: saved,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to update product.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = (searchParams.get('productId') || '').trim();
    if (!productId) {
      return NextResponse.json(
        { ok: false, error: 'productId query parameter is required.' },
        { status: 400 }
      );
    }

    await deleteServerProduct(productId);
    globalThis.__discoveryCatalogCache = undefined;

    return NextResponse.json({
      ok: true,
      productId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to delete product.',
      },
      { status: 500 }
    );
  }
}
