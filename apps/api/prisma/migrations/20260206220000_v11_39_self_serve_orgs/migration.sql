-- Step 11.39: Self-Serve Organizations + Admin Org Directory

-- Add isActive to organizations (true = active, false = deactivated by admin)
ALTER TABLE "organizations" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Add ownerUserId to organizations (nullable FK to org_users)
ALTER TABLE "organizations" ADD COLUMN "ownerUserId" TEXT;

-- Create index on ownerUserId
CREATE INDEX "organizations_ownerUserId_idx" ON "organizations"("ownerUserId");

-- Backfill ownerUserId for existing orgs: pick the first "owner" role OrgUser per org
UPDATE "organizations" o
SET "ownerUserId" = (
  SELECT ou.id FROM "org_users" ou
  WHERE ou."orgId" = o.id AND ou.role = 'owner'
  ORDER BY ou."createdAt" ASC
  LIMIT 1
)
WHERE o."ownerUserId" IS NULL;
