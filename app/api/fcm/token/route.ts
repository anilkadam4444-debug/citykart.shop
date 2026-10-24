import { NextRequest, NextResponse } from 'next/server';
import { registerFcmToken, removeInvalidFcmToken } from '@/lib/fcm-registry';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const action = String(body.action || 'REGISTER');

    if (!token) {
      return NextResponse.json({ error: 'FCM token is required.' }, { status: 400 });
    }

    if (action === 'UNREGISTER') {
      await removeInvalidFcmToken(token);
      return NextResponse.json({ ok: true, message: 'FCM token unregistered.' });
    }

    const record = await registerFcmToken({
      token,
      uid: body.uid ? String(body.uid) : undefined,
      sellerId: body.sellerId ? String(body.sellerId) : undefined,
      buyerPhone: body.buyerPhone ? String(body.buyerPhone) : undefined,
      role: body.role || 'BUYER',
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      ok: true,
      message: 'FCM token registered successfully for push notifications.',
      record,
    });
  } catch (error) {
    console.error('[FCM Token API Error]:', error);
    return NextResponse.json({ error: 'Failed to process FCM token registration.' }, { status: 500 });
  }
}
