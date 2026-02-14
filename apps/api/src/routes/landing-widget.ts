import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/require-admin";

type AiProvider = "gemini" | "openai" | "claude";
type WidgetPosition = "br" | "bl";

function normalizeOrgKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidOrgKey(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^[a-z0-9_-]+$/.test(value);
}

function isHexColor(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

function defaultHours(): Array<{ day: string; on: boolean; start: string; end: string }> {
  return [
    { day: "Mon", on: true, start: "09:00", end: "18:00" },
    { day: "Tue", on: true, start: "09:00", end: "18:00" },
    { day: "Wed", on: true, start: "09:00", end: "18:00" },
    { day: "Thu", on: true, start: "09:00", end: "18:00" },
    { day: "Fri", on: true, start: "09:00", end: "18:00" },
    { day: "Sat", on: false, start: "09:00", end: "18:00" },
    { day: "Sun", on: false, start: "09:00", end: "18:00" },
  ];
}

function coerceAiProvider(value: unknown): AiProvider | null {
  if (value === "gemini" || value === "openai" || value === "claude") return value;
  return null;
}

function coercePosition(value: unknown): WidgetPosition | null {
  if (value === "br" || value === "bl") return value;
  return null;
}

function isMissingTableError(err: unknown): boolean {
  // Prisma error when a table doesn't exist yet (migration not applied).
  return Boolean(err && typeof err === "object" && "code" in err && (err as any).code === "P2021");
}

export async function landingWidgetRoutes(fastify: FastifyInstance) {
  // ──────────────────────────────────────────────────────
  // Admin: read landing widget config
  // GET /internal/landing-widget/:orgKey
  // ──────────────────────────────────────────────────────
  fastify.get(
    "/internal/landing-widget/:orgKey",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const orgKey = normalizeOrgKey((request.params as any)?.orgKey);
      if (!isValidOrgKey(orgKey)) {
        reply.code(400);
        return { error: "Invalid orgKey" };
      }

      let row: any = null;
      try {
        row = await prisma.landingWidgetConfig.findUnique({ where: { orgKey } });
      } catch (err) {
        if (!isMissingTableError(err)) throw err;
        row = null;
      }
      if (!row) {
        return {
          ok: true,
          orgKey,
          config: {
            enabled: true,
            welcomeMessage: "Merhaba! 👋 Size nasil yardimci olabilirim?",
            primaryColor: "#F59E0B",
            position: "br",
            aiAutoReply: true,
            aiProvider: "gemini",
            hoursEnabled: false,
            timezone: "Europe/Istanbul",
            hours: defaultHours(),
            offlineMessage: "Su an cevrimdisiyiz. Mesajinizi birakin, en kisa surede donelim.",
          },
          exists: false,
        };
      }

      return {
        ok: true,
        orgKey,
        exists: true,
        config: {
          enabled: row.enabled,
          welcomeMessage: row.welcomeMessage,
          primaryColor: row.primaryColor,
          position: row.position,
          aiAutoReply: row.aiAutoReply,
          aiProvider: row.aiProvider,
          hoursEnabled: row.hoursEnabled,
          timezone: row.timezone,
          hours: (row.hoursJson as any) || defaultHours(),
          offlineMessage: row.offlineMessage,
          updatedAt: row.updatedAt.toISOString(),
        },
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // Admin: update landing widget config
  // PUT /internal/landing-widget/:orgKey
  // ──────────────────────────────────────────────────────
  fastify.put(
    "/internal/landing-widget/:orgKey",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const orgKey = normalizeOrgKey((request.params as any)?.orgKey);
      if (!isValidOrgKey(orgKey)) {
        reply.code(400);
        return { error: "Invalid orgKey" };
      }

      const body = (request.body || {}) as Record<string, unknown>;

      const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
      const welcomeMessage = typeof body.welcomeMessage === "string" ? body.welcomeMessage : undefined;
      const primaryColor = typeof body.primaryColor === "string" ? body.primaryColor : undefined;
      const position = coercePosition(body.position);
      const aiAutoReply = typeof body.aiAutoReply === "boolean" ? body.aiAutoReply : undefined;
      const aiProvider = coerceAiProvider(body.aiProvider);
      const hoursEnabled = typeof body.hoursEnabled === "boolean" ? body.hoursEnabled : undefined;
      const timezone = typeof body.timezone === "string" ? body.timezone : undefined;
      const hours = Array.isArray(body.hours) ? body.hours : undefined;
      const offlineMessage = typeof body.offlineMessage === "string" ? body.offlineMessage : undefined;

      if (welcomeMessage !== undefined && welcomeMessage.length > 2000) {
        reply.code(400);
        return { error: "welcomeMessage too long" };
      }
      if (offlineMessage !== undefined && offlineMessage.length > 2000) {
        reply.code(400);
        return { error: "offlineMessage too long" };
      }
      if (primaryColor !== undefined && !isHexColor(primaryColor)) {
        reply.code(400);
        return { error: "primaryColor must be a hex color" };
      }
      if (body.position !== undefined && !position) {
        reply.code(400);
        return { error: "position must be 'br' or 'bl'" };
      }
      if (body.aiProvider !== undefined && !aiProvider) {
        reply.code(400);
        return { error: "aiProvider must be 'gemini', 'openai', or 'claude'" };
      }

      let updated: any;
      try {
        updated = await prisma.landingWidgetConfig.upsert({
          where: { orgKey },
          create: {
            orgKey,
            enabled: enabled ?? true,
            welcomeMessage: welcomeMessage ?? "Merhaba! 👋 Size nasil yardimci olabilirim?",
            primaryColor: primaryColor ?? "#F59E0B",
            position: position ?? "br",
            aiAutoReply: aiAutoReply ?? true,
            aiProvider: aiProvider ?? "gemini",
            hoursEnabled: hoursEnabled ?? false,
            timezone: timezone ?? "Europe/Istanbul",
            hoursJson: hours ?? defaultHours(),
            offlineMessage: offlineMessage ?? "Su an cevrimdisiyiz. Mesajinizi birakin, en kisa surede donelim.",
          },
          update: {
            ...(enabled !== undefined ? { enabled } : {}),
            ...(welcomeMessage !== undefined ? { welcomeMessage } : {}),
            ...(primaryColor !== undefined ? { primaryColor } : {}),
            ...(position ? { position } : {}),
            ...(aiAutoReply !== undefined ? { aiAutoReply } : {}),
            ...(aiProvider ? { aiProvider } : {}),
            ...(hoursEnabled !== undefined ? { hoursEnabled } : {}),
            ...(timezone !== undefined ? { timezone } : {}),
            ...(hours !== undefined ? { hoursJson: hours } : {}),
            ...(offlineMessage !== undefined ? { offlineMessage } : {}),
          },
        });
      } catch (err) {
        if (isMissingTableError(err)) {
          reply.code(503);
          return { error: "DB migration pending: landing_widget_config table is missing" };
        }
        throw err;
      }

      return {
        ok: true,
        orgKey,
        config: {
          enabled: updated.enabled,
          welcomeMessage: updated.welcomeMessage,
          primaryColor: updated.primaryColor,
          position: updated.position,
          aiAutoReply: updated.aiAutoReply,
          aiProvider: updated.aiProvider,
          hoursEnabled: updated.hoursEnabled,
          timezone: updated.timezone,
          hours: (updated.hoursJson as any) || defaultHours(),
          offlineMessage: updated.offlineMessage,
          updatedAt: updated.updatedAt.toISOString(),
        },
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // Public: landing widget config for embed script
  // GET /widget/config/:orgKey
  // ──────────────────────────────────────────────────────
  fastify.get("/widget/config/:orgKey", async (request, reply) => {
    const orgKey = normalizeOrgKey((request.params as any)?.orgKey);
    if (!isValidOrgKey(orgKey)) {
      reply.code(400);
      return { error: { code: "INVALID_ORG_KEY", message: "Invalid orgKey" } };
    }

    let row: any = null;
    try {
      row = await prisma.landingWidgetConfig.findUnique({ where: { orgKey } });
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      row = null;
    }
    if (!row) {
      return {
        ok: true,
        orgKey,
        config: {
          enabled: true,
          welcomeMessage: "Merhaba! 👋 Size nasil yardimci olabilirim?",
          primaryColor: "#F59E0B",
          position: "br",
          aiAutoReply: true,
          aiProvider: "gemini",
          hoursEnabled: false,
          timezone: "Europe/Istanbul",
          hours: defaultHours(),
          offlineMessage: "Su an cevrimdisiyiz. Mesajinizi birakin, en kisa surede donelim.",
        },
      };
    }

    return {
      ok: true,
      orgKey,
      config: {
        enabled: row.enabled,
        welcomeMessage: row.welcomeMessage,
        primaryColor: row.primaryColor,
        position: row.position,
        aiAutoReply: row.aiAutoReply,
        aiProvider: row.aiProvider,
        hoursEnabled: row.hoursEnabled,
        timezone: row.timezone,
        hours: (row.hoursJson as any) || defaultHours(),
        offlineMessage: row.offlineMessage,
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  });
}

