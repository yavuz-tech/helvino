"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import FeatureCard from "@/components/ui/FeatureCard";
import StatCard from "@/components/ui/StatCard";
import {
  MessageSquare, Bot, TrendingUp, CheckCircle2, Users, BarChart3, Eye,
  Shield, CreditCard, X, Lock, Crown,
  Code, Palette, Settings, ChevronRight, Send, Zap,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalTheme } from "@/styles/theme";
import { loadWidgetConfig } from "@/lib/widgetConfig";
import { colors, fonts } from "@/lib/design-tokens";

interface WidgetAppearance {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
}

interface LocalWidgetThemeOverrides {
  gradientFrom: string;
  gradientTo: string;
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
  void fonts;
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [showMfaBanner, setShowMfaBanner] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [chatLoading, setChatLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    try {
      const cached = sessionStorage.getItem("helvion_dashboard_stats");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [visitors, setVisitors] = useState<VisitorsData | null>(() => {
    try {
      const cached = sessionStorage.getItem("helvion_dashboard_visitors");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [convCounts, setConvCounts] = useState(() => {
    try {
      const cached = sessionStorage.getItem("helvion_dashboard_convCounts");
      return cached ? JSON.parse(cached) : { unassigned: 0, myOpen: 0, solved: 0 };
    } catch { return { unassigned: 0, myOpen: 0, solved: 0 }; }
  });
  const [widgetAppearance, setWidgetAppearance] = useState<WidgetAppearance | null>(null);
  const [widgetLauncherStyle, setWidgetLauncherStyle] = useState<"bubble" | "button">("bubble");
  const [widgetLauncherLabel, setWidgetLauncherLabel] = useState("");
  const [widgetThemeOverrides, setWidgetThemeOverrides] = useState<LocalWidgetThemeOverrides | null>(null);
  const [conversionSignals, setConversionSignals] = useState<{
    firstConversationAt: string | null;
    firstWidgetEmbedAt: string | null;
    firstInviteSentAt: string | null;
  } | null>(null);
  const [trial, setTrial] = useState<{ daysLeft: number; isExpired: boolean; isTrialing: boolean; endsAt: string | null } | null>(null);
  const [usage, setUsage] = useState<{ usedConversations: number; limitConversations: number; usedMessages: number; limitMessages: number } | null>(null);

  const syncLocalWidgetVisuals = useCallback(() => {
    const cfg = loadWidgetConfig();
    if (cfg) {
      setWidgetLauncherStyle(cfg.launcher.launcherStyle === "button" ? "button" : "bubble");
      setWidgetLauncherLabel(cfg.launcher.launcherLabel || "");
    }
    try {
      const raw = window.localStorage.getItem("helvino-widget-theme-overrides");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<LocalWidgetThemeOverrides>;
      if (parsed.gradientFrom && parsed.gradientTo) {
        setWidgetThemeOverrides({
          gradientFrom: parsed.gradientFrom,
          gradientTo: parsed.gradientTo,
        });
      }
    } catch {
      // ignore local parse errors
    }
  }, []);

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
        if (d) {
          const counts = { unassigned: d.unassigned ?? 0, myOpen: d.myOpen ?? 0, solved: d.solved ?? 0 };
          setConvCounts(counts);
          try { sessionStorage.setItem("helvion_dashboard_convCounts", JSON.stringify(counts)); } catch {}
        }
      })
      .catch(() => {});

    portalApiFetch(`/portal/dashboard/stats?_t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setStats(d);
          try { sessionStorage.setItem("helvion_dashboard_stats", JSON.stringify(d)); } catch {}
        }
      })
      .catch(() => {});

    portalApiFetch(`/portal/dashboard/visitors?_t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setVisitors(d);
          try { sessionStorage.setItem("helvion_dashboard_visitors", JSON.stringify(d)); } catch {}
        }
      })
      .catch(() => {});

    portalApiFetch(`/portal/widget/settings?_t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.settings) setWidgetAppearance(d.settings); })
      .catch(() => {});

    syncLocalWidgetVisuals();
  }, [authLoading, user, syncLocalWidgetVisuals]);

  useEffect(() => {
    const reloadWidgetVisuals = () => {
      portalApiFetch(`/portal/widget/settings?_t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.settings) setWidgetAppearance(d.settings); })
        .catch(() => {});
      syncLocalWidgetVisuals();
    };

    const onUpdated = () => reloadWidgetVisuals();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === "helvino-widget-config" ||
        event.key === "helvino-widget-theme-overrides"
      ) {
        reloadWidgetVisuals();
      }
    };

    window.addEventListener("widget-settings-updated", onUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("widget-settings-updated", onUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncLocalWidgetVisuals]);

  useEffect(() => {
    if (authLoading || !user) return;
    const interval = setInterval(() => {
      portalApiFetch(`/portal/dashboard/visitors?_t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setVisitors(d);
            try { sessionStorage.setItem("helvion_dashboard_visitors", JSON.stringify(d)); } catch {}
          }
        })
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
  const rawPlanKey = String(stats?.plan || "free");
  const normalizedPlanKey = rawPlanKey.trim().toLowerCase();
  const isPro = ["pro", "business", "enterprise", "unlimited"].includes(normalizedPlanKey);
  const planLabel = normalizedPlanKey === "free" ? t("dashboard.currentUsage.freeTrial") : rawPlanKey.toUpperCase();

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
  const widgetGradientFrom = widgetThemeOverrides?.gradientFrom ?? widgetAppearance?.primaryColor ?? colors.brand.primary;
  const widgetGradientTo = widgetThemeOverrides?.gradientTo ?? widgetAppearance?.primaryColor ?? colors.brand.secondary;

  const mainStats = [
    { emoji: "💬", value: String(totalConversations), label: t("dashboard.artifact.main.totalConversations"), gradient: `linear-gradient(135deg, #FDB462, ${colors.brand.primary})` },
    { emoji: "📈", value: conversionRate, label: t("dashboard.artifact.main.conversionRate"), gradient: "linear-gradient(135deg, #A78BFA, #8B5CF6)" },
    { emoji: "⚡", value: String(activeUsers), label: t("dashboard.artifact.main.activeUsers"), gradient: `linear-gradient(135deg, #6EE7B7, ${colors.status.success})` },
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
                  background: `linear-gradient(135deg, #FDB462, ${colors.brand.primary})`,
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
                  background: `linear-gradient(135deg, #6EE7B7, ${colors.status.success})`,
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
                      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: `linear-gradient(135deg, ${widgetGradientFrom}, ${widgetGradientTo})` }}>
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
                        <div className="flex h-4 items-center justify-center rounded px-1.5" style={{ background: `linear-gradient(135deg, ${widgetGradientFrom}, ${widgetGradientTo})` }}>
                          {widgetLauncherStyle === "button" ? (
                            <span className="text-[6px] font-bold text-white whitespace-nowrap">
                              {widgetLauncherLabel || t("widgetAppearance.title")}
                            </span>
                          ) : (
                            <Send size={6} className="text-white" />
                          )}
                        </div>
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
                  <span className="rounded bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{planLabel}</span>
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
                href="/portal/pricing"
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-[var(--font-body)] text-[12px] font-bold text-white shadow-[0_8px_20px_rgba(245,158,11,0.28)] transition-all duration-200 hover:brightness-95"
                style={{ background: `linear-gradient(135deg, #FDB462, ${colors.brand.primary})` }}
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
  const prevLiveCountRef = useRef(liveCount);
  const [pulseBurst, setPulseBurst] = useState(false);
  const remainingFreeVisitors = Math.max(0, allLive.length - FREE_LIMIT);
  const visibleFreeVisitors = allLive.slice(0, FREE_LIMIT);
  const blurredPreview = allLive.slice(FREE_LIMIT, FREE_LIMIT + 2);
  const recentTotal = allRecent.length;
  const recentUnique = new Set(allRecent.map((v) => v.visitorKey)).size;
  const recentAvgDurationSec = recentTotal > 0
    ? Math.round(allRecent.reduce((sum, v) => sum + getVisitorDurationSeconds(v), 0) / recentTotal)
    : 0;
  const recentConverted = allRecent.filter((v) => v.conversationCount > 0).length;
  const recentConversionRate = recentTotal > 0 ? Math.round((recentConverted / recentTotal) * 100) : 0;

  useEffect(() => {
    if (liveCount > prevLiveCountRef.current) {
      setPulseBurst(true);
      const timer = window.setTimeout(() => setPulseBurst(false), 900);
      prevLiveCountRef.current = liveCount;
      return () => window.clearTimeout(timer);
    }
    prevLiveCountRef.current = liveCount;
  }, [liveCount]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#F3E8D8] px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] text-white"
              style={{
                background: "linear-gradient(135deg, #22C55E, #16A34A)",
                boxShadow:
                  liveCount > 0
                    ? "0 3px 10px rgba(34,197,94,0.25)"
                    : "0 3px 10px rgba(34,197,94,0.12)",
              }}
            >
              <Eye size={17} />
            </div>
            <div>
              <h2 className="font-[var(--font-heading)] text-[15px] font-bold text-[#1A1D23]">
                {t("dashboard.liveVisitors")}
              </h2>
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                {liveCount > 0 ? t("dashboard.liveVisitors.activeUsers") : t("dashboard.liveVisitors.desc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPro ? (
              <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#B45309]">
                ⭐ PRO
              </span>
            ) : null}
            <span
              className={`h-2 w-2 rounded-full bg-[#22C55E] ${liveCount > 0 ? "animate-pulse" : ""}`}
              style={{ opacity: liveCount > 0 ? 1 : 0.4 }}
            />
            <span
              className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[10px] font-bold text-[#15803D]"
              style={{ opacity: liveCount > 0 ? 1 : 0.5 }}
            >
              {liveCount > 0 ? `${liveCount}` : "0"}
            </span>
          </div>
        </div>

        <div className="border-y border-[#F3E8D8] bg-gradient-to-r from-[#F0FDF4] via-[#F8FAFC] to-[#F0FDF4] px-0 py-0">
          <PulseMonitorCanvas visitorCount={liveCount} pulseBoost={pulseBurst} />
        </div>

        {liveCount === 0 ? (
          <div className="border-t border-[#F3E8D8] px-6 py-5 text-center">
            <p className="text-[12px] font-semibold text-[#B0B8C4]">{t("dashboard.liveVisitors.noVisitors")}</p>
            <p className="mt-[3px] text-[11px] text-[#CBD5E1]">{t("dashboard.liveVisitors.noVisitorsDesc")}</p>
          </div>
        ) : (
          <>
            {isPro ? (
              <div
                className={`${allLive.length > 5 ? "max-h-[320px] overflow-y-auto live-visitors-scrollbar" : ""}`}
              >
                {allLive.map((v) => (
                  <LiveVisitorRow
                    key={v.id}
                    v={v}
                    isLive
                    onStartChat={onStartChat}
                    chatLoading={chatLoading}
                    t={t}
                  />
                ))}
              </div>
            ) : (
            <div>
                {visibleFreeVisitors.map((v) => (
                  <LiveVisitorRow
                    key={v.id}
                    v={v}
                    isLive
                    onStartChat={onStartChat}
                    chatLoading={chatLoading}
                    t={t}
                  />
                ))}
                {remainingFreeVisitors > 0 ? (
                  <div className="relative overflow-hidden border-t border-[#F3E8D8]">
                    {blurredPreview.map((v, index) => (
                      <div
                        key={`blurred-${v.id}`}
                        style={{
                          filter: `blur(${index === 0 ? 3 : 4.5}px)`,
                          opacity: index === 0 ? 0.75 : 0.65,
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      >
                        <LiveVisitorRow
                          v={v}
                          isLive
                          onStartChat={onStartChat}
                          chatLoading={chatLoading}
                          t={t}
                        />
                      </div>
                    ))}
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.85)_70%)]">
                      <div className="rounded-[14px] border border-[#F3E8D8] bg-white px-5 py-4 text-center shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                          <Lock size={14} />
                        </div>
                        <p className="text-[12px] font-bold text-[#1A1D23]">
                          {t("dashboard.liveVisitors.moreOnline").replace("{count}", String(remainingFreeVisitors))}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#94A3B8]">{t("dashboard.liveVisitors.unlockAll")}</p>
                        <button
                          type="button"
                          onClick={onUpgrade}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-bold text-white shadow-[0_8px_18px_rgba(245,158,11,0.28)]"
                        >
                          {t("dashboard.liveVisitors.upgradeCta")}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            {isPro && allLive.length > 5 ? (
              <p className="border-t border-[#F3E8D8] px-6 py-2 text-center text-[11px] text-[#94A3B8]">
                {t("dashboard.liveVisitors.scrollHint")}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#F3E8D8] px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] text-white"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
            >
              <BarChart3 size={16} />
            </div>
            <div>
              <h3 className="font-[var(--font-heading)] text-[15px] font-bold text-[#1A1D23]">
                {t("dashboard.liveVisitors.recentVisitors")}
              </h3>
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">{t("dashboard.liveVisitors.recentDesc")}</p>
            </div>
          </div>
          <span className="rounded-full bg-[#F3E8FF] px-2.5 py-0.5 text-[10px] font-bold text-[#6D28D9]">
            {`${recentTotal} ${t("dashboard.liveVisitors.visitsBadge")}`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-[#F3E8D8] px-6 py-4 md:grid-cols-3">
          <MiniStat
            icon="👤"
            color="#7C3AED"
            label={t("dashboard.liveVisitors.uniqueVisitors")}
            value={String(recentUnique)}
          />
          <MiniStat
            icon="⏱"
            color="#6D28D9"
            label={t("dashboard.liveVisitors.avgDuration")}
            value={formatDurationShort(recentAvgDurationSec, t)}
          />
          <MiniStat
            icon="🎯"
            color="#22C55E"
            label={t("dashboard.liveVisitors.conversionRate")}
            value={`%${recentConversionRate}`}
          />
        </div>

        <div className="px-3 py-2">
          {allRecent.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-[#A0AAB8]">
              {t("dashboard.liveVisitors.noRecent")}
            </div>
          ) : (
            allRecent.slice(0, 8).map((v, index) => (
              <RecentVisitorRow key={`recent-${v.id}`} v={v} index={index} t={t} />
            ))
          )}
        </div>
        <div className="border-t border-[#F3E8D8] px-6 py-3">
          <Link href="/portal/usage" className="text-[12px] font-semibold text-[#8B5CF6] hover:text-[#6D28D9]">
            {t("dashboard.liveVisitors.viewHistory")}
          </Link>
        </div>
      </div>
      <style jsx>{`
        .live-visitors-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #e8ded0 transparent;
        }
        .live-visitors-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .live-visitors-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .live-visitors-scrollbar::-webkit-scrollbar-thumb {
          background: #e8ded0;
          border-radius: 999px;
        }
      `}</style>
    </>
  );
}

function PulseMonitorCanvas({
  visitorCount,
  pulseBoost,
}: {
  visitorCount: number;
  pulseBoost: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;

    const setupCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) return;

      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, width, 0);
      bg.addColorStop(0, "rgba(34,197,94,0.035)");
      bg.addColorStop(0.5, "rgba(255,255,255,0.22)");
      bg.addColorStop(1, "rgba(34,197,94,0.035)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const mid = height / 2;
      const segW = Math.max(80, 220 - visitorCount * 16);
      const ampRatio = Math.min(0.42, 0.15 + visitorCount * 0.05) * (pulseBoost ? 1.1 : 1);
      const amp = Math.min(height * 0.42, height * ampRatio);
      const lineWidth = Math.min(2.8, 1.5 + visitorCount * 0.15);
      const glowAlpha = Math.min(0.25, 0.06 + visitorCount * 0.025) * (pulseBoost ? 1.2 : 1);
      const glowWidth = 4 + Math.min(visitorCount * 0.6, 4);
      const speed = visitorCount > 0 ? Math.min(0.8, 0.2 + visitorCount * 0.05) : 0.15;

      const drawHeartbeatSegment = (baseX: number, first: boolean) => {
        const u = segW / 12;
        if (first) ctx.moveTo(baseX, mid);
        else ctx.lineTo(baseX, mid);
        ctx.lineTo(baseX + u * 2, mid);
        ctx.lineTo(baseX + u * 3, mid - amp * 0.24);
        ctx.lineTo(baseX + u * 4, mid);
        ctx.lineTo(baseX + u * 5, mid + amp * 0.2);
        ctx.lineTo(baseX + u * 5.6, mid - amp * 1.25);
        ctx.lineTo(baseX + u * 6.25, mid + amp * 1.45);
        ctx.lineTo(baseX + u * 7.2, mid - amp * 0.35);
        ctx.lineTo(baseX + u * 8.2, mid);
        ctx.lineTo(baseX + u * 12, mid);
      };

      const offset = offsetRef.current;
      if (visitorCount === 0) {
        const phase = offset % Math.max(width, 1);
        const flatlineGradient = ctx.createLinearGradient(-phase, 0, width - phase, 0);
        flatlineGradient.addColorStop(0, "rgba(34,197,94,0.28)");
        flatlineGradient.addColorStop(0.5, "rgba(34,197,94,0.36)");
        flatlineGradient.addColorStop(1, "rgba(34,197,94,0.28)");
        ctx.strokeStyle = flatlineGradient;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(width, mid);
        ctx.stroke();
      } else {
        const phase = offset % segW;
        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = glowWidth * 0.6;
        ctx.shadowColor = `rgba(34,197,94,${glowAlpha * 0.65})`;
        ctx.beginPath();
        let first = true;
        for (let x = -segW; x < width + segW * 2; x += segW) {
          drawHeartbeatSegment(x - phase, first);
          first = false;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      offsetRef.current += speed;
    };

    const render = () => {
      draw();
      if (!reducedMotion) {
        animationRef.current = window.requestAnimationFrame(render);
      }
    };

    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      if (reducedMotion) {
        if (animationRef.current) {
          window.cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        draw();
      } else if (!animationRef.current) {
        animationRef.current = window.requestAnimationFrame(render);
      }
    };

    setupCanvas();
    render();
    window.addEventListener("resize", setupCanvas);
    reducedMotionQuery.addEventListener("change", onMotionChange);

    return () => {
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      window.removeEventListener("resize", setupCanvas);
      reducedMotionQuery.removeEventListener("change", onMotionChange);
    };
  }, [visitorCount, pulseBoost]);

  return <canvas ref={canvasRef} className="h-12 w-full" aria-hidden="true" />;
}

function deriveVisitorStatus(visitor: LiveVisitor): "browsing" | "reading" | "form" | "idle" {
  const page = (visitor.currentPage || "").toLowerCase();
  const inactiveForMs = Date.now() - new Date(visitor.lastSeenAt).getTime();
  if (inactiveForMs > 5 * 60 * 1000) return "idle";
  if (/(form|checkout|sign|register|contact)/.test(page)) return "form";
  if (/(blog|docs|article|help|pricing|terms|privacy|faq)/.test(page)) return "reading";
  return "browsing";
}

function getVisitorDurationSeconds(visitor: LiveVisitor): number {
  const first = new Date(visitor.firstSeenAt).getTime();
  const last = new Date(visitor.lastSeenAt).getTime();
  if (Number.isNaN(first) || Number.isNaN(last) || last <= first) return 30;
  return Math.max(10, Math.floor((last - first) / 1000));
}

function formatDurationShort(sec: number, t: (key: string) => string): string {
  const safe = Math.max(0, sec);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes <= 0) return `${seconds}${t("dashboard.liveVisitors.shortSecond")}`;
  if (seconds === 0) return `${minutes}${t("dashboard.liveVisitors.shortMinute")}`;
  return `${minutes}${t("dashboard.liveVisitors.shortMinute")} ${seconds}${t("dashboard.liveVisitors.shortSecond")}`;
}

function LiveVisitorRow({ v, isLive, onStartChat, chatLoading, t }: {
  v: LiveVisitor;
  isLive: boolean;
  onStartChat: (id: string) => void;
  chatLoading: string | null;
  t: (key: string) => string;
}) {
  const isLoading = chatLoading === v.id;
  const status = deriveVisitorStatus(v);
  const statusMap = {
    browsing: { dot: "#22C55E", label: t("dashboard.liveVisitors.statusBrowsing"), bg: "rgba(34,197,94,0.08)", text: "#15803D" },
    reading: { dot: "#3B82F6", label: t("dashboard.liveVisitors.statusReading"), bg: "rgba(59,130,246,0.08)", text: "#1D4ED8" },
    form: { dot: "#F59E0B", label: t("dashboard.liveVisitors.statusForm"), bg: "rgba(245,158,11,0.12)", text: "#B45309" },
    idle: { dot: "#94A3B8", label: t("dashboard.liveVisitors.statusIdle"), bg: "rgba(148,163,184,0.12)", text: "#64748B" },
  } as const;
  const ui = statusMap[status];

  return (
    <div
      className="group relative grid grid-cols-12 items-center gap-3 border-b border-[#F3E8D8] px-5 py-3 transition-colors last:border-b-0 hover:bg-[#FFFBF5]"
      onClick={() => onStartChat(v.id)}
    >
      <div className="col-span-4 flex min-w-0 items-center gap-2.5">
        <span className="flex w-8 justify-center text-xl leading-none">{countryToFlag(v.country)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#1A1D23]">
            {v.city || v.country || t("dashboard.liveVisitors.visitor")}
          </p>
          <p className="truncate font-mono text-xs text-[#CBD5E1]">{v.ip || "—"}</p>
        </div>
      </div>
      <div className="col-span-3 min-w-0">
        <span className="inline-block max-w-full truncate rounded-[5px] border border-[#F1F5F9] bg-[#F8FAFC] px-2 py-1 font-mono text-xs text-[#64748B]">
          {v.currentPage || "/"}
        </span>
      </div>
      <div className="col-span-2 min-w-0 truncate text-xs text-[#B0B8C4]">
        {v.browser} / {v.os}
      </div>
      <div className="col-span-2 text-sm font-semibold tabular-nums text-[#64748B]">
        {formatDurationShort(getVisitorDurationSeconds(v), t)}
      </div>
      <div className="col-span-1 flex justify-end">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: ui.bg, color: ui.text }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ui.dot }} />
          {ui.label}
        </span>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onStartChat(v.id);
        }}
        disabled={isLoading}
        className="absolute right-4 top-1/2 inline-flex -translate-y-1/2 translate-x-2 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#22C55E] to-[#16A34A] px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-[0_8px_18px_rgba(34,197,94,0.28)] transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 disabled:opacity-50"
      >
        {isLoading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <MessageSquare size={11} />
        )}
        {t("dashboard.liveVisitors.sendMessage")}
      </button>
      {isLive ? (
        <span className="pointer-events-none absolute left-2 top-2 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      ) : null}
    </div>
  );
}

function MiniStat({
  icon,
  color,
  label,
  value,
}: {
  icon: string;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#F3E8D8] bg-[#FAFAFA] px-3 py-[10px]">
      <p className="text-xs font-semibold" style={{ color }}>
        {icon} {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[#1A1D23] tabular-nums">{value}</p>
    </div>
  );
}

function RecentVisitorRow({
  v,
  index,
  t,
}: {
  v: LiveVisitor;
  index: number;
  t: (key: string) => string;
}) {
  const converted = v.conversationCount > 0;
  const opacity = Math.max(0.45, 0.65 - index * 0.03);
  return (
    <div
      className="flex items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-[#FAFAFA] hover:opacity-90"
      style={{ opacity }}
    >
      <div className="min-w-0 flex items-center gap-2.5">
        <span className="text-lg leading-none" style={{ filter: "grayscale(0.4)" }}>
          {countryToFlag(v.country)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#78829B]">
            {v.city || v.country || t("dashboard.liveVisitors.visitor")}
          </p>
          <p className="truncate text-xs text-[#A0AAB8]">
            {v.currentPage || "/"} · {timeAgo(v.lastSeenAt, t)}
          </p>
        </div>
      </div>
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          color: converted ? "#78829B" : "#A0AAB8",
          background: converted
            ? "rgba(148,163,184,0.08)"
            : "rgba(148,163,184,0.06)",
        }}
      >
        {converted
          ? t("dashboard.liveVisitors.converted")
          : t("dashboard.liveVisitors.left")}
      </span>
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
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: `linear-gradient(135deg, #FDB462, ${colors.brand.primary})` }}
          />
        </div>
      )}
    </div>
  );
}
