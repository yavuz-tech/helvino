"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { ShieldAlert, X } from "lucide-react";
import Link from "next/link";

interface MfaPolicyBannerProps {
  /** If true, blocks access entirely (admin). If false, just shows a dismissible banner (portal). */
  blocking: boolean;
  securityUrl: string;
}

export default function MfaPolicyBanner({ blocking, securityUrl }: MfaPolicyBannerProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && !blocking) return null;

  if (blocking) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-slate-200 p-8 max-w-md w-full shadow-xl text-center">
          <ShieldAlert size={48} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {t("mfaPolicy.adminRequired")}
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            {t("mfaPolicy.adminRequiredDesc")}
          </p>
          <Link
            href={securityUrl}
            className="inline-block px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
          >
            {t("mfaPolicy.enableNow")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-4">
      <ShieldAlert size={20} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">
          {t("mfaPolicy.portalRecommended")}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {t("mfaPolicy.portalRecommendedDesc")}
        </p>
        <Link
          href={securityUrl}
          className="text-xs text-amber-900 font-medium underline hover:no-underline mt-1 inline-block"
        >
          {t("mfaPolicy.goToSecurity")}
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 text-amber-600 hover:text-amber-800"
      >
        <X size={16} />
      </button>
    </div>
  );
}
