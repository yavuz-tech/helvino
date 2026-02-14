/**
 * Portal Widget Settings Routes — Step 11.52 (v3-ultimate)
 *
 * GET  /portal/widget/settings - Get widget appearance settings
 * PUT  /portal/widget/settings - Update widget appearance settings
 *
 * All v3-ultimate settings (50+ fields) are stored in the `configJson` column.
 * Legacy fields (primaryColor, position, etc.) are kept for backward compatibility.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { rateLimit } from "../middleware/rate-limiter";
import { requirePortalUser } from "../middleware/require-portal-user";
import { writeAuditLog } from "../utils/audit-log";

// Legacy fields stored in dedicated columns (backward compat)
const LEGACY_COLUMN_FIELDS = new Set([
  "primaryColor",
  "position",
  "launcher",
  "bubbleShape",
  "bubbleIcon",
  "bubbleSize",
  "bubblePosition",
  "greetingText",
  "greetingEnabled",
  "welcomeTitle",
  "welcomeMessage",
  "brandName",
]);

// Default v3-ultimate config
function getDefaultV3Config(): Record<string, unknown> {
  return {
    themeId: "amber",
    customColor: "#F59E0B",
    useCustomColor: false,
    launcherId: "rounded",
    positionId: "br",
    widgetSizeId: "standard",
    headerText: "Nasıl yardımcı olabiliriz?",
    subText: "Genellikle birkaç dakika içinde yanıt veriyoruz",
    welcomeMsg: "Merhaba! 👋 Size nasıl yardımcı olabilirim?",
    offlineMsg: "Şu an çevrimdışıyız. Mesajınızı bırakın, en kısa sürede dönelim.",
    launcherLabel: "Bize yazın",
    starters: [
      { id: 1, text: "💰 Fiyatlandırma hakkında bilgi", active: true },
      { id: 2, text: "🛠️ Teknik destek istiyorum", active: true },
      { id: 3, text: "📦 Siparişimi takip etmek istiyorum", active: true },
    ],
    botAvatar: "🤖",
    agentAvatar: "👩‍💼",
    bgPatternId: "none",
    attGrabberId: "none",
    attGrabberText: "Merhaba! Yardıma ihtiyacınız var mı? 👋",
    attGrabberDelay: 5,
    hoursEnabled: false,
    timezone: "Europe/Istanbul",
    hours: [
      { day: "Pzt", on: true, start: "09:00", end: "18:00" },
      { day: "Sal", on: true, start: "09:00", end: "18:00" },
      { day: "Çar", on: true, start: "09:00", end: "18:00" },
      { day: "Per", on: true, start: "09:00", end: "18:00" },
      { day: "Cum", on: true, start: "09:00", end: "18:00" },
      { day: "Cmt", on: false, start: "09:00", end: "18:00" },
      { day: "Paz", on: false, start: "09:00", end: "18:00" },
    ],
    showBranding: true,
    showOnMobile: true,
    showOffline: true,
    soundEnabled: true,
    autoOpen: false,
    showUnread: true,
    preChatEnabled: false,
    typingIndicator: true,
    fileUpload: true,
    emojiPicker: true,
    readReceipts: true,
    responseTime: true,
    transcriptEmail: false,
    visitorNotes: true,
    aiName: "Helvion AI",
    aiTone: "friendly",
    aiLength: "standard",
    aiEmoji: true,
    aiLabel: true,
    aiWelcome: "Merhaba! Ben Helvion AI asistanınız 🤖 Size nasıl yardımcı olabilirim?",
    aiModel: "auto",
    aiSuggestions: true,
    csat: false,
    whiteLabel: false,
    autoReply: false,
    autoReplyMsg: "Mesajınız alındı! En kısa sürede dönüş yapacağız.",
    customCss: "",
    consentEnabled: false,
    consentText: "Sohbet başlayarak gizlilik politikamızı kabul edersiniz.",
    pageRules: [],
  };
}

export async function portalWidgetSettingsRoutes(fastify: FastifyInstance) {
  const portalSettingsWriteRateLimit = rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: "Too many settings update requests",
    keyBuilder: (request) => request.portalUser?.id || "anonymous-user",
  });

  /**
   * GET /portal/widget/settings
   * Returns all v3 settings merged from configJson + legacy columns
   */
  fastify.get(
    "/portal/widget/settings",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 100, windowMs: 60000 }),
        requirePortalUser,
      ],
    },
    async (request, reply) => {
      const portalUser = (request as any).portalUser;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (!portalUser) {
        reply.code(401);
        return { error: "Unauthorized", requestId };
      }

      const orgId = portalUser.orgId;

      // Fetch existing settings
      const existing = await prisma.widgetSettings.findUnique({
        where: { orgId },
      });

      // Build settings: defaults -> configJson -> legacy columns
      const defaults = getDefaultV3Config();
      const storedConfig = (existing?.configJson as Record<string, unknown>) || {};

      const settings: Record<string, unknown> = {
        ...defaults,
        ...storedConfig,
      };

      // Also overlay legacy columns if they have non-default values
      if (existing) {
        settings.primaryColor = existing.primaryColor;
        settings.position = existing.position;
        settings.launcher = existing.launcher;
        settings.welcomeTitle = existing.welcomeTitle;
        settings.welcomeMessage = existing.welcomeMessage;
        settings.brandName = existing.brandName;
      }

      // Fetch plan info
      const orgInfo = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { planKey: true, widgetDomainMismatchTotal: true },
      });
      const plan = orgInfo
        ? await prisma.plan.findUnique({
            where: { key: orgInfo.planKey },
            select: { maxAgents: true },
          })
        : null;

      return {
        settings,
        planKey: orgInfo?.planKey ?? "free",
        brandingRequired: orgInfo?.planKey === "free",
        maxAgents: plan?.maxAgents ?? 1,
        domainMismatchCount: orgInfo?.widgetDomainMismatchTotal ?? 0,
        requestId,
      };
    }
  );

  /**
   * PUT /portal/widget/settings
   * Stores ALL v3 settings in configJson, plus updates legacy columns for backward compat
   */
  fastify.put(
    "/portal/widget/settings",
    {
      preHandler: [
        portalSettingsWriteRateLimit,
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        requirePortalUser,
      ],
      config: {
        skipGlobalRateLimit: true,
      },
    },
    async (request, reply) => {
      const portalUser = (request as any).portalUser;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (!portalUser) {
        reply.code(401);
        return { error: "Unauthorized", requestId };
      }

      const orgId = portalUser.orgId;
      const body = request.body as Record<string, unknown>;

      if (!body || typeof body !== "object") {
        reply.code(400);
        return { error: "Invalid request body", requestId };
      }

      // SECURITY: Limit configJson payload size to prevent oversized data storage
      const bodyJson = JSON.stringify(body);
      if (bodyJson.length > 64 * 1024) {
        reply.code(400);
        return { error: "Request body exceeds maximum size (64KB)", requestId };
      }

      // SECURITY: Validate string fields have reasonable max lengths
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string" && value.length > 2000) {
          reply.code(400);
          return { error: `Field "${key}" exceeds maximum length (2000 characters)`, requestId };
        }
      }

      // Separate legacy column fields from v3 extended fields
      const legacyUpdate: Record<string, unknown> = {};
      const configPayload: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(body)) {
        if (LEGACY_COLUMN_FIELDS.has(key)) {
          legacyUpdate[key] = value;
        }
        // Store everything in configJson (including legacy fields for a complete snapshot)
        configPayload[key] = value;
      }

      // Basic validation for legacy fields
      if (legacyUpdate.primaryColor !== undefined) {
        if (typeof legacyUpdate.primaryColor !== "string" || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(legacyUpdate.primaryColor)) {
          reply.code(400);
          return { error: "Invalid hex color format", field: "primaryColor", requestId };
        }
      }

      if (legacyUpdate.position !== undefined) {
        if (!["right", "left"].includes(String(legacyUpdate.position))) {
          reply.code(400);
          return { error: "Invalid position value", field: "position", requestId };
        }
      }

      // Fetch existing configJson to merge (don't overwrite unmentioned fields)
      const existing = await prisma.widgetSettings.findUnique({
        where: { orgId },
        select: { configJson: true },
      });
      const existingConfig = (existing?.configJson as Record<string, unknown>) || {};
      const mergedConfig = { ...existingConfig, ...configPayload };

      // Build the upsert data — only include legacy fields that were actually sent
      const upsertData: Record<string, unknown> = {
        configJson: mergedConfig,
      };
      for (const [key, value] of Object.entries(legacyUpdate)) {
        upsertData[key] = value;
      }

      // Sync v3 fields → legacy columns so embedded widget (bootloader) always sees latest values
      // Theme colors lookup for themeId → primaryColor sync
      const THEME_COLORS: Record<string, string> = {
        amber: "#F59E0B", ocean: "#0EA5E9", emerald: "#10B981", violet: "#8B5CF6",
        rose: "#F43F5E", slate: "#475569", teal: "#14B8A6", indigo: "#6366F1",
        sunset: "#F97316", aurora: "#06B6D4", midnight: "#1E293B", cherry: "#BE123C",
      };

      // primaryColor sync: explicit > customColor > themeId lookup > existing
      if (configPayload.primaryColor !== undefined) {
        upsertData.primaryColor = String(configPayload.primaryColor);
      } else if (configPayload.useCustomColor === true && configPayload.customColor !== undefined) {
        upsertData.primaryColor = String(configPayload.customColor);
      } else if (typeof configPayload.themeId === "string" && THEME_COLORS[configPayload.themeId]) {
        upsertData.primaryColor = THEME_COLORS[configPayload.themeId];
      }

      // position sync: v3 positionId → legacy position column
      if (configPayload.position !== undefined) {
        upsertData.position = String(configPayload.position);
      } else if (configPayload.positionId !== undefined) {
        upsertData.position = configPayload.positionId === "bl" ? "left" : "right";
      }

      // welcomeTitle sync: v3 headerText → legacy welcomeTitle
      if (configPayload.welcomeTitle !== undefined) {
        upsertData.welcomeTitle = String(configPayload.welcomeTitle);
      } else if (configPayload.headerText !== undefined) {
        upsertData.welcomeTitle = String(configPayload.headerText);
      }

      // welcomeMessage sync: v3 welcomeMsg → legacy welcomeMessage
      if (configPayload.welcomeMessage !== undefined) {
        upsertData.welcomeMessage = String(configPayload.welcomeMessage);
      } else if (configPayload.welcomeMsg !== undefined) {
        upsertData.welcomeMessage = String(configPayload.welcomeMsg);
      }

      // Upsert settings
      const updatedSettings = await prisma.widgetSettings.upsert({
        where: { orgId },
        create: {
          orgId,
          ...upsertData,
        },
        update: upsertData,
        select: {
          configJson: true,
          primaryColor: true,
          position: true,
          launcher: true,
          welcomeTitle: true,
          welcomeMessage: true,
          brandName: true,
        },
      });

      // Audit log (best-effort)
      writeAuditLog(
        orgId,
        `${portalUser.email}`,
        "widget.settings.updated",
        { updatedFields: Object.keys(configPayload), requestId }
      ).catch(() => {});

      // Return merged settings
      const defaults = getDefaultV3Config();
      const returnSettings = {
        ...defaults,
        ...((updatedSettings.configJson as Record<string, unknown>) || {}),
      };

      // Emit real-time event so connected widgets refresh their config instantly
      try {
        const orgInfo = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { key: true },
        });
        if (orgInfo && fastify.io) {
          // Emit to both org:id and org:key rooms so both widget and portal receive
          fastify.io.to(`org:${orgId}`).emit("widget:config-updated", {
            settings: returnSettings,
            timestamp: new Date().toISOString(),
          });
          fastify.io.to(`org:${orgInfo.key}`).emit("widget:config-updated", {
            settings: returnSettings,
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // Best-effort — don't fail the save if socket emit fails
      }

      return {
        ok: true,
        settings: returnSettings,
        requestId,
      };
    }
  );
}
