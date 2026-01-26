-- Add password reset fields to User table
-- Run this in Supabase SQL Editor

ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "resetToken" TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS "User_resetToken_idx" ON "User"("resetToken");

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'User' 
AND column_name IN ('resetToken', 'resetTokenExpiry');
