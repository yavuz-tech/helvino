/**
 * Portal Widget Settings Routes — Step 11.52
 *
 * GET  /portal/widget/settings - Get widget appearance settings
 * PUT  /portal/widget/settings - Update widget appearance settings
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { rateLimit } from "../middleware/rate-limiter";
import { requirePortalUser } from "../middleware/require-portal-user";
import { writeAuditLog } from "../utils/audit-log";
import { sanitizePlainText } from "../utils/sanitize";

interface WidgetSettingsUpdateBody {
  primaryColor?: string;
  position?: "right" | "left";
  launcher?: "bubble" | "icon";
  bubbleShape?: "circle" | "rounded-square";
  bubbleIcon?: "chat" | "message" | "help" | "custom";
  bubbleSize?: number;
  bubblePosition?: "bottom-right" | "bottom-left";
  greetingText?: string;
  greetingEnabled?: boolean;
  welcomeTitle?: string;
  welcomeMessage?: string;
  brandName?: string | null;
}

// Validation helpers
function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
}

function getDefaultSettings() {
  return {
    primaryColor: "#0F5C5C",
    position: "right" as const,
    launcher: "bubble" as const,
    bubbleShape: "circle" as const,
    bubbleIcon: "chat" as const,
    bubbleSize: 60,
    bubblePosition: "bottom-right" as const,
    greetingText: "",
    greetingEnabled: false,
    welcomeTitle: "Welcome",
    welcomeMessage: "How can we help you today?",
    brandName: null,
  };
}

export async function portalWidgetSettingsRoutes(fastify: FastifyInstance) {
  const portalSettingsWriteRateLimit = rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: "Too many settings update requests",
    keyBuilder: (request) => request.portalUser?.id || "anonymous-user",
  });

  /**
   * GET /portal/widget/settings
   * Returns widget appearance settings for the org (defaults if not set)
   */
  fastify.get(
    "/portal/widget/settings",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 100, windowMs: 60000 }),
        requirePortalUser,
      ],
    },
    async (request, reply) => {
      const portalUser = (request as any).portalUser;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (!portalUser) {
        reply.code(401);
        return { error: "Unauthorized", requestId };
      }

      const orgId = portalUser.orgId;

      // Try to fetch existing settings
      const existingSettings = await prisma.widgetSettings.findUnique({
        where: { orgId },
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

      const settings = existingSettings || getDefaultSettings();

      // Fetch plan info for branding entitlement + maxAgents
      const orgInfo = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { planKey: true, widgetDomainMismatchTotal: true },
      });
      const plan = orgInfo
        ? await prisma.plan.findUnique({
            where: { key: orgInfo.planKey },
            select: { maxAgents: true },
          })
        : null;

      return {
        settings,
        planKey: orgInfo?.planKey ?? "free",
        brandingRequired: orgInfo?.planKey === "free",
        maxAgents: plan?.maxAgents ?? 1,
        domainMismatchCount: orgInfo?.widgetDomainMismatchTotal ?? 0,
        requestId,
      };
    }
  );

  /**
   * PUT /portal/widget/settings
   * Updates widget appearance settings
   */
  fastify.put<{ Body: WidgetSettingsUpdateBody }>(
    "/portal/widget/settings",
    {
      preHandler: [
        portalSettingsWriteRateLimit,
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        requirePortalUser,
      ],
      config: {
        skipGlobalRateLimit: true,
      },
    },
    async (request, reply) => {
      const portalUser = (request as any).portalUser;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (!portalUser) {
        reply.code(401);
        return { error: "Unauthorized", requestId };
      }

      const orgId = portalUser.orgId;
      const body = request.body;
      const normalizedBody: WidgetSettingsUpdateBody = { ...body };

      if (normalizedBody.greetingText !== undefined) {
        normalizedBody.greetingText = sanitizePlainText(normalizedBody.greetingText);
      }
      if (normalizedBody.welcomeTitle !== undefined) {
        normalizedBody.welcomeTitle = sanitizePlainText(normalizedBody.welcomeTitle);
      }
      if (normalizedBody.welcomeMessage !== undefined) {
        normalizedBody.welcomeMessage = sanitizePlainText(normalizedBody.welcomeMessage);
      }
      if (normalizedBody.brandName !== undefined && normalizedBody.brandName !== null) {
        normalizedBody.brandName = sanitizePlainText(normalizedBody.brandName);
      }

      // Validate primaryColor
      if (normalizedBody.primaryColor !== undefined) {
        if (!isValidHexColor(normalizedBody.primaryColor)) {
          reply.code(400);
          return {
            error: "Invalid hex color format",
            field: "primaryColor",
            requestId,
          };
        }
      }

      // Validate position
      if (normalizedBody.position !== undefined) {
        if (!["right", "left"].includes(normalizedBody.position)) {
          reply.code(400);
          return {
            error: "Invalid position value",
            field: "position",
            allowedValues: ["right", "left"],
            requestId,
          };
        }
      }

      // Validate launcher
      if (normalizedBody.launcher !== undefined) {
        if (!["bubble", "icon"].includes(normalizedBody.launcher)) {
          reply.code(400);
          return {
            error: "Invalid launcher value",
            field: "launcher",
            allowedValues: ["bubble", "icon"],
            requestId,
          };
        }
      }

      if (normalizedBody.bubbleShape !== undefined) {
        if (!["circle", "rounded-square"].includes(normalizedBody.bubbleShape)) {
          reply.code(400);
          return {
            error: "Invalid bubbleShape value",
            field: "bubbleShape",
            allowedValues: ["circle", "rounded-square"],
            requestId,
          };
        }
      }

      if (normalizedBody.bubbleIcon !== undefined) {
        if (!["chat", "message", "help", "custom"].includes(normalizedBody.bubbleIcon)) {
          reply.code(400);
          return {
            error: "Invalid bubbleIcon value",
            field: "bubbleIcon",
            allowedValues: ["chat", "message", "help", "custom"],
            requestId,
          };
        }
      }

      if (normalizedBody.bubbleSize !== undefined) {
        if (!Number.isInteger(normalizedBody.bubbleSize) || normalizedBody.bubbleSize < 40 || normalizedBody.bubbleSize > 96) {
          reply.code(400);
          return {
            error: "bubbleSize must be an integer between 40 and 96",
            field: "bubbleSize",
            requestId,
          };
        }
      }

      if (normalizedBody.bubblePosition !== undefined) {
        if (!["bottom-right", "bottom-left"].includes(normalizedBody.bubblePosition)) {
          reply.code(400);
          return {
            error: "Invalid bubblePosition value",
            field: "bubblePosition",
            allowedValues: ["bottom-right", "bottom-left"],
            requestId,
          };
        }
      }

      if (normalizedBody.greetingText !== undefined) {
        if (normalizedBody.greetingText.length > 120) {
          reply.code(400);
          return {
            error: "greetingText exceeds maximum length of 120 characters",
            field: "greetingText",
            requestId,
          };
        }
      }

      if (normalizedBody.greetingEnabled !== undefined && typeof normalizedBody.greetingEnabled !== "boolean") {
        reply.code(400);
        return {
          error: "greetingEnabled must be boolean",
          field: "greetingEnabled",
          requestId,
        };
      }

      // Validate welcomeTitle length
      if (normalizedBody.welcomeTitle !== undefined) {
        if (normalizedBody.welcomeTitle.length > 60) {
          reply.code(400);
          return {
            error: "welcomeTitle exceeds maximum length of 60 characters",
            field: "welcomeTitle",
            requestId,
          };
        }
      }

      // Validate welcomeMessage length
      if (normalizedBody.welcomeMessage !== undefined) {
        if (normalizedBody.welcomeMessage.length > 240) {
          reply.code(400);
          return {
            error: "welcomeMessage exceeds maximum length of 240 characters",
            field: "welcomeMessage",
            requestId,
          };
        }
      }

      // Validate brandName length
      if (normalizedBody.brandName !== undefined && normalizedBody.brandName !== null) {
        if (normalizedBody.brandName.length > 40) {
          reply.code(400);
          return {
            error: "brandName exceeds maximum length of 40 characters",
            field: "brandName",
            requestId,
          };
        }
      }

      // Upsert settings
      const updatedSettings = await prisma.widgetSettings.upsert({
        where: { orgId },
        create: {
          orgId,
          ...normalizedBody,
        },
        update: normalizedBody,
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

      // Audit log (best-effort)
      writeAuditLog(
        orgId,
        `${portalUser.email}`,
        "widget.settings.updated",
        { updatedFields: Object.keys(normalizedBody), requestId }
      ).catch(() => {});

      return {
        ok: true,
        settings: updatedSettings,
        requestId,
      };
    }
  );
}
