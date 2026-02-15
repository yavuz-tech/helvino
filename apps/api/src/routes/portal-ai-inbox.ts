/* ═══════════════════════════════════════════════════════════════
 * Portal AI Inbox Routes — Suggest Reply, Summarize, Translate
 * Uses timestamp field for message ordering (not createdAt)
 * Improved JSON parsing to handle markdown code fences
 * ═══════════════════════════════════════════════════════════════ */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser, requirePortalRole } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import {
  generateAiResponse,
  isAiAvailable,
  parseAiConfig,
  checkAiQuota,
  incrementAiUsage,
  type AiProvider,
} from "../utils/ai-service";

export async function portalAiInboxRoutes(fastify: FastifyInstance) {
  const sendAiFailure = (reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }, result: { error: string; code: string }) => {
    if (result.code === "RATE_LIMITED") {
      return reply.code(429).send({ error: result.error, code: "RATE_LIMITED" });
    }
    if (result.code === "QUOTA_EXCEEDED") {
      return reply.code(402).send({ error: result.error, code: "QUOTA_EXCEEDED" });
    }
    // Sanitize error: never leak internal error details to the client
    const safeError = typeof result.error === "string" && result.error.length < 200
      ? result.error
      : "AI service encountered an error";
    return reply.code(500).send({ error: safeError, code: result.code || "AI_ERROR" });
  };

  // ─── POST /portal/conversations/:id/ai-suggest ────────────────
  // Generate a single contextual AI reply suggestion
  fastify.post<{ Params: { id: string }; Body: { locale?: "tr" | "en" | "es" } }>(
    "/portal/conversations/:id/ai-suggest",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const user = (request as any).portalUser;
      if (!user) return reply.code(401).send({ error: "Unauthorized" });

      if (!isAiAvailable()) {
        return reply.code(503).send({ error: "AI service not available" });
      }

      // Check AI quota before proceeding
      const quota = await checkAiQuota(user.orgId);
      if (quota.exceeded) {
        return reply.code(402).send({ error: "AI quota exceeded", code: "QUOTA_EXCEEDED", used: quota.used, limit: quota.limit });
      }

      const { id } = request.params;
      const localeRaw = (request.body as any)?.locale;
      const locale = localeRaw === "tr" || localeRaw === "en" || localeRaw === "es" ? localeRaw : "en";

      try {
        const conv = await prisma.conversation.findFirst({
          where: { id, orgId: user.orgId },
          include: {
            messages: { orderBy: { timestamp: "asc" }, take: 20 },
          },
        });

        if (!conv) return reply.code(404).send({ error: "Conversation not found" });
        if (conv.messages.length === 0) return reply.code(400).send({ error: "No messages in conversation" });

        const org = await prisma.organization.findUnique({
          where: { id: user.orgId },
          select: { aiConfigJson: true, aiProvider: true, language: true, name: true },
        });

        const aiConfig = parseAiConfig(org?.aiConfigJson);
        if (org?.aiProvider) aiConfig.provider = org.aiProvider as AiProvider;

        const history = conv.messages
          .filter((m) => !m.content.startsWith("[note]") && !m.content.startsWith("[system]"))
          .map((m) => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          }));

        const localeLabel = locale === "tr" ? "Turkish" : locale === "es" ? "Spanish" : "English";
        const systemPrompt = `You are a customer support assistant for ${org?.name || "the company"}.
Task: Generate a professional, concise, and helpful reply suggestion for the customer's latest message.
Language: ${localeLabel}.
Rules:
- Maximum 2-3 sentences
- Professional but friendly tone
- Direct and solution-oriented
- You may use light emojis
- Return only the reply text, no explanations`;

        const result = await generateAiResponse(
          [
            {
              role: "user" as const,
              content: `${systemPrompt}\n\nConversation:\n${history
                .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
                .join("\n")}`,
            },
          ],
          {
            ...aiConfig,
            provider: "gemini",
            language: locale || aiConfig.language || org?.language || "en",
            maxTokens: 300,
            temperature: 0.6,
          }
        );

        if (!result.ok) return sendAiFailure(reply, result);

        const suggestion = result.content.replace(/```[\s\S]*?```/g, "").trim().replace(/^["']|["']$/g, "");

        // Track AI usage
        await incrementAiUsage(user.orgId);

        return {
          success: true,
          suggestion,
          model: result.model,
          provider: result.provider,
        };
      } catch (err) {
        console.error("[AI Inbox] Suggest reply failed:", err);
        return reply.code(500).send({ error: "Failed to generate suggestions" });
      }
    }
  );

  // ─── POST /portal/conversations/:id/ai-summarize ──────────────
  // Generate a 2-3 sentence summary of a conversation
  fastify.post<{ Params: { id: string } }>(
    "/portal/conversations/:id/ai-summarize",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const user = (request as any).portalUser;
      if (!user) return reply.code(401).send({ error: "Unauthorized" });

      if (!isAiAvailable()) {
        return reply.code(503).send({ error: "AI service not available" });
      }

      // Check AI quota before proceeding
      const quota = await checkAiQuota(user.orgId);
      if (quota.exceeded) {
        return reply.code(402).send({ error: "AI quota exceeded", code: "QUOTA_EXCEEDED", used: quota.used, limit: quota.limit });
      }

      const { id } = request.params;

      try {
        const conv = await prisma.conversation.findFirst({
          where: { id, orgId: user.orgId },
          include: {
            messages: { orderBy: { timestamp: "asc" }, take: 50 },
          },
        });

        if (!conv) return reply.code(404).send({ error: "Conversation not found" });
        if (conv.messages.length === 0) return reply.code(400).send({ error: "No messages to summarize" });

        const org = await prisma.organization.findUnique({
          where: { id: user.orgId },
          select: { aiConfigJson: true, aiProvider: true, language: true },
        });

        const aiConfig = parseAiConfig(org?.aiConfigJson);
        if (org?.aiProvider) aiConfig.provider = org.aiProvider as AiProvider;

        const history = conv.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const result = await generateAiResponse(
          [
            ...history,
            {
              role: "user" as const,
              content: "Summarize this entire conversation in 2-3 concise sentences. Include: the customer's main issue/question, what actions were taken, and the current status. Be brief and factual.",
            },
          ],
          {
            ...aiConfig,
            language: aiConfig.language || org?.language || "en",
            maxTokens: 300,
            temperature: 0.3,
          }
        );

        if (!result.ok) return sendAiFailure(reply, result);

        // Track AI usage
        await incrementAiUsage(user.orgId);

        return {
          ok: true,
          summary: result.content.trim(),
          messageCount: conv.messages.length,
          model: result.model,
          provider: result.provider,
        };
      } catch (err) {
        console.error("[AI Inbox] Summarize failed:", err);
        return reply.code(500).send({ error: "Failed to summarize conversation" });
      }
    }
  );

  // ─── POST /portal/conversations/:id/ai-translate ──────────────
  // Translate a specific message to the user's language
  fastify.post<{ Params: { id: string }; Body: { messageId: string; targetLanguage?: string } }>(
    "/portal/conversations/:id/ai-translate",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const user = (request as any).portalUser;
      if (!user) return reply.code(401).send({ error: "Unauthorized" });

      if (!isAiAvailable()) {
        return reply.code(503).send({ error: "AI service not available" });
      }

      // Check AI quota before proceeding
      const quota = await checkAiQuota(user.orgId);
      if (quota.exceeded) {
        return reply.code(402).send({ error: "AI quota exceeded", code: "QUOTA_EXCEEDED", used: quota.used, limit: quota.limit });
      }

      const { id } = request.params;
      const { messageId, targetLanguage = "en" } = request.body;

      if (!messageId) return reply.code(400).send({ error: "messageId is required" });

      try {
        const conv = await prisma.conversation.findFirst({
          where: { id, orgId: user.orgId },
          include: {
            messages: { where: { id: messageId }, take: 1 },
          },
        });

        if (!conv) return reply.code(404).send({ error: "Conversation not found" });
        if (conv.messages.length === 0) return reply.code(404).send({ error: "Message not found" });

        const message = conv.messages[0];
        const org = await prisma.organization.findUnique({
          where: { id: user.orgId },
          select: { aiConfigJson: true, aiProvider: true },
        });

        const aiConfig = parseAiConfig(org?.aiConfigJson);
        if (org?.aiProvider) aiConfig.provider = org.aiProvider as AiProvider;

        const langNames: Record<string, string> = {
          en: "English", tr: "Turkish", es: "Spanish", de: "German", fr: "French",
          ar: "Arabic", zh: "Chinese", ja: "Japanese", ko: "Korean", pt: "Portuguese",
          ru: "Russian", it: "Italian", nl: "Dutch",
        };

        const targetLangName = langNames[targetLanguage] || targetLanguage;

        const result = await generateAiResponse(
          [
            {
              role: "user" as const,
              content: `Translate the following message to ${targetLangName}. Only output the translated text, nothing else.\n\nMessage: "${message.content}"`,
            },
          ],
          {
            ...aiConfig,
            maxTokens: 500,
            temperature: 0.2,
          }
        );

        if (!result.ok) return sendAiFailure(reply, result);

        // Track AI usage
        await incrementAiUsage(user.orgId);

        return {
          ok: true,
          originalText: message.content,
          translatedText: result.content.trim().replace(/^["']|["']$/g, ""),
          targetLanguage,
          model: result.model,
          provider: result.provider,
        };
      } catch (err) {
        console.error("[AI Inbox] Translate failed:", err);
        return reply.code(500).send({ error: "Failed to translate message" });
      }
    }
  );

  // ─── POST /portal/conversations/:id/ai-sentiment ──────────────
  // Analyze customer sentiment (FREE tier — no plan restriction)
  fastify.post<{ Params: { id: string } }>(
    "/portal/conversations/:id/ai-sentiment",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const user = (request as any).portalUser;
      if (!user) return reply.code(401).send({ error: "Unauthorized" });
      if (!isAiAvailable()) return reply.code(503).send({ error: "AI service not available" });

      // Check AI quota before proceeding
      const quotaSentiment = await checkAiQuota(user.orgId);
      if (quotaSentiment.exceeded) {
        return reply.code(402).send({ error: "AI quota exceeded", code: "QUOTA_EXCEEDED", used: quotaSentiment.used, limit: quotaSentiment.limit });
      }

      const { id } = request.params;
      try {
        const conv = await prisma.conversation.findFirst({
          where: { id, orgId: user.orgId },
          include: { messages: { orderBy: { timestamp: "asc" }, take: 30 } },
        });
        if (!conv) return reply.code(404).send({ error: "Conversation not found" });
        if (conv.messages.length === 0) return reply.code(400).send({ error: "No messages to analyze" });

        const org = await prisma.organization.findUnique({
          where: { id: user.orgId },
          select: { aiConfigJson: true, aiProvider: true },
        });
        const aiConfig = parseAiConfig(org?.aiConfigJson);
        if (org?.aiProvider) aiConfig.provider = org.aiProvider as AiProvider;

        const history = conv.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const result = await generateAiResponse(
          [
            ...history,
            {
              role: "user" as const,
              content: `Analyze the customer's sentiment in this conversation. Respond ONLY with a valid JSON object (no markdown, no extra text):
{"sentiment":"positive|neutral|negative|frustrated","confidence":0.0-1.0,"summary":"one sentence explaining why","language":"detected language code like en, tr, es, etc.","topics":["topic1","topic2"]}`,
            },
          ],
          { ...aiConfig, maxTokens: 200, temperature: 0.2 }
        );

        if (!result.ok) return sendAiFailure(reply, result);

        // Track AI usage
        await incrementAiUsage(user.orgId);

        // Parse JSON from AI response
        try {
          const cleaned = result.content.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return {
            ok: true,
            sentiment: parsed.sentiment || "neutral",
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
            summary: parsed.summary || "",
            detectedLanguage: parsed.language || "en",
            topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5) : [],
            model: result.model,
            provider: result.provider,
          };
        } catch {
          return {
            ok: true,
            sentiment: "neutral",
            confidence: 0.5,
            summary: result.content.slice(0, 200),
            detectedLanguage: "en",
            topics: [],
            model: result.model,
            provider: result.provider,
          };
        }
      } catch (err) {
        console.error("[AI Inbox] Sentiment failed:", err);
        return reply.code(500).send({ error: "Failed to analyze sentiment" });
      }
    }
  );

  // ─── POST /portal/conversations/:id/ai-quick-reply ────────────
  // Generate a single contextual quick reply (FREE tier)
  fastify.post<{ Params: { id: string } }>(
    "/portal/conversations/:id/ai-quick-reply",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const user = (request as any).portalUser;
      if (!user) return reply.code(401).send({ error: "Unauthorized" });
      if (!isAiAvailable()) return reply.code(503).send({ error: "AI service not available" });

      // Check AI quota before proceeding
      const quotaQuickReply = await checkAiQuota(user.orgId);
      if (quotaQuickReply.exceeded) {
        return reply.code(402).send({ error: "AI quota exceeded", code: "QUOTA_EXCEEDED", used: quotaQuickReply.used, limit: quotaQuickReply.limit });
      }

      const { id } = request.params;
      try {
        const conv = await prisma.conversation.findFirst({
          where: { id, orgId: user.orgId },
          include: { messages: { orderBy: { timestamp: "asc" }, take: 20 } },
        });
        if (!conv) return reply.code(404).send({ error: "Conversation not found" });
        if (conv.messages.length === 0) return reply.code(400).send({ error: "No messages" });

        const org = await prisma.organization.findUnique({
          where: { id: user.orgId },
          select: { aiConfigJson: true, aiProvider: true, language: true },
        });
        const aiConfig = parseAiConfig(org?.aiConfigJson);
        if (org?.aiProvider) aiConfig.provider = org.aiProvider as AiProvider;

        const history = conv.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const result = await generateAiResponse(
          [
            ...history,
            {
              role: "user" as const,
              content: `Generate ONE short, helpful reply (1-2 sentences) that a support agent could send right now. Match the customer's language. Output ONLY the reply text, nothing else.`,
            },
          ],
          {
            ...aiConfig,
            language: aiConfig.language || org?.language || "en",
            maxTokens: 150,
            temperature: 0.7,
          }
        );

        if (!result.ok) return sendAiFailure(reply, result);

        // Track AI usage
        await incrementAiUsage(user.orgId);

        return { ok: true, reply: result.content.trim().replace(/^["']|["']$/g, ""), model: result.model, provider: result.provider };
      } catch (err) {
        console.error("[AI Inbox] Quick reply failed:", err);
        return reply.code(500).send({ error: "Failed to generate quick reply" });
      }
    }
  );
}
