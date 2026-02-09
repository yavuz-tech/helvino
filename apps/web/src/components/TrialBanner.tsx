"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { Clock, AlertTriangle, XCircle, ArrowRight, Sparkles } from "lucide-react";

interface TrialBannerProps {
  daysLeft: number;
  isExpired: boolean;
  isTrialing: boolean;
  endsAt: string | null;
  className?: string;
}

export default function TrialBanner({
  daysLeft,
  isExpired,
  isTrialing,
  endsAt,
  className = "",
}: TrialBannerProps) {
  const { t } = useI18n();

  if (!isTrialing && !isExpired) return null;

  /* ── Expired ── */
  if (isExpired) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/70 p-5 ${className}`}>
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-red-200/20 rounded-full" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-500/20">
            <XCircle size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-red-900">{t("trial.expiredTitle")}</p>
            <p className="text-sm text-red-700/80 mt-0.5">{t("trial.expiredDesc")}</p>
          </div>
          <Link href="/portal/billing"
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-sm flex-shrink-0">
            {t("trial.upgradeNow")} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  /* ── Warning: <= 3 days ── */
  if (daysLeft <= 3) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/70 p-5 ${className}`}>
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-200/20 rounded-full" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-400/20">
            <AlertTriangle size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-amber-900">{t("trial.expiringTitle")}</p>
            <p className="text-sm text-amber-700/80 mt-0.5">
              {t("trial.expiringDesc").replace("{days}", String(daysLeft))}
            </p>
          </div>
          <Link href="/portal/billing"
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors shadow-sm flex-shrink-0">
            {t("trial.viewPlans")} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  /* ── Active Trial ── */
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 p-5 ${className}`}>
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-200/20 rounded-full" />
      <div className="relative flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
          <Sparkles size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-blue-900">
            {t("trial.activeDesc").replace("{days}", String(daysLeft))}
          </p>
          {endsAt && (
            <p className="text-sm text-blue-600/80 mt-0.5" suppressHydrationWarning>
              {t("trial.endsOn")} {new Date(endsAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <Link href="/portal/billing"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0">
          {t("trial.viewPlans")} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
