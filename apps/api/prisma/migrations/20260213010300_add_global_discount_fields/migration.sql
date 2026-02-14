ALTER TABLE "organization_settings"
  ADD COLUMN "globalDiscountPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "globalDiscountActive" BOOLEAN NOT NULL DEFAULT false;
