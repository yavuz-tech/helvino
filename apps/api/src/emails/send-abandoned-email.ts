import { randomUUID } from "crypto";
import type { CheckoutSession } from "@prisma/client";
import { prisma } from "../prisma";
import { getDefaultFromAddress, sendEmail } from "../utils/mailer";
import { renderAbandonedCheckoutEmail } from "./abandoned-checkout";

function generatePromoCode(): string {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `COMEBACK${suffix}`;
}

export async function sendAbandonedCheckoutEmail(session: CheckoutSession): Promise<{ sent: boolean; promoCode: string | null }> {
  const promoCode = generatePromoCode();
  const now = new Date();
  const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Create a one-time promo code for this abandoned session.
  const promo = await prisma.promoCode.create({
    data: {
      id: randomUUID(),
      code: promoCode,
      discountType: "percentage",
      discountValue: 20,
      maxUses: 1,
      currentUses: 0,
      validFrom: now,
      validUntil,
      isActive: true,
      createdBy: "system-abandoned-checkout",
    },
  });

  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: { promoCodeId: promo.id },
  });

  const appUrl = process.env.APP_URL || process.env.APP_PUBLIC_URL || "http://localhost:3000";
  const checkoutUrl = `${appUrl}/portal/billing?resume=${encodeURIComponent(session.id)}&promo=${encodeURIComponent(promoCode)}`;
  const html = renderAbandonedCheckoutEmail({
    name: session.email.split("@")[0] || "User",
    planName: session.planType,
    promoCode,
    checkoutUrl,
    expiresInHours: 24,
  });

  const result = await sendEmail({
    from: getDefaultFromAddress(),
    to: session.email,
    subject: "Helvino planiniz sizi bekliyor! 🎁",
    html,
    tags: ["checkout-abandoned", "promo"],
  });

  return { sent: result.success, promoCode };
}
