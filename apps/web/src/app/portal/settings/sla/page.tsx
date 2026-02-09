"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { ShieldCheck, Clock, Target, AlertTriangle, Check, AlertCircle } from "lucide-react";

type SlaPolicy = {
  id: string;
  name: string;
  enabled: boolean;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  warnThresholdPercent: number;
};

export default function PortalSettingsSlaPage() {
  const { t } = useI18n();
  const [policy, setPolicy] = useState<SlaPolicy | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    portalApiFetch("/portal/settings/sla")
      .then((r) => r.json())
      .then((data) => setPolicy(data.policy))
      .catch(() => setStatus(t("common.networkError")));
  }, [t]);

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    setStatus("");
    const res = await portalApiFetch("/portal/settings/sla", {
      method: "PUT",
      body: JSON.stringify(policy),
    });
    setSaving(false);
    setStatus(res.ok ? t("portal.settingsSaved") : t("portal.failedSaveSettings"));
  };

  if (!policy) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/40 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <ShieldCheck size={18} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.sla")}</h1>
        </div>
        <p className="text-sm text-slate-600 mt-1">{t("settingsPortal.slaSubtitle")}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("common.status")}</p>
            <p className={`text-lg font-bold mt-1 ${policy.enabled ? "text-emerald-600" : "text-slate-400"}`}>
              {policy.enabled ? t("common.enabled") : t("common.disabled")}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.firstResponseMinutes")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{policy.firstResponseMinutes}m</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.resolutionMinutes")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{policy.resolutionMinutes}m</p>
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
        <label className="flex items-center justify-between border-2 rounded-xl p-4 hover:border-emerald-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <ShieldCheck size={16} className="text-emerald-600" />
            </div>
            <span className="font-semibold text-slate-800">{t("settingsPortal.enableSla")}</span>
          </div>
          <input
            type="checkbox"
            checked={policy.enabled}
            onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })}
            className="w-5 h-5 rounded accent-emerald-600"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
              <Clock size={13} className="text-blue-500" />
              {t("settingsPortal.firstResponseMinutes")}
            </label>
            <input
              type="number"
              value={policy.firstResponseMinutes}
              onChange={(e) => setPolicy({ ...policy, firstResponseMinutes: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
              <Target size={13} className="text-emerald-500" />
              {t("settingsPortal.resolutionMinutes")}
            </label>
            <input
              type="number"
              value={policy.resolutionMinutes}
              onChange={(e) => setPolicy({ ...policy, resolutionMinutes: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
              <AlertTriangle size={13} className="text-amber-500" />
              {t("settingsPortal.warnThresholdPercent")}
            </label>
            <input
              type="number"
              value={policy.warnThresholdPercent}
              onChange={(e) => setPolicy({ ...policy, warnThresholdPercent: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{t("settingsPortal.sla")}</h4>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              {t("settingsPortal.firstResponseMinutes")}: First reply target
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              {t("settingsPortal.resolutionMinutes")}: Full resolution target
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              {t("settingsPortal.warnThresholdPercent")}: Warning at X% elapsed
            </li>
          </ul>
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
