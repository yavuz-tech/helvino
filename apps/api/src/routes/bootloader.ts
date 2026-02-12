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
import { isOriginAllowed, extractDomain, isLocalhost } from "../utils/domain-validation";
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
      bubbleShape: string;
      bubbleIcon: string;
      bubbleSize: number;
      bubblePosition: string;
      greetingText: string;
      greetingEnabled: boolean;
    };
    branding: {
      widgetName: string;
      widgetSubtitle: string;
      launcherText?: string | null;
      position?: string;
    };
    /** Server-enforced entitlement: true = branding must be shown */
    brandingRequired: boolean;
    /** Max team agents allowed by plan (server-authoritative) */
    maxAgents: number;
    /** true if request Origin/Referer doesn't match org's allowedDomains */
    unauthorizedDomain: boolean;
    widgetSettings?: {
      primaryColor: string;
      position: string;
      launcher: string;
      bubbleShape: string;
      bubbleIcon: string;
      bubbleSize: number;
      bubblePosition: string;
      greetingText: string;
      greetingEnabled: boolean;
      welcomeTitle: string;
      welcomeMessage: string;
      brandName: string | null;
    };
    chatPageConfig?: {
      title: string;
      subtitle: string;
      placeholder: string;
      showAgentAvatars: boolean;
      showOperatingHours: boolean;
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
    Querystring: { siteId?: string; orgKey?: string; parentHost?: string };
    Reply: BootloaderResponse | ErrorResponse;
  }>("/bootloader", async (request: FastifyRequest<{ Querystring: { siteId?: string; orgKey?: string; parentHost?: string } }>, reply: FastifyReply) => {
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
          planKey: true,
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
          allowedDomains: true,
          allowLocalhost: true,
        },
      });

      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      resolvedOrgId = org.id;

      // ── Domain allowlist check (soft mode: flag, don't block) ──
      const origin = request.headers.origin as string | undefined;
      const referer = request.headers.referer as string | undefined;
      const parentHost = request.query.parentHost;
      const requestOrigin = origin || referer;
      let unauthorizedDomain = false;

      // Check Origin/Referer against allowlist
      if (requestOrigin) {
        if (!isOriginAllowed(requestOrigin, org.allowedDomains, org.allowLocalhost)) {
          unauthorizedDomain = true;
        }
      }
      // If no Origin/Referer, check parentHost (iframe embed scenario)
      if (!unauthorizedDomain && parentHost && org.allowedDomains.length > 0) {
        const isLocalhostHost = isLocalhost(parentHost);
        if (!isLocalhostHost || !org.allowLocalhost) {
          const domainMatch = org.allowedDomains.some((pattern) => {
            if (pattern.startsWith("*.")) {
              const base = pattern.slice(2);
              return parentHost === base || parentHost.endsWith(`.${base}`);
            }
            return parentHost === pattern;
          });
          if (!domainMatch && !isLocalhostHost) {
            unauthorizedDomain = true;
          }
        }
      }

      // Track domain mismatch: counter + event log + last host/time (fire-and-forget) — Step 11.68
      if (unauthorizedDomain) {
        const reportedHost = parentHost || extractDomain(requestOrigin || "") || "unknown";
        const userAgent = request.headers["user-agent"] as string | undefined;
        const referrerHost = referer ? extractDomain(referer) : undefined;
        prisma.domainMismatchEvent
          .create({
            data: {
              orgId: org.id,
              reportedHost,
              allowedDomainsSnapshot: org.allowedDomains,
              userAgent: userAgent ?? null,
              referrerHost: referrerHost ?? null,
            },
          })
          .then(() =>
            prisma.organization.update({
              where: { id: org.id },
              data: {
                widgetDomainMismatchTotal: { increment: 1 },
                lastMismatchHost: reportedHost,
                lastMismatchAt: new Date(),
              },
            })
          )
          .catch(() => {});
        request.log.warn({ orgId: org.id, reportedHost, allowedDomains: org.allowedDomains }, "Domain mismatch detected (soft mode)");
      }

      // ── Plan lookup for entitlements ──
      const plan = await prisma.plan.findUnique({
        where: { key: org.planKey },
        select: { maxAgents: true },
      });
      const maxAgents = plan?.maxAgents ?? 1; // Default to 1 for safety

      // Branding entitlement: Free plan = branding required (cannot be removed)
      const brandingRequired = org.planKey === "free";

      // Load widget appearance settings (Step 11.52)
      const widgetSettings = await prisma.widgetSettings.findUnique({
        where: { orgId: org.id },
        select: {
          primaryColor: true,
          position: true,
          launcher: true,
          bubbleShape: true,
          bubbleIcon: true,
          bubbleSize: true,
          bubblePosition: true,
          greetingText: true,
          greetingEnabled: true,
          welcomeTitle: true,
          welcomeMessage: true,
          brandName: true,
        },
      });
      const chatPageConfig = await prisma.chatPageConfig.findUnique({
        where: { orgId: org.id },
        select: {
          title: true,
          subtitle: true,
          placeholder: true,
          showAgentAvatars: true,
          showOperatingHours: true,
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
      // SQL-safe: parameterized query
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
            // Use widget appearance color when available so launcher/bubble
            // always reflects what user saved in Widget Appearance.
            primaryColor: widgetSettings?.primaryColor || org.primaryColor,
            bubbleShape: widgetSettings?.bubbleShape || "circle",
            bubbleIcon: widgetSettings?.bubbleIcon || "chat",
            bubbleSize: widgetSettings?.bubbleSize || 60,
            bubblePosition: widgetSettings?.bubblePosition || (widgetSettings?.position === "left" ? "bottom-left" : "bottom-right"),
            greetingText: widgetSettings?.greetingText || "",
            greetingEnabled: widgetSettings?.greetingEnabled || false,
          },
          branding: {
            widgetName: org.widgetName, // From DB
            widgetSubtitle: org.widgetSubtitle, // From DB
            launcherText: org.launcherText, // From DB (nullable)
            position: org.position, // From DB
          },
          brandingRequired,
          maxAgents,
          unauthorizedDomain,
          // Widget appearance settings (Step 11.52)
          widgetSettings: widgetSettings || {
            primaryColor: "#0F5C5C",
            position: "right",
            launcher: "bubble",
            bubbleShape: "circle",
            bubbleIcon: "chat",
            bubbleSize: 60,
            bubblePosition: "bottom-right",
            greetingText: "",
            greetingEnabled: false,
            welcomeTitle: "Welcome",
            welcomeMessage: "How can we help you today?",
            brandName: null,
          },
          chatPageConfig: chatPageConfig || {
            title: "Chat with us",
            subtitle: "We reply as soon as possible",
            placeholder: "Write your message...",
            showAgentAvatars: true,
            showOperatingHours: true,
          },
        },
        orgToken, // Short-lived signed token (5 minutes)
        env: process.env.NODE_ENV ?? "dev",
        timestamp: new Date().toISOString(),
      };

      // Widget health: update response time histogram (fire-and-forget)
      const latencyMs = Date.now() - bootloaderStartMs;
      const { sql: histSql, params: histParams } = buildHistogramUpdateSql(org.id, latencyMs);
      // SQL-safe: parameterized query (built with placeholders in buildHistogramUpdateSql)
      prisma.$executeRawUnsafe(histSql, histParams[0], histParams[1]).catch(() => {});

      return response;
    } catch (err) {
      // Increment widgetLoadFailuresTotal if org was resolved (best-effort)
      if (resolvedOrgId) {
        // SQL-safe: parameterized query
        prisma.$executeRawUnsafe(
          `UPDATE "organizations" SET "widgetLoadFailuresTotal" = "widgetLoadFailuresTotal" + 1 WHERE "id" = $1`,
          resolvedOrgId
        ).catch(() => {});
      }
      throw err; // re-throw for Fastify error handler
    }
  });
}
