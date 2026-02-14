-- Update Plan model for 4-tier pricing and multi-currency support
ALTER TABLE "plans"
  DROP COLUMN "stripePriceId",
  ADD COLUMN "stripePriceMonthlyUsd" TEXT,
  ADD COLUMN "stripePriceYearlyUsd" TEXT,
  ADD COLUMN "stripePriceMonthlyTry" TEXT,
  ADD COLUMN "stripePriceYearlyTry" TEXT,
  ADD COLUMN "yearlyPriceUsd" INTEGER,
  ADD COLUMN "monthlyPriceTry" INTEGER,
  ADD COLUMN "yearlyPriceTry" INTEGER,
  ADD COLUMN "maxAiMessagesPerMonth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Keep schema aligned (no DB default for maxAiMessagesPerMonth)
ALTER TABLE "plans"
  ALTER COLUMN "maxAiMessagesPerMonth" DROP DEFAULT;
