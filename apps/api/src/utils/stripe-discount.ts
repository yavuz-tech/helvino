import Stripe from "stripe";
import { getStripeClient } from "./stripe";

const FOUNDING_COUPON_ID = "HELVION_FOUNDING_40";

function isNotFoundError(error: unknown): boolean {
  const e = error as Stripe.StripeRawError & { statusCode?: number };
  return e?.statusCode === 404;
}

async function createCoupon(params: {
  id: string;
  percent: number;
  name: string;
  metadata: Record<string, string>;
}): Promise<Stripe.Coupon> {
  const stripe = getStripeClient();
  return stripe.coupons.create({
    id: params.id,
    percent_off: params.percent,
    duration: "forever",
    name: params.name,
    metadata: params.metadata,
  });
}

export async function ensureOrgDiscountCoupon(
  orgId: string,
  percent: number
): Promise<Stripe.Coupon> {
  const stripe = getStripeClient();
  const couponId = `HELVION_ORG_${orgId}_${percent}`;

  try {
    const existing = await stripe.coupons.retrieve(couponId);
    if (existing.percent_off !== percent) {
      await stripe.coupons.del(couponId);
      return createCoupon({
        id: couponId,
        percent,
        name: `Helvion ${percent}% Discount`,
        metadata: { orgId, type: "global_discount", createdBy: "api" },
      });
    }
    return existing;
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.error("[stripe-discount] ensureOrgDiscountCoupon retrieve failed:", error);
      throw error;
    }
  }

  try {
    return await createCoupon({
      id: couponId,
      percent,
      name: `Helvion ${percent}% Discount`,
      metadata: { orgId, type: "global_discount", createdBy: "api" },
    });
  } catch (error) {
    console.error("[stripe-discount] ensureOrgDiscountCoupon create failed:", error);
    throw error;
  }
}

export async function ensureFoundingCoupon(): Promise<Stripe.Coupon> {
  const stripe = getStripeClient();

  try {
    const existing = await stripe.coupons.retrieve(FOUNDING_COUPON_ID);
    return existing;
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.error("[stripe-discount] ensureFoundingCoupon retrieve failed:", error);
      throw error;
    }
  }

  try {
    return await createCoupon({
      id: FOUNDING_COUPON_ID,
      percent: 40,
      name: "Founding Member - 40% Lifetime Discount",
      metadata: { type: "founding_member", createdBy: "api" },
    });
  } catch (error) {
    console.error("[stripe-discount] ensureFoundingCoupon create failed:", error);
    throw error;
  }
}
