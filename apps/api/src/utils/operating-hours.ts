import { prisma } from "../prisma";

export type OperatingHoursStatus = {
  enabled: boolean;
  withinHours: boolean;
  offHoursAutoReply: boolean;
  offHoursReplyText: string | null;
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10));
  return h * 60 + m;
}

export async function getOperatingHoursStatus(orgId: string, now = new Date()): Promise<OperatingHoursStatus> {
  const hours = await prisma.operatingHours.findUnique({
    where: { orgId },
    include: { days: true },
  });
  if (!hours || !hours.enabled) {
    return {
      enabled: false,
      withinHours: true,
      offHoursAutoReply: false,
      offHoursReplyText: null,
    };
  }

  const day = hours.days.find((d) => d.weekday === now.getDay());
  if (!day || !day.isOpen || !day.startTime || !day.endTime) {
    return {
      enabled: true,
      withinHours: false,
      offHoursAutoReply: hours.offHoursAutoReply,
      offHoursReplyText: hours.offHoursReplyText,
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(day.startTime);
  const endMinutes = toMinutes(day.endTime);
  const withinHours = nowMinutes >= startMinutes && nowMinutes <= endMinutes;

  return {
    enabled: true,
    withinHours,
    offHoursAutoReply: hours.offHoursAutoReply,
    offHoursReplyText: hours.offHoursReplyText,
  };
}
