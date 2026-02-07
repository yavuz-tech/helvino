-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "conversations" ADD COLUMN "assignedToOrgUserId" TEXT;
ALTER TABLE "conversations" ADD COLUMN "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "conversations_orgId_status_idx" ON "conversations"("orgId", "status");

-- CreateIndex
CREATE INDEX "conversations_assignedToOrgUserId_idx" ON "conversations"("assignedToOrgUserId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignedToOrgUserId_fkey" FOREIGN KEY ("assignedToOrgUserId") REFERENCES "org_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "conversation_notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorOrgUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_notes_orgId_conversationId_createdAt_idx" ON "conversation_notes"("orgId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_notes_conversationId_idx" ON "conversation_notes"("conversationId");

-- AddForeignKey
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_authorOrgUserId_fkey" FOREIGN KEY ("authorOrgUserId") REFERENCES "org_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
