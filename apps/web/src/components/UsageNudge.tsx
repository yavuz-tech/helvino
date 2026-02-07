"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";

/**
 * UsageNudge — contextual upgrade prompt based on usage percentage.
 *
 * Thresholds:
 *   70-89%: soft CTA (blue)
 *   90-99%: strong CTA (amber)
 *   100%+: lock CTA (red) — already handled by billing page, but this adds inline support
 */

interface UsageNudgeProps {
  usedConversations: number;
  limitConversations: number;
  usedMessages: number;
  limitMessages: number;
  className?: string;
}

export default function UsageNudge({
  usedConversations,
  limitConversations,
  usedMessages,
  limitMessages,
  className = "",
}: UsageNudgeProps) {
  const { t } = useI18n();

  const convPct =
    limitConversations > 0
      ? (usedConversations / limitConversations) * 100
      : 0;
  const msgPct =
    limitMessages > 0 ? (usedMessages / limitMessages) * 100 : 0;
  const maxPct = Math.max(convPct, msgPct);

  if (maxPct < 70) return null;

  if (maxPct >= 100) {
    return (
      <div
        className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-800 font-medium">
            {t("nudge.limitReached")}
          </p>
          <Link
            href="/portal/billing"
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            {t("nudge.upgradeNow")}
          </Link>
        </div>
      </div>
    );
  }

  if (maxPct >= 90) {
    return (
      <div
        className={`bg-amber-50 border border-amber-200 rounded-lg p-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-amber-800">
            {t("nudge.almostFull").replace("{pct}", String(Math.round(maxPct)))}
          </p>
          <Link
            href="/portal/billing"
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            {t("nudge.upgrade")}
          </Link>
        </div>
      </div>
    );
  }

  // 70-89%
  return (
    <div
      className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-blue-800">
          {t("nudge.approaching").replace("{pct}", String(Math.round(maxPct)))}
        </p>
        <Link
          href="/portal/billing"
          className="text-xs text-blue-700 hover:text-blue-900 font-medium whitespace-nowrap ml-3"
        >
          {t("nudge.viewPlans")}
        </Link>
      </div>
    </div>
  );
}
