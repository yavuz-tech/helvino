-- Step 11.18: Portal User Management (Invites + Roles)

-- Add isActive and lastLoginAt to org_users
ALTER TABLE "org_users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "org_users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Create portal_invites table
CREATE TABLE "portal_invites" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByPortalUserId" TEXT NOT NULL,

    CONSTRAINT "portal_invites_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "portal_invites_tokenHash_key" ON "portal_invites"("tokenHash");
CREATE UNIQUE INDEX "portal_invites_orgId_email_key" ON "portal_invites"("orgId", "email");

-- Indexes
CREATE INDEX "portal_invites_orgId_idx" ON "portal_invites"("orgId");
CREATE INDEX "portal_invites_tokenHash_idx" ON "portal_invites"("tokenHash");

-- Foreign key: portal_invites.createdByPortalUserId -> org_users.id
ALTER TABLE "portal_invites" ADD CONSTRAINT "portal_invites_createdByPortalUserId_fkey" FOREIGN KEY ("createdByPortalUserId") REFERENCES "org_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
