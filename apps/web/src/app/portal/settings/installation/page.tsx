"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Code2, Copy, Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import ErrorBanner from "@/components/ErrorBanner";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApiFetch("/portal/widget/config")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error("LOAD_FAILED");
        return data;
      })
      .then((data) => {
        setError(null);
        setConfig(data);
      })
      .catch(() => {
        setError(t("common.networkError"));
        setConfig(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const copySnippet = async () => {
    if (!config?.embedSnippet?.html) return;
    await navigator.clipboard.writeText(config.embedSnippet.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader
        title={t("settingsPortal.installation")}
        subtitle={t("settingsPortal.installationSubtitle")}
        action={
          <Link
            href="/portal/widget"
            className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
          >
            {t("settingsPortal.openInstallationCenter")}
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

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
          label={t("domainAllowlist.title")}
          value={String(config?.allowedDomains?.length ?? 0)}
          icon={Globe}
          color="indigo"
        />
      </div>

      {/* ── Embed Snippet ── */}
      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`${p.iconSm} ${p.iconIndigo}`}>
              <Code2 size={14} />
            </div>
            <h3 className={p.h3}>{t("embed.snippetTitle")}</h3>
          </div>
          <button
            type="button"
            onClick={copySnippet}
            className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-semibold text-white transition-all hover:scale-[1.02]"
            style={{ background: "#F59E0B" }}
          >
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border p-4 text-[12px] leading-relaxed font-mono" style={{ borderColor: "#1A1D23", background: "#1A1D23", color: "#FCD34D" }}>
          {config?.embedSnippet?.html ?? ""}
        </pre>
      </Card>

      {/* ── Allowed Domains ── */}
      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconEmerald}`}>
            <Globe size={14} />
          </div>
          <h3 className={p.h3}>{t("domainAllowlist.title")}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {(config?.allowedDomains ?? []).map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#64748B]"
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
