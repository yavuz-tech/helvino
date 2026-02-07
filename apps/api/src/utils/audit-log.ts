import { prisma } from "../prisma";

/**
 * Write an audit log entry.
 * @param orgId     Organization ID
 * @param actor     Admin email, "system", or "webhook"
 * @param action    e.g. "usage.reset", "quota.grant", "billing.lock"
 * @param details   Optional JSON details
 * @param requestId Optional request correlation ID
 */
export async function writeAuditLog(
  orgId: string,
  actor: string,
  action: string,
  details?: Record<string, unknown>,
  requestId?: string
): Promise<void> {
  try {
    const mergedDetails = details
      ? { ...details, ...(requestId ? { requestId } : {}) }
      : requestId
        ? { requestId }
        : undefined;

    await prisma.auditLog.create({
      data: {
        orgId,
        actor,
        action,
        details: mergedDetails ? JSON.parse(JSON.stringify(mergedDetails)) : undefined,
      },
    });
  } catch (err) {
    // Audit log writes should never break the main flow
    console.error("Audit log write error:", err);
  }
}
