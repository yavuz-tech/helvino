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
  Circle,
  Zap,
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

interface SetupTask {
  id: string;
  titleKey:
    | "portalOnboarding.task.widget.title"
    | "portalOnboarding.task.appearance.title"
    | "portalOnboarding.task.inbox.title"
    | "portalOnboarding.task.security.title"
    | "portalOnboarding.task.billing.title";
  descKey:
    | "portalOnboarding.task.widget.desc"
    | "portalOnboarding.task.appearance.desc"
    | "portalOnboarding.task.inbox.desc"
    | "portalOnboarding.task.security.desc"
    | "portalOnboarding.task.billing.desc";
  statusKey:
    | "portalOnboarding.status.open"
    | "portalOnboarding.status.review"
    | "portalOnboarding.status.notConfigured";
  href: string;
  icon: React.ElementType;
}

export default function PortalOverviewPage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [showMfaBanner, setShowMfaBanner] = useState(false);

  const [conversionSignals, setConversionSignals] = useState<{
    firstConversationAt: string | null;
    firstWidgetEmbedAt: string | null;
    firstInviteSentAt: string | null;
  } | null>(null);

  // Trial & usage data for TrialBanner / UsageNudge (step 11.32)
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

  const setupTasks: SetupTask[] = [
    {
      id: "widget",
      titleKey: "portalOnboarding.task.widget.title",
      descKey: "portalOnboarding.task.widget.desc",
      statusKey: "portalOnboarding.status.open",
      href: "/portal/widget",
      icon: MessageSquare,
    },
    {
      id: "appearance",
      titleKey: "portalOnboarding.task.appearance.title",
      descKey: "portalOnboarding.task.appearance.desc",
      statusKey: "portalOnboarding.status.open",
      href: "/portal/widget-appearance",
      icon: Palette,
    },
    {
      id: "inbox",
      titleKey: "portalOnboarding.task.inbox.title",
      descKey: "portalOnboarding.task.inbox.desc",
      statusKey: "portalOnboarding.status.review",
      href: "/portal/inbox",
      icon: Bell,
    },
    {
      id: "security",
      titleKey: "portalOnboarding.task.security.title",
      descKey: "portalOnboarding.task.security.desc",
      statusKey: "portalOnboarding.status.review",
      href: "/portal/security",
      icon: Shield,
    },
    {
      id: "billing",
      titleKey: "portalOnboarding.task.billing.title",
      descKey: "portalOnboarding.task.billing.desc",
      statusKey: "portalOnboarding.status.review",
      href: "/portal/billing",
      icon: CreditCard,
    },
  ];

  interface QuickAction {
    titleKey:
      | "portalOnboarding.quickActions.inbox.title"
      | "portalOnboarding.quickActions.widget.title"
      | "portalOnboarding.quickActions.billing.title"
      | "portalOnboarding.quickActions.team.title"
      | "portalOnboarding.quickActions.usage.title"
      | "portalOnboarding.quickActions.audit.title"
      | "portalOnboarding.quickActions.settings.title";
    descKey:
      | "portalOnboarding.quickActions.inbox.desc"
      | "portalOnboarding.quickActions.widget.desc"
      | "portalOnboarding.quickActions.billing.desc"
      | "portalOnboarding.quickActions.team.desc"
      | "portalOnboarding.quickActions.usage.desc"
      | "portalOnboarding.quickActions.audit.desc"
      | "portalOnboarding.quickActions.settings.desc";
    href: string;
    icon: React.ElementType;
  }

  const quickActions: QuickAction[] = [
    {
      titleKey: "portalOnboarding.quickActions.inbox.title",
      descKey: "portalOnboarding.quickActions.inbox.desc",
      href: "/portal/inbox",
      icon: MessageSquare,
    },
    {
      titleKey: "portalOnboarding.quickActions.widget.title",
      descKey: "portalOnboarding.quickActions.widget.desc",
      href: "/portal/widget",
      icon: Palette,
    },
    {
      titleKey: "portalOnboarding.quickActions.billing.title",
      descKey: "portalOnboarding.quickActions.billing.desc",
      href: "/portal/billing",
      icon: CreditCard,
    },
    {
      titleKey: "portalOnboarding.quickActions.team.title",
      descKey: "portalOnboarding.quickActions.team.desc",
      href: "/portal/team",
      icon: Users,
    },
    {
      titleKey: "portalOnboarding.quickActions.usage.title",
      descKey: "portalOnboarding.quickActions.usage.desc",
      href: "/portal/usage",
      icon: BarChart3,
    },
    {
      titleKey: "portalOnboarding.quickActions.audit.title",
      descKey: "portalOnboarding.quickActions.audit.desc",
      href: "/portal/audit",
      icon: FileText,
    },
    {
      titleKey: "portalOnboarding.quickActions.settings.title",
      descKey: "portalOnboarding.quickActions.settings.desc",
      href: "/portal/settings",
      icon: Settings,
    },
  ];

  interface ProjectStatusItem {
    labelKey:
      | "portalOnboarding.projectStatus.widget"
      | "portalOnboarding.projectStatus.mailbox"
      | "portalOnboarding.projectStatus.domain";
    isConfigured: boolean;
  }

  const projectStatus: ProjectStatusItem[] = [
    {
      labelKey: "portalOnboarding.projectStatus.widget",
      isConfigured: !!conversionSignals?.firstWidgetEmbedAt,
    },
    {
      labelKey: "portalOnboarding.projectStatus.mailbox",
      isConfigured: false,
    },
    {
      labelKey: "portalOnboarding.projectStatus.domain",
      isConfigured:
        !!org && ((org.allowedDomains?.length ?? 0) > 0 || org.allowLocalhost),
    },
  ];

  const completedCount = projectStatus.filter((s) => s.isConfigured).length;

  return (
    <div className="max-w-[1400px] mx-auto">
      {showMfaBanner && (
        <MfaPolicyBanner blocking={false} securityUrl="/portal/security" />
      )}

      {/* Step 11.30: Onboarding overlay */}
      <OnboardingOverlay area="portal" />

      {/* Step 11.32: Trial banner & usage nudge */}
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

      {/* Step 11.34: Widget onboarding components */}
      {org && (
        <WidgetStatusBanner
          status={conversionSignals?.firstWidgetEmbedAt ? "ready" : "loading"}
        />
      )}
      {org && (
        <EmbedChecklist
          siteId={org.siteId}
          snippetCopied={false}
          domainsConfigured={(org.allowedDomains?.length ?? 0) > 0 || org.allowLocalhost}
          widgetConnected={!!conversionSignals?.firstWidgetEmbedAt}
          onCopySnippet={() => {}}
        />
      )}
      <ConversationNudge
        widgetConnected={!!conversionSignals?.firstWidgetEmbedAt}
        hasConversation={!!conversionSignals?.firstConversationAt}
      />

      {/* ── Greeting row ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-slate-900 leading-tight">
            {t("portalOnboarding.greeting")}{user ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
          <p className="text-[13px] text-slate-600 mt-1">
            {t("portalOnboarding.subtitle")}
            {org && <span className="text-slate-500"> • {org.name}</span>}
          </p>
        </div>

        {/* Status pills */}
        <div className="hidden lg:flex items-center gap-2">
          {projectStatus.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold shadow-sm ${
                item.isConfigured
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                  : "bg-slate-50 text-slate-500 border border-slate-200/60"
              }`}
            >
              {item.isConfigured ? (
                <CheckCircle2 size={14} className="text-emerald-500" strokeWidth={2.5} />
              ) : (
                <Circle size={14} className="text-slate-300" strokeWidth={2} />
              )}
              {t(item.labelKey)}
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* LEFT: Setup checklist */}
        <div className="lg:col-span-3">
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Checklist header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50/50 to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A1A2E] to-[#2D2D44] flex items-center justify-center shadow-sm">
                  <Zap size={16} className="text-white" strokeWidth={2.5} />
                </div>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {t("portalOnboarding.setupCard.title")}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#1A1A2E] to-[#2D2D44] rounded-full transition-all duration-500"
                    style={{ width: `${(completedCount / setupTasks.length) * 100}%` }}
                  />
                </div>
                <span className="text-[12px] font-semibold text-slate-600 tabular-nums">
                  {t("portalOnboarding.setupCard.tasksComplete")
                    .replace("{completed}", String(completedCount))
                    .replace("{total}", String(setupTasks.length))}
                </span>
              </div>
            </div>

            {/* Task rows */}
            <div className="divide-y divide-slate-200/60">
              {setupTasks.map((task) => {
                const Icon = task.icon;
                return (
                  <Link
                    key={task.id}
                    href={task.href}
                    className="group flex items-center gap-3 px-5 py-4 hover:bg-slate-50/80 transition-colors duration-150"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-[#1A1A2E]/10 flex items-center justify-center flex-shrink-0 transition-colors duration-150">
                      <Icon size={18} className="text-slate-500 group-hover:text-[#1A1A2E] transition-colors duration-150" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-slate-800 group-hover:text-[#1A1A2E] transition-colors duration-150 mb-0.5 leading-tight">
                        {t(task.titleKey)}
                      </div>
                      <div className="text-[13px] text-slate-500 leading-snug">
                        {t(task.descKey)}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 rounded-md bg-slate-50 group-hover:bg-[#1A1A2E]/5 group-hover:text-[#1A1A2E] transition-colors duration-150">
                      {t(task.statusKey)}
                    </span>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-[#1A1A2E] flex-shrink-0 transition-colors duration-150" strokeWidth={2} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Quick actions grid */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50/50 to-white">
              <h2 className="text-[15px] font-semibold text-slate-900">
                {t("portalOnboarding.quickActions.title")}
              </h2>
            </div>

            <div className="divide-y divide-slate-200/60">
              {quickActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={idx}
                    href={action.href}
                    className="group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors duration-150"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-[#1A1A2E]/10 flex items-center justify-center flex-shrink-0 transition-colors duration-150">
                      <Icon size={16} className="text-slate-500 group-hover:text-[#1A1A2E] transition-colors duration-150" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-slate-800 group-hover:text-[#1A1A2E] transition-colors duration-150 leading-tight mb-0.5">
                        {t(action.titleKey)}
                      </div>
                      <div className="text-[13px] text-slate-500 leading-snug">
                        {t(action.descKey)}
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-slate-300 group-hover:text-[#1A1A2E] flex-shrink-0 transition-colors duration-150" strokeWidth={2} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Step 11.30: Security badges */}
      {user && (
        <div className="mt-6">
          <SecurityBadges
            mfaEnabled={(user as PortalUser & { mfaEnabled?: boolean }).mfaEnabled}
          />
        </div>
      )}

      {/* ── Bottom: Workspace info ── */}
      {org && (
        <div className="mt-6 rounded-lg bg-slate-50/80 border border-slate-200/80 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-5 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">{t("portal.workspaceName")}</span>
              <span className="font-semibold text-slate-800">{org.name}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">{t("portal.key")}</span>
              <span className="font-mono text-[12px] text-slate-700 bg-white px-2 py-1 rounded border border-slate-200/80 shadow-sm">
                {org.key}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
