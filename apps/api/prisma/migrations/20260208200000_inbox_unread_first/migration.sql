-- AlterTable: hasUnreadFromUser for inbox "unread first" ordering
ALTER TABLE "conversations" ADD COLUMN "hasUnreadFromUser" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "conversations_orgId_hasUnreadFromUser_idx" ON "conversations"("orgId", "hasUnreadFromUser");
