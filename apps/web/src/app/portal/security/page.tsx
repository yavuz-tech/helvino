"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import {
  Copy,
  Check,
  Plus,
  X,
  Monitor,
  Smartphone,
  ChevronLeft,
  Shield,
  KeyRound,
  Globe2,
  AlertTriangle,
  Fingerprint,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import MfaSetupSection from "@/components/MfaSetupSection";
import PasskeySection from "@/components/PasskeySection";
import { useStepUp } from "@/contexts/StepUpContext";
import PasswordStrength from "@/components/PasswordStrength";
import { mapPasswordPolicyError } from "@/lib/password-errors";
import { colors, fonts } from "@/lib/design-tokens";

interface SecuritySettings {
  siteId: string;
  allowedDomains: string[];
  allowLocalhost: boolean;
  domainMismatchCount?: number;
  lastMismatchHost?: string | null;
  lastMismatchAt?: string | null;
}

interface DomainMismatchEventItem {
  id: string;
  reportedHost: string;
  allowedDomainsSnapshot: unknown;
  userAgent: string | null;
  referrerHost: string | null;
  createdAt: string;
}

interface PortalSessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

interface AlertsPayload {
  domainMismatchCountPeriod: number;
  lastMismatchHost: string | null;
  lastMismatchAt: string | null;
}

const ROTATE_CONFIRM_TOKEN = "ROTATE";

function sanitizeUiError(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (
      normalized &&
      normalized !== "[object Event]" &&
      normalized !== "[object Object]" &&
      normalized !== "Event"
    ) {
      return normalized;
    }
    return fallback;
  }
  if (value && typeof value === "object" && "message" in value) {
    const maybe = (value as { message?: unknown }).message;
    if (typeof maybe === "string" && maybe.trim()) return maybe.trim();
  }
  return fallback;
}

