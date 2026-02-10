import { FastifyInstance } from "fastify";
import { renderAbandonedCheckoutEmail } from "../emails/abandoned-checkout";

export async function emailRoutes(fastify: FastifyInstance) {
  fastify.get("/preview/abandoned-checkout", async (_request, reply) => {
    const html = renderAbandonedCheckoutEmail({
      name: "Test User",
      planName: "STARTER",
      promoCode: "WELCOME20",
      checkoutUrl: "http://localhost:3000/portal/billing?resume=test_session&promo=WELCOME20",
      expiresInHours: 24,
    });
    reply.type("text/html; charset=utf-8");
    return html;
  });
}
