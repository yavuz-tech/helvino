"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { ShieldAlert, X, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

interface MfaPolicyBannerProps {
  blocking: boolean;
  securityUrl: string;
}

export default function MfaPolicyBanner({ blocking, securityUrl }: MfaPolicyBannerProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && !blocking) return null;

  /* ── Blocking Modal ── */
  if (blocking) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-10 max-w-md w-full shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <Lock size={28} className="text-amber-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
            {t("mfaPolicy.adminRequired")}
          </h2>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
            {t("mfaPolicy.adminRequiredDesc")}
          </p>
          <Link href={securityUrl}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-colors font-semibold text-sm shadow-lg shadow-slate-900/20">
            {t("mfaPolicy.enableNow")} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  /* ── Recommendation Banner ── */
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/70 p-5">
      {/* Subtle decorative circle */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-200/20 rounded-full" />

      <div className="relative flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-400/20">
          <ShieldAlert size={22} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-amber-900">{t("mfaPolicy.portalRecommended")}</p>
          <p className="text-sm text-amber-700/80 mt-0.5">{t("mfaPolicy.portalRecommendedDesc")}</p>
        </div>

        <Link href={securityUrl}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors shadow-sm flex-shrink-0">
          {t("mfaPolicy.goToSecurity")} <ArrowRight size={14} />
        </Link>

        <button onClick={() => setDismissed(true)} className="p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors flex-shrink-0">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
