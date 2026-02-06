-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "visitorId" TEXT;

-- CreateTable
CREATE TABLE "visitors" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visitors_orgId_idx" ON "visitors"("orgId");

-- CreateIndex
CREATE INDEX "visitors_visitorKey_idx" ON "visitors"("visitorKey");

-- CreateIndex
CREATE UNIQUE INDEX "visitors_orgId_visitorKey_key" ON "visitors"("orgId", "visitorKey");

-- CreateIndex
CREATE INDEX "conversations_visitorId_idx" ON "conversations"("visitorId");

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "visitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
