"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

/**
 * EmbedChecklist — step-by-step guide for widget embed setup.
 *
 * Shows 3 steps:
 *   1. Copy embed snippet
 *   2. Configure allowed domains
 *   3. Widget connected (first load detected)
 *
 * Progress is derived from org data (conversion signals).
 */

interface EmbedChecklistProps {
  siteId: string;
  snippetCopied: boolean;
  domainsConfigured: boolean;
  widgetConnected: boolean;
  onCopySnippet: () => void;
  className?: string;
}

export default function EmbedChecklist({
  siteId,
  snippetCopied,
  domainsConfigured,
  widgetConnected,
  onCopySnippet,
  className = "",
}: EmbedChecklistProps) {
  const { t } = useI18n();
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = () => {
    onCopySnippet();
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1500);
  };

  const steps = [
    {
      done: snippetCopied || justCopied,
      title: t("embed.step1Title"),
      desc: t("embed.step1Desc"),
      action: (
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors"
        >
          {justCopied ? <Check size={14} /> : <Copy size={14} />}
          {t("embed.copySnippet")}
        </button>
      ),
    },
    {
      done: domainsConfigured,
      title: t("embed.step2Title"),
      desc: t("embed.step2Desc"),
      action: (
        <Link
          href="/portal/security"
          className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
        >
          {t("embed.configureDomains")}
        </Link>
      ),
    },
    {
      done: widgetConnected,
      title: t("embed.step3Title"),
      desc: t("embed.step3Desc"),
      action: null,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {t("embed.checklistTitle")}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("embed.checklistSubtitle")}
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
          {completedCount}/{steps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-5">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            {/* Status indicator */}
            <div className="flex-shrink-0 mt-0.5">
              {step.done ? (
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-semibold text-slate-500">{i + 1}</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className={`text-sm font-medium ${step.done ? "text-green-700" : "text-slate-900"}`}>
                  {step.title}
                  {step.done && (
                    <span className="ml-2 text-xs text-green-600 font-normal">
                      {t("embed.completed")}
                    </span>
                  )}
                </h4>
                {!step.done && step.action}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Embed snippet preview */}
      <div className="mt-5 pt-5 border-t border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          {t("embed.snippetTitle")}
        </h4>
        <pre className="bg-slate-900 text-slate-100 px-4 py-3 rounded-lg text-xs overflow-x-auto leading-relaxed">
          <code>{`<!-- Helvion Chat Widget -->\n<script>window.HELVINO_SITE_ID="${siteId}";</script>\n<script src="https://cdn.helvion.io/embed.js"></script>`}</code>
        </pre>
        <p className="text-xs text-slate-400 mt-1.5">{t("embed.snippetHint")}</p>
      </div>
    </div>
  );
}
