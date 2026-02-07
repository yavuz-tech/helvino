-- Step 11.32: Trial lifecycle + conversion signals
ALTER TABLE "organizations" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "firstConversationAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "firstWidgetEmbedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "firstInviteSentAt" TIMESTAMP(3);
