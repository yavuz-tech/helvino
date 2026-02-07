"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/PortalLayout";
import ErrorBanner from "@/components/ErrorBanner";
import {
  checkPortalAuth,
  portalLogout,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { Copy, Check, Plus, Trash2, Globe, Wifi, WifiOff } from "lucide-react";

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
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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

  const canEdit = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    const verify = async () => {
      const portalUser = await checkPortalAuth();
      if (!portalUser) { router.push("/portal/login"); return; }
      setUser(portalUser);
      setAuthLoading(false);
    };
    verify();
  }, [router]);

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
    if (!authLoading) fetchConfig();
  }, [authLoading, fetchConfig]);

  const handleLogout = async () => {
    await portalLogout();
    router.push("/portal/login");
  };

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <PortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("widgetSettings.title")}</h1>
        <p className="text-sm text-slate-600 mt-1">{t("widgetSettings.subtitle")}</p>
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
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">{t("common.loading")}</div>
      ) : config ? (
        <div className="space-y-6">
          {/* Widget Status + Toggle */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {config.widgetEnabled ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Wifi size={20} className="text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <WifiOff size={20} className="text-slate-400" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {config.widgetEnabled ? t("widgetSettings.widgetEnabled") : t("widgetSettings.widgetDisabled")}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {t("widgetSettings.connectionStatus")}:{" "}
                    <span className={`font-medium ${
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
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    config.widgetEnabled
                      ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  {config.widgetEnabled ? t("widgetSettings.disableWidget") : t("widgetSettings.enableWidget")}
                </button>
              )}
            </div>

            {/* Health stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <div className="text-sm text-slate-500" suppressHydrationWarning>{t("widgetSettings.lastSeen")}</div>
                <div className="text-sm font-medium text-slate-900 mt-1" suppressHydrationWarning>
                  {config.lastWidgetSeenAt ? new Date(config.lastWidgetSeenAt).toLocaleDateString() : "—"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500">{t("widgetSettings.failures")}</div>
                <div className={`text-sm font-medium mt-1 ${
                  config.health.failuresTotal > 0 ? "text-red-600" : "text-slate-900"
                }`}>
                  {config.health.failuresTotal}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500">{t("widgetSettings.domainMismatches")}</div>
                <div className={`text-sm font-medium mt-1 ${
                  config.health.domainMismatchTotal > 0 ? "text-amber-600" : "text-slate-900"
                }`}>
                  {config.health.domainMismatchTotal}
                </div>
              </div>
            </div>
          </div>

          {/* Embed Snippet */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">{t("widgetSettings.embedSnippet")}</h2>
            <p className="text-sm text-slate-500 mb-4">{t("widgetSettings.embedHint")}</p>
            <div className="bg-slate-900 rounded-lg p-4 relative">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-all">
                {config.embedSnippet.html}
              </pre>
              <button
                onClick={copySnippet}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs text-white transition-colors"
              >
                {copied ? <><Check size={14} /> {t("widgetSettings.copied")}</> : <><Copy size={14} /> {t("widgetSettings.copy")}</>}
              </button>
            </div>
          </div>

          {/* Domain Allowlist */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{t("domainAllowlist.title")}</h2>
            <p className="text-sm text-slate-500 mb-4">{t("domainAllowlist.subtitle")}</p>

            {domainError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {domainError}
              </div>
            )}

            {/* Add domain form */}
            {canEdit && (
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddDomain(); }}
                    placeholder={t("domainAllowlist.addPlaceholder")}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleAddDomain}
                  disabled={!newDomain.trim() || addingDomain}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  <Plus size={16} />
                  {addingDomain ? t("domainAllowlist.adding") : t("domainAllowlist.addDomain")}
                </button>
              </div>
            )}

            <p className="text-xs text-slate-400 mb-4">{t("domainAllowlist.hint")}</p>

            {/* Domain list */}
            {config.allowedDomains.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Globe size={32} className="mx-auto mb-2 opacity-50" />
                <p className="font-medium">{t("domainAllowlist.noDomains")}</p>
                <p className="text-sm">{t("domainAllowlist.noDomainsDesc")}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {config.allowedDomains.map((domain) => (
                  <div key={domain} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <Globe size={16} className="text-slate-400" />
                      <span className="text-sm font-mono text-slate-900">{domain}</span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveDomain(domain)}
                        disabled={removingDomain === domain}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        {removingDomain === domain ? t("domainAllowlist.removing") : t("domainAllowlist.remove")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </PortalLayout>
  );
}
