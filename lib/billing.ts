import type Stripe from 'stripe';
import { getStripe, getStripePriceId, getAppBaseUrl } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { SubscriptionStatus } from '@prisma/client';
import { sendProviderApprovedBillingEmail } from '@/lib/email';

const TRIAL_DAYS = 30;

/**
 * Terminal billing states that revoke a provider's access: hidden from public
 * search/listings and blocked from provider actions. `past_due` is intentionally
 * NOT here — those providers stay live (with a dashboard warning) so they can fix
 * their card before losing access. `null` (approved pre-billing / not yet
 * subscribed) is also not blocked, to preserve backward compatibility.
 */
export const BILLING_BLOCKED_STATUSES: SubscriptionStatus[] = ['suspended_billing', 'canceled'];

/** True when a provider's billing status revokes access (suspended/canceled). */
export function isBillingBlocked(status: SubscriptionStatus | null | undefined): boolean {
  return !!status && BILLING_BLOCKED_STATUSES.includes(status);
}

/**
 * Prisma relation-filter fragment for "billing does not hide this business."
 * Spread into a `business: { ... }` filter. Explicitly allows null so approved
 * providers who predate billing (or haven't subscribed yet) stay visible.
 */
export const billingVisibleFilter = {
  OR: [
    { subscriptionStatus: null },
    { subscriptionStatus: { notIn: BILLING_BLOCKED_STATUSES } },
  ],
} as const;

/**
 * For a BUSINESS user, returns whether their billing currently blocks provider
 * actions (creating listings, responding to inquiries). Fails safe: if the
 * business row can't be found we do NOT block (returns false).
 */
export async function isProviderActionBlocked(userId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { userId },
    select: { subscriptionStatus: true },
  });
  return isBillingBlocked(business?.subscriptionStatus);
}

/**
 * Side effects to run when a provider is approved: ensure a Stripe Customer exists
 * and email them to set up billing / start the trial. Fully self-contained and
 * error-swallowing — billing setup must never block or fail the approval itself.
 * No-op onboarding email if they already have a live subscription (re-approval).
 */
export async function onBusinessApproved(businessId: string): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!business) return;

    // Already onboarded + live? Don't re-send the onboarding email.
    if (
      business.stripeCustomerId &&
      (business.subscriptionStatus === 'trialing' || business.subscriptionStatus === 'active')
    ) {
      return;
    }

    await ensureStripeCustomer(businessId).catch((e) =>
      console.error('[billing] ensureStripeCustomer on approval failed:', e)
    );

    await sendProviderApprovedBillingEmail({
      email: business.user.email,
      name: business.user.name || 'Business Owner',
      businessName: business.businessName,
      actionUrl: `${getAppBaseUrl()}/business/dashboard`,
    }).catch((e) => console.error('[billing] approval email failed:', e));
  } catch (e) {
    console.error('[billing] onBusinessApproved failed:', e);
  }
}

/**
 * Ensure the business has a Stripe Customer, creating + persisting one if needed.
 * Called at approval and (defensively) again at checkout, so it's idempotent.
 */
export async function ensureStripeCustomer(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!business) throw new Error('Business not found');
  if (business.stripeCustomerId) return business.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: business.email || business.user.email,
    name: business.businessName,
    metadata: { businessId: business.id, userId: business.userId },
  });

  await prisma.business.update({
    where: { id: businessId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/**
 * Create a Checkout Session (redirect flow) that collects a card and starts a
 * subscription with a 30-day trial. The subscription is created by Stripe when
 * the provider completes Checkout; status is then synced to the DB via webhooks.
 */
export async function createSubscriptionCheckout(businessId: string): Promise<string> {
  const customerId = await ensureStripeCustomer(businessId);
  const base = getAppBaseUrl();

  // One free trial per account: only grant the trial if this account has never
  // had one. Re-subscribing (e.g. after canceling) starts billing immediately.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { trialUsedAt: true },
  });
  const grantTrial = !business?.trialUsedAt;

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    // Card required upfront even though nothing is charged until the trial ends.
    payment_method_collection: 'always',
    subscription_data: {
      // Omit trial entirely on re-subscribe so returning accounts are billed now.
      ...(grantTrial ? { trial_period_days: TRIAL_DAYS } : {}),
      metadata: { businessId },
    },
    success_url: `${base}/business/dashboard?billing=success`,
    cancel_url: `${base}/business/dashboard?billing=cancelled`,
    metadata: { businessId },
  });

  if (!session.url) throw new Error('Stripe did not return a Checkout URL');
  return session.url;
}

