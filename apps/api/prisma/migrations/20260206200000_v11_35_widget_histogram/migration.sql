-- Step 11.35 upgrade: replace flat p50/p95 with rolling histogram
-- Drop old columns
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "widgetResponseP50Ms";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "widgetResponseP95Ms";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "widgetResponseSampleCount";

-- Add histogram columns
ALTER TABLE "organizations" ADD COLUMN "widgetRtBucketsJson" JSONB;
ALTER TABLE "organizations" ADD COLUMN "widgetRtTotalCount" INTEGER NOT NULL DEFAULT 0;
