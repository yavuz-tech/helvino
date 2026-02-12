import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, stripeState } = vi.hoisted(() => ({
  prismaMock: {
    plan: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    orgUser: { findUnique: vi.fn(), findFirst: vi.fn() },
    checkoutSession: { upsert: vi.fn() },
    organizationSettings: { findUnique: vi.fn() },
    promoCode: { findFirst: vi.fn(), update: vi.fn() },
  },
  stripeState: {
    customerCreate: vi.fn(),
    checkoutCreate: vi.fn(),
  },
}));

vi.mock("../../src/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      customers = { create: stripeState.customerCreate };
      checkout = { sessions: { create: stripeState.checkoutCreate } };
    },
  };
});

import { createCheckoutSession } from "../../src/utils/stripe";

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_SUCCESS_URL = "http://localhost:3000/success";
    process.env.STRIPE_CANCEL_URL = "http://localhost:3000/cancel";

    prismaMock.plan.findUnique.mockResolvedValue({
      key: "pro",
      stripePriceId: "price_pro_123",
    });
    prismaMock.organization.findUnique.mockResolvedValue({
      id: "org_1",
      key: "helvino",
      name: "Helvino",
      stripeCustomerId: null,
    });
    prismaMock.organization.update.mockResolvedValue({
      id: "org_1",
      stripeCustomerId: "cus_1",
    });
    stripeState.customerCreate.mockResolvedValue({ id: "cus_1" });
    stripeState.checkoutCreate.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/cs_test_1",
      amount_total: 2900,
      customer: "cus_1",
      customer_details: { email: "owner@helvino.com" },
    });
    prismaMock.checkoutSession.upsert.mockResolvedValue({});
  });

  it("persists a started checkout session when checkout is created", async () => {
    const result = await createCheckoutSession("org_1", "http://localhost:3000/portal/billing", "pro");

    expect(result.sessionId).toBe("cs_test_1");
    expect(result.planType).toBe("PRO");
    expect(prismaMock.checkoutSession.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.checkoutSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cs_test_1" },
        update: expect.objectContaining({
          status: "started",
          organizationId: "org_1",
        }),
        create: expect.objectContaining({
          id: "cs_test_1",
          status: "started",
          organizationId: "org_1",
        }),
      })
    );
  });
});