/**
 * Open a Stripe Billing (Customer) Portal session so the provider can update
 * their card, view invoices, or cancel — without us building that UI.
 */
export async function createBillingPortalSession(businessId: string): Promise<string> {
  const customerId = await ensureStripeCustomer(businessId);
  const base = getAppBaseUrl();
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/business/dashboard`,
  });
  return session.url;
}

/**
 * Map Stripe's subscription.status onto our app enum. `suspended_billing` is the
 * terminal dunning state (Stripe reports `unpaid`, or `canceled` due to payment failure).
 */
export function mapStripeStatusToDb(sub: Stripe.Subscription): SubscriptionStatus {
  switch (sub.status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
    case 'paused':
      return 'suspended_billing';
    case 'incomplete':
    case 'incomplete_expired':
      return 'past_due';
    case 'canceled':
      return sub.cancellation_details?.reason === 'payment_failed' ? 'suspended_billing' : 'canceled';
    default:
      return 'canceled';
  }
}

/** In this API version the current period lives on the subscription item, not the sub. */
function periodEndFromSubscription(sub: Stripe.Subscription): Date | null {
  const end = sub.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

/**
 * Fetch the recurring monthly price (in the smallest currency unit) for MRR math.
 * Returns null on any failure so callers (e.g. admin metrics) can degrade gracefully
 * instead of failing the whole request when Stripe isn't configured.
 */
export async function getMonthlyPrice(): Promise<{ unitAmount: number; currency: string } | null> {
  try {
    const price = await getStripe().prices.retrieve(getStripePriceId());
    if (price.unit_amount == null) return null;
    return { unitAmount: price.unit_amount, currency: price.currency };
  } catch (e) {
    console.error('[billing] getMonthlyPrice failed:', e);
    return null;
  }
}

/**
 * Admin override: extend (or set) a subscription's trial end. Calls Stripe first
 * so it stays the source of truth, then re-syncs the DB immediately (the webhook
 * would eventually do this too — this just avoids the lag). `trialEnd` is a Date.
 */
export async function extendSubscriptionTrial(businessId: string, trialEnd: Date) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { stripeSubscriptionId: true },
  });
  if (!business?.stripeSubscriptionId) {
    throw new Error('This provider has no active subscription to adjust.');
  }

  const sub = await getStripe().subscriptions.update(business.stripeSubscriptionId, {
    trial_end: Math.floor(trialEnd.getTime() / 1000),
    proration_behavior: 'none',
  });

  // Reflect the change locally right away (idempotent with the eventual webhook).
  return syncSubscriptionToBusiness(sub);
}

/**
 * Sync a Stripe subscription's state onto the owning Business. Idempotent: writes
 * the same derived values regardless of how many times the event is delivered.
 * Returns the affected business (with owner) or null if no match.
 */
export async function syncSubscriptionToBusiness(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const business = await prisma.business.findUnique({
    where: { stripeCustomerId: customerId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!business) {
    console.warn(`[billing] No business found for Stripe customer ${customerId}`);
    return null;
  }

  const status = mapStripeStatusToDb(sub);
  const updated = await prisma.business.update({
    where: { id: business.id },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: status,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      currentPeriodEnd: periodEndFromSubscription(sub),
      // Stamp the first time a trial is ever granted to this account so future
      // re-subscribes skip it (one trial per account). Never cleared once set.
      ...(sub.trial_end && !business.trialUsedAt ? { trialUsedAt: new Date() } : {}),
    },
  });
  return { business: { ...updated, user: business.user }, status };
}
