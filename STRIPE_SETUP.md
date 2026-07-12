# Stripe Billing Setup

ResourceAble bills **service providers** (the `Business` model / `BUSINESS` role) a single
flat monthly fee. Families/users are never charged. Billing begins with a **30-day free
trial that starts when a provider is approved** (not at signup), with a card required
upfront but not charged until the trial ends.

> Terminology: the product brief says "Provider"; in this codebase that is the **`Business`**
> model (`User.role === 'BUSINESS'`). They are the same thing.

## Data model

Subscription state lives on the `Business` model (not a separate `BillingAccount`) to match
the existing pattern of colocating lifecycle/status flags there and to keep access-gating
queries flat. Fields added:

| Field | Meaning |
|---|---|
| `stripeCustomerId` | Stripe Customer id (unique) |
| `stripeSubscriptionId` | Stripe Subscription id (unique) |
| `subscriptionStatus` | enum `trialing / active / past_due / canceled / suspended_billing` (null before billing starts) |
| `trialEndsAt` | when the 30-day trial ends |
| `currentPeriodEnd` | end of the current paid period (next billing date) |

`suspended_billing` is app-specific: the state after Stripe's dunning/retry schedule is
exhausted. All status changes are driven by **webhooks**, never by the checkout redirect.

## One-time setup

1. **Create a Stripe account** and grab your **test-mode** secret key (`sk_test_...`).

2. **Set env vars** in `.env.local` (see `.env.example`):
   ```
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_PRICE_AMOUNT="4900"        # optional; cents. 4900 = $49.00/mo
   STRIPE_PRICE_CURRENCY="usd"       # optional
   ```

3. **Create the Product + Price** (once per environment):
   ```
   npm run stripe:setup
   ```
   This prints a `STRIPE_PRICE_ID`. Add it to `.env.local` (and later to Vercel).

4. **Apply the DB migration**: `npx prisma db push` (or run `prisma/add-billing.sql`
   against the direct DB URL).

## Local webhook testing (do this before deploying)

```
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
`stripe listen` prints a webhook signing secret (`whsec_...`) — set it as
`STRIPE_WEBHOOK_SECRET` in `.env.local`. Trigger test events with e.g.
`stripe trigger customer.subscription.updated`.

Use Stripe test cards (e.g. `4242 4242 4242 4242`) throughout. Do not use live keys until
explicitly confirmed.

## Env vars to set in Vercel (production)

| Var | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | test key first; live only when confirmed |
| `STRIPE_WEBHOOK_SECRET` | from the Vercel/production webhook endpoint you register in the Stripe Dashboard |
| `STRIPE_PRICE_ID` | from `npm run stripe:setup` run against the same mode |
| `SUPPORT_EMAIL` | (optional) reply-to for billing emails |
