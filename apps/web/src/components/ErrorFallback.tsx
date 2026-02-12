"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";

interface ErrorFallbackProps {
  error?: Error | null;
  resetFn?: () => void;
}

export default function ErrorFallback({ error, resetFn }: ErrorFallbackProps) {
  const { t } = useI18n();
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="bg-[#FFFBF5] py-10 px-4">
      <div className="bg-white rounded-xl border border-[#F3E8D8] shadow-sm p-8 text-center max-w-md mx-auto">
        <div className="text-4xl mb-3" aria-hidden="true">
          ⚠️
        </div>
        <h2 className="text-[#1A1D23] font-heading text-xl font-bold">{t("common.error")}</h2>
        <p className="text-[#64748B] text-sm mt-2">{t("common.retry")}</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => (resetFn ? resetFn() : window.location.reload())}
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg px-6 py-2.5 text-sm font-semibold"
          >
            {t("common.refresh")}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[#F3E8D8] px-4 py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#FFFBF5]"
          >
            {t("nav.overview")}
          </Link>
        </div>

        {isDev && error ? (
          <pre className="bg-[#F1F5F9] rounded-lg p-4 text-xs font-mono mt-4 text-left overflow-auto text-[#475569]">
            {error.stack || error.message}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
