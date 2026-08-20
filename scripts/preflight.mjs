#!/usr/bin/env node
/**
 * Production preflight.
 *
 * Answers one question: "if I deploy this environment right now, what breaks?"
 * Runs static config checks plus LIVE checks against Resend, Stripe, and the
 * database. Read-only throughout — it sends no email, creates no Stripe object,
 * and writes nothing to the database.
 *
 *   npm run preflight              # check .env.local
 *   npm run preflight -- --env     # check the ambient environment (CI / Vercel)
 *
 * Exit code 0 = safe to deploy, 1 = at least one blocking error.
 *
 * NOTE: the static rules here intentionally mirror `checkProductionConfig()` in
 * lib/env.ts. They are duplicated because this file must run as plain Node
 * before any build step exists, and cannot import TypeScript.
 */

import fs from 'fs';

const SANDBOX_SENDER = 'onboarding@resend.dev';
const useAmbientEnv = process.argv.includes('--env');

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

function loadEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = useAmbientEnv ? process.env : { ...loadEnvFile('.env.local'), ...process.env };
const val = (k) => (env[k] ?? '').trim();

// ---------------------------------------------------------------------------
// Result collection
// ---------------------------------------------------------------------------

const results = [];
const ok = (area, msg) => results.push({ level: 'ok', area, msg });
const warn = (area, msg) => results.push({ level: 'warn', area, msg });
const fail = (area, msg, fix) => results.push({ level: 'fail', area, msg, fix });

// ---------------------------------------------------------------------------
// 1. Static configuration
// ---------------------------------------------------------------------------

const REQUIRED = [
  ['DATABASE_URL', 'Prisma cannot reach the database.'],
  ['DIRECT_URL', 'Prisma db push / migrations need the non-pooled connection.'],
  ['NEXTAUTH_SECRET', 'Sessions cannot be signed.'],
  ['NEXTAUTH_URL', 'Every emailed link and Stripe redirect is built from it.'],
  ['RESEND_API_KEY', 'All transactional email silently fails.'],
  ['EMAIL_FROM', 'Falls back to the Resend sandbox sender, which delivers to nobody.'],
  ['STRIPE_SECRET_KEY', 'Billing cannot run.'],
  ['STRIPE_PRICE_ID', 'Checkout has no plan to subscribe to.'],
  ['STRIPE_WEBHOOK_SECRET', 'Webhook signatures cannot be verified.'],
];

for (const [key, why] of REQUIRED) {
  if (val(key)) ok('env', `${key} is set`);
  else fail('env', `${key} is not set — ${why}`, `Set ${key} in your deployment environment.`);
}

const url = val('NEXTAUTH_URL');
if (url && !/^https:\/\//i.test(url)) {
  fail(
    'env',
    `NEXTAUTH_URL is "${url}" — not https. Emailed links would point at a non-production host.`,
    'Set NEXTAUTH_URL to your canonical https:// origin, no trailing slash.'
  );
}
if (url && /\/$/.test(url)) warn('env', 'NEXTAUTH_URL has a trailing slash (stripped at runtime, but drop it).');

const secret = val('NEXTAUTH_SECRET');
if (secret && secret.length < 32) {
  fail(
    'env',
    `NEXTAUTH_SECRET is only ${secret.length} chars.`,
    'Generate a strong one: openssl rand -base64 32'
  );
}

if (val('DATABASE_URL') && val('DATABASE_URL') === val('DIRECT_URL')) {
  fail(
    'env',
    'DIRECT_URL is identical to DATABASE_URL. The transaction pooler cannot run DDL, so prisma db push hangs with no error.',
    'Point DIRECT_URL at port 5432 without pgbouncer/connection_limit.'
  );
}

if (!val('SUPPORT_EMAIL')) {
  warn('env', 'SUPPORT_EMAIL not set — Reply-To defaults to support@resourceable.com. Replies bounce if that mailbox does not exist.');
}

const from = val('EMAIL_FROM');
if (from && from.includes(SANDBOX_SENDER)) {
  fail(
    'email',
    `EMAIL_FROM uses the Resend sandbox sender (${SANDBOX_SENDER}) — real users receive nothing.`,
    'Set EMAIL_FROM to a sender on a domain verified in Resend.'
  );
}

// ---------------------------------------------------------------------------
// 2. Live check: Resend (read-only; sends nothing)
// ---------------------------------------------------------------------------

