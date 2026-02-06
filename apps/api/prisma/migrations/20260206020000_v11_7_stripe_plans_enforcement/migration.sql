-- v11.7: Add stripePriceId to Plan, trialEndsAt + lastStripeEventId to Organization

-- Plan: add Stripe Price ID mapping
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "plans_stripePriceId_key" ON "plans"("stripePriceId");

-- Organization: webhook idempotency + trial support
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "lastStripeEventId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
