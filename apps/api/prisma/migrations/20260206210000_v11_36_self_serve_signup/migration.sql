-- Step 11.36: Self-Serve Signup + Email Verification
-- Add emailVerifiedAt to org_users (null = unverified)
ALTER TABLE "org_users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Backfill existing users as verified (they were admin-created)
UPDATE "org_users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;

-- Add createdVia to organizations
ALTER TABLE "organizations" ADD COLUMN "createdVia" TEXT NOT NULL DEFAULT 'admin';
