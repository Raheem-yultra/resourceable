-- Billing (Stripe subscriptions) — adds subscription tracking to Business.
-- Apply with `prisma db push` (schema.prisma is source of truth) or run this SQL directly.
-- Idempotent so it is safe to re-run.

-- 1) Subscription status enum (lowercase to mirror Stripe status strings)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'suspended_billing'
    );
  END IF;
END$$;

-- 2) Billing columns on Business (nullable: null until billing starts at approval)
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus";
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);

-- 3) Unique constraints on the Stripe identifiers (partial-safe: multiple NULLs allowed)
CREATE UNIQUE INDEX IF NOT EXISTS "Business_stripeCustomerId_key" ON "Business"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Business_stripeSubscriptionId_key" ON "Business"("stripeSubscriptionId");

-- 4) Index for admin filtering / access gating by subscription status
CREATE INDEX IF NOT EXISTS "Business_subscriptionStatus_idx" ON "Business"("subscriptionStatus");

-- 5) Idempotency ledger for Stripe webhook events
CREATE TABLE IF NOT EXISTS "ProcessedStripeEvent" (
  "id"          TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProcessedStripeEvent_type_idx" ON "ProcessedStripeEvent"("type");
CREATE INDEX IF NOT EXISTS "ProcessedStripeEvent_processedAt_idx" ON "ProcessedStripeEvent"("processedAt");
