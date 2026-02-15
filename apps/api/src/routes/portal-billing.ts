import { FastifyInstance, FastifyRequest } from "fastify";
import * as geoip from "geoip-lite";
import { requirePortalUser } from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getStripeClient,
  isStripeConfigured,
  PromoCodeInvalidError,
  InvalidPlanError,
  listInvoices,
  syncPromoCodeWithStripe,
  StripeNotConfiguredError,
} from "../utils/stripe";
import { writeAuditLog } from "../utils/audit-log";
import {
  getUsageForMonth,
  getPlanLimits,
  getAvailablePlans,
  computeTrialStatus,
  getRecommendedPlan,
} from "../utils/entitlements";
import { getBillingLockStatus } from "../utils/billing-state";
import { prisma } from "../prisma";
import { getRealIP } from "../utils/get-real-ip";
import { ensureFoundingCoupon, ensureOrgDiscountCoupon } from "../utils/stripe-discount";

type CheckoutCurrency = "usd" | "try";
type DisplayCurrency = "usd" | "try" | "eur";
type CheckoutPeriod = "monthly" | "yearly";

function isReturnUrlValidationError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "message" in err && typeof (err as any).message === "string" && /return url/i.test((err as any).message));
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return code.length === 2 ? code : null;
}

function detectCountryFromRequest(request: FastifyRequest): string | null {
  const cfCountry = normalizeCountryCode(request.headers["cf-ipcountry"] as string | undefined);
  if (cfCountry) return cfCountry;

  const vercelCountry = normalizeCountryCode(
    request.headers["x-vercel-ip-country"] as string | undefined
  );
  if (vercelCountry) return vercelCountry;

  const ip = getRealIP(request);
  const lookup = geoip.lookup(ip);
  return normalizeCountryCode(lookup?.country || null);
}

function detectCurrencyFromRequest(request: FastifyRequest): {
  currency: CheckoutCurrency;
  country: string | null;
} {
  const country = detectCountryFromRequest(request);
  return {
    currency: country === "TR" ? "try" : "usd",
    country,
  };
}

const EUR_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
]);

function detectDisplayCurrencyFromCountry(country: string | null): DisplayCurrency {
  if (country === "TR") return "try";
  if (country && EUR_COUNTRY_CODES.has(country)) return "eur";
  return "usd";
}

