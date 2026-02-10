import Stripe from "stripe";
import { prisma } from "../prisma";

export class StripeNotConfiguredError extends Error {
  code = "STRIPE_NOT_CONFIGURED";
  constructor() {
    super("Stripe not configured");
  }
}

export class PromoCodeInvalidError extends Error {
  code = "PROMO_CODE_INVALID";
  constructor(message = "Promo code is invalid") {
    super(message);
  }
}

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
  planType: string;
  amount: number;
  email: string;
}

export function extractPromoPercentFromCode(code: string): number | null {
  const normalized = code.trim().toUpperCase();
  const match = normalized.match(/(\d{1,3})$/);
  if (!match) return null;
  const percent = Number.parseInt(match[1], 10);
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) return null;
  return percent;
}

export async function syncPromoCodeWithStripe(params: {
  id: string;
  code: string;
  stripeCouponId?: string | null;
  stripePromotionCodeId?: string | null;
}) {
  if (!isStripeConfigured()) {
    throw new StripeNotConfiguredError();
  }

  const stripe = getStripeClient();
  const code = params.code.trim().toUpperCase();
  const percent = extractPromoPercentFromCode(code);
  if (!percent) {
    throw new PromoCodeInvalidError(
      "Promo code must end with a number between 1 and 100 (e.g. WELCOME20)."
    );
  }

  let couponId = params.stripeCouponId || null;
  if (!couponId) {
    const coupon = await stripe.coupons.create({
      percent_off: percent,
      duration: "once",
      name: code,
      metadata: {
        promoCodeId: params.id,
        code,
      },
    });
    couponId = coupon.id;
  }

  let promotionCodeId = params.stripePromotionCodeId || null;
  if (!promotionCodeId) {
    const existing = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });
    if (existing.data.length > 0) {
      promotionCodeId = existing.data[0].id;
    } else {
      const promotionCode = await stripe.promotionCodes.create({
        coupon: couponId,
        code,
        active: true,
        metadata: {
          promoCodeId: params.id,
          code,
        },
      });
      promotionCodeId = promotionCode.id;
    }
  }

  return {
    code,
    percent,
    stripeCouponId: couponId,
    stripePromotionCodeId: promotionCodeId,
  };
}

async function resolvePromotionCodeForCheckout(
  orgId: string,
  promoInput: string
): Promise<{ code: string; stripePromotionCodeId: string }> {
  const code = promoInput.trim().toUpperCase();
  const now = new Date();

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId: orgId },
    select: { campaignsEnabled: true },
  });

  const promo = await prisma.promoCode.findFirst({
    where: {
      code,
      isActive: true,
      validFrom: { lte: now },
      AND: [
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        {
          OR: [
            { isGlobal: true },
            ...(settings?.campaignsEnabled ? [{ createdBy: orgId, isGlobal: false }] : []),
            { createdBy: "system", isGlobal: false },
            { createdBy: "system-abandoned-checkout", isGlobal: false },
          ],
        },
      ],
    },
  });

  if (!promo) {
    throw new PromoCodeInvalidError("Promo code not found or inactive.");
  }
  if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
    throw new PromoCodeInvalidError("Promo code max usage reached.");
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

  return {
    code: synced.code,
    stripePromotionCodeId: synced.stripePromotionCodeId,
  };
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new StripeNotConfiguredError();
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });
}

function getCheckoutUrls(returnUrl?: string) {
  const successUrl = process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = process.env.STRIPE_CANCEL_URL;

  if (successUrl && cancelUrl) {
    return { successUrl, cancelUrl };
  }

  if (!returnUrl) {
    throw new Error("Return URL required for Stripe checkout");
  }

  return {
    successUrl: `${returnUrl}?success=1`,
    cancelUrl: `${returnUrl}?canceled=1`,
  };
}

async function ensureStripeCustomer(orgId: string) {
  const stripe = getStripeClient();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });
  if (!org) throw new Error("Organization not found");

  if (org.stripeCustomerId) {
    return { stripe, org, customerId: org.stripeCustomerId };
  }

  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { orgId: org.id, orgKey: org.key },
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });

  return { stripe, org, customerId: customer.id };
}

async function resolveCheckoutEmail(orgId: string, explicitEmail?: string): Promise<string> {
  if (explicitEmail && explicitEmail.trim()) {
    return explicitEmail.trim().toLowerCase();
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerUserId: true },
  });

  if (org?.ownerUserId) {
    const owner = await prisma.orgUser.findUnique({
      where: { id: org.ownerUserId },
      select: { email: true },
    });
    if (owner?.email) {
      return owner.email.toLowerCase();
    }
  }

  const firstOrgUser = await prisma.orgUser.findFirst({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });

  return (firstOrgUser?.email || "unknown@unknown.local").toLowerCase();
}

function normalizePlanType(planKey: string): string {
  const key = planKey.toLowerCase();
  if (key === "pro") return "PRO";
  if (key === "business" || key === "enterprise") return "ENTERPRISE";
  return "STARTER";
}

