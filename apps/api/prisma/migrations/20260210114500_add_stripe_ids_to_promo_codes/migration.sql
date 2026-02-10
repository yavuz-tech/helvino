-- AlterTable
ALTER TABLE "promotion_codes"
ADD COLUMN "stripeCouponId" TEXT,
ADD COLUMN "stripePromotionCodeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "promotion_codes_stripeCouponId_key" ON "promotion_codes"("stripeCouponId");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_codes_stripePromotionCodeId_key" ON "promotion_codes"("stripePromotionCodeId");
