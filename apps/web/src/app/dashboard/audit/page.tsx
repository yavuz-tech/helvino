"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import { useOrg } from "@/contexts/OrgContext";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/i18n/I18nContext";

/* ────────── Types ────────── */

interface AuditEntry {
  id: string;
  orgId: string;
  actor: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  "usage.reset": "audit.usageReset",
  "quota.grant": "audit.quotaUpdated",
  "billing.lock": "audit.billingLocked",
  "billing.unlock": "audit.billingUnlocked",
  "webhook.state_change": "audit.webhookStateChange",
};

const ACTION_COLORS: Record<string, string> = {
  "usage.reset": "bg-amber-100 text-amber-800",
  "quota.grant": "bg-purple-100 text-purple-800",
  "billing.lock": "bg-red-100 text-red-800",
  "billing.unlock": "bg-emerald-100 text-emerald-800",
  "webhook.state_change": "bg-amber-50 text-amber-800",
};

/* ────────── Main ────────── */

export default function AuditLogPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { selectedOrg, isLoading: orgLoading } = useOrg();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterActor, setFilterActor] = useState<string>("");
  const [limit, setLimit] = useState(50);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  useEffect(() => {
    const verifyAuth = async () => {
      const u = await checkAuth();
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

  const fetchEntries = useCallback(async () => {
    if (!selectedOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/internal/org/${selectedOrg.key}/audit-log?limit=${limit}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setError(t("audit.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [API_URL, selectedOrg, limit, t]);

  useEffect(() => {
    if (authLoading || orgLoading || !selectedOrg) return;
    fetchEntries();
  }, [authLoading, orgLoading, selectedOrg, fetchEntries]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Derive unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(entries.map((e) => e.action)));

  // Apply client-side filters
  const filtered = entries.filter((e) => {
    if (filterAction !== "all" && e.action !== filterAction) return false;
    if (filterActor && !e.actor.toLowerCase().includes(filterActor.toLowerCase()))
      return false;
    return true;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
        <div className="text-[#475569]">{t("common.checkingAuth")}</div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23] font-heading">{t("audit.title")}</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {selectedOrg
            ? `${t("audit.activityLog")} ${selectedOrg.name} (${selectedOrg.key})`
            : t("common.selectOrg")}
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">{t("common.action")}</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="all">{t("audit.allActions")}</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL_KEYS[a] ? t(ACTION_LABEL_KEYS[a] as import("@/i18n/translations").TranslationKey) : a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">{t("common.actor")}</label>
            <input
              type="text"
              placeholder={t("audit.filterActor")}
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              className="px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">{t("common.limit")}</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <button
            onClick={fetchEntries}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>
      </div>

      {/* Entries */}
        <div className="bg-white rounded-lg border border-[#F3E8D8] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#64748B]">
            {t("audit.loadingAudit")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[#64748B]">
            {entries.length === 0
              ? t("audit.noEntries")
              : t("audit.noMatch")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-200 bg-amber-50/50">
                  <th className="text-left py-3 px-4 font-medium text-[#475569]">
                    {t("common.time")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[#475569]">
                    {t("common.action")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[#475569]">
                    {t("common.actor")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[#475569]">
                    {t("common.details")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-amber-100 last:border-0 hover:bg-amber-50/50"
                  >
                    <td className="py-3 px-4 text-[#475569] whitespace-nowrap" suppressHydrationWarning>
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[entry.action] || "bg-amber-50 text-amber-800"}`}
                      >
                        {ACTION_LABEL_KEYS[entry.action] ? t(ACTION_LABEL_KEYS[entry.action] as import("@/i18n/translations").TranslationKey) : entry.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#334155] font-mono text-xs">
                      {entry.actor}
                    </td>
                    <td className="py-3 px-4 text-[#64748B] text-xs max-w-xs truncate">
                      {entry.details
                        ? JSON.stringify(entry.details).slice(0, 120)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-[#94A3B8]">
        {t("common.showing")} {filtered.length} {t("common.of")} {entries.length} {t("common.entries")}
      </div>
    </DashboardLayout>
  );
}
