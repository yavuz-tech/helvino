/* ═══════════════════════════════════════════════════════════════
 * Helvino AI Service — Multi-Provider (OpenAI + Gemini + Claude)
 * ═══════════════════════════════════════════════════════════════
 * Supports OpenAI, Google Gemini, and Anthropic Claude.
 * Includes quota tracking, auto-reset, and plan-based limits.
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
} | {
  ok: false;
  error: string;
  code: "NO_API_KEY" | "AI_DISABLED" | "GENERATION_FAILED" | "RATE_LIMITED" | "QUOTA_EXCEEDED";
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

/* ── Plan Limits ── */

const PLAN_AI_LIMITS: Record<string, number> = {
  free: 100,
  starter: 500,
  pro: 2000,
  growth: 2000,
  business: 5000,
  enterprise: -1, // unlimited
};

export function getAiLimitForPlan(planKey: string): number {
  return PLAN_AI_LIMITS[planKey] ?? PLAN_AI_LIMITS.free;
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

/** Check if any AI provider is available */
export function isAiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/** Check which providers are available */
export function getAvailableProviders(): { id: AiProvider; name: string; available: boolean }[] {
  return [
    { id: "openai", name: "OpenAI", available: Boolean(process.env.OPENAI_API_KEY) },
    { id: "gemini", name: "Google Gemini", available: Boolean(process.env.GEMINI_API_KEY) },
    { id: "claude", name: "Anthropic Claude", available: Boolean(process.env.ANTHROPIC_API_KEY) },
  ];
}

/** Get available models for all providers */
export function getAvailableModels() {
  return [
    // OpenAI
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" as AiProvider, description: "Fast & affordable", recommended: true, available: Boolean(process.env.OPENAI_API_KEY) },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai" as AiProvider, description: "Most capable", recommended: false, available: Boolean(process.env.OPENAI_API_KEY) },
    // Gemini
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "gemini" as AiProvider, description: "Fast & free tier", recommended: true, available: Boolean(process.env.GEMINI_API_KEY) },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "gemini" as AiProvider, description: "Advanced reasoning", recommended: false, available: Boolean(process.env.GEMINI_API_KEY) },
    // Claude
    { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", provider: "claude" as AiProvider, description: "Fast & efficient", recommended: true, available: Boolean(process.env.ANTHROPIC_API_KEY) },
    { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", provider: "claude" as AiProvider, description: "Best quality", recommended: false, available: Boolean(process.env.ANTHROPIC_API_KEY) },
  ];
}

/* ── Quota Management ── */

/** Check and auto-reset AI quota if needed. Returns current quota status. */
export async function checkAiQuota(orgId: string): Promise<AiQuotaStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currentMonthAIMessages: true, aiMessagesLimit: true, aiMessagesResetDate: true, planKey: true },
  });

  if (!org) {
    return { used: 0, limit: 100, remaining: 100, isUnlimited: false, exceeded: false, resetDate: new Date().toISOString(), daysUntilReset: 30, percentUsed: 0 };
  }

  // Auto-reset if 30 days have passed
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

/** Increment AI message counter after successful response */
export async function incrementAiUsage(orgId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { currentMonthAIMessages: { increment: 1 } },
  });
}

/* ── Generate AI Response (Multi-Provider) ── */

export async function generateAiResponse(
  messages: ConversationMessage[],
  config: Partial<AiConfig> = {},
): Promise<AiGenerateResult> {
  const cfg: AiConfig = { ...DEFAULT_AI_CONFIG, ...config };
  const provider = cfg.provider || "openai";

  // Build system prompt
  const systemPrompt = [
    cfg.systemPrompt,
    TONE_INSTRUCTIONS[cfg.tone],
    cfg.language !== "en" ? `Respond in the same language as the customer. If the customer writes in ${cfg.language}, respond in ${cfg.language}.` : "",
  ].filter(Boolean).join("\n\n");

  try {
    switch (provider) {
      case "openai":
        return await generateOpenAI(messages, systemPrompt, cfg);
      case "gemini":
        return await generateGemini(messages, systemPrompt, cfg);
      case "claude":
        return await generateClaude(messages, systemPrompt, cfg);
      default:
        return await generateOpenAI(messages, systemPrompt, cfg);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown AI error";
    console.error(`[AI/${provider}] Generation failed:`, msg);
    if (msg.includes("Rate limit") || msg.includes("rate_limit")) {
      return { ok: false, error: "AI rate limit exceeded.", code: "RATE_LIMITED" };
    }
    return { ok: false, error: msg, code: "GENERATION_FAILED" };
  }
}

/* ── OpenAI Provider ── */
async function generateOpenAI(messages: ConversationMessage[], systemPrompt: string, cfg: AiConfig): Promise<AiGenerateResult> {
  const openai = getOpenAI();
  if (!openai) return { ok: false, error: "OpenAI API key not configured", code: "NO_API_KEY" };

  const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const completion = await openai.chat.completions.create({
    model: cfg.model || "gpt-4o-mini",
    messages: chatMessages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    presence_penalty: 0.1,
    frequency_penalty: 0.1,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) return { ok: false, error: "Empty response", code: "GENERATION_FAILED" };

  return { ok: true, content, model: completion.model, provider: "openai", tokensUsed: completion.usage?.total_tokens ?? 0 };
}

/* ── Gemini Provider ── */
async function generateGemini(messages: ConversationMessage[], systemPrompt: string, cfg: AiConfig): Promise<AiGenerateResult> {
  const gemini = getGemini();
  if (!gemini) return { ok: false, error: "Gemini API key not configured", code: "NO_API_KEY" };

  const model = gemini.getGenerativeModel({
    model: cfg.model || "gemini-1.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: { temperature: cfg.temperature, maxOutputTokens: cfg.maxTokens },
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  const lastMsg = messages[messages.length - 1];
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastMsg?.content || "Hello");
  const content = result.response.text()?.trim();

  if (!content) return { ok: false, error: "Empty response from Gemini", code: "GENERATION_FAILED" };

  return { ok: true, content, model: cfg.model || "gemini-1.5-flash", provider: "gemini", tokensUsed: 0 };
}

/* ── Claude Provider ── */
async function generateClaude(messages: ConversationMessage[], systemPrompt: string, cfg: AiConfig): Promise<AiGenerateResult> {
  const anthropic = getAnthropic();
  if (!anthropic) return { ok: false, error: "Anthropic API key not configured", code: "NO_API_KEY" };

  const claudeMessages = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" as const : "user" as const,
    content: m.content,
  }));

  const response = await anthropic.messages.create({
    model: cfg.model || "claude-3-5-haiku-latest",
    max_tokens: cfg.maxTokens,
    system: systemPrompt,
    messages: claudeMessages,
    temperature: cfg.temperature,
  });

  const content = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  if (!content) return { ok: false, error: "Empty response from Claude", code: "GENERATION_FAILED" };

  const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
  return { ok: true, content, model: cfg.model || "claude-3-5-haiku-latest", provider: "claude", tokensUsed };
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
