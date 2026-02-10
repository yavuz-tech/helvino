-- AlterTable
ALTER TABLE "org_users"
ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "account_unlock_tokens" (
    "id" TEXT NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_unlock_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_unlock_tokens_hashedToken_key" ON "account_unlock_tokens"("hashedToken");

-- CreateIndex
CREATE INDEX "account_unlock_tokens_orgUserId_idx" ON "account_unlock_tokens"("orgUserId");

-- CreateIndex
CREATE INDEX "account_unlock_tokens_hashedToken_idx" ON "account_unlock_tokens"("hashedToken");

-- CreateIndex
CREATE INDEX "login_attempts_email_idx" ON "login_attempts"("email");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_idx" ON "login_attempts"("ipAddress");

-- AddForeignKey
ALTER TABLE "account_unlock_tokens"
ADD CONSTRAINT "account_unlock_tokens_orgUserId_fkey"
FOREIGN KEY ("orgUserId") REFERENCES "org_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
