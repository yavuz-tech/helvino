"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBanner from "@/components/ErrorBanner";
import { useI18n } from "@/i18n/I18nContext";
import {
  ArrowLeft,
  Building2,
  Users,
  Shield,
  Activity,
  Ban,
  CheckCircle2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface OrgDetail {
  orgKey: string;
  displayName: string;
  siteId: string;
  isActive: boolean;
  createdVia: string;
  createdAt: string;
  planKey: string;
  billingStatus: string;
  trialStatus: string;
  trialEndsAt: string | null;
  lastWidgetSeenAt: string | null;
  billingLockedAt: string | null;
  allowedDomains: string[];
  allowLocalhost: boolean;
  widgetEnabled: boolean;
  writeEnabled: boolean;
  aiEnabled: boolean;
  ownerUserId: string | null;
  ownerEmail: string | null;
  users: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    emailVerified: boolean;
    mfaEnabled: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }[];
  usage: { conversationsCreated: number; messagesSent: number } | null;
  limits: { maxConversationsPerMonth: number; maxMessagesPerMonth: number } | null;
  widgetHealth: {
    loadsTotal: number;
    failuresTotal: number;
    domainMismatchTotal: number;
    lastSeenAt: string | null;
  };
  requestId?: string;
}

export default function OrgDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgKey = params.orgKey as string;
  const { t } = useI18n();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      const u = await checkAuth();
      if (!u) { router.push("/login"); return; }
      setUser(u);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/internal/orgs/directory/${orgKey}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRequestId(data?.requestId || res.headers.get("x-request-id"));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrg(data);
      setRequestId(data.requestId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [orgKey, t]);

  useEffect(() => {
    if (!authLoading) fetchOrg();
  }, [authLoading, fetchOrg]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleDeactivate = async () => {
    if (!confirm(t("orgDir.deactivateConfirm"))) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/internal/orgs/${orgKey}/deactivate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
      }
      await fetchOrg();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!confirm(t("orgDir.reactivateConfirm"))) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/internal/orgs/${orgKey}/reactivate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
      }
      await fetchOrg();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      {/* Back link */}
      <Link
        href="/dashboard/orgs"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft size={16} />
        {t("orgDir.backToList")}
      </Link>

      {error && (
        <ErrorBanner
          message={error}
          requestId={requestId}
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      )}

      {!org ? (
        <div className="text-center py-12 text-slate-500">{t("common.error")}</div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <Building2 size={24} className="text-slate-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{org.displayName}</h1>
                <p className="text-sm text-slate-500 font-mono">{org.orgKey}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                org.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                {org.isActive ? t("orgDir.active") : t("orgDir.inactive")}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                org.createdVia === "self_serve" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
              }`}>
                {org.createdVia === "self_serve" ? t("orgDir.selfServe") : t("orgDir.admin")}
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Overview Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Activity size={18} />
                {t("orgDir.overview")}
              </h2>
              <div className="space-y-3 text-sm">
                <Row label={t("orgDir.plan")} value={<span className="uppercase font-medium">{org.planKey}</span>} />
                <Row label={t("orgDir.billingStatus")} value={org.billingStatus} />
                <Row label={t("orgDir.trialStatus")} value={org.trialStatus} />
                <Row label={t("orgDir.ownerEmail")} value={org.ownerEmail || "—"} />
                <Row label="Site ID" value={<span className="font-mono text-xs">{org.siteId}</span>} />
                <Row label={t("orgDir.createdAt")} value={<span suppressHydrationWarning>{new Date(org.createdAt).toLocaleDateString()}</span>} />
                <Row label={t("orgDir.lastWidget")} value={
                  <span suppressHydrationWarning>{org.lastWidgetSeenAt ? new Date(org.lastWidgetSeenAt).toLocaleDateString() : "—"}</span>
                } />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Shield size={18} />
                {t("orgDir.quickActions")}
              </h2>
              <div className="space-y-3">
                {org.isActive ? (
                  <button
                    onClick={handleDeactivate}
                    disabled={actionLoading}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <Ban size={16} />
                    {t("orgDir.deactivate")}
                  </button>
                ) : (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {t("orgDir.reactivate")}
                  </button>
                )}
              </div>

              {/* Usage Summary */}
              {org.usage && org.limits && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">{t("orgDir.usage")}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t("orgDir.conversations")}</span>
                      <span className="font-medium">
                        {org.usage.conversationsCreated} / {org.limits.maxConversationsPerMonth}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t("orgDir.messages")}</span>
                      <span className="font-medium">
                        {org.usage.messagesSent} / {org.limits.maxMessagesPerMonth}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Users size={18} />
                {t("orgDir.users")} ({org.users.length})
              </h2>
              {org.users.length === 0 ? (
                <p className="text-sm text-slate-500">{t("common.noData")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 font-medium text-slate-600">{t("auth.email")}</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">{t("team.role")}</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">{t("common.status")}</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">MFA</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600" suppressHydrationWarning>{t("orgDir.createdAt")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {org.users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-900">{u.email}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600 uppercase">
                              {u.role}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            }`}>
                              {u.isActive ? t("orgDir.active") : t("orgDir.inactive")}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              u.mfaEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              {u.mfaEnabled ? "ON" : "OFF"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500" suppressHydrationWarning>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Widget Health */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Activity size={18} />
                {t("orgDir.health")}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <StatCard label={t("orgDir.loads")} value={org.widgetHealth.loadsTotal} />
                <StatCard label={t("orgDir.failures")} value={org.widgetHealth.failuresTotal} variant={org.widgetHealth.failuresTotal > 0 ? "warn" : "default"} />
                <StatCard label={t("orgDir.domainMismatch")} value={org.widgetHealth.domainMismatchTotal} variant={org.widgetHealth.domainMismatchTotal > 0 ? "warn" : "default"} />
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

function StatCard({ label, value, variant = "default" }: { label: string; value: number; variant?: "default" | "warn" }) {
  return (
    <div className={`p-4 rounded-lg border ${
      variant === "warn" && value > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
    }`}>
      <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
