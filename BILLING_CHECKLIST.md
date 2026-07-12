# Billing Setup Checklist

Everything **you** need to do to make Stripe billing work — local first, then production.
Work top to bottom. Code is already in place; these are the manual/config steps.

> Terminology: "Provider" in the spec = the **`Business`** model (`role = BUSINESS`) in this codebase.

---

## A. Local setup (test mode)

- [ ] **1. Create a Stripe account** and switch it to **Test mode** (toggle, top-right of the Dashboard).

- [ ] **2. Get your test secret key**: Dashboard → Developers → API keys → copy the **Secret key** (`sk_test_...`).

- [ ] **3. Add it to `.env.local`** (in `resourceable/`):
  ```
  STRIPE_SECRET_KEY="sk_test_..."
  # optional overrides for the setup script (defaults: $49.00/mo USD)
  STRIPE_PRICE_AMOUNT="4900"
  STRIPE_PRICE_CURRENCY="usd"
  ```

- [ ] **4. Create the Product + Price** (one-off):
  ```
  npm run stripe:setup
  ```
  Copy the printed `STRIPE_PRICE_ID="price_..."` into `.env.local`.

- [ ] **5. Apply the database migrations** to your Postgres (run against the **direct** DB URL, not the pooled one):
  ```
  npx prisma db push
  ```
  (or run `prisma/add-billing.sql`, `prisma/add-admin-controls.sql`, **and**
  `prisma/add-billing-admin.sql` manually. The last adds the
  `BUSINESS_BILLING_OVERRIDE` audit action used by the admin "Extend Trial" override.)

- [ ] **6. Install the Stripe CLI** and log in:
  ```
  stripe login
  ```

- [ ] **7. Forward webhooks to your local app** (keep this running while testing):
  ```
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  ```
  It prints a signing secret `whsec_...`. Add it to `.env.local`:
  ```
  STRIPE_WEBHOOK_SECRET="whsec_..."
  ```
  Restart `npm run dev` after adding it.

- [ ] **8. Configure dunning (retry) behavior** so `suspended_billing` works correctly:
  Dashboard → Settings → Billing → **Subscriptions and emails** → "If all retries fail" →
  set to **Mark the subscription as `unpaid`** (our code maps `unpaid` → `suspended_billing`).
  (If you choose "Cancel", we still handle it — cancels caused by payment failure also map to
  `suspended_billing`.)

- [ ] **9. Enable the Customer Portal** (needed for Pass 3 "Manage Billing"):
  Dashboard → Settings → Billing → **Customer portal** → activate, and allow "update payment
  method", "view invoices", and "cancel subscriptions".

---

## B. Test the end-to-end flow (local)

- [ ] **10. Approve a provider** as an admin (Admin Console → Verification Queue → Approve).
  - Expect: a Stripe Customer is created, and the provider gets an "approved — start trial" email.
- [ ] **11. As that provider**, go to the dashboard → **Set Up Billing** → complete Checkout with a
  test card: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
  - Expect: redirect back to the dashboard; within a moment the webhook sets status to `trialing`.
- [ ] **12. Verify webhook events** are processed (watch the `stripe listen` output and your app logs).
- [ ] **13. Exercise the edge cases** with the CLI:
  ```
  stripe trigger customer.subscription.trial_will_end
  stripe trigger invoice.payment_failed
  stripe trigger customer.subscription.updated
  stripe trigger customer.subscription.deleted
  ```
  - Failed-payment test card: `4000 0000 0000 0341` (attaches but fails on charge).
- [ ] **14. Confirm idempotency**: re-send an event id from the Dashboard (Developers → Events →
  Resend) and confirm it is NOT double-processed (no duplicate emails / no DB thrash).

---

## C. Production (Vercel) — only after you confirm test mode works

- [ ] **15. Create the Product + Price in LIVE mode** (flip Dashboard to live, then rerun
  `npm run stripe:setup` with a live `sk_live_...` key and `ALLOW_LIVE=1`) — **only when you tell me to go live.**

- [ ] **16. Register the production webhook endpoint**: Dashboard → Developers → Webhooks → Add
  endpoint → URL `https://YOUR_DOMAIN/api/webhooks/stripe`. Subscribe to at least:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.trial_will_end`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

  Copy the endpoint's **Signing secret** (`whsec_...`).

- [ ] **17. Set env vars in Vercel** (Project → Settings → Environment Variables), for Production:

  | Var | Value |
  |---|---|
  | `STRIPE_SECRET_KEY` | test key for now; live key only when you confirm |
  | `STRIPE_PRICE_ID` | from the setup script (matching the mode) |
  | `STRIPE_WEBHOOK_SECRET` | the production endpoint's signing secret |
  | `SUPPORT_EMAIL` | (optional) billing reply-to address |
  | `EMAIL_FROM` | (optional) verified sender for emails |

- [ ] **18. Apply the DB migration to the production database** (same `prisma db push` / SQL, against
  the production direct URL).

- [ ] **19. Redeploy** so the new env vars take effect.

- [ ] **20. Smoke-test in production** with a real card in **test mode** first; do a live transaction
  only after explicit sign-off.

---

## Env var reference

| Var | Required | Where it comes from |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | Stripe Dashboard → API keys |
| `STRIPE_PRICE_ID` | ✅ | `npm run stripe:setup` |
| `STRIPE_WEBHOOK_SECRET` | ✅ | `stripe listen` (local) / webhook endpoint (prod) |
| `STRIPE_PRICE_AMOUNT` | optional | setup script only; default `4900` |
| `STRIPE_PRICE_CURRENCY` | optional | setup script only; default `usd` |
| `NEXTAUTH_URL` | ✅ (already set) | reused as the base URL for Checkout/Portal redirects |
| `SUPPORT_EMAIL` / `EMAIL_FROM` | optional | email sender/reply-to |

The app **fails loudly** (clear thrown error) if a required Stripe env var is missing at the
moment it's needed — so a misconfigured deploy won't silently misbehave.
