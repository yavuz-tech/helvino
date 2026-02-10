"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useStepUp } from "@/contexts/StepUpContext";
import EmptyState from "@/components/EmptyState";
import { premiumToast } from "@/components/PremiumToast";
import { p } from "@/styles/theme";
import {
  ChevronLeft,
  Users,
  UserPlus,
  Clock3,
  ShieldCheck,
  Mail,
  Link2,
  RefreshCw,
  Ban,
  CheckCircle2,
  Crown,
} from "lucide-react";

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

  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("agent");
  const [invSending, setInvSending] = useState(false);
  const [invLink, setInvLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteLimitState, setInviteLimitState] = useState<{
    current: number;
    maxAgents: number;
  } | null>(null);

  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

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
    const invitedEmail = invEmail.trim();
    setInvSending(true);
    setInvLink(null);
    setInviteLimitState(null);
    const result = await withStepUp(
      () =>
        portalApiFetch("/portal/org/users/invite", {
          method: "POST",
          body: JSON.stringify({ email: invEmail, role: invRole, locale }),
        }),
      "portal"
    );
    if (result.cancelled) {
      setInvSending(false);
      return;
    }
    if (!result.ok) {
      const d = result.data as Record<string, unknown> | undefined;
      const code = typeof d?.code === "string" ? d.code : undefined;
      const current = typeof d?.current === "number" ? d.current : Number.NaN;
      const maxAgents = typeof d?.maxAgents === "number" ? d.maxAgents : Number.NaN;
      if (code === "MAX_AGENTS_REACHED" && Number.isFinite(current) && Number.isFinite(maxAgents)) {
        setInviteLimitState({ current, maxAgents });
      }
      premiumToast.error({
        title: t("team.failedInvite"),
        description: (typeof d?.error === "string" ? d.error : undefined) || t("common.error"),
      });
    } else {
      const d = result.data as Record<string, unknown> | undefined;
      const emailSent = d?.emailSent as boolean | undefined;
      const emailError = d?.emailError as string | undefined;
      if (emailSent === false) {
        premiumToast.warning({
          title: t("team.inviteCreatedEmailFailed"),
          description: emailError || t("common.error"),
          duration: 5000,
        });
      } else {
        premiumToast.success({
          title: t("team.inviteSent"),
          description: invitedEmail || undefined,
        });
      }
      if (d?.inviteLink) setInvLink(d.inviteLink as string);
      setInvEmail("");
      fetchTeam();
    }
    setInvSending(false);
  };

  const handleResend = async (inviteId: string) => {
    setResendingInviteId(inviteId);
    try {
      const result = await withStepUp(
        () =>
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
        premiumToast.success({ title: t("team.inviteSent") });
        fetchTeam();
      } else {
        premiumToast.error({
          title: t("team.failedInvite"),
          description: result.error || t("common.error"),
        });
      }
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm(t("team.confirmRevoke"))) return;
    const result = await withStepUp(
      () =>
        portalApiFetch("/portal/org/users/invite/revoke", {
          method: "POST",
          body: JSON.stringify({ inviteId }),
        }),
      "portal"
    );
    if (result.cancelled) return;
    if (!result.ok) {
      premiumToast.error({ title: t("team.failedAction"), description: t("common.error") });
      return;
    }
    premiumToast.success({ title: t("team.revoke") });
    fetchTeam();
  };

  const handleDeactivate = async (userId: string, currentActive: boolean) => {
    if (!currentActive) {
      const result = await withStepUp(
        () =>
          portalApiFetch("/portal/org/users/deactivate", {
            method: "POST",
            body: JSON.stringify({ userId, active: true }),
          }),
        "portal"
      );
      if (result.cancelled) return;
      if (!result.ok) {
        premiumToast.error({ title: t("team.failedAction"), description: t("common.error") });
        return;
      }
      premiumToast.success({ title: t("team.reactivate") });
      fetchTeam();
      return;
    }
    if (!confirm(t("team.confirmDeactivate"))) return;
    const result = await withStepUp(
      () =>
        portalApiFetch("/portal/org/users/deactivate", {
          method: "POST",
          body: JSON.stringify({ userId, active: false }),
        }),
      "portal"
    );
    if (result.cancelled) return;
    if (!result.ok) {
      premiumToast.error({ title: t("team.failedAction"), description: t("common.error") });
      return;
    }
    premiumToast.success({ title: t("team.deactivate") });
    fetchTeam();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const result = await withStepUp(
      () =>
        portalApiFetch("/portal/org/users/role", {
          method: "POST",
          body: JSON.stringify({ userId, role: newRole }),
        }),
      "portal"
    );
    if (result.cancelled) {
      setRoleUserId(null);
      return;
    }
    if (!result.ok) {
      const d = result.data as Record<string, string> | undefined;
      premiumToast.error({
        title: t("team.failedAction"),
        description: d?.error || t("common.error"),
      });
    } else {
      premiumToast.success({ title: t("portal.saveSettings") });
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
      owner: "bg-violet-100 text-violet-800",
      admin: "bg-blue-100 text-blue-800",
      agent: "bg-slate-100 text-slate-700",
    };
    const labels: Record<string, string> = {
      owner: t("team.owner"),
      admin: t("team.admin"),
      agent: t("team.agent"),
    };
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[role] || colors.agent}`}>
        {labels[role] || role}
      </span>
    );
  };

  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";
  const isOwner = user?.role === "owner";

  const activeUsers = users.filter((u) => u.isActive).length;

  if (loading) {
    return <div className="py-10 text-slate-600">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-6 shadow-[0_16px_45px_rgba(76,29,149,0.14)]">
        <Link
          href="/portal"
          className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:text-indigo-800"
        >
          <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          {t("portalOnboarding.backToDashboard")}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-slate-900">{t("team.title")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("team.members")} • {t("team.pendingInvites")}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck size={13} />
            {t("common.enabled")}
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-indigo-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(79,70,229,0.08)]">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Users size={16} /></div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("team.members")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(5,150,105,0.08)]">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={16} /></div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("team.active")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{activeUsers}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(217,119,6,0.08)]">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Clock3 size={16} /></div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("team.pendingInvites")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{invites.length}</p>
        </div>
        <div className="rounded-2xl border border-fuchsia-200/70 bg-white p-5 shadow-[0_8px_26px_rgba(192,38,211,0.08)]">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-700"><UserPlus size={16} /></div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("team.inviteMember")}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{isOwnerOrAdmin ? t("common.enabled") : t("common.disabled")}</p>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          {sessionExpired && (
            <Link href="/portal/login" className="mt-2 inline-block text-sm font-medium text-red-700 hover:text-red-900 underline">
              {t("auth.signIn")}
            </Link>
          )}
        </div>
      )}

      {isOwnerOrAdmin && (
        <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_8px_30px_rgba(2,6,23,0.06)]">
          <div className="mb-4 flex items-center gap-2.5">
            <span className={`${p.iconSm} ${p.iconBlue}`}><Mail size={15} /></span>
            <h2 className={p.h2}>{t("team.inviteMember")}</h2>
          </div>
          <form onSubmit={handleInvite} className="grid gap-3 lg:grid-cols-[1fr_170px_auto]">
            <input
              type="email"
              value={invEmail}
              onChange={(e) => setInvEmail(e.target.value)}
              placeholder={t("team.inviteEmail")}
              required
              className={p.input}
            />
            <select value={invRole} onChange={(e) => setInvRole(e.target.value)} className={p.select}>
              <option value="agent">{t("team.agent")}</option>
              <option value="admin">{t("team.admin")}</option>
            </select>
            <button type="submit" disabled={invSending} className={p.btnPrimary}>
              {invSending ? t("team.sending") : t("team.sendInvite")}
            </button>
          </form>

          {inviteLimitState && (
            <div className="mt-4 rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-indigo-50 p-4 shadow-[0_8px_24px_rgba(109,40,217,0.10)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-800">
                    <Crown size={14} />
                    {t("team.agentLimitReachedTitle")}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{t("team.agentLimitReachedDesc")}</p>
                  <p className="mt-2 text-xs font-semibold text-violet-700">
                    {t("team.agentLimitUsage")}: {inviteLimitState.current}/{inviteLimitState.maxAgents}
                  </p>
                </div>
                <Link href="/portal/billing" className={p.btnPrimary}>
                  <Crown size={13} />
                  {t("billing.upgradeNow")}
                </Link>
              </div>
            </div>
          )}

          {invLink && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="text-xs text-slate-500">{t("team.inviteLink")}:</span>
              <code className="max-w-md truncate rounded bg-white px-2 py-1 font-mono text-xs text-slate-700">{invLink}</code>
              <button type="button" onClick={() => copyToClipboard(invLink)} className={p.btnSecondary}>
                <Link2 size={13} />
                {copied ? t("team.copied") : t("team.copyLink")}
              </button>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_30px_rgba(2,6,23,0.06)]">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className={p.h2}>{t("team.members")}</h2>
        </div>
        {users.length === 0 ? (
          <EmptyState icon="👥" title={t("empty.team")} description={t("empty.teamDesc")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">{t("team.email")}</th>
                  <th className="px-6 py-3">{t("team.role")}</th>
                  <th className="px-6 py-3">{t("team.status")}</th>
                  <th className="px-6 py-3">{t("team.lastLogin")}</th>
                  {isOwnerOrAdmin && <th className="px-6 py-3">{t("team.actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-medium text-slate-900">{u.email}</td>
                    <td className="px-6 py-3.5">
                      {roleUserId === u.id ? (
                        <select
                          value={roleValue}
                          onChange={(e) => setRoleValue(e.target.value)}
                          onBlur={() => {
                            if (roleValue !== u.role) handleRoleChange(u.id, roleValue);
                            else setRoleUserId(null);
                          }}
                          autoFocus
                          className={p.select}
                        >
                          <option value="owner">{t("team.owner")}</option>
                          <option value="admin">{t("team.admin")}</option>
                          <option value="agent">{t("team.agent")}</option>
                        </select>
                      ) : (
                        <span
                          onClick={() => {
                            if (isOwner && u.id !== user?.id) {
                              setRoleUserId(u.id);
                              setRoleValue(u.role);
                            }
                          }}
                          className={isOwner && u.id !== user?.id ? "cursor-pointer" : ""}
                        >
                          {roleBadge(u.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {u.isActive ? t("team.active") : t("team.inactive")}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500" suppressHydrationWarning>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : t("team.never")}
                    </td>
                    {isOwnerOrAdmin && (
                      <td className="px-6 py-3.5">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeactivate(u.id, u.isActive)}
                            className={u.isActive ? p.btnDanger : p.btnSecondary}
                          >
                            {u.isActive ? <Ban size={13} /> : <RefreshCw size={13} />}
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
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_30px_rgba(2,6,23,0.06)]">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className={p.h2}>{t("team.pendingInvites")}</h2>
        </div>
        {invites.length === 0 ? (
          <EmptyState icon="✉️" title={t("empty.invites")} description={t("empty.invitesDesc")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">{t("team.email")}</th>
                  <th className="px-6 py-3">{t("team.role")}</th>
                  <th className="px-6 py-3">{t("team.expiresAt")}</th>
                  {isOwnerOrAdmin && <th className="px-6 py-3">{t("team.actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invites.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-medium text-slate-900">{inv.email}</td>
                    <td className="px-6 py-3.5">{roleBadge(inv.role)}</td>
                    <td className="px-6 py-3.5 text-xs text-slate-500" suppressHydrationWarning>
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    {isOwnerOrAdmin && (
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleResend(inv.id)}
                            disabled={resendingInviteId === inv.id}
                            className={p.btnSecondary}
                          >
                            <RefreshCw size={13} />
                            {resendingInviteId === inv.id ? t("common.loading") : t("team.resend")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv.id)}
                            className={p.btnDanger}
                          >
                            <Ban size={13} />
                            {t("team.revoke")}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