export default function PortalSecurityPage() {
  void colors;
  void fonts;
  const { t } = useI18n();
  const { user, loading: authLoading } = usePortalAuth();
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [original, setOriginal] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rotateInput, setRotateInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<PortalSessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingAll, setRevokingAll] = useState(false);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaVerifiedAt, setMfaVerifiedAt] = useState<string | null>(null);

  // Domain mismatch events (Step 11.68)
  const [mismatchEvents, setMismatchEvents] = useState<DomainMismatchEventItem[]>([]);
  const [alerts, setAlerts] = useState<AlertsPayload | null>(null);

  const { withStepUp } = useStepUp();
  const canEdit = user?.role === "owner" || user?.role === "admin";
  const canRotate = user?.role === "owner";

  const loadSessions = useCallback(async () => {
    try {
      const res = await portalApiFetch("/portal/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const loadMfaStatus = useCallback(async () => {
    try {
      const res = await portalApiFetch("/portal/security/mfa/status");
      if (res.ok) {
        const data = await res.json();
        setMfaEnabled(data.mfaEnabled || false);
        setMfaVerifiedAt(data.mfaVerifiedAt || null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      const res = await portalApiFetch("/portal/org/me/security");
      if (!res.ok) {
        setMessage(t("portal.failedLoadSecurity"));
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSecurity(data.security);
      setOriginal(data.security);
      setLoading(false);
    };
    const loadMismatches = async () => {
      try {
        const mres = await portalApiFetch("/portal/org/me/security/domain-mismatches");
        if (mres.ok) {
          const mdata = await mres.json();
          setMismatchEvents(mdata.events || []);
        }
      } catch {
        // ignore
      }
    };
    const loadAlerts = async () => {
      try {
        const res = await portalApiFetch("/portal/org/me/alerts");
        if (res.ok) {
          setAlerts(await res.json());
        }
      } catch {
        // ignore
      }
    };
    load();
    loadMismatches();
    loadAlerts();
    loadSessions();
    loadMfaStatus();
  }, [authLoading, t, loadSessions, loadMfaStatus]);

  const copySiteId = async () => {
    if (!security) return;
    await navigator.clipboard.writeText(security.siteId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAddDomain = () => {
    if (!security) return;
    setSecurity({
      ...security,
      allowedDomains: [...security.allowedDomains, ""],
    });
  };

  const handleRemoveDomain = (index: number) => {
    if (!security) return;
    setSecurity({
      ...security,
      allowedDomains: security.allowedDomains.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    if (!security || !original || !canEdit) return;
    setSaving(true);
    setMessage(null);

    const result = await withStepUp(() =>
      portalApiFetch("/portal/org/me/security", {
        method: "PATCH",
        body: JSON.stringify({
          allowedDomains: security.allowedDomains.filter((d) => d.trim().length > 0),
          allowLocalhost: security.allowLocalhost,
        }),
      }),
      "portal"
    );

    if (result.cancelled) { setSaving(false); return; }
    if (!result.ok) {
      setMessage(t("portal.failedSaveSecurity"));
      setSaving(false);
      return;
    }

    const data = result.data as Record<string, unknown> | undefined;
    if (data?.security) {
      setSecurity(data.security as SecuritySettings);
      setOriginal(data.security as SecuritySettings);
    }
    setMessage(t("portal.securitySaved"));
    setSaving(false);
  };

  const handleRotate = async () => {
    if (!canRotate || rotateInput !== ROTATE_CONFIRM_TOKEN) return;
    setMessage(null);
    const result = await withStepUp(() =>
      portalApiFetch("/portal/org/me/rotate-site-id", {
        method: "POST",
        body: JSON.stringify({ confirm: rotateInput }),
      }),
      "portal"
    );
    if (result.cancelled) return;
    if (!result.ok) {
      setMessage(t("security.failedRotate"));
      return;
    }
    const data = result.data as Record<string, unknown> | undefined;
    if (data?.security) {
      setSecurity(data.security as SecuritySettings);
      setOriginal(data.security as SecuritySettings);
    }
    setRotateInput("");
    setMessage(t("portal.siteIdRotated"));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmNewPassword) {
      setError(t("security.passwordMismatch"));
      return;
    }

    setChangingPassword(true);

    const result = await withStepUp(() =>
      portalApiFetch("/portal/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
      "portal"
    );

    if (result.cancelled) { setChangingPassword(false); return; }

    if (!result.ok) {
      const data = result.data as Record<string, unknown> | undefined;
      const nestedError = (data?.error && typeof data.error === "object") ? (data.error as Record<string, string>) : undefined;
      const fallbackMessage = (typeof data?.error === "string" ? data.error : nestedError?.message) || t("security.failedChangePassword");
      setError(mapPasswordPolicyError(t, nestedError?.code, fallbackMessage));
      setChangingPassword(false);
      return;
    }

    setMessage(t("security.passwordChanged"));
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    loadSessions();
    setChangingPassword(false);
  };

  const handleRevokeSession = async (sessionId: string) => {
    const result = await withStepUp(() =>
      portalApiFetch("/portal/auth/sessions/revoke", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      }),
      "portal"
    );

    if (result.cancelled) return;
    if (result.ok) {
      setMessage(t("security.sessionRevoked"));
      loadSessions();
    } else {
      setError(t("security.failedRevoke"));
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    const result = await withStepUp(() =>
      portalApiFetch("/portal/auth/sessions/revoke-all", {
        method: "POST",
      }),
      "portal"
    );

    if (result.cancelled) { setRevokingAll(false); return; }
    if (result.ok) {
      setMessage(t("security.allSessionsRevoked"));
      loadSessions();
    } else {
      setError(t("security.failedRevokeAll"));
    }
    setRevokingAll(false);
  };

  const hasChanges =
    security &&
    original &&
    (security.allowLocalhost !== original.allowLocalhost ||
      JSON.stringify([...security.allowedDomains].sort()) !==
        JSON.stringify([...original.allowedDomains].sort()));

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor size={16} className="text-[#94A3B8]" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone size={16} className="text-[#94A3B8]" />;
    }
    return <Monitor size={16} className="text-[#94A3B8]" />;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A1D23]" />
      </div>
    );
  }

  if (loading || !security) {
    return (
      <div className="text-[#64748B]">{t("security.loadingSettings")}</div>
    );
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const totalSessions = sessions.length;
  const mismatchTotal = security.domainMismatchCount ?? 0;
  const domainCount = security.allowedDomains.length;
  const securityScore = Math.max(0, 100 - mismatchTotal * 5);

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute -top-20 left-0 h-56 w-56 rounded-full bg-amber-200/35 blur-3xl" />
      <div className="pointer-events-none absolute top-24 right-0 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-1/3 h-56 w-56 rounded-full bg-amber-200/25 blur-3xl" />

      <section className="mb-6 overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-100 via-[#FFFBF5] to-[#FEF3C7] p-6 shadow-[0_18px_45px_rgba(217,119,6,0.16)]">
        <Link
          href="/portal"
          className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-amber-700 transition-colors hover:text-amber-900"
        >
          <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          {t("portalOnboarding.backToDashboard")}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-[28px] font-bold tracking-tight text-[#1A1D23]">{t("security.title")}</h1>
            <p className="mt-1 text-sm text-[#64748B]">{t("portal.securitySubtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <Shield size={13} />
              {t("security.title")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <KeyRound size={13} />
              {mfaEnabled ? t("common.enabled") : t("common.disabled")}
            </span>
          </div>
        </div>
      </section>

      {message && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {alerts && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={14} />
              {t("security.alerts")}
            </span>
            <span>
              {t("security.domainMismatchCount")}:{" "}
              <strong>{alerts.domainMismatchCountPeriod ?? 0}</strong>
            </span>
            {alerts.lastMismatchHost && alerts.lastMismatchAt && (
              <span className="text-xs text-amber-800">
                {t("security.lastMismatch")}: {alerts.lastMismatchHost} — {formatDate(alerts.lastMismatchAt)}
              </span>
            )}
          </div>
        </div>
      )}

      <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-amber-200/70 bg-white/90 p-4 shadow-[0_8px_24px_rgba(217,119,6,0.08)]">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Shield size={14} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{t("security.score")}</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1D23]">{securityScore}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-white/90 p-4 shadow-[0_8px_24px_rgba(217,119,6,0.08)]">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Globe2 size={14} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{t("security.allowedDomains")}</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1D23]">{domainCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-4 shadow-[0_8px_24px_rgba(5,150,105,0.08)]">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Fingerprint size={14} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{t("security.activeSessions")}</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1D23]">{totalSessions}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-white/90 p-4 shadow-[0_8px_24px_rgba(217,119,6,0.08)]">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertTriangle size={14} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{t("security.domainMismatchCount")}</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1D23]">{mismatchTotal}</p>
        </div>
      </section>

      <div className="mb-6 rounded-2xl border border-[#F3E8D8] bg-white/90 p-3 shadow-[0_8px_30px_rgba(2,6,23,0.06)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <RefreshCw size={14} />
            </span>
            <p className="text-sm font-medium text-[#64748B]">{t("portal.saveSecuritySettings")}</p>
          </div>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(217,119,6,0.25)] transition-all hover:from-amber-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:from-amber-300 disabled:to-amber-300 disabled:shadow-none"
            >
              {saving ? t("common.saving") : t("portal.saveSecuritySettings")}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <div className="rounded-2xl border border-amber-200/70 bg-white/95 p-6 shadow-[0_8px_30px_rgba(217,119,6,0.08)]">
            <h2 className="mb-1 text-lg font-semibold text-[#1A1D23]">{t("security.changePassword")}</h2>
            <p className="mb-4 text-sm text-[#64748B]">{t("security.changePasswordDesc")}</p>

            <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#475569]">{t("security.currentPassword")}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                  disabled={changingPassword}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#475569]">{t("security.newPassword")}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                  minLength={12}
                  disabled={changingPassword}
                />
                <PasswordStrength password={newPassword} minLength={12} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#475569]">{t("security.confirmNewPassword")}</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                  minLength={12}
                  disabled={changingPassword}
                />
              </div>
              <button
                type="submit"
                disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                className="inline-flex items-center rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:from-amber-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:from-amber-300 disabled:to-amber-300"
              >
                {changingPassword ? t("security.changingPassword") : t("security.changePassword")}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-white/95 p-6 shadow-[0_8px_30px_rgba(217,119,6,0.10)]">
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Fingerprint size={14} />
              </span>
              <h2 className="text-lg font-semibold text-[#1A1D23]">{t("security.title")}</h2>
            </div>
            <MfaSetupSection
              mfaEnabled={mfaEnabled}
              mfaVerifiedAt={mfaVerifiedAt}
              onSetup={async () => {
                try {
                  const res = await portalApiFetch("/portal/security/mfa/setup", { method: "POST" });
                  if (!res.ok) return null;
                  return await res.json();
                } catch {
                  return null;
                }
              }}
              onVerify={async (code) => {
                try {
                  const res = await portalApiFetch("/portal/security/mfa/verify", {
                    method: "POST",
                    body: JSON.stringify({ code }),
                  });
                  return res.ok;
                } catch {
                  return false;
                }
              }}
              onDisable={async (code) => {
                try {
                  const res = await portalApiFetch("/portal/security/mfa/disable", {
                    method: "POST",
                    body: JSON.stringify({ code }),
                  });
                  return res.ok;
                } catch {
                  return false;
                }
              }}
              onRefresh={loadMfaStatus}
            />
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-white/95 p-6 shadow-[0_8px_30px_rgba(217,119,6,0.08)]">
            <PasskeySection area="portal" />
          </div>

          <div className="rounded-2xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_8px_30px_rgba(5,150,105,0.08)]">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1A1D23]">{t("security.activeSessions")}</h2>
              {otherSessions.length > 0 && (
                <button
                  onClick={handleRevokeAll}
                  disabled={revokingAll}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                >
                  {revokingAll ? t("security.revokingAll") : t("security.revokeAllSessions")}
                </button>
              )}
            </div>
            <p className="mb-4 text-sm text-[#64748B]">{t("security.activeSessionsDesc")}</p>

            {loadingSessions ? (
              <div className="text-sm text-[#64748B]">{t("common.loading")}</div>
            ) : sessions.length === 0 ? (
              <div className="text-sm text-[#64748B]">{t("security.noOtherSessions")}</div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between rounded-xl border p-3 ${
                      session.isCurrent
                        ? "border-emerald-200 bg-emerald-50/70"
                        : "border-[#E2E8F0] bg-[#F8FAFC]/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getDeviceIcon(session.userAgent)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#1A1D23]">
                            {session.userAgent
                              ? session.userAgent.substring(0, 60) + (session.userAgent.length > 60 ? "..." : "")
                              : t("devices.unknownDevice")}
                          </span>
                          {session.isCurrent && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              {t("security.currentSession")}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-[#64748B]" suppressHydrationWarning>
                          {session.ip && <span>{session.ip} &middot; </span>}
                          <span>{t("security.loginAt")}: {formatDate(session.createdAt)}</span>
                          <span> &middot; {t("security.lastActive")}: {formatDate(session.lastSeenAt)}</span>
                        </div>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        {t("security.revokeSession")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 xl:col-span-5">
          <div className="rounded-2xl border border-amber-200/70 bg-white/95 p-6 shadow-[0_8px_30px_rgba(217,119,6,0.08)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Globe2 size={14} />
              </span>
              <h2 className="text-lg font-semibold text-[#1A1D23]">{t("security.siteId")}</h2>
            </div>
            <div className="flex gap-2">
              <code className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-mono">
                {security.siteId}
              </code>
              <button
                onClick={copySiteId}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-amber-600 hover:to-amber-700"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    {t("security.copied")}
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    {t("security.copy")}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-white/95 p-6 shadow-[0_8px_30px_rgba(217,119,6,0.08)]">
            <h2 className="mb-3 text-lg font-semibold text-[#1A1D23]">{t("security.allowedDomains")}</h2>
            <div className="mb-4 space-y-2">
              {security.allowedDomains.map((domain, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => {
                      const next = [...security.allowedDomains];
                      next[index] = e.target.value;
                      setSecurity({ ...security, allowedDomains: next });
                    }}
                    disabled={!canEdit}
                    className="flex-1 rounded-xl border border-[#E2E8F0] px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-[#F8FAFC]"
                  />
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveDomain(index)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 transition-colors hover:bg-rose-100"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canEdit && (
              <button
                onClick={handleAddDomain}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <Plus size={16} />
                {t("security.addDomain")}
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-white/95 p-6 shadow-[0_8px_30px_rgba(217,119,6,0.08)]">
            <h2 className="mb-2 text-lg font-semibold text-[#1A1D23]">{t("security.domainMismatches")}</h2>
            <p className="mb-4 text-sm text-[#64748B]">{t("security.domainMismatchesDesc")}</p>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-[#475569]">
                {t("security.domainMismatchCount")}:{" "}
                <span className="font-bold text-[#1A1D23]">{security.domainMismatchCount ?? 0}</span>
              </span>
              {security.lastMismatchHost && security.lastMismatchAt && (
                <span className="text-xs text-[#64748B]">
                  {t("security.lastMismatch")}: {security.lastMismatchHost} — {formatDate(security.lastMismatchAt)}
                </span>
              )}
            </div>
            {mismatchEvents.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#F8FAFC]/90">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-[#475569]">{t("security.reportedHost")}</th>
                      <th className="px-4 py-2 text-left font-semibold text-[#475569]">{t("security.date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mismatchEvents.map((e) => (
                      <tr key={e.id} className="border-t border-[#F3E8D8]">
                        <td className="px-4 py-2 font-mono text-[#1A1D23]">{e.reportedHost}</td>
                        <td className="px-4 py-2 text-[#64748B]">{formatDate(e.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_8px_30px_rgba(5,150,105,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="mb-1 text-sm font-semibold text-[#1A1D23]">{t("security.allowLocalhost")}</h3>
                <p className="text-sm text-[#64748B]">{t("security.allowLocalhostDesc")}</p>
              </div>
              <input
                type="checkbox"
                checked={security.allowLocalhost}
                disabled={!canEdit}
                onChange={(e) => setSecurity({ ...security, allowLocalhost: e.target.checked })}
                className="relative h-6 w-12 cursor-pointer appearance-none rounded-full bg-[#E2E8F0] transition-colors checked:bg-emerald-500 disabled:cursor-not-allowed"
                style={{ WebkitAppearance: "none" }}
              />
            </div>
          </div>

          {canRotate && (
            <div className="rounded-2xl border border-rose-200/70 bg-gradient-to-r from-rose-50 to-orange-50 p-6 shadow-[0_8px_30px_rgba(244,63,94,0.12)]">
              <h2 className="mb-2 text-lg font-semibold text-[#1A1D23]">{t("portal.rotateSiteId")}</h2>
              <p className="mb-4 text-sm text-[#64748B]">{t("portal.rotateSiteIdSubtitle")}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rotateInput}
                  onChange={(e) => setRotateInput(e.target.value)}
                  className="flex-1 rounded-xl border border-rose-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-500"
                  placeholder={ROTATE_CONFIRM_TOKEN}
                />
                <button
                  onClick={handleRotate}
                  disabled={rotateInput !== ROTATE_CONFIRM_TOKEN}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                >
                  {t("portal.rotate")}
                </button>
              </div>
            </div>
          )}

          {user?.role === "owner" && <EmergencyTokenSection />}
        </div>
      </div>
    </div>
  );
}

function EmergencyTokenSection() {
  const { t } = useI18n();
  const { withStepUp } = useStepUp();
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setEmergencyError(null);
    setGeneratedToken(null);

    const result = await withStepUp(
      () => portalApiFetch("/portal/emergency/generate", { method: "POST" }),
      "portal"
    );

    if (result.cancelled) {
      setGenerating(false);
      return;
    }

    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      setGeneratedToken(data.token as string);
      if (data.cooldownUntil) setCooldownUntil(data.cooldownUntil as string);
    } else {
      const data = result.data as Record<string, unknown> | undefined;
      if (data?.cooldownUntil) {
        setCooldownUntil(data.cooldownUntil as string);
        setEmergencyError(t("emergency.cooldown"));
      } else {
        setEmergencyError(sanitizeUiError(data?.error, t("common.error")));
      }
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-[0_8px_30px_rgba(245,158,11,0.12)]">
      <h2 className="text-lg font-semibold text-[#1A1D23] mb-1">{t("emergency.title")}</h2>
      <p className="text-sm text-[#64748B] mb-4">{t("emergency.description")}</p>

      {emergencyError && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {emergencyError}
          {cooldownUntil && (
            <span className="block mt-1 text-xs" suppressHydrationWarning>
              {t("emergency.cooldown")}: {new Date(cooldownUntil).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {generatedToken ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-white/75 p-3">
            <p className="text-xs text-amber-800 font-medium mb-2">{t("emergency.warning")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-mono select-all">
                {generatedToken}
              </code>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
              >
                {copied ? <><Check size={14} /> {t("emergency.copied")}</> : <><Copy size={14} /> {t("emergency.copy")}</>}
              </button>
            </div>
          </div>
          {cooldownUntil && (
            <p className="text-xs text-[#64748B]" suppressHydrationWarning>
              {t("emergency.cooldown")}: {new Date(cooldownUntil).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:from-amber-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:from-amber-300 disabled:to-amber-300"
        >
          {generating ? t("emergency.generating") : t("emergency.generate")}
        </button>
      )}
    </div>
  );
}
