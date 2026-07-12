import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, getStripeWebhookSecret, getAppBaseUrl } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { syncSubscriptionToBusiness } from '@/lib/billing';
import { sendTrialEndingEmail, sendPaymentFailedEmail } from '@/lib/email';

// Stripe SDK signature verification needs the Node runtime + the RAW request body.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const billingUrl = () => `${getAppBaseUrl()}/business/dashboard`;

export async function POST(req: NextRequest) {
  // 1) Read the raw body (must NOT be JSON-parsed first) and verify the signature.
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (err: any) {
    // Never trust an unverified payload.
    console.error('[webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // 2) Idempotency: if we've already processed this event id, ack and stop.
  const already = await prisma.processedStripeEvent.findUnique({ where: { id: event.id } });
  if (already) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // 3) Handle the event. If anything throws we return 500 (below) WITHOUT recording
  //    the event, so Stripe retries. Handlers write derived state idempotently.
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === 'subscription' && s.subscription) {
          const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription.id;
          const sub = await getStripe().subscriptions.retrieve(subId);
          await syncSubscriptionToBusiness(sub);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Source of truth for status: sync Stripe's view onto the business.
        await syncSubscriptionToBusiness(event.data.object as Stripe.Subscription);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Reminder only — do NOT change status.
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const business = await prisma.business.findUnique({
          where: { stripeCustomerId: customerId },
          include: { user: { select: { email: true, name: true } } },
        });
        if (business) {
          await sendTrialEndingEmail({
            email: business.user.email,
            name: business.user.name || 'Business Owner',
            businessName: business.businessName,
            actionUrl: billingUrl(),
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          }).catch((e) => console.error('[webhook] trial-ending email failed:', e));
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const business = await prisma.business.findUnique({
            where: { stripeCustomerId: customerId },
            include: { user: { select: { email: true, name: true } } },
          });
          if (business) {
            // Mark past_due (a subsequent subscription.updated will confirm/refine this)
            await prisma.business.update({
              where: { id: business.id },
              data: { subscriptionStatus: 'past_due' },
            });
            await sendPaymentFailedEmail({
              email: business.user.email,
              name: business.user.name || 'Business Owner',
              businessName: business.businessName,
              actionUrl: billingUrl(),
            }).catch((e) => console.error('[webhook] payment-failed email failed:', e));
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Trial ended without a card, or dunning exhausted, or explicit cancel.
        // syncSubscriptionToBusiness maps this to `canceled` or `suspended_billing`;
        // access is revoked by the gating layer that reads subscriptionStatus.
        await syncSubscriptionToBusiness(event.data.object as Stripe.Subscription);
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying them.
        break;
    }
  } catch (err) {
    console.error(`[webhook] Error handling ${event.type} (${event.id}):`, err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  // 4) Record success LAST, so a mid-handler failure is retried rather than skipped.
  try {
    await prisma.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err: any) {
    // A concurrent duplicate delivery may have recorded it first — that's fine.
    if (err?.code !== 'P2002') console.error('[webhook] Failed to record event id:', err);
  }

  return NextResponse.json({ received: true });
}
