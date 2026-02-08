import { FastifyInstance } from "fastify";
import { requirePortalUser } from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  isStripeConfigured,
  listInvoices,
  StripeNotConfiguredError,
} from "../utils/stripe";
import {
  getUsageForMonth,
  getPlanLimits,
  getAvailablePlans,
  computeTrialStatus,
  getRecommendedPlan,
} from "../utils/entitlements";
import { getBillingLockStatus } from "../utils/billing-state";
import { prisma } from "../prisma";

export async function portalBillingRoutes(fastify: FastifyInstance) {
  // ────────────────────────────────────────────────
  // GET /portal/billing/status  (new canonical route)
  // Returns plan + limits + usage + subscription status + available plans
  // ────────────────────────────────────────────────
  fastify.get(
    "/portal/billing/status",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
      });
      if (!org) return { error: "Organization not found" };

      const [limits, usage, plans, recommended] = await Promise.all([
        getPlanLimits(user.orgId),
        getUsageForMonth(user.orgId),
        getAvailablePlans(),
        getRecommendedPlan(user.orgId),
      ]);

      const trial = computeTrialStatus(org);

      return {
        stripeConfigured: isStripeConfigured(),
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        plan: limits
          ? {
              key: limits.planKey,
              name: limits.planName,
              monthlyPriceUsd: limits.monthlyPriceUsd,
            }
          : { key: org.planKey, name: org.planKey, monthlyPriceUsd: null },
        limits: limits
          ? {
              maxConversationsPerMonth: limits.maxConversationsPerMonth,
              maxMessagesPerMonth: limits.maxMessagesPerMonth,
              maxAgents: limits.maxAgents,
              m1LimitPerMonth: limits.m1LimitPerMonth,
              m2LimitPerMonth: limits.m2LimitPerMonth,
              m3LimitVisitorsPerMonth: limits.m3LimitVisitorsPerMonth,
              extraConversationQuota: limits.extraConversationQuota || 0,
              extraMessageQuota: limits.extraMessageQuota || 0,
            }
          : null,
        usage: {
          monthKey: usage.monthKey,
          periodStart: usage.periodStart,
          periodEnd: usage.periodEnd,
          conversationsCreated: usage.conversationsCreated,
          messagesSent: usage.messagesSent,
          m1Count: usage.m1Count,
          m2Count: usage.m2Count,
          m3Count: usage.m3Count,
          nextResetDate: usage.nextResetDate,
        },
        subscription: {
          status: org.billingStatus,
          planStatus: org.planStatus,
          stripeCustomerId: org.stripeCustomerId,
          stripeSubscriptionId: org.stripeSubscriptionId,
          stripePriceId: org.stripePriceId,
          currentPeriodEnd: org.currentPeriodEnd?.toISOString() || null,
          cancelAtPeriodEnd: org.cancelAtPeriodEnd,
          trialEndsAt: org.trialEndsAt?.toISOString() || null,
          billingEnforced: org.billingEnforced,
          billingGraceDays: org.billingGraceDays,
        },
        availablePlans: plans,
        // Step 11.32 — additive fields
        trial,
        recommendedPlan: recommended,
        conversionSignals: {
          firstConversationAt: org.firstConversationAt?.toISOString() || null,
          firstWidgetEmbedAt: org.firstWidgetEmbedAt?.toISOString() || null,
          firstInviteSentAt: org.firstInviteSentAt?.toISOString() || null,
        },
      };
    }
  );

  // ────────────────────────────────────────────────
  // GET /portal/billing/trial-status
  // Returns trial lifecycle information
  // ────────────────────────────────────────────────
  fastify.get(
    "/portal/billing/trial-status",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
      });
      if (!org) return { error: "Organization not found" };

      const trial = computeTrialStatus(org);
      const recommended = await getRecommendedPlan(user.orgId);

      return {
        ...trial,
        recommendedPlan: recommended,
      };
    }
  );

  // ────────────────────────────────────────────────
  // GET /portal/billing/lock-status
  // Returns billing lock/grace status for the org
  // ────────────────────────────────────────────────
  fastify.get(
    "/portal/billing/lock-status",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
      });
      if (!org) return { error: "Organization not found" };

      const lock = getBillingLockStatus({
        id: org.id,
        key: org.key,
        name: org.name,
        planKey: org.planKey,
        billingStatus: org.billingStatus,
        planStatus: org.planStatus,
        graceEndsAt: org.graceEndsAt,
        billingLockedAt: org.billingLockedAt,
      });

      return {
        locked: lock.locked,
        graceEndsAt: lock.graceEndsAt?.toISOString() || null,
        billingLockedAt: lock.billingLockedAt?.toISOString() || null,
        reason: lock.reason,
        lastReconcileAt: org.lastBillingReconcileAt?.toISOString() || null,
      };
    }
  );

  // ────────────────────────────────────────────────
  // GET /portal/billing/reconcile-status
  // Returns last reconcile timestamp + stored summary (if any)
  // ────────────────────────────────────────────────
  fastify.get(
    "/portal/billing/reconcile-status",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: {
          lastBillingReconcileAt: true,
          lastBillingReconcileResult: true,
        },
      });
      if (!org) return { error: "Organization not found" };

      return {
        lastReconcileAt: org.lastBillingReconcileAt?.toISOString() || null,
        lastReconcileResult: org.lastBillingReconcileResult || null,
      };
    }
  );

  // ────────────────────────────────────────────────
  // GET /portal/org/billing  (legacy — keep backwards compatible)
  // ────────────────────────────────────────────────
  fastify.get(
    "/portal/org/billing",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
      });
      if (!org) return { error: "Organization not found" };

      return {
        stripeConfigured: isStripeConfigured(),
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        billing: {
          stripeCustomerId: org.stripeCustomerId,
          stripeSubscriptionId: org.stripeSubscriptionId,
          stripePriceId: org.stripePriceId,
          billingStatus: org.billingStatus,
          currentPeriodEnd: org.currentPeriodEnd?.toISOString() || null,
          cancelAtPeriodEnd: org.cancelAtPeriodEnd,
          billingEnforced: org.billingEnforced,
          billingGraceDays: org.billingGraceDays,
          lastStripeEventAt: org.lastStripeEventAt?.toISOString() || null,
        },
      };
    }
  );

  // ────────────────────────────────────────────────
  // GET /portal/billing  (legacy alias)
  // ────────────────────────────────────────────────
  fastify.get(
    "/portal/billing",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
      });
      if (!org) return { error: "Organization not found" };

      return {
        stripeConfigured: isStripeConfigured(),
        org: {
          id: org.id,
          key: org.key,
          name: org.name,
        },
        billing: {
          stripeCustomerId: org.stripeCustomerId,
          stripeSubscriptionId: org.stripeSubscriptionId,
          stripePriceId: org.stripePriceId,
          billingStatus: org.billingStatus,
          currentPeriodEnd: org.currentPeriodEnd?.toISOString() || null,
          cancelAtPeriodEnd: org.cancelAtPeriodEnd,
          billingEnforced: org.billingEnforced,
          billingGraceDays: org.billingGraceDays,
          lastStripeEventAt: org.lastStripeEventAt?.toISOString() || null,
        },
      };
    }
  );

  // ────────────────────────────────────────────────
  // POST /portal/billing/checkout  (plan-aware)
  // Body: { planKey?: string, returnUrl?: string }
  // ────────────────────────────────────────────────
  fastify.post(
    "/portal/billing/checkout",
    { preHandler: [requirePortalUser, requireStepUp("portal")] },
    async (request, reply) => {
      const user = request.portalUser!;
      const body = request.body as {
        planKey?: string;
        returnUrl?: string;
      };

      if (!isStripeConfigured()) {
        reply.code(501);
        return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
      }

      try {
        const url = await createCheckoutSession(
          user.orgId,
          body.returnUrl,
          body.planKey
        );
        return { url };
      } catch (err) {
        if (err instanceof StripeNotConfiguredError) {
          reply.code(501);
          return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
        }
        reply.code(500);
        return { error: "Checkout failed" };
      }
    }
  );

  // ────────────────────────────────────────────────
  // POST /portal/billing/portal
  // ────────────────────────────────────────────────
  fastify.post(
    "/portal/billing/portal",
    { preHandler: [requirePortalUser, requireStepUp("portal")] },
    async (request, reply) => {
      const user = request.portalUser!;
      const { returnUrl } = request.body as { returnUrl?: string };

      if (!isStripeConfigured()) {
        reply.code(501);
        return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
      }

      try {
        const url = await createCustomerPortalSession(user.orgId, returnUrl);
        return { url };
      } catch (err) {
        if (err instanceof StripeNotConfiguredError) {
          reply.code(501);
          return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
        }
        if (
          err instanceof Error &&
          err.message === "Stripe customer not found"
        ) {
          reply.code(400);
          return {
            error: "No active subscription found. Subscribe to a plan first.",
          };
        }
        reply.code(500);
        return { error: "Portal session failed" };
      }
    }
  );

  // ────────────────────────────────────────────────
  // POST /portal/billing/portal-session  (canonical — Step 11.8)
  // Creates a Stripe Billing Portal session.
  // ────────────────────────────────────────────────
  fastify.post(
    "/portal/billing/portal-session",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
        requirePortalUser,
        requireStepUp("portal"),
      ],
    },
    async (request, reply) => {
      const user = request.portalUser!;

      if (!isStripeConfigured()) {
        reply.code(501);
        return { error: "Stripe is not configured on this server." };
      }

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { stripeCustomerId: true },
      });

      if (!org?.stripeCustomerId) {
        reply.code(409);
        return {
          error:
            "No Stripe customer linked yet. Please start a checkout first.",
        };
      }

      const { returnUrl } = (request.body as { returnUrl?: string }) || {};

      try {
        const url = await createCustomerPortalSession(
          user.orgId,
          returnUrl || `${request.headers.origin || ""}/portal/billing`
        );
        return { url };
      } catch (err) {
        request.log.error(err, "portal-session creation failed");
        reply.code(500);
        return { error: "Could not create billing portal session." };
      }
    }
  );

  // ────────────────────────────────────────────────
  // GET /portal/billing/invoices  (Step 11.8)
  // Returns recent invoices from Stripe.
  // ────────────────────────────────────────────────
  fastify.get<{ Querystring: { limit?: string } }>(
    "/portal/billing/invoices",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
        requirePortalUser,
      ],
    },
    async (request, reply) => {
      const user = request.portalUser!;

      if (!isStripeConfigured()) {
        reply.code(501);
        return { error: "Stripe is not configured on this server." };
      }

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { stripeCustomerId: true },
      });

      if (!org?.stripeCustomerId) {
        reply.code(409);
        return {
          error:
            "No Stripe customer linked yet. Please start a checkout first.",
          invoices: [],
        };
      }

      const limit = Math.min(
        Math.max(parseInt(request.query.limit || "10", 10) || 10, 1),
        50
      );

      try {
        const invoices = await listInvoices(org.stripeCustomerId, limit);
        return { invoices };
      } catch (err) {
        request.log.error(err, "invoice listing failed");
        reply.code(500);
        return { error: "Could not fetch invoices.", invoices: [] };
      }
    }
  );

  // ────────────────────────────────────────────────
  // Legacy aliases for portal-session endpoints
  // ────────────────────────────────────────────────
  fastify.post(
    "/portal/org/billing/portal-session",
    { preHandler: [requirePortalUser] },
    async (request, reply) => {
      const user = request.portalUser!;
      const { returnUrl } = request.body as { returnUrl?: string };

      if (!isStripeConfigured()) {
        reply.code(501);
        return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
      }

      try {
        const url = await createCustomerPortalSession(user.orgId, returnUrl);
        return { url };
      } catch (err) {
        if (err instanceof StripeNotConfiguredError) {
          reply.code(501);
          return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
        }
        reply.code(500);
        return { error: "Portal session failed" };
      }
    }
  );
}
