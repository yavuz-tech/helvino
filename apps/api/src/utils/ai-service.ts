/* ═══════════════════════════════════════════════════════════════
 * Helvion AI Service — Multi-Provider with Fallback Chain
 * ═══════════════════════════════════════════════════════════════
 * Supports OpenAI, Google Gemini, and Anthropic Claude.
 * Features: quota tracking, provider fallback, cost calculation,
 * response timing, and plan-based routing.
 * Updated: Gemini 2.0 Flash models + seamless provider fallback
 * ═══════════════════════════════════════════════════════════════ */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";

/* ── Types ── */

export type AiProvider = "openai" | "gemini" | "claude";

export interface AiConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  autoReplyEnabled: boolean;
  greeting: string;
  fallbackMessage: string;
  tone: "professional" | "friendly" | "casual";
  language: string;
  provider: AiProvider;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type AiGenerateResult = {
  ok: true;
  content: string;
  model: string;
  provider: AiProvider;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;          // USD
  responseTimeMs: number;
} | {
  ok: false;
  error: string;
  code: "NO_API_KEY" | "AI_DISABLED" | "GENERATION_FAILED" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "ALL_PROVIDERS_FAILED";
};

export interface AiQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  exceeded: boolean;
  resetDate: string;
  daysUntilReset: number;
  percentUsed: number;
}

/* ── Default Config ── */

export const DEFAULT_AI_CONFIG: AiConfig = {
  systemPrompt: `You are a helpful customer support assistant for the company. Be concise, professional, and helpful. If you don't know the answer, politely let the customer know and suggest they wait for a human agent. Always be empathetic and solution-oriented.`,
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 500,
  autoReplyEnabled: true,
  greeting: "Hi there! I'm an AI assistant. How can I help you today?",
  fallbackMessage: "I'm not sure about that. Let me connect you with a human agent who can help better.",
  tone: "professional",
  language: "en",
  provider: "openai",
};

const TONE_INSTRUCTIONS: Record<AiConfig["tone"], string> = {
  professional: "Maintain a professional, courteous tone. Be clear and concise.",
  friendly: "Be warm, friendly and conversational. Use a helpful, approachable tone.",
  casual: "Be casual and relaxed. Use simple language and feel free to use light humor.",
};

/* ── Language Helpers ── */

const LANG_NAMES: Record<string, string> = {
  en: "English", tr: "Turkish", es: "Spanish", de: "German", fr: "French",
  ar: "Arabic", zh: "Chinese", ja: "Japanese", ko: "Korean", pt: "Portuguese",
  ru: "Russian", it: "Italian", nl: "Dutch", pl: "Polish", sv: "Swedish",
  da: "Danish", fi: "Finnish", no: "Norwegian", cs: "Czech", hu: "Hungarian",
  ro: "Romanian", bg: "Bulgarian", uk: "Ukrainian", hi: "Hindi", th: "Thai",
  vi: "Vietnamese", id: "Indonesian", ms: "Malay", he: "Hebrew", el: "Greek",
};

function getLangName(code: string): string {
  return LANG_NAMES[code.toLowerCase().split("-")[0]] || code;
}

/** Build a smart language instruction for the system prompt */
function buildLanguageInstruction(langCode: string): string {
  const langName = getLangName(langCode);
  return [
    `LANGUAGE RULES (CRITICAL — follow these exactly):`,
    `• Your DEFAULT language is ${langName} (${langCode}).`,
    `• ALWAYS detect the language the customer is writing in.`,
    `• ALWAYS reply in the SAME language the customer used in their last message.`,
    `• If the customer writes in Turkish, respond in Turkish. If they write in Spanish, respond in Spanish. And so on.`,
    `• If you cannot detect the language, fall back to ${langName}.`,
    `• Never mix languages in a single response.`,
    `• Greetings, apologies, closing lines — all must be in the customer's language.`,
  ].join("\n");
}

/* ── Cost Pricing (USD per 1M tokens) ── */

