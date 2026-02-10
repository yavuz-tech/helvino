ALTER TABLE "org_users"
ADD COLUMN "securityOnboardingShown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "securityOnboardingDismissedAt" TIMESTAMP(3);
