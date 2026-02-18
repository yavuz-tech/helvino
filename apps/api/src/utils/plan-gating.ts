import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import type { FeatureKey } from "@helvino/shared";
import { isPlanAllowedForFeature } from "@helvino/shared";

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

