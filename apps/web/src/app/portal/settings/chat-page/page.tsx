"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";

type ChatPageConfig = {
  id: string;
  title: string;
  subtitle: string;
  placeholder: string;
  showAgentAvatars: boolean;
  showOperatingHours: boolean;
};

export default function PortalSettingsChatPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<ChatPageConfig | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    portalApiFetch("/portal/settings/chat-page")
      .then((r) => r.json())
      .then((data) => setConfig(data.config))
      .catch(() => setStatus(t("common.networkError")));
  }, [t]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const res = await portalApiFetch("/portal/settings/chat-page", {
      method: "PUT",
      body: JSON.stringify(config),
    });
    setSaving(false);
    setStatus(res.ok ? t("portal.settingsSaved") : t("portal.failedSaveSettings"));
  };

  if (!config) return <div className="text-slate-600">{t("common.loading")}</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.chatPage")}</h1>
      <p className="text-sm text-slate-600">{t("settingsPortal.chatPageSubtitle")}</p>

      <input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} placeholder={t("settingsPortal.chatTitle")} className="w-full border rounded-lg px-3 py-2" />
      <input value={config.subtitle} onChange={(e) => setConfig({ ...config, subtitle: e.target.value })} placeholder={t("settingsPortal.chatSubtitle")} className="w-full border rounded-lg px-3 py-2" />
      <input value={config.placeholder} onChange={(e) => setConfig({ ...config, placeholder: e.target.value })} placeholder={t("settingsPortal.chatPlaceholder")} className="w-full border rounded-lg px-3 py-2" />

      <label className="flex items-center justify-between border rounded-lg p-4">
        <span className="font-medium text-slate-800">{t("settingsPortal.showAgentAvatars")}</span>
        <input type="checkbox" checked={config.showAgentAvatars} onChange={(e) => setConfig({ ...config, showAgentAvatars: e.target.checked })} />
      </label>
      <label className="flex items-center justify-between border rounded-lg p-4">
        <span className="font-medium text-slate-800">{t("settingsPortal.showOperatingHours")}</span>
        <input type="checkbox" checked={config.showOperatingHours} onChange={(e) => setConfig({ ...config, showOperatingHours: e.target.checked })} />
      </label>

      <button onClick={save} disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60">
        {saving ? t("common.saving") : t("portal.saveSettings")}
      </button>
      {status && <p className="text-sm text-slate-600">{status}</p>}
    </div>
  );
}
