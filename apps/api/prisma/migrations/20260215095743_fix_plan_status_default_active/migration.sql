-- Change the default value of planStatus from "inactive" to "active".
-- New free-plan organizations should start with planStatus = "active".
ALTER TABLE "organizations" ALTER COLUMN "planStatus" SET DEFAULT 'active';

-- Fix existing free-plan organizations that were created with the old
-- default of "inactive". They should be "active" since the free plan
-- is always available.
UPDATE "organizations"
SET "planStatus" = 'active'
WHERE "planKey" = 'free' AND "planStatus" = 'inactive';
