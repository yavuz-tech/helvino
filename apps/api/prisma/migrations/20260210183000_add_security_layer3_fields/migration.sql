ALTER TABLE "org_users"
ADD COLUMN "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "lastLoginCountry" TEXT,
ADD COLUMN "lastLoginCity" TEXT;

ALTER TABLE "portal_sessions"
ADD COLUMN "deviceFingerprint" TEXT,
ADD COLUMN "deviceId" TEXT,
ADD COLUMN "deviceName" TEXT,
ADD COLUMN "loginCountry" TEXT,
ADD COLUMN "loginCity" TEXT;
