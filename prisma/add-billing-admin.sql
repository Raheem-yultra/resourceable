-- Billing Pass 4: admin visibility — new audit action type for manual billing overrides.
-- Apply with `prisma db push` (schema.prisma is source of truth) or run this SQL directly.
-- Idempotent: adding an existing enum value is a no-op with IF NOT EXISTS.

-- Postgres can't add enum values inside a transaction block in older versions; run standalone.
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'BUSINESS_BILLING_OVERRIDE';

-- One free trial per account: records when a trial was first granted. Once set,
-- re-subscribing skips the trial (see lib/billing.ts createSubscriptionCheckout).
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "trialUsedAt" TIMESTAMP(3);
