-- Step 11.24: Account Recovery + Emergency Access

CREATE TABLE "account_recovery_requests" (
    "id" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "account_recovery_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_recovery_requests_userId_userType_idx" ON "account_recovery_requests"("userId", "userType");
CREATE INDEX "account_recovery_requests_status_idx" ON "account_recovery_requests"("status");

CREATE TABLE "emergency_access_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldownUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "emergency_access_tokens_tokenHash_key" ON "emergency_access_tokens"("tokenHash");
CREATE INDEX "emergency_access_tokens_userId_userType_idx" ON "emergency_access_tokens"("userId", "userType");
CREATE INDEX "emergency_access_tokens_tokenHash_idx" ON "emergency_access_tokens"("tokenHash");
