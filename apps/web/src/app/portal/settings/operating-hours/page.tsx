"use client";

import { useEffect, useState } from "react";
import { Clock3, Globe2, Save, Sunrise, Sunset } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import type { TranslationKey } from "@/i18n/translations";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Toggle from "@/components/ui/Toggle";
import { InputField, TextareaField } from "@/components/ui/Field";
import { p } from "@/styles/theme";

type Day = { weekday: number; isOpen: boolean; startTime: string | null; endTime: string | null };
type Data = { timezone: string; enabled: boolean; offHoursAutoReply: boolean; offHoursReplyText: string | null; days: Day[] };

const DAY_KEYS: TranslationKey[] = [
  "settingsPortal.daySun", "settingsPortal.dayMon", "settingsPortal.dayTue",
  "settingsPortal.dayWed", "settingsPortal.dayThu", "settingsPortal.dayFri", "settingsPortal.daySat",
];

export default function PortalOperatingHoursPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    portalApiFetch("/portal/settings/operating-hours")
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await portalApiFetch("/portal/settings/operating-hours", { method: "PUT", body: JSON.stringify(data) });
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

  if (!data)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  const openDays = data.days.filter((d) => d.isOpen).length;

  return (
    <div className={p.sectionGap}>
      <PageHeader
        title={t("settingsPortal.operatingHours")}
        subtitle={t("settingsPortal.operatingHoursSubtitle")}
        action={
          <button onClick={save} disabled={saving} className={p.btnPrimary}>
            <Save size={13} />
            {saving ? t("common.saving") : t("portal.saveSettings")}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("common.status")} value={data.enabled ? t("common.enabled") : t("common.disabled")} icon={Clock3} color={data.enabled ? "emerald" : "slate"} />
        <StatCard label={t("settingsPortal.timezone")} value={data.timezone} icon={Globe2} color="blue" />
        <StatCard label={t("settingsPortal.operatingHours")} value={`${openDays}/7`} icon={Clock3} color="indigo" />
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconEmerald}`}><Clock3 size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.operatingHours")}</h2>
        </div>
        <div className="space-y-3">
          <Toggle label={t("settingsPortal.enableOperatingHours")} checked={data.enabled} onChange={(v) => setData({ ...data, enabled: v })} />
          <InputField label={t("settingsPortal.timezone")} value={data.timezone} onChange={(v) => setData({ ...data, timezone: v })} />
          <Toggle label={t("settingsPortal.offHoursAutoReply")} checked={data.offHoursAutoReply} onChange={(v) => setData({ ...data, offHoursAutoReply: v })} />
          <TextareaField label={t("settingsPortal.offHoursAutoReply")} value={data.offHoursReplyText || ""} onChange={(v) => setData({ ...data, offHoursReplyText: v })} placeholder={t("settingsPortal.offHoursReplyPlaceholder")} />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconBlue}`}><Sunrise size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.operatingHours")}</h2>
        </div>
        <div className="space-y-2">
          {data.days.sort((a, b) => a.weekday - b.weekday).map((day) => (
            <div key={day.weekday} className={`${p.toggleRow} flex-col items-stretch gap-2.5 sm:flex-row sm:items-center`}>
              <div className="flex items-center justify-between gap-3 sm:min-w-[120px]">
                <span className="text-[12px] font-medium text-slate-700">{t(DAY_KEYS[day.weekday])}</span>
                <button type="button" onClick={() => setData({ ...data, days: data.days.map((d) => d.weekday === day.weekday ? { ...d, isOpen: !d.isOpen } : d) })} className={["relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200", day.isOpen ? "bg-blue-600" : "bg-slate-200"].join(" ")}>
                  <div className={["absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200", day.isOpen ? "translate-x-[18px]" : "translate-x-0.5"].join(" ")} />
                </button>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                <label className="block">
                  <span className={`${p.caption} inline-flex items-center gap-1`}><Sunrise size={10} />{t("common.time")}</span>
                  <input type="time" value={day.startTime || ""} disabled={!day.isOpen} onChange={(e) => setData({ ...data, days: data.days.map((d) => d.weekday === day.weekday ? { ...d, startTime: e.target.value } : d) })} className={`mt-1 ${p.input}`} />
                </label>
                <label className="block">
                  <span className={`${p.caption} inline-flex items-center gap-1`}><Sunset size={10} />{t("common.close")}</span>
                  <input type="time" value={day.endTime || ""} disabled={!day.isOpen} onChange={(e) => setData({ ...data, days: data.days.map((d) => d.weekday === day.weekday ? { ...d, endTime: e.target.value } : d) })} className={`mt-1 ${p.input}`} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
