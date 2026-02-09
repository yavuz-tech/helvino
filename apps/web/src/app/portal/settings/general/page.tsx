"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { usePortalInboxNotification } from "@/contexts/PortalInboxNotificationContext";
import { useI18n } from "@/i18n/I18nContext";
import { Bell, Bot, MessageCircleMore, ShieldCheck, Sparkles } from "lucide-react";

interface Settings {
  widgetEnabled: boolean;
  writeEnabled: boolean;
  aiEnabled: boolean;
  messageRetentionDays: number;
  hardDeleteOnRetention: boolean;
  lastRetentionRunAt: string | null;
}

export default function PortalGeneralSettingsPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const {
    soundEnabled,
    setSoundEnabled,
    notificationPermission,
    requestNotificationPermission,
    testSound,
  } = usePortalInboxNotification();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [original, setOriginal] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canEdit = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      const res = await portalApiFetch("/portal/org/me");
      if (!res.ok) {
        setMessage(t("portal.failedLoadSettings"));
        setLoading(false);
        return;
      }
      const data = await res.json();
      const next: Settings = {
        widgetEnabled: data.org.widgetEnabled,
        writeEnabled: data.org.writeEnabled,
        aiEnabled: data.org.aiEnabled,
        messageRetentionDays: data.org.messageRetentionDays,
        hardDeleteOnRetention: data.org.hardDeleteOnRetention,
        lastRetentionRunAt: data.org.lastRetentionRunAt,
      };
      setSettings(next);
      setOriginal(next);
      setLoading(false);
    };
    load();
  }, [authLoading, t]);

  const handleSave = async () => {
    if (!settings || !canEdit) return;
    setSaving(true);
    setMessage(null);

    const res = await portalApiFetch("/portal/org/me/settings", {
      method: "PATCH",
      body: JSON.stringify({
        widgetEnabled: settings.widgetEnabled,
        writeEnabled: settings.writeEnabled,
        aiEnabled: settings.aiEnabled,
        messageRetentionDays: settings.messageRetentionDays,
        hardDeleteOnRetention: settings.hardDeleteOnRetention,
      }),
    });

    if (!res.ok) {
      setMessage(t("portal.failedSaveSettings"));
      setSaving(false);
      return;
    }

    const data = await res.json();
    const next: Settings = {
      widgetEnabled: data.settings.widgetEnabled,
      writeEnabled: data.settings.writeEnabled,
      aiEnabled: data.settings.aiEnabled,
      messageRetentionDays: data.settings.messageRetentionDays,
      hardDeleteOnRetention: data.settings.hardDeleteOnRetention,
      lastRetentionRunAt: data.settings.lastRetentionRunAt,
    };
    setSettings(next);
    setOriginal(next);
    setMessage(t("portal.settingsSaved"));
    setSaving(false);
  };

  const hasChanges = settings && original && JSON.stringify(settings) !== JSON.stringify(original);

  if (authLoading || loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-violet-50/40 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-violet-600" />
          <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.general")}</h1>
        </div>
        <p className="text-sm text-slate-600 mt-1">{t("portal.settingsSubtitle")}</p>
      </div>

      {message && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-slate-800">
          {message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center justify-between border rounded-xl p-4 hover:border-violet-200 transition-colors">
            <div>
              <div className="font-medium inline-flex items-center gap-2">
                <MessageCircleMore size={15} className="text-violet-600" />
                {t("portal.widgetEnabled")}
              </div>
              <div className="text-xs text-slate-500">{t("portal.widgetEnabledDesc")}</div>
            </div>
            <input type="checkbox" checked={settings.widgetEnabled} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, widgetEnabled: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between border rounded-xl p-4 hover:border-violet-200 transition-colors">
            <div>
              <div className="font-medium inline-flex items-center gap-2">
                <ShieldCheck size={15} className="text-violet-600" />
                {t("portal.writeEnabled")}
              </div>
              <div className="text-xs text-slate-500">{t("portal.writeEnabledDesc")}</div>
            </div>
            <input type="checkbox" checked={settings.writeEnabled} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, writeEnabled: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between border rounded-xl p-4 hover:border-violet-200 transition-colors">
            <div>
              <div className="font-medium inline-flex items-center gap-2">
                <Bot size={15} className="text-violet-600" />
                {t("portal.aiEnabled")}
              </div>
              <div className="text-xs text-slate-500">{t("portal.aiEnabledDesc")}</div>
            </div>
            <input type="checkbox" checked={settings.aiEnabled} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, aiEnabled: e.target.checked })} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t("portal.messageRetentionDays")}
            </label>
            <input
              type="number"
              min={1}
              value={settings.messageRetentionDays}
              disabled={!canEdit}
              onChange={(e) => setSettings({ ...settings, messageRetentionDays: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <label className="flex items-center justify-between border rounded-xl p-4">
            <div>
              <div className="font-medium">{t("portal.hardDelete")}</div>
              <div className="text-xs text-slate-500">{t("portal.hardDeleteDesc")}</div>
            </div>
            <input type="checkbox" checked={settings.hardDeleteOnRetention} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, hardDeleteOnRetention: e.target.checked })} />
          </label>
        </div>

        {settings.lastRetentionRunAt && (
          <div className="text-xs text-slate-500" suppressHydrationWarning>
            {t("portal.lastRetentionRun")}: {new Date(settings.lastRetentionRunAt).toLocaleString()}
          </div>
        )}

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
          >
            {saving ? t("common.saving") : t("portal.saveSettings")}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 inline-flex items-center gap-2">
          <Bell size={17} className="text-violet-600" />
          {t("inbox.notification.title")}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between border rounded-lg p-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
              <span className="font-medium">{t("inbox.notification.soundEnabled")}</span>
            </label>
            <button type="button" onClick={testSound} className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              {t("inbox.notification.testSound")}
            </button>
          </div>
          <div className="flex items-center justify-between border rounded-lg p-4">
            <div>
              <span className="font-medium block">{t("inbox.notification.enableDesktop")}</span>
              <span className="text-xs text-slate-500">
                {notificationPermission === "granted" && t("inbox.notification.desktopEnabled")}
                {notificationPermission === "denied" && t("inbox.notification.desktopDenied")}
              </span>
            </div>
            {notificationPermission !== "granted" && (
              <button type="button" onClick={() => requestNotificationPermission()} className="px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700">
                {t("inbox.notification.enableDesktop")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
