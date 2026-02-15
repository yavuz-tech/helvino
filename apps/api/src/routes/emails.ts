import { FastifyInstance } from "fastify";
import { getAbandonedCheckoutEmail } from "../utils/email-templates";
import { requireAdmin } from "../middleware/require-admin";

export async function emailRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/preview/abandoned-checkout",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
    const email = getAbandonedCheckoutEmail("en", {
      name: "Test User",
      planName: "STARTER",
      promoCode: "WELCOME20",
      checkoutUrl: "http://localhost:3000/portal/billing?resume=test_session&promo=WELCOME20",
      expiresInHours: 48,
      discountPercent: 20,
    });
    reply.type("text/html; charset=utf-8");
    return email.html;
    }
  );
}
