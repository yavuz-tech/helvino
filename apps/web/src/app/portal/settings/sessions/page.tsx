"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";

interface SessionRow {
  id: string;
  deviceName: string | null;
  loginCountry: string | null;
  loginCity: string | null;
  lastSeenAt: string;
  isCurrent: boolean;
}

export default function PortalSessionsPage() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await portalApiFetch("/portal/sessions/active");
    const data = await res.json().catch(() => ({}));
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (id: string) => {
    await portalApiFetch(`/portal/sessions/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("security.activeSessions")}</h1>
        <p className="text-sm text-slate-600">{t("security.activeSessionsDesc")}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">{t("devices.device")}</th>
              <th className="px-4 py-2 text-left">{t("common.location")}</th>
              <th className="px-4 py-2 text-left">{t("security.lastActive")}</th>
              <th className="px-4 py-2 text-left">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>{t("common.loading")}</td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>{t("security.noOtherSessions")}</td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{s.deviceName || t("devices.unknownDevice")}</div>
                    {s.isCurrent ? (
                      <span className="text-xs text-emerald-700">{t("security.currentSession")}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{[s.loginCity, s.loginCountry].filter(Boolean).join(", ") || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(s.lastSeenAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {!s.isCurrent ? (
                      <button
                        type="button"
                        onClick={() => revoke(s.id)}
                        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700"
                      >
                        {t("security.revokeSession")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
