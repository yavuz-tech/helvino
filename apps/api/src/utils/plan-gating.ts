import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";

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
  | "custom_domains";

function normalizePlanKey(input: unknown): PlanKey {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "free";
  if (raw === "starter" || raw === "pro" || raw === "business") return raw;
  return "free";
}

function planRank(planKey: PlanKey): number {
  switch (planKey) {
    case "free": return 0;
    case "starter": return 1;
    case "pro": return 2;
    case "business": return 3;
  }
}

/**
 * Minimum plan required for each feature.
 * Aligned with pricing-page.jsx feature matrix:
 *   Free:     basic widget, 2 starters, offline form
 *   Starter:  adv. widget, 5 starters, auto-reply, working hours, file sharing, read receipts
 *   Pro:      all AI models, AI persona, remove branding, pre-chat, CSAT, custom CSS, page rules, audit
 *   Business: priority support, SLA, custom domains
 */
const FEATURE_MIN_PLAN: Record<FeatureKey, PlanKey> = {
  // Free-tier features (quotas still apply)
  ai_inbox: "free",
  ai_config: "free",
  billing_checkout: "free",
  billing_portal: "free",

  // Starter+ features
  auto_reply: "starter",
  working_hours: "starter",
  file_sharing: "starter",
  read_receipts: "starter",
  transcript_email: "starter",
  workflows: "starter",
  macros: "starter",

  // Pro+ features
  ai_persona: "pro",
  ai_suggestions: "pro",
  custom_css: "pro",
  page_rules: "pro",
  pre_chat_form: "pro",
  csat: "pro",
  white_label: "pro",
  remove_branding: "pro",
  audit_log: "pro",

  // Business+ features
  priority_support: "business",
  sla: "business",
  custom_domains: "business",
};

export function isPlanAllowedForFeature(planKey: string, feature: FeatureKey): boolean {
  const normalized = normalizePlanKey(planKey);
  const min = FEATURE_MIN_PLAN[feature] || "free";
  return planRank(normalized) >= planRank(min);
}

export function requirePlanFeature(feature: FeatureKey) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).portalUser?.orgId as string | undefined;
    if (!orgId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { planKey: true },
    });
    const planKey = org?.planKey || "free";
    if (!isPlanAllowedForFeature(planKey, feature)) {
      return reply.status(403).send({
        error: "Plan upgrade required",
        code: "PLAN_UPGRADE_REQUIRED",
        feature,
        planKey,
      });
    }
  };
}

