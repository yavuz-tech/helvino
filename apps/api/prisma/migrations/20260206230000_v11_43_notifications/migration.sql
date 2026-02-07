-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "type" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "bodyKey" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_orgId_createdAt_idx" ON "notifications"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_orgId_userId_readAt_idx" ON "notifications"("orgId", "userId", "readAt");
