/**
 * Portal Dashboard API Routes
 *
 * Provides data for the main portal dashboard:
 * - Live/recent visitors
 * - Performance metrics
 * - Project status
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser, requirePortalRole } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { store } from "../store";

/**
 * Parse user-agent into human-readable browser + OS
 */
function parseUserAgent(ua: string | null | undefined): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "desktop" };

  let browser = "Unknown";
  let os = "Unknown";
  let device = "desktop";

  // Browser detection
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  // OS detection
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) { os = "Android"; device = "mobile"; }
  else if (ua.includes("iPhone") || ua.includes("iPad")) { os = "iOS"; device = "mobile"; }

  return { browser, os, device };
}

export async function portalDashboardRoutes(fastify: FastifyInstance) {
  /**
   * GET /portal/dashboard/visitors
   * Returns recent visitors + live count
   */
  fastify.get("/portal/dashboard/visitors", {
    preHandler: [requirePortalUser, requirePortalRole(["owner", "admin", "agent"]), createRateLimitMiddleware({ limit: 60, windowMs: 60000 })],
  }, async (request, reply) => {
    const user = (request as any).portalUser;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Live visitors (seen in last 5 minutes)
      const liveVisitors = await prisma.visitor.findMany({
        where: {
          orgId: user.orgId,
          lastSeenAt: { gte: fiveMinutesAgo },
        },
        select: {
          id: true,
          visitorKey: true,
          ip: true,
          country: true,
          city: true,
          userAgent: true,
          currentPage: true,
          referrer: true,
          firstSeenAt: true,
          lastSeenAt: true,
          _count: { select: { conversations: true } },
        },
        orderBy: { lastSeenAt: "desc" },
        take: 20,
      });

      // Recent visitors (last 24h, not live)
      const recentVisitors = await prisma.visitor.findMany({
        where: {
          orgId: user.orgId,
          lastSeenAt: { gte: oneDayAgo, lt: fiveMinutesAgo },
        },
        select: {
          id: true,
          visitorKey: true,
          ip: true,
          country: true,
          city: true,
          userAgent: true,
          currentPage: true,
          firstSeenAt: true,
          lastSeenAt: true,
          _count: { select: { conversations: true } },
        },
        orderBy: { lastSeenAt: "desc" },
        take: 20,
      });

      // Total visitor counts
      const [totalVisitors, todayVisitors, liveCount] = await Promise.all([
        prisma.visitor.count({ where: { orgId: user.orgId } }),
        prisma.visitor.count({ where: { orgId: user.orgId, lastSeenAt: { gte: oneDayAgo } } }),
        prisma.visitor.count({ where: { orgId: user.orgId, lastSeenAt: { gte: fiveMinutesAgo } } }),
      ]);

      // Parse user agents
      const formatVisitor = (
        v: {
          id: string;
          visitorKey: string;
          ip: string | null;
          country: string | null;
          city: string | null;
          userAgent: string | null;
          currentPage: string | null;
          referrer?: string | null;
          firstSeenAt: Date;
          lastSeenAt: Date;
          _count: { conversations: number };
        }
      ) => {
        const parsed = parseUserAgent(v.userAgent);
        return {
          id: v.id,
          visitorKey: v.visitorKey,
          ip: v.ip || null,
          country: v.country || null,
          city: v.city || null,
          browser: parsed.browser,
          os: parsed.os,
          device: parsed.device,
          currentPage: v.currentPage || null,
          referrer: v.referrer || null,
          firstSeenAt: v.firstSeenAt.toISOString(),
          lastSeenAt: v.lastSeenAt.toISOString(),
          conversationCount: v._count.conversations,
        };
      };

      return {
        live: liveVisitors.map(formatVisitor),
        recent: recentVisitors.map(formatVisitor),
        counts: {
          live: liveCount,
          today: todayVisitors,
          total: totalVisitors,
        },
      };
    } catch (err) {
      console.error("[Dashboard] Failed to fetch visitors:", err);
      return reply.code(500).send({ error: "Failed to fetch visitors" });
    }
  });

  /**
   * GET /portal/dashboard/stats
   * Returns dashboard performance metrics
   */
  fastify.get("/portal/dashboard/stats", {
    preHandler: [requirePortalUser, requirePortalRole(["owner", "admin", "agent"]), createRateLimitMiddleware({ limit: 60, windowMs: 60000 })],
  }, async (request, reply) => {
    const user = (request as any).portalUser;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Parallel queries
      const [
        org,
        usage,
        openConversations,
        closedConversations,
        todayMessages,
        weekMessages,
        aiMessages,
        avgResponseTime,
      ] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: user.orgId },
          select: {
            widgetEnabled: true,
            aiEnabled: true,
            widgetLoadsTotal: true,
            lastWidgetSeenAt: true,
            currentMonthAIMessages: true,
            aiMessagesLimit: true,
            planKey: true,
          },
        }),
        prisma.usage.findFirst({
          where: { orgId: user.orgId, monthKey },
          select: { conversationsCreated: true, messagesSent: true, m1Count: true, m2Count: true, m3Count: true },
        }),
        prisma.conversation.count({ where: { orgId: user.orgId, status: "OPEN" } }),
        prisma.conversation.count({ where: { orgId: user.orgId, status: "CLOSED" } }),
        prisma.message.count({ where: { orgId: user.orgId, timestamp: { gte: oneDayAgo } } }),
        prisma.message.count({ where: { orgId: user.orgId, timestamp: { gte: sevenDaysAgo } } }),
        prisma.message.count({ where: { orgId: user.orgId, isAIGenerated: true } }),
        prisma.message.aggregate({
          where: { orgId: user.orgId, isAIGenerated: true, aiResponseTime: { not: null } },
          _avg: { aiResponseTime: true },
        }),
      ]);

      return {
        conversations: {
          open: openConversations,
          closed: closedConversations,
          total: openConversations + closedConversations,
        },
        messages: {
          today: todayMessages,
          thisWeek: weekMessages,
          thisMonth: usage?.messagesSent || 0,
        },
        ai: {
          totalResponses: aiMessages,
          monthlyUsage: org?.currentMonthAIMessages || 0,
          monthlyLimit: org?.aiMessagesLimit || 100,
          avgResponseTimeMs: Math.round(avgResponseTime._avg.aiResponseTime || 0),
          enabled: org?.aiEnabled || false,
        },
        usage: {
          conversations: usage?.conversationsCreated || 0,
          messages: usage?.messagesSent || 0,
          humanConversations: usage?.m1Count || 0,
          aiResponses: usage?.m2Count || 0,
          visitorsReached: usage?.m3Count || 0,
        },
        widget: {
          enabled: org?.widgetEnabled || false,
          totalLoads: org?.widgetLoadsTotal || 0,
          lastSeen: org?.lastWidgetSeenAt?.toISOString() || null,
        },
        plan: org?.planKey || "FREE",
      };
    } catch (err) {
      console.error("[Dashboard] Failed to fetch stats:", err);
      return reply.code(500).send({ error: "Failed to fetch stats" });
    }
  });

  /**
   * POST /portal/dashboard/visitors/:visitorId/chat
   * Start or resume a conversation with a visitor from the portal
   * Returns the conversation ID to navigate to inbox
   */
  fastify.post<{ Params: { visitorId: string } }>("/portal/dashboard/visitors/:visitorId/chat", {
    preHandler: [requirePortalUser, requirePortalRole(["owner", "admin", "agent"]), createRateLimitMiddleware({ limit: 20, windowMs: 60000 })],
  }, async (request, reply) => {
    const user = (request as any).portalUser;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const { visitorId } = request.params;

    try {
      // Verify visitor belongs to this org
      const visitor = await prisma.visitor.findFirst({
        where: { id: visitorId, orgId: user.orgId },
        select: { id: true, visitorKey: true },
      });

      if (!visitor) return reply.code(404).send({ error: "Visitor not found" });

      // Check if there's an existing OPEN conversation with this visitor
      const existingConv = await prisma.conversation.findFirst({
        where: { orgId: user.orgId, visitorId: visitor.id, status: "OPEN" },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

      if (existingConv) {
        return { conversationId: existingConv.id, isNew: false };
      }

      // Create new conversation linked to this visitor
      const conv = await store.createConversation(user.orgId, visitor.id);

      // Auto-assign to the agent who initiated
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { assignedToOrgUserId: user.id },
      });

      return { conversationId: conv.id, isNew: true };
    } catch (err) {
      console.error("[Dashboard] Failed to start chat:", err);
      return reply.code(500).send({ error: "Failed to start conversation" });
    }
  });
}
