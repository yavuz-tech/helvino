import { prisma } from "../prisma";
import { isBillingWriteBlocked } from "./billing-enforcement";
import { t, type Locale } from "./api-i18n";
import { normalizeRequestLocale } from "./email-templates";
import {
  PLAN_AI_LIMITS,
  PLAN_M3_LIMITS,
  normalizePlanKey,
  type PlanKey,
} from "@helvino/shared";

export type PlanStatus = "active" | "inactive" | "past_due" | "canceled";

export interface EntitlementResult {
  allowed: boolean;
  error?: string;
  code?:
    | "SUBSCRIPTION_INACTIVE"
    | "LIMIT_CONVERSATIONS"
    | "LIMIT_MESSAGES"
    | "BILLING_BLOCKED"
    | "TRIAL_EXPIRED"
    | "QUOTA_M1_EXCEEDED"
    | "QUOTA_M2_EXCEEDED"
    | "QUOTA_M3_EXCEEDED";
  limit?: number | null;
  used?: number;
  resetAt?: string;
}

/* ── Trial lifecycle ── */

const TRIAL_DAYS = 14;

type MeteringLimit = number | null;

export interface MeteringLimits {
  m1LimitPerMonth: MeteringLimit;
  m2LimitPerMonth: MeteringLimit;
  m3LimitVisitorsPerMonth: MeteringLimit;
}

export function getMeteringLimitsForPlan(planKey: string): MeteringLimits {
  const k = normalizePlanKey(planKey);
  return {
    m1LimitPerMonth: null,
    m2LimitPerMonth: PLAN_AI_LIMITS[k],
    m3LimitVisitorsPerMonth: PLAN_M3_LIMITS[k],
  };
}


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
 *
 * Trial is only active when explicitly set via `trialEndsAt` or when
 * `billingStatus` is `"trialing"`.  Free-plan users without an explicit
 * trial are simply on the free tier — they are NOT trialing.
 */
