import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  organization: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  checkoutSession: { updateMany: vi.fn() },
  promoCode: { updateMany: vi.fn(), findFirst: vi.fn() },
};

const writeAuditLogMock = vi.fn();
const verifyWebhookSignatureMock = vi.fn();
const isStripeConfiguredMock = vi.fn();
const getStripeClientMock = vi.fn();
const mapPriceToplanKeyMock = vi.fn();

vi.mock("../../src/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../../src/utils/audit-log", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("../../src/utils/stripe", () => ({
  verifyWebhookSignature: verifyWebhookSignatureMock,
  isStripeConfigured: isStripeConfiguredMock,
  getStripeClient: getStripeClientMock,
  mapPriceToplanKey: mapPriceToplanKeyMock,
  StripeNotConfiguredError: class StripeNotConfiguredError extends Error {},
}));

import { stripeWebhookRoutes } from "../../src/routes/stripe-webhook";

describe("stripeWebhookRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GRACE_DAYS = "7";
    isStripeConfiguredMock.mockReturnValue(false);
    prismaMock.organization.findUnique.mockResolvedValue({
      id: "org_1",
      key: "helvino",
      planKey: "pro",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      lastStripeEventId: null,
    });
    prismaMock.organization.update.mockResolvedValue({});
    prismaMock.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.promoCode.updateMany.mockResolvedValue({ count: 1 });
    writeAuditLogMock.mockResolvedValue(undefined);
  });

  it("marks started checkout sessions as completed on checkout.session.completed", async () => {
    verifyWebhookSignatureMock.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          customer: "cus_1",
          subscription: "sub_1",
          metadata: {
            orgId: "org_1",
            orgKey: "helvino",
            planKey: "pro",
            promoCode: "WELCOME20",
          },
        },
      },
    });

    const post = vi.fn();
    await stripeWebhookRoutes({ post } as any);
    const handler = post.mock.calls[0][2];

    const reply = { code: vi.fn() };
    const payload = await handler(
      {
        headers: { "stripe-signature": "sig_test" },
        rawBody: JSON.stringify({ test: true }),
      },
      reply
    );

    expect(payload).toEqual({ ok: true });
    expect(prismaMock.checkoutSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "cs_test_1",
          status: { in: ["started", "abandoned"] },
        },
        data: expect.objectContaining({
          status: "completed",
        }),
      })
    );
    expect(prismaMock.promoCode.updateMany).toHaveBeenCalledWith({
      where: { code: "WELCOME20" },
      data: { currentUses: { increment: 1 } },
    });
  });
});
