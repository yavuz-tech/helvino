/**
 * Portal Org Routes
 *
 * Org-scoped endpoints for the customer portal.
 * Org is inferred ONLY from portal session.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { store } from "../store";
import {
  requirePortalUser,
  requirePortalRole,
} from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import { generateSiteId } from "../utils/site-id";
import {
  getUsageForMonth,
  getMeteringLimitsForPlan,
} from "../utils/entitlements";
import { ALL_FEATURE_KEYS, FEATURE_MIN_PLAN, isPlanAllowedForFeature, type FeatureKey } from "@helvino/shared";

export async function portalOrgRoutes(fastify: FastifyInstance) {
  /**
   * GET /portal/org/features
   *
   * Single source of truth for plan gating on the frontend.
   * Frontend pages should use this instead of duplicating planKey checks.
   */
  fastify.get(
    "/portal/org/features",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { planKey: true },
      });

      const planKey = org?.planKey || "free";
      const features: Record<FeatureKey, boolean> = {} as Record<FeatureKey, boolean>;
      for (const key of ALL_FEATURE_KEYS) {
        features[key] = isPlanAllowedForFeature(planKey, key);
      }

      return {
        planKey,
        features,
        minPlan: FEATURE_MIN_PLAN,
      };
    }
  );

  /**
   * GET /portal/org/me
   */
  fastify.get(
    "/portal/org/me",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
      });

      if (!org) {
        return { error: "Organization not found" };
      }

      return {
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
          siteId: org.siteId,
          allowLocalhost: org.allowLocalhost,
          allowedDomains: org.allowedDomains,
          widgetEnabled: org.widgetEnabled,
          writeEnabled: org.writeEnabled,
          aiEnabled: org.aiEnabled,
          messageRetentionDays: org.messageRetentionDays,
          hardDeleteOnRetention: org.hardDeleteOnRetention,
          lastRetentionRunAt: org.lastRetentionRunAt?.toISOString() || null,
          planKey: org.planKey,
          planStatus: org.planKey === "free" ? "active" : org.planStatus,
        },
        usage: await getUsageForMonth(org.id),
      };
    }
  );

  /**
   * PATCH /portal/org/me/settings
   */
  fastify.patch(
    "/portal/org/me/settings",
    {
      preHandler: [requirePortalUser, requirePortalRole(["owner", "admin"])],
    },
    async (request, reply) => {
      const user = request.portalUser!;
      const body = request.body as {
        widgetEnabled?: boolean;
        writeEnabled?: boolean;
        aiEnabled?: boolean;
        messageRetentionDays?: number;
        hardDeleteOnRetention?: boolean;
      };

      const updateData: Record<string, unknown> = {};

      if (body.widgetEnabled !== undefined) {
        if (typeof body.widgetEnabled !== "boolean") {
          reply.code(400);
          return { error: "widgetEnabled must be boolean" };
        }
        updateData.widgetEnabled = body.widgetEnabled;
      }

      if (body.writeEnabled !== undefined) {
        if (typeof body.writeEnabled !== "boolean") {
          reply.code(400);
          return { error: "writeEnabled must be boolean" };
        }
        updateData.writeEnabled = body.writeEnabled;
      }

      if (body.aiEnabled !== undefined) {
        if (typeof body.aiEnabled !== "boolean") {
          reply.code(400);
          return { error: "aiEnabled must be boolean" };
        }
        updateData.aiEnabled = body.aiEnabled;
      }

      if (body.messageRetentionDays !== undefined) {
        if (
          typeof body.messageRetentionDays !== "number" ||
          body.messageRetentionDays < 1
        ) {
          reply.code(400);
          return { error: "messageRetentionDays must be >= 1" };
        }
        updateData.messageRetentionDays = body.messageRetentionDays;
      }

      if (body.hardDeleteOnRetention !== undefined) {
        if (typeof body.hardDeleteOnRetention !== "boolean") {
          reply.code(400);
          return { error: "hardDeleteOnRetention must be boolean" };
        }
        updateData.hardDeleteOnRetention = body.hardDeleteOnRetention;
      }

      const org = await prisma.organization.update({
        where: { id: user.orgId },
        data: updateData,
        select: {
          id: true,
          key: true,
          name: true,
          widgetEnabled: true,
          writeEnabled: true,
          aiEnabled: true,
          messageRetentionDays: true,
          hardDeleteOnRetention: true,
          lastRetentionRunAt: true,
        },
      });

      return {
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        settings: {
          widgetEnabled: org.widgetEnabled,
          writeEnabled: org.writeEnabled,
          aiEnabled: org.aiEnabled,
          messageRetentionDays: org.messageRetentionDays,
          hardDeleteOnRetention: org.hardDeleteOnRetention,
          lastRetentionRunAt: org.lastRetentionRunAt?.toISOString() || null,
        },
      };
    }
  );

  /**
   * GET /portal/org/me/security
   */
  fastify.get(
    "/portal/org/me/security",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: {
          id: true,
          key: true,
          name: true,
          siteId: true,
          allowedDomains: true,
          allowLocalhost: true,
          widgetDomainMismatchTotal: true,
          lastMismatchHost: true,
          lastMismatchAt: true,
        },
      });

      if (!org) {
        return { error: "Organization not found" };
      }

      return {
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        security: {
          siteId: org.siteId,
          allowedDomains: org.allowedDomains,
          allowLocalhost: org.allowLocalhost,
          domainMismatchCount: org.widgetDomainMismatchTotal ?? 0,
          lastMismatchHost: org.lastMismatchHost ?? null,
          lastMismatchAt: org.lastMismatchAt?.toISOString() ?? null,
        },
      };
    }
  );

  /**
   * GET /portal/org/me/alerts
   */
  fastify.get(
    "/portal/org/me/alerts",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: {
          id: true,
          planKey: true,
          writeEnabled: true,
          widgetEnabled: true,
          widgetDomainMismatchTotal: true,
          lastMismatchHost: true,
          lastMismatchAt: true,
        },
      });

      if (!org) {
        return { error: "Organization not found" };
      }

      const usage = await getUsageForMonth(org.id);
      const limits = getMeteringLimitsForPlan(org.planKey);
      const periodStart = usage.periodStart ? new Date(usage.periodStart) : new Date();

      const domainMismatchCountPeriod = await prisma.domainMismatchEvent.count({
        where: {
          orgId: org.id,
          createdAt: { gte: periodStart },
        },
      });

      const isNear = (used: number, limit: number | null) => {
        if (limit === null || limit <= 0) return false;
        return used / limit >= 0.8;
      };

      return {
        domainMismatchCountPeriod,
        lastMismatchHost: org.lastMismatchHost ?? null,
        lastMismatchAt: org.lastMismatchAt?.toISOString() ?? null,
        writeEnabled: org.writeEnabled,
        widgetEnabled: org.widgetEnabled,
        usageNearLimit: {
          m1: isNear(usage.m1Count ?? 0, limits.m1LimitPerMonth),
          m2: isNear(usage.m2Count ?? 0, limits.m2LimitPerMonth),
          m3: isNear(usage.m3Count ?? 0, limits.m3LimitVisitorsPerMonth),
        },
      };
    }
  );

  /**
   * GET /portal/org/me/security/domain-mismatches — last 20 domain mismatch events (Step 11.68)
   */
  fastify.get(
    "/portal/org/me/security/domain-mismatches",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const events = await prisma.domainMismatchEvent.findMany({
        where: { orgId: user.orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          reportedHost: true,
          allowedDomainsSnapshot: true,
          userAgent: true,
          referrerHost: true,
          createdAt: true,
        },
      });
      return {
        events: events.map((e) => ({
          id: e.id,
          reportedHost: e.reportedHost,
          allowedDomainsSnapshot: e.allowedDomainsSnapshot,
          userAgent: e.userAgent,
          referrerHost: e.referrerHost,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    }
  );

  /**
   * PATCH /portal/org/me/security
   */
  fastify.patch(
    "/portal/org/me/security",
    {
      preHandler: [requirePortalUser, requirePortalRole(["owner", "admin"]), requireStepUp("portal")],
    },
    async (request, reply) => {
      const user = request.portalUser!;
      const body = request.body as {
        allowedDomains?: string[];
        allowLocalhost?: boolean;
      };

      const updateData: Record<string, unknown> = {};
      if (body.allowedDomains !== undefined) {
        if (!Array.isArray(body.allowedDomains)) {
          reply.code(400);
          return { error: "allowedDomains must be an array" };
        }
        updateData.allowedDomains = body.allowedDomains;
      }
      if (body.allowLocalhost !== undefined) {
        if (typeof body.allowLocalhost !== "boolean") {
          reply.code(400);
          return { error: "allowLocalhost must be boolean" };
        }
        updateData.allowLocalhost = body.allowLocalhost;
      }

      const org = await prisma.organization.update({
        where: { id: user.orgId },
        data: updateData,
        select: {
          id: true,
          key: true,
          name: true,
          siteId: true,
          allowedDomains: true,
          allowLocalhost: true,
        },
      });

      return {
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        security: {
          siteId: org.siteId,
          allowedDomains: org.allowedDomains,
          allowLocalhost: org.allowLocalhost,
        },
      };
    }
  );

  /**
   * POST /portal/org/me/rotate-site-id
   */
  fastify.post(
    "/portal/org/me/rotate-site-id",
    {
      preHandler: [requirePortalUser, requirePortalRole(["owner"]), requireStepUp("portal")],
    },
    async (request, reply) => {
      const user = request.portalUser!;
      const body = request.body as { confirm?: string };

      if (body.confirm !== "ROTATE") {
        reply.code(400);
        return { error: "Confirmation required (type ROTATE)" };
      }

      let siteId: string | null = null;
      for (let i = 0; i < 10; i++) {
        const candidate = generateSiteId();
        const existing = await prisma.organization.findUnique({
          where: { siteId: candidate },
        });
        if (!existing) {
          siteId = candidate;
          break;
        }
      }

      if (!siteId) {
        reply.code(500);
        return { error: "Failed to generate unique siteId" };
      }

      const updated = await prisma.organization.update({
        where: { id: user.orgId },
        data: { siteId },
        select: {
          id: true,
          key: true,
          name: true,
          siteId: true,
          allowedDomains: true,
          allowLocalhost: true,
        },
      });

      return {
        ok: true,
        org: {
          id: updated.id,
          key: updated.key,
          name: updated.name,
        },
        security: {
          siteId: updated.siteId,
          allowedDomains: updated.allowedDomains,
          allowLocalhost: updated.allowLocalhost,
        },
      };
    }
  );

  /**
   * GET /portal/conversations — MOVED to portal-conversations.ts (Step 11.48)
   * The enhanced endpoint with filters/search/pagination is now in portal-conversations.ts
   */

  /**
   * GET /portal/conversations/:id — full detail with messages, status, assignedTo
   */
  fastify.get<{ Params: { id: string } }>(
    "/portal/conversations/:id",
    { preHandler: [requirePortalUser] },
    async (request, reply) => {
      const user = request.portalUser!;
      const conv = await prisma.conversation.findFirst({
        where: { id: request.params.id, orgId: user.orgId },
        include: {
          messages: { orderBy: { timestamp: "asc" as const } },
          assignedTo: { select: { id: true, email: true, role: true } },
        },
      });
      if (!conv) {
        reply.code(404);
        return { error: "Conversation not found" };
      }
      // Mark as read when agent opens conversation (so list reorders: unread at top)
      if (conv.hasUnreadFromUser) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { hasUnreadFromUser: false },
        });
      }
      return {
        id: conv.id,
        orgId: conv.orgId,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        messageCount: conv.messageCount,
        status: conv.status,
        assignedTo: conv.assignedTo ?? null,
        closedAt: conv.closedAt?.toISOString() ?? null,
        hasUnreadMessages: false,
        messages: conv.messages.map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          isAIGenerated: m.isAIGenerated,
          aiProvider: m.aiProvider,
          aiModel: m.aiModel,
        })),
      };
    }
  );
}
