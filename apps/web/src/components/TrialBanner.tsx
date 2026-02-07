"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";

/**
 * TrialBanner — shows trial countdown and upgrade nudge.
 *
 * States:
 *   - Active trial > 3 days: subtle info banner
 *   - Active trial <= 3 days: warning amber banner
 *   - Expired trial: blocking red banner with upgrade CTA
 */

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

  if (isExpired) {
    return (
      <div
        className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-red-900">
              {t("trial.expiredTitle")}
            </p>
            <p className="text-sm text-red-800 mt-1">
              {t("trial.expiredDesc")}
            </p>
          </div>
          <Link
            href="/portal/billing"
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap text-center"
          >
            {t("trial.upgradeNow")}
          </Link>
        </div>
      </div>
    );
  }

  // Warning: <= 3 days
  if (daysLeft <= 3) {
    return (
      <div
        className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-amber-900">
              {t("trial.expiringTitle")}
            </p>
            <p className="text-sm text-amber-800 mt-1">
              {t("trial.expiringDesc").replace("{days}", String(daysLeft))}
            </p>
          </div>
          <Link
            href="/portal/billing"
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap text-center"
          >
            {t("trial.viewPlans")}
          </Link>
        </div>
      </div>
    );
  }

  // Info: trial active
  return (
    <div
      className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-blue-800">
          {t("trial.activeDesc").replace("{days}", String(daysLeft))}
          {endsAt && (
            <span className="text-blue-600 ml-1" suppressHydrationWarning>
              ({t("trial.endsOn")} {new Date(endsAt).toLocaleDateString()})
            </span>
          )}
        </p>
        <Link
          href="/portal/billing"
          className="text-xs text-blue-700 hover:text-blue-900 font-medium whitespace-nowrap ml-3"
        >
          {t("trial.viewPlans")}
        </Link>
      </div>
    </div>
  );
}
