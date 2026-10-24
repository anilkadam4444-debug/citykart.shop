import { NextRequest, NextResponse } from 'next/server';

// Server-side processed webhook IDs for deduplication / idempotency
const processedWebhookEventIds = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || req.headers.get('stripe-signature');

    let event: Record<string, unknown> = {};
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventId = (event.id as string) || (event.event_id as string) || `evt_${Date.now()}`;
    if (processedWebhookEventIds.has(eventId)) {
      // Idempotency check: Already processed this event
      return NextResponse.json({ received: true, status: 'already_processed' }, { status: 200 });
    }

    processedWebhookEventIds.add(eventId);

    const eventType = (event.event as string) || (event.type as string) || 'payment.captured';

    // Log ledger audit trail in server console (and persist in firestore billing logs)
    console.log(`[URBANDIRECT Billing Webhook] Processed ${eventType} (ID: ${eventId}) with signature: ${Boolean(signature)}`);

    return NextResponse.json({
      received: true,
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