const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini":               { input: 0.15,  output: 0.60 },
  "gpt-4o":                    { input: 2.50,  output: 10.00 },
  "gpt-3.5-turbo":             { input: 0.50,  output: 1.50 },
  "gemini-2.5-flash":          { input: 0.15,  output: 0.60 },
  "gemini-2.0-flash":          { input: 0.10,  output: 0.40 },
  "gemini-2.0-flash-lite":     { input: 0.075, output: 0.30 },
  "gemini-1.5-pro":            { input: 1.25,  output: 5.00 },
  "gemini-1.5-flash":          { input: 0.075, output: 0.30 },  // legacy
  "claude-3-5-haiku-latest":   { input: 0.25,  output: 1.25 },
  "claude-3-5-sonnet-latest":  { input: 3.00,  output: 15.00 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/* ── Plan Limits ── */

const PLAN_AI_LIMITS: Record<string, number> = {
  free: 100,
  pro: 2000,
  business: 5000,
};

export function getAiLimitForPlan(planKey: string): number {
  return PLAN_AI_LIMITS[planKey] ?? PLAN_AI_LIMITS.free;
}

/* ── Plan-Based Provider & Model Routing ── */

export function getDefaultProviderForPlan(planKey: string): AiProvider {
  switch (planKey) {
    case "free":       return "gemini";   // cheapest
    case "pro":        return "openai";   // quality
    case "business":   return "openai";   // premium
    default:           return "openai";
  }
}

export function getDefaultModelForPlan(planKey: string, provider: AiProvider): string {
  if (provider === "gemini") {
    return planKey === "free" ? "gemini-2.5-flash" : "gemini-2.5-flash";
  }
  if (provider === "openai") {
    return planKey === "business" ? "gpt-4o" : "gpt-4o-mini";
  }
  if (provider === "claude") {
    return planKey === "business" ? "claude-3-5-sonnet-latest" : "claude-3-5-haiku-latest";
  }
  return "gpt-4o-mini";
}

/* ── Provider Singletons ── */

let _openai: OpenAI | null = null;
let _gemini: GoogleGenerativeAI | null = null;
let _anthropic: Anthropic | null = null;

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: key });
  return _openai;
}

function getGemini(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_gemini) _gemini = new GoogleGenerativeAI(key);
  return _gemini;
}

function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

export function isAiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export function getAvailableProviders(): { id: AiProvider; name: string; available: boolean }[] {
  return [
    { id: "openai", name: "OpenAI", available: Boolean(process.env.OPENAI_API_KEY) },
    { id: "gemini", name: "Google Gemini", available: Boolean(process.env.GEMINI_API_KEY) },
    { id: "claude", name: "Anthropic Claude", available: Boolean(process.env.ANTHROPIC_API_KEY) },
  ];
}

export function getAvailableModels() {
  return [
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" as AiProvider, description: "Fast & affordable", recommended: true, available: Boolean(process.env.OPENAI_API_KEY) },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai" as AiProvider, description: "Most capable", recommended: false, available: Boolean(process.env.OPENAI_API_KEY) },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini" as AiProvider, description: "Latest & fastest", recommended: true, available: Boolean(process.env.GEMINI_API_KEY) },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini" as AiProvider, description: "Fast & affordable", recommended: false, available: Boolean(process.env.GEMINI_API_KEY) },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", provider: "gemini" as AiProvider, description: "Ultra fast & free tier", recommended: false, available: Boolean(process.env.GEMINI_API_KEY) },
    { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", provider: "claude" as AiProvider, description: "Fast & efficient", recommended: true, available: Boolean(process.env.ANTHROPIC_API_KEY) },
    { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", provider: "claude" as AiProvider, description: "Best quality", recommended: false, available: Boolean(process.env.ANTHROPIC_API_KEY) },
  ];
}

/* ── Quota Management ── */