/**
 * Resolve a Stripe Price ID from a plan key.
 * Priority: Plan.stripePriceId from DB > env fallback > throw.
 */
async function resolvePriceId(planKey: string): Promise<string> {
  // Look up from Plan table first
  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (plan?.stripePriceId) return plan.stripePriceId;

  // Env fallbacks
  const envMap: Record<string, string | undefined> = {
    pro: process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRICE_ID_STARTER,
    business: process.env.STRIPE_PRICE_BUSINESS,
  };

  const envPrice = envMap[planKey];
  if (envPrice) return envPrice;

  // Last resort: generic starter price
  if (process.env.STRIPE_PRICE_ID_STARTER) {
    return process.env.STRIPE_PRICE_ID_STARTER;
  }

  throw new StripeNotConfiguredError();
}

/**
 * Map a Stripe Price ID back to a plan key.
 * Looks up the Plan table; falls back to env var matching.
 */
export async function mapPriceToplanKey(priceId: string): Promise<string | null> {
  const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });
  if (plan) return plan.key;

  // Env fallback
  if (priceId === process.env.STRIPE_PRICE_PRO || priceId === process.env.STRIPE_PRICE_ID_STARTER) {
    return "pro";
  }
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) {
    return "business";
  }

  return null;
}

/**
 * Create a Stripe Checkout Session for a specific plan.
 */
export async function createCheckoutSession(
  orgId: string,
  returnUrl?: string,
  planKey?: string,
  customerEmail?: string,
  promoCode?: string
): Promise<CheckoutSessionResult> {
  if (!isStripeConfigured()) {
    throw new StripeNotConfiguredError();
  }

  const targetPlan = planKey || "pro";
  const priceId = await resolvePriceId(targetPlan);

  const { stripe, org, customerId } = await ensureStripeCustomer(orgId);
  const urls = getCheckoutUrls(returnUrl);
  let resolvedPromoCode: string | null = null;
  let promotionCodeId: string | null = null;
  if (promoCode && promoCode.trim()) {
    const resolved = await resolvePromotionCodeForCheckout(org.id, promoCode);
    resolvedPromoCode = resolved.code;
    promotionCodeId = resolved.stripePromotionCodeId;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    ...(promotionCodeId ? { discounts: [{ promotion_code: promotionCodeId }] } : {}),
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    metadata: {
      orgId: org.id,
      orgKey: org.key,
      planKey: targetPlan,
      promoCode: resolvedPromoCode || "",
    },
    subscription_data: {
      metadata: {
        orgId: org.id,
        orgKey: org.key,
        planKey: targetPlan,
        promoCode: resolvedPromoCode || "",
      },
    },
  });

  const email =
    (session.customer_details?.email || customerEmail || (await resolveCheckoutEmail(org.id, customerEmail))).toLowerCase();
  const amount = session.amount_total || 0;

  await prisma.checkoutSession.upsert({
    where: { id: session.id },
    update: {
      organizationId: org.id,
      email,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : customerId,
      stripePriceId: priceId,
      planType: normalizePlanType(targetPlan),
      amount,
      status: "started",
    },
    create: {
      id: session.id,
      organizationId: org.id,
      email,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : customerId,
      stripePriceId: priceId,
      planType: normalizePlanType(targetPlan),
      amount,
      status: "started",
    },
  });

  return {
    url: session.url!,
    sessionId: session.id,
    planType: normalizePlanType(targetPlan),
    amount,
    email,
  };
}

export async function createCustomerPortalSession(
  orgId: string,
  returnUrl?: string
) {
  if (!isStripeConfigured()) {
    throw new StripeNotConfiguredError();
  }

  const stripe = getStripeClient();
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org || !org.stripeCustomerId) {
    throw new Error("Stripe customer not found");
  }

  const portalReturnUrl = returnUrl || process.env.STRIPE_SUCCESS_URL;
  if (!portalReturnUrl) {
    throw new Error("Return URL required for customer portal");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: portalReturnUrl,
  });

  return session.url;
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined
): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !signature) {
    throw new StripeNotConfiguredError();
  }

  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

/**
 * List recent invoices for a Stripe customer.
 */
export async function listInvoices(
  stripeCustomerId: string,
  limit = 10
): Promise<InvoiceSummary[]> {
  if (!isStripeConfigured()) {
    throw new StripeNotConfiguredError();
  }

  const stripe = getStripeClient();
  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit,
  });

  return invoices.data.map((inv) => ({
    id: inv.id,
    number: inv.number || null,
    status: inv.status || "unknown",
    amountDue: inv.amount_due,
    amountPaid: inv.amount_paid,
    currency: inv.currency,
    hostedInvoiceUrl: inv.hosted_invoice_url || null,
    invoicePdf: inv.invoice_pdf || null,
    created: inv.created,
    periodEnd: inv.period_end,
  }));
}

export interface InvoiceSummary {
  id: string;
  number: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  created: number;
  periodEnd: number;
}
