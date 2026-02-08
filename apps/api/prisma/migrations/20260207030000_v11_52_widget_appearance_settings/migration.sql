-- CreateTable
CREATE TABLE "widget_settings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0F5C5C',
    "position" TEXT NOT NULL DEFAULT 'right',
    "launcher" TEXT NOT NULL DEFAULT 'bubble',
    "welcomeTitle" VARCHAR(60) NOT NULL DEFAULT 'Welcome',
    "welcomeMessage" VARCHAR(240) NOT NULL DEFAULT 'How can we help you today?',
    "brandName" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widget_settings_orgId_key" ON "widget_settings"("orgId");

-- CreateIndex
CREATE INDEX "widget_settings_orgId_idx" ON "widget_settings"("orgId");
