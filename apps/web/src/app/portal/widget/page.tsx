"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
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

function PortalWidgetContent() {
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
  const [justAddedDomain, setJustAddedDomain] = useState<string | null>(null);
  const [animatedFailures, setAnimatedFailures] = useState(0);
  const [animatedMismatches, setAnimatedMismatches] = useState(0);

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
    const domainToAdd = newDomain.trim();
    setAddingDomain(true);
    setDomainError(null);
    setMessage(null);
    try {
      const res = await portalApiFetch("/portal/widget/domains", {
        method: "POST",
        body: JSON.stringify({ domain: domainToAdd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        setDomainError(msg);
        return;
      }
      setNewDomain("");
      setJustAddedDomain(domainToAdd);
      setMessage(t("domainAllowlist.added"));
      await fetchConfig();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setAddingDomain(false);
    }
  };

  useEffect(() => {
    if (!justAddedDomain) return;
    const timeout = setTimeout(() => setJustAddedDomain(null), 600);
    return () => clearTimeout(timeout);
  }, [justAddedDomain]);

  useEffect(() => {
    if (!config) return;
    const duration = 1000;
    let raf = 0;
    let raf2 = 0;
    const start = performance.now();
    const start2 = performance.now();
    const fromFailures = 0;
    const fromMismatches = 0;
    const toFailures = config.health.failuresTotal;
    const toMismatches = config.health.domainMismatchTotal;

    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
    const tickFailures = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = easeOut(progress);
      setAnimatedFailures(Math.round(fromFailures + (toFailures - fromFailures) * eased));
      if (progress < 1) raf = requestAnimationFrame(tickFailures);
    };
    const tickMismatches = (now: number) => {
      const progress = Math.min((now - start2) / duration, 1);
      const eased = easeOut(progress);
      setAnimatedMismatches(Math.round(fromMismatches + (toMismatches - fromMismatches) * eased));
      if (progress < 1) raf2 = requestAnimationFrame(tickMismatches);
    };

    raf = requestAnimationFrame(tickFailures);
    raf2 = requestAnimationFrame(tickMismatches);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
    };
  }, [config?.health.failuresTotal, config?.health.domainMismatchTotal, config]);

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
          className="mb-2.5 inline-flex items-center gap-1 font-[var(--font-body)] text-[13px] font-medium text-[#94A3B8] transition-colors hover:text-[#64748B] group"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
          {t("portalOnboarding.backToDashboard")}
        </Link>
        <h1 className="font-[var(--font-heading)] text-[28px] font-extrabold leading-tight text-[#1A1D23]">{t("widgetSettings.title")}</h1>
        <p className="mt-1 font-[var(--font-body)] text-[14px] text-[#64748B]">{t("widgetSettings.subtitle")}</p>
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
          <div className="widget-card rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm widget-stagger" style={{ ["--index" as string]: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {config.widgetEnabled ? (
                  <div className="widget-status-icon widget-status-icon-ok flex h-12 w-12 items-center justify-center rounded-xl shadow-sm">
                    <Wifi size={18} className="text-emerald-600" strokeWidth={2} />
                  </div>
                ) : (
                  <div className="widget-status-icon widget-status-icon-off flex h-12 w-12 items-center justify-center rounded-xl shadow-sm">
                    <WifiOff size={18} className="text-red-500" strokeWidth={2} />
                  </div>
                )}
                <div>
                  <h2 className="font-[var(--font-heading)] text-[16px] font-bold leading-tight text-[#1A1D23]">
                    {config.widgetEnabled ? t("widgetSettings.widgetEnabled") : t("widgetSettings.widgetDisabled")}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-2 font-[var(--font-body)] text-[12.5px]">
                    <span className={`h-2 w-2 rounded-full ${
                      config.health.status === "OK"
                        ? "status-dot-ok"
                        : config.health.status === "NOT_CONNECTED"
                        ? "status-dot-off"
                        : "status-dot-warn"
                    }`} />
                    <span className="text-[#94A3B8]">{t("widgetSettings.connectionStatus")}:</span>{" "}
                    <span className={`font-semibold ${
                      config.health.status === "OK" ? "text-emerald-600"
                      : config.health.status === "NEEDS_ATTENTION" ? "text-amber-600"
                      : "text-[#EF4444]"
                    }`}>
                      {config.health.status.replace(/_/g, " ")}
                    </span>
                  </p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={handleToggleWidget}
                  className={`widget-button-press rounded-xl border-2 px-5 py-2.5 font-[var(--font-heading)] text-[13px] font-semibold transition-all ${
                    config.widgetEnabled
                      ? "border-[#EF4444] bg-transparent text-[#EF4444] hover:bg-[#EF4444] hover:text-white hover:shadow-[0_4px_16px_rgba(239,68,68,0.25)] hover:scale-[1.02]"
                      : "border-emerald-500 bg-transparent text-emerald-600 hover:bg-emerald-500 hover:text-white hover:shadow-[0_4px_16px_rgba(16,185,129,0.25)] hover:scale-[1.02]"
                  }`}
                >
                  {config.widgetEnabled ? t("widgetSettings.disableWidget") : t("widgetSettings.enableWidget")}
                </button>
              )}
            </div>

            {/* Health stats */}
            <div className="grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-4">
              <div className="group text-center">
                <div className="font-[var(--font-body)] text-[12px] font-medium text-[#94A3B8]" suppressHydrationWarning>{t("widgetSettings.lastSeen")}</div>
                <div className="mt-1 font-[var(--font-heading)] text-[18px] font-bold text-[#1A1D23] transition-colors duration-300 group-hover:text-[#F59E0B]" suppressHydrationWarning>
                  {config.lastWidgetSeenAt ? new Date(config.lastWidgetSeenAt).toLocaleDateString() : "—"}
                </div>
              </div>
              <div className="group border-x border-[#F3E8D8] text-center">
                <div className="font-[var(--font-body)] text-[12px] font-medium text-[#94A3B8]">{t("widgetSettings.failures")}</div>
                <div className={`mt-1 font-[var(--font-heading)] text-[18px] font-bold transition-colors duration-300 group-hover:text-[#F59E0B] ${
                  config.health.failuresTotal > 0 ? "text-red-600" : "text-slate-800"
                }`}>
                  {animatedFailures}
                </div>
              </div>
              <div className="group text-center">
                <div className="font-[var(--font-body)] text-[12px] font-medium text-[#94A3B8]">{t("widgetSettings.domainMismatches")}</div>
                <div className={`mt-1 font-[var(--font-heading)] text-[18px] font-bold transition-colors duration-300 group-hover:text-[#F59E0B] ${
                  config.health.domainMismatchTotal > 0 ? "text-amber-600" : "text-slate-800"
                }`}>
                  {animatedMismatches}
                </div>
              </div>
            </div>
          </div>

          {/* Embed Snippet */}
          <div className="widget-card rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm widget-stagger" style={{ ["--index" as string]: 1 }}>
            <h2 className="mb-1 font-[var(--font-heading)] text-[16px] font-bold leading-tight text-[#1A1D23]">{t("widgetSettings.embedSnippet")}</h2>
            <p className="mb-4 font-[var(--font-body)] text-[13px] text-[#64748B]">{t("widgetSettings.embedHint")}</p>
            <div className="relative rounded-xl bg-[#1A1D23] p-4 shadow-sm">
              <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-[#F59E0B]" />
              <pre className="font-mono text-[13px] whitespace-pre-wrap break-all leading-relaxed text-[#E2E8F0] pl-2">
                {config.embedSnippet.html}
              </pre>
              <button
                onClick={copySnippet}
                className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-[var(--font-body)] text-[12px] font-semibold text-white transition-all hover:scale-[1.05] hover:bg-white/20"
              >
                {copied ? <><Check size={13} className="text-emerald-400" /> <span className="text-emerald-400">✓ {t("widgetSettings.copied")}!</span></> : <><Copy size={13} /> {t("widgetSettings.copy")}</>}
              </button>
            </div>
          </div>

          {/* Domain Allowlist */}
          <div className="widget-card rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm widget-stagger" style={{ ["--index" as string]: 2 }}>
            <h2 className="mb-1 font-[var(--font-heading)] text-[16px] font-bold leading-tight text-[#1A1D23]">{t("domainAllowlist.title")}</h2>
            <p className="mb-4 font-[var(--font-body)] text-[13px] text-[#64748B]">{t("domainAllowlist.subtitle")}</p>

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
                    className="w-full rounded-xl border border-black/10 bg-[#FAFAF8] py-3 pl-9 pr-3 font-[var(--font-body)] text-[13px] transition-all focus:border-[#F59E0B] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)] focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAddDomain}
                  disabled={!newDomain.trim() || addingDomain}
                  className="widget-button-press flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] px-5 py-2.5 font-[var(--font-heading)] text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(245,158,11,0.2)] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(245,158,11,0.35)] disabled:opacity-50"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  {addingDomain ? t("domainAllowlist.adding") : t("domainAllowlist.addDomain")}
                </button>
              </div>
            )}

            <p className="mb-4 font-[var(--font-body)] text-[12px] font-medium text-[#F59E0B]">{t("domainAllowlist.hint")}</p>

            {/* Domain list */}
            {config.allowedDomains.length === 0 ? (
              <div className="py-8 text-center">
                <Globe size={48} className="empty-float-icon mx-auto mb-3 text-[#D4D4D8]" strokeWidth={1.8} />
                <p className="font-[var(--font-heading)] text-[14px] font-semibold text-[#94A3B8]">{t("domainAllowlist.noDomains")}</p>
                <p className="mt-0.5 font-[var(--font-body)] text-[12.5px] text-[#C4C4C4]">{t("domainAllowlist.noDomainsDesc")}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200/60">
                {config.allowedDomains.map((domain) => (
                  <div key={domain} className={`flex items-center justify-between py-2.5 ${justAddedDomain === domain ? "domain-item-enter" : ""}`}>
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
      <style jsx>{`
        .widget-stagger {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          animation-delay: calc(var(--index) * 100ms);
        }
        .widget-card {
          transition: all 0.3s ease;
        }
        .widget-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
        .widget-status-icon {
          animation: softPulse 3s ease-in-out infinite;
        }
        .widget-status-icon-ok {
          background: rgba(16, 185, 129, 0.08);
        }
        .widget-status-icon-off {
          background: rgba(239, 68, 68, 0.06);
        }
        .status-dot-off {
          background: #ef4444;
          animation: blink 1.5s ease infinite;
        }
        .status-dot-warn {
          background: #f59e0b;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
        }
        .status-dot-ok {
          background: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
        }
        .widget-button-press:active {
          transform: scale(0.98);
        }
        .domain-item-enter {
          animation: domainEnter 0.3s ease forwards;
        }
        .empty-float-icon {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes softPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.85;
          }
        }
        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        @keyframes domainEnter {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .widget-stagger,
          .widget-card,
          .widget-status-icon,
          .status-dot-off,
          .domain-item-enter,
          .empty-float-icon,
          .widget-button-press {
            animation: none !important;
            transition-duration: 0.01ms !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
}

export default function PortalWidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-600">Loading...</div>
        </div>
      }
    >
      <PortalWidgetContent />
    </Suspense>
  );
}
