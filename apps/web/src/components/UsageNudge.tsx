"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { AlertTriangle, BarChart3, ArrowRight } from "lucide-react";

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

  const convPct = limitConversations > 0 ? (usedConversations / limitConversations) * 100 : 0;
  const msgPct = limitMessages > 0 ? (usedMessages / limitMessages) * 100 : 0;
  const maxPct = Math.max(convPct, msgPct);

  if (maxPct < 70) return null;

  const isOver = maxPct >= 100;
  const isWarn = maxPct >= 90;

  const bg = isOver ? "bg-red-50/80 border-red-200/60" : isWarn ? "bg-amber-50/80 border-amber-200/60" : "bg-blue-50/80 border-blue-200/60";
  const iconColor = isOver ? "text-red-500" : isWarn ? "text-amber-500" : "text-blue-500";
  const textColor = isOver ? "text-red-800" : isWarn ? "text-amber-800" : "text-blue-800";

  const message = isOver
    ? t("nudge.limitReached")
    : isWarn
      ? t("nudge.almostFull").replace("{pct}", String(Math.round(maxPct)))
      : t("nudge.approaching").replace("{pct}", String(Math.round(maxPct)));

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${bg} ${className}`}>
      {isOver || isWarn ? (
        <AlertTriangle size={15} className={`${iconColor} flex-shrink-0`} />
      ) : (
        <BarChart3 size={15} className={`${iconColor} flex-shrink-0`} />
      )}
      <p className={`text-xs font-medium flex-1 ${textColor}`}>{message}</p>
      <Link href="/portal/billing"
        className={`flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${
          isOver ? "px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700" :
          isWarn ? "px-2.5 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700" :
          "text-blue-700 hover:text-blue-900"
        } transition-colors`}>
        {isOver ? t("nudge.upgradeNow") : isWarn ? t("nudge.upgrade") : t("nudge.viewPlans")}
        {(isOver || isWarn) && <ArrowRight size={10} />}
      </Link>
    </div>
  );
}
