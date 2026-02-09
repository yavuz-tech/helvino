import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { writeAuditLog } from "../utils/audit-log";

export async function portalChatPageRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/portal/settings/chat-page",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const config =
        (await prisma.chatPageConfig.findUnique({ where: { orgId: actor.orgId } })) ||
        (await prisma.chatPageConfig.create({ data: { orgId: actor.orgId } }));
      return { config };
    }
  );

  fastify.put<{
    Body: {
      title?: string;
      subtitle?: string;
      placeholder?: string;
      showAgentAvatars?: boolean;
      showOperatingHours?: boolean;
    };
  }>(
    "/portal/settings/chat-page",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body || {};
      if (body.title && body.title.length > 80) return reply.status(400).send({ error: "title max 80 chars" });
      if (body.subtitle && body.subtitle.length > 200) return reply.status(400).send({ error: "subtitle max 200 chars" });
      if (body.placeholder && body.placeholder.length > 100) return reply.status(400).send({ error: "placeholder max 100 chars" });

      const config = await prisma.chatPageConfig.upsert({
        where: { orgId: actor.orgId },
        create: {
          orgId: actor.orgId,
          title: body.title || "Chat with us",
          subtitle: body.subtitle || "We reply as soon as possible",
          placeholder: body.placeholder || "Write your message...",
          showAgentAvatars: body.showAgentAvatars ?? true,
          showOperatingHours: body.showOperatingHours ?? true,
        },
        update: {
          title: body.title,
          subtitle: body.subtitle,
          placeholder: body.placeholder,
          showAgentAvatars: body.showAgentAvatars,
          showOperatingHours: body.showOperatingHours,
        },
      });

      writeAuditLog(actor.orgId, actor.email, "settings.chat_page.updated", { configId: config.id }, (request as any).requestId).catch(() => {});
      return { ok: true, config };
    }
  );
}
