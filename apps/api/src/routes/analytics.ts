import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { getMeteringLimitsForPlan } from "../utils/entitlements";

type PlanLimitSet = {
  conversations: number;
  messages: number;
  aiMessages: number;
  automation: number;
  operators: number;
};

const PLAN_LIMITS: Record<string, PlanLimitSet> = {
  FREE: { conversations: 100, messages: 500, aiMessages: 50, automation: 100, operators: 2 },
  PRO: { conversations: 2000, messages: 20000, aiMessages: 1000, automation: 5000, operators: 5 },
  BUSINESS: { conversations: -1, messages: -1, aiMessages: 5000, automation: -1, operators: 15 },
};

function monthWindow(date: Date): { start: Date; end: Date; key: string } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, key };
}

function parsePeriod(period: string | undefined): { start: Date; end: Date; key: string } {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return monthWindow(new Date());
  }
  const [yearRaw, monthRaw] = period.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthWindow(new Date());
  }
  return monthWindow(new Date(Date.UTC(year, month - 1, 1)));
}

function resolvePlanLimits(planKey: string): PlanLimitSet {
  const normalized = planKey.trim().toUpperCase();
  if (normalized === "FREE") return PLAN_LIMITS.FREE;
  if (normalized === "BUSINESS" || normalized === "ENTERPRISE") return PLAN_LIMITS.BUSINESS;
  return PLAN_LIMITS.PRO;
}

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/analytics/usage",
    { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 60, windowMs: 60000 })] },
    async (request, reply) => {
      const portalUser = (request as any).portalUser!;
      const orgId: string = portalUser.orgId;
      const nowWindow = monthWindow(new Date());
      const prevWindow = monthWindow(new Date(Date.UTC(nowWindow.start.getUTCFullYear(), nowWindow.start.getUTCMonth() - 1, 1)));

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { planKey: true, planStatus: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const limits = resolvePlanLimits(org.planKey);
      const metering = getMeteringLimitsForPlan(org.planKey);
      const m2LimitRaw = metering.m2LimitPerMonth;
      const m2Limit = m2LimitRaw == null || m2LimitRaw <= 0 ? -1 : m2LimitRaw;
      const plan = await prisma.plan.findUnique({
        where: { key: org.planKey },
        select: { name: true, monthlyPriceUsd: true, key: true },
      });

      const [
        conversationsUsed,
        conversationsLastMonth,
        messagesUsed,
        messagesLastMonth,
        m2Now,
        m2Prev,
        automationReached,
        automationReachedLastMonth,
      ] = await Promise.all([
        prisma.conversation.count({
          where: { orgId, createdAt: { gte: nowWindow.start, lt: nowWindow.end } },
        }),
        prisma.conversation.count({
          where: { orgId, createdAt: { gte: prevWindow.start, lt: prevWindow.end } },
        }),
        prisma.message.count({
          where: { orgId, timestamp: { gte: nowWindow.start, lt: nowWindow.end } },
        }),
        prisma.message.count({
          where: { orgId, timestamp: { gte: prevWindow.start, lt: prevWindow.end } },
        }),
        prisma.usage.findUnique({
          where: { orgId_monthKey: { orgId, monthKey: nowWindow.key } },
          select: { m2Count: true },
        }),
        prisma.usage.findUnique({
          where: { orgId_monthKey: { orgId, monthKey: prevWindow.key } },
          select: { m2Count: true },
        }),
        prisma.usageVisitor.count({
          where: { orgId, periodKey: nowWindow.key },
        }),
        prisma.usageVisitor.count({
          where: { orgId, periodKey: prevWindow.key },
        }),
      ]);

      return {
        period: nowWindow.key,
        resetDate: nowWindow.end.toISOString(),
        conversations: {
          used: conversationsUsed,
          limit: limits.conversations,
          lastMonthUsed: conversationsLastMonth,
        },
        messages: {
          used: messagesUsed,
          limit: limits.messages,
          lastMonthUsed: messagesLastMonth,
        },
        aiMessages: {
          // IMPORTANT:
          // "AI supported (M2)" in the portal usage UI must match the same source as enforcement.
          // Enforcement uses `usage.m2Count` with `m2LimitPerMonth` (plan metering).
          used: m2Now?.m2Count ?? 0,
          limit: m2Limit,
          lastMonthUsed: m2Prev?.m2Count ?? 0,
        },
        automationReached: {
          used: automationReached,
          limit: limits.automation,
          lastMonthUsed: automationReachedLastMonth,
        },
        plan: {
          key: (plan?.key ?? org.planKey).toUpperCase(),
          name: plan?.name ?? org.planKey.toUpperCase(),
          price: plan?.monthlyPriceUsd ?? 0,
          status: org.planStatus || "inactive",
        },
      };
    }
  );

  fastify.get(
    "/api/analytics/export",
    { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 20, windowMs: 60000 })] },
    async (request, reply) => {
      const portalUser = (request as any).portalUser!;
      const orgId: string = portalUser.orgId;
      const q = (request.query ?? {}) as { format?: string; period?: string };
      const format = (q.format || "csv").toLowerCase();
      if (format !== "csv") {
        reply.code(400);
        return { error: "Only csv format is supported" };
      }
      if (q.period && String(q.period).length > 32) {
        reply.code(400);
        return { error: "Invalid period" };
      }

      const period = parsePeriod(q.period);
      const [conversationsUsed, messagesUsed, aiMessagesUsed] = await Promise.all([
        prisma.conversation.count({
          where: { orgId, createdAt: { gte: period.start, lt: period.end } },
        }),
        prisma.message.count({
          where: { orgId, timestamp: { gte: period.start, lt: period.end } },
        }),
        prisma.message.count({
          where: {
            orgId,
            timestamp: { gte: period.start, lt: period.end },
            OR: [{ isAIGenerated: true }, { aiProvider: { not: null } }],
          },
        }),
      ]);

      const csv = [
        "date,conversations,messages,aiMessages",
        `${period.key},${conversationsUsed},${messagesUsed},${aiMessagesUsed}`,
      ].join("\n");

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename=\"analytics-${period.key}.csv\"`);
      return csv;
    }
  );
}
