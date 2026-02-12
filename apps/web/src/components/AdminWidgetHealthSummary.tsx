"use client";

import { useI18n } from "@/i18n/I18nContext";

/**
 * AdminWidgetHealthSummary — compact panel for admin dashboard
 * showing global widget health metrics.
 */

export interface WidgetSummaryData {
  totals: {
    orgsTotal: number;
    connectedOrgs: number;
    loadsTotal: number;
    failuresTotal: number;
    domainMismatchTotal: number;
    okCount: number;
    needsAttentionCount: number;
    notConnectedCount: number;
  };
  topByFailures: { orgKey: string; orgName: string; failuresTotal: number; loadsTotal: number; lastSeenAt: string | null }[];
  topByDomainMismatch: { orgKey: string; orgName: string; domainMismatchTotal: number; lastSeenAt: string | null }[];
  lastSeenDistribution: {
    never: number;
    lt1h: number;
    lt24h: number;
    lt7d: number;
    gte7d: number;
  };
  requestId?: string;
}

interface AdminWidgetHealthSummaryProps {
  data: WidgetSummaryData;
  className?: string;
}

export default function AdminWidgetHealthSummary({ data, className = "" }: AdminWidgetHealthSummaryProps) {
  const { t } = useI18n();

  return (
    <div className={`bg-white rounded-xl border border-[#F3E8D8] p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1A1D23]">{t("widgetHealth.adminTitle")}</h3>
        <p className="text-xs text-[#64748B] mt-0.5">{t("widgetHealth.adminSubtitle")}</p>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatusBox label={t("widgetHealth.statusOk")} value={data.totals.okCount} color="green" />
        <StatusBox label={t("widgetHealth.statusNeedsAttention")} value={data.totals.needsAttentionCount} color="amber" />
        <StatusBox label={t("widgetHealth.statusNotConnected")} value={data.totals.notConnectedCount} color="slate" />
      </div>

      {/* Totals grid */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox label={t("widgetHealth.totalOrgs")} value={data.totals.orgsTotal} />
        <StatBox label={t("widgetHealth.connectedOrgs")} value={data.totals.connectedOrgs} />
        <StatBox label={t("widgetHealth.totalLoads")} value={data.totals.loadsTotal} />
        <StatBox label={t("widgetHealth.totalFailures")} value={data.totals.failuresTotal} alert={data.totals.failuresTotal > 0} />
        <StatBox label={t("widgetHealth.totalDomainMismatches")} value={data.totals.domainMismatchTotal} alert={data.totals.domainMismatchTotal > 0} />
      </div>

      {/* Last Seen Distribution */}
      <div className="mb-5">
        <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
          {t("widgetHealth.lastSeenDist")}
        </h4>
        <div className="flex gap-4 text-sm flex-wrap">
          <div>
            <span className="font-semibold text-[#1A1D23]">{data.lastSeenDistribution.never}</span>
            <span className="text-[#64748B] ml-1">{t("widgetHealth.never")}</span>
          </div>
          <div>
            <span className="font-semibold text-[#1A1D23]">{data.lastSeenDistribution.lt1h}</span>
            <span className="text-[#64748B] ml-1">{t("widgetHealth.last1h")}</span>
          </div>
          <div>
            <span className="font-semibold text-[#1A1D23]">{data.lastSeenDistribution.lt24h}</span>
            <span className="text-[#64748B] ml-1">{t("widgetHealth.last24h")}</span>
          </div>
          <div>
            <span className="font-semibold text-[#1A1D23]">{data.lastSeenDistribution.lt7d}</span>
            <span className="text-[#64748B] ml-1">{t("widgetHealth.last7d")}</span>
          </div>
          <div>
            <span className="font-semibold text-[#1A1D23]">{data.lastSeenDistribution.gte7d}</span>
            <span className="text-[#64748B] ml-1">{t("widgetHealth.gte7d")}</span>
          </div>
        </div>
      </div>

      {/* Top by failures (show top 3) */}
      {data.topByFailures.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
            {t("widgetHealth.topFailures")}
          </h4>
          <div className="space-y-1">
            {data.topByFailures.slice(0, 3).map((o) => (
              <div key={o.orgKey} className="flex items-center justify-between text-xs">
                <span className="text-[#334155] font-medium truncate max-w-[150px]">{o.orgName}</span>
                <span className="text-amber-600 font-semibold">{o.failuresTotal} / {o.loadsTotal}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top by domain mismatch (show top 3) */}
      {data.topByDomainMismatch.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
            {t("widgetHealth.topDomainMismatch")}
          </h4>
          <div className="space-y-1">
            {data.topByDomainMismatch.slice(0, 3).map((o) => (
              <div key={o.orgKey} className="flex items-center justify-between text-xs">
                <span className="text-[#334155] font-medium truncate max-w-[150px]">{o.orgName}</span>
                <span className="text-amber-600 font-semibold">{o.domainMismatchTotal}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.totals.loadsTotal === 0 && (
        <p className="text-xs text-[#94A3B8] text-center py-4">{t("widgetHealth.noData")}</p>
      )}
    </div>
  );
}

function StatusBox({ label, value, color }: { label: string; value: number; color: "green" | "amber" | "slate" }) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-[#FFFBF5] text-[#475569] border-[#F3E8D8]",
  };
  return (
    <div className={`rounded-lg p-3 border ${colors[color]}`}>
      <p className="text-xs mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function StatBox({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="bg-[#FFFBF5] rounded-lg p-3">
      <p className="text-xs text-[#64748B] mb-1">{label}</p>
      <p className={`text-xl font-bold ${alert ? "text-amber-600" : "text-[#1A1D23]"}`} suppressHydrationWarning>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
