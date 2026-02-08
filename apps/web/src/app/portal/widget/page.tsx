"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { Copy, Check, Plus, Trash2, Globe, Wifi, WifiOff, ChevronLeft, ChevronDown, ChevronRight } from "lucide-react";
import WidgetGallery from "@/components/widget/WidgetGallery";

interface WidgetConfig {
  widgetEnabled: boolean;
  allowedDomains: string[];
  allowLocalhost: boolean;
  embedSnippet: { html: string; scriptSrc: string; siteId: string };
  lastWidgetSeenAt: string | null;
  health: {
    status: "OK" | "NEEDS_ATTENTION" | "NOT_CONNECTED";
    failuresTotal: number;
    domainMismatchTotal: number;
  };
  requestId?: string;
}

export default function PortalWidgetPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const showDebug = process.env.NODE_ENV === "development" && searchParams.get("debug") === "1";
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showGallery, setShowGallery] = useState(false);
  const canEdit = user?.role === "owner" || user?.role === "admin";

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/widget/config");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRequestId(data?.requestId || res.headers.get("x-request-id"));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setConfig(data);
      setRequestId(data.requestId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading && user) fetchConfig();
  }, [authLoading, user, fetchConfig]);

  const copySnippet = async () => {
    if (!config) return;
    await navigator.clipboard.writeText(config.embedSnippet.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim() || addingDomain) return;
    setAddingDomain(true);
    setDomainError(null);
    setMessage(null);
    try {
      const res = await portalApiFetch("/portal/widget/domains", {
        method: "POST",
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        setDomainError(msg);
        return;
      }
      setNewDomain("");
      setMessage(t("domainAllowlist.added"));
      await fetchConfig();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setAddingDomain(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    setRemovingDomain(domain);
    setDomainError(null);
    setMessage(null);
    try {
      const res = await portalApiFetch("/portal/widget/domains", {
        method: "DELETE",
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDomainError(data?.error?.message || `HTTP ${res.status}`);
        return;
      }
      setMessage(t("domainAllowlist.removed"));
      await fetchConfig();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setRemovingDomain(null);
    }
  };

  const handleToggleWidget = async () => {
    if (!config) return;
    setMessage(null);
    try {
      const res = await portalApiFetch("/portal/widget/config", {
        method: "PATCH",
        body: JSON.stringify({ widgetEnabled: !config.widgetEnabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message || `HTTP ${res.status}`);
        return;
      }
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-5">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 hover:text-[#1A1A2E] transition-colors mb-2.5 group"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
          {t("portalOnboarding.backToDashboard")}
        </Link>
        <h1 className="text-[20px] font-semibold text-slate-900 leading-tight">{t("widgetSettings.title")}</h1>
        <p className="text-[13px] text-slate-600 mt-1">{t("widgetSettings.subtitle")}</p>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          requestId={requestId}
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      )}

      {message && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200/80 rounded-lg p-3 text-[13px] text-emerald-700 font-medium shadow-sm">
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-[13px]">{t("common.loading")}</div>
      ) : config ? (
        <div className="space-y-5">
          {/* Widget Status + Toggle */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {config.widgetEnabled ? (
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shadow-sm">
                    <Wifi size={18} className="text-emerald-600" strokeWidth={2} />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shadow-sm">
                    <WifiOff size={18} className="text-slate-400" strokeWidth={2} />
                  </div>
                )}
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">
                    {config.widgetEnabled ? t("widgetSettings.widgetEnabled") : t("widgetSettings.widgetDisabled")}
                  </h2>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    {t("widgetSettings.connectionStatus")}:{" "}
                    <span className={`font-semibold ${
                      config.health.status === "OK" ? "text-emerald-600"
                      : config.health.status === "NEEDS_ATTENTION" ? "text-amber-600"
                      : "text-slate-400"
                    }`}>
                      {config.health.status.replace(/_/g, " ")}
                    </span>
                  </p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={handleToggleWidget}
                  className={`px-3.5 py-2 text-[13px] font-semibold rounded-lg transition-colors shadow-sm ${
                    config.widgetEnabled
                      ? "bg-red-50 text-red-700 border border-red-200/80 hover:bg-red-100"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100"
                  }`}
                >
                  {config.widgetEnabled ? t("widgetSettings.disableWidget") : t("widgetSettings.enableWidget")}
                </button>
              )}
            </div>

            {/* Health stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/80">
              <div className="text-center">
                <div className="text-[12px] text-slate-500 font-medium" suppressHydrationWarning>{t("widgetSettings.lastSeen")}</div>
                <div className="text-[13px] font-semibold text-slate-800 mt-1" suppressHydrationWarning>
                  {config.lastWidgetSeenAt ? new Date(config.lastWidgetSeenAt).toLocaleDateString() : "—"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[12px] text-slate-500 font-medium">{t("widgetSettings.failures")}</div>
                <div className={`text-[13px] font-semibold mt-1 ${
                  config.health.failuresTotal > 0 ? "text-red-600" : "text-slate-800"
                }`}>
                  {config.health.failuresTotal}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[12px] text-slate-500 font-medium">{t("widgetSettings.domainMismatches")}</div>
                <div className={`text-[13px] font-semibold mt-1 ${
                  config.health.domainMismatchTotal > 0 ? "text-amber-600" : "text-slate-800"
                }`}>
                  {config.health.domainMismatchTotal}
                </div>
              </div>
            </div>
          </div>

          {/* Embed Snippet */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900 mb-1 leading-tight">{t("widgetSettings.embedSnippet")}</h2>
            <p className="text-[13px] text-slate-500 mb-4">{t("widgetSettings.embedHint")}</p>
            <div className="bg-slate-900 rounded-lg p-4 relative shadow-sm">
              <pre className="text-[13px] text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                {config.embedSnippet.html}
              </pre>
              <button
                onClick={copySnippet}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded text-[11px] text-white font-medium transition-colors"
              >
                {copied ? <><Check size={13} /> {t("widgetSettings.copied")}</> : <><Copy size={13} /> {t("widgetSettings.copy")}</>}
              </button>
            </div>
          </div>

          {/* Domain Allowlist */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900 mb-1 leading-tight">{t("domainAllowlist.title")}</h2>
            <p className="text-[13px] text-slate-500 mb-4">{t("domainAllowlist.subtitle")}</p>

            {domainError && (
              <div className="mb-4 bg-red-50 border border-red-200/80 rounded-lg p-3 text-[13px] text-red-700 font-medium shadow-sm">
                {domainError}
              </div>
            )}

            {/* Add domain form */}
            {canEdit && (
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddDomain(); }}
                    placeholder={t("domainAllowlist.addPlaceholder")}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-[13px] focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E] transition-all"
                  />
                </div>
                <button
                  onClick={handleAddDomain}
                  disabled={!newDomain.trim() || addingDomain}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#1A1A2E] to-[#2D2D44] text-white text-[13px] font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  {addingDomain ? t("domainAllowlist.adding") : t("domainAllowlist.addDomain")}
                </button>
              </div>
            )}

            <p className="text-[11px] text-slate-400 mb-4 font-medium">{t("domainAllowlist.hint")}</p>

            {/* Domain list */}
            {config.allowedDomains.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Globe size={28} className="mx-auto mb-2 opacity-40" strokeWidth={2} />
                <p className="font-semibold text-[13px]">{t("domainAllowlist.noDomains")}</p>
                <p className="text-[12px] mt-0.5">{t("domainAllowlist.noDomainsDesc")}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200/60">
                {config.allowedDomains.map((domain) => (
                  <div key={domain} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-slate-400" strokeWidth={2} />
                      <span className="text-[13px] font-mono text-slate-800 font-medium">{domain}</span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveDomain(domain)}
                        disabled={removingDomain === domain}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded font-semibold transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                        {removingDomain === domain ? t("domainAllowlist.removing") : t("domainAllowlist.remove")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Widget Gallery (collapsible, default closed) - Only in dev + ?debug=1 */}
          {showDebug && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowGallery(!showGallery)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {showGallery ? (
                    <ChevronDown size={18} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-700">
                    {t("widgetGallery.title")}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                    {t("widgetGallery.subtitle")}
                  </span>
                </div>
              </button>
              {showGallery && (
                <div className="px-5 pb-5">
                  <WidgetGallery />
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
