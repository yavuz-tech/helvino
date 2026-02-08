/**
 * Portal Widget Settings Routes — Step 11.52
 *
 * GET  /portal/widget/settings - Get widget appearance settings
 * PUT  /portal/widget/settings - Update widget appearance settings
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { requirePortalUser } from "../middleware/require-portal-user";
import { writeAuditLog } from "../utils/audit-log";

interface WidgetSettingsUpdateBody {
  primaryColor?: string;
  position?: "right" | "left";
  launcher?: "bubble" | "icon";
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
    welcomeTitle: "Welcome",
    welcomeMessage: "How can we help you today?",
    brandName: null,
  };
}

export async function portalWidgetSettingsRoutes(fastify: FastifyInstance) {
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
          welcomeTitle: true,
          welcomeMessage: true,
          brandName: true,
        },
      });

      const settings = existingSettings || getDefaultSettings();

      return {
        settings,
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
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
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
      const body = request.body;

      // Validate primaryColor
      if (body.primaryColor !== undefined) {
        if (!isValidHexColor(body.primaryColor)) {
          reply.code(400);
          return {
            error: "Invalid hex color format",
            field: "primaryColor",
            requestId,
          };
        }
      }

      // Validate position
      if (body.position !== undefined) {
        if (!["right", "left"].includes(body.position)) {
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
      if (body.launcher !== undefined) {
        if (!["bubble", "icon"].includes(body.launcher)) {
          reply.code(400);
          return {
            error: "Invalid launcher value",
            field: "launcher",
            allowedValues: ["bubble", "icon"],
            requestId,
          };
        }
      }

      // Validate welcomeTitle length
      if (body.welcomeTitle !== undefined) {
        if (body.welcomeTitle.length > 60) {
          reply.code(400);
          return {
            error: "welcomeTitle exceeds maximum length of 60 characters",
            field: "welcomeTitle",
            requestId,
          };
        }
      }

      // Validate welcomeMessage length
      if (body.welcomeMessage !== undefined) {
        if (body.welcomeMessage.length > 240) {
          reply.code(400);
          return {
            error: "welcomeMessage exceeds maximum length of 240 characters",
            field: "welcomeMessage",
            requestId,
          };
        }
      }

      // Validate brandName length
      if (body.brandName !== undefined && body.brandName !== null) {
        if (body.brandName.length > 40) {
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
          ...body,
        },
        update: body,
        select: {
          primaryColor: true,
          position: true,
          launcher: true,
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
        { updatedFields: Object.keys(body), requestId }
      ).catch(() => {});

      return {
        ok: true,
        settings: updatedSettings,
        requestId,
      };
    }
  );
}
