-- CreateTable
CREATE TABLE "landing_widget_config" (
    "id" TEXT NOT NULL,
    "orgKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Merhaba! 👋 Size nasil yardimci olabilirim?',
    "primaryColor" TEXT NOT NULL DEFAULT '#F59E0B',
    "position" TEXT NOT NULL DEFAULT 'br',
    "aiAutoReply" BOOLEAN NOT NULL DEFAULT true,
    "aiProvider" TEXT NOT NULL DEFAULT 'gemini',
    "hoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "hoursJson" JSONB,
    "offlineMessage" TEXT NOT NULL DEFAULT 'Su an cevrimdisiyiz. Mesajinizi birakin, en kisa surede donelim.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_widget_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_widget_config_orgKey_key" ON "landing_widget_config"("orgKey");

