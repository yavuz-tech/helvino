-- Add billing fields to organizations
ALTER TABLE "organizations"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "planKey" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN "planStatus" TEXT NOT NULL DEFAULT 'inactive';

-- Create plans table
CREATE TABLE "plans" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "monthlyPriceUsd" INTEGER,
  "maxConversationsPerMonth" INTEGER NOT NULL,
  "maxMessagesPerMonth" INTEGER NOT NULL,
  "maxAgents" INTEGER NOT NULL,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- Create usages table
CREATE TABLE "usages" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "conversationsCreated" INTEGER NOT NULL DEFAULT 0,
  "messagesSent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usages_orgId_monthKey_key" ON "usages"("orgId", "monthKey");
CREATE INDEX "usages_orgId_idx" ON "usages"("orgId");

ALTER TABLE "usages"
  ADD CONSTRAINT "usages_orgId_fkey" FOREIGN KEY ("orgId")
  REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
