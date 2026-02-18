"use client";

import { useEffect, useState } from "react";
import { Languages, Plus, Trash2 } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { InputField, TextareaField, SelectField } from "@/components/ui/Field";
import { p } from "@/styles/theme";

type OverrideItem = { id: string; locale: string; translationKey: string; value: string };

export default function PortalSettingsTranslationsPage() {
  const { t } = useI18n();
  const [locale, setLocale] = useState("tr");
  const [keyInput, setKeyInput] = useState("");
  const [valueInput, setValueInput] = useState("");
  const [items, setItems] = useState<OverrideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async (selectedLocale: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await portalApiFetch(`/portal/settings/translations?locale=${selectedLocale}`);
      if (!res.ok) {
        setItems([]);
        setLoadError(t("common.networkError"));
        return;
      }
      const data = await res.json().catch(() => null);
      setItems(data?.items || []);
    } catch {
      setItems([]);
      setLoadError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(locale); }, [locale]);

  const save = async () => {
    if (!keyInput.trim() || !valueInput.trim()) return;
    try {
      const res = await portalApiFetch("/portal/settings/translations", {
        method: "PUT",
        body: JSON.stringify({ locale, key: keyInput.trim(), value: valueInput }),
      });
      if (res.ok) {
        setKeyInput(""); setValueInput(""); load(locale);
        premiumToast.success({ title: t("toast.created"), description: t("toast.createdDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
  };

  const remove = async (translationKey: string) => {
    try {
      const res = await portalApiFetch("/portal/settings/translations", {
        method: "DELETE",
        body: JSON.stringify({ locale, key: translationKey }),
      });
      if (res.ok) {
        load(locale);
        premiumToast.success({ title: t("toast.deleted"), description: t("toast.deletedDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
  };

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader title={t("settingsPortal.translations")} subtitle={t("settingsPortal.translationsSubtitle")} badge={locale.toUpperCase()} />

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("settingsPortal.translations")} value={String(items.length)} icon={Languages} color="emerald" />
        <StatCard label={t("app.language")} value={locale.toUpperCase()} icon={Languages} color="blue" />
        <StatCard label={t("common.status")} value={items.length > 0 ? t("common.enabled") : t("common.disabled")} icon={Languages} color={items.length > 0 ? "emerald" : "slate"} />
      </div>

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-10">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
        </div>
      )}

      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconEmerald}`}><Plus size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.saveOverride")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t("app.language")} value={locale} onChange={setLocale} options={[
            { value: "tr", label: "TR" },
            { value: "en", label: "EN" },
            { value: "es", label: "ES" },
          ]} />
          <InputField label={t("settingsPortal.translationKey")} value={keyInput} onChange={setKeyInput} placeholder={t("settingsPortal.translationKey")} />
        </div>
        <div className="mt-4">
          <TextareaField label={t("settingsPortal.translationValue")} value={valueInput} onChange={setValueInput} placeholder={t("settingsPortal.translationValue")} />
        </div>
        <button
          onClick={save}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
        >
          <Plus size={13} />
          {t("settingsPortal.saveOverride")}
        </button>
      </Card>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="border-[#F3E8D8] hover:border-[#E8D5BC]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] font-semibold text-slate-700">{item.translationKey}</p>
                  <p className={`${p.body} mt-0.5 whitespace-pre-wrap`}>{item.value}</p>
                </div>
                <button onClick={() => remove(item.translationKey)} className={p.btnDanger}><Trash2 size={12} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
