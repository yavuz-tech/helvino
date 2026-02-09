import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { writeAuditLog } from "../utils/audit-log";

export async function portalMacroRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/portal/settings/macros",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const items = await prisma.macro.findMany({
        where: { orgId: actor.orgId },
        orderBy: { createdAt: "desc" },
      });
      return { items };
    }
  );

  fastify.post<{ Body: { title: string; content: string; enabled?: boolean } }>(
    "/portal/settings/macros",
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
      const { title, content, enabled } = request.body || {};
      if (!title || !content) {
        return reply.status(400).send({ error: "title and content are required" });
      }
      const created = await prisma.macro.create({
        data: {
          orgId: actor.orgId,
          title: String(title).trim(),
          content: String(content).trim(),
          enabled: enabled ?? true,
          createdById: actor.id,
        },
      });
      writeAuditLog(actor.orgId, actor.email, "settings.macro.created", { macroId: created.id }, (request as any).requestId).catch(() => {});
      return { ok: true, item: created };
    }
  );

  fastify.put<{ Params: { id: string }; Body: { title?: string; content?: string; enabled?: boolean } }>(
    "/portal/settings/macros/:id",
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
      const { id } = request.params;
      const exists = await prisma.macro.findFirst({ where: { id, orgId: actor.orgId }, select: { id: true } });
      if (!exists) return reply.status(404).send({ error: "macro not found" });

      const updated = await prisma.macro.update({
        where: { id },
        data: {
          title: request.body.title,
          content: request.body.content,
          enabled: request.body.enabled,
        },
      });
      writeAuditLog(actor.orgId, actor.email, "settings.macro.updated", { macroId: id }, (request as any).requestId).catch(() => {});
      return { ok: true, item: updated };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/portal/settings/macros/:id",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { id } = request.params;
      const exists = await prisma.macro.findFirst({ where: { id, orgId: actor.orgId }, select: { id: true } });
      if (!exists) return reply.status(404).send({ error: "macro not found" });
      await prisma.macro.delete({ where: { id } });
      writeAuditLog(actor.orgId, actor.email, "settings.macro.deleted", { macroId: id }, (request as any).requestId).catch(() => {});
      return { ok: true };
    }
  );
}
