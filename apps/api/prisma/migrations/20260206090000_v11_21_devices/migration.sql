-- Step 11.21: MFA Policy + Trusted Devices

CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "userAgentHash" TEXT NOT NULL,
    "label" TEXT,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastIp" TEXT,
    "userAgentRaw" TEXT,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trusted_devices_userId_userType_userAgentHash_key" ON "trusted_devices"("userId", "userType", "userAgentHash");
CREATE INDEX "trusted_devices_userId_userType_idx" ON "trusted_devices"("userId", "userType");
