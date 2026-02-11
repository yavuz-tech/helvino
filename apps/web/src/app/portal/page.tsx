"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isPortalOnboardingDeferredForSession,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import MfaPolicyBanner from "@/components/MfaPolicyBanner";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import TrialBanner from "@/components/TrialBanner";
import UsageNudge from "@/components/UsageNudge";
import UpgradeModal from "@/components/UpgradeModal";
import FeatureCard from "@/components/portal/dashboard/FeatureCard";
import StatCard from "@/components/portal/dashboard/StatCard";
import {
  MessageSquare, Bot, TrendingUp, CheckCircle2, Users, BarChart3, Eye,
  Shield, CreditCard, Monitor, Smartphone, X, Lock, Crown,
  Code, Palette, Settings, ChevronRight, Send, Zap,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalTheme } from "@/styles/theme";

interface WidgetAppearance {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
}

interface OrgInfo {
  id: string;
  key: string;
  name: string;
  siteId: string;
  allowLocalhost: boolean;
  allowedDomains: string[];
  widgetEnabled: boolean;
  writeEnabled: boolean;
  aiEnabled: boolean;
  messageRetentionDays: number;
  hardDeleteOnRetention: boolean;
}

interface DashboardStats {
  conversations: { open: number; closed: number; total: number };
  messages: { today: number; thisWeek: number; thisMonth: number };
  ai: { totalResponses: number; monthlyUsage: number; monthlyLimit: number; avgResponseTimeMs: number; enabled: boolean };
  usage: { conversations: number; messages: number; humanConversations: number; aiResponses: number; visitorsReached: number };
  widget: { enabled: boolean; totalLoads: number; lastSeen: string | null };
  plan: string;
}

interface LiveVisitor {
  id: string;
  visitorKey: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  browser: string;
  os: string;
  device: string;
  currentPage: string | null;
  referrer: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  conversationCount: number;
}

interface VisitorsData {
  live: LiveVisitor[];
  recent: LiveVisitor[];
  counts: { live: number; today: number; total: number };
}

function countryToFlag(code: string | null): string {
  if (!code || code.length !== 2) return "🌐";
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + offset));
}

function timeAgo(dateStr: string, t: (key: string) => string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("common.time.now");
    if (mins < 60) return t("common.time.minutesAgo").replace("{n}", String(mins));
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("common.time.hoursAgo").replace("{n}", String(hrs));
    return t("common.time.daysAgo").replace("{n}", String(Math.floor(hrs / 24)));
  } catch {
    return "";
  }
}

