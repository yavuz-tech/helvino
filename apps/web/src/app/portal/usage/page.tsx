"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { 
  ChevronLeft, TrendingUp, TrendingDown, Minus, 
  MessageSquare, Send, Bot, Users, Download, 
  AlertCircle, CheckCircle2, AlertTriangle, Sparkles 
} from "lucide-react";

/* ────────── Types ────────── */

interface Limits {
  maxConversationsPerMonth: number;
  maxMessagesPerMonth: number;
  maxAgents: number;
  m1LimitPerMonth?: number | null;
  m2LimitPerMonth?: number | null;
  m3LimitVisitorsPerMonth?: number | null;
  extraConversationQuota?: number;
  extraMessageQuota?: number;
}

interface Usage {
  monthKey: string;
  conversationsCreated: number;
  messagesSent: number;
  m1Count?: number;
  m2Count?: number;
  m3Count?: number;
  periodStart?: string;
  periodEnd?: string;
  nextResetDate?: string;
}

interface BillingStatus {
  stripeConfigured: boolean;
  org: { id: string; key: string; name: string };
  plan: { key: string; name: string; monthlyPriceUsd: number | null };
  limits: Limits | null;
  usage: Usage;
  subscription: {
    status: string;
    planStatus: string;
    currentPeriodEnd: string | null;
    billingEnforced: boolean;
  };
}

interface LockStatus {
  locked: boolean;
  graceEndsAt: string | null;
  billingLockedAt: string | null;
  reason: string;
}

interface AlertsPayload {
  domainMismatchCountPeriod: number;
  lastMismatchHost: string | null;
  lastMismatchAt: string | null;
  writeEnabled: boolean;
  widgetEnabled: boolean;
  usageNearLimit: { m1: boolean; m2: boolean; m3: boolean };
}

interface AiUsage {
  used: number;
  limit: number;
  isUnlimited: boolean;
}

/* ────────── Components ────────── */

function HeroMetricCard({
  icon: Icon,
  label,
  value,
  limit,
  extra,
  iconColor,
  trend,
}: {
  icon: any;
  label: string;
  value: number;
  limit: number;
  extra?: number;
  iconColor: string;
  trend?: "up" | "down" | "stable";
}) {
  const { t } = useI18n();
  const pct = limit > 0 ? Math.min((value / limit) * 100, 100) : 0;
  const remaining = Math.max(0, limit - value);
  const isHigh = pct >= 80;
  const isFull = pct >= 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${iconColor}`}>
          <Icon size={24} className="text-white" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-slate-500"
          }`}>
            {trend === "up" && <TrendingUp size={14} />}
            {trend === "down" && <TrendingDown size={14} />}
            {trend === "stable" && <Minus size={14} />}
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-slate-900" suppressHydrationWarning>
          {value.toLocaleString()}
        </span>
        <span className="text-sm text-slate-400" suppressHydrationWarning>
          {t("usage.of")} {limit.toLocaleString()}
        </span>
      </div>
      {extra != null && extra > 0 && (
        <p className="text-xs text-blue-600 mb-2" suppressHydrationWarning>
          +{extra.toLocaleString()} {t("usage.extra")}
        </p>
      )}
      <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            isFull ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500" suppressHydrationWarning>
        {remaining.toLocaleString()} {t("usage.remaining")}
      </p>
    </div>
  );
}

