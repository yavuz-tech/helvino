-- CreateTable
CREATE TABLE "org_users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_users_email_key" ON "org_users"("email");

-- CreateIndex
CREATE INDEX "org_users_orgId_idx" ON "org_users"("orgId");

-- CreateIndex
CREATE INDEX "org_users_email_idx" ON "org_users"("email");

-- AddForeignKey
ALTER TABLE "org_users" ADD CONSTRAINT "org_users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