function selectPlanPriceId(
  plan: {
    stripePriceMonthlyUsd: string | null;
    stripePriceYearlyUsd: string | null;
    stripePriceMonthlyTry: string | null;
    stripePriceYearlyTry: string | null;
  },
  currency: CheckoutCurrency,
  period: CheckoutPeriod
): string | null {
  if (currency === "try" && period === "monthly") return plan.stripePriceMonthlyTry;
  if (currency === "try" && period === "yearly") return plan.stripePriceYearlyTry;
  if (currency === "usd" && period === "yearly") return plan.stripePriceYearlyUsd;
  return plan.stripePriceMonthlyUsd;
}

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
  // GET /api/founding-member-status
  // Public endpoint for pricing banner counters
  // ────────────────────────────────────────────────
  fastify.get("/api/founding-member-status", async () => {
    const count = await prisma.organization.count({
      where: { isFoundingMember: true },
    });
    const limit = 200;
    return {
      count,
      limit,
      remaining: Math.max(0, limit - count),
      available: count < limit,
    };
  });

  // ────────────────────────────────────────────────
  // GET /api/active-discount
  // Public endpoint for org discount visibility
  // Query: ?orgKey=...
  // ────────────────────────────────────────────────
  fastify.get("/api/active-discount", async (request) => {
    const query = request.query as { orgKey?: string } | undefined;
    const orgKey = typeof query?.orgKey === "string" ? query.orgKey.trim() : "";
    if (!orgKey) {
      return { hasDiscount: false, discountPercent: 0, type: "none" as const };
    }

    const org = await prisma.organization.findUnique({
      where: { key: orgKey },
      include: { settings: true },
    });
    if (!org) {
      return { hasDiscount: false, discountPercent: 0, type: "none" as const };
    }

    if (org.isFoundingMember) {
      return { hasDiscount: true, discountPercent: 40, type: "founding" as const };
    }

    const globalPercent = org.settings?.globalDiscountPercent || 0;
    const globalActive = org.settings?.globalDiscountActive === true;
    if (globalActive && globalPercent > 0) {
      return { hasDiscount: true, discountPercent: globalPercent, type: "global" as const };
    }

    return { hasDiscount: false, discountPercent: 0, type: "none" as const };
  });

  // ────────────────────────────────────────────────
  // GET /api/currency
  // IP-country based pricing currency hint for portal UI
  // ────────────────────────────────────────────────
  fastify.get("/api/currency", async (request) => {
    const country = detectCountryFromRequest(request);
    const currency = detectDisplayCurrencyFromCountry(country);
    return { currency, country: country || "ZZ" };
  });

  // ────────────────────────────────────────────────
  // POST /api/checkout
  // Body: { planKey: "starter" | "pro" | "business", period: "monthly" | "yearly" }
  // ────────────────────────────────────────────────
  fastify.post(
    "/api/checkout",
    {
      preHandler: [
        requirePortalUser,
        createRateLimitMiddleware({ limit: 10, windowMs: 60 * 1000, routeName: "billing.checkout.v2" }),
        validateJsonContentType,
      ],
      config: { skipGlobalRateLimit: true },
    },
    async (request, reply) => {
      const user = request.portalUser!;
      const body = (request.body || {}) as {
        planKey?: string;
        period?: string;
        promoCode?: string;
      };
      const planKey = (body.planKey || "").toLowerCase();
      const period = body.period === "yearly" ? "yearly" : body.period === "monthly" ? "monthly" : null;

      if (!period) {
        reply.code(400);
        return { error: "Invalid period. Use monthly or yearly.", code: "INVALID_PERIOD" };
      }
      if (!["starter", "pro", "business"].includes(planKey)) {
        reply.code(400);
        return { error: "Invalid plan key. Free plan does not require checkout.", code: "INVALID_PLAN" };
      }

      const [org, plan] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: user.orgId },
          include: { settings: true },
        }),
        prisma.plan.findUnique({ where: { key: planKey } }),
      ]);
      if (!org) {
        reply.code(404);
        return { error: "Organization not found", code: "ORG_NOT_FOUND" };
      }
      if (!plan) {
        reply.code(404);
        return { error: "Plan not found", code: "PLAN_NOT_FOUND" };
      }

      const { currency, country } = detectCurrencyFromRequest(request);
      let applyFoundingDiscount = false;
      if (period === "yearly") {
        const [fmCount, isAlreadyFM] = await Promise.all([
          prisma.organization.count({ where: { isFoundingMember: true } }),
          Promise.resolve(org.isFoundingMember === true),
        ]);
        if (fmCount < 200 && !isAlreadyFM) {
          applyFoundingDiscount = true;
        }
      }
      const globalDiscountPercent = org.settings?.globalDiscountPercent || 0;
      const applyGlobalDiscount =
        !applyFoundingDiscount &&
        org.settings?.globalDiscountActive === true &&
        globalDiscountPercent > 0;

      let promoDiscountCouponId: string | null = null;
      const normalizedPromoCode =
        typeof body.promoCode === "string" && body.promoCode.trim().length > 0
          ? body.promoCode.trim().toUpperCase()
          : null;

      if (!applyFoundingDiscount && !applyGlobalDiscount && normalizedPromoCode) {
        const now = new Date();
        const promo = await prisma.promoCode.findFirst({
          where: {
            code: normalizedPromoCode,
            isActive: true,
            validFrom: { lte: now },
            AND: [
              { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
              {
                OR: [
                  { isGlobal: true },
                  { createdBy: org.id, isGlobal: false },
                  { createdBy: "system", isGlobal: false },
                  { createdBy: "system-abandoned-checkout", isGlobal: false },
                ],
              },
            ],
          },
        });

        if (!promo) {
          reply.code(400);
          return { error: "Promo code not found or inactive.", code: "PROMO_CODE_INVALID" };
        }
        if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
          reply.code(400);
          return { error: "Promo code max usage reached.", code: "PROMO_CODE_INVALID" };
        }

        const synced = await syncPromoCodeWithStripe({
          id: promo.id,
          code: promo.code,
          stripeCouponId: promo.stripeCouponId,
          stripePromotionCodeId: promo.stripePromotionCodeId,
        });

        await prisma.promoCode.update({
          where: { id: promo.id },
          data: {
            discountType: "percentage",
            discountValue: synced.percent,
            stripeCouponId: synced.stripeCouponId,
            stripePromotionCodeId: synced.stripePromotionCodeId,
          },
        });
        promoDiscountCouponId = synced.stripeCouponId;
      }

      const selectedStripePriceId = selectPlanPriceId(plan, currency, period);
      if (!selectedStripePriceId) {
        reply.code(400);
        return {
          error: `Stripe price is not configured for ${plan.key} (${currency}/${period}).`,
          code: "STRIPE_PRICE_NOT_CONFIGURED",
          foundingMember: applyFoundingDiscount ? "true" : "false",
        };
      }
      if (!isStripeConfigured()) {
        reply.code(501);
        return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
      }

      const stripe = getStripeClient();
      let stripeCustomerId = org.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: org.name,
          metadata: { orgId: org.id, orgKey: org.key },
        });
        stripeCustomerId = customer.id;
        await prisma.organization.update({
          where: { id: org.id },
          data: { stripeCustomerId },
        });
      }

      const frontendUrl =
        process.env.APP_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_WEB_URL ||
        (process.env.NODE_ENV !== "production" ? request.headers.origin : null) ||
        "http://localhost:3000";

      // SECURITY: In production, do not derive redirect targets from request headers.
      // Require an explicit frontend base URL to prevent checkout redirect manipulation.
      if (process.env.NODE_ENV === "production" && !process.env.APP_PUBLIC_URL && !process.env.NEXT_PUBLIC_WEB_URL) {
        reply.code(500);
        return { error: "Internal server configuration error", code: "CONFIG_ERROR" };
      }

      let selectedDiscountCouponId: string | null = null;
      if (applyFoundingDiscount) {
        selectedDiscountCouponId = (await ensureFoundingCoupon()).id;
      } else if (applyGlobalDiscount) {
        selectedDiscountCouponId = (await ensureOrgDiscountCoupon(org.id, globalDiscountPercent)).id;
      } else if (promoDiscountCouponId) {
        selectedDiscountCouponId = promoDiscountCouponId;
      }

      const discounts = selectedDiscountCouponId
        ? [{ coupon: selectedDiscountCouponId }]
        : undefined;

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId || undefined,
        customer_email: !stripeCustomerId ? user.email : undefined,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: selectedStripePriceId, quantity: 1 }],
        ...(discounts ? { discounts } : {}),
        metadata: {
          orgId: org.id,
          orgKey: org.key,
          planKey,
          period,
          expectedCurrency: currency,
          stripePriceId: selectedStripePriceId,
          countryHint: country || "ZZ",
          foundingMember: applyFoundingDiscount ? "true" : "false",
        },
        subscription_data: {
          metadata: {
            orgId: org.id,
            orgKey: org.key,
            planKey,
            period,
            expectedCurrency: currency,
            stripePriceId: selectedStripePriceId,
            foundingMember: applyFoundingDiscount ? "true" : "false",
          },
        },
        success_url: `${frontendUrl}/portal/billing?checkout=success`,
        cancel_url: `${frontendUrl}/portal/pricing?canceled=true`,
        tax_id_collection: { enabled: true },
      });

      if (!session.url) {
        reply.code(500);
        return { error: "Checkout session URL is missing.", code: "CHECKOUT_URL_MISSING" };
      }

      await prisma.checkoutSession.upsert({
        where: { id: session.id },
        update: {
          organizationId: org.id,
          email: user.email.toLowerCase(),
          stripeCustomerId: typeof session.customer === "string" ? session.customer : stripeCustomerId,
          stripePriceId: selectedStripePriceId,
          planType: plan.key.toUpperCase(),
          amount: session.amount_total || 0,
          status: "started",
        },
        create: {
          id: session.id,
          organizationId: org.id,
          email: user.email.toLowerCase(),
          stripeCustomerId: typeof session.customer === "string" ? session.customer : stripeCustomerId,
          stripePriceId: selectedStripePriceId,
          planType: plan.key.toUpperCase(),
          amount: session.amount_total || 0,
          status: "started",
        },
      });

      await writeAuditLog(org.id, user.email, "checkout_started", {
        stripeCheckoutSessionId: session.id,
        planKey,
        period,
        expectedCurrency: currency,
        countryHint: country || "ZZ",
        stripePriceId: selectedStripePriceId,
        foundingMember: applyFoundingDiscount ? "true" : "false",
      });

      return { url: session.url };
    }
  );

  // ────────────────────────────────────────────────
  // POST /portal/billing/checkout  (plan-aware)
  // Body: { planKey?: string, returnUrl?: string }
  // ────────────────────────────────────────────────
  fastify.post(
    "/portal/billing/checkout",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60 * 1000, routeName: "billing.checkout" }),
        validateJsonContentType,
      ],
      config: { skipGlobalRateLimit: true },
    },
    async (request, reply) => {
      const user = request.portalUser!;
      const body = request.body as {
        planKey?: string;
        returnUrl?: string;
        promoCode?: string;
      };

      if (!isStripeConfigured()) {
        reply.code(501);
        return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
      }

      try {
        const checkout = await createCheckoutSession(
          user.orgId,
          body.returnUrl,
          body.planKey,
          undefined,
          body.promoCode
        );
        await writeAuditLog(user.orgId, user.email, "checkout_started", {
          stripeCheckoutSessionId: checkout.sessionId,
          planType: checkout.planType,
          amount: checkout.amount,
          email: checkout.email,
          promoCode: body.promoCode ? body.promoCode.trim().toUpperCase() : null,
        });
        return { url: checkout.url };
      } catch (err) {
        if (err instanceof InvalidPlanError) {
          reply.code(400);
          return { error: err.message, code: err.code };
        }
        if (err instanceof PromoCodeInvalidError) {
          reply.code(400);
          return { error: err.message, code: err.code };
        }
        if (err instanceof StripeNotConfiguredError) {
          reply.code(501);
          return { error: "Stripe is not configured on this server.", code: "STRIPE_NOT_CONFIGURED" };
        }
        if (isReturnUrlValidationError(err)) {
          reply.code(400);
          return { error: "Invalid returnUrl" };
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
    { preHandler: [requirePortalUser, requireStepUp("portal"), validateJsonContentType] },
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
        if (isReturnUrlValidationError(err)) {
          reply.code(400);
          return { error: "Invalid returnUrl" };
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
        validateJsonContentType,
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
        const fallbackBase =
          process.env.APP_PUBLIC_URL ||
          process.env.NEXT_PUBLIC_WEB_URL ||
          (request.headers.origin as string | undefined);
        const effectiveReturnUrl =
          returnUrl ||
          (fallbackBase ? `${fallbackBase.replace(/\/$/, "")}/portal/billing` : undefined);
        const url = await createCustomerPortalSession(
          user.orgId,
          effectiveReturnUrl
        );
        return { url };
      } catch (err) {
        if (isReturnUrlValidationError(err)) {
          reply.code(400);
          return { error: "Invalid returnUrl" };
        }
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
    { preHandler: [requirePortalUser, validateJsonContentType] },
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
        if (isReturnUrlValidationError(err)) {
          reply.code(400);
          return { error: "Invalid returnUrl" };
        }
        reply.code(500);
        return { error: "Portal session failed" };
      }
    }
  );
}
