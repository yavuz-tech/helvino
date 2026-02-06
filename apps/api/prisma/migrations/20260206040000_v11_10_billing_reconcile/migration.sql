-- v11.10: Billing reconcile tracking fields

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "lastBillingReconcileAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "lastBillingReconcileResult" JSONB;
