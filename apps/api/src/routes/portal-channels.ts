import { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { writeAuditLog } from "../utils/audit-log";

const SUPPORTED_CHANNELS = ["live_chat", "email", "whatsapp", "facebook", "instagram"] as const;

type ChannelType = (typeof SUPPORTED_CHANNELS)[number];

export async function portalChannelRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/portal/settings/channels",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const rows = await prisma.channelConfig.findMany({
        where: { orgId: actor.orgId },
      });

      const byType = new Map(rows.map((r) => [r.channelType, r]));
      const channels = SUPPORTED_CHANNELS.map((type) => {
        const row = byType.get(type);
        return {
          channelType: type,
          enabled: row?.enabled ?? (type === "live_chat"),
          settingsJson: row?.settingsJson ?? {},
          configured: Boolean(row),
        };
      });

      return { channels };
    }
  );

  fastify.put<{ Body: { channelType: ChannelType; enabled: boolean; settingsJson?: Record<string, unknown> } }>(
    "/portal/settings/channels",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { channelType, enabled, settingsJson } = request.body || {};

      if (!SUPPORTED_CHANNELS.includes(channelType)) {
        return reply.status(400).send({ error: "unsupported channelType" });
      }

      if (typeof enabled !== "boolean") {
        return reply.status(400).send({ error: "enabled must be boolean" });
      }

      // SECURITY: Validate settingsJson size to prevent oversized data storage
      if (settingsJson && JSON.stringify(settingsJson).length > 16 * 1024) {
        return reply.status(400).send({ error: "settingsJson exceeds maximum size (16KB)" });
      }

      const row = await prisma.channelConfig.upsert({
        where: { orgId_channelType: { orgId: actor.orgId, channelType } },
        create: {
          orgId: actor.orgId,
          channelType,
          enabled,
          settingsJson: (settingsJson ?? {}) as Prisma.InputJsonValue,
        },
        update: {
          enabled,
          settingsJson: (settingsJson ?? {}) as Prisma.InputJsonValue,
        },
      });

      writeAuditLog(
        actor.orgId,
        actor.email,
        "settings.channel.updated",
        { channelType, enabled },
        (request as any).requestId
      ).catch(() => {});

      return { ok: true, channel: row };
    }
  );
}
