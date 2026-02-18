import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { getMeteringLimitsForPlan, getPlanLimits } from "../utils/entitlements";

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

      const planLimits = await getPlanLimits(orgId);
      const metering = getMeteringLimitsForPlan(org.planKey);
      const m2LimitRaw = metering.m2LimitPerMonth;
      const m3LimitRaw = metering.m3LimitVisitorsPerMonth;
      const m2Limit = m2LimitRaw == null || m2LimitRaw <= 0 ? -1 : m2LimitRaw;
      const m3Limit = m3LimitRaw == null || m3LimitRaw <= 0 ? -1 : m3LimitRaw;

      const [
        conversationsUsed,
        conversationsLastMonth,
        messagesUsed,
        messagesLastMonth,
        usageNow,
        usagePrev,
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
        prisma.usage.findUnique({ where: { orgId_monthKey: { orgId, monthKey: nowWindow.key } }, select: { m2Count: true, m3Count: true } }),
        prisma.usage.findUnique({ where: { orgId_monthKey: { orgId, monthKey: prevWindow.key } }, select: { m2Count: true, m3Count: true } }),
      ]);

      return {
        period: nowWindow.key,
        resetDate: nowWindow.end.toISOString(),
        conversations: {
          used: conversationsUsed,
          limit: planLimits?.maxConversationsPerMonth ?? -1,
          lastMonthUsed: conversationsLastMonth,
        },
        messages: {
          used: messagesUsed,
          limit: planLimits?.maxMessagesPerMonth ?? -1,
          lastMonthUsed: messagesLastMonth,
        },
        aiMessages: {
          // IMPORTANT:
          // "AI supported (M2)" in the portal usage UI must match the same source as enforcement.
          // Enforcement uses `usage.m2Count` with `m2LimitPerMonth` (plan metering).
          used: m2Limit > 0 ? Math.min(usageNow?.m2Count ?? 0, m2Limit) : (usageNow?.m2Count ?? 0),
          limit: m2Limit,
          lastMonthUsed: usagePrev?.m2Count ?? 0,
        },
        automationReached: {
          used: m3Limit > 0 ? Math.min(usageNow?.m3Count ?? 0, m3Limit) : (usageNow?.m3Count ?? 0),
          limit: m3Limit,
          lastMonthUsed: usagePrev?.m3Count ?? 0,
        },
        plan: {
          key: (planLimits?.planKey ?? org.planKey).toUpperCase(),
          name: planLimits?.planName ?? org.planKey.toUpperCase(),
          price: planLimits?.monthlyPriceUsd ?? 0,
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
      const [conversationsUsed, messagesUsed, m2Usage] = await Promise.all([
        prisma.conversation.count({
          where: { orgId, createdAt: { gte: period.start, lt: period.end } },
        }),
        prisma.message.count({
          where: { orgId, timestamp: { gte: period.start, lt: period.end } },
        }),
        prisma.usage.findUnique({
          where: { orgId_monthKey: { orgId, monthKey: period.key } },
          select: { m2Count: true },
        }),
      ]);

      const csv = [
        "date,conversations,messages,aiMessages",
        `${period.key},${conversationsUsed},${messagesUsed},${m2Usage?.m2Count ?? 0}`,
      ].join("\n");

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename=\"analytics-${period.key}.csv\"`);
      return csv;
    }
  );
}
