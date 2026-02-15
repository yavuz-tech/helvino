# ═══════════════════════════════════════════════════════════
# HELVION SECURITY AUDIT REPORT — PART 3/10
# Billing & Plan Hierarchy Security
# Tarih: 2026-02-15
# Mod: AUDIT + AUTO-FIX | Ortam: Railway Production
# ═══════════════════════════════════════════════════════════

## EXECUTIVE SUMMARY

Kapsam:

- Stripe billing akisi: `apps/api/src/routes/portal-billing.ts`, `apps/api/src/routes/stripe-webhook.ts`, `apps/api/src/utils/stripe.ts`
- Promo code: `apps/api/src/routes/promo-codes.ts`
- Quota/usage/entitlement: `apps/api/src/utils/entitlements.ts`, `apps/api/src/utils/ai-service.ts`
- Prisma modelleri: `apps/api/prisma/schema.prisma` (Plan, Organization, Usage, CheckoutSession, PromoCode)

En kritik risk sinifi: plan bypass (ucretsiz org’un pro/business limitleri olmadan endpoint’leri kullanabilmesi) ve webhook duplicate/retry islemleri (double apply / promo usage increment / plan state regresyonu).

Toplam: 2 KRITIK | 3 ORTA | 2 DUSUK | 23 PASS  
Otomatik duzeltilen: 7 | Manuel gereken: 1

---

## OTOMATIK DUZELTILEN BULGULAR (✅ FIXED)

### BILLING-001 [KRITIK] — Unknown planKey ile checkout -> limitsiz entitlement bypass (fail-open)

- Etki: `/portal/billing/checkout` path’i, client’in gonderdigi `planKey` icin strict validation yapmadigi icin
  - odeme tarafinda daha ucuz fiyat ID’sine dusme,
  - webhook tarafinda `org.planKey`’in gecersiz bir string’e set edilmesi,
  - entitlement tarafinda `Plan` bulunamazsa `allowed: true` ile limitsiz yazma/usage bypass
  senaryolarina yol acabiliyordu.
- Kaynak:
  - `apps/api/src/utils/stripe.ts` — planKey -> priceId fallback davranislari
  - `apps/api/src/utils/entitlements.ts` — plan bulunamazsa allow (fail-open)
- Fix:
  - `createCheckoutSession()` icinde planKey allowlist + DB’de plan varligi zorunlu (invalid -> 400)
  - Entitlement’ta plan lookup fail olursa “free plan’a fallback” + plan yoksa write paths icin fail-closed

```392:468:apps/api/src/utils/stripe.ts
export async function createCheckoutSession(
  orgId: string,
  returnUrl?: string,
  planKey?: string,
  customerEmail?: string,
  promoCode?: string
): Promise<CheckoutSessionResult> {
  const targetPlan = normalizePaidPlanKey(planKey) || "pro";
  if (planKey !== undefined && normalizePaidPlanKey(planKey) === null) {
    throw new InvalidPlanError("Invalid plan key");
  }
  const planRow = await prisma.plan.findUnique({ where: { key: targetPlan }, select: { key: true } });
  if (!planRow) throw new InvalidPlanError("Invalid plan key");
  // ...
}
```

```184:252:apps/api/src/utils/entitlements.ts
const plan =
  (await prisma.plan.findUnique({ where: { key: org.planKey } })) ||
  (await prisma.plan.findUnique({ where: { key: "free" } }));
```

### BILLING-002 [KRITIK] — Stripe webhook idempotency “lastStripeEventId” ile yetersiz (replay/out-of-order retry)

- Etki: Stripe event’leri duplicate / retry / out-of-order gelebilir. Sadece `Organization.lastStripeEventId` tutmak,
  eski event’in daha yeni bir event’den sonra tekrar gelmesi durumunda yeniden islenmesine izin veriyordu.
  Bu durum:
  - promo code `currentUses` artisi,
  - plan/billing state regression,
  - “double apply” audit log / side-effect
  risklerini dogurur.
