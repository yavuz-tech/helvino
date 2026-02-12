"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api";
import { useI18n } from "@/i18n/I18nContext";
import { AlertTriangle, Activity, Shield } from "lucide-react";

interface ActionCount {
  action: string;
  count: number;
}

interface AuditSummaryData {
  last24h: {
    total: number;
    byActionTopN: ActionCount[];
  };
  suspiciousTopN: ActionCount[];
  requestId?: string;
}

export default function AdminAuditSummary({
  className = "",
}: {
  className?: string;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<AuditSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/internal/metrics/audit-summary");
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className={`bg-white border border-[#F3E8D8] rounded-xl p-6 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-amber-100 rounded w-48" />
          <div className="h-4 bg-amber-100 rounded w-32" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`bg-white border border-[#F3E8D8] rounded-xl p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-[#475569]" />
        <h3 className="text-base font-semibold text-[#1A1D23]">
          {t("admin.auditSummary.title")}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total events */}
        <div className="bg-[#FFFBF5] rounded-lg p-4">
          <div className="flex items-center gap-2 text-[#64748B] text-xs font-medium mb-1">
            <Activity size={14} />
            {t("admin.auditSummary.last24h")}
          </div>
          <p className="text-2xl font-bold text-[#1A1D23]">{data.last24h.total}</p>
        </div>

        {/* Top actions */}
        <div className="bg-[#FFFBF5] rounded-lg p-4">
          <div className="text-[#64748B] text-xs font-medium mb-2">
            {t("admin.auditSummary.topActions")}
          </div>
          {data.last24h.byActionTopN.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">—</p>
          ) : (
            <ul className="space-y-1">
              {data.last24h.byActionTopN.slice(0, 5).map((a) => (
                <li
                  key={a.action}
                  className="flex justify-between text-xs text-[#334155]"
                >
                  <span className="truncate">{a.action}</span>
                  <span className="font-mono font-medium ml-2">{a.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Suspicious */}
        <div className="bg-[#FFFBF5] rounded-lg p-4">
          <div className="flex items-center gap-2 text-[#64748B] text-xs font-medium mb-2">
            <AlertTriangle size={14} className="text-amber-500" />
            {t("admin.auditSummary.suspicious")}
          </div>
          {data.suspiciousTopN.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">—</p>
          ) : (
            <ul className="space-y-1">
              {data.suspiciousTopN.map((a) => (
                <li
                  key={a.action}
                  className="flex justify-between text-xs text-red-700"
                >
                  <span className="truncate">{a.action}</span>
                  <span className="font-mono font-medium ml-2">{a.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