export async function checkAiQuota(orgId: string): Promise<AiQuotaStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currentMonthAIMessages: true, aiMessagesLimit: true, aiMessagesResetDate: true, planKey: true },
  });

  if (!org) {
    return { used: 0, limit: 100, remaining: 100, isUnlimited: false, exceeded: false, resetDate: new Date().toISOString(), daysUntilReset: 30, percentUsed: 0 };
  }

  const resetDate = new Date(org.aiMessagesResetDate);
  const now = new Date();
  const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceReset >= 30) {
    const newLimit = getAiLimitForPlan(org.planKey);
    await prisma.organization.update({
      where: { id: orgId },
      data: { currentMonthAIMessages: 0, aiMessagesResetDate: now, aiMessagesLimit: newLimit },
    });
    return { used: 0, limit: newLimit, remaining: newLimit, isUnlimited: newLimit === -1, exceeded: false, resetDate: now.toISOString(), daysUntilReset: 30, percentUsed: 0 };
  }

  const limit = org.aiMessagesLimit;
  const used = org.currentMonthAIMessages;
  const isUnlimited = limit === -1;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - used);
  const exceeded = !isUnlimited && used >= limit;
  const daysUntilReset = Math.max(0, 30 - daysSinceReset);
  const percentUsed = isUnlimited ? 0 : limit > 0 ? Math.round((used / limit) * 100) : 100;

  return { used, limit, remaining: isUnlimited ? -1 : remaining, isUnlimited, exceeded, resetDate: resetDate.toISOString(), daysUntilReset, percentUsed };
}

export async function incrementAiUsage(orgId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { currentMonthAIMessages: { increment: 1 } },
  });
}

/* ═══════════════════════════════════════════════════════════════
 * Generate AI Response — WITH FALLBACK CHAIN
 * ═══════════════════════════════════════════════════════════════
 * Tries the primary provider first, then falls back to others.
 * Tracks response time and calculates cost.
 * ═══════════════════════════════════════════════════════════════ */