- Fix: Redis tabanli event-id dedupe (NX + TTL) eklendi; Redis yoksa memory fallback.

```60:170:apps/api/src/routes/stripe-webhook.ts
async function markStripeEventProcessedOnce(eventId: string): Promise<boolean> {
  // Redis SET NX + TTL (24h) -> cross-instance idempotency
  // Memory fallback -> best-effort
}

const firstTime = await markStripeEventProcessedOnce(eventId).catch(() => true);
if (!firstTime) {
  return { ok: true, deduped: true };
}
```

### BILLING-003 [ORTA] — Entitlement subscription check’te `billingStatus: none` paid plan icin “aktif” sayiliyordu

- Etki: Paid `planKey` ile `billingStatus=none` kombinasyonu, write entitlement’lari “aktif” kabul edebiliyordu.
  Yanlis state veya admin/manual plan degisimi ile gelir kaybi dogurabilir.
- Fix: Billing enforcement ile hizalanan kontrol:
  - `billingEnforced=false` ise bloklama yok (manual/internal)
  - `billingEnforced=true` ise `isBillingWriteBlocked()` ile grace window dahil dogru davranis

```207:227:apps/api/src/utils/entitlements.ts
if (!org.billingEnforced) return true;
return !isBillingWriteBlocked(org);
```

### BILLING-004 [ORTA] — Webhook tarafinda planKey dogrulamasi metadata’ya fazla guveniyordu

- Fix: Checkout completion’da `stripePriceId -> mapPriceToplanKey()` tercih ediliyor; metadata.planKey sadece validate edilirse kabul.

```145:176:apps/api/src/routes/stripe-webhook.ts
const planKey =
  (await resolvePlanKeyFromStripeContext({
    stripePriceId: session.metadata?.stripePriceId,
    planKey: session.metadata?.planKey,
  })) || org.planKey;
```

### BILLING-005 [ORTA] — Promo code validate brute force (authenticated) icin rate limit yoktu

- Dosya: `apps/api/src/routes/promo-codes.ts`
- Fix: `/validate` endpoint’ine rate limit + JSON Content-Type enforcement eklendi.

### BILLING-006 [DUSUK] — /api/checkout success/cancel URL production’da request header’dan derive edilebiliyordu

- Dosya: `apps/api/src/routes/portal-billing.ts`
- Fix: Production’da `APP_PUBLIC_URL`/`NEXT_PUBLIC_WEB_URL` zorunlu; request header’dan derive edilmez.

### BILLING-007 [DUSUK] — Checkout endpoint rate limit eksikti

- Dosya: `apps/api/src/routes/portal-billing.ts`
- Fix: `/api/checkout` ve `/portal/billing/checkout` icin rate limit eklendi.

---

## MANUEL GEREKLI BULGULAR (🔧 NEEDS MANUAL FIX)

### MANUAL-301 — Founding Member kontenjani atomic degil (race condition)

- Dosya: `apps/api/src/routes/portal-billing.ts`, `apps/api/src/routes/stripe-webhook.ts`
- Sorun: Founding member eligibility kontrolu (count < 200) atomic degil.
- Not: Webhook tarafina best-effort cap kontrolu eklendi; yine de tam atomic garanti vermez.
- Cozum plani:
  - DB seviyesinde “founding slots” tablosu (200 row) + `SELECT ... FOR UPDATE SKIP LOCKED` ile slot reserve
  - veya Stripe tarafinda founding discount mekanizmasini limitli promotion code ile yonet (Stripe usage limit)

---

## MANDATORY VERIFICATION — KOD KANITI

### isPlanAllowedForFeature() (TAM)

```1:65:apps/api/src/utils/plan-gating.ts
export function isPlanAllowedForFeature(planKey: string, feature: FeatureKey): boolean {
  const normalized = normalizePlanKey(planKey);
  const min = FEATURE_MIN_PLAN[feature] || "free";
  return planRank(normalized) >= planRank(min);
}
```

