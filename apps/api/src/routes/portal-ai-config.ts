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
import {
  parseAiConfig,
  isAiAvailable,
  generateAiResponse,
  checkAiQuota,
  getAvailableProviders,
  getAvailableModels,
  DEFAULT_AI_CONFIG,
  type AiConfig,
  type AiProvider,
} from "../utils/ai-service";

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
    { preHandler: [requirePortalUser, requirePortalRole(["owner", "admin"])] },
    async (request, reply) => {
      const user = request.portalUser!;
      const body = request.body;

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { aiConfigJson: true, aiEnabled: true, aiProvider: true },
      });
      if (!org) { reply.code(404); return { error: "Organization not found" }; }

      const currentConfig = parseAiConfig(org.aiConfigJson);

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
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { planKey: true },
      });
      return { ...quota, plan: org?.planKey ?? "free" };
    }
  );

  // ─── POST /portal/ai/test ────────────────────────
  fastify.post<{ Body: { message: string; provider?: AiProvider } }>(
    "/portal/ai/test",
    { preHandler: [requirePortalUser, requirePortalRole(["owner", "admin"])] },
    async (request, reply) => {
      const user = request.portalUser!;
      const { message, provider } = request.body;

      if (!message?.trim()) { reply.code(400); return { error: "Message is required" }; }

      if (!isAiAvailable()) {
        reply.code(503);
        return { error: "AI service not available. No API keys configured." };
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
        reply.code(500);
        return { error: result.error, code: result.code };
      }

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
