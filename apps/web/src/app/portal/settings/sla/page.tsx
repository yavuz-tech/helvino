"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Save, ShieldCheck, Target } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Toggle from "@/components/ui/Toggle";
import { InputField } from "@/components/ui/Field";
import { p } from "@/styles/theme";

type SlaPolicy = {
  id: string;
  name: string;
  enabled: boolean;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  warnThresholdPercent: number;
};

export default function PortalSettingsSlaPage() {
  const { t } = useI18n();
  const [policy, setPolicy] = useState<SlaPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    portalApiFetch("/portal/settings/sla")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.policy) throw new Error("LOAD_FAILED");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setPolicy(data.policy);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t("common.networkError"));
        setPolicy(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      const res = await portalApiFetch("/portal/settings/sla", { method: "PUT", body: JSON.stringify(policy) });
      if (res.ok) {
        premiumToast.success({ title: t("toast.settingsSaved"), description: t("toast.settingsSavedDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
    setSaving(false);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  if (!policy) {
    return (
      <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
        <PageHeader title={t("settingsPortal.sla")} subtitle={t("settingsPortal.slaSubtitle")} />
        <ErrorBanner message={error || t("common.error")} onDismiss={() => setError(null)} />
      </div>
    );
  }

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader
        title={t("settingsPortal.sla")}
        subtitle={t("settingsPortal.slaSubtitle")}
        action={
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
          >
            <Save size={13} />
            {saving ? t("common.saving") : t("portal.saveSettings")}
          </button>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("common.status")} value={policy.enabled ? t("common.enabled") : t("common.disabled")} icon={ShieldCheck} color={policy.enabled ? "emerald" : "slate"} />
        <StatCard label={t("settingsPortal.firstResponseMinutes")} value={`${policy.firstResponseMinutes} ${t("common.min")}`} icon={Clock} color="blue" />
        <StatCard label={t("settingsPortal.resolutionMinutes")} value={`${policy.resolutionMinutes} ${t("common.min")}`} icon={Target} color="indigo" />
      </div>

      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconAmber}`}><ShieldCheck size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.sla")}</h2>
        </div>
        <div className="space-y-4">
          <Toggle label={t("settingsPortal.enableSla")} checked={policy.enabled} onChange={(v) => setPolicy({ ...policy, enabled: v })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <InputField label={t("settingsPortal.firstResponseMinutes")} type="number" value={policy.firstResponseMinutes} onChange={(v) => setPolicy({ ...policy, firstResponseMinutes: Number(v) })} suffix={t("common.min")} />
            <InputField label={t("settingsPortal.resolutionMinutes")} type="number" value={policy.resolutionMinutes} onChange={(v) => setPolicy({ ...policy, resolutionMinutes: Number(v) })} suffix={t("common.min")} />
            <InputField label={t("settingsPortal.warnThresholdPercent")} type="number" value={policy.warnThresholdPercent} onChange={(v) => setPolicy({ ...policy, warnThresholdPercent: Number(v) })} suffix="%" />
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-amber-600" />
            <p className="text-[11px] leading-snug text-amber-800">{t("settingsPortal.warnThresholdPercent")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
