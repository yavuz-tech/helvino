"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import {
  Download,
  Search,
  X as XIcon,
  ChevronDown,
  ChevronLeft,
  ShieldCheck,
  ListFilter,
  Clock3,
  Activity,
  RefreshCw,
  FileJson,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import { useHydrated } from "@/hooks/useHydrated";
import { p } from "@/styles/theme";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

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
  security: "bg-rose-100 text-rose-700 border border-rose-200",
  billing: "bg-amber-100 text-amber-700 border border-amber-200",
  usage: "bg-blue-100 text-blue-700 border border-blue-200",
  widget: "bg-violet-100 text-violet-700 border border-violet-200",
  team: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  org: "bg-slate-100 text-slate-700",
  mfa: "bg-indigo-100 text-indigo-700 border border-indigo-200",
};

function getActionColor(action: string): string {
  const prefix = action.split(".")[0];
  return ACTION_COLORS[prefix] || "bg-slate-100 text-slate-600 border border-slate-200";
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

  const activeFilterCount = useMemo(
    () => [filterAction, filterActor, filterFrom, filterTo].filter(Boolean).length,
    [filterAction, filterActor, filterFrom, filterTo]
  );

  const securityEvents = useMemo(
    () => entries.filter((entry) => entry.action.startsWith("security")).length,
    [entries]
  );

  const latestEvent = entries[0];
  const latestEventLabel = latestEvent
    ? formatDate(latestEvent.createdAt, hydrated)
    : t("common.noData");

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
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(err instanceof Error ? err.message : t("common.error"));
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
    <div className="relative mx-auto max-w-7xl space-y-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-52 w-52 -translate-x-1/2 rounded-full bg-violet-200/30 blur-3xl" />
      <Link
        href="/portal"
        className="group mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
        {t("portalOnboarding.backToDashboard")}
      </Link>

      <PageHeader
        title={t("audit.title")}
        subtitle={t("audit.subtitle")}
        badge={activeFilterCount > 0 ? t("audit.filters.active") : undefined}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => fetchEntries()} className={p.btnSecondary}>
              <RefreshCw size={14} />
              {t("common.refresh")}
            </button>
            <button onClick={handleExportCsv} className={p.btnPrimary}>
              <Download size={14} />
              {t("audit.exportCsv")}
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-6 md:gap-7 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-blue-200/70 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/70 p-5">
          <div className="mb-3 flex items-start justify-between">
            <span className={`${p.iconSm} ${p.iconBlue}`}>
              <Activity size={15} />
            </span>
            <Sparkles size={14} className="text-blue-400" />
          </div>
          <p className={p.overline}>{t("audit.stats.total")}</p>
          <p className="mt-1.5 text-[24px] font-semibold tracking-tight text-slate-900">{entries.length}</p>
        </Card>

        <Card className="border-violet-200/70 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/70 p-5">
          <div className="mb-3 flex items-start justify-between">
            <span className={`${p.iconSm} ${p.iconViolet}`}>
              <ListFilter size={15} />
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
              {t("audit.filters.active")}
            </span>
          </div>
          <p className={p.overline}>{t("audit.stats.filters")}</p>
          <p className="mt-1.5 text-[24px] font-semibold tracking-tight text-slate-900">{activeFilterCount}</p>
        </Card>

        <Card className="border-rose-200/70 bg-gradient-to-br from-rose-50/80 via-white to-orange-50/70 p-5">
          <div className="mb-3 flex items-start justify-between">
            <span className={`${p.iconSm} ${p.iconRose}`}>
              <ShieldCheck size={15} />
            </span>
            <Sparkles size={14} className="text-rose-400" />
          </div>
          <p className={p.overline}>{t("audit.stats.security")}</p>
          <p className="mt-1.5 text-[24px] font-semibold tracking-tight text-slate-900">{securityEvents}</p>
        </Card>

        <Card className="border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-white to-cyan-50/70 p-5">
          <div className="mb-3 flex items-start justify-between">
            <span className={`${p.iconSm} ${p.iconIndigo}`}>
              <Clock3 size={15} />
            </span>
          </div>
          <p className={p.overline}>{t("audit.stats.lastEvent")}</p>
          <p className="mt-1.5 text-[18px] font-semibold tracking-tight text-slate-900">{latestEventLabel}</p>
        </Card>
      </div>

      <Card className="mt-1 border-violet-200/70 bg-gradient-to-br from-white via-violet-50/30 to-indigo-50/40">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`${p.iconSm} ${p.iconViolet}`}>
              <ListFilter size={15} />
            </span>
            <div>
              <p className={p.h3}>{t("audit.filterAction")}</p>
              <p className={p.caption}>{t("audit.filters.activeCount", { count: String(activeFilterCount) })}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={p.label}>{t("audit.filters.action")}</label>
            <input
              type="text"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              placeholder={t("audit.filters.actionPlaceholder")}
              className={`${p.input} mt-1.5`}
            />
          </div>
          <div>
            <label className={p.label}>{t("audit.filters.actor")}</label>
            <input
              type="text"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              placeholder={t("audit.filters.actorPlaceholder")}
              className={`${p.input} mt-1.5`}
            />
          </div>
          <div>
            <label className={p.label}>{t("audit.filters.from")}</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className={`${p.input} mt-1.5`}
            />
          </div>
          <div>
            <label className={p.label}>{t("audit.filters.to")}</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className={`${p.input} mt-1.5`}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={handleApplyFilters} className={p.btnPrimary}>
            <Search size={14} />
            {t("audit.filters.apply")}
          </button>
          <button onClick={handleClearFilters} className={p.btnSecondary}>
            <XIcon size={14} />
            {t("audit.filters.clear")}
          </button>
        </div>
      </Card>

      <Card noPadding className="overflow-hidden border-slate-200/80 shadow-[0_10px_35px_rgba(30,41,59,0.06)]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-slate-800" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center">
            <p className={p.body}>{t("audit.empty")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("audit.table.createdAt")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("audit.table.action")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("audit.table.actor")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("audit.table.ip")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("audit.table.requestId")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("audit.table.details")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap" suppressHydrationWarning>
                        {formatDate(entry.createdAt, hydrated)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getActionColor(entry.action)}`}
                        >
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {entry.actor.email || entry.actor.id || t("audit.table.unknownActor")}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">
                        {entry.ip || t("audit.table.noIp")}
                      </td>
                      <td className="max-w-[240px] truncate px-5 py-3 font-mono text-xs text-slate-400">
                        {entry.requestId || t("audit.table.noRequestId")}
                      </td>
                      <td className="px-5 py-3">
                        <details>
                          <summary className="cursor-pointer list-none text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                            {t("audit.table.details")}
                          </summary>
                          <div className="mt-2 max-w-[360px] rounded-lg border border-slate-200 bg-slate-50 p-2">
                            {entry.meta ? (
                              <pre className="max-h-28 overflow-auto text-[11px] leading-5 text-slate-600">
                                {JSON.stringify(entry.meta, null, 2)}
                              </pre>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                <FileJson size={12} />
                                {t("audit.table.noMeta")}
                              </div>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {nextCursor && (
              <div className="border-t border-slate-200 p-4 text-center">
                <button
                  onClick={() => fetchEntries(nextCursor, true)}
                  disabled={loadingMore}
                  className={p.btnSecondary}
                >
                  {loadingMore ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-slate-600" />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  {t("audit.loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
