import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { writeAuditLog } from "../utils/audit-log";
import { requirePlanFeature } from "../utils/plan-gating";

export async function portalSlaRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/portal/settings/sla",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const policy =
        (await prisma.slaPolicy.findFirst({
          where: { orgId: actor.orgId },
          orderBy: { createdAt: "asc" },
        })) ||
        (await prisma.slaPolicy.create({
          data: { orgId: actor.orgId, name: "Default SLA" },
        }));

      return { policy };
    }
  );

  fastify.put<{
    Body: {
      name?: string;
      enabled?: boolean;
      firstResponseMinutes?: number;
      resolutionMinutes?: number;
      warnThresholdPercent?: number;
    };
  }>(
    "/portal/settings/sla",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requirePlanFeature("sla"),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body || {};
      if (body.firstResponseMinutes != null && body.firstResponseMinutes < 1) {
        return reply.status(400).send({ error: "firstResponseMinutes must be >= 1" });
      }
      if (body.resolutionMinutes != null && body.resolutionMinutes < 1) {
        return reply.status(400).send({ error: "resolutionMinutes must be >= 1" });
      }
      if (body.warnThresholdPercent != null && (body.warnThresholdPercent < 1 || body.warnThresholdPercent > 99)) {
        return reply.status(400).send({ error: "warnThresholdPercent must be 1..99" });
      }

      const existing = await prisma.slaPolicy.findFirst({
        where: { orgId: actor.orgId },
        orderBy: { createdAt: "asc" },
      });

      const policy = existing
        ? await prisma.slaPolicy.update({
            where: { id: existing.id },
            data: {
              name: body.name,
              enabled: body.enabled,
              firstResponseMinutes: body.firstResponseMinutes,
              resolutionMinutes: body.resolutionMinutes,
              warnThresholdPercent: body.warnThresholdPercent,
            },
          })
        : await prisma.slaPolicy.create({
            data: {
              orgId: actor.orgId,
              name: body.name || "Default SLA",
              enabled: body.enabled ?? false,
              firstResponseMinutes: body.firstResponseMinutes ?? 15,
              resolutionMinutes: body.resolutionMinutes ?? 480,
              warnThresholdPercent: body.warnThresholdPercent ?? 80,
            },
          });

      writeAuditLog(
        actor.orgId,
        actor.email,
        "settings.sla.updated",
        { policyId: policy.id, enabled: policy.enabled },
        (request as any).requestId
      ).catch(() => {});

      return { ok: true, policy };
    }
  );
}
