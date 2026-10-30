import { NextRequest, NextResponse } from 'next/server';
import {
  getUserNotificationPreferences,
  NotificationCategory,
  updateUserNotificationPreferences,
} from '@/lib/notifications-service';
import {
  normalizePhoneE164,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const caller = await verifyAuthenticatedCaller(req);
    const rawPhone =
      searchParams.get('phoneE164') ||
      searchParams.get('phone') ||
      caller.phoneE164 ||
      undefined;
    const phoneE164 = rawPhone ? normalizePhoneE164(rawPhone) : undefined;
    const uid = searchParams.get('uid') || caller.uid || undefined;
    const sellerId =
      searchParams.get('sellerId') || caller.sellerId || undefined;
    const partnerId = searchParams.get('partnerId') || undefined;

    const preferences = getUserNotificationPreferences({
      uid,
      phoneE164,
      sellerId,
      partnerId,
    });

    return NextResponse.json({
      ok: true,
      preferences,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load notification preferences.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const caller = await verifyAuthenticatedCaller(req);
    const rawPhone =
      body.phoneE164 || body.phone || caller.phoneE164 || undefined;
    const phoneE164 = rawPhone ? normalizePhoneE164(rawPhone) : undefined;
    const uid = body.uid || caller.uid || undefined;
    const sellerId = body.sellerId || caller.sellerId || undefined;
    const partnerId = body.partnerId || undefined;

    const preferences = await updateUserNotificationPreferences({
      uid,
      phoneE164,
      sellerId,
      partnerId,
      inAppEnabled: body.inAppEnabled,
      browserPushEnabled: body.browserPushEnabled,
      marketingEnabled: body.marketingEnabled,
      categories: body.categories as
        | Partial<Record<NotificationCategory, boolean>>
        | undefined,
    });

    return NextResponse.json({
      ok: true,
      preferences,
      message: 'Notification preferences saved.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update notification preferences.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return POST(req);
}

export async function PUT(req: NextRequest) {
  return POST(req);
}

