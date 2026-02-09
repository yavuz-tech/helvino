"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import MfaPolicyBanner from "@/components/MfaPolicyBanner";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import SecurityBadges from "@/components/SecurityBadges";
import TrialBanner from "@/components/TrialBanner";
import UsageNudge from "@/components/UsageNudge";
import EmbedChecklist from "@/components/EmbedChecklist";
import WidgetStatusBanner from "@/components/WidgetStatusBanner";
import ConversationNudge from "@/components/ConversationNudge";
import AIUsageStats from "@/components/AIUsageStats";
import UpgradeModal from "@/components/UpgradeModal";
import {
  MessageSquare,
  Palette,
  Bell,
  Shield,
  CreditCard,
  Users,
  BarChart3,
  FileText,
  Settings,
  ArrowRight,
  CheckCircle2,
  Zap,
  Bot,
  Sparkles,
  Globe,
  GitBranch,
  ChevronRight,
  Activity,
  Code,
  TrendingUp,
  Clock,
  Eye,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

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

export default function PortalOverviewPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [showMfaBanner, setShowMfaBanner] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.portalMfaRecommended) setShowMfaBanner(true);
        })
        .catch(() => {});
    }

    portalApiFetch("/portal/org/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.org) setOrg(data.org);
      })
      .catch(() => {});

    portalApiFetch("/portal/billing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.conversionSignals) setConversionSignals(data.conversionSignals);
        if (data?.trial) setTrial(data.trial);
        if (data?.usage) setUsage(data.usage);
      })
      .catch(() => {});
  }, [authLoading, user]);

  const widgetConnected = !!conversionSignals?.firstWidgetEmbedAt;
  const domainsConfigured = !!org && ((org.allowedDomains?.length ?? 0) > 0 || org.allowLocalhost);
  const hasConversation = !!conversionSignals?.firstConversationAt;

  const handleCopySnippet = () => {
    if (!org) return;
    const snippet = `<!-- Helvion Chat Widget -->\n<script>window.HELVINO_SITE_ID="${org.siteId}";</script>\n<script src="https://cdn.helvion.io/embed.js"></script>`;
    navigator.clipboard.writeText(snippet).catch(() => {});
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  const userName = user?.email?.split("@")[0] || "";

  return (
    <div className="space-y-8">
      <OnboardingOverlay area="portal" />

      {/* ═══ Alerts ═══ */}
      {(showMfaBanner || (trial && (trial.isTrialing || trial.isExpired)) || usage) && (
        <div className="space-y-3">
          {showMfaBanner && <MfaPolicyBanner blocking={false} securityUrl="/portal/security" />}
          {trial && (trial.isTrialing || trial.isExpired) && (
            <TrialBanner daysLeft={trial.daysLeft} isExpired={trial.isExpired} isTrialing={trial.isTrialing} endsAt={trial.endsAt} />
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

      {/* ═══ Hero Section ═══ */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t("portalOnboarding.greeting")}{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-base text-slate-500 mt-2 max-w-xl">
          {t("portalOnboarding.subtitle")}
          {org && <span className="font-medium text-slate-600"> &mdash; {org.name}</span>}
        </p>
      </div>

      {/* ═══ Stats Row — Large Premium Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* AI Status */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-4">
              <Bot size={24} className="text-white" />
            </div>
            <p className="text-2xl font-extrabold leading-none mb-1">
              {org?.aiEnabled ? t("dashboard.aiCard.enabled") : t("dashboard.aiCard.disabled")}
            </p>
            <p className="text-sm text-blue-200/80">{t("dashboard.aiCard.status")}</p>
            <Link href="/portal/ai" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-100 hover:text-white transition-colors">
              {t("dashboard.aiHero.cta")} <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* AI Responses */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
            <Sparkles size={22} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 leading-none mb-1">&mdash;</p>
          <p className="text-sm text-slate-500">{t("dashboard.stat.aiResponses")}</p>
          <p className="text-xs text-slate-400 mt-1">{t("dashboard.stat.aiResponsesDesc")}</p>
        </div>

        {/* Response Time */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
            <Zap size={22} className="text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 leading-none mb-1">&lt;2s</p>
          <p className="text-sm text-slate-500">{t("dashboard.stat.avgResponseTime")}</p>
          <p className="text-xs text-slate-400 mt-1">{t("dashboard.stat.avgResponseTimeDesc")}</p>
        </div>

        {/* Satisfaction */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-4">
            <TrendingUp size={22} className="text-violet-500" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 leading-none mb-1">&mdash;</p>
          <p className="text-sm text-slate-500">{t("dashboard.stat.satisfaction")}</p>
          <p className="text-xs text-slate-400 mt-1">{t("dashboard.stat.satisfactionDesc")}</p>
        </div>
      </div>

      {/* ═══ AI Usage Quota ═══ */}
      <AIUsageStats prominent onUpgradeNeeded={() => setShowUpgradeModal(true)} />

      {/* ═══ Capabilities — Rich Feature Cards ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="group rounded-2xl bg-white border border-slate-200 p-6 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all cursor-default">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
            <Bot size={26} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">{t("dashboard.feature.aiTitle")}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{t("dashboard.feature.aiDesc")}</p>
        </div>

        <div className="group rounded-2xl bg-white border border-slate-200 p-6 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100/50 transition-all cursor-default">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
            <Globe size={26} className="text-violet-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">{t("dashboard.feature.multiLangTitle")}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{t("dashboard.feature.multiLangDesc")}</p>
        </div>

        <div className="group rounded-2xl bg-white border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/50 transition-all cursor-default">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
            <GitBranch size={26} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">{t("dashboard.feature.smartRoutingTitle")}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{t("dashboard.feature.smartRoutingDesc")}</p>
        </div>
      </div>

      {/* ═══ Widget Setup Section ═══ */}
      {org && (
        <div className="space-y-5">
          <WidgetStatusBanner status={widgetConnected ? "ready" : "loading"} />
          <EmbedChecklist
            siteId={org.siteId}
            snippetCopied={snippetCopied}
            domainsConfigured={domainsConfigured}
            widgetConnected={widgetConnected}
            onCopySnippet={handleCopySnippet}
          />
        </div>
      )}

      <ConversationNudge widgetConnected={widgetConnected} hasConversation={hasConversation} />

      {/* ═══ Two Column Layout: Getting Started + Quick Actions ═══ */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* LEFT: Getting Started (3 cols) */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <Zap size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{t("portalOnboarding.setupCard.title")}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t("portalOnboarding.setupCard.tasksComplete")
                      .replace("{completed}", String([widgetConnected, domainsConfigured, hasConversation].filter(Boolean).length))
                      .replace("{total}", "5")}
                  </p>
                </div>
              </div>
              {/* Progress ring */}
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="97.4" strokeDashoffset={97.4 - (97.4 * [widgetConnected, domainsConfigured, hasConversation].filter(Boolean).length) / 5} strokeLinecap="round" className="transition-all duration-700" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
                  {[widgetConnected, domainsConfigured, hasConversation].filter(Boolean).length}/5
                </span>
              </div>
            </div>

            <div className="p-3">
              <div className="space-y-1.5">
                {[
                  { href: "/portal/widget", icon: MessageSquare, titleKey: "portalOnboarding.task.widget.title" as const, descKey: "portalOnboarding.task.widget.desc" as const, done: widgetConnected, gradient: "from-blue-500 to-blue-600" },
                  { href: "/portal/widget-appearance", icon: Palette, titleKey: "portalOnboarding.task.appearance.title" as const, descKey: "portalOnboarding.task.appearance.desc" as const, done: false, gradient: "from-pink-500 to-rose-600" },
                  { href: "/portal/inbox", icon: Bell, titleKey: "portalOnboarding.task.inbox.title" as const, descKey: "portalOnboarding.task.inbox.desc" as const, done: hasConversation, gradient: "from-amber-500 to-orange-600" },
                  { href: "/portal/security", icon: Shield, titleKey: "portalOnboarding.task.security.title" as const, descKey: "portalOnboarding.task.security.desc" as const, done: domainsConfigured, gradient: "from-emerald-500 to-teal-600" },
                  { href: "/portal/billing", icon: CreditCard, titleKey: "portalOnboarding.task.billing.title" as const, descKey: "portalOnboarding.task.billing.desc" as const, done: false, gradient: "from-violet-500 to-purple-600" },
                ].map((task) => {
                  const Icon = task.icon;
                  return (
                    <Link key={task.href} href={task.href}
                      className="group flex items-center gap-5 px-5 py-5 rounded-xl hover:bg-slate-50 transition-all">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-all ${
                        task.done
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20"
                          : `bg-gradient-to-br ${task.gradient} shadow-slate-300/20 group-hover:shadow-md`
                      }`}>
                        {task.done
                          ? <CheckCircle2 size={22} className="text-white" />
                          : <Icon size={22} className="text-white" />
                        }
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-base font-semibold leading-snug ${task.done ? "text-emerald-700" : "text-slate-800 group-hover:text-slate-900"}`}>
                          {t(task.titleKey)}
                        </p>
                        <p className="text-sm text-slate-400 mt-1 leading-relaxed">{t(task.descKey)}</p>
                      </div>

                      {/* Status / Arrow */}
                      {task.done ? (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-lg flex-shrink-0">
                          {t("embed.completed")}
                        </span>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center flex-shrink-0 transition-colors">
                          <ArrowRight size={16} className="text-slate-400 group-hover:text-slate-600" />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Quick Actions + More (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick Actions */}
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{t("portalOnboarding.quickActions.title")}</h2>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: "/portal/inbox", icon: MessageSquare, label: t("portalOnboarding.quickActions.inbox.title"), bg: "from-blue-500 to-blue-600" },
                  { href: "/portal/ai", icon: Bot, label: t("nav.ai"), bg: "from-violet-500 to-violet-600" },
                  { href: "/portal/widget", icon: Code, label: "Widget", bg: "from-emerald-500 to-emerald-600" },
                  { href: "/portal/widget-appearance", icon: Palette, label: t("widgetAppearance.title"), bg: "from-pink-500 to-pink-600" },
                  { href: "/portal/team", icon: Users, label: t("portalOnboarding.quickActions.team.title"), bg: "from-amber-500 to-amber-600" },
                  { href: "/portal/usage", icon: BarChart3, label: t("portalOnboarding.quickActions.usage.title"), bg: "from-cyan-500 to-cyan-600" },
                  { href: "/portal/billing", icon: CreditCard, label: t("portalOnboarding.quickActions.billing.title"), bg: "from-indigo-500 to-indigo-600" },
                  { href: "/portal/settings", icon: Settings, label: t("portalOnboarding.quickActions.settings.title"), bg: "from-slate-500 to-slate-600" },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link key={a.href + a.label} href={a.href}
                      className="group flex items-center gap-3 p-3.5 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.bg} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow`}>
                        <Icon size={18} className="text-white" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 leading-tight">{a.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Security & Account */}
          <div className="rounded-2xl bg-white border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Shield size={18} className="text-slate-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t("nav.security")}</h3>
                <p className="text-xs text-slate-400">{t("portalOnboarding.task.security.desc")}</p>
              </div>
            </div>
            {user && (
              <SecurityBadges
                mfaEnabled={(user as PortalUser & { mfaEnabled?: boolean }).mfaEnabled}
              />
            )}
            <Link href="/portal/security"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 w-full justify-center text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
              {t("mfaPolicy.goToSecurity")} <ArrowRight size={14} />
            </Link>
          </div>

          {/* Workspace */}
          {org && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 p-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t("portal.workspaceName")}</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t("portal.workspaceName")}</span>
                  <span className="text-sm font-bold text-slate-800">{org.name}</span>
                </div>
                <div className="h-px bg-slate-200/60" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t("portal.key")}</span>
                  <span className="text-sm font-mono font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">{org.key}</span>
                </div>
                <div className="h-px bg-slate-200/60" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Site ID</span>
                  <span className="text-xs font-mono text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm truncate max-w-[160px]">{org.siteId}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Upgrade Modal ═══ */}
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}