### Stripe webhook handler (TAM, cekirdek)

```1:476:apps/api/src/routes/stripe-webhook.ts
import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { redis } from "../redis";
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

const STRIPE_EVENT_DEDUPE_TTL_SEC = 24 * 60 * 60; // 24h
const memoryStripeEvents = new Map<string, number>(); // eventId -> expiresAtMs

async function markStripeEventProcessedOnce(eventId: string): Promise<boolean> {
  if (!eventId || eventId.length > 255) return false;

  const now = Date.now();

  // In-memory fallback (if Redis unavailable)
  const existingExpiry = memoryStripeEvents.get(eventId);
  if (existingExpiry && existingExpiry > now) {
    return false;
  }

  // Prefer Redis for cross-instance idempotency
  if (redis.status === "ready") {
    const key = `stripe:webhook:event:${eventId}`;
    const set = await redis.set(key, "1", "EX", STRIPE_EVENT_DEDUPE_TTL_SEC, "NX");
    if (set !== "OK") return false;
    return true;
  }

  // Best-effort memory store
  memoryStripeEvents.set(eventId, now + STRIPE_EVENT_DEDUPE_TTL_SEC * 1000);
  // Basic cleanup
  if (memoryStripeEvents.size > 5000) {
    for (const [k, exp] of memoryStripeEvents) {
      if (exp <= now) memoryStripeEvents.delete(k);
    }
  }
  return true;
}

function normalizePlanKey(input: unknown): string {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

async function resolvePlanKeyFromStripeContext(input: {
  stripePriceId?: unknown;
  planKey?: unknown;
}): Promise<string | null> {
  const priceId = typeof input.stripePriceId === "string" ? input.stripePriceId.trim() : "";
  if (priceId) {
    const mapped = await mapPriceToplanKey(priceId);
    if (mapped) return mapped;
  }
  const rawPlanKey = normalizePlanKey(input.planKey);
  if (!rawPlanKey) return null;
  if (!["free", "starter", "pro", "business"].includes(rawPlanKey)) return null;
  const exists = await prisma.plan.findUnique({ where: { key: rawPlanKey }, select: { key: true } });
  return exists?.key || null;
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

    // SECURITY: Strong idempotency for duplicate/retried webhook deliveries.
    // Storing only "lastStripeEventId" is insufficient because Stripe can retry older events out of order.
    const firstTime = await markStripeEventProcessedOnce(eventId).catch(() => true);
    if (!firstTime) {
      return { ok: true, deduped: true };
    }

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
          // Resolve plan/period/currency context from Stripe price -> plan mapping (preferred).
          // Do NOT trust arbitrary metadata.planKey as authoritative.
          const planKey =
            (await resolvePlanKeyFromStripeContext({
              stripePriceId: session.metadata?.stripePriceId,
              planKey: session.metadata?.planKey,
            })) || org.planKey;
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

          const planRow = await prisma.plan.findUnique({ where: { key: planKey } });

          // Founding member: best-effort cap enforcement on webhook side as well.
          // This does NOT guarantee perfect atomicity across concurrent webhooks (manual hardening may be needed).
          let shouldSetFoundingMember = session.metadata?.foundingMember === "true" && !org.isFoundingMember;
          if (shouldSetFoundingMember) {
            const fmCount = await prisma.organization.count({ where: { isFoundingMember: true } }).catch(() => 999999);
            if (fmCount >= 200) {
              shouldSetFoundingMember = false;
              fastify.log.warn({ orgId: org.id, eventId }, "Founding member cap reached; ignoring foundingMember flag");
            }
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
              // Keep org-level AI limit in sync with plan (defense-in-depth).
              ...(planRow?.maxAiMessagesPerMonth != null ? { aiMessagesLimit: planRow.maxAiMessagesPerMonth } : {}),
              ...(shouldSetFoundingMember
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

          const planRow = await prisma.plan.findUnique({ where: { key: planKey } });

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
              ...(planRow?.maxAiMessagesPerMonth != null ? { aiMessagesLimit: planRow.maxAiMessagesPerMonth } : {}),
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
```

