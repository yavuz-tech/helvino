import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import { writeAuditLog } from "../utils/audit-log";

type DayInput = {
  weekday: number;
  isOpen: boolean;
  startTime?: string | null;
  endTime?: string | null;
};

const DEFAULT_DAYS: DayInput[] = [
  { weekday: 0, isOpen: false, startTime: null, endTime: null },
  { weekday: 1, isOpen: true, startTime: "09:00", endTime: "18:00" },
  { weekday: 2, isOpen: true, startTime: "09:00", endTime: "18:00" },
  { weekday: 3, isOpen: true, startTime: "09:00", endTime: "18:00" },
  { weekday: 4, isOpen: true, startTime: "09:00", endTime: "18:00" },
  { weekday: 5, isOpen: true, startTime: "09:00", endTime: "18:00" },
  { weekday: 6, isOpen: false, startTime: null, endTime: null },
];

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export async function portalOperatingHoursRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/portal/settings/operating-hours",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      let hours = await prisma.operatingHours.findUnique({
        where: { orgId: actor.orgId },
        include: { days: { orderBy: { weekday: "asc" } } },
      });

      if (!hours) {
        hours = await prisma.operatingHours.create({
          data: {
            orgId: actor.orgId,
            days: {
              create: DEFAULT_DAYS.map((d) => ({
                weekday: d.weekday,
                isOpen: d.isOpen,
                startTime: d.startTime,
                endTime: d.endTime,
              })),
            },
          },
          include: { days: { orderBy: { weekday: "asc" } } },
        });
      }

      return {
        id: hours.id,
        timezone: hours.timezone,
        enabled: hours.enabled,
        offHoursAutoReply: hours.offHoursAutoReply,
        offHoursReplyText: hours.offHoursReplyText,
        days: hours.days,
      };
    }
  );

  fastify.put<{ Body: { timezone?: string; enabled?: boolean; offHoursAutoReply?: boolean; offHoursReplyText?: string | null; days?: DayInput[] } }>(
    "/portal/settings/operating-hours",
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

      if (body.days && (!Array.isArray(body.days) || body.days.length !== 7)) {
        return reply.status(400).send({ error: "days must be an array of 7 items" });
      }

      if (body.days) {
        for (const d of body.days) {
          if (d.weekday < 0 || d.weekday > 6) {
            return reply.status(400).send({ error: "weekday must be 0..6" });
          }
          if (d.isOpen) {
            if (!d.startTime || !d.endTime || !isValidTime(d.startTime) || !isValidTime(d.endTime)) {
              return reply.status(400).send({ error: "open days require valid startTime/endTime in HH:mm" });
            }
          }
        }
      }

      const updated = await prisma.operatingHours.upsert({
        where: { orgId: actor.orgId },
        create: {
          orgId: actor.orgId,
          timezone: body.timezone || "UTC",
          enabled: body.enabled ?? false,
          offHoursAutoReply: body.offHoursAutoReply ?? false,
          offHoursReplyText: body.offHoursReplyText || null,
          days: {
            create: (body.days || DEFAULT_DAYS).map((d) => ({
              weekday: d.weekday,
              isOpen: d.isOpen,
              startTime: d.isOpen ? d.startTime || null : null,
              endTime: d.isOpen ? d.endTime || null : null,
            })),
          },
        },
        update: {
          timezone: body.timezone,
          enabled: body.enabled,
          offHoursAutoReply: body.offHoursAutoReply,
          offHoursReplyText: body.offHoursReplyText,
        },
        include: { days: { orderBy: { weekday: "asc" } } },
      });

      if (body.days) {
        await prisma.$transaction(
          body.days.map((d) =>
            prisma.operatingHoursDay.upsert({
              where: { operatingHoursId_weekday: { operatingHoursId: updated.id, weekday: d.weekday } },
              create: {
                operatingHoursId: updated.id,
                weekday: d.weekday,
                isOpen: d.isOpen,
                startTime: d.isOpen ? d.startTime || null : null,
                endTime: d.isOpen ? d.endTime || null : null,
              },
              update: {
                isOpen: d.isOpen,
                startTime: d.isOpen ? d.startTime || null : null,
                endTime: d.isOpen ? d.endTime || null : null,
              },
            })
          )
        );
      }

      writeAuditLog(
        actor.orgId,
        actor.email,
        "settings.operating_hours.updated",
        {
          enabled: body.enabled,
          timezone: body.timezone,
          offHoursAutoReply: body.offHoursAutoReply,
        },
        (request as any).requestId
      ).catch(() => {});

      const fresh = await prisma.operatingHours.findUnique({
        where: { orgId: actor.orgId },
        include: { days: { orderBy: { weekday: "asc" } } },
      });

      return {
        ok: true,
        data: fresh,
      };
    }
  );
}
