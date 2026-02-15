import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import {
  getStripeClient,
  isStripeConfigured,
  verifyWebhookSignature,
  mapPriceToplanKey,
  StripeNotConfiguredError,
} from "../utils/stripe";
import { writeAuditLog } from "../utils/audit-log";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { getRealIP } from "../utils/get-real-ip";

type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

function mapStripeStatus(status?: string | null): BillingStatus {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      return status;
    default:
      return "none";
  }
}

async function findOrgFromStripe({
  orgId,
  orgKey,
  customerId,
}: {
  orgId?: string | null;
  orgKey?: string | null;
  customerId?: string | null;
}) {
  if (orgId) {
    return prisma.organization.findUnique({ where: { id: orgId } });
  }
  if (orgKey) {
    return prisma.organization.findUnique({ where: { key: orgKey } });
  }
  if (customerId) {
    return prisma.organization.findFirst({
      where: { stripeCustomerId: customerId },
    });
  }
  return null;
}

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  const stripeWebhookRateLimit = createRateLimitMiddleware({
    limit: 120,
    windowMs: 60 * 1000,
    routeName: "stripe.webhook",
    keyBuilder: (request) => `stripe_webhook:${getRealIP(request) || "unknown-ip"}`,
    auditLog: false,
  });

  const handler = async (request: any, reply: any) => {
    const signature = request.headers["stripe-signature"] as string | undefined;
    const rawBody = request.rawBody;
    if (!rawBody || !signature) {
      reply.code(400);
      return { error: "Missing signature" };
    }

    let event;
    try {
      event = verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      if (err instanceof StripeNotConfiguredError) {
        reply.code(501);
        return { error: "Stripe webhook secret is not configured.", code: "STRIPE_NOT_CONFIGURED" };
      }
      reply.code(400);
      return { error: "Invalid signature" };
    }

    const now = new Date();
    const eventId = event.id;
    const graceDays = parseInt(process.env.GRACE_DAYS || "7", 10);
    const graceEndsAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const checkoutSessionId =
          typeof session.id === "string" ? session.id : null;
        let promoCode =
          typeof session.metadata?.promoCode === "string" &&
          session.metadata.promoCode.trim()
            ? session.metadata.promoCode.trim().toUpperCase()
            : null;
        if (!promoCode && checkoutSessionId && isStripeConfigured()) {
          try {
            const stripe = getStripeClient();
            const fullSession = await stripe.checkout.sessions.retrieve(
              checkoutSessionId,
              {
                expand: ["total_details.breakdown.discounts.discount.promotion_code"],
              } as any
            );
            const discounts = (fullSession as any)?.total_details?.breakdown?.discounts;
            const firstDiscount = Array.isArray(discounts) ? discounts[0] : null;
            const promotionCodeObj = firstDiscount?.discount?.promotion_code;

            if (promotionCodeObj && typeof promotionCodeObj === "object") {
              if (typeof promotionCodeObj.code === "string") {
                promoCode = promotionCodeObj.code.trim().toUpperCase();
              } else if (typeof promotionCodeObj.id === "string") {
                const promoFromDb = await prisma.promoCode.findFirst({
                  where: { stripePromotionCodeId: promotionCodeObj.id },
                  select: { code: true },
                });
                promoCode = promoFromDb?.code || null;
              }
            } else if (typeof promotionCodeObj === "string") {
              const promoFromDb = await prisma.promoCode.findFirst({
                where: { stripePromotionCodeId: promotionCodeObj },
                select: { code: true },
              });
              promoCode = promoFromDb?.code || null;
            }
          } catch (err) {
            // Non-blocking: still continue checkout completion.
            console.warn("[stripe-webhook] failed to resolve promotion_code:", err);
          }
        }
        const org = await findOrgFromStripe({
          orgId: session.metadata?.orgId,
          orgKey: session.metadata?.orgKey,
          customerId: session.customer,
        });

        if (org) {
          // Idempotency: skip if we already processed this event
          if (org.lastStripeEventId === eventId) break;

          // Resolve plan/period/currency context from metadata
          const metaPlanKey = session.metadata?.planKey;
          const planKey = metaPlanKey || org.planKey;
          const period = session.metadata?.period || "monthly";
          const expectedCurrency = (session.metadata?.expectedCurrency || "").toLowerCase();
          const actualCurrency = (session.currency || "").toLowerCase();

          // Safety-net logging: TR card should generally pay in TRY.
          let cardCountry: string | null = null;
          if (isStripeConfigured() && typeof session.payment_intent === "string") {
            try {
              const stripe = getStripeClient();
              const paymentIntent = await stripe.paymentIntents.retrieve(
                session.payment_intent
              );
              const paymentMethodId = paymentIntent.payment_method;
              if (typeof paymentMethodId === "string") {
                const paymentMethod = await stripe.paymentMethods.retrieve(
                  paymentMethodId
                );
                cardCountry = paymentMethod.card?.country || null;
              }
            } catch (err) {
              console.warn("[stripe-webhook] card country lookup failed:", err);
            }
          }
          if (cardCountry === "TR" && actualCurrency && actualCurrency !== "try") {
            console.warn(
              `[BILLING] TR card used with ${actualCurrency} — unexpected`
            );
          }

          await prisma.organization.update({
            where: { id: org.id },
            data: {
              stripeCustomerId: session.customer || org.stripeCustomerId,
              stripeSubscriptionId:
                session.subscription || org.stripeSubscriptionId,
              // Legacy field kept for compatibility only.
              stripePriceId: null,
              billingStatus: "active",
              planKey,
              planStatus: "active",
              ...(session.metadata?.foundingMember === "true"
                ? {
                    isFoundingMember: true,
                    foundingMemberAt: new Date(),
                  }
                : {}),
              lastStripeEventAt: now,
              lastStripeEventId: eventId,
            },
          });
          console.log(`[Webhook] Plan activated: ${org.id} -> ${planKey}`);
          if (checkoutSessionId) {
            await prisma.checkoutSession.updateMany({
              where: {
                id: checkoutSessionId,
                status: { in: ["started", "abandoned"] },
              },
              data: {
                status: "completed",
                completedAt: now,
              },
            });
          }
          await writeAuditLog(org.id, "webhook", "webhook.state_change", {
            event: event.type, eventId, planKey, billingStatus: "active",
          });
          await writeAuditLog(org.id, "webhook", "checkout_completed", {
            eventId,
            stripeCheckoutSessionId: checkoutSessionId,
            stripeSubscriptionId: session.subscription || null,
            stripeCustomerId: session.customer || null,
            planKey,
            period,
            expectedCurrency,
            actualCurrency,
            cardCountry,
            promoCode,
          });
          if (promoCode) {
            const used = await prisma.promoCode.updateMany({
              where: { code: promoCode },
              data: { currentUses: { increment: 1 } },
            });
            if (used.count > 0) {
              await writeAuditLog(org.id, "webhook", "promo_code_used", {
                code: promoCode,
                stripeCheckoutSessionId: checkoutSessionId,
                eventId,
              });
            }
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const org = await findOrgFromStripe({
          orgId: sub.metadata?.orgId,
          orgKey: sub.metadata?.orgKey,
          customerId: sub.customer,
        });

        if (org) {
          if (org.lastStripeEventId === eventId) break;

          const newStatus = mapStripeStatus(sub.status);
          const priceId = sub.items?.data?.[0]?.price?.id;

          // Map price ID -> plan key
          let planKey = sub.metadata?.planKey || org.planKey;
          if (priceId) {
            const mapped = await mapPriceToplanKey(priceId);
            if (mapped) planKey = mapped;
          }
          if (event.type === "customer.subscription.deleted") {
            planKey = "free";
          }

          // Derive planStatus from billingStatus
          const planStatus =
            event.type === "customer.subscription.deleted"
              ? "canceled"
              : newStatus === "active" || newStatus === "trialing"
                ? "active"
                : newStatus === "past_due"
                  ? "past_due"
                  : newStatus === "canceled"
                    ? "canceled"
                    : "inactive";

          const isPastDueOrUnpaid = newStatus === "past_due" || newStatus === "unpaid";
          const isActive = newStatus === "active" || newStatus === "trialing";

          await prisma.organization.update({
            where: { id: org.id },
            data: {
              stripeCustomerId: sub.customer || org.stripeCustomerId,
              stripeSubscriptionId: sub.id || org.stripeSubscriptionId,
              stripePriceId: priceId || org.stripePriceId,
              billingStatus: newStatus,
              planKey,
              planStatus,
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : org.currentPeriodEnd,
              cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
              trialEndsAt: sub.trial_end
                ? new Date(sub.trial_end * 1000)
                : null,
              lastPaymentFailureAt: isPastDueOrUnpaid ? now : null,
              graceEndsAt: isPastDueOrUnpaid ? graceEndsAt : null,
              billingLockedAt: isActive ? null : org.billingLockedAt,
              lastStripeEventAt: now,
              lastStripeEventId: eventId,
            },
          });
          await writeAuditLog(org.id, "webhook", "webhook.state_change", {
            event: event.type, eventId, billingStatus: newStatus, planKey, planStatus,
            graceEndsAt: isPastDueOrUnpaid ? graceEndsAt.toISOString() : null,
          });
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const org = await findOrgFromStripe({
          customerId: invoice.customer,
          orgId: invoice.metadata?.orgId,
          orgKey: invoice.metadata?.orgKey,
        });

        if (org) {
          if (org.lastStripeEventId === eventId) break;

          await prisma.organization.update({
            where: { id: org.id },
            data: {
              billingStatus: "active",
              planStatus: "active",
              lastPaymentFailureAt: null,
              graceEndsAt: null,
              billingLockedAt: null,
              lastStripeEventAt: now,
              lastStripeEventId: eventId,
            },
          });
          await writeAuditLog(org.id, "webhook", "webhook.state_change", {
            event: event.type, eventId, billingStatus: "active",
            cleared: ["lastPaymentFailureAt", "graceEndsAt", "billingLockedAt"],
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const org = await findOrgFromStripe({
          customerId: invoice.customer,
          orgId: invoice.metadata?.orgId,
          orgKey: invoice.metadata?.orgKey,
        });

        if (org) {
          if (org.lastStripeEventId === eventId) break;

          await prisma.organization.update({
            where: { id: org.id },
            data: {
              billingStatus: "past_due",
              planStatus: "past_due",
              lastPaymentFailureAt: now,
              graceEndsAt,
              lastStripeEventAt: now,
              lastStripeEventId: eventId,
            },
          });
          await writeAuditLog(org.id, "webhook", "webhook.state_change", {
            event: event.type, eventId, billingStatus: "past_due",
            graceEndsAt: graceEndsAt.toISOString(),
          });
        }
        break;
      }
      default:
        break;
    }

    return { ok: true };
  };

  fastify.post(
    "/stripe/webhook",
    { config: { rawBody: true }, preHandler: [stripeWebhookRateLimit] },
    handler
  );
  fastify.post(
    "/webhooks/stripe",
    { config: { rawBody: true }, preHandler: [stripeWebhookRateLimit] },
    handler
  );
}
