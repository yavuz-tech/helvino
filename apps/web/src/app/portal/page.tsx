"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import MfaPolicyBanner from "@/components/MfaPolicyBanner";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import TrialBanner from "@/components/TrialBanner";
import UsageNudge from "@/components/UsageNudge";
import UpgradeModal from "@/components/UpgradeModal";
import Badge from "@/components/Badge";
import {
  MessageSquare, Bot, Sparkles, Zap, TrendingUp,
  CheckCircle2, Users, BarChart3, Eye,
  Shield, CreditCard,
  Monitor, Smartphone, X, Lock, Crown,
  Code, Palette, Settings, ChevronRight, Send,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { portalTheme } from "@/styles/theme";

/* ── Types ── */
interface WidgetAppearance {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
}

interface OrgInfo {
  id: string; key: string; name: string; siteId: string;
  allowLocalhost: boolean; allowedDomains: string[];
  widgetEnabled: boolean; writeEnabled: boolean; aiEnabled: boolean;
  messageRetentionDays: number; hardDeleteOnRetention: boolean;
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
  id: string; visitorKey: string; ip: string | null; country: string | null;
  city: string | null; browser: string; os: string; device: string;
  currentPage: string | null; referrer: string | null;
  firstSeenAt: string; lastSeenAt: string; conversationCount: number;
}

interface VisitorsData {
  live: LiveVisitor[];
  recent: LiveVisitor[];
  counts: { live: number; today: number; total: number };
}

/* ── Country flag helper ── */
function countryToFlag(code: string | null): string {
  if (!code || code.length !== 2) return "\uD83C\uDF10"; // globe
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
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
  } catch { return ""; }
}

