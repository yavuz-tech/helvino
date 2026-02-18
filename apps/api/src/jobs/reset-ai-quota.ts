/* ═══════════════════════════════════════════════════════════════
 * Daily AI Quota Reset Job
 * ═══════════════════════════════════════════════════════════════
 * Run daily at 00:00 via a scheduler or cron.
 * Finds orgs where aiMessagesResetDate + 30 days < now
 * and resets their monthly AI message counter.
 * ═══════════════════════════════════════════════════════════════ */

import { prisma } from "../prisma";
import { getAiLimitForPlan } from "../utils/ai-service";

let lastDbDownLogAt = 0;

/**
 * Resolve the correct AI message limit for an org.
 * Prefers the DB plan table's `maxAiMessagesPerMonth` over the hardcoded fallback,
 * ensuring Stripe-synced limits aren't silently overwritten on monthly reset.
 */
async function resolveAiLimit(planKey: string): Promise<number> {
  const planRow = await prisma.plan.findUnique({
    where: { key: planKey },
    select: { maxAiMessagesPerMonth: true },
  });
  if (planRow?.maxAiMessagesPerMonth != null && planRow.maxAiMessagesPerMonth > 0) {
    return planRow.maxAiMessagesPerMonth;
  }
  return getAiLimitForPlan(planKey);
}

/** Reset AI quota for all orgs whose 30-day period has elapsed. */
export async function resetExpiredAiQuotas(): Promise<{ resetCount: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find all orgs whose reset date is older than 30 days
  let expiredOrgs: Array<{ id: string; planKey: string }> = [];
  try {
    expiredOrgs = await prisma.organization.findMany({
      where: {
        aiMessagesResetDate: { lt: thirtyDaysAgo },
        isActive: true,
      },
      select: { id: true, planKey: true },
    });
  } catch (err) {
    // In local dev, DB might not be running yet. Never crash the API because of a background job.
    const now = Date.now();
    if (now - lastDbDownLogAt > 60_000) {
      lastDbDownLogAt = now;
      console.warn("[AI Quota Reset] Skipping run: database unavailable");
    }
    return { resetCount: 0 };
  }

  if (expiredOrgs.length === 0) return { resetCount: 0 };

  // Reset each org's counter and update limit based on current plan
  let resetCount = 0;
  for (const org of expiredOrgs) {
    try {
      const newLimit = await resolveAiLimit(org.planKey);
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          currentMonthAIMessages: 0,
          aiMessagesResetDate: new Date(),
          aiMessagesLimit: newLimit,
        },
      });
      resetCount++;
    } catch (err) {
      console.error(`[AI Quota Reset] Failed to reset org ${org.id}:`, err);
    }
  }

  console.info(`[AI Quota Reset] Reset ${resetCount}/${expiredOrgs.length} organizations`);
  return { resetCount };
}

/** Start a daily interval timer (runs every 24h). Call once at server boot. */
export function scheduleAiQuotaReset(): void {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const safeRun = async (label: string) => {
    try {
      console.info(`[AI Quota Reset] Running ${label} check...`);
      await resetExpiredAiQuotas();
    } catch (err) {
      console.warn("[AI Quota Reset] Job failed (non-fatal):", err);
    }
  };

  // Run once on startup (deferred)
  setTimeout(() => { void safeRun("initial"); }, 5000);

  // Then run every 24 hours
  setInterval(() => { void safeRun("scheduled"); }, TWENTY_FOUR_HOURS);

  console.info("[AI Quota Reset] Scheduled daily reset job");
}
