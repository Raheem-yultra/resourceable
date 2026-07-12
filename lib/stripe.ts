import Stripe from 'stripe';

/**
 * Fail loudly: throw the moment a required billing env var is needed but missing.
 * Serverless has no long-running "startup", so first use is effectively startup —
 * a misconfigured deploy surfaces a clear error instead of silently misbehaving.
 * We intentionally DON'T throw at module load so `next build` (which imports this
 * without runtime env) still succeeds.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[billing] Missing required environment variable ${name}. ` +
        `Stripe billing cannot operate without it — set it in .env.local (local) and in Vercel (deployed).`
    );
  }
  return value;
}

let _stripe: Stripe | null = null;

/** Lazily-constructed Stripe client. Throws if STRIPE_SECRET_KEY is unset. */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
      appInfo: { name: 'ResourceAble' },
    });
  }
  return _stripe;
}

/** The single flat monthly Price ID. Throws if unset. */
export const getStripePriceId = (): string => requiredEnv('STRIPE_PRICE_ID');

/** Webhook signing secret used to verify inbound events. Throws if unset. */
export const getStripeWebhookSecret = (): string => requiredEnv('STRIPE_WEBHOOK_SECRET');

/** Base URL for Checkout / Customer Portal redirects. Reuses the existing app URL env. */
export const getAppBaseUrl = (): string => process.env.NEXTAUTH_URL || 'http://localhost:3000';
