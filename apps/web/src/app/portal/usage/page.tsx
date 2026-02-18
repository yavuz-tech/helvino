"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { colors, fonts } from "@/lib/design-tokens";
import { ChevronLeft, Download, ArrowUpRight, Crown } from "lucide-react";

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

interface AnalyticsUsageMetric {
  used: number;
  limit: number;
  lastMonthUsed: number;
}

interface AnalyticsUsagePayload {
  period: string;
  resetDate: string;
  conversations: AnalyticsUsageMetric;
  messages: AnalyticsUsageMetric;
  aiMessages: AnalyticsUsageMetric;
  automationReached: AnalyticsUsageMetric;
  plan: {
    key: string;
    name: string;
    price: number;
    status: string;
  };
}

const PAGE_BG = colors.brand.ultraLight;
const ACCENT = colors.brand.primary;
const CORAL = "#FB7185";
const MINT = colors.status.success;

function metricPercent(used: number, limit?: number | null) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

function progressTone(percent: number) {
  if (percent >= 80) return { bar: "#EF4444", track: "#FEE2E2", text: "#B91C1C" };
  if (percent >= 60) return { bar: ACCENT, track: "#FEF3C7", text: "#B45309" };
  return { bar: MINT, track: "#D1FAE5", text: "#047857" };
}

function trendView(current: number, previous: number) {
  if (previous <= 0) {
    return { arrow: "→", value: 0, tone: "#64748B" };
  }
  const delta = ((current - previous) / previous) * 100;
  if (delta > 0) return { arrow: "↑", value: Math.round(delta), tone: "#047857" };
  if (delta < 0) return { arrow: "↓", value: Math.round(Math.abs(delta)), tone: "#B91C1C" };
  return { arrow: "→", value: 0, tone: "#64748B" };
}

/* ────────── Main ────────── */

