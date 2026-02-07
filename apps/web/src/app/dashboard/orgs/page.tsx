"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import EmptyState from "@/components/EmptyState";
import ErrorBanner from "@/components/ErrorBanner";
import { useI18n } from "@/i18n/I18nContext";
import { Search, ChevronRight, Building2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface OrgListItem {
  orgKey: string;
  displayName: string;
  isActive: boolean;
  createdVia: string;
  createdAt: string;
  planKey: string;
  billingStatus: string;
  trialStatus: string;
  ownerEmail: string | null;
  lastWidgetSeenAt: string | null;
  usageSummary: { widgetLoads: number; widgetFailures: number };
}

export default function OrgDirectoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const verifyAuth = async () => {
      const u = await checkAuth();
      if (!u) { router.push("/login"); return; }
      setUser(u);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("query", debouncedQuery);
      params.set("limit", "100");
      const res = await fetch(`${API_URL}/internal/orgs/directory?${params}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRequestId(data?.requestId || res.headers.get("x-request-id"));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrgs(data.items || []);
      setTotal(data.total || 0);
      setRequestId(data.requestId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, t]);

  useEffect(() => {
    if (!authLoading) fetchOrgs();
  }, [authLoading, fetchOrgs]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("orgDir.title")}</h1>
        <p className="text-sm text-slate-600 mt-1">{t("orgDir.subtitle")}</p>
      </div>

      {/* Search + Count */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("orgDir.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>
        <div className="text-sm text-slate-500">
          {t("orgDir.totalOrgs")}: <span className="font-semibold text-slate-900">{total}</span>
        </div>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          requestId={requestId}
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">{t("common.loading")}</div>
      ) : orgs.length === 0 ? (
        <EmptyState
          icon="🏢"
          title={t("orgDir.noOrgs")}
          description={t("orgDir.noOrgsDesc")}
        />
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t("orgDir.orgName")}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t("orgDir.ownerEmail")}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t("orgDir.plan")}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t("common.status")}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">{t("orgDir.createdVia")}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600" suppressHydrationWarning>{t("orgDir.createdAt")}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600" suppressHydrationWarning>{t("orgDir.lastWidget")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orgs.map((org) => (
                  <tr
                    key={org.orgKey}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/orgs/${org.orgKey}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-slate-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{org.displayName}</div>
                          <div className="text-xs text-slate-500 font-mono">{org.orgKey}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{org.ownerEmail || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-700 uppercase">
                        {org.planKey}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        org.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {org.isActive ? t("orgDir.active") : t("orgDir.inactive")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        org.createdVia === "self_serve"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {org.createdVia === "self_serve" ? t("orgDir.selfServe") : t("orgDir.admin")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500" suppressHydrationWarning>
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500" suppressHydrationWarning>
                      {org.lastWidgetSeenAt
                        ? new Date(org.lastWidgetSeenAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={16} className="text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
