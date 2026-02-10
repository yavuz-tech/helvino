"use client";

import { useEffect, useState } from "react";
import { Languages, Plus, Trash2 } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
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

  const load = async (selectedLocale: string) => {
    const res = await portalApiFetch(`/portal/settings/translations?locale=${selectedLocale}`);
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items || []);
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
    <div className={p.sectionGap}>
      <PageHeader title={t("settingsPortal.translations")} subtitle={t("settingsPortal.translationsSubtitle")} badge={locale.toUpperCase()} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("settingsPortal.translations")} value={String(items.length)} icon={Languages} color="emerald" />
        <StatCard label={t("app.language")} value={locale.toUpperCase()} icon={Languages} color="blue" />
        <StatCard label={t("common.status")} value={items.length > 0 ? t("common.enabled") : t("common.disabled")} icon={Languages} color={items.length > 0 ? "emerald" : "slate"} />
      </div>

      <Card>
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
        <button onClick={save} className={`${p.btnPrimary} mt-4`}><Plus size={13} />{t("settingsPortal.saveOverride")}</button>
      </Card>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
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
