import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  checkoutSession: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
};

const sendAbandonedCheckoutEmailMock = vi.fn();
const writeAuditLogMock = vi.fn();

vi.mock("../../src/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../../src/emails/send-abandoned-email", () => ({
  sendAbandonedCheckoutEmail: sendAbandonedCheckoutEmailMock,
}));

vi.mock("../../src/utils/audit-log", () => ({
  writeAuditLog: writeAuditLogMock,
}));

import { checkAbandonedCheckouts } from "../../src/jobs/checkAbandonedCheckouts";

describe("checkAbandonedCheckouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.checkoutSession.findMany.mockResolvedValue([
      {
        id: "cs_abandoned_1",
        organizationId: "org_1",
        email: "owner@helvino.com",
      },
    ]);
    prismaMock.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.checkoutSession.update.mockResolvedValue({});
    sendAbandonedCheckoutEmailMock.mockResolvedValue({
      sent: true,
      promoCode: "COMEBACK20",
    });
    writeAuditLogMock.mockResolvedValue(undefined);
  });

  it("marks stale started sessions as abandoned and sends recovery email", async () => {
    const result = await checkAbandonedCheckouts();

    expect(result).toEqual({
      scanned: 1,
      markedAbandoned: 1,
      emailsSent: 1,
    });
    expect(prismaMock.checkoutSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cs_abandoned_1", status: "started" },
        data: expect.objectContaining({ status: "abandoned" }),
      })
    );
    expect(sendAbandonedCheckoutEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cs_abandoned_1",
        email: "owner@helvino.com",
      })
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      "org_1",
      "system",
      "checkout_abandoned",
      expect.objectContaining({
        sessionId: "cs_abandoned_1",
        emailSent: true,
        promoCode: "COMEBACK20",
      })
    );
  });
});
