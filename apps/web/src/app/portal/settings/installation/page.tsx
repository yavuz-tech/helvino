"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Code2, Copy, Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { p } from "@/styles/theme";

type WidgetConfig = {
  widgetEnabled: boolean;
  allowedDomains: string[];
  embedSnippet: { html: string; scriptSrc: string; siteId: string };
  health: { status: string; failuresTotal: number; domainMismatchTotal: number };
};

export default function PortalSettingsInstallationPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    portalApiFetch("/portal/widget/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setConfig(data))
      .catch(() => {});
  }, []);

  const copySnippet = async () => {
    if (!config?.embedSnippet?.html) return;
    await navigator.clipboard.writeText(config.embedSnippet.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={p.sectionGap}>
      <PageHeader
        title={t("settingsPortal.installation")}
        subtitle={t("settingsPortal.installationSubtitle")}
        action={
          <Link href="/portal/widget" className={p.btnPrimary}>
            {t("settingsPortal.openInstallationCenter")}
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("common.status")}
          value={config?.widgetEnabled ? t("common.enabled") : t("common.disabled")}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          label={t("widgetConfig.domainMismatch")}
          value={String(config?.health?.domainMismatchTotal ?? 0)}
          icon={Globe}
          color={config?.health?.domainMismatchTotal ? "rose" : "blue"}
        />
        <StatCard
          label={t("settingsPortal.channels")}
          value={String(config?.allowedDomains?.length ?? 0)}
          icon={Globe}
          color="indigo"
        />
      </div>

      {/* ── Embed Snippet ── */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`${p.iconSm} ${p.iconIndigo}`}>
              <Code2 size={14} />
            </div>
            <h3 className={p.h3}>{t("widgetAppearance.preview")}</h3>
          </div>
          <button type="button" onClick={copySnippet} className={p.btnSecondary}>
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-[12px] leading-relaxed text-emerald-400 font-mono">
          {config?.embedSnippet?.html ?? ""}
        </pre>
      </Card>

      {/* ── Allowed Domains ── */}
      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconEmerald}`}>
            <Globe size={14} />
          </div>
          <h3 className={p.h3}>{t("settingsPortal.installation")}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {(config?.allowedDomains ?? []).map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600"
            >
              <Globe size={12} />
              {domain}
            </span>
          ))}
          {(config?.allowedDomains ?? []).length === 0 && (
            <p className={p.caption}>{t("common.noResults")}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
