// Creates ONE ready-to-use provider (BUSINESS) account for walking through the
// provider setup flow by hand.
//
// The account is inserted already email-verified, on purpose. Sign-in is hard
// blocked on `emailVerified` (lib/auth.ts), and until the Resend sending domain
// is verified no verification mail can actually be delivered — so a normally
// signed-up provider cannot log in at all. This script skips that gate.
//
// Run:
//   npm run seed:provider                 # fresh provider, mid-signup state
//   npm run seed:provider -- --stage=approved
//   npm run seed:provider -- --stage=live
//   npm run seed:provider -- --reset      # delete and recreate from scratch
//   npm run seed:provider -- --email=me@example.test
//
// Stages mirror the real provider lifecycle:
//   new       PENDING approval, bare profile (exactly what signup creates) —
//             use this to walk the whole setup: complete profile -> admin
//             approves -> billing -> add listings.
//   approved  APPROVED, no subscription yet — starts at the billing step.
//   live      APPROVED + trialing subscription — an established provider.
//
// The login email uses @example.test so the production cleanup documented in
// DEPLOYMENT.md removes it:
//   DELETE FROM "User" WHERE email LIKE '%@example.test';
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

try {
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(process.cwd());
} catch (error) {
  // Continue even if env loader is unavailable
}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing DIRECT_URL / DATABASE_URL — set one in .env.local and rerun.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const DEFAULT_EMAIL = 'demo-provider@example.test';
const DEFAULT_PASSWORD = 'FakeDemo123!';

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const flag = (name) => process.argv.includes(`--${name}`);

const email = (arg('email') || DEFAULT_EMAIL).toLowerCase();
const stage = arg('stage') || 'new';
const reset = flag('reset');

const STAGES = ['new', 'approved', 'live'];
if (!STAGES.includes(stage)) {
  console.error(`Unknown --stage="${stage}". Expected one of: ${STAGES.join(', ')}`);
  process.exit(1);
}

if (!email.endsWith('@example.test')) {
  console.warn(
    `WARNING: ${email} is not an @example.test address, so the documented production\n` +
      '         cleanup query will NOT remove it. Continuing anyway.\n'
  );
}

// A bare profile is what app/api/auth/signup/route.ts actually creates: name,
// zip, phone and nothing else. Keeping `new` identical to that is the point —
// the profile-completion screens are the setup being simulated.
const BARE_PROFILE = {
  businessName: 'Demo Provider Co.',
  zipCode: '80202',
  phone: '303-555-0142',
};

const FULL_PROFILE = {
  ...BARE_PROFILE,
  businessType: 'Therapy Provider',
  description:
    'A fictional demo provider used to exercise the provider setup flow. Offers occupational and speech therapy for children and young adults.',
  email: 'hello@demo-provider.example.com',
  website: 'https://demo-provider.example.com',
  address: '1200 Demo Street',
  city: 'Denver',
  state: 'CO',
  yearEstablished: 2015,
};

async function main() {
  if (reset) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      // Business + listings cascade from User.
      await prisma.user.delete({ where: { email } });
      console.log(`Removed existing ${email}`);
    }
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Demo Provider Co.',
      password: passwordHash,
      role: 'BUSINESS',
      phone: BARE_PROFILE.phone,
      // The whole reason this script exists — see header.
      emailVerified: now,
      isActive: true,
    },
    update: {
      password: passwordHash,
      role: 'BUSINESS',
      emailVerified: now,
      isActive: true,
      // Clear any half-finished verification/reset state from earlier runs.
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      resetToken: null,
      resetTokenExpiry: null,
    },
    select: { id: true, email: true },
  });

  const profile = stage === 'new' ? BARE_PROFILE : FULL_PROFILE;

  const businessData = {
    ...profile,
    verificationStatus: stage === 'new' ? 'PENDING' : 'APPROVED',
    verificationLevel: stage === 'live' ? 'BASIC_VERIFIED' : 'UNVERIFIED',
    verifiedAt: stage === 'new' ? null : now,
    isActive: true,
    isSuspended: false,
    // Billing only begins at approval; `live` is mid free trial.
    subscriptionStatus: stage === 'live' ? 'trialing' : null,
    trialEndsAt: stage === 'live' ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null,
  };

  const business = await prisma.business.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...businessData },
    update: businessData,
    select: { id: true, businessName: true, verificationStatus: true, subscriptionStatus: true },
  });

  const listingCount = await prisma.service.count({ where: { businessId: business.id } });

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  console.log('\nDemo provider ready.\n');
  console.log(`  Email     ${user.email}`);
  console.log(`  Password  ${DEFAULT_PASSWORD}`);
  console.log(`  Stage     ${stage}`);
  console.log(`  Business  ${business.businessName} (${business.id})`);
  console.log(`  Approval  ${business.verificationStatus}`);
  console.log(`  Billing   ${business.subscriptionStatus ?? 'not started'}`);
  console.log(`  Listings  ${listingCount}`);
  console.log(`\n  Sign in:  ${baseUrl}/auth/signin`);

  if (stage === 'new') {
    console.log('\nNext steps to simulate setup:');
    console.log('  1. Sign in -> /business/profile, complete the profile.');
    console.log('  2. Sign in as an admin -> /admin, approve the pending provider.');
    console.log('     (approval sends the billing email and creates the Stripe customer)');
    console.log('  3. Back as the provider -> /business/dashboard -> Set Up Billing.');
    console.log('     Stripe must be configured for this step; see DEPLOYMENT.md section 5.');
    console.log('  4. /business/listings -> add a listing and confirm it appears in /browse.');
  }
  console.log('\nRemove it again:  npm run seed:provider -- --reset\n');
}

main()
  .catch((e) => {
    console.error('\nFailed to seed demo provider:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
