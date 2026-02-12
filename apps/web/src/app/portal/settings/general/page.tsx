"use client";

import { useEffect, useState } from "react";
import { Bell, Bot, Database, MessageCircleMore, Save, ShieldCheck } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { usePortalInboxNotification } from "@/contexts/PortalInboxNotificationContext";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Toggle from "@/components/ui/Toggle";
import { InputField } from "@/components/ui/Field";
import { p } from "@/styles/theme";

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

  const canEdit = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      const res = await portalApiFetch("/portal/org/me");
      if (!res.ok) { setLoading(false); return; }
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
  }, [authLoading]);

  const handleSave = async () => {
    if (!settings || !canEdit) return;
    setSaving(true);
    try {
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
      if (res.ok) {
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
        premiumToast.success({ title: t("toast.settingsSaved"), description: t("toast.settingsSavedDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
    setSaving(false);
  };

  const hasChanges = settings && original && JSON.stringify(settings) !== JSON.stringify(original);

  if (authLoading || loading || !settings)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader
        title={t("settingsPortal.general")}
        subtitle={t("portal.settingsSubtitle")}
        action={
          canEdit ? (
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
            >
              <Save size={13} />
              {saving ? t("common.saving") : t("portal.saveSettings")}
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("portal.widgetEnabled")} value={settings.widgetEnabled ? t("common.enabled") : t("common.disabled")} icon={MessageCircleMore} color="blue" />
        <StatCard label={t("portal.writeEnabled")} value={settings.writeEnabled ? t("common.enabled") : t("common.disabled")} icon={ShieldCheck} color="emerald" />
        <StatCard label={t("portal.aiEnabled")} value={settings.aiEnabled ? t("common.enabled") : t("common.disabled")} icon={Bot} color="violet" />
      </div>

      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconBlue}`}><MessageCircleMore size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.general")}</h2>
        </div>
        <div className="space-y-2">
          <Toggle label={t("portal.widgetEnabled")} checked={settings.widgetEnabled} disabled={!canEdit} onChange={(v) => setSettings({ ...settings, widgetEnabled: v })} />
          <Toggle label={t("portal.writeEnabled")} checked={settings.writeEnabled} disabled={!canEdit} onChange={(v) => setSettings({ ...settings, writeEnabled: v })} />
          <Toggle label={t("portal.aiEnabled")} checked={settings.aiEnabled} disabled={!canEdit} onChange={(v) => setSettings({ ...settings, aiEnabled: v })} />
        </div>
      </Card>

      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconAmber}`}><Database size={13} /></div>
          <h2 className={p.h2}>{t("portal.messageRetentionDays")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label={t("portal.messageRetentionDays")} type="number" value={settings.messageRetentionDays} onChange={(v) => setSettings({ ...settings, messageRetentionDays: Number(v) })} disabled={!canEdit} suffix={t("common.days")} />
          <div className="flex items-end">
            <Toggle label={t("portal.hardDelete")} checked={settings.hardDeleteOnRetention} disabled={!canEdit} onChange={(v) => setSettings({ ...settings, hardDeleteOnRetention: v })} />
          </div>
        </div>
        {settings.lastRetentionRunAt && (
          <p className={`${p.caption} mt-3`} suppressHydrationWarning>
            {t("portal.lastRetentionRun")}: {new Date(settings.lastRetentionRunAt).toLocaleString()}
          </p>
        )}
      </Card>

      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconRose}`}><Bell size={13} /></div>
          <h2 className={p.h2}>{t("inbox.notification.title")}</h2>
        </div>
        <div className="space-y-2">
          <div className={p.toggleRow}>
            <p className="text-[13px] font-medium text-slate-700">{t("inbox.notification.soundEnabled")}</p>
            <button type="button" onClick={testSound} className={p.btnSecondary}>{t("inbox.notification.testSound")}</button>
          </div>
          <Toggle label={t("inbox.notification.soundEnabled")} checked={soundEnabled} onChange={setSoundEnabled} />
          <div className={p.toggleRow}>
            <div>
              <p className="text-[13px] font-medium text-slate-700">{t("inbox.notification.enableDesktop")}</p>
              <p className={`${p.caption} mt-0.5`}>
                {notificationPermission === "granted" && t("inbox.notification.desktopEnabled")}
                {notificationPermission === "denied" && t("inbox.notification.desktopDenied")}
              </p>
            </div>
            {notificationPermission !== "granted" && (
              <button type="button" onClick={() => requestNotificationPermission()} className={p.btnSecondary}>{t("inbox.notification.enableDesktop")}</button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
