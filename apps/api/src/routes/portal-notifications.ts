/**
 * Portal Notification Routes — Step 11.43 + 11.44
 *
 * GET  /portal/notifications              — paginated list (per-user read state)
 * GET  /portal/notifications/unread-count  — unread count (filtered by prefs)
 * POST /portal/notifications/:id/read     — mark one as read (per-user)
 * POST /portal/notifications/mark-all-read — mark all as read (per-user)
 * POST /portal/notifications/read-all     — alias for mark-all-read (backward compat)
 * GET  /portal/notifications/preferences  — user notification preferences
 * PUT  /portal/notifications/preferences  — update preferences
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser } from "../middleware/require-portal-user";
import { writeAuditLog } from "../utils/audit-log";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";

// ── Helpers ──────────────────────────────────────

/** Map notification type to preference field name */
function typeToPrefField(type: string): "securityEnabled" | "billingEnabled" | "widgetEnabled" | null {
  switch (type) {
    case "SECURITY": return "securityEnabled";
    case "BILLING": return "billingEnabled";
    case "WIDGET_HEALTH": return "widgetEnabled";
    default: return null; // SYSTEM etc. always shown
  }
}

/** Get user preferences (defaults to all enabled) */
async function getUserPrefs(orgUserId: string) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { orgUserId },
  });
  return {
    securityEnabled: pref?.securityEnabled ?? true,
    billingEnabled: pref?.billingEnabled ?? true,
    widgetEnabled: pref?.widgetEnabled ?? true,
  };
}

/** Build type filter based on preferences */
function buildTypeFilter(prefs: { securityEnabled: boolean; billingEnabled: boolean; widgetEnabled: boolean }) {
  const disabled: string[] = [];
  if (!prefs.securityEnabled) disabled.push("SECURITY");
  if (!prefs.billingEnabled) disabled.push("BILLING");
  if (!prefs.widgetEnabled) disabled.push("WIDGET_HEALTH");
  if (disabled.length === 0) return undefined;
  return { notIn: disabled };
}

// ── Routes ───────────────────────────────────────

