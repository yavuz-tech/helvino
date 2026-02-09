"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import { ArrowUpRight, CheckCircle2, Copy, Globe } from "lucide-react";

type WidgetConfig = {
  widgetEnabled: boolean;
  allowedDomains: string[];
  embedSnippet: {
    html: string;
    scriptSrc: string;
    siteId: string;
  };
  health: {
    status: string;
    failuresTotal: number;
    domainMismatchTotal: number;
  };
};

export default function PortalSettingsInstallationPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<WidgetConfig | null>(null);

  useEffect(() => {
    portalApiFetch("/portal/widget/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setConfig(data))
      .catch(() => {});
  }, []);

  const copySnippet = async () => {
    if (!config?.embedSnippet?.html) return;
    await navigator.clipboard.writeText(config.embedSnippet.html);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50/40 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Globe size={18} className="text-sky-600" />
              <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.installation")}</h1>
            </div>
            <p className="text-sm text-slate-600">{t("settingsPortal.installationSubtitle")}</p>
          </div>
          <Link
            href="/portal/widget"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-md font-semibold"
          >
            {t("settingsPortal.openInstallationCenter")}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t("common.status")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {config?.widgetEnabled ? t("common.enabled") : t("common.disabled")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} className="text-amber-500" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t("widgetConfig.domainMismatch")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {config?.health?.domainMismatchTotal ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} className="text-sky-500" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t("settingsPortal.channels")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{config?.allowedDomains?.length ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t("widgetAppearance.preview")}</h3>
          <button
            type="button"
            onClick={copySnippet}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-sky-200 bg-sky-50 text-sm font-semibold text-sky-700 hover:bg-sky-100 hover:border-sky-300 transition-all"
          >
            <Copy size={14} />
            {t("common.copy")}
          </button>
        </div>
        <pre className="text-xs bg-slate-900 text-emerald-400 border border-slate-700 rounded-xl p-4 overflow-x-auto font-mono">
          {config?.embedSnippet?.html ?? ""}
        </pre>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">{t("settingsPortal.installation")}</h3>
        <div className="flex flex-wrap gap-2">
          {(config?.allowedDomains ?? []).slice(0, 5).map((domain) => (
            <div key={domain} className="inline-flex items-center gap-2 rounded-xl border-2 border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700">
              <Globe size={14} />
              {domain}
            </div>
          ))}
          {(config?.allowedDomains?.length ?? 0) > 5 && (
            <div className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
              +{(config?.allowedDomains?.length ?? 0) - 5} more
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
