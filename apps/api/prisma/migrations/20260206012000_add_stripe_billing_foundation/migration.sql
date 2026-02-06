-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "billingEnforced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingGraceDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "billingStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "lastStripeEventAt" TIMESTAMP(3),
ADD COLUMN     "stripePriceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeSubscriptionId_key" ON "organizations"("stripeSubscriptionId");
