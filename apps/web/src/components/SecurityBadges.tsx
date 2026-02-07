"use client";

import { useI18n } from "@/i18n/I18nContext";

/**
 * SecurityBadges — subtle trust indicators for security features.
 *
 * Shows small badges for: MFA enabled, Passkeys enabled, Audit logs active.
 * All labels use i18n.
 */

interface SecurityBadgesProps {
  mfaEnabled?: boolean;
  passkeysCount?: number;
  auditActive?: boolean;
  className?: string;
}

export default function SecurityBadges({
  mfaEnabled,
  passkeysCount,
  auditActive,
  className = "",
}: SecurityBadgesProps) {
  const { t } = useI18n();

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {mfaEnabled && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {t("trust.mfaEnabled")}
        </span>
      )}
      {mfaEnabled === false && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {t("trust.mfaDisabled")}
        </span>
      )}
      {passkeysCount !== undefined && passkeysCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          {t("trust.passkeysActive")}
        </span>
      )}
      {auditActive && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-xs font-medium">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {t("trust.auditActive")}
        </span>
      )}
    </div>
  );
}