const resendKey = val('RESEND_API_KEY');
if (resendKey) {
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (res.status === 200) {
      ok('email', 'RESEND_API_KEY is valid');
      const { data = [] } = await res.json();
      if (data.length === 0) {
        fail(
          'email',
          'No sending domain is configured in Resend.',
          'Add your domain at https://resend.com/domains and publish its DNS records.'
        );
      }
      for (const d of data) {
        if (d.status === 'verified') ok('email', `Domain ${d.name} is verified`);
        else
          fail(
            'email',
            `Domain ${d.name} is "${d.status}" — Resend rejects sends from it with HTTP 403.`,
            `Publish the DNS records shown at https://resend.com/domains for ${d.name}, then re-run.`
          );
      }
      // The From domain must actually be one of the verified ones.
      const fromDomain = (from.match(/@([^>\s]+)/) || [])[1];
      if (fromDomain && fromDomain !== SANDBOX_SENDER.split('@')[1]) {
        const match = data.find((d) => fromDomain === d.name || fromDomain.endsWith(`.${d.name}`));
        if (!match) {
          fail(
            'email',
            `EMAIL_FROM uses @${fromDomain}, which is not a domain in this Resend account.`,
            `Either add ${fromDomain} to Resend, or set EMAIL_FROM to a verified domain.`
          );
        } else if (match.status !== 'verified') {
          fail('email', `EMAIL_FROM uses @${fromDomain}, whose domain is "${match.status}" in Resend.`, 'Complete DNS verification before deploying.');
        } else {
          ok('email', `EMAIL_FROM sender domain (@${fromDomain}) is verified`);
        }
      }
    } else {
      const body = await res.text();
      fail('email', `RESEND_API_KEY rejected (HTTP ${res.status}): ${body.slice(0, 160)}`, 'Regenerate the key at https://resend.com/api-keys.');
    }
  } catch (e) {
    warn('email', `Could not reach the Resend API (${e.message}). Network issue, not necessarily a config problem.`);
  }
}

// ---------------------------------------------------------------------------
// 3. Live check: Stripe (read-only)
// ---------------------------------------------------------------------------

const stripeKey = val('STRIPE_SECRET_KEY');
if (stripeKey) {
  const isTestKey = stripeKey.startsWith('sk_test_');
  if (isTestKey) warn('billing', 'STRIPE_SECRET_KEY is a TEST key — real cards will not be charged.');

  const priceId = val('STRIPE_PRICE_ID');
  if (priceId) {
    try {
      const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      if (res.status === 200) {
        const price = await res.json();
        const amount = price.unit_amount != null ? `${(price.unit_amount / 100).toFixed(2)} ${String(price.currency).toUpperCase()}` : 'n/a';
        ok('billing', `STRIPE_PRICE_ID resolves (${amount}/${price.recurring?.interval ?? 'one-off'}, livemode=${price.livemode})`);
        if (price.livemode === isTestKey) {
          fail('billing', `Key/price mode mismatch: key is ${isTestKey ? 'test' : 'live'} but price livemode=${price.livemode}.`, 'Use a price created in the same mode as the secret key.');
        }
        if (!price.active) fail('billing', 'STRIPE_PRICE_ID is archived/inactive.', 'Create or activate a price and update STRIPE_PRICE_ID.');
      } else {
        const body = await res.text();
        fail('billing', `Stripe rejected the price lookup (HTTP ${res.status}): ${body.slice(0, 160)}`, 'Check STRIPE_SECRET_KEY and STRIPE_PRICE_ID.');
      }
    } catch (e) {
      warn('billing', `Could not reach the Stripe API (${e.message}).`);
    }
  }

  if (!val('STRIPE_WEBHOOK_SECRET').startsWith('whsec_')) {
    warn('billing', 'STRIPE_WEBHOOK_SECRET does not look like a signing secret (expected whsec_…).');
  }
}

// ---------------------------------------------------------------------------
// 4. Live check: database (read-only)
// ---------------------------------------------------------------------------

if (val('DATABASE_URL')) {
  try {
    for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const users = await prisma.user.count();
    const listings = await prisma.service.count();
    ok('database', `Connected (${users} users, ${listings} listings)`);

    const unverified = await prisma.user.count({ where: { emailVerified: null } });
    if (unverified > 0) {
      warn('database', `${unverified} user(s) have never verified their email and cannot sign in.`);
    }
    await prisma.$disconnect();
  } catch (e) {
    fail('database', `Cannot connect: ${String(e.message).split('\n')[0]}`, 'Verify DATABASE_URL and that the database accepts connections from this network.');
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const icon = { ok: '  ok  ', warn: ' warn ', fail: ' FAIL ' };
let currentArea = null;
console.log('\nResourceAble production preflight');
console.log(`Source: ${useAmbientEnv ? 'ambient environment' : '.env.local'}\n`);

for (const r of results) {
  if (r.area !== currentArea) {
    currentArea = r.area;
    console.log(`[${currentArea}]`);
  }
  console.log(`  ${icon[r.level]} ${r.msg}`);
  if (r.fix) console.log(`         -> ${r.fix}`);
}

const fails = results.filter((r) => r.level === 'fail');
const warns = results.filter((r) => r.level === 'warn');
console.log(`\n${results.filter((r) => r.level === 'ok').length} passed, ${warns.length} warning(s), ${fails.length} blocking.\n`);

if (fails.length > 0) {
  console.log('NOT ready to deploy. Fix the FAIL items above.\n');
  process.exit(1);
}
console.log(warns.length ? 'Ready to deploy, with warnings noted above.\n' : 'Ready to deploy.\n');