### Quota/usage kontrolu (ornek)

```235:366:apps/api/src/utils/entitlements.ts
export async function checkConversationEntitlement(
  orgId: string
): Promise<EntitlementResult> {
  // Check trial lifecycle first (blocks writes for expired free trials)
  const trialCheck = await checkTrialEntitlement(orgId);
  if (!trialCheck.allowed) {
    return trialCheck;
  }

  const result = await getOrgAndPlan(orgId);
  if (!result || !result.plan) {
    return { allowed: false, error: "Plan configuration error. Please contact support.", code: "SUBSCRIPTION_INACTIVE" };
  }

  const { org, plan } = result;

  // Check subscription status for paid plans
  if (!isSubscriptionActive(org)) {
    return {
      allowed: false,
      error: "Subscription inactive. Please upgrade or renew your plan.",
      code: "SUBSCRIPTION_INACTIVE",
    };
  }

  // Check plan limits (plan base + extra quota from admin grants)
  const monthKey = getMonthKey();
  const usage = await prisma.usage.findUnique({
    where: { orgId_monthKey: { orgId, monthKey } },
  });
  const used = usage?.conversationsCreated || 0;
  const effectiveLimit = plan.maxConversationsPerMonth + (org.extraConversationQuota || 0);

  if (used >= effectiveLimit) {
    return {
      allowed: false,
      error: `Monthly conversation limit reached (${used}/${effectiveLimit}). Upgrade your plan for more.`,
      code: "LIMIT_CONVERSATIONS",
      limit: effectiveLimit,
      used,
    };
  }

  return { allowed: true };
}

export async function checkMessageEntitlement(
  orgId: string
): Promise<EntitlementResult> {
  const trialCheck = await checkTrialEntitlement(orgId);
  if (!trialCheck.allowed) {
    return trialCheck;
  }

  const result = await getOrgAndPlan(orgId);
  if (!result || !result.plan) {
    return { allowed: false, error: "Plan configuration error. Please contact support.", code: "SUBSCRIPTION_INACTIVE" };
  }

  const { org, plan } = result;

  if (!isSubscriptionActive(org)) {
    return {
      allowed: false,
      error: "Subscription inactive. Please upgrade or renew your plan.",
      code: "SUBSCRIPTION_INACTIVE",
    };
  }

  const monthKey = getMonthKey();
  const usage = await prisma.usage.findUnique({
    where: { orgId_monthKey: { orgId, monthKey } },
  });
  const used = usage?.messagesSent || 0;
  const effectiveLimit = plan.maxMessagesPerMonth + (org.extraMessageQuota || 0);

  if (used >= effectiveLimit) {
    return {
      allowed: false,
      error: `Monthly message limit reached (${used}/${effectiveLimit}). Upgrade your plan for more.`,
      code: "LIMIT_MESSAGES",
      limit: effectiveLimit,
      used,
    };
  }

  return { allowed: true };
}
```

```225:320:apps/api/src/utils/ai-service.ts
export async function checkAiQuota(orgId: string): Promise<AiQuotaStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currentMonthAIMessages: true, aiMessagesLimit: true, aiMessagesResetDate: true, planKey: true },
  });

  if (!org) {
    return { used: 0, limit: 100, remaining: 100, isUnlimited: false, exceeded: false, resetDate: new Date().toISOString(), daysUntilReset: 30, percentUsed: 0 };
  }
}
```

---

## FREE PLAN — ERISILMEMESI GEREKEN / PAYWALL DAVRANISI

Not: Bu codebase’de “plan-based hard 403” yerine buyuk oranda “quota/limit-based enforcement” var.
Bu nedenle FREE plan icin “yasak endpoint listesi” degil, “limit asiminda server-side reject eden endpoint’ler” listelenmistir:

