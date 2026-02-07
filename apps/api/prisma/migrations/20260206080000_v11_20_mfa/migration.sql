-- Step 11.20: MFA (TOTP) + Step-Up Security

-- AdminUser MFA fields
ALTER TABLE "admin_users" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_users" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "admin_users" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);
ALTER TABLE "admin_users" ADD COLUMN "backupCodesHash" TEXT;

-- OrgUser MFA fields
ALTER TABLE "org_users" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "org_users" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "org_users" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);
ALTER TABLE "org_users" ADD COLUMN "backupCodesHash" TEXT;
