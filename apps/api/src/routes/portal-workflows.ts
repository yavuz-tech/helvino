import { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { writeAuditLog } from "../utils/audit-log";
import { requirePlanFeature } from "../utils/plan-gating";

const SUPPORTED_TRIGGERS = ["message_created", "conversation_created", "conversation_closed"] as const;

export async function portalWorkflowRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/portal/settings/workflows",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const items = await prisma.workflowRule.findMany({
        where: { orgId: actor.orgId },
        orderBy: { createdAt: "desc" },
      });
      return { items };
    }
  );

  fastify.post<{
    Body: {
      name: string;
      trigger: string;
      enabled?: boolean;
      conditionsJson?: Record<string, unknown>;
      actionsJson?: Record<string, unknown>;
    };
  }>(
    "/portal/settings/workflows",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requirePlanFeature("workflows"),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { name, trigger, enabled, conditionsJson, actionsJson } = request.body || {};
      if (!name || !trigger) return reply.status(400).send({ error: "name and trigger are required" });
      // SECURITY: Input validation — max lengths and JSON size
      const trimmedName = String(name).trim();
      if (trimmedName.length > 200) return reply.status(400).send({ error: "name exceeds maximum length (200)" });
      if (!SUPPORTED_TRIGGERS.includes(trigger as (typeof SUPPORTED_TRIGGERS)[number])) {
        return reply.status(400).send({ error: "unsupported trigger" });
      }
      if (conditionsJson && JSON.stringify(conditionsJson).length > 32 * 1024) {
        return reply.status(400).send({ error: "conditionsJson exceeds maximum size (32KB)" });
      }
      if (actionsJson && JSON.stringify(actionsJson).length > 32 * 1024) {
        return reply.status(400).send({ error: "actionsJson exceeds maximum size (32KB)" });
      }
      const created = await prisma.workflowRule.create({
        data: {
          orgId: actor.orgId,
          name: trimmedName,
          trigger,
          enabled: enabled ?? true,
          conditionsJson: (conditionsJson ?? {}) as Prisma.InputJsonValue,
          actionsJson: (actionsJson ?? {}) as Prisma.InputJsonValue,
        },
      });
      writeAuditLog(actor.orgId, actor.email, "settings.workflow.created", { workflowId: created.id }, (request as any).requestId).catch(() => {});
      return { ok: true, item: created };
    }
  );

  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      trigger?: string;
      enabled?: boolean;
      conditionsJson?: Record<string, unknown>;
      actionsJson?: Record<string, unknown>;
    };
  }>(
    "/portal/settings/workflows/:id",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requirePlanFeature("workflows"),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { id } = request.params;
      const exists = await prisma.workflowRule.findFirst({ where: { id, orgId: actor.orgId }, select: { id: true } });
      if (!exists) return reply.status(404).send({ error: "workflow not found" });
      if (request.body.trigger && !SUPPORTED_TRIGGERS.includes(request.body.trigger as (typeof SUPPORTED_TRIGGERS)[number])) {
        return reply.status(400).send({ error: "unsupported trigger" });
      }
      if (request.body.name !== undefined) {
        const trimmed = String(request.body.name).trim();
        if (!trimmed) return reply.status(400).send({ error: "name cannot be empty" });
        if (trimmed.length > 200) return reply.status(400).send({ error: "name exceeds maximum length (200)" });
      }
      if (request.body.conditionsJson && JSON.stringify(request.body.conditionsJson).length > 32 * 1024) {
        return reply.status(400).send({ error: "conditionsJson exceeds maximum size (32KB)" });
      }
      if (request.body.actionsJson && JSON.stringify(request.body.actionsJson).length > 32 * 1024) {
        return reply.status(400).send({ error: "actionsJson exceeds maximum size (32KB)" });
      }
      // SECURITY: Include orgId in the where clause to enforce tenant isolation at DB level (defense-in-depth)
      const updateResult = await prisma.workflowRule.updateMany({
        where: { id, orgId: actor.orgId },
        data: {
          name: request.body.name !== undefined ? String(request.body.name).trim() : undefined,
          trigger: request.body.trigger,
          enabled: request.body.enabled,
          conditionsJson: request.body.conditionsJson as Prisma.InputJsonValue | undefined,
          actionsJson: request.body.actionsJson as Prisma.InputJsonValue | undefined,
        },
      });
      if (updateResult.count === 0) return reply.status(404).send({ error: "workflow not found" });
      const updated = await prisma.workflowRule.findUnique({ where: { id } });
      writeAuditLog(actor.orgId, actor.email, "settings.workflow.updated", { workflowId: id }, (request as any).requestId).catch(() => {});
      return { ok: true, item: updated };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/portal/settings/workflows/:id",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requirePlanFeature("workflows"),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { id } = request.params;
      const exists = await prisma.workflowRule.findFirst({ where: { id, orgId: actor.orgId }, select: { id: true } });
      if (!exists) return reply.status(404).send({ error: "workflow not found" });
      // SECURITY: Include orgId in the where clause (defense-in-depth)
      await prisma.workflowRule.deleteMany({ where: { id, orgId: actor.orgId } });
      writeAuditLog(actor.orgId, actor.email, "settings.workflow.deleted", { workflowId: id }, (request as any).requestId).catch(() => {});
      return { ok: true };
    }
  );
}
