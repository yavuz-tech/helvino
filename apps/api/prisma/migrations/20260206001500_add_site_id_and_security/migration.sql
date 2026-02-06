-- Add updatedAt column and backfill for existing rows
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "organizations" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "organizations" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Add siteId column (nullable first to handle existing data)
ALTER TABLE "organizations" ADD COLUMN "siteId" TEXT;

-- Generate siteId for existing organizations
-- Format: site_ + random string (using first 20 chars of existing id)
UPDATE "organizations" 
SET "siteId" = 'site_' || SUBSTRING(id, 1, 20)
WHERE "siteId" IS NULL;

-- Now make siteId non-nullable and unique
ALTER TABLE "organizations" ALTER COLUMN "siteId" SET NOT NULL;
CREATE UNIQUE INDEX "organizations_siteId_key" ON "organizations"("siteId");

-- Add index on siteId for faster lookups
CREATE INDEX "organizations_siteId_idx" ON "organizations"("siteId");

-- Add allowLocalhost column with default true
ALTER TABLE "organizations" ADD COLUMN "allowLocalhost" BOOLEAN NOT NULL DEFAULT true;
