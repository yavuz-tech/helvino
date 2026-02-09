import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { writeAuditLog } from "../utils/audit-log";

const ALLOWED_LOCALES = ["en", "tr", "es"];

export async function portalTranslationRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { locale?: string } }>(
    "/portal/settings/translations",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const locale = request.query.locale?.toLowerCase();
      if (locale && !ALLOWED_LOCALES.includes(locale)) {
        return reply.status(400).send({ error: "unsupported locale" });
      }
      const items = await prisma.translationOverride.findMany({
        where: { orgId: actor.orgId, ...(locale ? { locale } : {}) },
        orderBy: [{ locale: "asc" }, { translationKey: "asc" }],
      });
      return { items };
    }
  );

  fastify.put<{ Body: { locale: string; key: string; value: string } }>(
    "/portal/settings/translations",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        createRateLimitMiddleware({ limit: 40, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const locale = request.body.locale?.toLowerCase();
      const translationKey = request.body.key?.trim();
      const value = request.body.value;

      if (!locale || !ALLOWED_LOCALES.includes(locale)) {
        return reply.status(400).send({ error: "locale must be one of en,tr,es" });
      }
      if (!translationKey) {
        return reply.status(400).send({ error: "key is required" });
      }
      if (typeof value !== "string" || value.length === 0) {
        return reply.status(400).send({ error: "value is required" });
      }

      const item = await prisma.translationOverride.upsert({
        where: {
          orgId_locale_translationKey: {
            orgId: actor.orgId,
            locale,
            translationKey,
          },
        },
        create: {
          orgId: actor.orgId,
          locale,
          translationKey,
          value,
        },
        update: { value },
      });

      writeAuditLog(actor.orgId, actor.email, "settings.translation_override.upsert", { locale, translationKey }, (request as any).requestId).catch(() => {});
      return { ok: true, item };
    }
  );

  fastify.delete<{ Body: { locale: string; key: string } }>(
    "/portal/settings/translations",
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
      const locale = request.body.locale?.toLowerCase();
      const translationKey = request.body.key?.trim();
      if (!locale || !translationKey) return reply.status(400).send({ error: "locale and key are required" });

      await prisma.translationOverride.deleteMany({
        where: { orgId: actor.orgId, locale, translationKey },
      });
      writeAuditLog(actor.orgId, actor.email, "settings.translation_override.delete", { locale, translationKey }, (request as any).requestId).catch(() => {});
      return { ok: true };
    }
  );
}
