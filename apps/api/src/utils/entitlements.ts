import { prisma } from "../prisma";

export type PlanStatus = "active" | "inactive" | "past_due" | "canceled";

export interface EntitlementResult {
  allowed: boolean;
  error?: string;
  code?:
    | "SUBSCRIPTION_INACTIVE"
    | "LIMIT_CONVERSATIONS"
    | "LIMIT_MESSAGES"
    | "BILLING_BLOCKED"
    | "TRIAL_EXPIRED";
  limit?: number;
  used?: number;
}

/* ── Trial lifecycle ── */

const TRIAL_DAYS = 14;

export interface TrialStatus {
  isTrialing: boolean;
  isExpired: boolean;
  daysLeft: number;
  endsAt: string | null;
  startedAt: string | null;
  recommendedPlan: string;
}

/**
 * Compute trial status for an organization.
 */
export function computeTrialStatus(org: {
  trialEndsAt?: Date | string | null;
  trialStartedAt?: Date | string | null;
  planKey: string;
  billingStatus: string;
  createdAt: Date | string;
}): TrialStatus {
  // If on a paid plan or has active subscription, trial is irrelevant
  if (org.planKey !== "free" && org.billingStatus === "active") {
    return {
      isTrialing: false,
      isExpired: false,
      daysLeft: 0,
      endsAt: null,
      startedAt: null,
      recommendedPlan: "pro",
    };
  }

  const now = new Date();
  const endsAt = org.trialEndsAt
    ? new Date(org.trialEndsAt)
    : new Date(new Date(org.createdAt).getTime() + TRIAL_DAYS * 86400000);
  const startedAt = org.trialStartedAt
    ? new Date(org.trialStartedAt)
    : new Date(org.createdAt);

  const daysLeft = Math.max(
    0,
    Math.ceil((endsAt.getTime() - now.getTime()) / 86400000)
  );
  const isExpired = now > endsAt;
  const isTrialing = !isExpired && org.planKey === "free";

  return {
    isTrialing,
    isExpired: isExpired && org.planKey === "free",
    daysLeft,
    endsAt: endsAt.toISOString(),
    startedAt: startedAt.toISOString(),
    recommendedPlan: "pro",
  };
}

/**
 * Check if an org's trial has expired and block writes if so.
 */
export async function checkTrialEntitlement(
  orgId: string
): Promise<EntitlementResult> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      planKey: true,
      billingStatus: true,
      trialEndsAt: true,
      trialStartedAt: true,
      createdAt: true,
    },
  });
  if (!org) return { allowed: true };

  // Only enforce on free plan orgs
  if (org.planKey !== "free") return { allowed: true };
  // If billing is active (e.g. stripe trialing), allow
  if (org.billingStatus === "active" || org.billingStatus === "trialing") {
    return { allowed: true };
  }

  const trial = computeTrialStatus(org);
  if (trial.isExpired) {
    return {
      allowed: false,
      error: "Your free trial has expired. Please upgrade to continue.",
      code: "TRIAL_EXPIRED",
    };
  }

  return { allowed: true };
}

/**
 * Recommend a plan based on org usage patterns.
 */
export async function getRecommendedPlan(orgId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) return "pro";

  const [usage, memberCount] = await Promise.all([
    getUsageForMonth(orgId),
    prisma.orgUser.count({ where: { orgId } }),
  ]);

  // Business: high usage or multi-user
  if (
    usage.conversationsCreated > 500 ||
    usage.messagesSent > 5000 ||
    memberCount > 3
  ) {
    return "business";
  }

  return "pro";
}

export function getMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get the next reset date for display purposes.
 * Uses org's currentPeriodEnd if available, otherwise first of next month (UTC).
 */
export function getNextResetDate(currentPeriodEnd?: Date | string | null): string {
  if (currentPeriodEnd) {
    return new Date(currentPeriodEnd).toISOString();
  }
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}

