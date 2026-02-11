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
    <div
      className="relative min-h-[76px] overflow-hidden rounded-2xl px-5 py-4 shadow-[0_4px_24px_rgba(245,158,11,0.3)]"
      style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)" }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))" }}
        >
          <ShieldAlert size={20} className="text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-[var(--font-heading)] text-[14px] font-bold text-white">{t("mfaPolicy.portalRecommended")}</p>
          <p className="mt-0.5 font-[var(--font-body)] text-[12.5px] font-medium text-white/75">{t("mfaPolicy.portalRecommendedDesc")}</p>
        </div>

        <Link
          href={securityUrl}
          className="ml-auto inline-flex min-w-[220px] flex-shrink-0 items-center justify-center gap-2 rounded-[10px] bg-white/95 px-5 py-2.5 text-[13px] font-bold text-[#92400E] transition-colors hover:bg-white"
        >
          {t("mfaPolicy.goToSecurity")} <ArrowRight size={14} />
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
