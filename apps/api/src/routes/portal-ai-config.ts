/* ═══════════════════════════════════════════════════════════════
 * Portal AI Configuration Routes
 * ═══════════════════════════════════════════════════════════════
 * GET  /portal/ai/config   — Read AI config for the org
 * PUT  /portal/ai/config   — Update AI config
 * GET  /portal/ai/status   — AI service health & availability
 * GET  /portal/ai/quota    — AI usage quota for current period
 * POST /portal/ai/test     — Test AI with a sample prompt
 * ═══════════════════════════════════════════════════════════════ */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser, requirePortalRole } from "../middleware/require-portal-user";
import { validateJsonContentType } from "../middleware/validation";
import {
  parseAiConfig,
  isAiAvailable,
  generateAiResponse,
  checkAiQuota,
  incrementAiUsage,
  getAvailableProviders,
  getAvailableModels,
  DEFAULT_AI_CONFIG,
  type AiConfig,
  type AiProvider,
} from "../utils/ai-service";
import { checkM2Entitlement } from "../utils/entitlements";
import { createRateLimitMiddleware } from "../middleware/rate-limit";

export async function portalAiConfigRoutes(fastify: FastifyInstance) {

  // ─── GET /portal/ai/config ────────────────────────
  fastify.get(
    "/portal/ai/config",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { aiEnabled: true, aiConfigJson: true, aiProvider: true, language: true },
      });

      if (!org) return { error: "Organization not found" };

      const config = parseAiConfig(org.aiConfigJson);
      return {
        aiEnabled: org.aiEnabled,
        aiProvider: org.aiProvider,
        config,
        defaults: DEFAULT_AI_CONFIG,
        available: isAiAvailable(),
        providers: getAvailableProviders(),
        models: getAvailableModels(),
      };
    }
  );

  // ─── PUT /portal/ai/config ────────────────────────
  fastify.put<{ Body: Partial<AiConfig> & { aiEnabled?: boolean; aiProvider?: AiProvider } }>(
    "/portal/ai/config",
    { preHandler: [requirePortalUser, requirePortalRole(["owner", "admin"]), validateJsonContentType] },
    async (request, reply) => {
      const user = request.portalUser!;
      const body = request.body;

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { aiConfigJson: true, aiEnabled: true, aiProvider: true, planKey: true },
      });
      if (!org) { reply.code(404); return { error: "Organization not found" }; }

      const currentConfig = parseAiConfig(org.aiConfigJson);

      // Plan-based provider restriction: free/starter locked to gemini
      const orgPlanKey = (org.planKey || "free").toLowerCase();
      const orgTier = orgPlanKey === "business" || orgPlanKey === "enterprise" ? 3
        : orgPlanKey === "pro" ? 2
        : orgPlanKey === "starter" ? 1 : 0;
      if (orgTier < 2 && body.aiProvider && body.aiProvider !== "gemini") {
        body.aiProvider = "gemini" as AiProvider;
      }
      if (orgTier < 2 && body.provider && body.provider !== "gemini") {
        body.provider = "gemini" as AiProvider;
      }

      // SECURITY: Input validation — max lengths for AI config string fields
      if (body.systemPrompt !== undefined && typeof body.systemPrompt === "string" && body.systemPrompt.length > 10000) {
        reply.code(400); return { error: "systemPrompt exceeds maximum length (10000 characters)" };
      }
      if (body.greeting !== undefined && typeof body.greeting === "string" && body.greeting.length > 1000) {
        reply.code(400); return { error: "greeting exceeds maximum length (1000 characters)" };
      }
      if (body.fallbackMessage !== undefined && typeof body.fallbackMessage === "string" && body.fallbackMessage.length > 1000) {
        reply.code(400); return { error: "fallbackMessage exceeds maximum length (1000 characters)" };
      }

      const newConfig: AiConfig = {
        ...currentConfig,
        ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt }),
        ...(body.model !== undefined && { model: body.model }),
        ...(body.temperature !== undefined && { temperature: Math.min(2, Math.max(0, body.temperature)) }),
        ...(body.maxTokens !== undefined && { maxTokens: Math.min(2000, Math.max(50, body.maxTokens)) }),
        ...(body.autoReplyEnabled !== undefined && { autoReplyEnabled: body.autoReplyEnabled }),
        ...(body.greeting !== undefined && { greeting: body.greeting }),
        ...(body.fallbackMessage !== undefined && { fallbackMessage: body.fallbackMessage }),
        ...(body.tone !== undefined && ["professional", "friendly", "casual"].includes(body.tone)
          ? { tone: body.tone } : {}),
        ...(body.language !== undefined && { language: body.language }),
        ...(body.provider !== undefined && ["openai", "gemini", "claude"].includes(body.provider)
          ? { provider: body.provider } : {}),
      };

      const updateData: Record<string, unknown> = {
        aiConfigJson: newConfig as unknown as Record<string, unknown>,
      };
      if (typeof body.aiEnabled === "boolean") updateData.aiEnabled = body.aiEnabled;
      if (body.aiProvider && ["openai", "gemini", "claude"].includes(body.aiProvider)) {
        updateData.aiProvider = body.aiProvider;
      }

      await prisma.organization.update({
        where: { id: user.orgId },
        data: updateData,
      });

      return {
        ok: true,
        aiEnabled: typeof body.aiEnabled === "boolean" ? body.aiEnabled : org.aiEnabled,
        aiProvider: body.aiProvider || org.aiProvider,
        config: newConfig,
      };
    }
  );

  // ─── GET /portal/ai/status ────────────────────────
  fastify.get(
    "/portal/ai/status",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { aiEnabled: true, aiProvider: true, planKey: true },
      });

      return {
        available: isAiAvailable(),
        aiEnabled: org?.aiEnabled ?? false,
        aiProvider: org?.aiProvider ?? "openai",
        plan: org?.planKey ?? "free",
        providers: getAvailableProviders(),
        models: getAvailableModels(),
      };
    }
  );

  // ─── GET /portal/ai/quota ────────────────────────
  fastify.get(
    "/portal/ai/quota",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const quota = await checkAiQuota(user.orgId);
      const m2 = await checkM2Entitlement(user.orgId);
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { planKey: true },
      });
      return { ...quota, plan: org?.planKey ?? "free", m2 };
    }
  );

  // ─── POST /portal/ai/test ────────────────────────
  fastify.post<{ Body: { message: string; provider?: AiProvider } }>(
    "/portal/ai/test",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        createRateLimitMiddleware({ limit: 10, windowMs: 60_000, routeName: "ai.test" }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const user = request.portalUser!;
      const { message, provider } = request.body;

      if (!message?.trim()) { reply.code(400); return { error: "Message is required" }; }
      if (message.length > 5000) { reply.code(400); return { error: "Message exceeds maximum length (5000 characters)" }; }

      if (!isAiAvailable()) {
        reply.code(503);
        return { error: "AI service not available. No API keys configured." };
      }

      // SECURITY: Enforce AI quota even for test endpoint to prevent unlimited usage
      const quota = await checkAiQuota(user.orgId);
      if (quota.exceeded) {
        reply.code(402);
        return { error: "AI quota exceeded", code: "QUOTA_EXCEEDED", used: quota.used, limit: quota.limit };
      }

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { aiConfigJson: true, aiProvider: true, language: true },
      });

      const config = parseAiConfig(org?.aiConfigJson);
      if (provider) config.provider = provider;
      else if (org?.aiProvider) config.provider = org.aiProvider as AiProvider;

      const result = await generateAiResponse(
        [{ role: "user", content: message.trim() }],
        { ...config, language: config.language || org?.language || "en" },
      );

      if (!result.ok) {
        if (result.code === "RATE_LIMITED") {
          reply.code(429);
          return { error: result.error, code: "RATE_LIMITED" };
        }
        if (result.code === "QUOTA_EXCEEDED") {
          reply.code(402);
          return { error: result.error, code: "QUOTA_EXCEEDED" };
        }
        reply.code(500);
        // SECURITY: never leak upstream/provider error details to the client
        return { error: "AI service encountered an error", code: result.code || "AI_ERROR" };
      }

      // Track AI usage for test calls too
      await incrementAiUsage(user.orgId);

      return {
        ok: true,
        response: result.content,
        model: result.model,
        provider: result.provider,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        responseTimeMs: result.responseTimeMs,
      };
    }
  );
}
