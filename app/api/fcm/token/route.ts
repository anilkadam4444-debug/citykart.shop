import {NextRequest, NextResponse} from 'next/server';
import {
  getFcmTokensForRecipient,
  registerFcmToken,
  removeInvalidFcmToken,
} from '@/lib/fcm-registry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const {searchParams} = new URL(req.url);
    const sellerId = searchParams.get('sellerId') || undefined;
    const uid = searchParams.get('uid') || undefined;
    const buyerPhone = searchParams.get('buyerPhone') || undefined;

    if (!sellerId && !uid && !buyerPhone) {
      return NextResponse.json(
        {error: 'Provide sellerId, uid, or buyerPhone to check registered device count.'},
        {status: 400}
      );
    }

    const tokens = await getFcmTokensForRecipient({
      sellerId,
      sellerUid: uid,
      buyerUid: uid,
      buyerPhone,
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
      {error: 'Failed to inspect FCM token registration.'},
      {status: 500}
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const action = String(body.action || 'REGISTER').toUpperCase();

    if (!token || token.length < 10) {
      return NextResponse.json(
        {error: 'A valid FCM registration token is required.'},
        {status: 400}
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

    const record = await registerFcmToken({
      token,
      uid: body.uid ? String(body.uid) : undefined,
      sellerId: body.sellerId ? String(body.sellerId) : undefined,
      buyerPhone: body.buyerPhone ? String(body.buyerPhone) : undefined,
      role: body.role || 'BUYER',
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
      {error: 'Failed to process FCM token registration.'},
      {status: 500}
    );
  }
}
