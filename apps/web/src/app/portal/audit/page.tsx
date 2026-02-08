"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Download, Search, X as XIcon, ChevronDown, ChevronLeft } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import { useHydrated } from "@/hooks/useHydrated";

/* ────────── Types ────────── */

interface AuditActor {
  id: string;
  email?: string;
}

interface AuditEntry {
  id: string;
  createdAt: string;
  action: string;
  actor: AuditActor;
  ip: string | null;
  requestId: string | null;
  meta: Record<string, unknown> | null;
}

/* ────────── Helpers ────────── */

function formatDate(iso: string, hydrated: boolean): string {
  if (!hydrated) return iso.replace("T", " ").slice(0, 19);
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const ACTION_COLORS: Record<string, string> = {
  security: "bg-red-100 text-red-700",
  billing: "bg-amber-100 text-amber-700",
  usage: "bg-blue-100 text-blue-700",
  widget: "bg-purple-100 text-purple-700",
  team: "bg-emerald-100 text-emerald-700",
  org: "bg-slate-100 text-slate-700",
  mfa: "bg-orange-100 text-orange-700",
};

function getActionColor(action: string): string {
  const prefix = action.split(".")[0];
  return ACTION_COLORS[prefix] || "bg-slate-100 text-slate-600";
}

/* ────────── Main ────────── */

export default function PortalAuditPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const hydrated = useHydrated();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [filterAction, setFilterAction] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Fetch
  const fetchEntries = useCallback(
    async (cursor?: string, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "25");
        if (cursor) params.set("cursor", cursor);
        if (filterAction) params.set("action", filterAction);
        if (filterActor) params.set("actorUserId", filterActor);
        if (filterFrom) params.set("from", new Date(filterFrom).toISOString());
        if (filterTo) params.set("to", new Date(filterTo).toISOString());

        const res = await portalApiFetch(`/portal/audit-logs?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (append) {
          setEntries((prev) => [...prev, ...data.items]);
        } else {
          setEntries(data.items || []);
        }
        setNextCursor(data.nextCursor);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterAction, filterActor, filterFrom, filterTo]
  );

  useEffect(() => {
    if (!authLoading && user) fetchEntries();
  }, [authLoading, user, fetchEntries]);

  const handleApplyFilters = () => fetchEntries();
  const handleClearFilters = () => {
    setFilterAction("");
    setFilterActor("");
    setFilterFrom("");
    setFilterTo("");
    // Will refetch via useEffect dependency changes
  };

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set("action", filterAction);
      if (filterActor) params.set("actorUserId", filterActor);
      if (filterFrom) params.set("from", new Date(filterFrom).toISOString());
      if (filterTo) params.set("to", new Date(filterTo).toISOString());

      const res = await portalApiFetch(
        `/portal/audit-logs/export.csv?${params.toString()}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-logs.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#1A1A2E] transition-colors mb-3 group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              {t("portalOnboarding.backToDashboard")}
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">
              {t("audit.title")}
            </h1>
          </div>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={16} />
            {t("audit.exportCsv")}
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t("audit.filters.action")}
              </label>
              <input
                type="text"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                placeholder="e.g. security, billing"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t("audit.filters.actor")}
              </label>
              <input
                type="text"
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                placeholder="email or ID"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t("audit.filters.from")}
              </label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t("audit.filters.to")}
              </label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleApplyFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Search size={14} />
              {t("audit.filters.apply")}
            </button>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <XIcon size={14} />
              {t("audit.filters.clear")}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              {t("audit.empty")}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">
                        {t("audit.table.createdAt")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">
                        {t("audit.table.action")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">
                        {t("audit.table.actor")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">
                        {t("audit.table.ip")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">
                        {t("audit.table.requestId")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td
                          className="px-4 py-3 text-slate-600 whitespace-nowrap"
                          suppressHydrationWarning
                        >
                          {formatDate(entry.createdAt, hydrated)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(
                              entry.action
                            )}`}
                          >
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {entry.actor.email || entry.actor.id}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                          {entry.ip || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs truncate max-w-[120px]">
                          {entry.requestId || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nextCursor && (
                <div className="p-4 border-t border-slate-200 text-center">
                  <button
                    onClick={() => fetchEntries(nextCursor, true)}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600" />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                    {t("audit.loadMore")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
