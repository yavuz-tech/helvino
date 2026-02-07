-- Step 11.19: Portal Session Security + Password Recovery

-- PasswordResetToken table
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_hashedToken_key" ON "password_reset_tokens"("hashedToken");
CREATE INDEX "password_reset_tokens_hashedToken_idx" ON "password_reset_tokens"("hashedToken");
CREATE INDEX "password_reset_tokens_orgUserId_idx" ON "password_reset_tokens"("orgUserId");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_orgUserId_fkey"
    FOREIGN KEY ("orgUserId") REFERENCES "org_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PortalSession table
CREATE TABLE "portal_sessions" (
    "id" TEXT NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portal_sessions_tokenHash_key" ON "portal_sessions"("tokenHash");
CREATE INDEX "portal_sessions_orgUserId_idx" ON "portal_sessions"("orgUserId");
CREATE INDEX "portal_sessions_tokenHash_idx" ON "portal_sessions"("tokenHash");

ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_orgUserId_fkey"
    FOREIGN KEY ("orgUserId") REFERENCES "org_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
