-- Seed the plans table with default plans if they don't exist yet.
-- This ensures the widget and billing system work on fresh deploys
-- without requiring a manual `prisma db seed` step.

INSERT INTO "plans" ("id", "key", "name", "maxAgents", "maxConversationsPerMonth", "maxMessagesPerMonth", "maxAiMessagesPerMonth", "sortOrder", "monthlyPriceUsd", "yearlyPriceUsd", "monthlyPriceTry", "yearlyPriceTry")
VALUES
  ('plan_free',     'free',     'Free',     3,  200,  1000,   20, 0, 0,     0,     0,     0),
  ('plan_starter',  'starter',  'Starter',  5,  500,  3000,  100, 1, 2900,  27600, 14900, 142800),
  ('plan_pro',      'pro',      'Pro',     10, 2000, 10000,  500, 2, 7900,  75600, 39900, 382800),
  ('plan_business', 'business', 'Business', 50, 10000, 50000, 2000, 3, 19900, 190800, 99900, 958800)
ON CONFLICT ("key") DO NOTHING;
