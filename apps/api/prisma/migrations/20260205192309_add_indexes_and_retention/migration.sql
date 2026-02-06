-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "hardDeleteOnRetention" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastRetentionRunAt" TIMESTAMP(3),
ADD COLUMN     "messageRetentionDays" INTEGER NOT NULL DEFAULT 365;

-- CreateIndex
CREATE INDEX "conversations_orgId_id_idx" ON "conversations"("orgId", "id");

-- CreateIndex
CREATE INDEX "messages_orgId_conversationId_timestamp_idx" ON "messages"("orgId", "conversationId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "visitors_orgId_lastSeenAt_idx" ON "visitors"("orgId", "lastSeenAt");
