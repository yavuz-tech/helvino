-- AlterTable
ALTER TABLE "promotion_codes"
ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "promotion_codes_isGlobal_isActive_validFrom_validUntil_idx"
ON "promotion_codes"("isGlobal", "isActive", "validFrom", "validUntil");
