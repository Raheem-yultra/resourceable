# ResourceAble — Deployment Runbook

Every **human step** needed to take ResourceAble live, in order. Steps marked
**(one-time)** only happen on first deploy; everything else applies to any fresh
environment.

Stack: **Next.js 14 (App Router) · Prisma · PostgreSQL (Supabase) · NextAuth ·
Stripe · Resend · Vercel**

---

## 1. Accounts you need (one-time)

| Service | Used for | Sign up at |
|---|---|---|
| GitHub | Source repo (`Raheem-yultra/resourceable`) | github.com |
| Vercel | Hosting + serverless runtime | vercel.com |
| Supabase | PostgreSQL database | supabase.com |
| Stripe | Provider subscription billing ($/month + 30-day trial) | stripe.com |
| Resend | Transactional email (verification, resets, billing notices) | resend.com |

---

## 2. Environment variables (the complete list)

Set these in **Vercel → Project → Settings → Environment Variables** (Production).
Local development uses `.env.local`. **Never commit real values** — only
`.env.example` is tracked.

| Variable | Required | What it is / where to get it |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **pooled** connection string (port `6543`, `pgbouncer=true&connection_limit=1`). Supabase → Project → Connect → "Transaction pooler". |
| `DIRECT_URL` | ✅ | Supabase **direct** connection string (port `5432`). Used by Prisma for `db push` / migrations only. |
| `NEXTAUTH_SECRET` | ✅ | Random 32+ byte secret. Generate: `openssl rand -base64 32`. **Different value per environment.** |
| `NEXTAUTH_URL` | ✅ | The canonical site URL, e.g. `https://yourdomain.com`. Also used to build email links and Stripe redirect URLs — must be correct or those break. |
| `RESEND_API_KEY` | ✅ | Resend → API Keys. Emails silently fail without it. |
| `EMAIL_FROM` | ✅ (prod) | Verified sender, e.g. `ResourceAble <no-reply@yourdomain.com>`. Falls back to `onboarding@resend.dev` (dev only — won't deliver to arbitrary recipients). |
| `SUPPORT_EMAIL` | Recommended | Reply-to on all outbound email. Defaults to `support@resourceable.com`. |
| `STRIPE_SECRET_KEY` | ✅ | Stripe → Developers → API keys. Use **test** key until launch day, then swap to **live**. |
| `STRIPE_PRICE_ID` | ✅ | The monthly subscription Price. Printed by `npm run stripe:setup` (step 5). |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Signing secret of the webhook endpoint you create in step 5c. |
| `STRIPE_PRICE_AMOUNT` | Optional | Only read by the one-off `stripe:setup` script (cents; default `4900` = $49/mo). |
| `STRIPE_PRICE_CURRENCY` | Optional | Same script; default `usd`. |

---

## 3. Database (Supabase)

1. **(one-time)** Create a Supabase project → note the pooled + direct connection
   strings (step 2 table).
2. Push the schema (uses `DIRECT_URL`):
   ```bash
   npx prisma db push
   ```
   > This project manages schema with `db push` (no `prisma/migrations` folder).
3. Seed the taxonomy (categories/subcategories used by search + listing forms):
   ```bash
   npm run seed:categories
   ```
4. Seed the resources knowledge base (guides, hotlines, IEP/SSI articles):
   ```bash
   npm run seed:resources
   ```
5. **(demo/staging only)** `npm run seed:demo` fills the site with 26 realistic
   but fictional providers covering every listing type and subcategory, plus
   family accounts, reviews, and 2 pending applications for the admin queue —
   use it when showing the product to stakeholders. All its logins end in
   `@example.test` (password printed by the script), so the cleanup SQL below
   removes everything it created.
6. **Do NOT run `npm run seed:fake` or `npm run seed:demo` against production.**
   Both create fake accounts (`*@example.test`, password published in the script).
   - If fake data was ever seeded, remove it before launch by deleting the
     `@example.test` users (businesses/listings cascade automatically), e.g. in
     Supabase SQL editor:
     ```sql
     DELETE FROM "User" WHERE email LIKE '%@example.test';
     ```
   - `npx ts-node scripts/cleanup-db.ts` is a **full wipe** (deletes everything
     except the owner account) — only for resetting a dev database.

---

## 4. Email (Resend)

1. **(one-time)** Resend → Domains → add your sending domain → add the DNS
   records it shows (SPF + DKIM) at your DNS provider → wait for "Verified".
2. Create an API key → set `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on the verified domain
   (format: `ResourceAble <no-reply@yourdomain.com>`).
4. Set `SUPPORT_EMAIL` to a real inbox you monitor — suspension/billing emails
   use it as reply-to.

---

## 5. Billing (Stripe)

> Do all of this in **test mode** first, verify end-to-end, then repeat the three
> steps below in **live mode** on launch day.

**a. API key** — Developers → API keys → copy the secret key → `STRIPE_SECRET_KEY`.

**b. Product + price (one-time per mode)**
```bash
npm run stripe:setup
```
Creates the "ResourceAble Provider Subscription" product + monthly price and
prints the `price_...` id → set it as `STRIPE_PRICE_ID`.
(Override amount/currency with `STRIPE_PRICE_AMOUNT` / `STRIPE_PRICE_CURRENCY`.)

**c. Webhook endpoint (one-time per mode)**
Developers → Webhooks → **Add endpoint**:
- URL: `https://yourdomain.com/api/webhooks/stripe`
- Events to send (exactly these six):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.payment_failed`
- Copy the endpoint's **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

**d. Customer Portal (one-time)** — Settings → Billing → Customer portal →
enable it (the "Manage Billing" button opens it; it 500s if the portal was never
activated).

**Local webhook testing:** `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
and use the `whsec_...` it prints as your local `STRIPE_WEBHOOK_SECRET`.

---

## 6. Vercel

1. **(one-time)** Vercel → **Add New → Project** → import the GitHub repo.
   Framework preset **Next.js** — no build overrides needed (`postinstall`
   already runs `prisma generate`).
2. Add **all** environment variables from step 2 to the Production environment
   (and Preview, if you want working preview deploys — point previews at a
   separate database, never production).
3. Deploy (`git push` to `main` auto-deploys).
4. **(one-time)** Add your custom domain: Project → Settings → Domains → follow
   the DNS instructions. Then update `NEXTAUTH_URL` to the final domain and
   **redeploy** (env changes don't apply to already-built deployments).

---

## 7. Post-deploy (first launch)

1. **Create your admin account:**
   - Sign up normally on the live site and verify the email.
   - Promote it (email is set inside the script):
     ```bash
     node scripts/make-admin.js
     ```
2. **Smoke test** (5 minutes, in order):
   - [ ] Home page loads; theme toggle works.
   - [ ] `/search` returns results (or a clean empty state).
   - [ ] Sign up a test **family** account → verification email arrives → link verifies → sign in works.
   - [ ] Sign up a test **provider** account → appears in `/admin` pending queue.
   - [ ] Approve the provider as admin → approval/billing email arrives.
   - [ ] Provider dashboard → **Set Up Billing** → Stripe Checkout completes with test card `4242 4242 4242 4242` (test mode).
   - [ ] Stripe Dashboard → Webhooks → recent deliveries all `200`.
   - [ ] Send a message between the two test accounts; reply from the other side.
   - [ ] Submit a report on a listing → appears in `/admin` Reports.
   - [ ] `/resources` shows seeded articles.
3. **Forgot-password flow:** request a reset on the live domain and confirm the
   email link opens `https://yourdomain.com/auth/reset-password?...`
   (wrong `NEXTAUTH_URL` shows up here first).

---

## 8. Launch-day switch to live billing

1. Toggle Stripe to **live mode** and repeat steps 5a–5d (live key, live
   product/price, live webhook + secret, portal enabled).
2. Replace the three Stripe env vars in Vercel with the live values → redeploy.
3. Run one real card end-to-end, then refund it in the Stripe Dashboard.

---

## 9. Ongoing operations

| Task | How |
|---|---|
| Deploy a change | Push to `main` — Vercel auto-builds. |
| Schema change | Edit `prisma/schema.prisma` → `npx prisma db push` (against prod `DIRECT_URL`) → push code. |
| Reset a user's password manually | `node scripts/reset-password.js <email> <new-password>` |
| Promote an admin | Edit email in `scripts/make-admin.js` → `node scripts/make-admin.js` |
| List users | `npx ts-node scripts/list-users.ts` |
| DB connectivity check | `node scripts/test-connection.js` |
| Backups | Supabase → Database → Backups (daily automatic on paid plan — confirm it's on). |
| Secret rotation | Rotate `NEXTAUTH_SECRET` (logs everyone out), Stripe + Resend keys from their dashboards; update Vercel env + redeploy. |

### Notes & gotchas
- **Serverless + pooler:** `DATABASE_URL` must keep `connection_limit=1` on the
  Supabase transaction pooler — serverless functions each open their own
  connection.
- **Env changes require a redeploy** on Vercel; they are baked in at build time
  for some values.
- **Stripe env vars are lazy-checked:** a missing key doesn't fail the build —
  it throws on first billing action. The smoke test in step 7 catches this.
- **`seed:fake` / `seed:demo` are dev/demo-only.** Both print their password to
  the console and create publicly-visible fictional listings. `seed:demo` is the
  stakeholder-presentation dataset (all listing types, reviews, admin queue);
  `seed:fake` is the older plumbing-test set. Clean up with the
  `%@example.test` DELETE from section 3.

### Security notes
- **Security headers** (HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy) are set in `next.config.mjs`. A strict
  **Content-Security-Policy is intentionally NOT set** — Next.js relies on inline
  scripts and a wrong CSP silently breaks the app; add it via its own tested
  rollout (report-only first).
- **Image optimizer** is locked down (`images.remotePatterns: []`) because the app
  serves no remote images. If you later serve images from a remote host (e.g.
  Supabase Storage), add **that specific host** — do NOT restore a `**` wildcard.
- **Rate limiting** on the unauthenticated email/account endpoints (contact,
  forgot-password, signup, reset-password) is **best-effort and in-memory**
  (`lib/rate-limit.ts`) — it's per-serverless-instance, so it slows casual abuse
  but is not a strict global limit. For production-grade limits (and to cover
  credentials **login** brute-force, which is not yet rate-limited) wire up a
  shared store such as Upstash Redis / `@upstash/ratelimit`.
