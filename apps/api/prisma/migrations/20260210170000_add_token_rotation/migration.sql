-- Add token rotation fields to portal sessions.
ALTER TABLE "portal_sessions"
ADD COLUMN "refreshToken" TEXT,
ADD COLUMN "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN "refreshExpiresAt" TIMESTAMP(3);

-- Backfill existing rows so migration is non-breaking.
UPDATE "portal_sessions"
SET
  "refreshToken" = CONCAT("id", '_legacy_refresh'),
  "accessExpiresAt" = NOW() + INTERVAL '15 minutes',
  "refreshExpiresAt" = NOW() + INTERVAL '7 days'
WHERE "refreshToken" IS NULL;

ALTER TABLE "portal_sessions"
ALTER COLUMN "refreshToken" SET NOT NULL,
ALTER COLUMN "accessExpiresAt" SET NOT NULL,
ALTER COLUMN "refreshExpiresAt" SET NOT NULL;

CREATE UNIQUE INDEX "portal_sessions_refreshToken_key" ON "portal_sessions"("refreshToken");
