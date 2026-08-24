# ResourceAble — Deployment Runbook

Every **human step** needed to take ResourceAble live, in order. Steps marked
**(one-time)** only happen on first deploy; everything else applies to any fresh
environment.

Stack: **Next.js 14 (App Router) · Prisma · PostgreSQL (Supabase) · NextAuth ·
Resend · Vercel**

---

## 1. Accounts you need (one-time)

| Service | Used for | Sign up at |
|---|---|---|
| GitHub | Source repo (`Raheem-yultra/resourceable`) | github.com |
| Vercel | Hosting + serverless runtime | vercel.com |
| Supabase | PostgreSQL database | supabase.com |
| Resend | Transactional email (verification, resets, admin notices) | resend.com |

---

## 2. Environment variables (the complete list)

Set these in **Vercel → Project → Settings → Environment Variables** (Production).
Local development uses `.env.local`. **Never commit real values** — only
`.env.example` is tracked.

| Variable | Required | What it is / where to get it |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **pooled** connection string (port `6543`, `pgbouncer=true&connection_limit=1`). Supabase → Project → Connect → "Transaction pooler". |
| `DIRECT_URL` | ✅ | Supabase **session** connection string — **port `5432`, and WITHOUT `pgbouncer=true` / `connection_limit`**. Used by Prisma for `db push` / migrations only. ⚠️ It must NOT be the same as `DATABASE_URL`: the transaction pooler (`6543`) cannot run DDL, so `prisma db push` hangs forever with no error if this points at `6543`. See the gotcha in §9. |
| `NEXTAUTH_SECRET` | ✅ | Random 32+ byte secret. Generate: `openssl rand -base64 32`. **Different value per environment.** |
| `NEXTAUTH_URL` | ✅ | The canonical site URL, e.g. `https://yourdomain.com`. Also used to build every emailed link — must be correct or those break. |
| `RESEND_API_KEY` | ✅ | Resend → API Keys. Emails silently fail without it. |
| `EMAIL_FROM` | ✅ (prod) | Verified sender, e.g. `ResourceAble <no-reply@yourdomain.com>`. Falls back to `onboarding@resend.dev` (dev only — won't deliver to arbitrary recipients). |
| `SUPPORT_EMAIL` | Recommended | Reply-to on all outbound email. Defaults to `support@resourceable.com`. |

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
4. Set `SUPPORT_EMAIL` to a real inbox you monitor — suspension/approval emails
   use it as reply-to.

Verify with `npm run preflight`, which checks the key, lists every domain in the
account with its verification status, and confirms the `EMAIL_FROM` domain is
among the verified ones. It sends nothing.

### 4a. While the sending domain is not yet yours

Until the domain is transferred and verified, **leave `EMAIL_FROM` unset.** The
app then falls back to Resend's shared sandbox sender
(`ResourceAble <onboarding@resend.dev>`), which the API accepts but which only
delivers to your own Resend account address and `@resend.dev` test inboxes.

That is a working development posture and a **non-shippable production one**:

- Do NOT point `EMAIL_FROM` at the domain before Resend reports `verified` —
  sends fail with `403 The <domain> domain is not verified`, which is strictly
  worse than the sandbox fallback.
- Do NOT deploy to production in this state. `getEmailFrom()` in `lib/env.ts`
  throws when `EMAIL_FROM` is unset and `NODE_ENV=production`, precisely so this
  cannot ship silently. Email failures are caught as non-fatal by every caller,
  so users still get accounts — but nothing is delivered and the log fills with
  the error.

**The switch, once the domain lands (in this order):**

1. Add the domain in Resend → publish the SPF + DKIM records at the DNS provider.
2. Wait for Resend to report `verified` (`npm run preflight` will confirm).
3. Set `EMAIL_FROM="ResourceAble <no-reply@yourdomain.com>"` and `SUPPORT_EMAIL`.
4. Set `NEXTAUTH_URL` to the final `https://` origin.
5. Re-run `npm run preflight -- --env` against the deployment environment.
6. Redeploy — env changes do not apply to already-built deployments.

### 4b. What the app sends

| Trigger | Recipient | Blocking? |
|---|---|---|
| Signup | New user | No — signup succeeds even if mail fails |
| Resend verification (`/auth/verify-email`) | User | No |
| Forgot password | User | No |
| **Password successfully changed** | User | No — security notice; how a user learns of a takeover |
| Contact form | Provider (Reply-To = the customer) + customer | No |
| Admin suspend / unsuspend / remove | Provider owner | No |
| Provider approved | Provider owner | No |

Every send is non-fatal by design: a mail outage must never make a signup,
password reset, or admin action appear to have failed.

---

## 5. Billing — not in use

Providers are **not charged**. The whole path to being listed is: create an
account → submit business details → wait for an admin to approve. Approval is
the only gate; once it lands, the provider's listings are live and they can
answer messages.

Nothing here needs configuring, and no payment provider is wired up. The billing
columns, the `ProcessedStripeEvent` table and the `SubscriptionStatus` enum have
all been dropped — see `prisma/drop-billing.sql`, with the dropped column values
recorded in `prisma/billing-columns-backup.json`.

Re-introducing paid plans is therefore a schema change, not just a code change:
re-apply `prisma/add-billing.sql` + `prisma/add-billing-admin.sql`, then rebuild
the gating layer. Search, listing management, messaging and the public pages all
key off `verificationStatus` + `isActive` alone today, so none of that gating
survives in the application code.

---

## 6. Vercel

1. **(one-time)** Vercel → **Add New → Project** → import the GitHub repo.
   Framework preset **Next.js** — no build overrides needed (`postinstall`
   already runs `prisma generate`).
2. Add **all** environment variables from step 2 to the Production environment
   (and Preview, if you want working preview deploys — point previews at a
   separate database, never production).
3. **Before deploying, gate on the preflight.** It validates every required
   variable and makes live read-only checks against Resend and the database;
   it exits non-zero if anything would break:
   ```bash
   npm run preflight -- --env
   ```
4. Deploy (`git push` to `main` auto-deploys).
5. **(one-time)** Add your custom domain: Project → Settings → Domains → follow
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
   - [ ] Approve the provider as admin → approval email arrives.
   - [ ] Provider's listings now appear in `/search` and on their public page.
   - [ ] Send a message between the two test accounts; reply from the other side.
   - [ ] Submit a report on a listing → appears in `/admin` Reports.
   - [ ] `/resources` shows seeded articles.
3. **Forgot-password flow:** request a reset on the live domain and confirm the
   email link opens `https://yourdomain.com/auth/reset-password?...`
   (wrong `NEXTAUTH_URL` shows up here first). Completing the reset must also
   deliver a "Your ResourceAble password was changed" notice.

---

## 8. Launch day

No billing switch is required — there is nothing to charge. Confirm the step 7
smoke test passes against the production domain with `NEXTAUTH_URL` pointing at
it, and you are live.

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
| Secret rotation | Rotate `NEXTAUTH_SECRET` (logs everyone out) and the Resend key from its dashboard; update Vercel env + redeploy. |

### Notes & gotchas
- **Serverless + pooler:** `DATABASE_URL` must keep `connection_limit=1` on the
  Supabase transaction pooler — serverless functions each open their own
  connection.
- **`prisma db push` hangs forever → check `DIRECT_URL`.** The transaction pooler
  (port `6543`, `pgbouncer=true`) cannot run DDL, and Prisma gives no error — it just
  blocks. `DIRECT_URL` must be the **session** connection: same host, **port 5432**,
  with `pgbouncer` and `connection_limit` removed. Quick check:
  ```bash
  node -e "require('@next/env').loadEnvConfig('.');for(const k of ['DATABASE_URL','DIRECT_URL']){const u=new URL(process.env[k]);console.log(k,u.port)}"
  ```
  If both print `6543`, fix `DIRECT_URL` (locally in `.env.local` **and** in Vercel).
- **Env changes require a redeploy** on Vercel; they are baked in at build time
  for some values.
- **`seed:fake` / `seed:demo` are dev/demo-only.** Both print their password to
  the console and create publicly-visible fictional listings. `seed:demo` is the
  stakeholder-presentation dataset (all listing types, reviews, admin queue);
  `seed:fake` is the older plumbing-test set. Clean up with the
  `%@example.test` DELETE from section 3.

### Provider verification (pre-approval checks)

Approval is still a **manual admin decision**. Before an application reaches the queue,
`lib/verification` gathers evidence automatically so the admin adjudicates exceptions
instead of investigating every row. The governing rule: never verify what the provider
typed — match it against a source the provider does not control.

| Check | Source | Needs config? |
|---|---|---|
| NPI registry | CMS **NPPES** public API | No — free, keyless |
| Address | **US Census** geocoder | No — free, keyless |
| Website | DNS + **RDAP** (WHOIS successor) | No |
| Email domain | Account email vs. website domain | No |
| Duplicate provider | This database | No |
| Phone | NANP format, plus NPPES's registered number | No |

- **Nothing to set up.** All three external sources are free, public and keyless, so
  this works in every environment with no vendor account and no secret to rotate.
- **Results are evidence, never decisions.** The checks never touch
  `verificationStatus` or `verificationLevel`. `PASS/WARN/FAIL/SKIPPED/ERROR` are
  distinct on purpose — **ERROR means a source was unreachable, not that the provider
  is suspect**, so an outage can never look like fraud.
- **When they run:** automatically on a provider profile save while the business is
  `PENDING` (adds ~5s to that one request), and on demand from the **Re-run** button on
  each row in the admin queue. Results are stored one-per-check in `VerificationCheck`
  and shown as a checklist with a verdict pill (`All checks clear` / `N to review` /
  `N failed`).
- **Side benefit:** a successful address check backfills `latitude`/`longitude` from
  the geocoder, so distance/map features get coordinates without a separate pass.
- **Grant `LICENSED` only on a registry match** (NPI or a state board), never on a
  self-reported licence number. `BASIC_VERIFIED` is the right tier for "real, reachable
  entity". See the admin queue's Verification Level control.
- ⚠️ **Phone ownership is NOT verified.** The phone check validates format and compares
  against the number NPPES holds for the NPI; proving the applicant actually answers the
  listed number needs an SMS/voice OTP, which needs a provider (Twilio/MessageBird) this
  project has no credentials for. Wire that up for a stronger Layer 1.
- Demo data seeded by `seed:demo` uses `*.example.com` websites, which are RFC 2606
  reserved domains — the checks correctly flag those as **Review**, so a seeded
  environment will not show "all clear". That is expected, not a bug.

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
