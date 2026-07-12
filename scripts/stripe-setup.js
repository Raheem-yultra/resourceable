/**
 * One-off setup: creates the Stripe Product + monthly recurring Price for the
 * provider subscription. Run once per environment (test mode first):
 *
 *   node scripts/stripe-setup.js
 *
 * It reads STRIPE_SECRET_KEY from your environment (or .env.local / .env).
 * Idempotent: re-running finds the existing product by metadata instead of
 * creating duplicates, and reuses a matching active price if one exists.
 *
 * Amount/currency are configurable via env (defaults: $49.00/month USD):
 *   STRIPE_PRICE_AMOUNT=4900   # cents
 *   STRIPE_PRICE_CURRENCY=usd
 *
 * After it prints the Price ID, set STRIPE_PRICE_ID in .env.local and Vercel.
 */

const fs = require('fs');
const path = require('path');

// Minimal .env loader (avoids adding a dotenv dependency). Later files don't override
// already-set process.env, and .env.local wins over .env.
function loadEnvFile(file) {
  const full = path.join(__dirname, '..', file);
  if (!fs.existsSync(full)) return;
  for (const rawLine of fs.readFileSync(full, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const SECRET = process.env.STRIPE_SECRET_KEY;
if (!SECRET) {
  console.error('✗ STRIPE_SECRET_KEY is not set. Add it to .env.local (use a test-mode key: sk_test_...).');
  process.exit(1);
}
if (!SECRET.startsWith('sk_test_')) {
  console.warn('⚠ STRIPE_SECRET_KEY is not a test key (sk_test_...). Refusing to run against non-test keys.');
  console.warn('  If you really intend live mode, run with ALLOW_LIVE=1.');
  if (process.env.ALLOW_LIVE !== '1') process.exit(1);
}

const Stripe = require('stripe');
const stripe = new Stripe(SECRET);

const PRODUCT_NAME = 'ResourceAble Provider Subscription';
const AMOUNT = parseInt(process.env.STRIPE_PRICE_AMOUNT || '4900', 10); // cents
const CURRENCY = (process.env.STRIPE_PRICE_CURRENCY || 'usd').toLowerCase();
const METADATA_KEY = 'resourceable_provider_subscription';

async function findOrCreateProduct() {
  // Look for an existing product tagged with our metadata to stay idempotent
  const existing = await stripe.products.search({
    query: `active:'true' AND metadata['app']:'${METADATA_KEY}'`,
  });
  if (existing.data.length > 0) {
    console.log(`• Reusing existing product: ${existing.data[0].id}`);
    return existing.data[0];
  }
  const product = await stripe.products.create({
    name: PRODUCT_NAME,
    description: 'Monthly subscription for service providers listed on ResourceAble.',
    metadata: { app: METADATA_KEY },
  });
  console.log(`✓ Created product: ${product.id}`);
  return product;
}

async function findOrCreatePrice(productId) {
  // Reuse an active recurring price with matching amount/currency/interval if present
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = prices.data.find(
    (p) =>
      p.unit_amount === AMOUNT &&
      p.currency === CURRENCY &&
      p.recurring &&
      p.recurring.interval === 'month'
  );
  if (match) {
    console.log(`• Reusing existing price: ${match.id}`);
    return match;
  }
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: AMOUNT,
    currency: CURRENCY,
    recurring: { interval: 'month' },
    metadata: { app: METADATA_KEY },
  });
  console.log(`✓ Created price: ${price.id}`);
  return price;
}

(async () => {
  try {
    console.log(`Setting up Stripe product + price ($${(AMOUNT / 100).toFixed(2)} ${CURRENCY.toUpperCase()}/month)…\n`);
    const product = await findOrCreateProduct();
    const price = await findOrCreatePrice(product.id);

    console.log('\n──────────────────────────────────────────────');
    console.log('Add this to .env.local and your Vercel env vars:');
    console.log(`\n  STRIPE_PRICE_ID="${price.id}"\n`);
    console.log('──────────────────────────────────────────────');
  } catch (err) {
    console.error('✗ Stripe setup failed:', err.message);
    process.exit(1);
  }
})();
