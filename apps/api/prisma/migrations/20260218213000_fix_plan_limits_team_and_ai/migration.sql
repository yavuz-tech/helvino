-- Fix plan limits to match product rules:
-- - Team: Free allows total 3 users (1 owner + 2 members) -> maxAgents=2 (members excluding owner)
-- - Manual chat: unlimited on all plans -> maxConversationsPerMonth/maxMessagesPerMonth = -1
-- - AI messages per month: Free=200, Starter=500, Pro=2000, Business=unlimited (-1)

UPDATE "plans"
SET
  "maxAgents" = 2,
  "maxConversationsPerMonth" = -1,
  "maxMessagesPerMonth" = -1,
  "maxAiMessagesPerMonth" = 200
WHERE "key" = 'free';

UPDATE "plans"
SET
  "maxConversationsPerMonth" = -1,
  "maxMessagesPerMonth" = -1,
  "maxAiMessagesPerMonth" = 500
WHERE "key" = 'starter';

UPDATE "plans"
SET
  "maxConversationsPerMonth" = -1,
  "maxMessagesPerMonth" = -1,
  "maxAiMessagesPerMonth" = 2000
WHERE "key" = 'pro';

UPDATE "plans"
SET
  "maxConversationsPerMonth" = -1,
  "maxMessagesPerMonth" = -1,
  "maxAiMessagesPerMonth" = -1
WHERE "key" = 'business';

