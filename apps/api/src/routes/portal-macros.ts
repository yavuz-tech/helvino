import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { writeAuditLog } from "../utils/audit-log";
import { requirePlanFeature } from "../utils/plan-gating";

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
        requirePlanFeature("macros"),
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
      // SECURITY: Input validation — max lengths
      const trimmedTitle = String(title).trim();
      const trimmedContent = String(content).trim();
      if (trimmedTitle.length > 200) return reply.status(400).send({ error: "title exceeds maximum length (200)" });
      if (trimmedContent.length > 5000) return reply.status(400).send({ error: "content exceeds maximum length (5000)" });
      const created = await prisma.macro.create({
        data: {
          orgId: actor.orgId,
          title: trimmedTitle,
          content: trimmedContent,
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
        requirePlanFeature("macros"),
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { id } = request.params;
      const exists = await prisma.macro.findFirst({ where: { id, orgId: actor.orgId }, select: { id: true } });
      if (!exists) return reply.status(404).send({ error: "macro not found" });

      // SECURITY: Input validation — max lengths (same policy as create)
      if (request.body.title !== undefined) {
        const t = String(request.body.title).trim();
        if (!t) return reply.status(400).send({ error: "title cannot be empty" });
        if (t.length > 200) return reply.status(400).send({ error: "title exceeds maximum length (200)" });
      }
      if (request.body.content !== undefined) {
        const c = String(request.body.content).trim();
        if (!c) return reply.status(400).send({ error: "content cannot be empty" });
        if (c.length > 5000) return reply.status(400).send({ error: "content exceeds maximum length (5000)" });
      }
      if (request.body.enabled !== undefined && typeof request.body.enabled !== "boolean") {
        return reply.status(400).send({ error: "enabled must be boolean" });
      }

      // SECURITY: Include orgId in the where clause to enforce tenant isolation at DB level (defense-in-depth)
      const updateResult = await prisma.macro.updateMany({
        where: { id, orgId: actor.orgId },
        data: {
          title: request.body.title !== undefined ? String(request.body.title).trim() : undefined,
          content: request.body.content !== undefined ? String(request.body.content).trim() : undefined,
          enabled: request.body.enabled,
        },
      });
      if (updateResult.count === 0) return reply.status(404).send({ error: "macro not found" });
      const updated = await prisma.macro.findUnique({ where: { id } });
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
        requirePlanFeature("macros"),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { id } = request.params;
      const exists = await prisma.macro.findFirst({ where: { id, orgId: actor.orgId }, select: { id: true } });
      if (!exists) return reply.status(404).send({ error: "macro not found" });
      // SECURITY: Include orgId in the where clause (defense-in-depth)
      await prisma.macro.deleteMany({ where: { id, orgId: actor.orgId } });
      writeAuditLog(actor.orgId, actor.email, "settings.macro.deleted", { macroId: id }, (request as any).requestId).catch(() => {});
      return { ok: true };
    }
  );
}
