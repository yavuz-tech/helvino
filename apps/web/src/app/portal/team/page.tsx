"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useStepUp } from "@/contexts/StepUpContext";
import EmptyState from "@/components/EmptyState";
import { ChevronLeft } from "lucide-react";

interface TeamUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export default function PortalTeamPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t, locale } = useI18n();
  const { withStepUp } = useStepUp();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Invite form
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("agent");
  const [invSending, setInvSending] = useState(false);
  const [invSuccess, setInvSuccess] = useState<string | null>(null);
  const [invError, setInvError] = useState<string | null>(null);
  const [invLink, setInvLink] = useState<string | null>(null);
  const [invEmailError, setInvEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Resend invite loading (which invite id is being resent)
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  // Role change
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [roleValue, setRoleValue] = useState("");

  useEffect(() => {
    if (!authLoading) setLoading(false);
  }, [authLoading]);

  const fetchTeam = useCallback(async () => {
    try {
      setError(null);
      setSessionExpired(false);
      const res = await portalApiFetch("/portal/org/users");
      if (res.status === 401) {
        setError(t("auth.sessionExpired"));
        setSessionExpired(true);
        return;
      }
      if (!res.ok) {
        setError(t("team.failedLoad"));
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      setInvites(data.invites || []);
    } catch {
      setError(t("team.networkError"));
    }
  }, [t]);

  useEffect(() => {
    if (!loading && user) fetchTeam();
  }, [loading, user, fetchTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvSending(true);
    setInvError(null);
    setInvSuccess(null);
    setInvLink(null);
    setInvEmailError(null);
    const result = await withStepUp(() =>
      portalApiFetch("/portal/org/users/invite", {
        method: "POST",
        body: JSON.stringify({ email: invEmail, role: invRole, locale }),
      }),
      "portal"
    );
    if (result.cancelled) { setInvSending(false); return; }
    if (!result.ok) {
      const d = result.data as Record<string, string> | undefined;
      setInvError(d?.error || t("team.failedInvite"));
    } else {
      const d = result.data as Record<string, unknown> | undefined;
      const emailSent = d?.emailSent as boolean | undefined;
      const emailError = d?.emailError as string | undefined;
      if (emailSent === false) {
        setInvSuccess(null);
        setInvEmailError(emailError || t("team.inviteCreatedEmailFailed"));
      } else {
        setInvSuccess(t("team.inviteSent"));
        setInvEmailError(null);
      }
      if (d?.inviteLink) setInvLink(d.inviteLink as string);
      setInvEmail("");
      fetchTeam();
    }
    setInvSending(false);
  };

  const handleResend = async (inviteId: string) => {
    setResendingInviteId(inviteId);
    setInvError(null);
    setInvSuccess(null);
    try {
      const result = await withStepUp(() =>
        portalApiFetch("/portal/org/users/invite/resend", {
          method: "POST",
          body: JSON.stringify({ inviteId, locale }),
        }),
        "portal"
      );
      if (result.cancelled) return;
      if (result.ok) {
        const d = result.data as Record<string, string> | undefined;
        if (d?.inviteLink) setInvLink(d.inviteLink);
        setInvSuccess(t("team.inviteSent"));
        fetchTeam();
      } else {
        setInvError(result.error || t("team.failedInvite"));
      }
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm(t("team.confirmRevoke"))) return;
    const result = await withStepUp(() =>
      portalApiFetch("/portal/org/users/invite/revoke", {
        method: "POST",
        body: JSON.stringify({ inviteId }),
      }),
      "portal"
    );
    if (result.cancelled) return;
    fetchTeam();
  };

  const handleDeactivate = async (userId: string, currentActive: boolean) => {
    if (!currentActive) {
      const result = await withStepUp(() =>
        portalApiFetch("/portal/org/users/deactivate", {
          method: "POST",
          body: JSON.stringify({ userId, active: true }),
        }),
        "portal"
      );
      if (!result.cancelled) fetchTeam();
      return;
    }
    if (!confirm(t("team.confirmDeactivate"))) return;
    const result = await withStepUp(() =>
      portalApiFetch("/portal/org/users/deactivate", {
        method: "POST",
        body: JSON.stringify({ userId, active: false }),
      }),
      "portal"
    );
    if (!result.cancelled) fetchTeam();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const result = await withStepUp(() =>
      portalApiFetch("/portal/org/users/role", {
        method: "POST",
        body: JSON.stringify({ userId, role: newRole }),
      }),
      "portal"
    );
    if (result.cancelled) { setRoleUserId(null); return; }
    if (!result.ok) {
      const d = result.data as Record<string, string> | undefined;
      alert(d?.error || t("team.failedAction"));
    }
    setRoleUserId(null);
    fetchTeam();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-purple-100 text-purple-800",
      admin: "bg-blue-100 text-blue-800",
      agent: "bg-slate-100 text-slate-700",
    };
    const labels: Record<string, string> = {
      owner: t("team.owner"),
      admin: t("team.admin"),
      agent: t("team.agent"),
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[role] || colors.agent}`}>
        {labels[role] || role}
      </span>
    );
  };

  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";
  const isOwner = user?.role === "owner";

  if (loading) {
    return (
      <div className="text-slate-600">{t("common.loading")}</div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#1A1A2E] transition-colors mb-3 group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            {t("portalOnboarding.backToDashboard")}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{t("team.title")}</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            <p>{error}</p>
            {sessionExpired && (
              <Link href="/portal/login" className="mt-3 inline-block text-sm font-medium text-red-700 hover:text-red-900 underline">
                {t("auth.signIn")}
              </Link>
            )}
          </div>
        )}

        {/* ── Invite Form ── */}
        {isOwnerOrAdmin && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("team.inviteMember")}</h2>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder={t("team.inviteEmail")}
                required
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
              />
              <select
                value={invRole}
                onChange={(e) => setInvRole(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm bg-white"
              >
                <option value="agent">{t("team.agent")}</option>
                <option value="admin">{t("team.admin")}</option>
              </select>
              <button
                type="submit"
                disabled={invSending}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium disabled:bg-slate-400"
              >
                {invSending ? t("team.sending") : t("team.sendInvite")}
              </button>
            </form>
            {invError && (
              <p className="mt-3 text-sm text-red-600">{invError}</p>
            )}
            {invSuccess && (
              <p className="mt-3 text-sm text-green-600">{invSuccess}</p>
            )}
            {invEmailError && (
              <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-sm font-medium text-amber-800">{t("team.inviteCreatedEmailFailed")}</p>
                <p className="mt-1 text-xs text-amber-700 font-mono break-all" title={invEmailError}>{invEmailError}</p>
              </div>
            )}
            {invLink && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">{t("team.inviteLink")}:</span>
                <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono truncate max-w-md">
                  {invLink}
                </code>
                <button
                  onClick={() => copyToClipboard(invLink)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  {copied ? t("team.copied") : t("team.copyLink")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Team Members Table ── */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{t("team.members")}</h2>
          </div>
          {users.length === 0 ? (
            <EmptyState
              icon="👥"
              title={t("empty.team")}
              description={t("empty.teamDesc")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-6 py-3 font-medium">{t("team.email")}</th>
                    <th className="px-6 py-3 font-medium">{t("team.role")}</th>
                    <th className="px-6 py-3 font-medium">{t("team.status")}</th>
                    <th className="px-6 py-3 font-medium">{t("team.lastLogin")}</th>
                    {isOwnerOrAdmin && <th className="px-6 py-3 font-medium">{t("team.actions")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">{u.email}</td>
                      <td className="px-6 py-3">
                        {roleUserId === u.id ? (
                          <select
                            value={roleValue}
                            onChange={(e) => setRoleValue(e.target.value)}
                            onBlur={() => {
                              if (roleValue !== u.role) handleRoleChange(u.id, roleValue);
                              else setRoleUserId(null);
                            }}
                            autoFocus
                            className="text-xs border border-slate-300 rounded px-2 py-1"
                          >
                            <option value="owner">{t("team.owner")}</option>
                            <option value="admin">{t("team.admin")}</option>
                            <option value="agent">{t("team.agent")}</option>
                          </select>
                        ) : (
                          <span
                            onClick={() => { if (isOwner && u.id !== user?.id) { setRoleUserId(u.id); setRoleValue(u.role); } }}
                            className={isOwner && u.id !== user?.id ? "cursor-pointer" : ""}
                          >
                            {roleBadge(u.role)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {u.isActive ? t("team.active") : t("team.inactive")}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500 text-xs" suppressHydrationWarning>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : t("team.never")}
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="px-6 py-3">
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleDeactivate(u.id, u.isActive)}
                              className="text-xs text-slate-600 hover:text-slate-900 underline"
                            >
                              {u.isActive ? t("team.deactivate") : t("team.reactivate")}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pending Invites ── */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{t("team.pendingInvites")}</h2>
          </div>
          {invites.length === 0 ? (
            <EmptyState
              icon="✉️"
              title={t("empty.invites")}
              description={t("empty.invitesDesc")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-6 py-3 font-medium">{t("team.email")}</th>
                    <th className="px-6 py-3 font-medium">{t("team.role")}</th>
                    <th className="px-6 py-3 font-medium">{t("team.expiresAt")}</th>
                    {isOwnerOrAdmin && <th className="px-6 py-3 font-medium">{t("team.actions")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">{inv.email}</td>
                      <td className="px-6 py-3">{roleBadge(inv.role)}</td>
                      <td className="px-6 py-3 text-slate-500 text-xs" suppressHydrationWarning>
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="px-6 py-3 flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleResend(inv.id)}
                            disabled={resendingInviteId === inv.id}
                            className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {resendingInviteId === inv.id ? t("common.loading") : t("team.resend")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv.id)}
                            className="text-xs text-red-600 hover:text-red-800 underline"
                          >
                            {t("team.revoke")}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