async function getOrgAndPlan(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      planKey: true,
      planStatus: true,
      billingStatus: true,
      billingEnforced: true,
      extraConversationQuota: true,
      extraMessageQuota: true,
      currentPeriodEnd: true,
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
  // Check trial lifecycle first (blocks writes for expired free trials)
  const trialCheck = await checkTrialEntitlement(orgId);
  if (!trialCheck.allowed) {
    return trialCheck;
  }

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

  // Check plan limits (plan base + extra quota from admin grants)
  const monthKey = getMonthKey();
  const usage = await prisma.usage.findUnique({
    where: { orgId_monthKey: { orgId, monthKey } },
  });
  const used = usage?.conversationsCreated || 0;
  const effectiveLimit = plan.maxConversationsPerMonth + (org.extraConversationQuota || 0);

  if (used >= effectiveLimit) {
    return {
      allowed: false,
      error: `Monthly conversation limit reached (${used}/${effectiveLimit}). Upgrade your plan for more.`,
      code: "LIMIT_CONVERSATIONS",
      limit: effectiveLimit,
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

  // Track conversion signal: first conversation (best-effort)
  prisma.organization
    .updateMany({
      where: { id: orgId, firstConversationAt: null },
      data: { firstConversationAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Record that an org's widget was embedded for the first time.
 */
export async function recordWidgetEmbed(orgId: string) {
  await prisma.organization
    .updateMany({
      where: { id: orgId, firstWidgetEmbedAt: null },
      data: { firstWidgetEmbedAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Record that an org sent its first invite.
 */
export async function recordFirstInvite(orgId: string) {
  await prisma.organization
    .updateMany({
      where: { id: orgId, firstInviteSentAt: null },
      data: { firstInviteSentAt: new Date() },
    })
    .catch(() => {});
}

export async function checkMessageEntitlement(
  orgId: string
): Promise<EntitlementResult> {
  // Check trial lifecycle first (blocks writes for expired free trials)
  const trialCheck = await checkTrialEntitlement(orgId);
  if (!trialCheck.allowed) {
    return trialCheck;
  }

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
  const effectiveLimit = plan.maxMessagesPerMonth + (org.extraMessageQuota || 0);

  if (used >= effectiveLimit) {
    return {
      allowed: false,
      error: `Monthly message limit reached (${used}/${effectiveLimit}). Upgrade your plan for more.`,
      code: "LIMIT_MESSAGES",
      limit: effectiveLimit,
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

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currentPeriodEnd: true },
  });

  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  return {
    monthKey,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    conversationsCreated: usage?.conversationsCreated || 0,
    messagesSent: usage?.messagesSent || 0,
    m1Count: usage?.m1Count ?? 0,
    m2Count: usage?.m2Count ?? 0,
    m3Count: usage?.m3Count ?? 0,
    nextResetDate: getNextResetDate(org?.currentPeriodEnd),
  };
}

/** M1: Human conversation (agent sent message). Call when portal/agent sends a message. */
export async function recordM1Usage(orgId: string) {
  const monthKey = getMonthKey();
  await prisma.usage.upsert({
    where: { orgId_monthKey: { orgId, monthKey } },
    update: { m1Count: { increment: 1 } },
    create: { orgId, monthKey, m1Count: 1 },
  });
}

/** M2: AI assisted response. Call when widget/API produces an AI reply. */
export async function recordM2Usage(orgId: string) {
  const monthKey = getMonthKey();
  await prisma.usage.upsert({
    where: { orgId_monthKey: { orgId, monthKey } },
    update: { m2Count: { increment: 1 } },
    create: { orgId, monthKey, m2Count: 1 },
  });
}

/** M3: Automations reached visitors (dedupe by orgId + periodKey + visitorKey). Call when automation touches a visitor. */
export async function recordM3Usage(orgId: string, visitorKey: string) {
  const periodKey = getMonthKey();
  const created = await prisma.usageVisitor
    .create({
      data: { orgId, periodKey, visitorKey, source: "M3" },
    })
    .then(() => true)
    .catch(() => false);
  if (created) {
    await prisma.usage.upsert({
      where: { orgId_monthKey: { orgId, monthKey: periodKey } },
      update: { m3Count: { increment: 1 } },
      create: { orgId, monthKey: periodKey, m3Count: 1 },
    });
  }
}

/**
 * Get the plan limits for an organization.
 */
export async function getPlanLimits(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      planKey: true,
      extraConversationQuota: true,
      extraMessageQuota: true,
    },
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
    maxConversationsPerMonth: plan.maxConversationsPerMonth + (org.extraConversationQuota || 0),
    maxMessagesPerMonth: plan.maxMessagesPerMonth + (org.extraMessageQuota || 0),
    maxAgents: plan.maxAgents,
    extraConversationQuota: org.extraConversationQuota || 0,
    extraMessageQuota: org.extraMessageQuota || 0,
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
