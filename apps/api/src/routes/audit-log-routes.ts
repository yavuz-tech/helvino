/**
 * Audit Log Routes — Step 11.42
 *
 * Portal (org-scoped, portal auth):
 *   GET  /portal/audit-logs           — paginated list with filters
 *   GET  /portal/audit-logs/export.csv — CSV download
 *
 * Admin (admin auth):
 *   GET  /internal/audit-logs          — global list with filters + orgKey
 *   GET  /internal/metrics/audit-summary — last 24h summary
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser, requirePortalRole } from "../middleware/require-portal-user";
import { requireAdmin } from "../middleware/require-admin";

// ── Shared helpers ─────────────────────────────────

function parseLimit(raw?: string, max = 100, def = 25): number {
  const n = parseInt(raw || String(def), 10);
  if (isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}

/**
 * Action prefixes that must NEVER be exposed to portal (customer) users.
 * These are internal / security events meant only for the admin panel.
 */
const PORTAL_HIDDEN_ACTION_PREFIXES = [
  "security.",
  "admin.",
  "internal.",
  "portal_signup", // signup internals (re-signup, verification plumbing)
];

function buildWhere(orgId: string, q: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { orgId };
  if (q.action) where.action = { contains: q.action };
  if (q.actorUserId) where.actor = q.actorUserId;
  if (q.from || q.to) {
    const createdAt: Record<string, Date> = {};
    if (q.from) createdAt.gte = new Date(q.from);
    if (q.to) createdAt.lte = new Date(q.to);
    where.createdAt = createdAt;
  }
  return where;
}

/**
 * Returns a Prisma `NOT` clause that excludes rows whose `action`
 * starts with any of the hidden prefixes.  Used by portal endpoints only.
 */
function portalActionFilter(): Record<string, unknown>[] {
  return PORTAL_HIDDEN_ACTION_PREFIXES.map((prefix) => ({
    action: { startsWith: prefix },
  }));
}

interface AuditRow {
  id: string;
  createdAt: Date;
  action: string;
  actor: string;
  details: unknown;
}

function formatRow(e: AuditRow) {
  const details = (e.details && typeof e.details === "object") ? e.details as Record<string, unknown> : null;
  return {
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    action: e.action,
    actor: { id: e.actor, email: e.actor },
    ip: details?.ip ?? null,
    requestId: details?.requestId ?? null,
    meta: details,
  };
}

function escCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── Routes ─────────────────────────────────────────

