"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";

type Prefs = {
  securityEnabled: boolean;
  billingEnabled: boolean;
  widgetEnabled: boolean;
};

export default function PortalSettingsNotificationsPage() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    portalApiFetch("/portal/notifications/preferences")
      .then((r) => r.json())
      .then((data) => setPrefs(data))
      .catch(() => setStatus(t("common.networkError")));
  }, [t]);

  const update = async (next: Prefs) => {
    setPrefs(next);
    setSaving(true);
    setStatus("");
    const res = await portalApiFetch("/portal/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(next),
    });
    setSaving(false);
    setStatus(res.ok ? t("portal.settingsSaved") : t("portal.failedSaveSettings"));
  };

  if (!prefs) {
    return <div className="text-slate-600">{t("common.loading")}</div>;
  }

  const rows: Array<{ key: keyof Prefs; label: string }> = [
    { key: "securityEnabled", label: t("settingsPortal.notifySecurity") },
    { key: "billingEnabled", label: t("settingsPortal.notifyBilling") },
    { key: "widgetEnabled", label: t("settingsPortal.notifyWidget") },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.notifications")}</h1>
      <p className="text-sm text-slate-600">{t("settingsPortal.notificationsSubtitle")}</p>

      {rows.map((row) => (
        <label key={row.key} className="flex items-center justify-between border rounded-lg p-4">
          <span className="font-medium text-slate-800">{row.label}</span>
          <input
            type="checkbox"
            checked={prefs[row.key]}
            disabled={saving}
            onChange={(e) => update({ ...prefs, [row.key]: e.target.checked })}
          />
        </label>
      ))}

      {status && <p className="text-sm text-slate-600">{status}</p>}
    </div>
  );
}
