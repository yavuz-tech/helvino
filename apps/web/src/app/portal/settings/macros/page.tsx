"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { InputField, TextareaField } from "@/components/ui/Field";
import { p } from "@/styles/theme";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

type MacroItem = { id: string; title: string; content: string; enabled: boolean };

export default function PortalSettingsMacrosPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<MacroItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { can } = useFeatureAccess();
  const starterPlus = can("macros");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await portalApiFetch("/portal/settings/macros");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error("LOAD_FAILED");
      setItems(data?.items || []);
    } catch {
      setItems([]);
      setLoadError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim() || !content.trim()) return;
    if (!starterPlus) {
      premiumToast.info({ title: t("settings.starterRequired"), description: t("billing.viewPlans") });
      return;
    }
    try {
      const res = await portalApiFetch("/portal/settings/macros", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), content: content.trim(), enabled: true }),
      });
      if (res.ok) {
        setTitle(""); setContent(""); load();
        premiumToast.success({ title: t("toast.created"), description: t("toast.createdDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
  };

  const remove = async (id: string) => {
    if (!starterPlus) {
      premiumToast.info({ title: t("settings.starterRequired"), description: t("billing.viewPlans") });
      return;
    }
    try {
      const res = await portalApiFetch(`/portal/settings/macros/${id}`, { method: "DELETE" });
      if (res.ok) {
        load();
        premiumToast.success({ title: t("toast.deleted"), description: t("toast.deletedDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
  };

  const enabledCount = items.filter((m) => m.enabled).length;

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader title={t("settingsPortal.macros")} subtitle={t("settingsPortal.macrosSubtitle")} />

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}
      {!starterPlus && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-semibold text-amber-800"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <span>🔒 {t("settings.starterRequired")}</span>
          <a
            href="/portal/pricing"
            className="rounded-lg bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-200"
          >
            {t("billing.viewPlans")}
          </a>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("settingsPortal.macros")} value={String(items.length)} icon={FileText} color="indigo" />
        <StatCard label={t("common.enabled")} value={String(enabledCount)} icon={FileText} color="emerald" />
        <StatCard label={t("common.disabled")} value={String(items.length - enabledCount)} icon={FileText} color="slate" />
      </div>

      <div style={{ opacity: starterPlus ? 1 : 0.55 }}>
        <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className={`${p.iconSm} ${p.iconIndigo}`}><Plus size={13} /></div>
            <h2 className={p.h2}>{t("settingsPortal.addMacro")}</h2>
          </div>
          <div className="space-y-3">
            <InputField label={t("settingsPortal.macroTitle")} value={title} onChange={setTitle} placeholder={t("settingsPortal.macroTitle")} />
            <TextareaField label={t("settingsPortal.macroContent")} value={content} onChange={setContent} placeholder={t("settingsPortal.macroContent")} />
            <button
              onClick={create}
              disabled={!starterPlus}
              className="inline-flex items-center gap-1.5 rounded-[10px] border px-4 py-2 text-[12px] font-semibold transition-all disabled:opacity-60"
              style={{ borderColor: "#F59E0B", color: "#D97706", background: "#FFFBEB" }}
            >
              <Plus size={13} />
              ➕ {t("settingsPortal.addMacro")}
            </button>
          </div>
        </Card>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="border-[#F3E8D8] hover:border-[#E8D5BC]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className={`${p.iconSm} ${item.enabled ? p.iconIndigo : p.iconSlate} mt-0.5`}><FileText size={13} /></div>
                  <div className="min-w-0 flex-1">
                    <p className={p.h3}>{item.title}</p>
                    <p className={`${p.body} mt-0.5 whitespace-pre-wrap`}>{item.content}</p>
                    <span className={`mt-1.5 ${item.enabled ? p.badgeGreen : p.badgeSlate}`}>
                      {item.enabled ? t("common.enabled") : t("common.disabled")}
                    </span>
                  </div>
                </div>
                <button onClick={() => remove(item.id)} className={p.btnDanger}><Trash2 size={12} /></button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-[#F3E8D8] text-center">
          <p style={{ fontSize: 34, marginBottom: 8 }}>⌨️</p>
          <p className="text-sm font-semibold text-slate-800">{t("settings.macros.empty")}</p>
        </Card>
      )}
    </div>
  );
}
