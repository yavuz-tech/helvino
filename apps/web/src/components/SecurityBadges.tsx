"use client";

import { useI18n } from "@/i18n/I18nContext";
import { ShieldCheck, ShieldAlert, Key, FileText } from "lucide-react";

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
    <div className={`space-y-2.5 ${className}`}>
      {mfaEnabled !== undefined && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          mfaEnabled ? "bg-emerald-50/60 border-emerald-200/60" : "bg-amber-50/60 border-amber-200/60"
        }`}>
          {mfaEnabled ? (
            <ShieldCheck size={18} className="text-emerald-500 flex-shrink-0" />
          ) : (
            <ShieldAlert size={18} className="text-amber-500 flex-shrink-0" />
          )}
          <span className={`text-sm font-semibold ${mfaEnabled ? "text-emerald-700" : "text-amber-700"}`}>
            {mfaEnabled ? t("trust.mfaEnabled") : t("trust.mfaDisabled")}
          </span>
        </div>
      )}

      {passkeysCount !== undefined && passkeysCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-[#EDEDFF]/60 border-[#4B45FF]/20">
          <Key size={18} className="text-[#4B45FF] flex-shrink-0" />
          <span className="text-sm font-semibold text-[#4B45FF]">{t("trust.passkeysActive")}</span>
        </div>
      )}

      {auditActive && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-[#EDEDFF]/60 border-[#4B45FF]/20">
          <FileText size={18} className="text-[#4B45FF] flex-shrink-0" />
          <span className="text-sm font-semibold text-[#4B45FF]">{t("trust.auditActive")}</span>
        </div>
      )}
    </div>
  );
}