export async function auditLogRoutes(fastify: FastifyInstance) {
  // ═════════════════════════════════════════════════
  // PORTAL: GET /portal/audit-logs
  // ═════════════════════════════════════════════════
  fastify.get<{
    Querystring: {
      limit?: string;
      cursor?: string;
      action?: string;
      from?: string;
      to?: string;
      actorUserId?: string;
    };
  }>(
    "/portal/audit-logs",
    { preHandler: [requirePortalUser, requirePortalRole(["owner", "admin"])] },
    async (request) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const user = request.portalUser!;
      const limit = parseLimit(request.query.limit);
      const where = buildWhere(user.orgId, request.query);

      const entries = await prisma.auditLog.findMany({
        where: {
          ...where,
          ...(request.query.cursor ? { id: { lt: request.query.cursor } } : {}),
          NOT: portalActionFilter(),
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });

      const hasMore = entries.length > limit;
      const items = (hasMore ? entries.slice(0, limit) : entries).map(formatRow);
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor, requestId };
    }
  );

  // ═════════════════════════════════════════════════
  // PORTAL: GET /portal/audit-logs/export.csv
  // ═════════════════════════════════════════════════
  fastify.get<{
    Querystring: {
      action?: string;
      from?: string;
      to?: string;
      actorUserId?: string;
    };
  }>(
    "/portal/audit-logs/export.csv",
    { preHandler: [requirePortalUser, requirePortalRole(["owner", "admin"])] },
    async (request, reply) => {
      const user = request.portalUser!;
      const where = buildWhere(user.orgId, request.query);

      const entries = await prisma.auditLog.findMany({
        where: {
          ...where,
          NOT: portalActionFilter(),
        },
        orderBy: { createdAt: "desc" },
        take: 5000, // cap at 5000 rows
      });

      const header = "createdAt,action,actor,ip,requestId,metaSummary\n";
      const rows = entries.map((e) => {
        const details = (e.details && typeof e.details === "object") ? e.details as Record<string, unknown> : {};
        const ip = details.ip ?? "";
        const rid = details.requestId ?? "";
        const metaKeys = Object.keys(details).filter((k) => k !== "ip" && k !== "requestId");
        const metaSummary = metaKeys.length > 0 ? metaKeys.join(";") : "";
        return [
          e.createdAt.toISOString(),
          e.action,
          e.actor,
          ip,
          rid,
          metaSummary,
        ].map(escCsv).join(",");
      }).join("\n");

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", "attachment; filename=audit-logs.csv");
      return header + rows;
    }
  );

  // ═════════════════════════════════════════════════
  // ADMIN: GET /internal/audit-logs
  // ═════════════════════════════════════════════════
  fastify.get<{
    Querystring: {
      limit?: string;
      cursor?: string;
      action?: string;
      from?: string;
      to?: string;
      actorUserId?: string;
      orgKey?: string;
      orgId?: string;
    };
  }>(
    "/internal/audit-logs",
    { preHandler: [requireAdmin] },
    async (request) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const limit = parseLimit(request.query.limit);

      // Build where — may or may not have orgId
      const where: Record<string, unknown> = {};

      if (request.query.orgId) {
        where.orgId = request.query.orgId;
      } else if (request.query.orgKey) {
        const org = await prisma.organization.findUnique({
          where: { key: request.query.orgKey },
          select: { id: true },
        });
        if (org) where.orgId = org.id;
        else return { items: [], nextCursor: undefined, requestId };
      }

      if (request.query.action) where.action = { contains: request.query.action };
      if (request.query.actorUserId) where.actor = request.query.actorUserId;
      if (request.query.from || request.query.to) {
        const createdAt: Record<string, Date> = {};
        if (request.query.from) createdAt.gte = new Date(request.query.from);
        if (request.query.to) createdAt.lte = new Date(request.query.to);
        where.createdAt = createdAt;
      }

      const entries = await prisma.auditLog.findMany({
        where: {
          ...where,
          ...(request.query.cursor ? { id: { lt: request.query.cursor } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });

      const hasMore = entries.length > limit;
      const items = (hasMore ? entries.slice(0, limit) : entries).map(formatRow);
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor, requestId };
    }
  );

  // ═════════════════════════════════════════════════
  // ADMIN: GET /internal/metrics/audit-summary
  // ═════════════════════════════════════════════════
  fastify.get(
    "/internal/metrics/audit-summary",
    { preHandler: [requireAdmin] },
    async (request) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentEntries = await prisma.auditLog.findMany({
        where: { createdAt: { gte: since } },
        select: { action: true },
      });

      // Count by action
      const actionCounts: Record<string, number> = {};
      for (const e of recentEntries) {
        actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
      }

      // Top N actions
      const byActionTopN = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      // Suspicious: security.* / rate_limited / untrusted_host / mfa_challenge_failed
      const suspiciousPatterns = [
        "security.", "rate_limited", "untrusted_host",
        "mfa_challenge_failed", "widget_health_spike",
      ];
      const suspiciousTopN = Object.entries(actionCounts)
        .filter(([action]) => suspiciousPatterns.some((p) => action.includes(p)))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count }));

      return {
        last24h: {
          total: recentEntries.length,
          byActionTopN,
        },
        suspiciousTopN,
        requestId,
      };
    }
  );
}
