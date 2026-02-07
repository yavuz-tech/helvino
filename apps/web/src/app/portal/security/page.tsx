"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/PortalLayout";
import {
  checkPortalAuth,
  portalLogout,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import { Copy, Check, Plus, X, Monitor, Smartphone } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import MfaSetupSection from "@/components/MfaSetupSection";
import PasskeySection from "@/components/PasskeySection";
import { useStepUp } from "@/contexts/StepUpContext";
import PasswordStrength from "@/components/PasswordStrength";

interface SecuritySettings {
  siteId: string;
  allowedDomains: string[];
  allowLocalhost: boolean;
}

interface PortalSessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

export default function PortalSecurityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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

  const { withStepUp } = useStepUp();
  const canEdit = user?.role === "owner" || user?.role === "admin";
  const canRotate = user?.role === "owner";

  useEffect(() => {
    const verify = async () => {
      const portalUser = await checkPortalAuth();
      if (!portalUser) {
        router.push("/portal/login");
        return;
      }
      setUser(portalUser);
      setAuthLoading(false);
    };
    verify();
  }, [router]);

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
    load();
    loadSessions();
    loadMfaStatus();
  }, [authLoading, t, loadSessions, loadMfaStatus]);

  const handleLogout = async () => {
    await portalLogout();
    router.push("/portal/login");
  };

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
    if (!canRotate || rotateInput !== "ROTATE") return;
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

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(t("security.passwordMinLength"));
      return;
    }

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
      const data = result.data as Record<string, string> | undefined;
      setError(data?.error || t("security.failedChangePassword"));
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
    if (!userAgent) return <Monitor size={16} className="text-slate-400" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone size={16} className="text-slate-400" />;
    }
    return <Monitor size={16} className="text-slate-400" />;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">{t("common.loading")}</div>
      </div>
    );
  }

  if (loading || !security) {
    return (
      <PortalLayout user={user} onLogout={handleLogout}>
        <div className="text-slate-600">{t("security.loadingSettings")}</div>
      </PortalLayout>
    );
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <PortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("security.title")}</h1>
        <p className="text-sm text-slate-600 mt-1">
          {t("portal.securitySubtitle")}
        </p>
      </div>

      {message && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
          {message}
        </div>
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="space-y-6">
        {/* Change Password */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">{t("security.changePassword")}</h2>
          <p className="text-sm text-slate-600 mb-4">{t("security.changePasswordDesc")}</p>

          <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("security.currentPassword")}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
                disabled={changingPassword}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("security.newPassword")}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
                minLength={8}
                disabled={changingPassword}
              />
              <PasswordStrength password={newPassword} minLength={8} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("security.confirmNewPassword")}
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
                minLength={8}
                disabled={changingPassword}
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
            >
              {changingPassword ? t("security.changingPassword") : t("security.changePassword")}
            </button>
          </form>
        </div>

        {/* MFA Section */}
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

        {/* Passkeys */}
        <PasskeySection area="portal" />

        {/* Active Sessions */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-slate-900">{t("security.activeSessions")}</h2>
            {otherSessions.length > 0 && (
              <button
                onClick={handleRevokeAll}
                disabled={revokingAll}
                className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {revokingAll ? t("security.revokingAll") : t("security.revokeAllSessions")}
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600 mb-4">{t("security.activeSessionsDesc")}</p>

          {loadingSessions ? (
            <div className="text-sm text-slate-500">{t("common.loading")}</div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-slate-500">{t("security.noOtherSessions")}</div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    session.isCurrent
                      ? "border-green-200 bg-green-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getDeviceIcon(session.userAgent)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {session.userAgent
                            ? session.userAgent.substring(0, 60) + (session.userAgent.length > 60 ? "..." : "")
                            : t("devices.unknownDevice")}
                        </span>
                        {session.isCurrent && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                            {t("security.currentSession")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5" suppressHydrationWarning>
                        {session.ip && <span>{session.ip} &middot; </span>}
                        <span>{t("security.loginAt")}: {formatDate(session.createdAt)}</span>
                        <span> &middot; {t("security.lastActive")}: {formatDate(session.lastSeenAt)}</span>
                      </div>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      {t("security.revokeSession")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Site ID */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">{t("security.siteId")}</h2>
          <div className="flex gap-2">
            <code className="flex-1 px-4 py-2 bg-slate-50 rounded border border-slate-200 text-sm font-mono">
              {security.siteId}
            </code>
            <button
              onClick={copySiteId}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
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

        {/* Allowed Domains */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            {t("security.allowedDomains")}
          </h2>
          <div className="space-y-2 mb-4">
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
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-sm disabled:bg-slate-100"
                />
                {canEdit && (
                  <button
                    onClick={() => handleRemoveDomain(index)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
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
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Plus size={16} />
              {t("security.addDomain")}
            </button>
          )}
        </div>

        {/* Localhost Toggle */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                {t("security.allowLocalhost")}
              </h3>
              <p className="text-sm text-slate-600">
                {t("security.allowLocalhostDesc")}
              </p>
            </div>
            <input
              type="checkbox"
              checked={security.allowLocalhost}
              disabled={!canEdit}
              onChange={(e) =>
                setSecurity({ ...security, allowLocalhost: e.target.checked })
              }
              className="w-12 h-6 rounded-full appearance-none bg-slate-200 relative cursor-pointer transition-colors checked:bg-green-500 disabled:cursor-not-allowed"
              style={{ WebkitAppearance: "none" }}
            />
          </div>
        </div>

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
          >
            {saving ? t("common.saving") : t("portal.saveSecuritySettings")}
          </button>
        )}

        {canRotate && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              {t("portal.rotateSiteId")}
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              {t("portal.rotateSiteIdSubtitle")}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={rotateInput}
                onChange={(e) => setRotateInput(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="ROTATE"
              />
              <button
                onClick={handleRotate}
                disabled={rotateInput !== "ROTATE"}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300"
              >
                {t("portal.rotate")}
              </button>
            </div>
          </div>
        )}

        {/* Emergency Access Token — owner only */}
        {user?.role === "owner" && (
          <EmergencyTokenSection />
        )}
      </div>
    </PortalLayout>
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
        setEmergencyError(data?.error as string || "Failed to generate");
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
    <div className="bg-white rounded-lg border border-amber-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">{t("emergency.title")}</h2>
      <p className="text-sm text-slate-600 mb-4">{t("emergency.description")}</p>

      {emergencyError && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800 font-medium mb-2">{t("emergency.warning")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white px-3 py-2 rounded border border-amber-300 font-mono break-all select-all">
                {generatedToken}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1"
              >
                {copied ? <><Check size={14} /> {t("emergency.copied")}</> : <><Copy size={14} /> {t("emergency.copy")}</>}
              </button>
            </div>
          </div>
          {cooldownUntil && (
            <p className="text-xs text-slate-500" suppressHydrationWarning>
              {t("emergency.cooldown")}: {new Date(cooldownUntil).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:bg-amber-300"
        >
          {generating ? t("emergency.generating") : t("emergency.generate")}
        </button>
      )}
    </div>
  );
}
