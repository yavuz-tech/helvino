-- DropIndex
DROP INDEX "promotion_codes_isGlobal_isActive_validFrom_validUntil_idx";

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "aiCost" DECIMAL(10,6),
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiProvider" TEXT,
ADD COLUMN     "aiResponseTime" INTEGER,
ADD COLUMN     "aiTokensUsed" INTEGER,
ADD COLUMN     "isAIGenerated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "aiConfigJson" JSONB,
ADD COLUMN     "aiMessagesLimit" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "aiMessagesResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "aiProvider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN     "currentMonthAIMessages" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "visitors" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "currentPage" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "referrer" TEXT;

-- AlterTable
ALTER TABLE "widget_settings" ADD COLUMN     "bubbleIcon" TEXT NOT NULL DEFAULT 'chat',
ADD COLUMN     "bubblePosition" TEXT NOT NULL DEFAULT 'bottom-right',
ADD COLUMN     "bubbleShape" TEXT NOT NULL DEFAULT 'circle',
ADD COLUMN     "bubbleSize" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "configJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "greetingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "greetingText" VARCHAR(120) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "operating_hours" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "offHoursAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "offHoursReplyText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_hours_days" (
    "id" TEXT NOT NULL,
    "operatingHoursId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_hours_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_configs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macros" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "macros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditionsJson" JSONB,
    "actionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default SLA',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "firstResponseMinutes" INTEGER NOT NULL DEFAULT 15,
    "resolutionMinutes" INTEGER NOT NULL DEFAULT 480,
    "warnThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_page_configs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Chat with us',
    "subtitle" TEXT NOT NULL DEFAULT 'We reply as soon as possible',
    "placeholder" TEXT NOT NULL DEFAULT 'Write your message...',
    "showAgentAvatars" BOOLEAN NOT NULL DEFAULT true,
    "showOperatingHours" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_page_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_overrides" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "translationKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operating_hours_orgId_key" ON "operating_hours"("orgId");

-- CreateIndex
CREATE INDEX "operating_hours_orgId_idx" ON "operating_hours"("orgId");

-- CreateIndex
CREATE INDEX "operating_hours_days_operatingHoursId_idx" ON "operating_hours_days"("operatingHoursId");

-- CreateIndex
CREATE UNIQUE INDEX "operating_hours_days_operatingHoursId_weekday_key" ON "operating_hours_days"("operatingHoursId", "weekday");

-- CreateIndex
CREATE INDEX "channel_configs_orgId_idx" ON "channel_configs"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_orgId_channelType_key" ON "channel_configs"("orgId", "channelType");

-- CreateIndex
CREATE INDEX "macros_orgId_enabled_idx" ON "macros"("orgId", "enabled");

-- CreateIndex
CREATE INDEX "workflow_rules_orgId_enabled_idx" ON "workflow_rules"("orgId", "enabled");

-- CreateIndex
CREATE INDEX "sla_policies_orgId_idx" ON "sla_policies"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_orgId_name_key" ON "sla_policies"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "chat_page_configs_orgId_key" ON "chat_page_configs"("orgId");

-- CreateIndex
CREATE INDEX "chat_page_configs_orgId_idx" ON "chat_page_configs"("orgId");

-- CreateIndex
CREATE INDEX "translation_overrides_orgId_locale_idx" ON "translation_overrides"("orgId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "translation_overrides_orgId_locale_translationKey_key" ON "translation_overrides"("orgId", "locale", "translationKey");

-- AddForeignKey
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operating_hours_days" ADD CONSTRAINT "operating_hours_days_operatingHoursId_fkey" FOREIGN KEY ("operatingHoursId") REFERENCES "operating_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_configs" ADD CONSTRAINT "channel_configs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macros" ADD CONSTRAINT "macros_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_page_configs" ADD CONSTRAINT "chat_page_configs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_overrides" ADD CONSTRAINT "translation_overrides_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
