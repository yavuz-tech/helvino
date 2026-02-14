import Stripe from "stripe";
import { getStripeClient } from "./stripe";

const FOUNDING_COUPON_ID = "HELVION_FOUNDING_40";

export async function ensureFoundingCoupon(): Promise<Stripe.Coupon> {
  const stripe = getStripeClient();

  try {
    const existing = await stripe.coupons.retrieve(FOUNDING_COUPON_ID);
    return existing;
  } catch (error) {
    const stripeError = error as Stripe.StripeRawError & { statusCode?: number };
    if (stripeError?.statusCode !== 404) {
      console.error("[stripe-founding-coupon] Failed to retrieve founding coupon:", error);
      throw error;
    }
  }

  try {
    return await stripe.coupons.create({
      id: FOUNDING_COUPON_ID,
      percent_off: 40,
      duration: "forever",
      name: "Founding Member - 40% Lifetime Discount",
      metadata: {
        type: "founding_member",
        createdBy: "api",
      },
    });
  } catch (error) {
    console.error("[stripe-founding-coupon] Failed to create founding coupon:", error);
    throw error;
  }
}
