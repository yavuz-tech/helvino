-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "securityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "billingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "widgetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_notificationId_orgUserId_key" ON "notification_reads"("notificationId", "orgUserId");

-- CreateIndex
CREATE INDEX "notification_reads_orgUserId_readAt_idx" ON "notification_reads"("orgUserId", "readAt");

-- CreateIndex
CREATE INDEX "notification_reads_notificationId_idx" ON "notification_reads"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_orgUserId_key" ON "notification_preferences"("orgUserId");

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
