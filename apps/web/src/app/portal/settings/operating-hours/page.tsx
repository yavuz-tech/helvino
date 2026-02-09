"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { Clock3, Globe2, MessageCircle, Check, AlertCircle, Sunrise, Sunset } from "lucide-react";

type Day = {
  weekday: number;
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
};

type Data = {
  timezone: string;
  enabled: boolean;
  offHoursAutoReply: boolean;
  offHoursReplyText: string | null;
  days: Day[];
};

const DAY_KEYS: TranslationKey[] = [
  "settingsPortal.daySun",
  "settingsPortal.dayMon",
  "settingsPortal.dayTue",
  "settingsPortal.dayWed",
  "settingsPortal.dayThu",
  "settingsPortal.dayFri",
  "settingsPortal.daySat",
];

export default function PortalOperatingHoursPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    portalApiFetch("/portal/settings/operating-hours")
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => setStatus(t("common.networkError")));
  }, [t]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setStatus("");
    const res = await portalApiFetch("/portal/settings/operating-hours", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    setSaving(false);
    setStatus(res.ok ? t("portal.settingsSaved") : t("portal.failedSaveSettings"));
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  const openDays = data.days.filter((d) => d.isOpen).length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50/40 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <Clock3 size={18} className="text-sky-600" />
          <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.operatingHours")}</h1>
        </div>
        <p className="text-sm text-slate-600 mt-1">{t("settingsPortal.operatingHoursSubtitle")}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("common.status")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{data.enabled ? t("common.enabled") : t("common.disabled")}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.timezone")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{data.timezone}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.operatingHours")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{openDays}/7</p>
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

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <label className="flex items-center justify-between border-2 rounded-xl p-4 hover:border-sky-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center">
              <Clock3 size={16} className="text-sky-600" />
            </div>
            <span className="font-semibold text-slate-800">{t("settingsPortal.enableOperatingHours")}</span>
          </div>
          <input
            type="checkbox"
            checked={data.enabled}
            onChange={(e) => setData({ ...data, enabled: e.target.checked })}
            className="w-5 h-5 rounded accent-sky-600"
          />
        </label>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
            <Globe2 size={14} className="text-slate-500" />
            {t("settingsPortal.timezone")}
          </label>
          <input
            value={data.timezone}
            onChange={(e) => setData({ ...data, timezone: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
            placeholder="UTC"
          />
        </div>

        <label className="flex items-center justify-between border-2 rounded-xl p-4 hover:border-sky-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <MessageCircle size={16} className="text-violet-600" />
            </div>
            <span className="font-semibold text-slate-800">{t("settingsPortal.offHoursAutoReply")}</span>
          </div>
          <input
            type="checkbox"
            checked={data.offHoursAutoReply}
            onChange={(e) => setData({ ...data, offHoursAutoReply: e.target.checked })}
            className="w-5 h-5 rounded accent-violet-600"
          />
        </label>

        <textarea
          value={data.offHoursReplyText || ""}
          onChange={(e) => setData({ ...data, offHoursReplyText: e.target.value })}
          placeholder={t("settingsPortal.offHoursReplyPlaceholder")}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all resize-none"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">{t("settingsPortal.operatingHours")}</h3>
        <div className="space-y-3">
          {data.days
            .sort((a, b) => a.weekday - b.weekday)
            .map((day) => {
              const isWeekend = day.weekday === 0 || day.weekday === 6;
              return (
                <div
                  key={day.weekday}
                  className={`border-2 rounded-xl p-4 transition-all ${
                    day.isOpen
                      ? "border-emerald-200 bg-emerald-50/30"
                      : "border-slate-200 bg-slate-50/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          day.isOpen
                            ? "bg-emerald-100"
                            : isWeekend
                            ? "bg-slate-100"
                            : "bg-slate-100"
                        }`}
                      >
                        <span className="text-sm font-bold text-slate-700">
                          {t(DAY_KEYS[day.weekday]).substring(0, 3)}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-800">{t(DAY_KEYS[day.weekday])}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={day.isOpen}
                      onChange={(e) =>
                        setData({
                          ...data,
                          days: data.days.map((d) =>
                            d.weekday === day.weekday ? { ...d, isOpen: e.target.checked } : d
                          ),
                        })
                      }
                      className="w-5 h-5 rounded accent-emerald-600"
                    />
                  </div>
                  {day.isOpen && (
                    <div className="grid grid-cols-2 gap-3 pl-12">
                      <div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 mb-1.5 font-medium">
                          <Sunrise size={12} className="text-amber-500" />
                          {t("settingsPortal.operatingHours")}
                        </label>
                        <input
                          type="time"
                          value={day.startTime || ""}
                          onChange={(e) =>
                            setData({
                              ...data,
                              days: data.days.map((d) =>
                                d.weekday === day.weekday ? { ...d, startTime: e.target.value } : d
                              ),
                            })
                          }
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 mb-1.5 font-medium">
                          <Sunset size={12} className="text-orange-500" />
                          Close
                        </label>
                        <input
                          type="time"
                          value={day.endTime || ""}
                          onChange={(e) =>
                            setData({
                              ...data,
                              days: data.days.map((d) =>
                                d.weekday === day.weekday ? { ...d, endTime: e.target.value } : d
                              ),
                            })
                          }
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-all shadow-md flex items-center justify-center gap-2"
      >
        {saving ? (
          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        ) : (
          <Check size={16} />
        )}
        {saving ? t("common.saving") : t("portal.saveSettings")}
      </button>
    </div>
  );
}
