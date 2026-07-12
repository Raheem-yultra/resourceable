-- Multi-listing marketplace: reviews per listing + per-listing rating aggregates.
-- Idempotent. Apply with `prisma db push` or run directly.

-- Per-listing rating aggregates on Service.
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "averageRating" DOUBLE PRECISION;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "totalReviews" INTEGER NOT NULL DEFAULT 0;

-- Attach reviews to a listing. Nullable to preserve any legacy business-level rows.
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;

-- Replace the old one-review-per-(user,business) rule with one-per-(user,listing).
-- Postgres treats NULL serviceId as distinct, so legacy rows never collide.
DROP INDEX IF EXISTS "Review_userId_businessId_key";
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_userId_businessId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Review_userId_serviceId_key" ON "Review" ("userId", "serviceId");
CREATE INDEX IF NOT EXISTS "Review_serviceId_idx" ON "Review" ("serviceId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_serviceId_fkey') THEN
    ALTER TABLE "Review" ADD CONSTRAINT "Review_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
