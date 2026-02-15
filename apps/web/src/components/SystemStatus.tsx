"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useOrg } from "@/contexts/OrgContext";

interface HealthData {
  ok: boolean;
  db: "ok" | "down";
  redis: "ok" | "down";
  uptimeSec: number;
  timestamp: string;
}

interface MetricsData {
  req_total: number;
  req_2xx: number;
  req_4xx: number;
  req_5xx: number;
  rate_limited_429: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  bootloader_calls: number;
  conversations_posts: number;
  messages_posts: number;
  window_seconds: number;
  timestamp: string;
}

interface OrgSettings {
  ok: boolean;
  org: {
    id: string;
    key: string;
    name: string;
  };
  settings: {
    widgetEnabled: boolean;
    writeEnabled: boolean;
    aiEnabled: boolean;
    primaryColor: string | null;
    messageRetentionDays?: number;
    hardDeleteOnRetention?: boolean;
    lastRetentionRunAt?: string | null;
  };
}

export function SystemStatus() {
  const { t } = useI18n();
  const { selectedOrg } = useOrg();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const ORG_KEY = selectedOrg?.key || process.env.NEXT_PUBLIC_ORG_KEY || "";

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch health (public endpoint)
      const healthRes = await fetch(`${API_URL}/health`);
      const healthData = await healthRes.json();
      setHealth(healthData);

      // Fetch metrics (requires auth cookie)
      try {
        const metricsRes = await fetch(`${API_URL}/metrics`, {
          credentials: "include", // Use cookies instead of x-internal-key
        });

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        } else {
          console.warn("Failed to fetch metrics:", metricsRes.status);
        }
      } catch {
        console.warn("Metrics fetch failed (user may not be authenticated)");
      }

      // Fetch org settings (requires auth cookie + valid org key)
      if (ORG_KEY) {
        try {
          const orgRes = await fetch(`${API_URL}/api/org/${ORG_KEY}/settings`, {
            credentials: "include", // Use cookies instead of x-internal-key
          });

          if (orgRes.ok) {
            const orgData = await orgRes.json();
            setOrgSettings(orgData);
          } else {
            console.warn("Failed to fetch org settings:", orgRes.status);
          }
        } catch {
          console.warn("Org settings fetch failed (user may not be authenticated)");
        }
      }
    } catch (err) {
      console.error("Failed to fetch system status:", err);
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [API_URL, ORG_KEY, t]);

  useEffect(() => {
    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="system-status loading">
        <div className="status-header">
          <h3>{t("common.status")}</h3>
          <span className="status-indicator">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-status error">
        <div className="status-header">
          <h3>{t("common.status")}</h3>
          <span className="status-indicator error">❌ {error}</span>
        </div>
      </div>
    );
  }

  const errorRate = metrics && metrics.req_total > 0
    ? ((metrics.req_5xx / metrics.req_total) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="system-status">
      <div className="status-header">
        <h3>{t("dashboard.systemStatus")}</h3>
        <span className={`status-indicator ${health?.ok ? "ok" : "down"}`}>
          {health?.ok ? `✅ ${t("dashboard.healthy")}` : `❌ ${t("dashboard.down")}`}
        </span>
      </div>

      {/* Health Status */}
      <div className="status-grid">
        <div className={`status-card ${health?.db === "ok" ? "ok" : "down"}`}>
          <div className="status-label">{t("dashboard.database")}</div>
          <div className="status-value">
            {health?.db === "ok" ? "✅ OK" : `❌ ${t("dashboard.down")}`}
          </div>
        </div>

        <div className={`status-card ${health?.redis === "ok" ? "ok" : "down"}`}>
          <div className="status-label">{t("dashboard.redis")}</div>
          <div className="status-value">
            {health?.redis === "ok" ? "✅ OK" : `❌ ${t("dashboard.down")}`}
          </div>
        </div>

        <div className="status-card">
          <div className="status-label">{t("dashboard.uptime")}</div>
          <div className="status-value">
            {health?.uptimeSec
              ? `${Math.floor(health.uptimeSec / 60)}m`
              : "N/A"}
          </div>
        </div>
      </div>

      {/* Metrics (if available) */}
      {metrics && (
        <>
          <div className="metrics-header">
            <h4>{t("dashboard.metricsLast60s")}</h4>
            <span className="metrics-timestamp">
              {t("dashboard.updated")}: {new Date(metrics.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">{t("dashboard.totalRequests")}</div>
              <div className="metric-value">{metrics.req_total}</div>
            </div>

            <div className={`metric-card ${parseInt(errorRate) > 1 ? "alert" : ""}`}>
              <div className="metric-label">{t("dashboard.errors5xx")}</div>
              <div className="metric-value">
                {metrics.req_5xx}
                <span className="metric-subtext">({errorRate}%)</span>
              </div>
            </div>

            <div className={`metric-card ${metrics.p95_latency_ms > 500 ? "warning" : ""}`}>
              <div className="metric-label">{t("dashboard.p95Latency")}</div>
              <div className="metric-value">
                {metrics.p95_latency_ms || 0}
                <span className="metric-subtext">ms</span>
              </div>
            </div>

            <div className={`metric-card ${metrics.rate_limited_429 > 50 ? "warning" : ""}`}>
              <div className="metric-label">{t("dashboard.rateLimited")}</div>
              <div className="metric-value">{metrics.rate_limited_429}</div>
            </div>
          </div>

          <div className="metrics-secondary">
            <div className="metric-inline">
              <span className="metric-label">{t("settings.conversations")}:</span>
              <span className="metric-value">{metrics.conversations_posts}</span>
            </div>
            <div className="metric-inline">
              <span className="metric-label">{t("settings.messages")}:</span>
              <span className="metric-value">{metrics.messages_posts}</span>
            </div>
            <div className="metric-inline">
              <span className="metric-label">{t("dashboard.bootloaderCalls")}:</span>
              <span className="metric-value">{metrics.bootloader_calls}</span>
            </div>
          </div>
        </>
      )}

        {/* Retention Policy Info */}
        {orgSettings && (
        <>
          <div className="retention-header">
            <h4>{t("dashboard.dataRetention")}</h4>
          </div>

          <div className="retention-info">
            <div className="retention-item">
              <span className="retention-label">{t("dashboard.retentionPeriod")}:</span>
              <span className="retention-value">
                {orgSettings.settings.messageRetentionDays || 365} {t("dashboard.days")}
              </span>
            </div>
            <div className="retention-item">
              <span className="retention-label">{t("dashboard.deleteMode")}:</span>
              <span className="retention-value">
                {orgSettings.settings.hardDeleteOnRetention ? t("dashboard.hardDeleteMode") : t("dashboard.softDelete")}
              </span>
            </div>
            <div className="retention-item">
              <span className="retention-label">{t("dashboard.lastRun")}:</span>
              <span className="retention-value" suppressHydrationWarning>
                {orgSettings.settings.lastRetentionRunAt
                  ? new Date(orgSettings.settings.lastRetentionRunAt).toLocaleString()
                  : t("common.never")}
              </span>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .system-status {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .status-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .status-indicator {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .status-indicator.ok {
          color: #10b981;
        }

        .status-indicator.down {
          color: #ef4444;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .status-card {
          padding: 1rem;
          border-radius: 6px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }

        .status-card.ok {
          background: #f0fdf4;
          border-color: #86efac;
        }

        .status-card.down {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .status-label {
          font-size: 0.75rem;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }

        .status-value {
          font-size: 1.125rem;
          font-weight: 600;
        }

        .metrics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e5e7eb;
        }

        .metrics-header h4 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
        }

        .metrics-timestamp {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .metric-card {
          padding: 1rem;
          border-radius: 6px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }

        .metric-card.alert {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .metric-card.warning {
          background: #fef9c3;
          border-color: #fde047;
        }

        .metric-label {
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .metric-subtext {
          font-size: 0.875rem;
          font-weight: 400;
          color: #6b7280;
          margin-left: 0.25rem;
        }

        .metrics-secondary {
          display: flex;
          gap: 1.5rem;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .metric-inline {
          display: flex;
          gap: 0.5rem;
        }

        .metric-inline .metric-label {
          color: #6b7280;
          margin: 0;
        }

        .metric-inline .metric-value {
          font-size: 0.875rem;
          font-weight: 600;
        }

        .metrics-notice {
          margin-top: 1rem;
          padding: 0.75rem;
          background: #fffbeb;
          border: 1px solid #fde047;
          border-radius: 6px;
          font-size: 0.875rem;
          color: #92400e;
        }

        .metrics-notice code {
          background: white;
          padding: 0.125rem 0.375rem;
          border-radius: 3px;
          font-size: 0.8125rem;
        }

        .retention-header {
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e5e7eb;
        }

        .retention-header h4 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
        }

        .retention-info {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .retention-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .retention-label {
          color: #6b7280;
          font-weight: 500;
        }

        .retention-value {
          color: #111827;
          font-weight: 600;
        }

        .loading {
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
