-- Step 11.12: Usage Metering + Monthly Reset + Admin Overrides

-- Add extra quota fields to organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "extraConversationQuota" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "extraMessageQuota" INTEGER NOT NULL DEFAULT 0;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Index for audit_logs
CREATE INDEX IF NOT EXISTS "audit_logs_orgId_createdAt_idx" ON "audit_logs"("orgId", "createdAt");