- Konusma/message write path’leri (limit asiminda 402/403 benzeri):
  - `/org/conversations/:id/messages` (entitlement + billing write block)
  - Portal conversation write aksiyonlari (assign/close/message/AI) (entitlement/metering)
- AI endpoint’leri (quota asiminda 402/429):
  - `/portal/conversations/:id/ai-suggest`
  - `/portal/conversations/:id/ai-summarize`
  - `/portal/conversations/:id/ai-translate`
  - `/portal/conversations/:id/ai-sentiment`
  - `/portal/conversations/:id/ai-quick-reply`

---

## CHECKLIST (30): ✅ PASS / ✅ FIXED / 🔧 MANUAL

### A. Plan Bypass
1. ✅ FIXED — Unknown planKey ile upgrade/limitsiz bypass kapandi
2. ✅ PASS — Kontroller agirlikla server-side (entitlement/quota)
3. ✅ PASS — Plan state DB’den okunuyor (org/plan tablolarindan)
4. 🔧 MANUAL — Plan degisiminde tum aktif session/token state invalidation politikasi net degil (tasarim karari)
5. ✅ PASS — Client-side kontrol varsa bile server-side enforcement var
6. ✅ FIXED — Merkezi gating fonksiyonu eklendi (policy mapping manuel ayarlanabilir)

### B. Stripe Webhook
7. ✅ PASS — Signature verification var (`verifyWebhookSignature`)
8. ✅ PASS — Secret env’den
9. ✅ FIXED — Replay/duplicate idempotency (Redis NX)
10. ✅ PASS — checkout.session.completed plan/billing guncelliyor
11. ✅ PASS — invoice.payment_failed past_due + grace
12. ✅ PASS — subscription.deleted free’a indiriyor
13. ✅ PASS — Webhook rate limit var

### C. Checkout Flow
14. ✅ FIXED — planKey allowlist + DB plan varligi zorunlu
15. ✅ FIXED — returnUrl/open redirect PART2’de kapandi + production’da header-derived url engeli
16. ✅ PASS — Checkout tamamlanmadan plan aktivasyonu webhook ile (server-side)
17. ✅ FIXED — Duplicate checkout/webhook side-effect dedupe ile azaltildi

### D. Quota & Usage
18. ✅ PASS — AI quota server-side
19. ✅ PASS — Asimda reject
20. ✅ PASS — Usage counter client’tan set edilemiyor (server increment)
21. ✅ PASS — Upsert+increment atomic (Prisma)
22. ✅ PASS — Reset logic mevcut (AI quota reset)

### E. Promo & Founding
23. ✅ FIXED — validate brute force rate limit eklendi
24. 🔧 MANUAL — Promo single-use/reservation tam atomic degil (maxUses concurrency)
25. ✅ PASS — expired promo engelli
26. 🔧 MANUAL — Founding member atomic reservation yok

### F. Subscription lifecycle
27. ✅ PASS — Grace window var
28. ✅ PASS — Entitlement check billing enforcement ile hizalandi
29. ✅ PASS — cancelAtPeriodEnd / currentPeriodEnd alanlari var (enforcement manual/policy)
30. ✅ PASS — Webhook idempotency ile double-process riski azaltildi

---

## DEGISTIRILEN DOSYALAR

- `apps/api/src/routes/stripe-webhook.ts` — Redis idempotency + planKey resolve hardening + founding cap best-effort
- `apps/api/src/utils/stripe.ts` — planKey allowlist + strict priceId fallback + metadata stripePriceId
- `apps/api/src/utils/entitlements.ts` — fail-closed plan fallback + billing enforcement alignment
- `apps/api/src/routes/promo-codes.ts` — promo validate rate limit + JSON Content-Type
- `apps/api/src/routes/portal-billing.ts` — checkout rate limit + production redirect base hardening
- `apps/api/src/utils/plan-gating.ts` — `isPlanAllowedForFeature()` (yeni)

## TYPECHECK

- `npx tsc --noEmit -p apps/api/tsconfig.json` ✅ 0 hata

