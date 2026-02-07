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
import { getUsageForMonth } from "../utils/entitlements";

export async function portalOrgRoutes(fastify: FastifyInstance) {
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
          planStatus: org.planStatus,
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
        },
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
   * GET /portal/conversations
   */
  fastify.get(
    "/portal/conversations",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const conversations = await store.listConversations(user.orgId);
      return conversations;
    }
  );

  /**
   * GET /portal/conversations/:id
   */
  fastify.get<{ Params: { id: string } }>(
    "/portal/conversations/:id",
    { preHandler: [requirePortalUser] },
    async (request, reply) => {
      const user = request.portalUser!;
      const conversation = await store.getConversationWithMessages(
        request.params.id,
        user.orgId
      );
      if (!conversation) {
        reply.code(404);
        return { error: "Conversation not found" };
      }
      return conversation;
    }
  );
}