export default function PortalUsagePage() {
  void fonts;
  const { loading: authLoading } = usePortalAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsUsagePayload | null>(null);
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [alerts, setAlerts] = useState<AlertsPayload | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [animateUsageBars, setAnimateUsageBars] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t, locale } = useI18n();
  const { formatUsd } = useCurrency();

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      try {
        const [billingRes, lockRes, alertsRes, aiUsageRes, analyticsRes] = await Promise.all([
          portalApiFetch("/portal/billing/status"),
          portalApiFetch("/portal/billing/lock-status"),
          portalApiFetch("/portal/org/me/alerts"),
          portalApiFetch("/portal/ai/usage"),
          portalApiFetch("/api/analytics/usage"),
        ]);
        if (billingRes.ok) setBilling(await billingRes.json());
        else setError(t("usage.failedLoad"));
        if (lockRes.ok) setLockStatus(await lockRes.json());
        if (alertsRes.ok) setAlerts(await alertsRes.json());
        if (aiUsageRes.ok) setAiUsage(await aiUsageRes.json());
        if (analyticsRes.ok) {
          const usagePayload = (await analyticsRes.json()) as AnalyticsUsagePayload;
          setAnalytics(usagePayload);
        } else {
          setError(t("usage.failedLoad"));
        }
      } catch {
        setError(t("common.networkError"));
      }
      setLoading(false);
    };
    load();
  }, [authLoading, t]);

  useEffect(() => {
    if (!analytics) return;
    setAnimateUsageBars(false);
    const timer = window.setTimeout(() => setAnimateUsageBars(true), 200);
    return () => window.clearTimeout(timer);
  }, [analytics]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  const limits = billing?.limits;
  const usageMetrics = analytics;
  const isLocked = lockStatus?.locked === true;
  const isGrace = lockStatus?.reason === "grace";

  const convPct = usageMetrics ? metricPercent(usageMetrics.conversations.used, usageMetrics.conversations.limit) : 0;
  const msgPct = usageMetrics ? metricPercent(usageMetrics.messages.used, usageMetrics.messages.limit) : 0;
  const aiPct = usageMetrics ? metricPercent(usageMetrics.aiMessages.used, usageMetrics.aiMessages.limit) : 0;
  const automationPct = usageMetrics
    ? metricPercent(usageMetrics.automationReached.used, usageMetrics.automationReached.limit)
    : 0;
  const anyHigh = convPct >= 80 || msgPct >= 80 || aiPct >= 80 || automationPct >= 80;
  const anyFull = convPct >= 100 || msgPct >= 100 || aiPct >= 100 || automationPct >= 100;
  const aiUsageRate = usageMetrics && usageMetrics.messages.used > 0
    ? usageMetrics.aiMessages.used / usageMetrics.messages.used
    : 0;

  // Metering (M1/M2/M3) — always sourced from billing/status so it matches backend enforcement
  const m1Used = billing?.usage?.m1Count ?? 0;
  const m2Used = billing?.usage?.m2Count ?? 0;
  const m3Used = billing?.usage?.m3Count ?? 0;
  const m1LimitRaw = billing?.limits?.m1LimitPerMonth ?? null;
  const m2LimitRaw = billing?.limits?.m2LimitPerMonth ?? null;
  const m3LimitRaw = billing?.limits?.m3LimitVisitorsPerMonth ?? null;
  const m1Limit = m1LimitRaw == null || m1LimitRaw <= 0 ? -1 : m1LimitRaw;
  const m2Limit = m2LimitRaw == null || m2LimitRaw <= 0 ? -1 : m2LimitRaw;
  const m3Limit = m3LimitRaw == null || m3LimitRaw <= 0 ? -1 : m3LimitRaw;
  const m2Pct = metricPercent(m2Used, m2Limit < 0 ? null : m2Limit);

  const handleExport = async () => {
    if (!analytics) return;
    const res = await portalApiFetch(`/api/analytics/export?format=csv&period=${encodeURIComponent(analytics.period)}`);
    if (!res.ok) {
      setError(t("usage.failedLoad"));
      return;
    }
    const csvBlob = await res.blob();
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helvion-analytics-${analytics.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const aiInsightUsed = aiUsage?.used ?? usageMetrics?.aiMessages.used ?? 0;
  const aiInsightLimit = aiUsage?.isUnlimited ? -1 : aiUsage?.limit ?? usageMetrics?.aiMessages.limit ?? 0;

  return (
    <div style={{ background: colors.brand.ultraLight, borderRadius: 16, padding: 20 }}>
      {loading || !billing || !usageMetrics ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
        </div>
      ) : (
        <div className="space-y-4">
          <div
            style={{
              animation: "usageFadeUp .5s ease 0s both",
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: colors.neutral[900],
                    lineHeight: 1.15,
                    fontFamily: fonts.heading,
                  }}
                >
                  {t("usage.heroTitle")}
                </h1>
                <p style={{ marginTop: 6, fontSize: 14, color: colors.neutral[500], fontFamily: fonts.body }}>
                  {t("usage.heroSubtitle")}
                </p>
                <p style={{ marginTop: 6, fontSize: 13, color: colors.neutral[400], fontFamily: fonts.body }} suppressHydrationWarning>
                  📅 {t("usage.currentPeriod")}: {usageMetrics.period} · {t("usage.resetDate")}: {new Date(usageMetrics.resetDate).toLocaleDateString(locale === "tr" ? "tr-TR" : locale === "es" ? "es-ES" : "en-US")}
                </p>
              </div>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all"
                style={{
                  background: colors.neutral.white,
                  border: `1px solid ${colors.border.warm}`,
                  color: colors.neutral[900],
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
                  fontFamily: fonts.body,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.brand.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border.warm;
                }}
              >
                <Download size={16} />
                📥 {t("usage.exportData")}
              </button>
            </div>
          </div>

          <div
            style={{
              animation: "usageFadeUp .5s ease 0.05s both",
              background: colors.neutral.white,
              border: `1px solid ${colors.border.warm}`,
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: colors.neutral[900],
                marginBottom: 12,
                fontFamily: fonts.heading,
              }}
            >
              💡 {t("usage.quickInsights")}
            </h3>
            <div style={{ borderTop: `1px solid ${colors.neutral[100]}`, paddingTop: 10 }}>
              <p style={{ color: colors.neutral[900], fontSize: 14, fontWeight: 600 }}>✅ {t("usage.insightHealthy")}</p>
              <p style={{ color: colors.neutral[400], fontSize: 12 }} suppressHydrationWarning>
                {t("usage.conversations")} %{Math.round(convPct)}
              </p>
            </div>
            {aiInsightLimit > 0 && aiPct >= 80 ? (
              <div style={{ borderTop: `1px solid ${colors.neutral[100]}`, paddingTop: 10, marginTop: 10 }}>
                <p style={{ color: colors.brand.secondary, fontSize: 14, fontWeight: 600 }}>⚠️ {t("usage.insightLimitApproaching")}</p>
                <p style={{ color: colors.neutral[400], fontSize: 12 }} suppressHydrationWarning>
                  {t("usage.m2Label")} {aiInsightUsed.toLocaleString()} / {aiInsightLimit.toLocaleString()} (%{Math.round(aiPct)})
                </p>
              </div>
            ) : null}
            {automationPct < 30 ? (
              <div style={{ borderTop: `1px solid ${colors.neutral[100]}`, paddingTop: 10, marginTop: 10 }}>
                <p style={{ color: colors.neutral[900], fontSize: 14, fontWeight: 600 }}>💡 {t("usage.insightAiLow")}</p>
                <p style={{ color: colors.neutral[400], fontSize: 12 }} suppressHydrationWarning>
                  {t("usage.m3Label")} %{Math.round(automationPct)} · {t("usage.remaining")}
                </p>
              </div>
            ) : null}
            {(isLocked || isGrace || anyFull || (alerts && alerts.domainMismatchCountPeriod > 0)) && (
              <div style={{ borderTop: `1px solid ${colors.neutral[100]}`, paddingTop: 10, marginTop: 10 }}>
                <p style={{ color: colors.brand.secondary, fontSize: 12, fontWeight: 600 }}>
                  ⚠️ {isLocked ? t("usage.locked") : isGrace ? t("usage.gracePeriod") : anyFull ? t("usage.limitReached") : t("usage.securityNotice")}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                emoji: "💬",
                label: t("usage.conversations"),
                used: usageMetrics.conversations.used,
                limit: usageMetrics.conversations.limit,
                previous: usageMetrics.conversations.lastMonthUsed,
                iconBg: "linear-gradient(135deg,#EFF6FF,#DBEAFE)",
              },
              {
                emoji: "📨",
                label: t("usage.messages"),
                used: usageMetrics.messages.used,
                limit: usageMetrics.messages.limit,
                previous: usageMetrics.messages.lastMonthUsed,
                iconBg: "linear-gradient(135deg,#F5F3FF,#EDE9FE)",
              },
              {
                emoji: "🤖",
                label: t("usage.m2Label"),
                used: usageMetrics.aiMessages.used,
                limit: usageMetrics.aiMessages.limit,
                previous: usageMetrics.aiMessages.lastMonthUsed,
                iconBg: "linear-gradient(135deg,#ECFDF5,#D1FAE5)",
              },
              {
                emoji: "⚡",
                label: t("usage.m3Label"),
                used: usageMetrics.automationReached.used,
                limit: usageMetrics.automationReached.limit,
                previous: usageMetrics.automationReached.lastMonthUsed,
                iconBg: "linear-gradient(135deg,#FFF7ED,#FFEDD5)",
              },
            ].map((metric, idx) => {
              const pct = metricPercent(metric.used, metric.limit);
              const warning = pct >= 80;
              const isUnlimited = metric.limit < 0;
              const remaining = isUnlimited ? 0 : Math.max(0, metric.limit - metric.used);
              const tone =
                pct >= 80
                  ? "linear-gradient(135deg,#EF4444,#FB7185)"
                  : pct >= 60
                  ? "linear-gradient(135deg,#F59E0B,#FBBF24)"
                  : "linear-gradient(135deg,#10B981,#34D399)";

              let trendBadge: { text: string; bg: string; color: string } = { text: "— 0%", bg: "#F1F5F9", color: "#94A3B8" };
              if (metric.previous > metric.used && metric.previous > 0) {
                trendBadge = {
                  text: `↑ ${Math.round(((metric.previous - metric.used) / metric.previous) * 100)}%`,
                  bg: "#ECFDF5",
                  color: "#059669",
                };
              } else if (metric.previous < metric.used && metric.previous > 0) {
                trendBadge = {
                  text: `↓ ${Math.round(((metric.used - metric.previous) / metric.previous) * 100)}%`,
                  bg: "#FFF1F2",
                  color: "#E11D48",
                };
              }

              return (
                <div
                  key={metric.label}
                  style={{
                    animation: `usageFadeUp .5s ease ${0.1 + idx * 0.05}s both`,
                    background: colors.neutral.white,
                    border: warning ? "1px solid #FCD34D" : "1px solid #F3E8D8",
                    borderRadius: 16,
                    padding: 20,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
                    transition: "transform .2s ease, box-shadow .2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)";
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: metric.iconBg,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 20,
                      }}
                    >
                      {metric.emoji}
                    </div>
                    <span
                      style={{
                        background: trendBadge.bg,
                        color: trendBadge.color,
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: fonts.body,
                      }}
                      title={t("usage.lastMonthValue", { value: metric.previous.toLocaleString() })}
                    >
                      {trendBadge.text}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: colors.neutral[400],
                      fontFamily: fonts.body,
                    }}
                  >
                    {metric.label}
                  </p>
                  <div className="mt-1 flex items-end gap-2" suppressHydrationWarning>
                    <span style={{ fontSize: 32, lineHeight: 1, fontWeight: 900, color: colors.neutral[900], fontFamily: fonts.heading }}>
                      {metric.used.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 16, color: colors.neutral[400], fontFamily: fonts.body }}>
                      / {isUnlimited ? t("usage.unlimited") : metric.limit.toLocaleString()}
                    </span>
                  </div>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: warning ? colors.brand.secondary : colors.neutral[400],
                      fontWeight: warning ? 600 : 500,
                      fontFamily: fonts.body,
                    }}
                    suppressHydrationWarning
                  >
                    {warning ? `⚠️ ${remaining.toLocaleString()} ${t("usage.remaining")}` : `${remaining.toLocaleString()} ${t("usage.remaining")}`}
                  </p>
                  <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: colors.neutral[100], overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${animateUsageBars ? pct : 0}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: tone,
                        transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              animation: "usageFadeUp .5s ease 0.35s both",
              background: colors.neutral.white,
              border: `1px solid ${colors.border.warm}`,
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: 20, fontWeight: 700, color: colors.neutral[900], fontFamily: fonts.heading }}>
                {t("usage.meteringBreakdown")}
              </h3>
              <span style={{ fontSize: 13, color: colors.brand.primary, fontWeight: 700 }}>{t("usage.thisMonth")} ▾</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  emoji: "💬",
                  label: "M1",
                  title: t("usage.m1Label"),
                  used: m1Used,
                  limit: m1Limit,
                  bar: "linear-gradient(135deg,#3B82F6,#60A5FA)",
                  color: "#3B82F6",
                },
                {
                  emoji: "🤖",
                  label: "M2",
                  title: t("usage.m2Label"),
                  used: m2Used,
                  limit: m2Limit,
                  bar: "linear-gradient(135deg,#EF4444,#FB7185)",
                  color: m2Pct >= 80 ? "#EF4444" : "#64748B",
                },
                {
                  emoji: "⚡",
                  label: "M3",
                  title: t("usage.m3Label"),
                  used: m3Used,
                  limit: m3Limit,
                  bar: "linear-gradient(135deg,#10B981,#34D399)",
                  color: "#F59E0B",
                },
              ].map((m, idx) => {
                const isUnlimited = m.limit == null || m.limit < 0;
                const usedDisplay = !isUnlimited && m.limit > 0 ? Math.min(m.used, m.limit) : m.used;
                const pct = metricPercent(usedDisplay, isUnlimited ? null : m.limit);
                const isReached = !isUnlimited && m.limit > 0 && usedDisplay >= m.limit;
                const warn = !isReached && pct >= 80;
                return (
                  <div
                    key={m.label}
                    style={{
                      animation: `usageFadeUp .5s ease ${0.4 + idx * 0.05}s both`,
                      background: colors.neutral.white,
                      border: `1px solid ${colors.border.warm}`,
                      borderRadius: 16,
                      padding: 22,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
                      transition: "transform .2s ease, box-shadow .2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)";
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.neutral[50], display: "grid", placeItems: "center", fontSize: 18 }}>
                        {m.emoji}
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: colors.neutral[500], letterSpacing: 0.8 }}>
                        {m.title.toUpperCase()}
                      </p>
                    </div>
                    <p style={{ fontSize: 36, lineHeight: 1, fontWeight: 900, color: colors.neutral[900], fontFamily: fonts.heading }} suppressHydrationWarning>
                      {usedDisplay.toLocaleString()}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <div style={{ flex: 1, height: 8, borderRadius: 999, background: colors.neutral[100], overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${animateUsageBars ? pct : 0}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: m.bar,
                            transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{pct.toFixed(0)}%</span>
                    </div>
                    <p
                      style={{ marginTop: 8, fontSize: 12, color: warn ? colors.brand.secondary : colors.neutral[400], fontWeight: warn ? 700 : 500 }}
                      suppressHydrationWarning
                    >
                      {isReached
                        ? `⚠️ ${t("usage.limit")} ${isUnlimited ? t("usage.unlimited") : m.limit.toLocaleString()} — ${t("usage.limitReached")}`
                        : warn
                          ? `⚠️ ${t("usage.limit")} ${isUnlimited ? t("usage.unlimited") : m.limit.toLocaleString()} — ${t("usage.approachingLimit")}`
                          : `${t("usage.limit")} ${isUnlimited ? t("usage.unlimited") : m.limit.toLocaleString()}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div
              style={{
                animation: "usageFadeUp .5s ease 0.55s both",
                background: colors.neutral.white,
                border: `1px solid ${colors.border.warm}`,
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.neutral[900], fontFamily: fonts.heading }}>
                  {t("usage.planDetails")}
                </h3>
                <span style={{ background: colors.neutral[100], color: colors.neutral[500], borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                  {usageMetrics.plan.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div style={{ background: colors.neutral[50], borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 11, color: colors.neutral[400] }}>💰 {t("billing.price")}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: colors.neutral[900] }} suppressHydrationWarning>
                    {usageMetrics.plan.price > 0 ? `${formatUsd(usageMetrics.plan.price, { decimals: 0 })}${t("billing.perMonth")}` : t("billing.free")}
                  </p>
                </div>
                <div style={{ background: colors.neutral[50], borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 11, color: colors.neutral[400] }}>💬 {t("usage.conversations")}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: colors.neutral[900] }} suppressHydrationWarning>
                    {billing?.limits?.maxConversationsPerMonth != null && billing.limits.maxConversationsPerMonth < 0
                      ? t("usage.unlimited")
                      : `${(billing?.limits?.maxConversationsPerMonth ?? 0).toLocaleString()}${t("billing.perMonth")}`}
                  </p>
                </div>
                <div style={{ background: colors.neutral[50], borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 11, color: colors.neutral[400] }}>📨 {t("usage.messages")}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: colors.neutral[900] }} suppressHydrationWarning>
                    {billing?.limits?.maxMessagesPerMonth != null && billing.limits.maxMessagesPerMonth < 0
                      ? t("usage.unlimited")
                      : `${(billing?.limits?.maxMessagesPerMonth ?? 0).toLocaleString()}${t("billing.perMonth")}`}
                  </p>
                </div>
                <div style={{ background: colors.neutral[50], borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 11, color: colors.neutral[400] }}>👥 {t("usage.agentSeats")}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: colors.neutral[900] }}>{limits?.maxAgents ?? "—"}</p>
                </div>
              </div>
              <div style={{ marginTop: 12, background: colors.status.successLight, color: colors.status.success, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>
                ✅ {t("usage.status")}: {usageMetrics.plan.status === "active" ? t("usage.planActive") : t("usage.noPlan")}
              </div>
            </div>

            <div
              style={{
                animation: "usageFadeUp .5s ease 0.6s both",
                background: "linear-gradient(135deg,#FFFBEB,#FEF3C7,#FDE68A)",
                border: "1px solid #FCD34D",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.neutral[900], fontFamily: fonts.heading }}>
                ✨ {t("billing.upgradePlan")}
              </h3>
              <p style={{ marginTop: 8, fontSize: 14, color: colors.neutral[500] }}>{t("billing.unlockPremiumFeatures")}</p>
              <div style={{ marginTop: 10, fontSize: 13, color: colors.neutral[900], lineHeight: 1.65 }}>
                <p>✅ {t("usage.m2Label")}</p>
                <p>✅ {t("usage.m3Label")}</p>
                <p>✅ {t("usage.conversations")}</p>
                <p>✅ {t("usage.messages")}</p>
              </div>
              <Link
                href="/portal/pricing"
                className="inline-flex items-center gap-2 mt-5"
                style={{
                  background: `linear-gradient(135deg,${colors.brand.primary},${colors.brand.secondary})`,
                  color: colors.neutral.white,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "14px 32px",
                  borderRadius: 12,
                  boxShadow: "0 10px 24px rgba(217,119,6,0.25)",
                  transition: "transform .2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {t("billing.viewPlans")} 🚀
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>

          {error && (
            <div style={{ background: "#FFF1F2", border: "1px solid #FBCFE8", color: "#BE123C", borderRadius: 12, padding: "10px 14px", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
      )}
      <style jsx global>{`
        @keyframes usageFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