export function computeTrialStatus(org: {
  trialEndsAt?: Date | string | null;
  trialStartedAt?: Date | string | null;
  planKey: string;
  billingStatus: string;
  createdAt: Date | string;
}): TrialStatus {
  const NO_TRIAL: TrialStatus = {
    isTrialing: false,
    isExpired: false,
    daysLeft: 0,
    endsAt: null,
    startedAt: null,
    recommendedPlan: "pro",
  };

  // If on a paid plan with active subscription, trial is irrelevant
  if (org.planKey !== "free" && org.billingStatus === "active") {
    return NO_TRIAL;
  }

  // Trial only applies when explicitly started (trialEndsAt set or billingStatus is "trialing").
  // Free-plan users without an explicit trial are NOT trialing — they are on the free tier.
  const hasExplicitTrial = !!org.trialEndsAt || org.billingStatus === "trialing";
  if (!hasExplicitTrial) {
    return NO_TRIAL;
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
  const isTrialing = !isExpired;

  return {
    isTrialing,
    isExpired,
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
      error: t("en", "plan.trialExpired"), // org language not available here; frontend translates via code
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

// Hardcoded free-plan fallback so the widget ALWAYS works even when the
// Plan table is empty (seed not run, fresh deploy, etc.).  This matches
// the values in prisma/seed.ts — keep them in sync.
const FREE_PLAN_FALLBACK = {
  id: "builtin-free",
  key: "free",
  name: "Free",
  stripePriceMonthlyUsd: null,
  stripePriceYearlyUsd: null,
  stripePriceMonthlyTry: null,
  stripePriceYearlyTry: null,
  monthlyPriceUsd: 0,
  yearlyPriceUsd: 0,
  monthlyPriceTry: 0,
  yearlyPriceTry: 0,
  // Team rule: total 3 users (1 owner + 2 members).
  // maxAgents counts "additional members besides the owner".
  maxAgents: 2,
  // Product rule: Free plan manual chat is unlimited.
  maxConversationsPerMonth: -1,
  maxMessagesPerMonth: -1,
  maxAiMessagesPerMonth: 200,
  sortOrder: 0,
} as const;

async function getOrgAndPlan(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      planKey: true,
      planStatus: true,
      billingStatus: true,
      billingEnforced: true,
      billingGraceDays: true,
      lastStripeEventAt: true,
      extraConversationQuota: true,
      extraMessageQuota: true,
      currentPeriodEnd: true,
      language: true,
    },
  });

  if (!org) return null;

  // SECURITY: Never treat "unknown planKey" as unlimited access.
  // If plan lookup fails, fall back to free plan limits (fail closed).
  const plan =
    (await prisma.plan.findUnique({ where: { key: org.planKey } })) ||
    (await prisma.plan.findUnique({ where: { key: "free" } })) ||
    FREE_PLAN_FALLBACK;

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
  billingEnforced: boolean;
  billingGraceDays: number;
  currentPeriodEnd: Date | string | null;
  lastStripeEventAt: Date | string | null;
}): boolean {
  // Free plan is always active
  if (org.planKey === "free") return true;

  // If billing isn't enforced (admin/manual org), don't block on Stripe status.
  if (!org.billingEnforced) return true;

  // Stripe-driven enforcement: allow if not currently write-blocked (active/trialing or within grace).
  return !isBillingWriteBlocked(org);
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
    return { allowed: false, error: t("en", "plan.configError"), code: "SUBSCRIPTION_INACTIVE" };
  }

  const { org } = result;

  // Check subscription status for paid plans
  if (!isSubscriptionActive(org)) {
    const loc = normalizeRequestLocale(org.language || undefined) as Locale;
    return {
      allowed: false,
      error: t(loc, "plan.subscriptionInactive"),
      code: "SUBSCRIPTION_INACTIVE",
    };
  }

  // Product rule:
  // Manual conversations are UNLIMITED on ALL plans — never block customer interactions.
  // We still track usage for analytics, but never hard-block.
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
    return { allowed: false, error: t("en", "plan.configError"), code: "SUBSCRIPTION_INACTIVE" };
  }

  const { org } = result;

  if (!isSubscriptionActive(org)) {
    const loc = normalizeRequestLocale(org.language || undefined) as Locale;
    return {
      allowed: false,
      error: t(loc, "plan.subscriptionInactive"),
      code: "SUBSCRIPTION_INACTIVE",
    };
  }

  // Product rule:
  // Manual messages are UNLIMITED on ALL plans — never block customer interactions.
  // We still track usage for analytics, but never hard-block.
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
    select: { currentPeriodEnd: true, planKey: true },
  });

  // Normalize metering counters so they never exceed plan limits.
  // This keeps portal displays stable and prevents "50 used / 20 limit" confusion.
  try {
    const metering = getMeteringLimitsForPlan(org?.planKey ?? "free");
    const m2LimitRaw = metering.m2LimitPerMonth;
    const m3LimitRaw = metering.m3LimitVisitorsPerMonth;
    const m2Limit = m2LimitRaw == null || m2LimitRaw <= 0 ? -1 : m2LimitRaw;
    const m3Limit = m3LimitRaw == null || m3LimitRaw <= 0 ? -1 : m3LimitRaw;

    if (m2Limit > 0) {
      await prisma.usage.updateMany({
        where: { orgId, monthKey, m2Count: { gt: m2Limit } },
        data: { m2Count: m2Limit },
      });
    }
    if (m3Limit > 0) {
      await prisma.usage.updateMany({
        where: { orgId, monthKey, m3Count: { gt: m3Limit } },
        data: { m3Count: m3Limit },
      });
    }
  } catch {
    // Never fail the usage endpoint for normalization issues.
  }

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
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { planKey: true },
  });
  const metering = getMeteringLimitsForPlan(org?.planKey ?? "free");
  const m2LimitRaw = metering.m2LimitPerMonth;
  const m2Limit = m2LimitRaw == null || m2LimitRaw <= 0 ? -1 : m2LimitRaw;

  // Unlimited: keep counting for analytics.
  if (m2Limit < 0) {
    await prisma.usage.upsert({
      where: { orgId_monthKey: { orgId, monthKey } },
      update: { m2Count: { increment: 1 } },
      create: { orgId, monthKey, m2Count: 1 },
    });
    return;
  }

  // Ensure row exists.
  await prisma.usage
    .create({ data: { orgId, monthKey, m2Count: 0 } })
    .catch(() => {});

  // HARD CAP (concurrency-safe): only increment while below limit.
  const res = await prisma.usage.updateMany({
    where: { orgId, monthKey, m2Count: { lt: m2Limit } },
    data: { m2Count: { increment: 1 } },
  });

  // If already at/over limit, clamp any overages.
  if (res.count === 0) {
    await prisma.usage.updateMany({
      where: { orgId, monthKey, m2Count: { gt: m2Limit } },
      data: { m2Count: m2Limit },
    });
  }
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

