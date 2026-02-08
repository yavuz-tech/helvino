"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";

export interface LockedControlProps {
  /** When true, show paywall hint and consider the control locked */
  locked: boolean;
  /** i18n key for the short reason (e.g. "Free plan limit") */
  reasonKey: TranslationKey;
  /** i18n key for the CTA link label (e.g. "Upgrade to unlock") */
  ctaLabelKey: TranslationKey;
  /** href for the upgrade CTA (e.g. "/portal/billing") */
  ctaHref: string;
  /** Optional variant for styling: indigo | violet | rose */
  variant?: "indigo" | "violet" | "rose";
  /** Optional icon: "lock" | "sparkle" | "warning" */
  icon?: "lock" | "sparkle" | "warning";
  /** Child control (e.g. toggle/button); when locked it should be disabled by parent */
  children?: React.ReactNode;
  /** Optional className for the hint card */
  className?: string;
}

const variantStyles = {
  indigo: {
    card: "from-slate-50 to-indigo-50/60 border-indigo-200/60",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    link: "text-indigo-600 hover:text-indigo-700",
  },
  violet: {
    card: "from-slate-50 to-violet-50/60 border-violet-200/60",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    link: "text-violet-600 hover:text-violet-700",
  },
  rose: {
    card: "from-slate-50 to-rose-50/60 border-rose-200/60",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    link: "text-rose-600 hover:text-rose-700",
  },
};

const icons = {
  lock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  sparkle: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
};

/**
 * Standard paywall / locked UI: reason text + upgrade CTA.
 * Use around controls that are disabled on free or lower plans.
 */
export default function LockedControl({
  locked,
  reasonKey,
  ctaLabelKey,
  ctaHref,
  variant = "indigo",
  icon = "lock",
  children,
  className = "",
}: LockedControlProps) {
  const { t } = useI18n();
  const styles = variantStyles[variant];

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <div className={className}>
      {children}
      <div className={`mt-3 flex items-center gap-3 bg-gradient-to-r ${styles.card} border rounded-xl px-4 py-3`}>
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${styles.iconBg} flex-shrink-0 ${styles.iconColor}`}>
          {icons[icon]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700">{t(reasonKey)}</p>
          <Link href={ctaHref} className={`inline-flex items-center gap-1 mt-1 text-xs font-semibold ${styles.link} transition-colors`}>
            {t(ctaLabelKey)}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
