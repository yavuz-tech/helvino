-- Step 11.25: WebAuthn Credentials

CREATE TABLE "webauthn_credentials" (
    "id" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT,
    "aaguid" TEXT,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webauthn_credentials_credentialId_key" ON "webauthn_credentials"("credentialId");
CREATE INDEX "webauthn_credentials_userId_userType_idx" ON "webauthn_credentials"("userId", "userType");
CREATE INDEX "webauthn_credentials_credentialId_idx" ON "webauthn_credentials"("credentialId");
