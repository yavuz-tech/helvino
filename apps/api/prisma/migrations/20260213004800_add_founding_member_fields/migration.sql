ALTER TABLE "organizations"
  ADD COLUMN "isFoundingMember" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "foundingMemberAt" TIMESTAMP(3);
