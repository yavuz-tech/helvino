import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";

export type PlanKey = "free" | "starter" | "pro" | "business";
export type FeatureKey =
  | "ai_inbox"
  | "ai_config"
  | "workflows"
  | "macros"
  | "billing_checkout"
  | "billing_portal";

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

const FEATURE_MIN_PLAN: Record<FeatureKey, PlanKey> = {
  // NOTE: These are conservative defaults. Most enforcement is done via quotas/limits today.
  ai_inbox: "free",
  ai_config: "free",
  workflows: "free",
  macros: "free",
  billing_checkout: "free",
  billing_portal: "free",
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

