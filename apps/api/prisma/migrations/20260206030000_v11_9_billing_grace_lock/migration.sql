-- v11.9: Billing grace + lock tracking fields

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billingLockedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "lastPaymentFailureAt" TIMESTAMP(3);
