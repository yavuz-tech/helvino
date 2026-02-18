"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import ErrorBanner from "@/components/ErrorBanner";
import { premiumToast } from "@/components/PremiumToast";

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
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/sessions/active");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("LOAD_FAILED");
      setSessions(data.sessions || []);
    } catch {
      setError(t("common.networkError"));
      setSessions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await portalApiFetch(`/portal/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("DELETE_FAILED");
      premiumToast.success({ title: t("toast.deleted"), description: t("toast.deletedDesc") });
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    } finally {
      setRevokingId(null);
    }
    await load();
  };

  return (
    <div className="space-y-4" style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #F3E8D8",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1D23" }}>{t("security.activeSessions")}</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{t("security.activeSessionsDesc")}</p>
      </div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="space-y-3">
        {loading ? (
          <div style={{ color: "#64748B", fontSize: 13 }}>{t("common.loading")}</div>
        ) : sessions.length === 0 ? (
          <div style={{ color: "#64748B", fontSize: 13 }}>{t("security.noOtherSessions")}</div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              style={{
                background: "#FFFFFF",
                border: "1px solid #F3E8D8",
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{s.deviceName || t("devices.unknownDevice")}</p>
                  <p className="text-xs text-slate-500">{[s.loginCity, s.loginCountry].filter(Boolean).join(", ") || "-"}</p>
                  <p className="text-xs text-slate-500" suppressHydrationWarning>{new Date(s.lastSeenAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.isCurrent ? (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {t("security.currentSession")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => revoke(s.id)}
                      disabled={revokingId === s.id}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #FECDD3",
                        background: "#FFF1F2",
                        color: "#E11D48",
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        opacity: revokingId === s.id ? 0.6 : 1,
                      }}
                    >
                      {t("security.revokeSession")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
