/**
 * Admin Organization Directory Routes — Step 11.39
 *
 * GET  /internal/orgs/directory         — list all orgs with rich detail
 * GET  /internal/orgs/directory/:orgKey  — single org detail
 * POST /internal/orgs/:orgKey/deactivate — deactivate org (step-up required)
 * POST /internal/orgs/:orgKey/reactivate — reactivate org (step-up required)
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireAdmin, requireRole } from "../middleware/require-admin";
import { requireStepUp } from "../middleware/require-step-up";
import { writeAuditLog } from "../utils/audit-log";
import { getMonthKey, getUsageForMonth, getPlanLimits } from "../utils/entitlements";

export async function adminOrgDirectoryRoutes(fastify: FastifyInstance) {
  // ─── GET /internal/orgs/directory ─────────────────────
  // List all orgs with rich fields for admin directory
  fastify.get<{
    Querystring: { query?: string; limit?: string; cursor?: string };
  }>(
    "/internal/orgs/directory",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const { query, limit: limitStr, cursor } = request.query;
      const take = Math.min(Math.max(parseInt(limitStr || "50", 10) || 50, 1), 200);

      const where: Record<string, unknown> = {};
      if (query && query.trim()) {
        const q = query.trim();
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { key: { contains: q, mode: "insensitive" } },
        ];
      }

      const cursorObj = cursor ? { id: cursor } : undefined;

      const orgs = await prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: take + 1, // +1 for next cursor detection
        ...(cursorObj ? { cursor: cursorObj, skip: 1 } : {}),
        select: {
          id: true,
          key: true,
          name: true,
          siteId: true,
          isActive: true,
          createdVia: true,
          createdAt: true,
          planKey: true,
          billingStatus: true,
          trialEndsAt: true,
          trialStartedAt: true,
          lastWidgetSeenAt: true,
          ownerUserId: true,
          widgetLoadsTotal: true,
          widgetLoadFailuresTotal: true,
          orgUsers: {
            where: { role: "owner" },
            take: 1,
            select: { email: true },
          },
        },
      });

      const hasMore = orgs.length > take;
      const items = hasMore ? orgs.slice(0, take) : orgs;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      const result = items.map((o) => {
        // Trial status
        let trialStatus: "active" | "expired" | "none" = "none";
        if (o.trialStartedAt) {
          trialStatus = o.trialEndsAt && new Date(o.trialEndsAt) > new Date() ? "active" : "expired";
        }

        return {
          orgKey: o.key,
          displayName: o.name,
          isActive: o.isActive,
          createdVia: o.createdVia,
          createdAt: o.createdAt.toISOString(),
          planKey: o.planKey,
          billingStatus: o.billingStatus,
          trialStatus,
          ownerEmail: o.orgUsers[0]?.email || null,
          lastWidgetSeenAt: o.lastWidgetSeenAt?.toISOString() || null,
          usageSummary: {
            widgetLoads: o.widgetLoadsTotal,
            widgetFailures: o.widgetLoadFailuresTotal,
          },
        };
      });

      return {
        items: result,
        nextCursor,
        total: await prisma.organization.count({ where }),
        requestId,
      };
    }
  );

  // ─── GET /internal/orgs/directory/:orgKey ─────────────
  // Single org detail
  fastify.get<{ Params: { orgKey: string } }>(
    "/internal/orgs/directory/:orgKey",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const { orgKey } = request.params;

      const org = await prisma.organization.findUnique({
        where: { key: orgKey },
        include: {
          orgUsers: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              mfaEnabled: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!org) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Organization not found", requestId } };
      }

      // Get usage + limits
      let usage = null;
      let limits = null;
      try {
        [usage, limits] = await Promise.all([
          getUsageForMonth(org.id),
          getPlanLimits(org.id),
        ]);
      } catch { /* best effort */ }

      // Trial status
      let trialStatus: "active" | "expired" | "none" = "none";
      if (org.trialStartedAt) {
        trialStatus = org.trialEndsAt && new Date(org.trialEndsAt) > new Date() ? "active" : "expired";
      }

      // Audit log: admin accessed sensitive org data
      const adminEmail = (request as any).adminUser?.email || "admin";
      writeAuditLog(org.id, adminEmail, "admin.org.detail_viewed", { orgKey }, requestId).catch(() => {});

      return {
        orgKey: org.key,
        displayName: org.name,
        siteId: org.siteId,
        isActive: org.isActive,
        createdVia: org.createdVia,
        createdAt: org.createdAt.toISOString(),
        planKey: org.planKey,
        billingStatus: org.billingStatus,
        trialStatus,
        trialEndsAt: org.trialEndsAt?.toISOString() || null,
        lastWidgetSeenAt: org.lastWidgetSeenAt?.toISOString() || null,
        billingLockedAt: org.billingLockedAt?.toISOString() || null,
        allowedDomains: org.allowedDomains,
        allowLocalhost: org.allowLocalhost,
        widgetEnabled: org.widgetEnabled,
        writeEnabled: org.writeEnabled,
        aiEnabled: org.aiEnabled,
        ownerUserId: org.ownerUserId,
        ownerEmail: org.orgUsers.find((u) => u.role === "owner")?.email || null,
        users: org.orgUsers.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          emailVerified: !!u.emailVerifiedAt,
          mfaEnabled: u.mfaEnabled,
          lastLoginAt: u.lastLoginAt?.toISOString() || null,
          createdAt: u.createdAt.toISOString(),
        })),
        usage,
        limits,
        widgetHealth: {
          loadsTotal: org.widgetLoadsTotal,
          failuresTotal: org.widgetLoadFailuresTotal,
          domainMismatchTotal: org.widgetDomainMismatchTotal,
          lastSeenAt: org.lastWidgetSeenAt?.toISOString() || null,
        },
        requestId,
      };
    }
  );

  // ─── POST /internal/orgs/:orgKey/deactivate ──────────
  fastify.post<{ Params: { orgKey: string } }>(
    "/internal/orgs/:orgKey/deactivate",
    { preHandler: [requireAdmin, requireRole(["owner"]), requireStepUp("admin")] },
    async (request, reply) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const { orgKey } = request.params;

      const org = await prisma.organization.findUnique({
        where: { key: orgKey },
        select: { id: true, isActive: true },
      });

      if (!org) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Organization not found", requestId } };
      }

      if (!org.isActive) {
        return { ok: true, message: "Already deactivated", requestId };
      }

      await prisma.organization.update({
        where: { key: orgKey },
        data: { isActive: false },
      });

      const adminEmail = (request.session as unknown as Record<string, unknown>)?.adminEmail as string || "admin";
      writeAuditLog(org.id, adminEmail, "org.deactivated", { orgKey }, requestId).catch(() => {});

      return { ok: true, message: "Organization deactivated", requestId };
    }
  );

  // ─── POST /internal/orgs/:orgKey/reactivate ──────────
  fastify.post<{ Params: { orgKey: string } }>(
    "/internal/orgs/:orgKey/reactivate",
    { preHandler: [requireAdmin, requireRole(["owner"]), requireStepUp("admin")] },
    async (request, reply) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const { orgKey } = request.params;

      const org = await prisma.organization.findUnique({
        where: { key: orgKey },
        select: { id: true, isActive: true },
      });

      if (!org) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Organization not found", requestId } };
      }

      if (org.isActive) {
        return { ok: true, message: "Already active", requestId };
      }

      await prisma.organization.update({
        where: { key: orgKey },
        data: { isActive: true },
      });

      const adminEmail = (request.session as unknown as Record<string, unknown>)?.adminEmail as string || "admin";
      writeAuditLog(org.id, adminEmail, "org.reactivated", { orgKey }, requestId).catch(() => {});

      return { ok: true, message: "Organization reactivated", requestId };
    }
  );
}
