-- Pass 3: admin controls — audit trail + business suspension.
-- Apply with `prisma db push` (schema.prisma is source of truth) or run this SQL directly.
-- Idempotent where possible so it is safe to re-run.

-- 1) Admin action type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminActionType') THEN
    CREATE TYPE "AdminActionType" AS ENUM (
      'BUSINESS_APPROVED',
      'BUSINESS_REJECTED',
      'BUSINESS_SUSPENDED',
      'BUSINESS_UNSUSPENDED',
      'BUSINESS_REMOVED',
      'CATEGORY_CREATED',
      'CATEGORY_UPDATED',
      'CATEGORY_ARCHIVED',
      'CATEGORY_RESTORED'
    );
  END IF;
END$$;

-- 2) Business suspension columns (separate from verificationStatus so approval history survives)
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "suspendedBy" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT;

-- 3) Admin audit log table
CREATE TABLE IF NOT EXISTS "AdminAction" (
  "id"          TEXT NOT NULL,
  "adminId"     TEXT NOT NULL,
  "action"      "AdminActionType" NOT NULL,
  "targetType"  TEXT NOT NULL,
  "targetId"    TEXT NOT NULL,
  "targetLabel" TEXT,
  "reason"      TEXT,
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminAction_adminId_fkey'
  ) THEN
    ALTER TABLE "AdminAction"
      ADD CONSTRAINT "AdminAction_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "AdminAction_adminId_idx" ON "AdminAction"("adminId");
CREATE INDEX IF NOT EXISTS "AdminAction_targetType_targetId_idx" ON "AdminAction"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AdminAction_action_idx" ON "AdminAction"("action");
CREATE INDEX IF NOT EXISTS "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");
