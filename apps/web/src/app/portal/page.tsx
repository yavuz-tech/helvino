"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkPortalAuth,
  portalLogout,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";
import PortalLayout from "@/components/PortalLayout";
import MfaPolicyBanner from "@/components/MfaPolicyBanner";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import SecurityBadges from "@/components/SecurityBadges";
import TrialBanner from "@/components/TrialBanner";
import UsageNudge from "@/components/UsageNudge";
import EmbedChecklist from "@/components/EmbedChecklist";
import WidgetStatusBanner from "@/components/WidgetStatusBanner";
import ConversationNudge from "@/components/ConversationNudge";
import WidgetHealthCard from "@/components/WidgetHealthCard";
import { Copy, Check } from "lucide-react";
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
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMfaBanner, setShowMfaBanner] = useState(false);

  // Trial & usage nudge state
  const [trial, setTrial] = useState<{
    isTrialing: boolean;
    isExpired: boolean;
    daysLeft: number;
    endsAt: string | null;
  } | null>(null);
  const [usageInfo, setUsageInfo] = useState<{
    convUsed: number; convLimit: number;
    msgUsed: number; msgLimit: number;
  } | null>(null);

  // Conversion signals & embed checklist state
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [conversionSignals, setConversionSignals] = useState<{
    firstConversationAt: string | null;
    firstWidgetEmbedAt: string | null;
    firstInviteSentAt: string | null;
  } | null>(null);
  const [widgetBannerDismissed, setWidgetBannerDismissed] = useState(false);

  // Widget health state
  const [widgetHealth, setWidgetHealth] = useState<{
    status: "OK" | "NEEDS_ATTENTION" | "NOT_CONNECTED";
    lastSeenAt: string | null;
    loads: { total: number; failures: number };
    domainMismatch: { total: number };
    responseTime: { p50: number | null; p95: number | null };
    requestId?: string;
  } | null>(null);

  useEffect(() => {
    const verify = async () => {
      const portalUser = await checkPortalAuth();
      if (!portalUser) {
        router.push("/portal/login");
        return;
      }
      setUser(portalUser);
      setAuthLoading(false);

      // Check MFA policy
      if (!(portalUser as PortalUser & { mfaEnabled?: boolean }).mfaEnabled) {
        try {
          const res = await portalApiFetch("/portal/security/mfa-policy");
          if (res.ok) {
            const data = await res.json();
            if (data.portalMfaRecommended) setShowMfaBanner(true);
          }
        } catch { /* ignore */ }
      }
    };
    verify();
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    const loadOrg = async () => {
      const res = await portalApiFetch("/portal/org/me");
      if (!res.ok) {
        setError(t("portal.failedLoadOrg"));
        return;
      }
      const data = await res.json();
      setOrg(data.org);
    };
    loadOrg();

    // Load trial + usage for nudges (best-effort)
    const loadBilling = async () => {
      try {
        const res = await portalApiFetch("/portal/billing/status");
        if (res.ok) {
          const data = await res.json();
          if (data.trial) setTrial(data.trial);
          if (data.usage && data.limits) {
            setUsageInfo({
              convUsed: data.usage.conversationsCreated || 0,
              convLimit: data.limits.maxConversationsPerMonth || 0,
              msgUsed: data.usage.messagesSent || 0,
              msgLimit: data.limits.maxMessagesPerMonth || 0,
            });
          }
          if (data.conversionSignals) {
            setConversionSignals(data.conversionSignals);
          }
        }
      } catch { /* ignore */ }
    };
    loadBilling();

    // Load widget health (best-effort)
    const loadWidgetHealth = async () => {
      try {
        const res = await portalApiFetch("/portal/widget/health");
        if (res.ok) {
          const data = await res.json();
          setWidgetHealth(data);
        }
      } catch { /* ignore */ }
    };
    loadWidgetHealth();
  }, [authLoading, t]);

  const handleLogout = async () => {
    await portalLogout();
    router.push("/portal/login");
  };

  const embedSnippet = org
    ? `<!-- Helvino Chat Widget -->\n<script>window.HELVINO_SITE_ID=\"${org.siteId}\";</script>\n<script src=\"https://cdn.helvino.io/embed.js\"></script>`
    : "";

  const copySnippet = async () => {
    if (!embedSnippet) return;
    await navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setSnippetCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      <OnboardingOverlay area="portal" />
      {showMfaBanner && (
        <MfaPolicyBanner blocking={false} securityUrl="/portal/security" />
      )}

      {trial && (trial.isTrialing || trial.isExpired) && (
        <TrialBanner
          daysLeft={trial.daysLeft}
          isExpired={trial.isExpired}
          isTrialing={trial.isTrialing}
          endsAt={trial.endsAt}
          className="mb-4"
        />
      )}

      {usageInfo && (
        <UsageNudge
          usedConversations={usageInfo.convUsed}
          limitConversations={usageInfo.convLimit}
          usedMessages={usageInfo.msgUsed}
          limitMessages={usageInfo.msgLimit}
          className="mb-4"
        />
      )}

      {/* Widget status banner — show on first successful embed */}
      {!widgetBannerDismissed && conversionSignals?.firstWidgetEmbedAt && !conversionSignals.firstConversationAt && (
        <WidgetStatusBanner
          status="ready"
          onDismiss={() => setWidgetBannerDismissed(true)}
          className="mb-4"
        />
      )}

      {/* Soft conversation nudge */}
      {conversionSignals && (
        <ConversationNudge
          widgetConnected={!!conversionSignals.firstWidgetEmbedAt}
          hasConversation={!!conversionSignals.firstConversationAt}
          delayMs={5000}
          className="mb-4"
        />
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("portal.overview")}</h1>
            {org && (
              <p className="text-sm text-slate-600 mt-1">
                {t("portal.workspaceName")}: <span className="font-medium text-slate-900">{org.name}</span>
              </p>
            )}
            {!org && (
              <p className="text-sm text-slate-600 mt-1">
                {t("portal.overviewSubtitle")}
              </p>
            )}
          </div>
          <SecurityBadges
            mfaEnabled={(user as PortalUser & { mfaEnabled?: boolean })?.mfaEnabled}
            auditActive={true}
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {org && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {t("portal.orgInfo")}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("portal.name")}</span>
                <span className="font-medium">{org.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("portal.key")}</span>
                <span className="font-mono">{org.key}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("security.siteId")}</span>
                <span className="font-mono">{org.siteId}</span>
              </div>
            </div>

            {/* Legacy copy button kept for quick access */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={copySnippet}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm w-full justify-center"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    {t("security.copied")}
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    {t("security.copy")}
                  </>
                )}
              </button>
            </div>
          </div>

          <EmbedChecklist
            siteId={org.siteId}
            snippetCopied={snippetCopied}
            domainsConfigured={(org.allowedDomains?.length ?? 0) > 0 || org.allowLocalhost}
            widgetConnected={!!conversionSignals?.firstWidgetEmbedAt}
            onCopySnippet={copySnippet}
          />
        </div>
      )}

      {/* Widget Health Card */}
      {widgetHealth && (
        <WidgetHealthCard data={widgetHealth} className="mt-6" />
      )}
    </PortalLayout>
  );
}
