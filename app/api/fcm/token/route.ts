import { NextRequest, NextResponse } from 'next/server';
import {
  FcmRecipientRole,
  getAllRegisteredFcmTokensSummary,
  getFcmTokensForRecipient,
  registerFcmToken,
  removeInvalidFcmToken,
} from '@/lib/fcm-registry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get('sellerId') || undefined;
    const partnerId = searchParams.get('partnerId') || undefined;
    const uid = searchParams.get('uid') || undefined;
    const buyerPhone =
      searchParams.get('phoneE164') ||
      searchParams.get('buyerPhone') ||
      undefined;
    const role = (searchParams.get('role') || undefined) as
      | FcmRecipientRole
      | undefined;
    const summaryOnly = searchParams.get('summary') === 'true';

    if (summaryOnly) {
      return NextResponse.json({
        ok: true,
        ...getAllRegisteredFcmTokensSummary(),
      });
    }

    if (!sellerId && !partnerId && !uid && !buyerPhone && !role) {
      return NextResponse.json(
        {
          error:
            'Provide sellerId, partnerId, uid, phoneE164/buyerPhone, or role to check registered device count.',
        },
        { status: 400 }
      );
    }

    const tokens = await getFcmTokensForRecipient({
      sellerId,
      partnerId,
      sellerUid: uid,
      buyerUid: uid,
      uid,
      buyerPhone,
      phoneE164: buyerPhone,
      role,
    });

    return NextResponse.json({
      ok: true,
      registeredDeviceCount: tokens.length,
      maskedTokens: tokens.map((t) =>
        t.length > 12 ? `${t.slice(0, 6)}...${t.slice(-6)}` : 'registered-token'
      ),
    });
  } catch (error) {
    console.error('[FCM Token Lookup Error]:', error);
    return NextResponse.json(
      { error: 'Failed to inspect FCM token registration.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const action = String(body.action || 'REGISTER').toUpperCase();

    if (!token || token.length < 8) {
      return NextResponse.json(
        { error: 'A valid FCM registration token is required.' },
        { status: 400 }
      );
    }

    if (action === 'UNREGISTER') {
      await removeInvalidFcmToken(token);
      return NextResponse.json({
        ok: true,
        status: 'UNREGISTERED',
        message: 'FCM token unregistered and removed.',
      });
    }

    const phoneVal = body.phoneE164 || body.buyerPhone;

    const record = await registerFcmToken({
      token,
      uid: body.uid ? String(body.uid) : undefined,
      sellerId: body.sellerId ? String(body.sellerId) : undefined,
      partnerId: body.partnerId ? String(body.partnerId) : undefined,
      buyerPhone: phoneVal ? String(phoneVal) : undefined,
      phoneE164: phoneVal ? String(phoneVal) : undefined,
      role: (body.role as FcmRecipientRole) || 'BUYER',
      roles: Array.isArray(body.roles) ? body.roles.map(String) : undefined,
      deviceId: body.deviceId ? String(body.deviceId) : undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      ok: true,
      status: 'REGISTERED',
      message: 'FCM token registered successfully for push notifications.',
      record: {
        ...record,
        token:
          record.token.length > 12
            ? `${record.token.slice(0, 6)}...${record.token.slice(-6)}`
            : record.token,
      },
    });
  } catch (error) {
    console.error('[FCM Token API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to process FCM token registration.' },
      { status: 500 }
    );
  }
}
