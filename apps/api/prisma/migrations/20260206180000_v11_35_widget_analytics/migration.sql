-- Step 11.35: Widget Analytics + Health Metrics
ALTER TABLE "organizations" ADD COLUMN "widgetLoadsTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "widgetLoadFailuresTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "widgetDomainMismatchTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "widgetResponseP50Ms" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "widgetResponseP95Ms" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "widgetResponseSampleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "lastWidgetSeenAt" TIMESTAMP(3);
