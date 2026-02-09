"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, Zap, TrendingUp, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
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

  // Color variants based on usage level
  const colors = isExceeded
    ? { bg: "from-red-50 to-rose-50", border: "border-red-200/60", bar: "from-red-500 to-rose-500", icon: "from-red-500 to-rose-600", text: "text-red-900", sub: "text-red-700" }
    : isNearLimit
    ? { bg: "from-amber-50 to-yellow-50", border: "border-amber-200/60", bar: "from-amber-500 to-orange-500", icon: "from-amber-500 to-orange-500", text: "text-amber-900", sub: "text-amber-700" }
    : { bg: "from-blue-50 to-indigo-50", border: "border-blue-200/60", bar: "from-blue-500 to-indigo-500", icon: "from-blue-500 to-indigo-600", text: "text-blue-900", sub: "text-blue-700" };

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
    <div className={`bg-gradient-to-r ${colors.bg} border ${colors.border} rounded-2xl p-5 transition-all duration-300 ${showProminent ? "ring-1 ring-offset-1" : ""} ${isExceeded ? "ring-red-300" : isNearLimit ? "ring-amber-300" : "ring-transparent"}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors.icon} flex items-center justify-center shadow-sm`}>
            {isExceeded ? <AlertTriangle size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
          </div>
          <div>
            <h3 className={`text-sm font-bold ${colors.text}`}>{t("aiQuota.title")}</h3>
            <p className={`text-xs ${colors.sub}`}>
              {isExceeded ? t("aiQuota.exceeded") : t("aiQuota.resetsIn").replace("{days}", String(quota.daysUntilReset))}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-extrabold ${colors.text}`}>{quota.percentUsed}%</p>
          <p className={`text-[10px] uppercase font-bold tracking-wider ${colors.sub}`}>{t("aiQuota.used")}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full bg-gradient-to-r ${colors.bar} transition-all duration-700 ease-out`} style={{ width: `${Math.min(quota.percentUsed, 100)}%` }} />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs mb-3">
        <span className={colors.sub}>
          {t("aiQuota.messagesUsed").replace("{used}", String(quota.used)).replace("{limit}", String(quota.limit))}
        </span>
        <span className={`font-semibold ${colors.text}`}>{quota.remaining} {t("aiQuota.remaining").toLowerCase()}</span>
      </div>

      {/* Plan badge + CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-white/70 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-white/50">
            {quota.plan}
          </span>
          <span className={`text-[10px] ${colors.sub}`}>{quota.limit} {t("aiQuota.messagesMonth")}</span>
        </div>
        {(isNearLimit || isExceeded) && (
          <Link
            href="/portal/billing"
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
              isExceeded
                ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
                : "bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
            }`}
          >
            <Zap size={12} />
            {t("aiQuota.viewPlans")}
          </Link>
        )}
      </div>

      {/* Upgrade suggestion */}
      {isNearLimit && !isExceeded && (
        <div className="mt-3 pt-3 border-t border-amber-200/40">
          <p className="text-xs text-amber-700 flex items-center gap-1.5">
            <TrendingUp size={12} />
            {quota.plan === "free" ? t("aiQuota.upgradeStarter") : t("aiQuota.upgradePro")}
          </p>
        </div>
      )}
    </div>
  );
}
