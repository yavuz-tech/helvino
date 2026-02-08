/**
 * Bootloader Endpoint
 * 
 * Public endpoint with no authentication.
 * Loads organization configuration from database.
 * 
 * Example usage:
 *   curl -H "x-org-key: demo" http://localhost:4000/api/bootloader
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import { validateDomainAllowlist } from "../middleware/domain-allowlist";
import { createOrgToken } from "../utils/org-token";
import { buildHistogramUpdateSql } from "../utils/widget-histogram";

interface BootloaderResponse {
  ok: boolean;
  org: {
    id: string;
    key: string;
    name: string;
  };
  config: {
    widgetEnabled: boolean;
    writeEnabled: boolean;
    aiEnabled: boolean;
    language: string;
    theme: {
      primaryColor: string;
    };
    branding: {
      widgetName: string;
      widgetSubtitle: string;
      launcherText?: string | null;
      position?: string;
    };
    /** Server-enforced entitlement: true = branding must be shown (free plan) */
    brandingRequired: boolean;
    widgetSettings?: {
      primaryColor: string;
      position: string;
      launcher: string;
      welcomeTitle: string;
      welcomeMessage: string;
      brandName: string | null;
    };
  };
  orgToken: string; // Short-lived signed token for write operations
  env: string;
  timestamp: string;
}

interface ErrorResponse {
  error: string;
}

export async function bootloaderRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/bootloader
   * 
   * Loads organization configuration from database.
   * No authentication required.
   * 
   * Headers (preferred):
   *   - x-site-id: Public site identifier (recommended)
   *   - x-org-key: Organization key (legacy support)
   * 
   * Query Parameters (alternative):
   *   - siteId: Public site identifier
   *   - orgKey: Organization key (legacy)
   * 
   * Response (200):
   *   {
   *     ok: true,
   *     org: { id, key, name },
   *     config: { widgetEnabled, aiEnabled, language, theme },
   *     orgToken: string,
   *     env: string,
   *     timestamp: string (ISO 8601)
   *   }
   * 
   * Error responses:
   *   - 400: Missing siteId or orgKey
   *   - 404: Organization not found
   *   - 403: Domain not allowed
   */
  fastify.get<{
    Querystring: { siteId?: string; orgKey?: string };
    Reply: BootloaderResponse | ErrorResponse;
  }>("/bootloader", {
    preHandler: [
      validateDomainAllowlist(), // Widget endpoint: enforce domain allowlist
    ],
  }, async (request: FastifyRequest<{ Querystring: { siteId?: string; orgKey?: string } }>, reply: FastifyReply) => {
    const bootloaderStartMs = Date.now();
    let resolvedOrgId: string | null = null;

    try {
      // Try to get identifier from headers (preferred) or query parameters
      const siteId = 
        (request.headers["x-site-id"] as string) || 
        request.query.siteId;
      
      const orgKey = 
        (request.headers["x-org-key"] as string) || 
        request.query.orgKey;

      // Must have either siteId (preferred) or orgKey (legacy)
      if (!siteId && !orgKey) {
        reply.code(400);
        return { error: "siteId or orgKey required" };
      }

      // Load organization from database
      // Prefer siteId lookup, fallback to key lookup (legacy)
      const org = await prisma.organization.findUnique({
        where: siteId ? { siteId } : { key: orgKey },
        select: {
          id: true,
          key: true,
          siteId: true,
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
          firstWidgetEmbedAt: true,
        },
      });

      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      resolvedOrgId = org.id;

      // Load widget appearance settings (Step 11.52)
      const widgetSettings = await prisma.widgetSettings.findUnique({
        where: { orgId: org.id },
        select: {
          primaryColor: true,
          position: true,
          launcher: true,
          welcomeTitle: true,
          welcomeMessage: true,
          brandName: true,
        },
      });

      // Generate short-lived signed token for widget operations
      const orgToken = createOrgToken({
        orgId: org.id,
        orgKey: org.key,
      });

      // Track conversion signal: widget embed (best-effort, fire-and-forget)
      if (org.firstWidgetEmbedAt == null) {
        prisma.organization
          .updateMany({
            where: { id: org.id, firstWidgetEmbedAt: null },
            data: { firstWidgetEmbedAt: new Date() },
          })
          .catch(() => {});
      }

      // Widget health metrics: increment load count + update lastSeenAt (fire-and-forget)
      prisma.$executeRawUnsafe(
        `UPDATE "organizations" SET "widgetLoadsTotal" = "widgetLoadsTotal" + 1, "lastWidgetSeenAt" = NOW() WHERE "id" = $1`,
        org.id
      ).catch(() => {});

      // Build response with organization config from database
      const response: BootloaderResponse = {
        ok: true,
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        config: {
          widgetEnabled: org.widgetEnabled,
          writeEnabled: org.writeEnabled,
          aiEnabled: org.aiEnabled,
          language: org.language, // From DB
          theme: {
            primaryColor: org.primaryColor, // From DB (has default)
          },
          branding: {
            widgetName: org.widgetName, // From DB
            widgetSubtitle: org.widgetSubtitle, // From DB
            launcherText: org.launcherText, // From DB (nullable)
            position: org.position, // From DB
          },
          // Server-enforced: Free plan always requires branding.
          // TODO: once plan model exists, derive from org.planKey !== 'free'
          brandingRequired: true,
          // Widget appearance settings (Step 11.52)
          widgetSettings: widgetSettings || {
            primaryColor: "#0F5C5C",
            position: "right",
            launcher: "bubble",
            welcomeTitle: "Welcome",
            welcomeMessage: "How can we help you today?",
            brandName: null,
          },
        },
        orgToken, // Short-lived signed token (5 minutes)
        env: process.env.NODE_ENV ?? "dev",
        timestamp: new Date().toISOString(),
      };

      // Widget health: update response time histogram (fire-and-forget)
      const latencyMs = Date.now() - bootloaderStartMs;
      const { sql: histSql, params: histParams } = buildHistogramUpdateSql(org.id, latencyMs);
      prisma.$executeRawUnsafe(histSql, histParams[0], histParams[1]).catch(() => {});

      return response;
    } catch (err) {
      // Increment widgetLoadFailuresTotal if org was resolved (best-effort)
      if (resolvedOrgId) {
        prisma.$executeRawUnsafe(
          `UPDATE "organizations" SET "widgetLoadFailuresTotal" = "widgetLoadFailuresTotal" + 1 WHERE "id" = $1`,
          resolvedOrgId
        ).catch(() => {});
      }
      throw err; // re-throw for Fastify error handler
    }
  });
}
