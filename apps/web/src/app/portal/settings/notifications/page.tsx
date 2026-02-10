"use client";

import { useEffect, useState } from "react";
import { Bell, CreditCard, MessageSquare, Shield } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Toggle from "@/components/ui/Toggle";
import { p } from "@/styles/theme";

type Prefs = {
  securityEnabled: boolean;
  billingEnabled: boolean;
  widgetEnabled: boolean;
};

export default function PortalSettingsNotificationsPage() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    portalApiFetch("/portal/notifications/preferences")
      .then((r) => r.json())
      .then((data) => setPrefs(data))
      .catch(() => {});
  }, []);

  const update = async (next: Prefs) => {
    setPrefs(next);
    setSaving(true);
    try {
      const res = await portalApiFetch("/portal/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify(next),
      });
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

  if (!prefs)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  const rows: Array<{ key: keyof Prefs; label: string; icon: typeof Shield; color: string }> = [
    { key: "securityEnabled", label: t("settingsPortal.notifySecurity"), icon: Shield, color: p.iconRose },
    { key: "billingEnabled", label: t("settingsPortal.notifyBilling"), icon: CreditCard, color: p.iconAmber },
    { key: "widgetEnabled", label: t("settingsPortal.notifyWidget"), icon: MessageSquare, color: p.iconBlue },
  ];

  const enabledCount = rows.filter((r) => prefs[r.key]).length;

  return (
    <div className={p.sectionGap}>
      <PageHeader title={t("settingsPortal.notifications")} subtitle={t("settingsPortal.notificationsSubtitle")} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("settingsPortal.notifications")} value={String(rows.length)} icon={Bell} color="rose" />
        <StatCard label={t("common.enabled")} value={String(enabledCount)} icon={Shield} color="emerald" />
        <StatCard label={t("common.disabled")} value={String(rows.length - enabledCount)} icon={MessageSquare} color="slate" />
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconRose}`}><Bell size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.notifications")}</h2>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <Toggle key={row.key} label={row.label} checked={prefs[row.key]} disabled={saving} onChange={(v) => update({ ...prefs, [row.key]: v })} />
          ))}
        </div>
      </Card>
    </div>
  );
}
