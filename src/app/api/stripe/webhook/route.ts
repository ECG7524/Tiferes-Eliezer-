import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '@/db';
import { payments, pledges } from '@/db/schema';
import { getStripe, isStripeEnabled } from '@/lib/stripe';
import { recalcPledge } from '@/lib/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe tells us a payment settled. This is the only place a card gift is
 * written to the ledger — the browser's redirect back is just a courtesy page
 * and is never trusted as proof of payment.
 */
export async function POST(req: Request) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 501 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not set' }, { status: 500 });
  }

  const signature = (await headers()).get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid signature';
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== 'paid') break;
        await recordCheckout(session);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (!intent) break;
        const rows = await db.select().from(payments).where(eq(payments.stripePaymentIntent, intent)).limit(1);
        if (rows[0]) {
          await db.update(payments).set({ status: 'refunded' }).where(eq(payments.id, rows[0].id));
          if (rows[0].pledgeId) await recalcPledge(rows[0].pledgeId);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Returning 500 makes Stripe retry, which is what we want for a transient
    // database problem — the event is not lost.
    console.error('[stripe webhook]', event.type, err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function recordCheckout(session: Stripe.Checkout.Session) {
  // Stripe can deliver the same event more than once; one gift, one row.
  const existing = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.stripeSessionId, session.id), eq(payments.status, 'succeeded')))
    .limit(1);
  if (existing[0]) return;

  const pledgeId = Number(session.metadata?.pledgeId) || null;
  const categoryId = Number(session.metadata?.categoryId) || null;
  const userId = Number(session.metadata?.userId) || null;

  let donorName = session.customer_details?.name ?? '';
  let donorEmail = session.customer_details?.email ?? session.customer_email ?? '';

  if (pledgeId) {
    const [p] = await db.select().from(pledges).where(eq(pledges.id, pledgeId)).limit(1);
    if (p) {
      donorName ||= p.donorName;
      donorEmail ||= p.donorEmail ?? '';
    }
  }

  const intent =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? '';

  await db.insert(payments).values({
    pledgeId,
    userId,
    donorName: donorName || 'Anonymous',
    donorEmail,
    categoryId,
    amountCents: session.amount_total ?? 0,
    method: 'card',
    stripeSessionId: session.id,
    stripePaymentIntent: intent,
    status: 'succeeded',
    paidAt: Math.floor(Date.now() / 1000),
  });

  if (pledgeId) await recalcPledge(pledgeId);
}
