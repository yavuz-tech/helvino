CREATE TABLE "password_reset_attempts" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "userAgent" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_attempts_email_idx" ON "password_reset_attempts"("email");
CREATE INDEX "password_reset_attempts_ipAddress_idx" ON "password_reset_attempts"("ipAddress");
CREATE INDEX "password_reset_attempts_createdAt_idx" ON "password_reset_attempts"("createdAt");
