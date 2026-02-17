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
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { getRealIP } from "../utils/get-real-ip";

interface BootloaderResponse {
  ok: boolean;
  org: {
    id: string;
    key: string;
    name: string;
  };
  /** Monotonic-ish version for lightweight change detection (ms since epoch). */
  configVersion: number;
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
      // v3-ultimate extended settings (from configJson)
      [key: string]: unknown;
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

function isProPlan(planKey: string | null | undefined): boolean {
  const key = String(planKey || "free").toLowerCase();
  return key === "pro" || key === "business" || key === "enterprise";
}

function sanitizeWidgetSettingsForPlan<T extends Record<string, unknown>>(
  input: T,
  planKey: string | null | undefined
): T {
  if (isProPlan(planKey)) return input;
  // Keep the bootloader response consistent with portal save-gating.
  return {
    ...input,
    aiTone: "friendly",
    aiLength: "standard",
    aiModel: "auto",
    aiSuggestions: false,
  } as T;
}

export async function bootloaderRoutes(fastify: FastifyInstance) {
  const bootloaderRateLimit = createRateLimitMiddleware({
    limit: 120,
    windowMs: 60 * 1000,
    routeName: "api.bootloader",
    keyBuilder: (request) => {
      const query = request.query as { siteId?: string; orgKey?: string } | undefined;
      const siteId = (request.headers["x-site-id"] as string | undefined)?.trim() || query?.siteId;
      const orgKey = (request.headers["x-org-key"] as string | undefined)?.trim() || query?.orgKey;
      const realIp = getRealIP(request) || "unknown-ip";
      return `bootloader:${siteId || orgKey || "anonymous"}:${realIp}`;
    },
  });

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
  }>(
    "/bootloader",
    { preHandler: [bootloaderRateLimit] },
    async (
      request: FastifyRequest<{ Querystring: { siteId?: string; orgKey?: string; parentHost?: string } }>,
      reply: FastifyReply
    ) => {
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
          updatedAt: true,
        },
      });

      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      resolvedOrgId = org.id;

      // ── Domain allowlist check (soft mode: flag, don't block) ──
      // IMPORTANT: When allowedDomains is empty the widget MUST still render.
      // New orgs start with an empty list; blocking them would make the widget
      // invisible on first embed — the #1 cause of "widget doesn't show" bugs.
      const origin = request.headers.origin as string | undefined;
      const referer = request.headers.referer as string | undefined;
      const parentHost = request.query.parentHost;
      const requestOrigin = origin || referer;
      let unauthorizedDomain = false;

      // Helvion platform domains are always allowed — the widget demo on our
      // own site must never be blocked by a customer's domain allowlist.
      const PLATFORM_DOMAINS = ["app.helvion.io", "helvion.io", "www.helvion.io"];
      const originDomain = requestOrigin ? extractDomain(requestOrigin) : null;
      const isPlatformDomain =
        (originDomain && PLATFORM_DOMAINS.includes(originDomain)) ||
        (parentHost && PLATFORM_DOMAINS.includes(parentHost));

      // Only run the check when the org has explicitly configured domains
      // AND the request is NOT from the Helvion platform itself.
      // Empty list = "not configured yet" = allow everything (soft mode).
      if (org.allowedDomains.length > 0 && !isPlatformDomain) {
        // Check Origin/Referer against allowlist
        if (requestOrigin) {
          if (!isOriginAllowed(requestOrigin, org.allowedDomains, org.allowLocalhost)) {
            unauthorizedDomain = true;
          }
        }
        // If no Origin/Referer, check parentHost (iframe embed scenario)
        if (!unauthorizedDomain && parentHost) {
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

      // Load widget appearance settings (Step 11.52) — includes v3 configJson
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
          configJson: true,
          updatedAt: true,
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
          updatedAt: true,
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
      prisma
        .$executeRaw`UPDATE "organizations" SET "widgetLoadsTotal" = "widgetLoadsTotal" + 1, "lastWidgetSeenAt" = NOW() WHERE "id" = ${org.id}`
        .catch(() => {});

      // Build response with organization config from database
      const configVersion = Math.max(
        org.updatedAt.getTime(),
        widgetSettings?.updatedAt?.getTime() ?? 0,
        chatPageConfig?.updatedAt?.getTime() ?? 0
      );
      const response: BootloaderResponse = {
        ok: true,
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        configVersion,
        config: {
          widgetEnabled: org.widgetEnabled,
          writeEnabled: org.writeEnabled,
          aiEnabled: org.aiEnabled,
          language: org.language, // From DB
          theme: (() => {
            // Derive effective color from v3 configJson (themeId or customColor) when available
            const v3Config = (widgetSettings?.configJson as Record<string, unknown>) || {};
            const THEME_COLORS: Record<string, string> = {
              amber: "#F59E0B", ocean: "#0EA5E9", emerald: "#10B981", violet: "#8B5CF6",
              rose: "#F43F5E", slate: "#475569", teal: "#14B8A6", indigo: "#6366F1",
              sunset: "#F97316", aurora: "#06B6D4", midnight: "#1E293B", cherry: "#BE123C",
            };
            let effectiveColor = widgetSettings?.primaryColor || org.primaryColor;
            if (v3Config.useCustomColor === true && typeof v3Config.customColor === "string") {
              effectiveColor = v3Config.customColor;
            } else if (typeof v3Config.themeId === "string" && THEME_COLORS[v3Config.themeId]) {
              effectiveColor = THEME_COLORS[v3Config.themeId];
            }
            const effectivePosition = widgetSettings?.position === "left" ? "bottom-left" : "bottom-right";
            return {
              primaryColor: effectiveColor,
              bubbleShape: widgetSettings?.bubbleShape || "circle",
              bubbleIcon: widgetSettings?.bubbleIcon || "chat",
              bubbleSize: widgetSettings?.bubbleSize || 60,
              bubblePosition: widgetSettings?.bubblePosition || effectivePosition,
              greetingText: widgetSettings?.greetingText || "",
              greetingEnabled: widgetSettings?.greetingEnabled || false,
            };
          })(),
          branding: {
            widgetName: org.widgetName, // From DB
            widgetSubtitle: org.widgetSubtitle, // From DB
            launcherText: org.launcherText, // From DB (nullable)
            position: org.position, // From DB
          },
          brandingRequired,
          maxAgents,
          unauthorizedDomain,
          // Widget appearance settings (Step 11.52) — includes v3 extended config
          widgetSettings: widgetSettings
            ? sanitizeWidgetSettingsForPlan({
                primaryColor: widgetSettings.primaryColor,
                position: widgetSettings.position,
                launcher: widgetSettings.launcher,
                bubbleShape: widgetSettings.bubbleShape,
                bubbleIcon: widgetSettings.bubbleIcon,
                bubbleSize: widgetSettings.bubbleSize,
                bubblePosition: widgetSettings.bubblePosition,
                greetingText: widgetSettings.greetingText,
                greetingEnabled: widgetSettings.greetingEnabled,
                welcomeTitle: widgetSettings.welcomeTitle,
                welcomeMessage: widgetSettings.welcomeMessage,
                brandName: widgetSettings.brandName,
                // v3-ultimate extended config (theme, launcher style, starters, AI, etc.)
                ...((widgetSettings.configJson as Record<string, unknown>) || {}),
              }, org.planKey)
            : {
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
      const histSql = buildHistogramUpdateSql(org.id, latencyMs);
      prisma.$executeRaw(histSql).catch(() => {});

      return response;
    } catch (err) {
      // Increment widgetLoadFailuresTotal if org was resolved (best-effort)
      if (resolvedOrgId) {
        prisma
          .$executeRaw`UPDATE "organizations" SET "widgetLoadFailuresTotal" = "widgetLoadFailuresTotal" + 1 WHERE "id" = ${resolvedOrgId}`
          .catch(() => {});
      }
      throw err; // re-throw for Fastify error handler
    }
    }
  );

  /**
   * GET /api/bootloader/version
   *
   * Lightweight version check for live widget config updates.
   * Response is intentionally tiny (< 2KB) so widgets can poll it safely.
   */
  fastify.get<{
    Querystring: { siteId?: string; orgKey?: string; parentHost?: string };
    Reply: { ok: true; orgId: string; configVersion: number; timestamp: string } | ErrorResponse;
  }>(
    "/bootloader/version",
    { preHandler: [bootloaderRateLimit] },
    async (request, reply) => {
      const siteId = (request.headers["x-site-id"] as string) || request.query.siteId;
      const orgKey = (request.headers["x-org-key"] as string) || request.query.orgKey;

      if (!siteId && !orgKey) {
        reply.code(400);
        return { error: "siteId or orgKey required" };
      }

      const org = await prisma.organization.findUnique({
        where: siteId ? { siteId } : { key: orgKey },
        select: { id: true, updatedAt: true },
      });
      if (!org) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const ws = await prisma.widgetSettings.findUnique({
        where: { orgId: org.id },
        select: { updatedAt: true },
      });
      const cpc = await prisma.chatPageConfig.findUnique({
        where: { orgId: org.id },
        select: { updatedAt: true },
      });

      const configVersion = Math.max(
        org.updatedAt.getTime(),
        ws?.updatedAt?.getTime() ?? 0,
        cpc?.updatedAt?.getTime() ?? 0
      );

      return { ok: true, orgId: org.id, configVersion, timestamp: new Date().toISOString() };
    }
  );
}