export async function generateAiResponse(
  messages: ConversationMessage[],
  config: Partial<AiConfig> = {},
): Promise<AiGenerateResult> {
  const cfg: AiConfig = { ...DEFAULT_AI_CONFIG, ...config };

  // Smart provider resolution: if the configured provider has no API key,
  // silently switch to an available one BEFORE starting the fallback chain.
  // This ensures the customer never sees a "provider unavailable" error.
  let primaryProvider = cfg.provider || "openai";
  const providerHasKey = (p: AiProvider) =>
    (p === "openai" && !!process.env.OPENAI_API_KEY) ||
    (p === "gemini" && !!process.env.GEMINI_API_KEY) ||
    (p === "claude" && !!process.env.ANTHROPIC_API_KEY);

  if (!providerHasKey(primaryProvider)) {
    // Find the first available provider
    const available = (["gemini", "openai", "claude"] as AiProvider[]).find(providerHasKey);
    if (available) {
      console.info(`[AI] Configured provider "${primaryProvider}" unavailable, using "${available}" instead`);
      primaryProvider = available;
      // Also fix the model to match the new provider
      cfg.model = getDefaultModelForPlan("free", available);
    }
  }

  // Build system prompt with smart language awareness
  const systemPrompt = [
    cfg.systemPrompt,
    TONE_INSTRUCTIONS[cfg.tone],
    buildLanguageInstruction(cfg.language || "en"),
    `RESPONSE GUIDELINES:`,
    `• Keep responses concise (2-4 sentences for simple questions, more for complex ones).`,
    `• If the customer seems frustrated, acknowledge their feelings first before offering solutions.`,
    `• If you truly cannot help, say so clearly and let them know a human agent will follow up.`,
    `• Never fabricate information. If unsure, be honest about it.`,
    `• Use the customer's name if available in the conversation.`,
  ].filter(Boolean).join("\n\n");

  // Build fallback chain: primary → others (deduped)
  const fallbackOrder: AiProvider[] = [primaryProvider, "openai", "gemini", "claude"]
    .filter((v, i, a) => a.indexOf(v) === i) as AiProvider[];

  const startTime = Date.now();
  let sawRateLimit = false;
  let lastRateLimitMessage = "";

  for (const provider of fallbackOrder) {
    // Skip providers without API keys
    if (provider === "openai" && !process.env.OPENAI_API_KEY) continue;
    if (provider === "gemini" && !process.env.GEMINI_API_KEY) continue;
    if (provider === "claude" && !process.env.ANTHROPIC_API_KEY) continue;

    try {
      let result: AiGenerateResult;

      switch (provider) {
        case "openai":
          result = await generateOpenAI(messages, systemPrompt, cfg);
          break;
        case "gemini":
          result = await generateGemini(messages, systemPrompt, cfg);
          break;
        case "claude":
          result = await generateClaude(messages, systemPrompt, cfg);
          break;
        default:
          continue;
      }

      if (result.ok) {
        const responseTimeMs = Date.now() - startTime;
        const cost = calculateCost(result.model, result.inputTokens, result.outputTokens);
        console.info(`[AI] Response generated by: ${provider} (${result.model}) in ${responseTimeMs}ms, tokens: ${result.tokensUsed}, cost: $${cost.toFixed(6)}`);
        return { ...result, cost, responseTimeMs };
      }

      if (!result.ok && result.code === "RATE_LIMITED") {
        sawRateLimit = true;
        lastRateLimitMessage = result.error;
      }

      // NO_API_KEY means skip to next provider
      if (!result.ok && result.code === "NO_API_KEY") continue;

      // For other errors, log and try next
      console.warn(`[AI] Provider ${provider} failed: ${result.error}, trying next...`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn(`[AI] Provider ${provider} threw exception: ${msg}, trying next...`);

      if (msg.includes("Rate limit") || msg.includes("rate_limit") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
        sawRateLimit = true;
        lastRateLimitMessage = msg;
        // Rate limited on this provider, try next
        continue;
      }
    }
  }

  if (sawRateLimit) {
    return {
      ok: false,
      error: lastRateLimitMessage || "AI yanıt limiti aşıldı, birkaç saniye bekleyip tekrar deneyin.",
      code: "RATE_LIMITED",
    };
  }

  console.error("[AI] All providers failed");
  return { ok: false, error: "All AI providers failed", code: "ALL_PROVIDERS_FAILED" };
}

/* ── OpenAI Provider ── */
async function generateOpenAI(messages: ConversationMessage[], systemPrompt: string, cfg: AiConfig): Promise<AiGenerateResult> {
  const openai = getOpenAI();
  if (!openai) return { ok: false, error: "OpenAI API key not configured", code: "NO_API_KEY" };

  const model = cfg.model && cfg.model.startsWith("gpt") ? cfg.model : "gpt-4o-mini";
  const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const completion = await openai.chat.completions.create({
    model,
    messages: chatMessages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    presence_penalty: 0.1,
    frequency_penalty: 0.1,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) return { ok: false, error: "Empty response", code: "GENERATION_FAILED" };

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const tokensUsed = completion.usage?.total_tokens ?? 0;

  return { ok: true, content, model: completion.model, provider: "openai", tokensUsed, inputTokens, outputTokens, cost: 0, responseTimeMs: 0 };
}

/* ── Gemini Provider (with retry for rate limits) ── */
async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const maybeError = error as { status?: number; message?: string };
      const status = maybeError?.status;
      const message = maybeError?.message || "";
      const isRateLimit = status === 429 || message.includes("RESOURCE_EXHAUSTED") || message.includes("429");

      if (!isRateLimit || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`[Gemini] Rate limited, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Gemini retry exhausted");
}

async function generateGemini(messages: ConversationMessage[], systemPrompt: string, cfg: AiConfig): Promise<AiGenerateResult> {
  const gemini = getGemini();
  if (!gemini) return { ok: false, error: "Gemini API key not configured", code: "NO_API_KEY" };

  // Map deprecated/unavailable model names to current ones
  let modelId = cfg.model && cfg.model.startsWith("gemini") ? cfg.model : "gemini-2.5-flash";
  // Upgrade deprecated models to latest
  if (modelId === "gemini-1.5-flash" || modelId === "gemini-2.0-flash") modelId = "gemini-2.5-flash";

  try {
    const model = gemini.getGenerativeModel({
      model: modelId,
      systemInstruction: systemPrompt,
      generationConfig: { temperature: cfg.temperature, maxOutputTokens: cfg.maxTokens },
    });

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

    const lastMsg = messages[messages.length - 1];
    const chat = model.startChat({ history });
    const result = await callGeminiWithRetry(() => chat.sendMessage(lastMsg?.content || "Hello"), 3, 2000);
    const content = result.response.text()?.trim();
    if (!content) return { ok: false, error: "Empty response from Gemini", code: "GENERATION_FAILED" };

    const usageMetadata = result.response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
    const tokensUsed = inputTokens + outputTokens;

    return { ok: true, content, model: modelId, provider: "gemini", tokensUsed, inputTokens, outputTokens, cost: 0, responseTimeMs: 0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("Too Many Requests");
    if (isRateLimit) {
      return { ok: false, error: "AI yanıt limiti aşıldı, birkaç saniye bekleyip tekrar deneyin.", code: "RATE_LIMITED" };
    }
    throw err;
  }
}

/* ── Claude Provider ── */
async function generateClaude(messages: ConversationMessage[], systemPrompt: string, cfg: AiConfig): Promise<AiGenerateResult> {
  const anthropic = getAnthropic();
  if (!anthropic) return { ok: false, error: "Anthropic API key not configured", code: "NO_API_KEY" };

  const modelId = cfg.model && cfg.model.startsWith("claude") ? cfg.model : "claude-3-5-haiku-latest";
  const claudeMessages = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" as const : "user" as const,
    content: m.content,
  }));

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: cfg.maxTokens,
    system: systemPrompt,
    messages: claudeMessages,
    temperature: cfg.temperature,
  });

  const content = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  if (!content) return { ok: false, error: "Empty response from Claude", code: "GENERATION_FAILED" };

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const tokensUsed = inputTokens + outputTokens;

  return { ok: true, content, model: modelId, provider: "claude", tokensUsed, inputTokens, outputTokens, cost: 0, responseTimeMs: 0 };
}

/* ── Helpers ── */

export function generateGreeting(config: Partial<AiConfig> = {}): string {
  const cfg: AiConfig = { ...DEFAULT_AI_CONFIG, ...config };
  return cfg.greeting;
}

export function parseAiConfig(json: unknown): AiConfig {
  if (!json || typeof json !== "object") return { ...DEFAULT_AI_CONFIG };
  const obj = json as Record<string, unknown>;
  return {
    systemPrompt: typeof obj.systemPrompt === "string" ? obj.systemPrompt : DEFAULT_AI_CONFIG.systemPrompt,
    model: typeof obj.model === "string" ? obj.model : DEFAULT_AI_CONFIG.model,
    temperature: typeof obj.temperature === "number" ? obj.temperature : DEFAULT_AI_CONFIG.temperature,
    maxTokens: typeof obj.maxTokens === "number" ? obj.maxTokens : DEFAULT_AI_CONFIG.maxTokens,
    autoReplyEnabled: typeof obj.autoReplyEnabled === "boolean" ? obj.autoReplyEnabled : DEFAULT_AI_CONFIG.autoReplyEnabled,
    greeting: typeof obj.greeting === "string" ? obj.greeting : DEFAULT_AI_CONFIG.greeting,
    fallbackMessage: typeof obj.fallbackMessage === "string" ? obj.fallbackMessage : DEFAULT_AI_CONFIG.fallbackMessage,
    tone: ["professional", "friendly", "casual"].includes(obj.tone as string) ? (obj.tone as AiConfig["tone"]) : DEFAULT_AI_CONFIG.tone,
    language: typeof obj.language === "string" ? obj.language : DEFAULT_AI_CONFIG.language,
    provider: ["openai", "gemini", "claude"].includes(obj.provider as string) ? (obj.provider as AiProvider) : DEFAULT_AI_CONFIG.provider,
  };
}