async function getOrgMeteringContext(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      planKey: true,
      currentPeriodEnd: true,
    },
  });
  if (!org) return null;
  const usage = await getUsageForMonth(orgId);
  const limits = getMeteringLimitsForPlan(org.planKey);
  return { org, usage, limits };
}

export async function checkM1Entitlement(orgId: string): Promise<EntitlementResult> {
  const ctx = await getOrgMeteringContext(orgId);
  if (!ctx) return { allowed: true };
  // Product rule: M1 (manual/human replies) is unlimited on ALL plans — never block.
  const used = ctx.usage.m1Count ?? 0;
  return { allowed: true, used, resetAt: ctx.usage.nextResetDate };
}

export async function checkM2Entitlement(orgId: string): Promise<EntitlementResult> {
  const ctx = await getOrgMeteringContext(orgId);
  if (!ctx) return { allowed: true };
  const used = ctx.usage.m2Count ?? 0;
  const limit = ctx.limits.m2LimitPerMonth;
  if (limit === null || limit <= 0) {
    return { allowed: true, limit: limit ?? undefined, used, resetAt: ctx.usage.nextResetDate };
  }
  if (used >= limit) {
    return {
      allowed: false,
      error: `M2 quota exceeded (${used}/${limit}).`,
      code: "QUOTA_M2_EXCEEDED",
      limit,
      used,
      resetAt: ctx.usage.nextResetDate,
    };
  }
  return { allowed: true, limit, used, resetAt: ctx.usage.nextResetDate };
}

export async function checkM3Entitlement(orgId: string): Promise<EntitlementResult> {
  const ctx = await getOrgMeteringContext(orgId);
  if (!ctx) return { allowed: true };
  const used = ctx.usage.m3Count ?? 0;
  const limit = ctx.limits.m3LimitVisitorsPerMonth;
  if (limit === null || limit <= 0) {
    return { allowed: true, limit: limit ?? undefined, used, resetAt: ctx.usage.nextResetDate };
  }
  if (used >= limit) {
    return {
      allowed: false,
      error: `M3 quota exceeded (${used}/${limit}).`,
      code: "QUOTA_M3_EXCEEDED",
      limit,
      used,
      resetAt: ctx.usage.nextResetDate,
    };
  }
  return { allowed: true, limit, used, resetAt: ctx.usage.nextResetDate };
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

  const plan =
    (await prisma.plan.findUnique({ where: { key: org.planKey } })) ||
    (await prisma.plan.findUnique({ where: { key: "free" } })) ||
    FREE_PLAN_FALLBACK;

  const metering = getMeteringLimitsForPlan(plan.key);

  // Product rule: Manual chat is unlimited on ALL plans.
  // Always return -1 for conversations/messages regardless of DB values.
  return {
    planKey: plan.key,
    planName: plan.name,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    maxConversationsPerMonth: -1,
    maxMessagesPerMonth: -1,
    maxAgents: plan.maxAgents,
    m1LimitPerMonth: metering.m1LimitPerMonth,
    m2LimitPerMonth: metering.m2LimitPerMonth,
    m3LimitVisitorsPerMonth: metering.m3LimitVisitorsPerMonth,
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

  const normalizePriceUsd = (v: number | null | undefined): number | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    // Some environments store USD prices in cents (e.g. 3900 for $39).
    // Normalize to dollars for the frontend price components.
    return v >= 1000 ? Math.round((v / 100) * 100) / 100 : v;
  };

  return plans.map((p) => ({
    key: p.key,
    name: p.name,
    // Legacy field for older consumers.
    stripePriceId: p.stripePriceMonthlyUsd || p.stripePriceYearlyUsd || null,
    monthlyPriceUsd: normalizePriceUsd(p.monthlyPriceUsd),
    // Product rule: manual chat is unlimited on ALL plans.
    maxConversationsPerMonth: -1,
    maxMessagesPerMonth: -1,
    maxAgents: p.maxAgents,
  }));
}