/* ═══════════════════════════════════════════════════ */
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
    firstConversationAt: string | null; firstWidgetEmbedAt: string | null; firstInviteSentAt: string | null;
  } | null>(null);
  const [trial, setTrial] = useState<{ daysLeft: number; isExpired: boolean; isTrialing: boolean; endsAt: string | null } | null>(null);
  const [usage, setUsage] = useState<{ usedConversations: number; limitConversations: number; usedMessages: number; limitMessages: number } | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    if (!(user as PortalUser & { mfaEnabled?: boolean }).mfaEnabled) {
      portalApiFetch("/portal/security/mfa-policy").then(r => r.ok ? r.json() : null).then(d => { if (d?.portalMfaRecommended) setShowMfaBanner(true); }).catch(() => {});
    }

    portalApiFetch("/portal/org/me").then(r => r.ok ? r.json() : null).then(d => { if (d?.org) setOrg(d.org); }).catch(() => {});
    portalApiFetch("/portal/billing/status").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.conversionSignals) setConversionSignals(d.conversionSignals);
      if (d?.trial) setTrial(d.trial);
      if (d?.usage) setUsage(d.usage);
    }).catch(() => {});
    portalApiFetch("/portal/conversations/counts").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setConvCounts({ unassigned: d.unassigned ?? 0, myOpen: d.myOpen ?? 0, solved: d.solved ?? 0 });
    }).catch(() => {});
    portalApiFetch("/portal/dashboard/stats").then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); }).catch(() => {});
    portalApiFetch("/portal/dashboard/visitors").then(r => r.ok ? r.json() : null).then(d => { if (d) setVisitors(d); }).catch(() => {});
    portalApiFetch("/portal/widget/settings").then(r => r.ok ? r.json() : null).then(d => { if (d?.settings) setWidgetAppearance(d.settings); }).catch(() => {});
  }, [authLoading, user]);

  // Poll visitors every 30s
  useEffect(() => {
    if (authLoading || !user) return;
    const interval = setInterval(() => {
      portalApiFetch("/portal/dashboard/visitors").then(r => r.ok ? r.json() : null).then(d => { if (d) setVisitors(d); }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [authLoading, user]);

  const widgetConnected = !!conversionSignals?.firstWidgetEmbedAt;
  const domainsConfigured = !!org && ((org.allowedDomains?.length ?? 0) > 0 || org.allowLocalhost);
  const userName = user?.email?.split("@")[0] || "";
  const planKey = stats?.plan || "FREE";
  const isPro = planKey === "PRO" || planKey === "ENTERPRISE";

  const handleStartChat = useCallback(async (visitorId: string) => {
    setChatLoading(visitorId);
    try {
      const res = await portalApiFetch(`/portal/dashboard/visitors/${visitorId}/chat`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(`/portal/inbox?c=${data.conversationId}`);
      }
    } catch { /* ignore */ }
    setChatLoading(null);
  }, [router]);

  if (authLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#1A1A2E] animate-spin" /></div>;
  }

  return (
    <div className={`${portalTheme.page} space-y-6`}>
      <OnboardingOverlay area="portal" />

      {/* ═══ Alerts ═══ */}
      {(showMfaBanner || (trial && (trial.isTrialing || trial.isExpired)) || usage) && (
        <div className="space-y-3">
          {showMfaBanner && <MfaPolicyBanner blocking={false} securityUrl="/portal/security" />}
          {trial && (trial.isTrialing || trial.isExpired) && (
            <TrialBanner daysLeft={trial.daysLeft} isExpired={trial.isExpired} isTrialing={trial.isTrialing} endsAt={trial.endsAt} />
          )}
          {usage && <UsageNudge usedConversations={usage.usedConversations} limitConversations={usage.limitConversations} usedMessages={usage.usedMessages} limitMessages={usage.limitMessages} />}
        </div>
      )}

      <PageHeader
        title={`${t("portalOnboarding.greeting")}${userName ? `, ${userName}` : ""}`}
        subtitle={`${t("portalOnboarding.subtitle")}${org ? ` — ${org.name}` : ""}`}
        action={
          trial && trial.isTrialing ? (
            <Link href="/portal/billing" className={portalTheme.primaryButton}>
              <Crown size={14} />
              {t("billing.upgrade")}
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard label={t("dashboard.performance.interactions")} value={String(stats?.messages.thisMonth ?? 0)} icon={MessageSquare} />
        <StatCard
          label={t("dashboard.performance.aiResolution")}
          value={stats && stats.usage.conversations > 0 ? `${Math.round((stats.ai.totalResponses / Math.max(stats.usage.conversations, 1)) * 100)}%` : "0%"}
          icon={Bot}
        />
        <StatCard label={t("dashboard.performance.leadsAcquired")} value={String(stats?.usage.visitorsReached ?? 0)} icon={TrendingUp} />
      </div>

      {/* ═══ MAIN LAYOUT: Content + Sidebar ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── LEFT COLUMN (3/4) ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Quick Actions Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/portal/inbox" className="group relative bg-gradient-to-br from-blue-50/60 to-indigo-50/30 rounded-2xl border border-blue-100/50 p-5 hover:shadow-lg hover:border-blue-200/60 transition-all duration-300">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3 shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <MessageSquare size={20} className="text-white" />
              </div>
              <p className="text-sm font-bold text-slate-800">{t("dashboard.quickActions.liveConversations")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t("dashboard.quickActions.liveConversationsDesc").replace("{count}", String(convCounts.unassigned))}</p>
            </Link>

            <Link href="/portal/ai" className="group relative bg-gradient-to-br from-violet-50/60 to-purple-50/30 rounded-2xl border border-violet-100/50 p-5 hover:shadow-lg hover:border-violet-200/60 transition-all duration-300">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-3 shadow-sm shadow-violet-500/20 group-hover:scale-105 transition-transform">
                <Bot size={20} className="text-white" />
              </div>
              <p className="text-sm font-bold text-slate-800">{t("dashboard.quickActions.aiAgent")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t("dashboard.quickActions.aiAgentDesc")}</p>
            </Link>

            <div className="group relative bg-gradient-to-br from-emerald-50/60 to-teal-50/30 rounded-2xl border border-emerald-100/50 p-5 hover:shadow-lg hover:border-emerald-200/60 transition-all duration-300 cursor-default">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Eye size={20} className="text-white" />
              </div>
              <p className="text-sm font-bold text-slate-800">{t("dashboard.quickActions.liveVisitors")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t("dashboard.quickActions.liveVisitorsDesc").replace("{count}", String(visitors?.counts.live ?? 0))}</p>
            </div>

            <Link href="/portal/usage" className="group relative bg-gradient-to-br from-amber-50/60 to-orange-50/30 rounded-2xl border border-amber-100/50 p-5 hover:shadow-lg hover:border-amber-200/60 transition-all duration-300">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-3 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <BarChart3 size={20} className="text-white" />
              </div>
              <p className="text-sm font-bold text-slate-800">{t("portalOnboarding.quickActions.usage.title")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stats?.messages.thisMonth ?? 0} {t("common.abbrev.messages")}</p>
            </Link>
          </div>

          {/* Performance Section */}
          <div className="space-y-4">

            {/* Insight tip */}
            <div className="flex items-center gap-3 px-5 py-3 bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg text-[10px] font-bold text-blue-600 flex-shrink-0">
                <Sparkles size={10} /> {t("dashboard.insight")}
              </div>
              <p className="text-[12px] text-slate-500 flex-1">{t("dashboard.insight.proactive")} <Link href="/portal/inbox" className="text-[#1A1A2E] hover:underline font-semibold">{t("dashboard.insight.chatWithVisitors")}</Link></p>
            </div>

            {/* 3 stat cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: t("dashboard.performance.interactions"),
                  value: stats?.messages.thisMonth ?? 0,
                  icon: <MessageSquare size={16} />,
                  iconBg: "bg-[#1A1A2E]",
                  tint: "from-slate-50/80 to-blue-50/40",
                  border: "border-slate-200/70",
                },
                {
                  label: t("dashboard.performance.aiResolution"),
                  value: stats && stats.usage.conversations > 0
                    ? `${Math.round((stats.ai.totalResponses / Math.max(stats.usage.conversations, 1)) * 100)}%`
                    : "0%",
                  icon: <Bot size={16} />,
                  iconBg: "bg-emerald-600",
                  tint: "from-emerald-50/50 to-teal-50/30",
                  border: "border-emerald-100/50",
                },
                {
                  label: t("dashboard.performance.leadsAcquired"),
                  value: stats?.usage.visitorsReached ?? 0,
                  icon: <TrendingUp size={16} />,
                  iconBg: "bg-amber-600",
                  tint: "from-amber-50/50 to-orange-50/30",
                  border: "border-amber-100/50",
                },
              ].map((card, i) => (
                <div key={i} className={`bg-gradient-to-br ${card.tint} rounded-2xl border ${card.border} p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(26,26,46,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_12px_32px_rgba(26,26,46,0.08)] transition-shadow`}>
                  <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center mb-4`}>
                    <span className="text-white">{card.icon}</span>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 leading-none tabular-nums mb-1.5">{card.value}</p>
                  <p className="text-[11px] font-medium text-slate-400">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Bottom metrics row */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] grid grid-cols-4 divide-x divide-slate-100">
              {[
                { label: t("dashboard.performance.repliedLive"), value: stats?.usage.humanConversations ?? 0, dot: "bg-[#1A1A2E]" },
                { label: t("dashboard.performance.aiConversations"), value: stats?.ai.totalResponses ?? 0, dot: "bg-emerald-500" },
                { label: t("dashboard.currentUsage.visitorsReached"), value: stats?.usage.visitorsReached ?? 0, dot: "bg-amber-500" },
                { label: t("dashboard.performance.interactions"), value: stats?.messages.today ?? 0, dot: "bg-blue-500" },
              ].map((item, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.dot}`} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-600 truncate">{item.label}</p>
                    <p className="text-base font-semibold text-slate-800 tabular-nums mt-0.5">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ Live Visitors Section ═══ */}
          <LiveVisitorsPanel
            visitors={visitors}
            isPro={isPro}
            onStartChat={handleStartChat}
            chatLoading={chatLoading}
            onUpgrade={() => setShowUpgradeModal(true)}
            t={t}
          />

          {/* Setup Checklist (compact) */}
          <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <Zap size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-slate-900">{t("dashboard.setupBanner")}</h2>
                  <p className="text-[11px] text-slate-400">{t("dashboard.setupBanner.desc")}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg tabular-nums">
                {[widgetConnected, domainsConfigured, false, false].filter(Boolean).length}/4
              </span>
            </div>
            <div className="p-2">
              {[
                { href: "/portal/widget", icon: Code, label: t("portalOnboarding.task.widget.title"), desc: t("portalOnboarding.task.widget.desc"), done: widgetConnected, gradient: "from-blue-500 to-blue-600" },
                { href: "/portal/widget-appearance", icon: Palette, label: t("portalOnboarding.task.appearance.title"), desc: t("portalOnboarding.task.appearance.desc"), done: false, gradient: "from-pink-500 to-rose-600" },
                { href: "/portal/security", icon: Shield, label: t("portalOnboarding.task.security.title"), desc: t("portalOnboarding.task.security.desc"), done: domainsConfigured, gradient: "from-emerald-500 to-teal-600" },
                { href: "/portal/billing", icon: CreditCard, label: t("portalOnboarding.task.billing.title"), desc: t("portalOnboarding.task.billing.desc"), done: false, gradient: "from-violet-500 to-purple-600" },
              ].map(task => {
                const Icon = task.icon;
                return (
                  <Link key={task.href} href={task.href} className="group flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-slate-50/80 transition-all">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${task.done ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20" : `bg-gradient-to-br ${task.gradient}`}`}>
                      {task.done ? <CheckCircle2 size={18} className="text-white" /> : <Icon size={18} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${task.done ? "text-emerald-700" : "text-slate-800"}`}>{task.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{task.desc}</p>
                    </div>
                    {task.done ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">{t("embed.completed")}</span>
                    ) : (
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR (1/4) ── */}
        <div className="space-y-5">

          {/* Project Status */}
          <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-[13px] font-bold text-slate-900">{t("dashboard.projectStatus")}</h3>
            </div>
            <div className="p-4 space-y-3.5">
              {/* Chat Widget */}
              <ProjectStatusItem
                label={t("dashboard.projectStatus.chatWidget")}
                status={widgetConnected}
                statusText={widgetConnected ? t("dashboard.projectStatus.chatWidgetInstalled") : t("dashboard.projectStatus.chatWidgetNotInstalled")}
                actionText={t("dashboard.projectStatus.installWidget")}
                href="/portal/widget"
              />
              {/* AI Agent */}
              <ProjectStatusItem
                label={t("dashboard.projectStatus.aiAgent")}
                status={!!stats?.ai.enabled}
                statusText={stats?.ai.enabled ? t("dashboard.projectStatus.aiAgentActive") : t("dashboard.projectStatus.aiAgentInactive")}
                actionText={t("dashboard.projectStatus.setupAi")}
                href="/portal/ai"
              />
              {/* Domains */}
              <ProjectStatusItem
                label={t("dashboard.projectStatus.domains")}
                status={domainsConfigured}
                statusText={domainsConfigured ? t("dashboard.projectStatus.domainsConfigured") : t("dashboard.projectStatus.domainsNotConfigured")}
                actionText={t("dashboard.projectStatus.configureDomains")}
                href="/portal/security"
              />
              {/* Channels */}
              <div className="pt-2 border-t border-slate-50">
                <p className="text-[11px] text-slate-400 mb-2">{t("dashboard.projectStatus.addChannel")}</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center cursor-default" title={t("channels.webWidget")}>
                    <MessageSquare size={14} className="text-blue-500" />
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center cursor-not-allowed opacity-40" title={t("channels.whatsappComingSoon")}>
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center cursor-not-allowed opacity-40" title={t("channels.instagramComingSoon")}>
                    <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Widget Preview */}
          <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-slate-900">{t("dashboard.widgetPreview")}</h3>
              <Link href="/portal/widget-appearance" className="text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                {t("dashboard.widgetPreview.customize")} →
              </Link>
            </div>
            <div className="p-4">
              {widgetAppearance ? (
                <div className="space-y-3">
                  {/* Mini widget preview */}
                  <div className="relative bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 flex items-end justify-center min-h-[180px] overflow-hidden">
                    {/* Mini chat window preview */}
                    <div className="w-[200px] rounded-xl shadow-lg overflow-hidden border border-slate-200/80 bg-white transform scale-[0.85] origin-bottom">
                      {/* Header */}
                      <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${widgetAppearance.primaryColor}, ${widgetAppearance.primaryColor}dd)` }}>
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                          <MessageSquare size={10} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-bold text-white truncate">{widgetAppearance.welcomeTitle}</p>
                          <p className="text-[6px] text-white/70 truncate">{widgetAppearance.welcomeMessage}</p>
                        </div>
                        <X size={10} className="text-white/60" />
                      </div>
                      {/* Body */}
                      <div className="px-3 py-2 space-y-1.5">
                        <div className="flex gap-1.5 items-end">
                          <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Bot size={8} className="text-slate-400" />
                          </div>
                          <div className="bg-slate-100 rounded-lg rounded-bl-sm px-2 py-1 max-w-[130px]">
                            <p className="text-[6px] text-slate-600">{t("dashboard.widgetPreview.title")}</p>
                          </div>
                        </div>
                      </div>
                      {/* Input bar */}
                      <div className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-1.5">
                        <div className="flex-1 h-4 bg-slate-50 rounded text-[6px] px-1.5 flex items-center text-slate-300">...</div>
                        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: widgetAppearance.primaryColor }}>
                          <Send size={6} className="text-white" />
                        </div>
                      </div>
                      {/* Branding */}
                      {widgetAppearance.brandName && (
                        <div className="px-3 py-1 text-center">
                          <p className="text-[5px] text-slate-300">{widgetAppearance.brandName}</p>
                        </div>
                      )}
                    </div>
                    {/* Launcher bubble */}
                    <div
                      className={`absolute bottom-3 ${widgetAppearance.position === "left" ? "left-3" : "right-3"} w-10 h-10 rounded-full shadow-lg flex items-center justify-center`}
                      style={{ backgroundColor: widgetAppearance.primaryColor }}
                    >
                      <MessageSquare size={16} className="text-white" />
                    </div>
                  </div>

                  {/* Widget Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[9px] text-slate-400 font-medium">{t("dashboard.widgetPreview.totalLoads")}</p>
                      <p className="text-[15px] font-extrabold text-slate-800 tabular-nums">{(stats?.widget.totalLoads ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[9px] text-slate-400 font-medium">{t("dashboard.widgetPreview.lastSeen")}</p>
                      <p className="text-[11px] font-bold text-slate-700 tabular-nums mt-0.5">
                        {stats?.widget.lastSeen ? timeAgo(stats.widget.lastSeen, t) : t("dashboard.widgetPreview.never")}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[9px] text-slate-400 font-medium">{t("dashboard.widgetPreview.position")}</p>
                      <p className="text-[11px] font-bold text-slate-700 capitalize mt-0.5">
                        {widgetAppearance.position === "right" ? t("dashboard.widgetPreview.position.right") : t("dashboard.widgetPreview.position.left")}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[9px] text-slate-400 font-medium">{t("dashboard.widgetPreview.style")}</p>
                      <p className="text-[11px] font-bold text-slate-700 capitalize mt-0.5">{widgetAppearance.launcher}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare size={20} className="text-slate-300" />
                  </div>
                  <p className="text-[12px] font-medium text-slate-500 mb-1">{t("dashboard.widgetPreview.notConfigured")}</p>
                  <Link href="/portal/widget-appearance" className="text-[11px] font-bold text-blue-600 hover:text-blue-700">
                    {t("dashboard.widgetPreview.setupNow")} →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Current Usage */}
          <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-[13px] font-bold text-slate-900">{t("dashboard.currentUsage")}</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Customer Service */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-slate-700">{t("dashboard.currentUsage.customerService")}</span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{planKey === "FREE" ? t("dashboard.currentUsage.freeTrial") : planKey}</span>
                </div>
                <UsageBar label={t("dashboard.currentUsage.billableConversations")} used={stats?.usage.conversations ?? 0} limit={usage?.limitConversations ?? 100} />
              </div>

              {/* AI */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-slate-700">{t("dashboard.quickActions.aiAgent")}</span>
                </div>
                <UsageBar label={t("dashboard.currentUsage.aiConversations")} used={stats?.ai.monthlyUsage ?? 0} limit={stats?.ai.monthlyLimit ?? 100} />
              </div>

              {/* Visitors */}
              <div>
                <UsageBar label={t("dashboard.currentUsage.visitorsReached")} used={stats?.usage.visitorsReached ?? 0} limit={-1} />
              </div>

              <Link href="/portal/billing" className="flex items-center justify-center gap-2 w-full py-2.5 text-[12px] font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                <Crown size={13} /> {t("dashboard.currentUsage.upgrade")}
              </Link>
            </div>
          </div>

          {/* Quick Nav */}
          <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="p-2">
              {[
                { href: "/portal/team", icon: Users, label: t("portalOnboarding.quickActions.team.title") },
                { href: "/portal/settings", icon: Settings, label: t("portalOnboarding.quickActions.settings.title") },
                { href: "/portal/audit", icon: Shield, label: t("nav.auditLogs") },
              ].map(a => {
                const Icon = a.icon;
                return (
                  <Link key={a.href} href={a.href} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-[13px] font-medium text-slate-600 hover:text-slate-800">
                    <Icon size={16} className="text-slate-400" /> {a.label} <ChevronRight size={14} className="text-slate-300 ml-auto" />
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

/* ═══════════════════════════════════════════════════════════════
   LIVE VISITORS PANEL — Premium component
   ═══════════════════════════════════════════════════════════════ */
function LiveVisitorsPanel({ visitors, isPro, onStartChat, chatLoading, onUpgrade, t }: {
  visitors: VisitorsData | null; isPro: boolean;
  onStartChat: (id: string) => void; chatLoading: string | null;
  onUpgrade: () => void; t: (key: string) => string;
}) {
  const liveCount = visitors?.counts.live ?? 0;
  const allLive = visitors?.live ?? [];
  const allRecent = visitors?.recent ?? [];
  const FREE_LIMIT = 3;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <Eye size={18} className="text-white" />
            </div>
            {liveCount > 0 && (
              <>
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full animate-ping" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
              </>
            )}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t("dashboard.liveVisitors")}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{t("dashboard.liveVisitors.desc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/50 rounded-full">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-emerald-500" /></span>
              <span className="text-[12px] font-bold text-emerald-700 tabular-nums">{liveCount} {t("dashboard.liveVisitors.online")}</span>
            </div>
          )}
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200/50 rounded-full text-[11px] font-semibold text-slate-500 tabular-nums">
            {visitors?.counts.today ?? 0} {t("dashboard.liveVisitors.todayCount")}
          </div>
        </div>
      </div>

      {/* ── Table header ── */}
      {allLive.length > 0 && (
        <div className="px-6 py-2 bg-slate-50/70 border-b border-slate-100 grid grid-cols-12 gap-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          <div className="col-span-4">{t("dashboard.liveVisitors.visitor")}</div>
          <div className="col-span-2">{t("common.table.ip")}</div>
          <div className="col-span-2">{t("dashboard.liveVisitors.page")}</div>
          <div className="col-span-2">{t("dashboard.liveVisitors.deviceCol")}</div>
          <div className="col-span-2 text-right">{t("dashboard.liveVisitors.statusCol")}</div>
        </div>
      )}

      {/* ── Body ── */}
      {allLive.length === 0 && allRecent.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Eye size={28} className="text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-700 mb-1">{t("dashboard.liveVisitors.noVisitors")}</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">{t("dashboard.liveVisitors.noVisitorsDesc")}</p>
        </div>
      ) : (
        <div>
          {/* ── Clear rows (Free: first 3, Pro: all) ── */}
          {allLive.slice(0, isPro ? 50 : FREE_LIMIT).map(v => (
            <VRow key={v.id} v={v} isLive onStartChat={onStartChat} chatLoading={chatLoading} t={t} />
          ))}

          {/* ── Blurred rows (Free plan, 4th+ visitor) — tek ortada CTA ── */}
          {!isPro && allLive.length > FREE_LIMIT && (
            <div className="relative min-h-[120px]">
              {allLive.slice(FREE_LIMIT).map((v, idx) => (
                <div key={v.id} className="px-6 py-3.5 grid grid-cols-12 gap-3 items-center pointer-events-none" style={{ filter: `blur(${1.8 + idx * 0.35}px)` }}>
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-[18px]">
                        {countryToFlag(v.country)}
                      </div>
                      <span className="absolute -bottom-px -right-px w-3 h-3 bg-emerald-500 rounded-full border-[1.5px] border-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{v.city || v.country || t("common.unknown")}</p>
                      <p className="text-[10px] text-slate-400 truncate">{v.conversationCount > 0 ? t("dashboard.liveVisitors.returningVisitor") : t("dashboard.liveVisitors.newVisitor")}</p>
                    </div>
                  </div>
                  <div className="col-span-2"><span className="text-[11px] font-mono text-slate-500">{v.ip || "—"}</span></div>
                  <div className="col-span-2"><span className="text-[11px] text-slate-500 truncate block">{v.currentPage || "/"}</span></div>
                  <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                    {v.device === "mobile" ? <Smartphone size={11} className="text-slate-400" /> : <Monitor size={11} className="text-slate-400" />}
                    <span className="truncate">{v.browser}</span>
                  </div>
                  <div className="col-span-2 text-right"><span className="text-[10px] text-slate-400 tabular-nums">{timeAgo(v.lastSeenAt, t)}</span></div>
                </div>
              ))}
              {/* Ortada sabit tek CTA — flu alanın üzerinde */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="pointer-events-auto inline-flex flex-col items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white text-[13px] font-bold shadow-lg shadow-slate-900/25 border border-slate-700/50 hover:from-slate-700 hover:to-slate-800 transition-all duration-200"
                >
                  <span className="inline-flex items-center gap-2">
                    <Crown size={16} className="text-amber-400" />
                    {t("dashboard.liveVisitors.upgradePro")}
                  </span>
                  <span className="text-[11px] font-medium text-slate-300">{t("dashboard.liveVisitors.upgradeHint")}</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Recent visitors ── */}
          {allRecent.length > 0 && (
            <>
              <div className="px-6 py-2 bg-slate-50/70 border-t border-b border-slate-100 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  {t("dashboard.liveVisitors.recentVisitors")} — {t("dashboard.liveVisitors.recentDesc")}
                </h3>
                {/* PRO badge sadece canlı ziyaretçi ≤3 iken; >3 olduğunda üstteki canlı alan CTA’sı aktif */}
                {!isPro && liveCount <= FREE_LIMIT && (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1 rounded-full"
                  >
                    <Badge variant="premium" size="sm" className="cursor-pointer inline-flex items-center gap-1">
                      <Lock size={12} className="shrink-0" />
                      {t("common.badge.pro")}
                    </Badge>
                  </button>
                )}
              </div>
              {isPro ? (
                allRecent.slice(0, 10).map((v) => (
                  <VRow key={v.id} v={v} isLive={false} onStartChat={onStartChat} chatLoading={chatLoading} t={t} />
                ))
              ) : (
                <div className="relative min-h-[140px]">
                  {/* Blurred rows */}
                  {allRecent.slice(0, 3).map((v, idx) => (
                    <div key={v.id} className="px-6 py-3.5 grid grid-cols-12 gap-3 items-center" style={{ filter: `blur(${1.7 + idx * 0.3}px)` }}>
                      <div className="col-span-4 flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-[18px] flex-shrink-0">
                          {countryToFlag(v.country)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 truncate">{v.city || v.country || t("common.unknown")}</p>
                          <p className="text-[10px] text-slate-400">{t("dashboard.liveVisitors.browsingNow")}</p>
                        </div>
                      </div>
                      <div className="col-span-2"><span className="text-[11px] font-mono text-slate-500">{v.ip || "—"}</span></div>
                      <div className="col-span-2"><span className="text-[11px] text-slate-500">{v.currentPage || "/"}</span></div>
                      <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                        {v.device === "mobile" ? <Smartphone size={11} /> : <Monitor size={11} />} {v.browser}
                      </div>
                      <div className="col-span-2 text-right"><span className="text-[10px] text-slate-400 tabular-nums">{timeAgo(v.lastSeenAt, t)}</span></div>
                    </div>
                  ))}
                  {/* Alttaki CTA sadece canlı ≤3 iken; >3 iken sadece üstteki canlı alan CTA’sı açık (ikisi aynı anda görünmez) */}
                  {liveCount <= FREE_LIMIT && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <button
                        onClick={onUpgrade}
                        className="pointer-events-auto inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white text-[13px] font-bold shadow-lg shadow-slate-900/25 border border-slate-700/50 hover:from-slate-700 hover:to-slate-800 transition-all duration-200"
                      >
                        <Crown size={14} className="text-amber-400" />
                        {t("dashboard.liveVisitors.upgradePro")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Single clear visitor row (table-style) ── */
function VRow({ v, isLive, onStartChat, chatLoading, t }: {
  v: LiveVisitor; isLive: boolean;
  onStartChat: (id: string) => void; chatLoading: string | null; t: (key: string) => string;
}) {
  const isLoading = chatLoading === v.id;
  return (
    <div className="group px-6 py-3.5 grid grid-cols-12 gap-3 items-center hover:bg-blue-50/30 transition-colors cursor-pointer border-b border-slate-50 last:border-b-0" onClick={() => onStartChat(v.id)}>
      {/* Visitor */}
      <div className="col-span-4 flex items-center gap-3 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-[18px]">
            {countryToFlag(v.country)}
          </div>
          {isLive && (
            <>
              <span className="absolute -bottom-px -right-px w-3 h-3 bg-emerald-500 rounded-full border-[1.5px] border-white" />
              <span className="absolute -bottom-px -right-px w-3 h-3 bg-emerald-400 rounded-full border-[1.5px] border-white animate-ping" />
            </>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-800 truncate">{v.city || v.country || t("common.visitor")}</p>
          <p className="text-[10px] text-slate-400">
            {v.conversationCount > 0 ? (
              <span className="text-violet-500 font-semibold">{t("dashboard.liveVisitors.returningVisitor")} · {v.conversationCount} {t("dashboard.liveVisitors.conversations")}</span>
            ) : (
              <span className="text-emerald-500 font-semibold">{t("dashboard.liveVisitors.newVisitor")}</span>
            )}
          </p>
        </div>
      </div>

      {/* IP */}
      <div className="col-span-2">
        <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">{v.ip || "—"}</span>
      </div>

      {/* Current page */}
      <div className="col-span-2">
        <span className="text-[11px] text-slate-500 truncate block">{v.currentPage || "/"}</span>
      </div>

      {/* Device */}
      <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-slate-500">
        {v.device === "mobile" ? <Smartphone size={12} className="text-slate-400" /> : <Monitor size={12} className="text-slate-400" />}
        <span className="truncate">{v.browser} / {v.os}</span>
      </div>

      {/* Action */}
      <div className="col-span-2 flex items-center justify-end gap-2">
        <span className="text-[10px] text-slate-400 tabular-nums group-hover:hidden">{timeAgo(v.lastSeenAt, t)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onStartChat(v.id); }}
          disabled={isLoading}
          className="hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={10} />}
          {t("dashboard.liveVisitors.startChat")}
        </button>
      </div>
    </div>
  );
}

/* ── Project Status Item ── */
function ProjectStatusItem({ label, status, statusText, actionText, href }: {
  label: string; status: boolean; statusText: string; actionText: string; href: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${status ? "bg-emerald-100" : "bg-red-100"}`}>
        {status ? <CheckCircle2 size={12} className="text-emerald-600" /> : <X size={12} className="text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-slate-800">{label}</p>
        <p className={`text-[11px] ${status ? "text-emerald-600" : "text-red-500"}`}>{statusText}</p>
        {!status && (
          <Link href={href} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 mt-0.5 inline-block">{actionText}</Link>
        )}
      </div>
    </div>
  );
}

/* ── Usage Bar ── */
function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit < 0;
  const pct = isUnlimited ? 0 : Math.min(100, (used / Math.max(limit, 1)) * 100);
  const isHigh = pct > 80;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className="text-[11px] font-bold text-slate-700 tabular-nums">
          {used} / {isUnlimited ? "\u221E" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${isHigh ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
