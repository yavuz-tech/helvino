export type PlanKey = "free" | "starter" | "pro" | "business";

export type FeatureKey =
  | "ai_inbox"
  | "ai_config"
  | "ai_persona"
  | "ai_suggestions"
  | "workflows"
  | "macros"
  | "billing_checkout"
  | "billing_portal"
  | "custom_css"
  | "page_rules"
  | "pre_chat_form"
  | "csat"
  | "white_label"
  | "remove_branding"
  | "audit_log"
  | "auto_reply"
  | "working_hours"
  | "file_sharing"
  | "read_receipts"
  | "transcript_email"
  | "priority_support"
  | "sla"
  | "custom_domains"
  | "api_keys";

function normalizePlanKey(input: unknown): PlanKey {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "free";
  if (raw === "starter" || raw === "pro" || raw === "business") return raw;
  return "free";
}

export function planTier(planKey: unknown): number {
  switch (normalizePlanKey(planKey)) {
    case "free":
      return 0;
    case "starter":
      return 1;
    case "pro":
      return 2;
    case "business":
      return 3;
  }
}

/**
 * Minimum plan required for each feature.
 * Keep this aligned with the pricing/plan comparison tables.
 */
export const FEATURE_MIN_PLAN: Record<FeatureKey, PlanKey> = {
  // Free-tier features (quotas still apply)
  ai_inbox: "free",
  ai_config: "free",
  billing_checkout: "free",
  billing_portal: "free",

  // Free-tier: file sharing (profile pics, attachments)
  file_sharing: "free",

  // Starter+ features
  auto_reply: "starter",
  working_hours: "starter",
  read_receipts: "starter",
  transcript_email: "starter",
  workflows: "starter",
  macros: "starter",

  // Starter+ (branding removal)
  remove_branding: "starter",

  // Pro+ features
  ai_persona: "pro",
  ai_suggestions: "pro",
  custom_css: "pro",
  page_rules: "pro",
  pre_chat_form: "pro",
  csat: "pro",
  white_label: "pro",
  audit_log: "pro",

  // Business+ features
  priority_support: "business",
  sla: "business",
  custom_domains: "business",
  api_keys: "business",
};

export function isPlanAllowedForFeature(planKey: unknown, feature: FeatureKey): boolean {
  const min = FEATURE_MIN_PLAN[feature] || "free";
  return planTier(planKey) >= planTier(min);
}

export const ALL_FEATURE_KEYS = Object.keys(FEATURE_MIN_PLAN) as FeatureKey[];

// ── Numerical Quotas (Single Source of Truth) ──────────────────────
// AI reply limits per month. -1 = unlimited.
export const PLAN_AI_LIMITS: Record<PlanKey, number> = {
  free: 200,
  starter: 500,
  pro: 2000,
  business: -1,
};

export function getAiLimitForPlan(planKey: unknown): number {
  const normalized = normalizePlanKey(planKey);
  return PLAN_AI_LIMITS[normalized] ?? PLAN_AI_LIMITS.free;
}

// Max agents per plan
export const PLAN_MAX_AGENTS: Record<PlanKey, number> = {
  // Team rule: total 3 users (1 owner + 2 members).
  // This value represents members excluding the owner.
  free: 2,
  starter: 5,
  pro: 15,
  business: 50,
};

// M3 (automation reach) limits per month. -1 = unlimited.
export const PLAN_M3_LIMITS: Record<PlanKey, number> = {
  free: 100,
  starter: 500,
  pro: 2000,
  business: -1,
};

// Branding: only Free plan requires branding
export function isBrandingRequired(planKey: unknown): boolean {
  return normalizePlanKey(planKey) === "free";
}

export { normalizePlanKey };

