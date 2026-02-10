import { prisma } from "../prisma";
import { writeAuditLog } from "../utils/audit-log";
import { sendAbandonedCheckoutEmail } from "../emails/send-abandoned-email";

export async function checkAbandonedCheckouts(): Promise<{ scanned: number; markedAbandoned: number; emailsSent: number }> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const abandoned = await prisma.checkoutSession.findMany({
    where: {
      status: "started",
      createdAt: { lt: fiveMinAgo },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let markedAbandoned = 0;
  let emailsSent = 0;

  for (const session of abandoned) {
    // Claim the session in a race-safe way.
    const claim = await prisma.checkoutSession.updateMany({
      where: { id: session.id, status: "started" },
      data: {
        status: "abandoned",
        abandonedAt: new Date(),
      },
    });
    if (claim.count === 0) continue;

    markedAbandoned++;

    let sent = false;
    let promoCode: string | null = null;
    try {
      const emailResult = await sendAbandonedCheckoutEmail(session);
      sent = emailResult.sent;
      promoCode = emailResult.promoCode;
      if (sent) {
        emailsSent++;
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { abandonedEmailSentAt: new Date() },
        });
      }
    } catch (error) {
      console.error("[checkout-abandoned] email send failed:", error);
    }

    await writeAuditLog(session.organizationId, "system", "checkout_abandoned", {
      sessionId: session.id,
      email: session.email,
      promoCode,
      emailSent: sent,
    });
  }

  if (abandoned.length > 0) {
    console.log(
      `[checkout-abandoned] scanned=${abandoned.length} marked=${markedAbandoned} emailed=${emailsSent}`
    );
  }

  return { scanned: abandoned.length, markedAbandoned, emailsSent };
}
