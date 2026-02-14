"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, Zap, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import Link from "next/link";

interface AiQuota {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  exceeded: boolean;
  resetDate: string;
  daysUntilReset: number;
  percentUsed: number;
  plan: string;
}

interface AIUsageStatsProps {
  /** Show prominent warning style when usage > 80% */
  prominent?: boolean;
  /** Compact mode for sidebar/small containers */
  compact?: boolean;
  /** Callback when upgrade is needed */
  onUpgradeNeeded?: () => void;
}

export default function AIUsageStats({ prominent = false, compact = false, onUpgradeNeeded }: AIUsageStatsProps) {
  const { t } = useI18n();
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = useCallback(async () => {
    try {
      const res = await portalApiFetch("/portal/ai/quota");
      if (res.ok) {
        const data = await res.json();
        setQuota(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuota(); }, [fetchQuota]);

  if (loading || !quota) return null;

  // Don't show for unlimited plans
  if (quota.isUnlimited) {
    if (compact) return null;
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-900">{t("aiQuota.unlimited")}</p>
            <p className="text-xs text-emerald-700">Enterprise</p>
          </div>
        </div>
      </div>
    );
  }

  const isNearLimit = quota.percentUsed >= 80;
  const isExceeded = quota.exceeded;
  const showProminent = prominent || isNearLimit;
  const colors = isExceeded
    ? { bg: "from-red-50 to-rose-50", border: "border-red-200/60", bar: "from-red-500 to-rose-500", text: "text-red-900", sub: "text-red-700" }
    : isNearLimit
    ? { bg: "from-amber-50 to-yellow-50", border: "border-amber-200/60", bar: "from-amber-500 to-orange-500", text: "text-amber-900", sub: "text-amber-700" }
    : { bg: "from-blue-50 to-indigo-50", border: "border-blue-200/60", bar: "from-blue-500 to-indigo-500", text: "text-blue-900", sub: "text-blue-700" };

  if (compact) {
    return (
      <div className={`bg-gradient-to-r ${colors.bg} border ${colors.border} rounded-xl px-4 py-3`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bot size={14} className={colors.sub} />
            <span className={`text-xs font-bold ${colors.text}`}>{t("aiQuota.title")}</span>
          </div>
          <span className={`text-xs font-semibold ${colors.sub}`}>{quota.used}/{quota.limit}</span>
        </div>
        <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full bg-gradient-to-r ${colors.bar} transition-all duration-500`} style={{ width: `${Math.min(quota.percentUsed, 100)}%` }} />
        </div>
        {isExceeded && onUpgradeNeeded && (
          <button onClick={onUpgradeNeeded} className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1">
            {t("aiQuota.viewPlans")} <ArrowRight size={10} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-gray-100 bg-white shadow-sm ${showProminent ? "ring-1 ring-amber-100" : ""}`}>
      <div className="flex items-center justify-between gap-4 p-[20px_24px]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(245,158,11,0.08)] text-[22px]">
            🤖
          </div>
          <div>
            <h3 className="font-[var(--font-heading)] text-[15px] font-bold text-[#1A1D23]">{t("aiQuota.title")}</h3>
            <p className="font-[var(--font-body)] text-[12px] text-[#94A3B8]">
              {isExceeded ? t("aiQuota.exceeded") : t("aiQuota.resetsIn").replace("{days}", String(quota.daysUntilReset))}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-[var(--font-heading)] text-[28px] font-extrabold text-[#F59E0B]">{quota.percentUsed}%</p>
          <p className="font-[var(--font-body)] text-[11px] text-[#94A3B8]">
            {quota.remaining} {t("aiQuota.remaining").toLowerCase()}
          </p>
        </div>
      </div>

      <div className="px-6 pb-4">
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-[rgba(245,158,11,0.1)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] transition-all duration-700 ease-out"
            style={{ width: `${Math.min(quota.percentUsed, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="font-[var(--font-body)] text-[11px] text-[#94A3B8]">
            {t("aiQuota.messagesUsed").replace("{used}", String(quota.used)).replace("{limit}", String(quota.limit))}
          </span>
          <span className="rounded-md bg-[rgba(245,158,11,0.08)] px-[10px] py-[2px] font-[var(--font-heading)] text-[11px] font-bold text-[#B45309]">
            {String(quota.plan).toUpperCase()} · {quota.limit} {t("aiQuota.messagesMonth")}
          </span>
        </div>
      </div>

      {/* Upgrade suggestion */}
      {isNearLimit && !isExceeded && (
        <div className="mx-6 mt-1 border-t border-amber-200/40 pb-4 pt-3">
          <p className="flex items-center gap-1.5 font-[var(--font-body)] text-xs text-amber-700">
            <TrendingUp size={12} />
            {quota.plan === "free" ? t("aiQuota.upgradeStarter") : t("aiQuota.upgradePro")}
          </p>
        </div>
      )}

      {(isNearLimit || isExceeded) && (
        <div className="px-6 pb-4">
          <Link
            href="/portal/pricing"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[var(--font-heading)] text-xs font-bold text-white transition-all ${
              isExceeded ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            <Zap size={12} />
            {t("aiQuota.viewPlans")}
          </Link>
        </div>
      )}
    </div>
  );
}
