-- Step 11.68: Metering (M1/M2/M3) + Domain Mismatch Event Log
-- Add lastMismatchHost, lastMismatchAt to organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "lastMismatchHost" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "lastMismatchAt" TIMESTAMP(3);

-- Add m1Count, m2Count, m3Count to usages
ALTER TABLE "usages" ADD COLUMN IF NOT EXISTS "m1Count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usages" ADD COLUMN IF NOT EXISTS "m2Count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usages" ADD COLUMN IF NOT EXISTS "m3Count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable usage_visitors (M3 dedupe)
CREATE TABLE IF NOT EXISTS "usage_visitors" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'M3',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_visitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_visitors_orgId_periodKey_visitorKey_key" ON "usage_visitors"("orgId", "periodKey", "visitorKey");
CREATE INDEX IF NOT EXISTS "usage_visitors_orgId_periodKey_idx" ON "usage_visitors"("orgId", "periodKey");

-- CreateTable domain_mismatch_events
CREATE TABLE IF NOT EXISTS "domain_mismatch_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reportedHost" TEXT NOT NULL,
    "allowedDomainsSnapshot" JSONB NOT NULL,
    "userAgent" TEXT,
    "referrerHost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_mismatch_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "domain_mismatch_events_orgId_idx" ON "domain_mismatch_events"("orgId");
CREATE INDEX IF NOT EXISTS "domain_mismatch_events_orgId_createdAt_idx" ON "domain_mismatch_events"("orgId", "createdAt" DESC);
