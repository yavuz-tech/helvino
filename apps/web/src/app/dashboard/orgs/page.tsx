"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import EmptyState from "@/components/EmptyState";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
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
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <PageHeader
        title={t("orgDir.title")}
        subtitle={t("orgDir.subtitle")}
        breadcrumb={t("nav.overview")}
      />

      {/* Search + Count */}
      <div className="mb-8">
        <Card variant="elevated" padding="lg">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("orgDir.searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2.5 border border-amber-200/70 rounded-xl text-sm bg-white placeholder:text-[#94A3B8] focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all duration-150"
              />
            </div>
            <div className="text-sm text-[#475569]">
              {t("orgDir.totalOrgs")}: <span className="font-semibold text-[#1A1D23] font-heading">{total}</span>
            </div>
          </div>
        </Card>
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
        <Card variant="elevated" padding="lg">
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
          </div>
        </Card>
      ) : orgs.length === 0 ? (
        <EmptyState
          icon="🏢"
          title={t("orgDir.noOrgs")}
          description={t("orgDir.noOrgsDesc")}
        />
      ) : (
        <Card className="overflow-hidden p-0" padding="none" variant="elevated">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50/50 border-b border-amber-200/70">
                  <th className="text-left px-5 py-3 font-semibold text-[#94A3B8] uppercase text-[11px] tracking-widest">{t("orgDir.orgName")}</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#94A3B8] uppercase text-[11px] tracking-widest">{t("orgDir.ownerEmail")}</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#94A3B8] uppercase text-[11px] tracking-widest">{t("orgDir.plan")}</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#94A3B8] uppercase text-[11px] tracking-widest">{t("common.status")}</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#94A3B8] uppercase text-[11px] tracking-widest">{t("orgDir.createdVia")}</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#94A3B8] uppercase text-[11px] tracking-widest" suppressHydrationWarning>{t("orgDir.createdAt")}</th>
                  <th className="text-left px-5 py-3 font-semibold text-[#94A3B8] uppercase text-[11px] tracking-widest" suppressHydrationWarning>{t("orgDir.lastWidget")}</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {orgs.map((org) => (
                  <tr
                    key={org.orgKey}
                    className="hover:bg-amber-50/50 cursor-pointer transition-all duration-150"
                    onClick={() => router.push(`/dashboard/orgs/${org.orgKey}`)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center flex-shrink-0">
                          <Building2 size={13} className="text-[#64748B]" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#1A1D23] font-heading">{org.displayName}</div>
                          <div className="text-[11px] text-[#94A3B8] font-mono">{org.orgKey}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#475569]">{org.ownerEmail || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 bg-amber-50 rounded-full text-[11px] font-semibold text-amber-800 uppercase">
                        {org.planKey}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        org.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}>
                        {org.isActive ? t("orgDir.active") : t("orgDir.inactive")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        org.createdVia === "self_serve"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-amber-50/70 text-amber-800"
                      }`}>
                        {org.createdVia === "self_serve" ? t("orgDir.selfServe") : t("orgDir.admin")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#64748B]" suppressHydrationWarning>
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#64748B]" suppressHydrationWarning>
                      {org.lastWidgetSeenAt
                        ? new Date(org.lastWidgetSeenAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <ChevronRight size={14} className="text-amber-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}
