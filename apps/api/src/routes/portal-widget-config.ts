/**
 * Portal Widget Config + Domain Allowlist Routes — Step 11.40
 *
 * GET    /portal/widget/config   — widget config + embed snippet + health
 * POST   /portal/widget/domains  — add domain to allowlist
 * DELETE  /portal/widget/domains  — remove domain from allowlist
 * PATCH  /portal/widget/config   — update widgetEnabled
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser, requirePortalRole } from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import { writeAuditLog } from "../utils/audit-log";
import { genericRateLimit } from "../utils/rate-limit";

const EMBED_CDN = process.env.EMBED_CDN_URL || "https://cdn.helvino.io";

// ── Domain validation ──────────────────────────────────

const DOMAIN_REGEX = /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
const LOCALHOST_VARIANTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
const isProduction = process.env.NODE_ENV === "production";

function normalizeDomain(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function validateDomain(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeDomain(raw);

  if (!normalized) {
    return { valid: false, normalized, error: "Domain cannot be empty" };
  }

  // Check for protocol
  if (/^https?:\/\//.test(raw.trim())) {
    return { valid: false, normalized, error: "Do not include protocol (http:// or https://)" };
  }

  // Check for path
  if (/\//.test(raw.trim())) {
    return { valid: false, normalized, error: "Do not include path" };
  }

  // Localhost check
  const domainWithoutPort = normalized.replace(/:\d+$/, "");
  if (LOCALHOST_VARIANTS.includes(domainWithoutPort)) {
    if (isProduction) {
      return { valid: false, normalized, error: "Localhost not allowed in production" };
    }
    return { valid: true, normalized: domainWithoutPort };
  }

  // Valid domain pattern
  if (!DOMAIN_REGEX.test(normalized)) {
    return { valid: false, normalized, error: "Invalid domain format. Example: example.com or *.example.com" };
  }

  return { valid: true, normalized };
}

// ── Rate limit preset ──
function widgetDomainRateLimit() {
  return genericRateLimit({
    limit: 20,
    windowMs: 60_000,
    routeName: "widget-domain",
  });
}

// ── Compute widget status (reused from widget-analytics) ──
function computeWidgetStatus(org: {
  firstWidgetEmbedAt: Date | null;
  lastWidgetSeenAt: Date | null;
  widgetLoadsTotal: number;
  widgetLoadFailuresTotal: number;
  widgetDomainMismatchTotal: number;
}): "OK" | "NEEDS_ATTENTION" | "NOT_CONNECTED" {
  if (!org.firstWidgetEmbedAt || !org.lastWidgetSeenAt) return "NOT_CONNECTED";
  const lastSeenAge = Date.now() - new Date(org.lastWidgetSeenAt).getTime();
  const olderThan24h = lastSeenAge > 24 * 60 * 60 * 1000;
  if (olderThan24h) return "NEEDS_ATTENTION";
  if (org.widgetDomainMismatchTotal > 0) return "NEEDS_ATTENTION";
  if (org.widgetLoadsTotal > 0 && org.widgetLoadFailuresTotal / org.widgetLoadsTotal >= 0.05) {
    return "NEEDS_ATTENTION";
  }
  return "OK";
}

export async function portalWidgetConfigRoutes(fastify: FastifyInstance) {
  // ─── GET /portal/widget/config ────────────────────────
  fastify.get(
    "/portal/widget/config",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const user = request.portalUser!;

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: {
          siteId: true,
          widgetEnabled: true,
          allowedDomains: true,
          allowLocalhost: true,
          lastWidgetSeenAt: true,
          firstWidgetEmbedAt: true,
          widgetLoadsTotal: true,
          widgetLoadFailuresTotal: true,
          widgetDomainMismatchTotal: true,
        },
      });

      if (!org) {
        return { error: { code: "NOT_FOUND", message: "Organization not found", requestId } };
      }

      const status = computeWidgetStatus(org);

      return {
        widgetEnabled: org.widgetEnabled,
        allowedDomains: org.allowedDomains,
        allowLocalhost: org.allowLocalhost,
        embedSnippet: {
          html: `<!-- Helvino Chat Widget -->\n<script>window.HELVINO_SITE_ID="${org.siteId}";</script>\n<script src="${EMBED_CDN}/embed.js"></script>`,
          scriptSrc: `${EMBED_CDN}/embed.js`,
          siteId: org.siteId,
        },
        lastWidgetSeenAt: org.lastWidgetSeenAt?.toISOString() || null,
        health: {
          status,
          failuresTotal: org.widgetLoadFailuresTotal,
          domainMismatchTotal: org.widgetDomainMismatchTotal,
        },
        requestId,
      };
    }
  );

  // ─── POST /portal/widget/domains ──────────────────────
  fastify.post<{ Body: { domain: string } }>(
    "/portal/widget/domains",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requireStepUp("portal"),
        widgetDomainRateLimit(),
      ],
    },
    async (request, reply) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const user = request.portalUser!;
      const { domain } = request.body || {};

      if (!domain || typeof domain !== "string") {
        reply.code(400);
        return { error: { code: "VALIDATION_ERROR", message: "domain is required", requestId } };
      }

      const validation = validateDomain(domain);
      if (!validation.valid) {
        reply.code(400);
        return { error: { code: "INVALID_DOMAIN", message: validation.error, requestId } };
      }

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { id: true, allowedDomains: true },
      });

      if (!org) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Organization not found", requestId } };
      }

      // Idempotent: skip if already in list
      if (org.allowedDomains.includes(validation.normalized)) {
        return { ok: true, allowedDomains: org.allowedDomains, requestId };
      }

      const updated = await prisma.organization.update({
        where: { id: user.orgId },
        data: { allowedDomains: { push: validation.normalized } },
        select: { allowedDomains: true },
      });

      writeAuditLog(
        user.orgId, user.email, "widget.domain.added",
        { domain: validation.normalized },
        requestId
      ).catch(() => {});

      return { ok: true, allowedDomains: updated.allowedDomains, requestId };
    }
  );

  // ─── DELETE /portal/widget/domains ────────────────────
  fastify.delete<{ Body: { domain: string } }>(
    "/portal/widget/domains",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requireStepUp("portal"),
        widgetDomainRateLimit(),
      ],
    },
    async (request, reply) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const user = request.portalUser!;
      const { domain } = request.body || {};

      if (!domain || typeof domain !== "string") {
        reply.code(400);
        return { error: { code: "VALIDATION_ERROR", message: "domain is required", requestId } };
      }

      const normalized = normalizeDomain(domain);

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { id: true, allowedDomains: true },
      });

      if (!org) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Organization not found", requestId } };
      }

      // Idempotent: skip if not in list
      if (!org.allowedDomains.includes(normalized)) {
        return { ok: true, allowedDomains: org.allowedDomains, requestId };
      }

      const newDomains = org.allowedDomains.filter((d) => d !== normalized);
      const updated = await prisma.organization.update({
        where: { id: user.orgId },
        data: { allowedDomains: newDomains },
        select: { allowedDomains: true },
      });

      writeAuditLog(
        user.orgId, user.email, "widget.domain.removed",
        { domain: normalized },
        requestId
      ).catch(() => {});

      return { ok: true, allowedDomains: updated.allowedDomains, requestId };
    }
  );

  // ─── PATCH /portal/widget/config ──────────────────────
  fastify.patch<{ Body: { widgetEnabled?: boolean } }>(
    "/portal/widget/config",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requireStepUp("portal"),
      ],
    },
    async (request, reply) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const user = request.portalUser!;
      const { widgetEnabled } = request.body || {};

      if (widgetEnabled === undefined) {
        reply.code(400);
        return { error: { code: "VALIDATION_ERROR", message: "widgetEnabled is required", requestId } };
      }

      if (typeof widgetEnabled !== "boolean") {
        reply.code(400);
        return { error: { code: "VALIDATION_ERROR", message: "widgetEnabled must be boolean", requestId } };
      }

      const updated = await prisma.organization.update({
        where: { id: user.orgId },
        data: { widgetEnabled },
        select: { widgetEnabled: true },
      });

      writeAuditLog(
        user.orgId, user.email, "widget.config.updated",
        { widgetEnabled: updated.widgetEnabled },
        requestId
      ).catch(() => {});

      return { ok: true, widgetEnabled: updated.widgetEnabled, requestId };
    }
  );

  // ─── Admin: GET /internal/orgs/:orgKey/widget/config ──
  fastify.get<{ Params: { orgKey: string } }>(
    "/internal/orgs/:orgKey/widget/config",
    { preHandler: [require("../middleware/require-admin").requireAdmin] },
    async (request) => {
      const requestId = (request as any).requestId || request.headers["x-request-id"] as string || undefined;
      const { orgKey } = request.params;

      const org = await prisma.organization.findUnique({
        where: { key: orgKey },
        select: {
          widgetEnabled: true,
          allowedDomains: true,
          allowLocalhost: true,
          lastWidgetSeenAt: true,
        },
      });

      if (!org) {
        return { error: { code: "NOT_FOUND", message: "Organization not found", requestId } };
      }

      const adminEmail = (request.session as unknown as Record<string, unknown>)?.adminEmail as string || "admin";
      writeAuditLog(
        orgKey, adminEmail, "admin.widget.config.read", {},
        requestId
      ).catch(() => {});

      return {
        widgetEnabled: org.widgetEnabled,
        allowedDomains: org.allowedDomains,
        allowLocalhost: org.allowLocalhost,
        lastWidgetSeenAt: org.lastWidgetSeenAt?.toISOString() || null,
        requestId,
      };
    }
  );
}
