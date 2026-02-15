/**
 * Org Customer Routes (Customer Portal)
 * 
 * Org-scoped endpoints for customer users.
 * All routes require org user authentication via session cookie.
 * Data automatically scoped to session orgId (no multi-org access).
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { store } from "../store";
import { requireOrgUser } from "../middleware/require-org-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType, validateMessageContent } from "../middleware/validation";
import {
  checkMessageEntitlement,
  checkM1Entitlement,
  recordMessageUsage,
  recordM1Usage,
} from "../utils/entitlements";
import { isBillingWriteBlocked } from "../utils/billing-enforcement";
import { buildHistogramUpdateSql } from "../utils/widget-histogram";
import { validateBody } from "../utils/validate";
import { widgetSendMessageSchema } from "../utils/schemas";
import { sanitizeHTML, sanitizePlainText } from "../utils/sanitize";
import type {
  Conversation,
  ConversationDetail,
  CreateMessageRequest,
  CreateMessageResponse,
} from "../types";

export async function orgCustomerRoutes(fastify: FastifyInstance) {
  /**
   * GET /org/campaigns/active
   *
   * Return active premium campaign banner payload for org-app.
   */
  fastify.get("/org/campaigns/active", {
    preHandler: [requireOrgUser],
  }, async (request) => {
    const orgUser = request.orgUser!;
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: orgUser.orgId },
      select: { campaignsEnabled: true },
    });

    const now = new Date();
    const promo = await prisma.promoCode.findFirst({
      where: {
        isActive: true,
        validFrom: { lte: now },
        AND: [
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
          {
            OR: [
              { isGlobal: true },
              ...(settings?.campaignsEnabled ? [{ createdBy: orgUser.orgId, isGlobal: false }] : []),
            ],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
    });
    if (!promo) return { active: null };
    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      return { active: null };
    }

    return {
      active: {
        id: promo.id,
        code: promo.code,
        isGlobal: promo.isGlobal,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        bannerTitle: promo.bannerTitle || null,
        bannerSubtitle: promo.bannerSubtitle || null,
        validUntil: promo.validUntil?.toISOString() || null,
      },
    };
  });

  /**
   * GET /org/conversations
   * 
   * List conversations for authenticated org user's organization
   * Automatically scoped to session orgId
   */
  fastify.get("/org/conversations", {
    preHandler: [requireOrgUser],
  }, async (request, reply) => {
    const orgUser = request.orgUser!;

    const conversations = await store.listConversations(orgUser.orgId);

    return conversations;
  });

  /**
   * GET /org/conversations/:id
   * 
   * Get conversation detail with messages
   * Automatically scoped to session orgId
   */
  fastify.get<{ Params: { id: string } }>(
    "/org/conversations/:id",
    {
      preHandler: [requireOrgUser],
    },
    async (request, reply) => {
      const { id } = request.params;
      const orgUser = request.orgUser!;

      const conversation = await store.getConversationWithMessages(id, orgUser.orgId);

      if (!conversation) {
        reply.code(404);
        return { error: "Conversation not found" };
      }

      return conversation;
    }
  );

  /**
   * POST /org/conversations/:id/messages
   * 
   * Add message to conversation (agent reply from customer portal)
   * Automatically scoped to session orgId
   * Respects writeEnabled flag
   */
  fastify.post<{
    Params: { id: string };
    Body: CreateMessageRequest;
    Reply:
      | CreateMessageResponse
      | {
          error:
            | string
            | {
                code: string;
                message: string;
                resetAt?: string | null;
              };
          code?: string;
        };
  }>(
    "/org/conversations/:id/messages",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 120, windowMs: 60000 }), // 120 per minute
        requireOrgUser,
        validateJsonContentType,
        validateMessageContent,
      ],
    },
    async (request, reply) => {
      const msgStartMs = Date.now();
      const { id } = request.params;
      const parsedBody = validateBody(widgetSendMessageSchema, request.body, reply);
      if (!parsedBody) return;
      const { role, content } = parsedBody;
      const orgUser = request.orgUser!;
      const sanitizedContent = sanitizeHTML(content).trim();
      if (!sanitizedContent) {
        reply.code(400);
        return { error: "Message content is required" };
      }

      // Check writeEnabled flag for this org
      const org = await prisma.organization.findUnique({
        where: { id: orgUser.orgId },
        select: {
          writeEnabled: true,
          billingEnforced: true,
          billingStatus: true,
          billingGraceDays: true,
          currentPeriodEnd: true,
          lastStripeEventAt: true,
        },
      });

      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      if (!org.writeEnabled) {
        request.log.warn(
          { orgId: orgUser.orgId, writeEnabled: false },
          "Write operations disabled for organization"
        );
        reply.code(403);
        return {
          error: "Writes disabled",
          message: "Write operations are temporarily disabled for this organization.",
        };
      }

      if (isBillingWriteBlocked(org)) {
        reply.code(402);
        return { error: "payment_required" };
      }

      const entitlement = await checkMessageEntitlement(orgUser.orgId);
      if (!entitlement.allowed) {
        reply.code(402);
        return { error: entitlement.error || "Plan limit exceeded", code: entitlement.code };
      }

      if (role === "assistant") {
        const m1Entitlement = await checkM1Entitlement(orgUser.orgId);
        if (!m1Entitlement.allowed) {
          reply.code(402);
          return {
            error: {
              code: "QUOTA_M1_EXCEEDED",
              message: m1Entitlement.error || "M1 quota exceeded",
              resetAt: m1Entitlement.resetAt || null,
            },
          };
        }
      }

      const message = await store.addMessage(id, orgUser.orgId, role, sanitizedContent);

      if (!message) {
        reply.code(404);
        return { error: "Conversation not found" };
      }

      // Emit Socket.IO event to org room only
      fastify.io.to(`org:${orgUser.orgId}`).emit("message:new", {
        conversationId: id,
        message,
      });

      await recordMessageUsage(orgUser.orgId);
      if (role === "assistant") {
        recordM1Usage(orgUser.orgId).catch(() => {});
      }

      // Widget response-time histogram (fire-and-forget, best-effort)
      const msgDurationMs = Date.now() - msgStartMs;
      const histSql = buildHistogramUpdateSql(orgUser.orgId, msgDurationMs);
      prisma.$executeRaw(histSql).catch(() => {});

      reply.code(201);
      return message;
    }
  );

  /**
   * GET /org/settings
   * 
   * Get organization settings (customer portal)
   * Automatically scoped to session orgId
   */
  fastify.get("/org/settings", {
    preHandler: [requireOrgUser],
  }, async (request, reply) => {
    const orgUser = request.orgUser!;

    const org = await prisma.organization.findUnique({
      where: { id: orgUser.orgId },
      select: {
        id: true,
        key: true,
        name: true,
        widgetEnabled: true,
        writeEnabled: true,
        aiEnabled: true,
        primaryColor: true,
        widgetName: true,
        widgetSubtitle: true,
        language: true,
        launcherText: true,
        position: true,
        messageRetentionDays: true,
        hardDeleteOnRetention: true,
        lastRetentionRunAt: true,
      },
    });

    if (!org) {
      reply.code(404);
      return { error: "Organization not found" };
    }

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
        primaryColor: org.primaryColor,
        widgetName: org.widgetName,
        widgetSubtitle: org.widgetSubtitle,
        language: org.language,
        launcherText: org.launcherText,
        position: org.position,
        messageRetentionDays: org.messageRetentionDays,
        hardDeleteOnRetention: org.hardDeleteOnRetention,
        lastRetentionRunAt: org.lastRetentionRunAt?.toISOString() || null,
      },
    };
  });

  /**
   * PATCH /org/settings
   * 
   * Update organization settings (customer portal)
   * Automatically scoped to session orgId
   * Only owners can update settings
   */
  fastify.patch<{ Body: Record<string, any> }>(
    "/org/settings",
    {
      preHandler: [requireOrgUser],
    },
    async (request, reply) => {
      const orgUser = request.orgUser!;
      const updates = request.body;

      // Only owners can update settings
      if (orgUser.role !== "owner" && orgUser.role !== "admin") {
        reply.code(403);
        return { error: "Only owners and admins can update settings" };
      }

      // Build update data
      const updateData: any = {};

      if (updates.widgetName !== undefined) updateData.widgetName = sanitizePlainText(String(updates.widgetName));
      if (updates.widgetSubtitle !== undefined) updateData.widgetSubtitle = sanitizePlainText(String(updates.widgetSubtitle));
      if (updates.primaryColor !== undefined) updateData.primaryColor = updates.primaryColor;
      if (updates.language !== undefined) updateData.language = updates.language;
      if (updates.launcherText !== undefined) updateData.launcherText = sanitizePlainText(String(updates.launcherText));
      if (updates.position !== undefined) updateData.position = updates.position;

      // Note: Critical settings (widgetEnabled, writeEnabled, aiEnabled, retention)
      // are NOT editable by org users - only internal admins can change these

      const updatedOrg = await prisma.organization.update({
        where: { id: orgUser.orgId },
        data: updateData,
        select: {
          id: true,
          key: true,
          name: true,
          widgetEnabled: true,
          writeEnabled: true,
          aiEnabled: true,
          primaryColor: true,
          widgetName: true,
          widgetSubtitle: true,
          language: true,
          launcherText: true,
          position: true,
          messageRetentionDays: true,
          hardDeleteOnRetention: true,
          lastRetentionRunAt: true,
        },
      });

      return {
        org: {
          id: updatedOrg.id,
          key: updatedOrg.key,
          name: updatedOrg.name,
        },
        settings: {
          widgetEnabled: updatedOrg.widgetEnabled,
          writeEnabled: updatedOrg.writeEnabled,
          aiEnabled: updatedOrg.aiEnabled,
          primaryColor: updatedOrg.primaryColor,
          widgetName: updatedOrg.widgetName,
          widgetSubtitle: updatedOrg.widgetSubtitle,
          language: updatedOrg.language,
          launcherText: updatedOrg.launcherText,
          position: updatedOrg.position,
          messageRetentionDays: updatedOrg.messageRetentionDays,
          hardDeleteOnRetention: updatedOrg.hardDeleteOnRetention,
          lastRetentionRunAt: updatedOrg.lastRetentionRunAt?.toISOString() || null,
        },
      };
    }
  );

  /**
   * GET /org/security
   * 
   * Get security settings (customer portal)
   * Automatically scoped to session orgId
   */
  fastify.get("/org/security", {
    preHandler: [requireOrgUser],
  }, async (request, reply) => {
    const orgUser = request.orgUser!;

    const org = await prisma.organization.findUnique({
      where: { id: orgUser.orgId },
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
      reply.code(404);
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
  });

  /**
   * PATCH /org/security
   * 
   * Update security settings (customer portal)
   * Automatically scoped to session orgId
   * Only owners can update security settings
   */
  fastify.patch<{ Body: { allowedDomains?: string[]; allowLocalhost?: boolean } }>(
    "/org/security",
    {
      preHandler: [requireOrgUser],
    },
    async (request, reply) => {
      const orgUser = request.orgUser!;
      const { allowedDomains, allowLocalhost } = request.body;

      // Only owners can update security settings
      if (orgUser.role !== "owner") {
        reply.code(403);
        return { error: "Only organization owners can update security settings" };
      }

      const updateData: any = {};
      if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
      if (allowLocalhost !== undefined) updateData.allowLocalhost = allowLocalhost;

      const updatedOrg = await prisma.organization.update({
        where: { id: orgUser.orgId },
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

      request.log.info(
        {
          orgId: orgUser.orgId,
          orgKey: updatedOrg.key,
          changes: Object.keys(updateData),
        },
        "Org security settings updated by org user"
      );

      return {
        org: {
          id: updatedOrg.id,
          key: updatedOrg.key,
          name: updatedOrg.name,
        },
        security: {
          siteId: updatedOrg.siteId,
          allowedDomains: updatedOrg.allowedDomains,
          allowLocalhost: updatedOrg.allowLocalhost,
        },
      };
    }
  );
}
