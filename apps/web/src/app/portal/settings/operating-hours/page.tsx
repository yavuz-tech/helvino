"use client";

import { useEffect, useState } from "react";
import { Clock3, Globe2, Save, Sunrise, Sunset } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import type { TranslationKey } from "@/i18n/translations";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Toggle from "@/components/ui/Toggle";
import { InputField, TextareaField } from "@/components/ui/Field";
import { p } from "@/styles/theme";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { can } = useFeatureAccess();
  const starterPlus = can("working_hours");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    portalApiFetch("/portal/settings/operating-hours")
      .then(async (r) => {
        const res = await r.json().catch(() => null);
        if (!r.ok || !res) throw new Error("LOAD_FAILED");
        if (!cancelled) setData(res as Data);
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("common.networkError"));
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    if (!data) return;
    if (!starterPlus) {
      premiumToast.info({ title: t("settings.starterRequired"), description: t("settingsPortal.channelPremiumOnly") });
      return;
    }
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

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#64748B]" />
      </div>
    );

  if (!data) {
    return (
      <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
        <PageHeader title={t("settingsPortal.operatingHours")} subtitle={t("settingsPortal.operatingHoursSubtitle")} />
        <ErrorBanner message={error || t("common.error")} onDismiss={() => setError(null)} />
      </div>
    );
  }

  const openDays = data.days.filter((d) => d.isOpen).length;

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader
        title={t("settingsPortal.operatingHours")}
        subtitle={t("settingsPortal.operatingHoursSubtitle")}
        action={
          <button
            onClick={save}
            disabled={saving || !starterPlus}
            className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
          >
            <Save size={13} />
            {saving ? t("common.saving") : t("portal.saveSettings")}
          </button>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
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
        <StatCard label={t("common.status")} value={data.enabled ? t("common.enabled") : t("common.disabled")} icon={Clock3} color={data.enabled ? "emerald" : "slate"} />
        <StatCard label={t("settingsPortal.timezone")} value={data.timezone} icon={Globe2} color="blue" />
        <StatCard label={t("settingsPortal.operatingHours")} value={`${openDays}/7`} icon={Clock3} color="indigo" />
      </div>

      <div style={{ opacity: starterPlus ? 1 : 0.55 }}>
        <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className={`${p.iconSm} ${p.iconEmerald}`}><Clock3 size={13} /></div>
            <h2 className="font-heading text-[18px] font-semibold tracking-[-0.01em] text-[#1A1D23]">{t("settingsPortal.operatingHours")}</h2>
          </div>
          <div className="space-y-3">
            <Toggle label={t("settingsPortal.enableOperatingHours")} checked={data.enabled} disabled={!starterPlus} onChange={(v) => setData({ ...data, enabled: v })} />
            <InputField label={t("settingsPortal.timezone")} value={data.timezone} onChange={(v) => setData({ ...data, timezone: v })} />
            <Toggle label={t("settingsPortal.offHoursAutoReply")} checked={data.offHoursAutoReply} disabled={!starterPlus} onChange={(v) => setData({ ...data, offHoursAutoReply: v })} />
            <TextareaField label={t("settingsPortal.offHoursReplyText")} value={data.offHoursReplyText || ""} onChange={(v) => setData({ ...data, offHoursReplyText: v })} placeholder={t("settingsPortal.offHoursReplyPlaceholder")} />
          </div>
        </Card>
      </div>

      <div style={{ opacity: starterPlus ? 1 : 0.55 }}>
        <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className={`${p.iconSm} ${p.iconAmber}`}><Sunrise size={13} /></div>
            <h2 className="font-heading text-[18px] font-semibold tracking-[-0.01em] text-[#1A1D23]">{t("settingsPortal.weeklySchedule")}</h2>
          </div>
          <div className="space-y-2">
            {data.days.sort((a, b) => a.weekday - b.weekday).map((day) => (
              <div key={day.weekday} className={`${p.toggleRow} flex-col items-stretch gap-2.5 sm:flex-row sm:items-center`}>
                <div className="flex items-center justify-between gap-3 sm:min-w-[120px]">
                  <span className="text-[12px] font-medium text-[#475569]">{t(DAY_KEYS[day.weekday])}</span>
                  <button
                    type="button"
                    disabled={!starterPlus}
                    onClick={() =>
                      setData({
                        ...data,
                        days: data.days.map((d) =>
                          d.weekday === day.weekday ? { ...d, isOpen: !d.isOpen } : d
                        ),
                      })
                    }
                    className={[
                      "relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60",
                      day.isOpen ? "bg-amber-500" : "bg-[#E2E8F0]",
                    ].join(" ")}
                  >
                    <div className={["absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200", day.isOpen ? "translate-x-[18px]" : "translate-x-0.5"].join(" ")} />
                  </button>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <label className="block">
                    <span className={`${p.caption} inline-flex items-center gap-1`}><Sunrise size={10} />{t("common.time")}</span>
                    <input
                      type="time"
                      value={day.startTime || ""}
                      disabled={!day.isOpen || !starterPlus}
                      onChange={(e) =>
                        setData({
                          ...data,
                          days: data.days.map((d) =>
                            d.weekday === day.weekday ? { ...d, startTime: e.target.value } : d
                          ),
                        })
                      }
                      className={`mt-1 ${p.input}`}
                    />
                  </label>
                  <label className="block">
                    <span className={`${p.caption} inline-flex items-center gap-1`}><Sunset size={10} />{t("common.close")}</span>
                    <input
                      type="time"
                      value={day.endTime || ""}
                      disabled={!day.isOpen || !starterPlus}
                      onChange={(e) =>
                        setData({
                          ...data,
                          days: data.days.map((d) =>
                            d.weekday === day.weekday ? { ...d, endTime: e.target.value } : d
                          ),
                        })
                      }
                      className={`mt-1 ${p.input}`}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