export default function PortalOverviewPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [showMfaBanner, setShowMfaBanner] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [chatLoading, setChatLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [visitors, setVisitors] = useState<VisitorsData | null>(null);
  const [convCounts, setConvCounts] = useState({ unassigned: 0, myOpen: 0, solved: 0 });
  const [widgetAppearance, setWidgetAppearance] = useState<WidgetAppearance | null>(null);
  const [conversionSignals, setConversionSignals] = useState<{
    firstConversationAt: string | null;
    firstWidgetEmbedAt: string | null;
    firstInviteSentAt: string | null;
  } | null>(null);
  const [trial, setTrial] = useState<{ daysLeft: number; isExpired: boolean; isTrialing: boolean; endsAt: string | null } | null>(null);
  const [usage, setUsage] = useState<{ usedConversations: number; limitConversations: number; usedMessages: number; limitMessages: number } | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    if (!(user as PortalUser & { mfaEnabled?: boolean }).mfaEnabled) {
      portalApiFetch("/portal/security/mfa-policy")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.portalMfaRecommended) setShowMfaBanner(true); })
        .catch(() => {});
    }

    portalApiFetch("/portal/org/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.org) setOrg(d.org); })
      .catch(() => {});

    portalApiFetch("/portal/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.conversionSignals) setConversionSignals(d.conversionSignals);
        if (d?.trial) setTrial(d.trial);
        if (d?.usage) setUsage(d.usage);
      })
      .catch(() => {});

    portalApiFetch("/portal/conversations/counts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setConvCounts({ unassigned: d.unassigned ?? 0, myOpen: d.myOpen ?? 0, solved: d.solved ?? 0 });
      })
      .catch(() => {});

    portalApiFetch("/portal/dashboard/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setStats(d); })
      .catch(() => {});

    portalApiFetch("/portal/dashboard/visitors")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setVisitors(d); })
      .catch(() => {});

    portalApiFetch("/portal/widget/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.settings) setWidgetAppearance(d.settings); })
      .catch(() => {});
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    const interval = setInterval(() => {
      portalApiFetch("/portal/dashboard/visitors")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setVisitors(d); })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.showSecurityOnboarding && !isPortalOnboardingDeferredForSession()) {
      router.replace("/portal/security-onboarding");
    }
  }, [authLoading, user, router]);

  const handleStartChat = useCallback(async (visitorId: string) => {
    setChatLoading(visitorId);
    try {
      const res = await portalApiFetch(`/portal/dashboard/visitors/${visitorId}/chat`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(`/portal/inbox?c=${data.conversationId}`);
      }
    } catch {
      // ignore
    }
    setChatLoading(null);
  }, [router]);

  if (authLoading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#1A1A2E]" /></div>;
  }

  if (user?.showSecurityOnboarding && !isPortalOnboardingDeferredForSession()) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#1A1A2E]" /></div>;
  }

  const widgetConnected = !!conversionSignals?.firstWidgetEmbedAt;
  const domainsConfigured = !!org && ((org.allowedDomains?.length ?? 0) > 0 || org.allowLocalhost);
  const userName = user?.email?.split("@")[0] || "";
  const planKey = stats?.plan || "FREE";
  const isPro = planKey === "PRO" || planKey === "ENTERPRISE";

  const totalConversations = stats?.conversations.total ?? 0;
  const conversionRate = stats && stats.usage.visitorsReached > 0
    ? `${Math.round((stats.usage.conversations / Math.max(stats.usage.visitorsReached, 1)) * 100)}%`
    : "0%";
  const activeUsers = convCounts.unassigned + convCounts.myOpen;
  const customerSatisfaction = stats && stats.conversations.total > 0
    ? `${Math.round((stats.conversations.closed / Math.max(stats.conversations.total, 1)) * 100)}%`
    : "0%";
  const aiResolution = stats && stats.usage.conversations > 0
    ? `${Math.round((stats.ai.totalResponses / Math.max(stats.usage.conversations, 1)) * 100)}%`
    : "0%";
  const avgResponseTime = stats?.ai.avgResponseTimeMs
    ? `${Math.max(1, Math.round(stats.ai.avgResponseTimeMs / 1000))}${t("dashboard.artifact.shortSecond")}`
    : `0${t("dashboard.artifact.shortSecond")}`;
  const retentionRate = stats && stats.conversations.total > 0
    ? `${Math.round((stats.conversations.closed / Math.max(stats.conversations.total, 1)) * 100)}%`
    : "0%";
  const avgRating = stats && stats.conversations.total > 0
    ? (Math.min(5, (stats.conversations.closed / Math.max(stats.conversations.total, 1)) * 5)).toFixed(1)
    : "0.0";
  const mobileSessions = (visitors?.live ?? []).filter((v) => v.device === "mobile").length
    + (visitors?.recent ?? []).filter((v) => v.device === "mobile").length;

  const mainStats = [
    { emoji: "💬", value: String(totalConversations), label: t("dashboard.artifact.main.totalConversations"), gradient: "linear-gradient(135deg, #FDB462, #F59E0B)" },
    { emoji: "📈", value: conversionRate, label: t("dashboard.artifact.main.conversionRate"), gradient: "linear-gradient(135deg, #A78BFA, #8B5CF6)" },
    { emoji: "⚡", value: String(activeUsers), label: t("dashboard.artifact.main.activeUsers"), gradient: "linear-gradient(135deg, #6EE7B7, #10B981)" },
    { emoji: "🎯", value: customerSatisfaction, label: t("dashboard.artifact.main.customerSatisfaction"), gradient: "linear-gradient(135deg, #FCA5A5, #F87171)" },
  ];

  const weeklyCards = [
    { emoji: "👥", label: t("dashboard.artifact.weekly.newVisitors"), value: stats?.usage.visitorsReached ?? 0, gradient: "linear-gradient(135deg, #93C5FD, #60A5FA)" },
    { emoji: "💌", label: t("dashboard.artifact.weekly.sentMessages"), value: stats?.messages.thisWeek ?? 0, gradient: "linear-gradient(135deg, #DDD6FE, #C4B5FD)" },
    { emoji: "⏱️", label: t("dashboard.artifact.weekly.avgResponse"), value: avgResponseTime, gradient: "linear-gradient(135deg, #FED7AA, #FDBA74)" },
  ];

  return (
    <div className={`${portalTheme.page} space-y-8`}>
      <OnboardingOverlay area="portal" />

      {(showMfaBanner || (trial && (trial.isTrialing || trial.isExpired)) || usage) && (
        <div className="space-y-3">
          {showMfaBanner && <MfaPolicyBanner blocking={false} securityUrl="/portal/security" />}
          {trial && (trial.isTrialing || trial.isExpired) && (
            <TrialBanner
              daysLeft={trial.daysLeft}
              isExpired={trial.isExpired}
              isTrialing={trial.isTrialing}
              endsAt={trial.endsAt}
            />
          )}
          {usage && (
            <UsageNudge
              usedConversations={usage.usedConversations}
              limitConversations={usage.limitConversations}
              usedMessages={usage.usedMessages}
              limitMessages={usage.limitMessages}
            />
          )}
        </div>
      )}

      <section className="rounded-3xl border border-amber-200/70 bg-white/80 p-6 shadow-[0_10px_36px_rgba(245,158,11,0.12)] backdrop-blur-sm">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {`${t("portalOnboarding.greeting")}${userName ? `, ${userName}` : ""}`}
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-[var(--text-primary)]">
          {org ? `${org.name}` : "Helvion"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">{t("portalOnboarding.subtitle")}</p>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {mainStats.map((item) => (
          <StatCard key={`${item.label}-${item.emoji}`} emoji={item.emoji} value={item.value} label={item.label} gradient={item.gradient} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 2xl:grid-cols-3 lg:col-span-2">
          <FeatureCard
            icon={<span className="leading-none">🤖</span>}
            gradient="linear-gradient(135deg, #A78BFA, #8B5CF6)"
            title={t("dashboard.artifact.features.aiAgent")}
            description={t("dashboard.artifact.features.aiAgentDesc").replace("{ratio}", aiResolution)}
            href="/portal/ai"
          />
          <FeatureCard
            icon={<span className="leading-none">📊</span>}
            gradient="linear-gradient(135deg, #93C5FD, #60A5FA)"
            title={t("dashboard.artifact.features.liveAnalytics")}
            description={t("dashboard.artifact.features.liveAnalyticsDesc").replace("{count}", String(stats?.usage.visitorsReached ?? 0))}
            href="/portal/usage"
          />
          <FeatureCard
            icon={<span className="leading-none">🎨</span>}
            gradient="linear-gradient(135deg, #FED7AA, #FDBA74)"
            title={t("dashboard.artifact.features.widgetCustomization")}
            description={t("dashboard.artifact.features.widgetCustomizationDesc")}
            href="/portal/widget-appearance"
          />
          <FeatureCard
            icon={<span className="leading-none">💬</span>}
            gradient="linear-gradient(135deg, #FDB462, #F59E0B)"
            title={t("portalOnboarding.task.widget.title")}
            description={t("portalOnboarding.task.widget.desc")}
            href="/portal/widget"
          />
          <FeatureCard
            icon={<span className="leading-none">🌐</span>}
            gradient="linear-gradient(135deg, #6EE7B7, #10B981)"
            title={t("dashboard.projectStatus.domains")}
            description={t("dashboard.projectStatus.configureDomains")}
            href="/portal/security"
          />
          <FeatureCard
            icon={<span className="leading-none">🔐</span>}
            gradient="linear-gradient(135deg, #FED7AA, #FDBA74)"
            title={t("portalOnboarding.task.security.title")}
            description={t("portalOnboarding.task.security.desc")}
            href="/portal/security"
          />
        </div>
        <div className="rounded-3xl border border-amber-200/70 bg-white p-6 shadow-[0_10px_30px_rgba(26,29,35,0.08)]">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-[var(--text-primary)]">
            {t("dashboard.artifact.weekly.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("dashboard.artifact.weekly.subtitle")}</p>
          <div className="mt-5 grid grid-cols-1 gap-3">
            {weeklyCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600">{item.emoji} {item.label}</span>
                  <span className="font-[var(--font-heading)] text-xl font-bold text-[var(--text-primary)] tabular-nums">{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full" style={{ width: "100%", background: item.gradient }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          <LiveVisitorsPanel
            visitors={visitors}
            isPro={isPro}
            onStartChat={handleStartChat}
            chatLoading={chatLoading}
            onUpgrade={() => setShowUpgradeModal(true)}
            t={t}
          />

          <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900">
                  <Zap size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-slate-900">{t("dashboard.setupBanner")}</h2>
                  <p className="text-[11px] text-slate-400">{t("dashboard.setupBanner.desc")}</p>
                </div>
              </div>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 tabular-nums">
                {[widgetConnected, domainsConfigured, false, false].filter(Boolean).length}/4
              </span>
            </div>
            <div className="bg-[#FEF3E2]/45 p-2">
              {[
                { href: "/portal/widget", icon: "💬", label: t("portalOnboarding.task.widget.title"), desc: t("portalOnboarding.task.widget.desc"), done: widgetConnected },
                { href: "/portal/widget-appearance", icon: "🎨", label: t("portalOnboarding.task.appearance.title"), desc: t("portalOnboarding.task.appearance.desc"), done: false },
                { href: "/portal/security", icon: "🔐", label: t("portalOnboarding.task.security.title"), desc: t("portalOnboarding.task.security.desc"), done: domainsConfigured },
                { href: "/portal/billing", icon: "💳", label: t("portalOnboarding.task.billing.title"), desc: t("portalOnboarding.task.billing.desc"), done: false },
              ].map((task) => {
                return (
                  <Link key={task.href} href={task.href} className="group flex items-center gap-4 rounded-xl px-4 py-3.5 transition-all hover:bg-white/80">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-sm ${task.done ? "bg-gradient-to-br from-[#6EE7B7] to-[#10B981] shadow-emerald-500/20" : "bg-gradient-to-br from-[#FCA5A5] to-[#F87171] shadow-rose-500/20"}`}>
                      {task.done ? <CheckCircle2 size={18} className="text-white" /> : <span className="text-[18px] leading-none text-white">{task.icon}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-[var(--font-heading)] text-sm font-semibold ${task.done ? "text-emerald-700" : "text-slate-800"}`}>{task.label}</p>
                      <p className="mt-0.5 font-[var(--font-body)] text-[11px] text-slate-500">{task.desc}</p>
                    </div>
                    {task.done ? (
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-[var(--font-body)] text-[10px] font-bold text-emerald-700">{t("embed.completed")}</span>
                    ) : (
                      <ChevronRight size={16} className="flex-shrink-0 text-slate-300 group-hover:text-slate-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <section className="rounded-3xl border border-amber-100/70 bg-white/80 p-5 shadow-[0_10px_30px_rgba(26,29,35,0.06)] backdrop-blur-sm md:p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  key: "replied",
                  emoji: "💬",
                  label: t("dashboard.performance.repliedLive"),
                  value: stats?.usage.humanConversations ?? 0,
                  className: "border-white/50 text-slate-900 shadow-[0_10px_28px_rgba(245,158,11,0.14)]",
                  labelClassName: "text-slate-700/85",
                  background: "linear-gradient(135deg, #FFF3E0, #FFE7C2)",
                },
                {
                  key: "aiConversations",
                  emoji: "🤖",
                  label: t("dashboard.performance.aiConversations"),
                  value: stats?.ai.totalResponses ?? 0,
                  className: "border-white/50 text-slate-900 shadow-[0_10px_28px_rgba(139,92,246,0.12)]",
                  labelClassName: "text-slate-700/85",
                  background: "linear-gradient(135deg, #F2ECFF, #E6DDFF)",
                },
                {
                  key: "visitorsReached",
                  emoji: "👥",
                  label: t("dashboard.currentUsage.visitorsReached"),
                  value: stats?.usage.visitorsReached ?? 0,
                  className: "border-white/50 text-slate-900 shadow-[0_10px_28px_rgba(16,185,129,0.12)]",
                  labelClassName: "text-slate-700/85",
                  background: "linear-gradient(135deg, #E9FBF3, #D8F7EA)",
                },
                {
                  key: "retention",
                  emoji: "🔥",
                  label: t("dashboard.artifact.performance.retentionRate"),
                  value: retentionRate,
                  className: "border-white/30 text-white shadow-[0_10px_30px_rgba(245,158,11,0.22)]",
                  labelClassName: "text-white/90",
                  background: "linear-gradient(135deg, #FDB462, #F59E0B)",
                },
                {
                  key: "rating",
                  emoji: "⭐",
                  label: t("dashboard.artifact.performance.avgRating"),
                  value: avgRating,
                  className: "border-white/30 text-white shadow-[0_10px_30px_rgba(251,146,60,0.24)]",
                  labelClassName: "text-white/90",
                  background: "linear-gradient(135deg, #FDB462, #FB923C)",
                },
                {
                  key: "mobile",
                  emoji: "📱",
                  label: t("dashboard.artifact.performance.mobileSessions"),
                  value: mobileSessions,
                  className: "border-white/30 text-white shadow-[0_10px_30px_rgba(16,185,129,0.22)]",
                  labelClassName: "text-white/90",
                  background: "linear-gradient(135deg, #6EE7B7, #10B981)",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className={`rounded-2xl border px-5 py-5 transition-all duration-200 hover:-translate-y-0.5 ${item.className}`}
                  style={item.background ? { background: item.background } : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${item.labelClassName}`}>{item.label}</p>
                    <span className="text-xl leading-none">{item.emoji}</span>
                  </div>
                  <p className="mt-2 font-[var(--font-heading)] text-4xl font-bold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h3 className="font-[var(--font-heading)] text-[13px] font-bold text-slate-900">{t("dashboard.projectStatus")}</h3>
            </div>
            <div className="space-y-3.5 p-4">
              <ProjectStatusItem
                label={t("dashboard.projectStatus.chatWidget")}
                status={widgetConnected}
                statusText={widgetConnected ? t("dashboard.projectStatus.chatWidgetInstalled") : t("dashboard.projectStatus.chatWidgetNotInstalled")}
                actionText={t("dashboard.projectStatus.installWidget")}
                href="/portal/widget"
              />
              <ProjectStatusItem
                label={t("dashboard.projectStatus.aiAgent")}
                status={!!stats?.ai.enabled}
                statusText={stats?.ai.enabled ? t("dashboard.projectStatus.aiAgentActive") : t("dashboard.projectStatus.aiAgentInactive")}
                actionText={t("dashboard.projectStatus.setupAi")}
                href="/portal/ai"
              />
              <ProjectStatusItem
                label={t("dashboard.projectStatus.domains")}
                status={domainsConfigured}
                statusText={domainsConfigured ? t("dashboard.projectStatus.domainsConfigured") : t("dashboard.projectStatus.domainsNotConfigured")}
                actionText={t("dashboard.projectStatus.configureDomains")}
                href="/portal/security"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="font-[var(--font-heading)] text-[13px] font-bold text-slate-900">{t("dashboard.widgetPreview")}</h3>
              <Link href="/portal/widget-appearance" className="text-[10px] font-bold text-amber-600 transition-colors hover:text-amber-700">
                {t("dashboard.widgetPreview.customize")} →
              </Link>
            </div>
            <div className="p-4">
              {widgetAppearance ? (
                <div className="space-y-3">
                  <div className="relative min-h-[180px] overflow-hidden rounded-xl border border-amber-100 bg-white p-4">
                    <div className="origin-bottom scale-[0.85] overflow-hidden rounded-xl border border-amber-100 bg-white shadow-lg">
                      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: `linear-gradient(135deg, ${widgetAppearance.primaryColor}, ${widgetAppearance.primaryColor}dd)` }}>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20"><MessageSquare size={10} className="text-white" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[8px] font-bold text-white">{widgetAppearance.welcomeTitle}</p>
                          <p className="truncate text-[6px] text-white/70">{widgetAppearance.welcomeMessage}</p>
                        </div>
                        <X size={10} className="text-white/60" />
                      </div>
                      <div className="space-y-1.5 px-3 py-2">
                        <div className="flex items-end gap-1.5">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100"><Bot size={8} className="text-slate-400" /></div>
                          <div className="max-w-[130px] rounded-lg rounded-bl-sm bg-slate-100 px-2 py-1"><p className="text-[6px] text-slate-600">{t("dashboard.widgetPreview.title")}</p></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-1.5">
                        <div className="flex h-4 flex-1 items-center rounded bg-[#FEF3E2] px-1.5 text-[6px] text-slate-300">...</div>
                        <div className="flex h-4 w-4 items-center justify-center rounded" style={{ backgroundColor: widgetAppearance.primaryColor }}><Send size={6} className="text-white" /></div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[9px] font-medium text-slate-400">{t("dashboard.widgetPreview.totalLoads")}</p>
                      <p className="text-[15px] font-extrabold text-slate-800 tabular-nums">{(stats?.widget.totalLoads ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[9px] font-medium text-slate-400">{t("dashboard.widgetPreview.lastSeen")}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-slate-700 tabular-nums">{stats?.widget.lastSeen ? timeAgo(stats.widget.lastSeen, t) : t("dashboard.widgetPreview.never")}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50"><MessageSquare size={20} className="text-slate-300" /></div>
                  <p className="mb-1 text-[12px] font-medium text-slate-500">{t("dashboard.widgetPreview.notConfigured")}</p>
                  <Link href="/portal/widget-appearance" className="text-[11px] font-bold text-amber-600 hover:text-amber-700">{t("dashboard.widgetPreview.setupNow")} →</Link>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h3 className="font-[var(--font-heading)] text-[13px] font-bold text-slate-900">{t("dashboard.currentUsage")}</h3>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-700">{t("dashboard.currentUsage.customerService")}</span>
                  <span className="rounded bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{planKey === "FREE" ? t("dashboard.currentUsage.freeTrial") : planKey}</span>
                </div>
                <UsageBar label={t("dashboard.currentUsage.billableConversations")} used={stats?.usage.conversations ?? 0} limit={usage?.limitConversations ?? 100} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-700">{t("dashboard.quickActions.aiAgent")}</span>
                </div>
                <UsageBar label={t("dashboard.currentUsage.aiConversations")} used={stats?.ai.monthlyUsage ?? 0} limit={stats?.ai.monthlyLimit ?? 100} />
              </div>
              <Link
                href="/portal/billing"
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-[var(--font-body)] text-[12px] font-bold text-white shadow-[0_8px_20px_rgba(245,158,11,0.28)] transition-all duration-200 hover:brightness-95"
                style={{ background: "linear-gradient(135deg, #FDB462, #F59E0B)" }}
              >
                <Crown size={13} /> {t("dashboard.currentUsage.upgrade")}
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
            <div className="p-2">
              {[
                { href: "/portal/team", icon: Users, label: t("portalOnboarding.quickActions.team.title") },
                { href: "/portal/settings", icon: Settings, label: t("portalOnboarding.quickActions.settings.title") },
                { href: "/portal/audit", icon: Shield, label: t("nav.auditLogs") },
              ].map((a) => {
                const Icon = a.icon;
                return (
                  <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800">
                    <Icon size={16} className="text-slate-400" />
                    {a.label}
                    <ChevronRight size={14} className="ml-auto text-slate-300" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}

function LiveVisitorsPanel({ visitors, isPro, onStartChat, chatLoading, onUpgrade, t }: {
  visitors: VisitorsData | null;
  isPro: boolean;
  onStartChat: (id: string) => void;
  chatLoading: string | null;
  onUpgrade: () => void;
  t: (key: string) => string;
}) {
  const liveCount = visitors?.counts.live ?? 0;
  const allLive = visitors?.live ?? [];
  const allRecent = visitors?.recent ?? [];
  const FREE_LIMIT = 3;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm shadow-emerald-500/20">
              <Eye size={18} className="text-white" />
            </div>
            {liveCount > 0 && (
              <>
                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-emerald-400" />
                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
              </>
            )}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t("dashboard.liveVisitors")}</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">{t("dashboard.liveVisitors.desc")}</p>
          </div>
        </div>
      </div>

      {allLive.length === 0 && allRecent.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner"><Eye size={28} className="text-slate-300" /></div>
          <p className="mb-1 text-sm font-bold text-slate-700">{t("dashboard.liveVisitors.noVisitors")}</p>
          <p className="mx-auto max-w-xs text-xs text-slate-400">{t("dashboard.liveVisitors.noVisitorsDesc")}</p>
        </div>
      ) : (
        <div>
          {allLive.slice(0, isPro ? 50 : FREE_LIMIT).map((v) => (
            <VRow key={v.id} v={v} isLive onStartChat={onStartChat} chatLoading={chatLoading} t={t} />
          ))}
          {!isPro && allLive.length > FREE_LIMIT && (
            <div className="relative min-h-[120px]">
              <div className="absolute inset-0 flex items-center justify-center">
                <button onClick={onUpgrade} className="inline-flex items-center gap-2 rounded-xl border border-slate-700/50 bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-slate-900/25 transition-all duration-200 hover:from-slate-700 hover:to-slate-800">
                  <Crown size={14} className="text-amber-400" />
                  {t("dashboard.liveVisitors.upgradePro")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VRow({ v, isLive, onStartChat, chatLoading, t }: {
  v: LiveVisitor;
  isLive: boolean;
  onStartChat: (id: string) => void;
  chatLoading: string | null;
  t: (key: string) => string;
}) {
  const isLoading = chatLoading === v.id;
  return (
    <div className="group grid grid-cols-12 items-center gap-3 border-b border-slate-50 px-6 py-3.5 transition-colors last:border-b-0 hover:bg-amber-50/30" onClick={() => onStartChat(v.id)}>
      <div className="col-span-4 flex min-w-0 items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50 text-[18px]">{countryToFlag(v.country)}</div>
          {isLive && <span className="absolute -bottom-px -right-px h-3 w-3 rounded-full border-[1.5px] border-white bg-emerald-500" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-800">{v.city || v.country || t("common.visitor")}</p>
          <p className="text-[10px] text-slate-400">{v.conversationCount > 0 ? t("dashboard.liveVisitors.returningVisitor") : t("dashboard.liveVisitors.newVisitor")}</p>
        </div>
      </div>
      <div className="col-span-2"><span className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] font-mono text-slate-500">{v.ip || "—"}</span></div>
      <div className="col-span-2"><span className="block truncate text-[11px] text-slate-500">{v.currentPage || "/"}</span></div>
      <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-slate-500">
        {v.device === "mobile" ? <Smartphone size={12} className="text-slate-400" /> : <Monitor size={12} className="text-slate-400" />}
        <span className="truncate">{v.browser} / {v.os}</span>
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2">
        <span className="tabular-nums text-[10px] text-slate-400 group-hover:hidden">{timeAgo(v.lastSeenAt, t)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onStartChat(v.id); }}
          disabled={isLoading}
          className="hidden items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50 group-hover:flex"
        >
          {isLoading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send size={10} />}
          {t("dashboard.liveVisitors.startChat")}
        </button>
      </div>
    </div>
  );
}

function ProjectStatusItem({ label, status, statusText, actionText, href }: {
  label: string;
  status: boolean;
  statusText: string;
  actionText: string;
  href: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${status ? "bg-[#D1FAE5]" : "bg-[#FEE2E2]"}`}>
        {status ? <CheckCircle2 size={12} className="text-[#10B981]" /> : <X size={12} className="text-[#F87171]" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-[var(--font-heading)] text-[12px] font-bold text-slate-800">{label}</p>
        <p className={`font-[var(--font-body)] text-[11px] ${status ? "text-[#10B981]" : "text-[#F87171]"}`}>{statusText}</p>
        {!status && <Link href={href} className="mt-0.5 inline-block text-[11px] font-semibold text-amber-600 hover:text-amber-700">{actionText}</Link>}
      </div>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit < 0;
  const pct = isUnlimited ? 0 : Math.min(100, (used / Math.max(limit, 1)) * 100);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-[var(--font-body)] text-[11px] text-slate-500">{label}</span>
        <span className="font-[var(--font-heading)] tabular-nums text-[11px] font-bold text-slate-700">{used} / {isUnlimited ? "∞" : limit}</span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FEF3E2]">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(135deg, #FDB462, #F59E0B)" }} />
        </div>
      )}
    </div>
  );
}
