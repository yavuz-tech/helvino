-- Step 11.26: WebAuthn Challenge Store (DB-backed)

CREATE TABLE "webauthn_challenges" (
    "id" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "userId" TEXT,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webauthn_challenges_challenge_key" ON "webauthn_challenges"("challenge");
CREATE INDEX "webauthn_challenges_userId_userType_idx" ON "webauthn_challenges"("userId", "userType");
CREATE INDEX "webauthn_challenges_challenge_idx" ON "webauthn_challenges"("challenge");
