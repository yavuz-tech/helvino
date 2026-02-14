"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { AlertTriangle, XCircle, ArrowRight, Sparkles, X } from "lucide-react";

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
  const [dismissed, setDismissed] = useState(false);
  const progressPercent = useMemo(() => {
    if (isExpired) return 0;
    const assumedTrialDays = 14;
    const pct = Math.round((daysLeft / assumedTrialDays) * 100);
    return Math.max(0, Math.min(100, pct));
  }, [daysLeft, isExpired]);

  if (dismissed || (!isTrialing && !isExpired)) return null;

  const title = isExpired
    ? t("trial.expiredTitle")
    : daysLeft <= 3
      ? t("trial.expiringTitle")
      : t("trial.activeDesc").replace("{days}", String(daysLeft));

  const description = isExpired
    ? t("trial.expiredDesc")
    : daysLeft <= 3
      ? t("trial.expiringDesc").replace("{days}", String(daysLeft))
      : endsAt
        ? `${t("trial.endsOn")} ${new Date(endsAt).toLocaleDateString()}`
        : t("trial.viewPlans");

  const ctaLabel = isExpired ? t("trial.upgradeNow") : t("trial.viewPlans");
  const LeadingIcon = isExpired ? XCircle : daysLeft <= 3 ? AlertTriangle : Sparkles;

  return (
    <div
      className={`relative min-h-[76px] overflow-hidden rounded-2xl px-5 py-4 shadow-[0_2px_8px_rgba(124,58,237,0.12)] ${className}`}
      style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)" }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))" }}
        >
          <LeadingIcon size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-[var(--font-heading)] text-[14px] font-bold text-white">{title}</p>
          <div className="mt-0.5 flex items-center gap-3">
            <p className="min-w-0 truncate font-[var(--font-body)] text-[12.5px] font-medium text-white/75" suppressHydrationWarning>
              {description}
            </p>
            <div className="h-1 w-[120px] flex-shrink-0 overflow-hidden rounded" style={{ background: "rgba(255,255,255,0.2)" }}>
              <div
                className="h-full rounded"
                style={{ width: `${progressPercent}%`, background: "rgba(255,255,255,0.8)" }}
              />
            </div>
          </div>
        </div>
        <Link
          href="/portal/pricing"
          className="ml-auto inline-flex min-w-[220px] flex-shrink-0 items-center justify-center gap-2 rounded-[10px] bg-white px-5 py-2.5 text-[13px] font-bold text-violet-700 transition-colors hover:bg-violet-50"
        >
          {ctaLabel} <ArrowRight size={14} />
        </Link>

        <button
          onClick={() => setDismissed(true)}
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/15 text-white/80 transition-colors hover:bg-white/25 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
