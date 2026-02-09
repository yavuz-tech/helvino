/* ═══════════════════════════════════════════════════════════════
 * Daily AI Quota Reset Job
 * ═══════════════════════════════════════════════════════════════
 * Run daily at 00:00 via a scheduler or cron.
 * Finds orgs where aiMessagesResetDate + 30 days < now
 * and resets their monthly AI message counter.
 * ═══════════════════════════════════════════════════════════════ */

import { prisma } from "../prisma";
import { getAiLimitForPlan } from "../utils/ai-service";

/** Reset AI quota for all orgs whose 30-day period has elapsed. */
export async function resetExpiredAiQuotas(): Promise<{ resetCount: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find all orgs whose reset date is older than 30 days
  const expiredOrgs = await prisma.organization.findMany({
    where: {
      aiMessagesResetDate: { lt: thirtyDaysAgo },
      isActive: true,
    },
    select: { id: true, planKey: true },
  });

  if (expiredOrgs.length === 0) return { resetCount: 0 };

  // Reset each org's counter and update limit based on current plan
  let resetCount = 0;
  for (const org of expiredOrgs) {
    try {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          currentMonthAIMessages: 0,
          aiMessagesResetDate: new Date(),
          aiMessagesLimit: getAiLimitForPlan(org.planKey),
        },
      });
      resetCount++;
    } catch (err) {
      console.error(`[AI Quota Reset] Failed to reset org ${org.id}:`, err);
    }
  }

  console.log(`[AI Quota Reset] Reset ${resetCount}/${expiredOrgs.length} organizations`);
  return { resetCount };
}

/** Start a daily interval timer (runs every 24h). Call once at server boot. */
export function scheduleAiQuotaReset(): void {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Run once on startup (deferred)
  setTimeout(async () => {
    console.log("[AI Quota Reset] Running initial check...");
    await resetExpiredAiQuotas();
  }, 5000);

  // Then run every 24 hours
  setInterval(async () => {
    console.log("[AI Quota Reset] Running scheduled check...");
    await resetExpiredAiQuotas();
  }, TWENTY_FOUR_HOURS);

  console.log("[AI Quota Reset] Scheduled daily reset job");
}