function AlertBanner({
  variant,
  children,
}: {
  variant: "warning" | "danger" | "info" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    danger: "bg-red-50 border-red-200 text-red-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };
  const icons = {
    warning: <AlertTriangle size={18} />,
    danger: <AlertCircle size={18} />,
    info: <AlertCircle size={18} />,
    success: <CheckCircle2 size={18} />,
  };
  return (
    <div className={`rounded-xl border p-4 text-sm flex items-start gap-3 ${styles[variant]}`}>
      {icons[variant]}
      <div className="flex-1">{children}</div>
    </div>
  );
}

function MeteringCard({
  label,
  value,
  limit,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  limit: number | null;
  icon: any;
  color: string;
}) {
  const { t } = useI18n();
  const pct = limit != null && limit > 0 ? Math.min((value / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;
  const isFull = pct >= 100;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-2" suppressHydrationWarning>
        {value.toLocaleString()}
      </p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500" suppressHydrationWarning>
          {t("usage.limit")}{" "}
          {limit == null ? t("usage.unlimited") : limit.toLocaleString()}
        </span>
        {limit != null && limit > 0 && (
          <span
            className={`font-medium ${
              isFull ? "text-red-600" : isHigh ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
      {limit != null && limit > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              isFull ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ────────── Main ────────── */

export default function PortalUsagePage() {
  const { user, loading: authLoading } = usePortalAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [alerts, setAlerts] = useState<AlertsPayload | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      try {
        const [billingRes, lockRes, alertsRes, aiUsageRes] = await Promise.all([
          portalApiFetch("/portal/billing/status"),
          portalApiFetch("/portal/billing/lock-status"),
          portalApiFetch("/portal/org/me/alerts"),
          portalApiFetch("/portal/ai/usage"),
        ]);
        if (billingRes.ok) setBilling(await billingRes.json());
        else setError(t("usage.failedLoad"));
        if (lockRes.ok) setLockStatus(await lockRes.json());
        if (alertsRes.ok) setAlerts(await alertsRes.json());
        if (aiUsageRes.ok) setAiUsage(await aiUsageRes.json());
      } catch {
        setError(t("common.networkError"));
      }
      setLoading(false);
    };
    load();
  }, [authLoading, t]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  const limits = billing?.limits;
  const usage = billing?.usage;
  const isLocked = lockStatus?.locked === true;
  const isGrace = lockStatus?.reason === "grace";

  const pctForLimit = (used: number, limit?: number | null) => {
    if (!limit || limit <= 0) return 0;
    return (used / limit) * 100;
  };
  const convPct = limits ? pctForLimit(usage?.conversationsCreated || 0, limits.maxConversationsPerMonth) : 0;
  const msgPct = limits ? pctForLimit(usage?.messagesSent || 0, limits.maxMessagesPerMonth) : 0;
  const m1Pct = limits ? pctForLimit(usage?.m1Count || 0, limits.m1LimitPerMonth ?? null) : 0;
  const m2Pct = limits ? pctForLimit(usage?.m2Count || 0, limits.m2LimitPerMonth ?? null) : 0;
  const m3Pct = limits ? pctForLimit(usage?.m3Count || 0, limits.m3LimitVisitorsPerMonth ?? null) : 0;
  const anyHigh = convPct >= 80 || msgPct >= 80 || m1Pct >= 80 || m2Pct >= 80 || m3Pct >= 80;
  const anyFull = convPct >= 100 || msgPct >= 100 || m1Pct >= 100 || m2Pct >= 100 || m3Pct >= 100;

  const handleExport = () => {
    if (!billing) return;
    const data = {
      org: billing.org,
      plan: billing.plan,
      period: usage?.monthKey,
      usage: {
        conversations: usage?.conversationsCreated,
        messages: usage?.messagesSent,
        m1: usage?.m1Count,
        m2: usage?.m2Count,
        m3: usage?.m3Count,
      },
      limits: billing.limits,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helvino-usage-${usage?.monthKey || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#1A1A2E] transition-colors mb-4 group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          {t("portalOnboarding.backToDashboard")}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">{t("usage.heroTitle")}</h1>
            <p className="text-sm text-slate-600">
              {t("usage.heroSubtitle")}
            </p>
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
          >
            <Download size={16} />
            {t("usage.exportData")}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts && alerts.domainMismatchCountPeriod > 0 && (
        <AlertBanner variant="warning">
          <div>
            <p className="font-semibold mb-1">{t("usage.securityNotice")}</p>
            <p className="text-xs">
              {t("security.domainMismatchCount")}: <strong>{alerts.domainMismatchCountPeriod}</strong>
            </p>
          </div>
        </AlertBanner>
      )}

      {error && (
        <AlertBanner variant="danger">
          {error}{" "}
          <button
            onClick={() => setError(null)}
            className="underline font-semibold ml-2"
          >
            {t("usage.dismiss")}
          </button>
        </AlertBanner>
      )}

      {loading || !billing ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Locked / Grace banner */}
          {isLocked && (
            <AlertBanner variant="danger">
              <div>
                <p className="font-semibold mb-1">{t("usage.locked")}</p>
                <Link
                  href="/portal/billing"
                  className="text-xs underline font-medium"
                >
                  {t("billing.manageBilling")}
                </Link>
              </div>
            </AlertBanner>
          )}

          {isGrace && !isLocked && (
            <AlertBanner variant="warning">
              <div>
                <p className="font-semibold mb-1">{t("usage.gracePeriod")}</p>
                {lockStatus?.graceEndsAt && (
                  <p className="text-xs" suppressHydrationWarning>
                    {t("usage.resetDate")}{" "}
                    <strong>{new Date(lockStatus.graceEndsAt).toLocaleDateString()}</strong>
                  </p>
                )}
                <Link
                  href="/portal/billing"
                  className="text-xs underline font-medium mt-2 inline-block"
                >
                  {t("billing.manageBilling")}
                </Link>
              </div>
            </AlertBanner>
          )}

          {/* High usage banner */}
          {anyFull && !isLocked && (
            <AlertBanner variant="danger">
              <div>
                <p className="font-semibold mb-1">{t("usage.limitReached")}</p>
                <Link
                  href="/portal/billing"
                  className="text-xs underline font-medium"
                >
                  {t("billing.viewPlans")}
                </Link>
              </div>
            </AlertBanner>
          )}

          {anyHigh && !anyFull && !isLocked && (
            <AlertBanner variant="warning">
              <div>
                <p className="font-semibold mb-1">{t("usage.approachingLimit")}</p>
                <Link
                  href="/portal/billing"
                  className="text-xs underline font-medium"
                >
                  {t("billing.viewPlans")}
                </Link>
              </div>
            </AlertBanner>
          )}

          {/* Period info bar */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{t("usage.currentPeriod")}</span>
                <span className="text-slate-500" suppressHydrationWarning>
                  {usage?.monthKey}
                </span>
              </div>
              {usage?.nextResetDate && (
                <div className="text-slate-600 text-xs" suppressHydrationWarning>
                  {t("usage.resetDate")}{" "}
                  <span className="font-semibold">
                    {new Date(usage.nextResetDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Hero metrics grid */}
          {limits && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <HeroMetricCard
                icon={MessageSquare}
                label={t("usage.conversations")}
                value={usage?.conversationsCreated || 0}
                limit={limits.maxConversationsPerMonth}
                extra={limits.extraConversationQuota}
                iconColor="from-blue-500 to-indigo-600"
                trend="stable"
              />
              <HeroMetricCard
                icon={Send}
                label={t("usage.messages")}
                value={usage?.messagesSent || 0}
                limit={limits.maxMessagesPerMonth}
                extra={limits.extraMessageQuota}
                iconColor="from-purple-500 to-violet-600"
                trend="stable"
              />
              <HeroMetricCard
                icon={Bot}
                label={t("usage.m2Label")}
                value={usage?.m2Count || 0}
                limit={limits.m2LimitPerMonth || 0}
                iconColor="from-emerald-500 to-teal-600"
                trend="up"
              />
              <HeroMetricCard
                icon={Users}
                label={t("usage.m3Label")}
                value={usage?.m3Count || 0}
                limit={limits.m3LimitVisitorsPerMonth || 0}
                iconColor="from-amber-500 to-orange-600"
                trend="stable"
              />
            </div>
          )}

          {/* AI Usage Premium Card */}
          {aiUsage && (
            <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border border-indigo-200/60 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{t("usage.aiUsageTitle")}</h3>
                    <p className="text-xs text-slate-600">{t("usage.aiQuota")}</p>
                  </div>
                </div>
                <Link
                  href="/portal/ai"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
                >
                  {t("usage.viewDetails")}
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-white/70 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-xs text-slate-600 mb-1">{t("usage.aiResponses")}</p>
                  <p className="text-2xl font-bold text-slate-900" suppressHydrationWarning>
                    {aiUsage.used.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1" suppressHydrationWarning>
                    {t("usage.of")} {aiUsage.isUnlimited ? t("usage.unlimited") : aiUsage.limit.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/70 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-xs text-slate-600 mb-1">{t("usage.remaining")}</p>
                  <p className="text-2xl font-bold text-indigo-600" suppressHydrationWarning>
                    {aiUsage.isUnlimited
                      ? t("usage.unlimited")
                      : Math.max(0, aiUsage.limit - aiUsage.used).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {!aiUsage.isUnlimited && (
                      <>
                        {((Math.max(0, aiUsage.limit - aiUsage.used) / aiUsage.limit) * 100).toFixed(0)}% {t("usage.remaining")}
                      </>
                    )}
                  </p>
                </div>
                <div className="bg-white/70 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-xs text-slate-600 mb-1">{t("usage.status")}</p>
                  <p className="text-xl font-bold text-slate-900">
                    {!aiUsage.isUnlimited && aiUsage.used >= aiUsage.limit ? (
                      <span className="text-red-600">{t("usage.critical")}</span>
                    ) : !aiUsage.isUnlimited && aiUsage.used >= aiUsage.limit * 0.8 ? (
                      <span className="text-amber-600">{t("usage.warning")}</span>
                    ) : (
                      <span className="text-emerald-600">{t("usage.healthy")}</span>
                    )}
                  </p>
                </div>
              </div>
              {!aiUsage.isUnlimited && aiUsage.used >= aiUsage.limit * 0.8 && (
                <div className="mt-4 p-3 bg-white/60 rounded-lg border border-indigo-200/40">
                  <p className="text-xs text-slate-700">
                    {aiUsage.used >= aiUsage.limit
                      ? t("usage.limitReached")
                      : t("usage.approachingLimit")}{" "}
                    <Link
                      href="/portal/billing"
                      className="font-semibold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      {t("usage.upgradeForMore")}
                    </Link>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Advanced Metering */}
          {limits && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">{t("usage.meteringBreakdown")}</h3>
                <span className="text-xs text-slate-500 px-2.5 py-1 bg-slate-100 rounded-full font-medium">
                  {t("usage.thisMonth")}
                </span>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <MeteringCard
                  label={t("usage.m1Label")}
                  value={usage?.m1Count || 0}
                  limit={limits.m1LimitPerMonth ?? null}
                  icon={MessageSquare}
                  color="bg-gradient-to-br from-blue-500 to-cyan-600"
                />
                <MeteringCard
                  label={t("usage.m2Label")}
                  value={usage?.m2Count || 0}
                  limit={limits.m2LimitPerMonth ?? null}
                  icon={Bot}
                  color="bg-gradient-to-br from-emerald-500 to-teal-600"
                />
                <MeteringCard
                  label={t("usage.m3Label")}
                  value={usage?.m3Count || 0}
                  limit={limits.m3LimitVisitorsPerMonth ?? null}
                  icon={Users}
                  color="bg-gradient-to-br from-amber-500 to-orange-600"
                />
              </div>
            </div>
          )}

          {/* Quick Insights */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t("usage.quickInsights")}</h3>
            <div className="space-y-3">
              {!anyHigh && !anyFull && (
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-700">{t("usage.insight1")}</p>
                </div>
              )}
              {aiUsage && !aiUsage.isUnlimited && aiUsage.used >= aiUsage.limit * 0.7 && (
                <div className="flex items-start gap-3 text-sm">
                  <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-700">{t("usage.insight2")}</p>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm">
                <AlertCircle size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">{t("usage.insight3")}</p>
              </div>
            </div>
          </div>

          {/* Plan info card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t("usage.planDetails")}</h3>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">{t("usage.plan")}</p>
                <p className="text-xl font-bold text-slate-900">
                  {billing.plan.name}
                </p>
                {billing.plan.monthlyPriceUsd != null && billing.plan.monthlyPriceUsd > 0 && (
                  <p className="text-sm text-slate-600 mt-0.5">
                    ${billing.plan.monthlyPriceUsd}{t("billing.perMonth")}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">{t("usage.status")}</p>
                <p className="text-xl font-bold text-slate-900 capitalize">
                  {(() => {
                    const sKey = `billing.status.${billing.subscription.status}` as TranslationKey;
                    const sTranslated = t(sKey);
                    return sTranslated === sKey
                      ? (billing.subscription.status === "none" ? t("usage.noSubscription") : billing.subscription.status.replace("_", " "))
                      : sTranslated;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">{t("usage.agentSeats")}</p>
                <p className="text-xl font-bold text-slate-900">
                  {limits?.maxAgents ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap gap-3">
              <Link
                href="/portal/billing"
                className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-md hover:shadow-lg"
              >
                {t("billing.manageBilling")}
              </Link>
              {isLocked && (
                <span className="px-5 py-2.5 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200 font-medium">
                  {t("usage.contactSupport")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
