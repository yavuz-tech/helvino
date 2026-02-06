import { prisma } from "../prisma";

export type PlanStatus = "active" | "inactive" | "past_due" | "canceled";

export interface EntitlementResult {
  allowed: boolean;
  error?: string;
  code?:
    | "SUBSCRIPTION_INACTIVE"
    | "LIMIT_CONVERSATIONS"
    | "LIMIT_MESSAGES"
    | "BILLING_BLOCKED";
  limit?: number;
  used?: number;
}

function getMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function getOrgAndPlan(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      planKey: true,
      planStatus: true,
      billingStatus: true,
      billingEnforced: true,
    },
  });

  if (!org) return null;

  const plan = await prisma.plan.findUnique({
    where: { key: org.planKey },
  });

  return { org, plan };
}

/**
 * Check whether the org's subscription status allows writes.
 * Free plan always allowed. Paid plans need active/trialing status.
 */
function isSubscriptionActive(org: {
  planKey: string;
  planStatus: string;
  billingStatus: string;
}): boolean {
  // Free plan is always active
  if (org.planKey === "free") return true;

  // Check billingStatus first (authoritative from Stripe)
  const activeStatuses = new Set(["active", "trialing", "none"]);
  if (activeStatuses.has(org.billingStatus)) return true;

  // Fallback: check planStatus
  if (org.planStatus === "active") return true;

  return false;
}

export async function checkConversationEntitlement(
  orgId: string
): Promise<EntitlementResult> {
  const result = await getOrgAndPlan(orgId);
  if (!result || !result.plan) {
    return { allowed: true };
  }

  const { org, plan } = result;

  // Check subscription status for paid plans
  if (!isSubscriptionActive(org)) {
    return {
      allowed: false,
      error: "Subscription inactive. Please upgrade or renew your plan.",
      code: "SUBSCRIPTION_INACTIVE",
    };
  }

  // Check plan limits
  const monthKey = getMonthKey();
  const usage = await prisma.usage.findUnique({
    where: { orgId_monthKey: { orgId, monthKey } },
  });
  const used = usage?.conversationsCreated || 0;

  if (used >= plan.maxConversationsPerMonth) {
    return {
      allowed: false,
      error: `Monthly conversation limit reached (${used}/${plan.maxConversationsPerMonth}). Upgrade your plan for more.`,
      code: "LIMIT_CONVERSATIONS",
      limit: plan.maxConversationsPerMonth,
      used,
    };
  }

  return { allowed: true };
}

export async function recordConversationUsage(orgId: string) {
  const monthKey = getMonthKey();
  await prisma.usage.upsert({
    where: { orgId_monthKey: { orgId, monthKey } },
    update: { conversationsCreated: { increment: 1 } },
    create: { orgId, monthKey, conversationsCreated: 1 },
  });
}

export async function checkMessageEntitlement(
  orgId: string
): Promise<EntitlementResult> {
  const result = await getOrgAndPlan(orgId);
  if (!result || !result.plan) {
    return { allowed: true };
  }

  const { org, plan } = result;

  if (!isSubscriptionActive(org)) {
    return {
      allowed: false,
      error: "Subscription inactive. Please upgrade or renew your plan.",
      code: "SUBSCRIPTION_INACTIVE",
    };
  }

  const monthKey = getMonthKey();
  const usage = await prisma.usage.findUnique({
    where: { orgId_monthKey: { orgId, monthKey } },
  });
  const used = usage?.messagesSent || 0;

  if (used >= plan.maxMessagesPerMonth) {
    return {
      allowed: false,
      error: `Monthly message limit reached (${used}/${plan.maxMessagesPerMonth}). Upgrade your plan for more.`,
      code: "LIMIT_MESSAGES",
      limit: plan.maxMessagesPerMonth,
      used,
    };
  }

  return { allowed: true };
}

export async function recordMessageUsage(orgId: string) {
  const monthKey = getMonthKey();
  await prisma.usage.upsert({
    where: { orgId_monthKey: { orgId, monthKey } },
    update: { messagesSent: { increment: 1 } },
    create: { orgId, monthKey, messagesSent: 1 },
  });
}

export async function getUsageForMonth(orgId: string) {
  const monthKey = getMonthKey();
  const usage = await prisma.usage.findUnique({
    where: { orgId_monthKey: { orgId, monthKey } },
  });

  return {
    monthKey,
    conversationsCreated: usage?.conversationsCreated || 0,
    messagesSent: usage?.messagesSent || 0,
  };
}

/**
 * Get the plan limits for an organization.
 */
export async function getPlanLimits(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { planKey: true },
  });

  if (!org) return null;

  const plan = await prisma.plan.findUnique({
    where: { key: org.planKey },
  });

  if (!plan) return null;

  return {
    planKey: plan.key,
    planName: plan.name,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    maxConversationsPerMonth: plan.maxConversationsPerMonth,
    maxMessagesPerMonth: plan.maxMessagesPerMonth,
    maxAgents: plan.maxAgents,
  };
}

/**
 * Get all available plans for display.
 */
export async function getAvailablePlans() {
  const plans = await prisma.plan.findMany({
    orderBy: { monthlyPriceUsd: "asc" },
  });

  return plans.map((p) => ({
    key: p.key,
    name: p.name,
    stripePriceId: p.stripePriceId,
    monthlyPriceUsd: p.monthlyPriceUsd,
    maxConversationsPerMonth: p.maxConversationsPerMonth,
    maxMessagesPerMonth: p.maxMessagesPerMonth,
    maxAgents: p.maxAgents,
  }));
}
