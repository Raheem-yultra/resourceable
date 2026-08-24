-- Reverses add-billing.sql and add-billing-admin.sql: removes subscription billing
-- entirely. Providers are not charged — creating an account, submitting details and
-- being approved by an admin is the whole path to being listed.
--
-- Apply with `prisma db push` (schema.prisma is source of truth) or run this SQL
-- directly. Idempotent so it is safe to re-run.
--
-- DESTRUCTIVE: the dropped columns and table are not recoverable from this file.
-- prisma/billing-columns-backup.json holds the values as of the drop.
--
-- To reintroduce paid plans later, re-apply add-billing.sql + add-billing-admin.sql
-- and rebuild the gating layer (search visibility, listing management, messaging,
-- public pages) — none of it survives in the application code.

-- 1) Indexes first (dropping a column would take its index with it, but being
--    explicit keeps this readable and re-runnable).
DROP INDEX IF EXISTS "Business_subscriptionStatus_idx";
DROP INDEX IF EXISTS "Business_stripeCustomerId_key";
DROP INDEX IF EXISTS "Business_stripeSubscriptionId_key";

-- 2) Billing columns on Business
ALTER TABLE "Business" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "stripeSubscriptionId";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "subscriptionStatus";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "trialEndsAt";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "currentPeriodEnd";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "trialUsedAt";

-- 3) Stripe webhook idempotency ledger — no webhook handler exists any more.
DROP TABLE IF EXISTS "ProcessedStripeEvent";

-- 4) The status enum, now that no column references it.
DROP TYPE IF EXISTS "SubscriptionStatus";

-- 5) Retire the manual billing-override audit action. Postgres cannot drop a value
--    from an enum in place, so the type is recreated without it. This is safe only
--    while no AdminAction row uses the value; the guard below aborts if any exist
--    rather than destroying audit history.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminActionType')
     AND EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'AdminActionType' AND e.enumlabel = 'BUSINESS_BILLING_OVERRIDE'
     )
  THEN
    IF EXISTS (SELECT 1 FROM "AdminAction" WHERE "action" = 'BUSINESS_BILLING_OVERRIDE') THEN
      RAISE EXCEPTION
        'AdminAction rows still use BUSINESS_BILLING_OVERRIDE; leave the enum value in place to preserve audit history.';
    END IF;

    ALTER TYPE "AdminActionType" RENAME TO "AdminActionType_old";
    CREATE TYPE "AdminActionType" AS ENUM (
      'BUSINESS_APPROVED',
      'BUSINESS_REJECTED',
      'BUSINESS_SUSPENDED',
      'BUSINESS_UNSUSPENDED',
      'BUSINESS_REMOVED',
      'CATEGORY_CREATED',
      'CATEGORY_UPDATED',
      'CATEGORY_ARCHIVED',
      'CATEGORY_RESTORED',
      'BUSINESS_VERIFICATION_LEVEL',
      'BUSINESS_CHECKS_RUN',
      'REPORT_RESOLVED',
      'RESOURCE_CREATED',
      'RESOURCE_UPDATED',
      'RESOURCE_ARCHIVED'
    );
    ALTER TABLE "AdminAction"
      ALTER COLUMN "action" TYPE "AdminActionType" USING "action"::text::"AdminActionType";
    DROP TYPE "AdminActionType_old";
  END IF;
END$$;
