"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { Languages, Plus, Trash2, Check, AlertCircle, Globe } from "lucide-react";

type OverrideItem = {
  id: string;
  locale: string;
  translationKey: string;
  value: string;
};

export default function PortalSettingsTranslationsPage() {
  const { t } = useI18n();
  const [locale, setLocale] = useState("tr");
  const [keyInput, setKeyInput] = useState("");
  const [valueInput, setValueInput] = useState("");
  const [items, setItems] = useState<OverrideItem[]>([]);
  const [status, setStatus] = useState("");

  const load = async (selectedLocale: string) => {
    const res = await portalApiFetch(`/portal/settings/translations?locale=${selectedLocale}`);
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items || []);
  };

  useEffect(() => {
    load(locale);
  }, [locale]);

  const save = async () => {
    if (!keyInput.trim() || !valueInput.trim()) return;
    const res = await portalApiFetch("/portal/settings/translations", {
      method: "PUT",
      body: JSON.stringify({ locale, key: keyInput.trim(), value: valueInput }),
    });
    if (res.ok) {
      setKeyInput("");
      setValueInput("");
      setStatus(t("portal.settingsSaved"));
      load(locale);
    } else {
      setStatus(t("portal.failedSaveSettings"));
    }
  };

  const remove = async (translationKey: string) => {
    const res = await portalApiFetch("/portal/settings/translations", {
      method: "DELETE",
      body: JSON.stringify({ locale, key: translationKey }),
    });
    if (res.ok) {
      setStatus(t("portal.settingsSaved"));
      load(locale);
    } else {
      setStatus(t("portal.failedSaveSettings"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/40 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <Languages size={18} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.translations")}</h1>
        </div>
        <p className="text-sm text-slate-600 mt-1">{t("settingsPortal.translationsSubtitle")}</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.translations")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{items.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("common.language")}</p>
            <p className="text-lg font-bold text-blue-600 mt-1">{locale.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {status && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          status.includes(t("portal.settingsSaved"))
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-red-50 border-red-200 text-red-900"
        }`}>
          {status.includes(t("portal.settingsSaved")) ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{status}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t("settingsPortal.saveOverride")}</h3>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
            <Globe size={13} className="text-slate-500" />
            {t("common.language")}
          </label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          >
            <option value="tr">🇹🇷 Türkçe (TR)</option>
            <option value="en">🇬🇧 English (EN)</option>
            <option value="es">🇪🇸 Español (ES)</option>
          </select>
        </div>
        <input
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={t("settingsPortal.translationKey")}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
        <textarea
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          placeholder={t("settingsPortal.translationValue")}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
        />
        <button
          onClick={save}
          className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          {t("settingsPortal.saveOverride")}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">{t("settingsPortal.translations")}</h3>
        {items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <Languages size={24} className="text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">{t("settingsPortal.translations")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="border-2 border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50/20 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Languages size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-semibold text-slate-900">{item.translationKey}</p>
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.value}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.translationKey)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={12} />
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