export async function portalNotificationRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════
  // GET /portal/notifications
  // ═══════════════════════════════════════════════
  fastify.get<{
    Querystring: {
      limit?: string;
      cursor?: string;
      unreadOnly?: string;
      category?: string;
    };
  }>(
    "/portal/notifications",
    { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 60, windowMs: 60000 })] },
    async (request) => {
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;
      const user = request.portalUser!;
      const limit = Math.min(
        Math.max(parseInt(request.query.limit || "25", 10) || 25, 1),
        100
      );
      const unreadOnly = request.query.unreadOnly === "1";
      const category = request.query.category; // optional filter: "security" | "billing" | "widget" | "system"
      const prefs = await getUserPrefs(user.id);
      const typeFilter = buildTypeFilter(prefs);

      // Build where
      const where: Record<string, unknown> = {
        orgId: user.orgId,
        OR: [{ userId: null }, { userId: user.id }],
      };
      if (typeFilter) where.type = typeFilter;
      if (category) {
        // Map category to type field (API uses "type" but spec calls it "category")
        const typeMap: Record<string, string> = {
          security: "SECURITY",
          billing: "BILLING",
          widget: "WIDGET_HEALTH",
          system: "SYSTEM",
        };
        where.type = typeMap[category.toLowerCase()] || category.toUpperCase();
      }
      if (request.query.cursor) {
        where.id = { lt: request.query.cursor };
      }

      // For unreadOnly: only notifications WITHOUT a NotificationRead for this user
      if (unreadOnly) {
        where.reads = { none: { orgUserId: user.id } };
      }

      const [entries, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit + 1,
          include: {
            reads: {
              where: { orgUserId: user.id },
              select: { readAt: true },
              take: 1,
            },
          },
        }),
        prisma.notification.count({
          where: {
            orgId: user.orgId,
            OR: [{ userId: null }, { userId: user.id }],
            ...(typeFilter ? { type: typeFilter } : {}),
            reads: { none: { orgUserId: user.id } },
          },
        }),
      ]);

      const hasMore = entries.length > limit;
      const items = (hasMore ? entries.slice(0, limit) : entries).map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        severity: e.severity,
        type: e.type,
        category: e.type, // alias for backward compat
        sourceAction: e.sourceAction || undefined,
        titleKey: e.titleKey,
        bodyKey: e.bodyKey,
        meta: e.metaJson,
        readAt: e.reads.length > 0 ? e.reads[0].readAt.toISOString() : null,
      }));
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor, unreadCount, requestId };
    }
  );

  // ═══════════════════════════════════════════════
  // GET /portal/notifications/unread-count
  // ═══════════════════════════════════════════════
  fastify.get(
    "/portal/notifications/unread-count",
    { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 120, windowMs: 60000 })] },
    async (request) => {
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;
      const user = request.portalUser!;
      const prefs = await getUserPrefs(user.id);
      const typeFilter = buildTypeFilter(prefs);

      const unreadCount = await prisma.notification.count({
        where: {
          orgId: user.orgId,
          OR: [{ userId: null }, { userId: user.id }],
          ...(typeFilter ? { type: typeFilter } : {}),
          reads: { none: { orgUserId: user.id } },
        },
      });

      return { unreadCount, requestId };
    }
  );

  // ═══════════════════════════════════════════════
  // POST /portal/notifications/:id/read
  // ═══════════════════════════════════════════════
  fastify.post<{ Params: { id: string } }>(
    "/portal/notifications/:id/read",
    { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 120, windowMs: 60000 })] },
    async (request, reply) => {
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;
      const user = request.portalUser!;
      const { id } = request.params;

      // Verify notification belongs to this org and is visible to this user
      const notif = await prisma.notification.findFirst({
        where: {
          id,
          orgId: user.orgId,
          OR: [{ userId: null }, { userId: user.id }],
        },
      });

      if (!notif) {
        reply.code(404);
        return {
          error: { code: "NOT_FOUND", message: "Notification not found", requestId },
        };
      }

      // Upsert read state for this user
      await prisma.notificationRead.upsert({
        where: {
          notificationId_orgUserId: {
            notificationId: id,
            orgUserId: user.id,
          },
        },
        create: {
          notificationId: id,
          orgUserId: user.id,
        },
        update: {}, // already read, no-op
      });

      return { ok: true, requestId };
    }
  );

  // ═══════════════════════════════════════════════
  // POST /portal/notifications/mark-all-read
  // POST /portal/notifications/read-all (backward compat)
  // ═══════════════════════════════════════════════
  const markAllReadHandler = async (request: any) => {
    const requestId =
      request.requestId ||
      (request.headers["x-request-id"] as string) ||
      undefined;
    const user = request.portalUser!;
    const prefs = await getUserPrefs(user.id);
    const typeFilter = buildTypeFilter(prefs);

    // Find all unread notifications for this user
    const unreadNotifs = await prisma.notification.findMany({
      where: {
        orgId: user.orgId,
        OR: [{ userId: null }, { userId: user.id }],
        ...(typeFilter ? { type: typeFilter } : {}),
        reads: { none: { orgUserId: user.id } },
      },
      select: { id: true },
    });

    if (unreadNotifs.length > 0) {
      // Bulk create read records (skip duplicates)
      await prisma.notificationRead.createMany({
        data: unreadNotifs.map((n) => ({
          notificationId: n.id,
          orgUserId: user.id,
        })),
        skipDuplicates: true,
      });
    }

    return { ok: true, marked: unreadNotifs.length, requestId };
  };

  fastify.post(
    "/portal/notifications/mark-all-read",
    { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 20, windowMs: 60000 })] },
    markAllReadHandler
  );

  // Backward compat alias
  fastify.post(
    "/portal/notifications/read-all",
    { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 20, windowMs: 60000 })] },
    markAllReadHandler
  );

  // ═══════════════════════════════════════════════
  // GET /portal/notifications/preferences
  // ═══════════════════════════════════════════════
  fastify.get(
    "/portal/notifications/preferences",
    { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 60, windowMs: 60000 })] },
    async (request) => {
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;
      const user = request.portalUser!;
      const prefs = await getUserPrefs(user.id);

      return { ...prefs, requestId };
    }
  );

  // ═══════════════════════════════════════════════
  // PUT /portal/notifications/preferences
  // ═══════════════════════════════════════════════
  fastify.put<{
    Body: {
      securityEnabled?: boolean;
      billingEnabled?: boolean;
      widgetEnabled?: boolean;
    };
  }>(
    "/portal/notifications/preferences",
    {
      preHandler: [
        requirePortalUser,
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request) => {
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;
      const user = request.portalUser!;
      const { securityEnabled, billingEnabled, widgetEnabled } = request.body || {};

      const data: Record<string, boolean> = {};
      if (typeof securityEnabled === "boolean") data.securityEnabled = securityEnabled;
      if (typeof billingEnabled === "boolean") data.billingEnabled = billingEnabled;
      if (typeof widgetEnabled === "boolean") data.widgetEnabled = widgetEnabled;

      await prisma.notificationPreference.upsert({
        where: { orgUserId: user.id },
        create: {
          orgUserId: user.id,
          ...data,
        },
        update: data,
      });

      // Audit log (best-effort)
      writeAuditLog(
        user.orgId,
        user.email || user.id,
        "portal.notification_preferences.updated",
        { ...data, requestId },
        requestId
      ).catch(() => {});

      return { ok: true, requestId };
    }
  );
}
