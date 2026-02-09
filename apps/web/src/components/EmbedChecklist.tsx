"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, CheckCircle2, ExternalLink, Code, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

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
  const [showCode, setShowCode] = useState(false);

  const handleCopy = () => {
    onCopySnippet();
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const steps = [
    { done: snippetCopied || justCopied, title: t("embed.step1Title"), desc: t("embed.step1Desc") },
    { done: domainsConfigured, title: t("embed.step2Title"), desc: t("embed.step2Desc") },
    { done: widgetConnected, title: t("embed.step3Title"), desc: t("embed.step3Desc") },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = (completedCount / steps.length) * 100;

  return (
    <div className={`rounded-2xl bg-white border border-slate-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <Code size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t("embed.checklistTitle")}</h3>
            <p className="text-sm text-slate-400">{t("embed.checklistSubtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-sm font-bold text-slate-600 tabular-nums">{completedCount}/{steps.length}</span>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-slate-100">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-4 px-6 py-5">
            {/* Step indicator */}
            <div className="flex-shrink-0 mt-0.5">
              {step.done ? (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-slate-500">{i + 1}</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className={`text-sm font-semibold ${step.done ? "text-emerald-700" : "text-slate-800"}`}>
                    {step.title}
                    {step.done && (
                      <span className="ml-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {t("embed.completed")}
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
                {/* Step 1 action */}
                {i === 0 && !step.done && (
                  <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors flex-shrink-0">
                    {justCopied ? <Check size={14} /> : <Copy size={14} />}
                    {t("embed.copySnippet")}
                  </button>
                )}
                {/* Step 2 action */}
                {i === 1 && !step.done && (
                  <Link href="/portal/security" className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors flex-shrink-0">
                    {t("embed.configureDomains")} <ExternalLink size={13} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Embed Code Toggle */}
      <div className="border-t border-slate-100">
        <button onClick={() => setShowCode(!showCode)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
          <div className="flex items-center gap-2">
            <Code size={15} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">{t("embed.snippetTitle")}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors">
              {justCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {justCopied ? "Copied!" : t("embed.copySnippet")}
            </button>
            {showCode ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </div>
        </button>
        {showCode && (
          <div className="px-6 pb-5">
            <pre className="bg-slate-900 text-slate-200 px-5 py-4 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono">
              <code>{`<!-- Helvion Chat Widget -->\n<script>window.HELVINO_SITE_ID="${siteId}";</script>\n<script src="https://cdn.helvion.io/embed.js"></script>`}</code>
            </pre>
            <p className="text-xs text-slate-400 mt-2">{t("embed.snippetHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
