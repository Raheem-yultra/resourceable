-- Add email verification fields to User table
-- Run this migration manually if Prisma migrate fails

-- Add the new columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT UNIQUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpiry" TIMESTAMP(3);

-- Create index for the token
CREATE INDEX IF NOT EXISTS "User_emailVerificationToken_idx" ON "User"("emailVerificationToken");

-- Mark existing users as verified (so they can still login)
UPDATE "User" SET "emailVerified" = NOW() WHERE "emailVerified" IS NULL;
