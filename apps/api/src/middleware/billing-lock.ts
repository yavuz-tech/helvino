import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import { getBillingLockStatus } from "../utils/billing-state";

export async function enforceWidgetBillingLock(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const internalKey = request.headers["x-internal-key"] as string | undefined;
  const isAdminBypass =
    Boolean((request as any).session?.adminUserId) ||
    (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY);

  if (isAdminBypass) return;

  const org = (request as any).org;
  if (!org) return;

  const now = new Date();
  const status = getBillingLockStatus(org, now);

  if (!status.locked) return;

  if (status.shouldSetBillingLockedAt) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { billingLockedAt: now },
    });
  }

  const graceMessage = status.graceEndsAt
    ? `Payment required (grace period ends ${status.graceEndsAt.toISOString()})`
    : "Payment required";

  reply.code(402);
  return {
    error: "payment_required",
    code: status.reason === "grace" ? "BILLING_GRACE" : "BILLING_LOCKED",
    message: status.reason === "grace" ? graceMessage : "Payment required",
  };
}
