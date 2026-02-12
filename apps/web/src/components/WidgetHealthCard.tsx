"use client";

import { useI18n } from "@/i18n/I18nContext";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * WidgetHealthCard — displays widget health metrics on the portal overview.
 *
 * Status:
 *   - "OK": everything operational
 *   - "NEEDS_ATTENTION": failures or domain mismatches
 *   - "NOT_CONNECTED": widget hasn't loaded yet
 */

export interface WidgetHealthData {
  status: "OK" | "NEEDS_ATTENTION" | "NOT_CONNECTED";
  lastSeenAt: string | null;
  loads: { total: number; failures: number };
  domainMismatch: { total: number };
  responseTime: { p50: number | null; p95: number | null };
  requestId?: string;
}

interface WidgetHealthCardProps {
  data: WidgetHealthData;
  className?: string;
}

export default function WidgetHealthCard({ data, className = "" }: WidgetHealthCardProps) {
  const { t } = useI18n();
  const hydrated = useHydrated();

  const statusConfig = {
    OK: {
      label: t("widgetHealth.statusOk"),
      color: "bg-green-100 text-green-800",
      dot: "bg-green-500",
    },
    NEEDS_ATTENTION: {
      label: t("widgetHealth.statusNeedsAttention"),
      color: "bg-amber-100 text-amber-800",
      dot: "bg-amber-500",
    },
    NOT_CONNECTED: {
      label: t("widgetHealth.statusNotConnected"),
      color: "bg-amber-50/70 text-amber-700",
      dot: "bg-amber-400",
    },
  };

  const cfg = statusConfig[data.status];

  const formatLastSeen = (iso: string | null) => {
    if (!iso) return t("widgetHealth.never");
    if (!hydrated) return "…";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "< 1 min";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className={`bg-white rounded-xl border border-[#F3E8D8] p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-amber-900">{t("widgetHealth.title")}</h3>
          <p className="text-xs text-amber-600 mt-0.5">{t("widgetHealth.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricItem
          label={t("widgetHealth.loads")}
          value={hydrated ? data.loads.total.toLocaleString() : String(data.loads.total)}
        />
        <MetricItem
          label={t("widgetHealth.failures")}
          value={hydrated ? data.loads.failures.toLocaleString() : String(data.loads.failures)}
          alert={data.loads.failures > 0}
        />
        <MetricItem
          label={t("widgetHealth.domainMismatch")}
          value={hydrated ? data.domainMismatch.total.toLocaleString() : String(data.domainMismatch.total)}
          alert={data.domainMismatch.total > 0}
        />
        <MetricItem
          label={t("widgetHealth.lastSeen")}
          value={formatLastSeen(data.lastSeenAt)}
        />
      </div>

      {/* Response time */}
      {(data.responseTime.p50 !== null || data.responseTime.p95 !== null) && (
        <div className="mt-4 pt-4 border-t border-amber-100">
          <h4 className="text-xs font-medium text-amber-600 mb-2">{t("widgetHealth.responseTime")}</h4>
          <div className="flex gap-6">
            {data.responseTime.p50 !== null && (
              <div>
                <span className="text-lg font-semibold text-amber-900">{data.responseTime.p50}</span>
                <span className="text-xs text-amber-500 ml-1">{t("widgetHealth.ms")}</span>
                <p className="text-xs text-amber-600">{t("widgetHealth.p50")}</p>
              </div>
            )}
            {data.responseTime.p95 !== null && (
              <div>
                <span className="text-lg font-semibold text-amber-900">{data.responseTime.p95}</span>
                <span className="text-xs text-amber-500 ml-1">{t("widgetHealth.ms")}</span>
                <p className="text-xs text-amber-600">{t("widgetHealth.p95")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-xs text-amber-600">{label}</p>
      <p className={`text-lg font-semibold ${alert ? "text-amber-600" : "text-amber-900"}`}>
        {value}
      </p>
    </div>
  );
}
