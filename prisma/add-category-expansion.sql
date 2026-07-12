-- Category Expansion (plan: ResourceAble-Category-Expansion-Plan.md)
-- Evolves the single generic Service into a multi-category marketplace listing,
-- adds tiered provider verification, listing extension fields, and the new
-- Report (flag) + Resource (knowledge base) models.
--
-- Idempotent: safe to run repeatedly. Apply with `prisma db push` (schema.prisma
-- is source of truth) or run this SQL directly. Enum values are added standalone
-- because Postgres can't ADD VALUE inside a transaction on older versions.

-- ---------------------------------------------------------------------------
-- New enum types (CREATE TYPE has no IF NOT EXISTS — guard with a DO block).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingType') THEN
    CREATE TYPE "ListingType" AS ENUM ('SERVICE', 'THERAPY', 'SHOP', 'SCHOOL', 'EVENT');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationLevel') THEN
    CREATE TYPE "VerificationLevel" AS ENUM ('UNVERIFIED', 'BASIC_VERIFIED', 'LICENSED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryMode') THEN
    CREATE TYPE "DeliveryMode" AS ENUM ('IN_PERSON', 'VIRTUAL', 'BOTH');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ItemCondition') THEN
    CREATE TYPE "ItemCondition" AS ENUM ('NEW', 'USED_LIKE_NEW', 'USED_FAIR');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ResourceType') THEN
    CREATE TYPE "ResourceType" AS ENUM ('ARTICLE', 'GUIDE', 'HOTLINE', 'FORM');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportStatus') THEN
    CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- New AdminActionType values (must be standalone statements).
-- ---------------------------------------------------------------------------
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'BUSINESS_VERIFICATION_LEVEL';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'REPORT_RESOLVED';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'RESOURCE_CREATED';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'RESOURCE_UPDATED';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'RESOURCE_ARCHIVED';

-- ---------------------------------------------------------------------------
-- Business: provider trust tier.
-- ---------------------------------------------------------------------------
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'UNVERIFIED';
CREATE INDEX IF NOT EXISTS "Business_verificationLevel_idx" ON "Business" ("verificationLevel");

-- ---------------------------------------------------------------------------
-- Service: listing type + trust tier + type-specific extension fields.
-- ---------------------------------------------------------------------------
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "listingType" "ListingType" NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "deliveryMode" "DeliveryMode";
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "condition" "ItemCondition";
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "isForRent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "enrollmentStatus" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "gradeLevels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "programType" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "isVirtual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "rsvpCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Service_listingType_idx" ON "Service" ("listingType");
CREATE INDEX IF NOT EXISTS "Service_listingType_isActive_idx" ON "Service" ("listingType", "isActive");
CREATE INDEX IF NOT EXISTS "Service_verificationLevel_idx" ON "Service" ("verificationLevel");

-- ---------------------------------------------------------------------------
-- ServiceType: which top-level category a subcategory belongs to.
-- ---------------------------------------------------------------------------
ALTER TABLE "ServiceType" ADD COLUMN IF NOT EXISTS "listingType" "ListingType";
CREATE INDEX IF NOT EXISTS "ServiceType_listingType_idx" ON "ServiceType" ("listingType");

-- ---------------------------------------------------------------------------
-- Report (flag) model.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Report" (
  "id"           TEXT NOT NULL,
  "serviceId"    TEXT,
  "businessId"   TEXT,
  "reportedById" TEXT,
  "reason"       TEXT NOT NULL,
  "details"      TEXT,
  "status"       "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedById" TEXT,
  "resolvedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_serviceId_fkey') THEN
    ALTER TABLE "Report" ADD CONSTRAINT "Report_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_reportedById_fkey') THEN
    ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedById_fkey"
      FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Report_serviceId_idx" ON "Report" ("serviceId");
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report" ("status");
CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report" ("createdAt");

-- ---------------------------------------------------------------------------
-- Resource (knowledge base) model — separate from the listing search index.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Resource" (
  "id"           TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "slug"         TEXT NOT NULL,
  "summary"      TEXT,
  "body"         TEXT NOT NULL,
  "topicTags"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "resourceType" "ResourceType" NOT NULL DEFAULT 'ARTICLE',
  "externalUrl"  TEXT,
  "isPublished"  BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Resource_slug_key" ON "Resource" ("slug");
CREATE INDEX IF NOT EXISTS "Resource_slug_idx" ON "Resource" ("slug");
CREATE INDEX IF NOT EXISTS "Resource_resourceType_idx" ON "Resource" ("resourceType");
CREATE INDEX IF NOT EXISTS "Resource_isPublished_displayOrder_idx" ON "Resource" ("isPublished", "displayOrder");
