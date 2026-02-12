"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import { premiumToast } from "@/components/PremiumToast";
import type { TranslationKey } from "@/i18n/translations";
import { useStepUp } from "@/contexts/StepUpContext";
import { colors, fonts } from "@/lib/design-tokens";
import PlanComparisonTable from "@/components/PlanComparisonTable";
import TrialBanner from "@/components/TrialBanner";
import UsageNudge from "@/components/UsageNudge";
import {
  Crown, AlertTriangle, ArrowUpRight, Sparkles,
  MessageSquare, Mail, Users, ExternalLink, FileText,
  Zap, BarChart3, Download, ChevronRight,
  Shield, CheckCircle2, ArrowRight, Bot, Eye,
  X, Activity, Settings, Code, Palette,
} from "lucide-react";

/* ═══════════ Types ═══════════ */
interface PlanInfo { key: string; name: string; monthlyPriceUsd: number | null }
interface Limits { maxConversationsPerMonth: number; maxMessagesPerMonth: number; maxAgents: number }
interface BillingUsage { monthKey: string; conversationsCreated: number; messagesSent: number; nextResetDate?: string }
interface Subscription {
  status: string; planStatus: string; stripeCustomerId: string | null;
  stripeSubscriptionId: string | null; stripePriceId: string | null;
  currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null; billingEnforced: boolean; billingGraceDays: number;
}
interface AvailablePlan {
  key: string; name: string; stripePriceId: string | null;
  monthlyPriceUsd: number | null; maxConversationsPerMonth: number;
  maxMessagesPerMonth: number; maxAgents: number;
}
interface TrialInfo { isTrialing: boolean; isExpired: boolean; daysLeft: number; endsAt: string | null }
interface BillingStatus {
  stripeConfigured: boolean; org: { id: string; key: string; name: string };
  plan: PlanInfo; limits: Limits | null; usage: BillingUsage;
  subscription: Subscription; availablePlans: AvailablePlan[];
  trial?: TrialInfo; recommendedPlan?: string;
}
interface BillingLockStatus {
  locked: boolean; graceEndsAt: string | null; billingLockedAt: string | null;
  reason: string; lastReconcileAt: string | null;
}
interface Invoice {
  id: string; number: string | null; status: string; amountDue: number;
  amountPaid: number; currency: string; hostedInvoiceUrl: string | null;
  invoicePdf: string | null; created: number; periodEnd: number;
}
interface DashboardStats {
  conversations: { open: number; closed: number; total: number };
  messages: { today: number; thisWeek: number; thisMonth: number };
  ai: { totalResponses: number; monthlyUsage: number; monthlyLimit: number; avgResponseTimeMs: number; enabled: boolean };
  usage: { conversations: number; messages: number; humanConversations: number; aiResponses: number; visitorsReached: number };
  widget: { enabled: boolean; totalLoads: number; lastSeen: string | null };
  plan: string;
}
interface OrgInfo {
  id: string; key: string; name: string; siteId: string;
  allowLocalhost: boolean; allowedDomains: string[];
  widgetEnabled: boolean; writeEnabled: boolean; aiEnabled: boolean;
}

/* ═══════════ Helpers ═══════════ */
function fmtAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: 2 }).format(cents / 100);
}
function ProgressBar({ pct, color = "bg-amber-500" }: { pct: number; color?: string }) {
  const bg = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : color;
  return (
    <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] mt-2">
      <div className={`h-full rounded-full transition-all duration-700 ${bg}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}
function InvBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const styles: Record<string, string> = { paid: "bg-emerald-50 text-emerald-700", open: "bg-amber-50 text-amber-700", draft: "bg-[#FFFBF5] text-[#475569]", void: "bg-[#FFFBF5] text-[#64748B]", uncollectible: "bg-red-50 text-red-700" };
  const dots: Record<string, string> = { paid: "bg-emerald-500", open: "bg-amber-500", draft: "bg-[#94A3B8]", void: "bg-[#94A3B8]", uncollectible: "bg-red-500" };
  const key = `billing.status.${status}` as TranslationKey;
  const label = t(key) === key ? status : t(key);
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[status] || styles.draft}`}><span className={`h-1.5 w-1.5 rounded-full ${dots[status] || dots.draft}`} /> {label}</span>;
}

/* ═══════════ MAIN ═══════════ */
export default function PortalBillingPage() {
  void colors;
  void fonts;
  const { loading: authLoading } = usePortalAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [lockStatus, setLockStatus] = useState<BillingLockStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const { t } = useI18n();
  const { withStepUp } = useStepUp();

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        const [bR, lR, sR, oR] = await Promise.all([
          portalApiFetch("/portal/billing/status"),
          portalApiFetch("/portal/billing/lock-status"),
          portalApiFetch("/portal/dashboard/stats"),
          portalApiFetch("/portal/org/me"),
        ]);
        if (bR.ok) setBilling(await bR.json()); else { setErrorRequestId(bR.headers.get("x-request-id") || null); setError(t("billing.failedLoad")); }
        if (lR.ok) setLockStatus(await lR.json());
        if (sR.ok) setStats(await sR.json());
        if (oR.ok) { const d = await oR.json(); if (d?.org) setOrg(d.org); }
      } catch { setError(t("billing.networkError")); }
      setLoading(false);
    })();
  }, [authLoading, t]);

  useEffect(() => {
    if (!billing?.stripeConfigured || !billing.subscription.stripeCustomerId) return;
    setInvoicesLoading(true);
    (async () => {
      try {
        const r = await portalApiFetch("/portal/billing/invoices?limit=10");
        if (r.status === 501) setInvoicesError(t("billing.stripeNotConfigured"));
        else if (r.status === 409) setInvoices([]);
        else if (!r.ok) setInvoicesError(t("billing.failedLoadInvoices"));
        else setInvoices((await r.json()).invoices || []);
      } catch { setInvoicesError(t("billing.networkErrorInvoices")); }
      setInvoicesLoading(false);
    })();
  }, [billing, t]);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        const res = await portalApiFetch("/api/organization/settings");
        if (!res.ok) return;
        const data = (await res.json()) as { campaignsEnabled?: boolean };
        setShowPromoInput(Boolean(data.campaignsEnabled));
      } catch {
        setShowPromoInput(false);
      }
    })();
  }, [authLoading]);

  useEffect(() => {
    if (!showPromoInput) {
      setAppliedCode(null);
      setPromoCodeInput("");
    }
  }, [showPromoInput]);

  const handleApplyCode = async () => {
    const normalizedCode = promoCodeInput.trim().toUpperCase();
    if (!normalizedCode) {
      premiumToast.error({
        title: t("billing.promoInvalidTitle"),
        description: t("billing.promoInvalidDesc"),
      });
      return;
    }

    setApplyingPromo(true);
    try {
      const res = await portalApiFetch("/api/promo-codes/validate", {
        method: "POST",
        body: JSON.stringify({ code: normalizedCode }),
      });
      if (!res.ok) {
        premiumToast.error({
          title: t("billing.promoInvalidTitle"),
          description: t("billing.promoInvalidDesc"),
        });
        return;
      }
      const data = (await res.json()) as { valid?: boolean; code?: string };
      if (data.valid) {
        const code = data.code || normalizedCode;
        setAppliedCode(code);
        setPromoCodeInput(code);
        premiumToast.success({
          title: t("billing.promoSavedTitle"),
          description: t("billing.promoSavedDesc"),
        });
      } else {
        premiumToast.error({
          title: t("billing.promoInvalidTitle"),
          description: t("billing.promoInvalidDesc"),
        });
      }
    } catch {
      premiumToast.error({
        title: t("billing.promoInvalidTitle"),
        description: t("billing.promoInvalidDesc"),
      });
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleCheckout = async (planKey: string) => {
    setCheckoutLoading(planKey);
    const result = await withStepUp(() => portalApiFetch("/portal/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        planKey,
        returnUrl: window.location.origin + "/portal/billing",
        promoCode: appliedCode || undefined,
      }),
    }), "portal");
    if (result.cancelled) { setCheckoutLoading(null); return; }
    if (!result.ok) { setError((result.data as Record<string, string>)?.error || t("billing.checkoutFailed")); setCheckoutLoading(null); return; }
    const d = result.data as Record<string, string> | undefined;
    if (d?.url) window.location.href = d.url;
  };
  const handleManage = async () => {
    setPortalLoading(true);
    const result = await withStepUp(() => portalApiFetch("/portal/billing/portal-session", { method: "POST", body: JSON.stringify({ returnUrl: window.location.origin + "/portal/billing" }) }), "portal");
    if (result.cancelled) { setPortalLoading(false); return; }
    if (!result.ok) { setError((result.data as Record<string, string>)?.error || t("billing.failedOpenPortal")); setPortalLoading(false); return; }
    const d = result.data as Record<string, string> | undefined;
    if (d?.url) window.location.href = d.url;
  };
  const scrollToPlans = () => document.getElementById("plans-section")?.scrollIntoView({ behavior: "smooth" });

  const hasCustomer = billing?.subscription?.stripeCustomerId != null;
  const tPlan = (key: string, name: string) => { const k = `billing.planName.${key}` as TranslationKey; const v = t(k); return v === k ? name : v; };
  const subStatus = billing?.subscription?.status || "none";
  const isGrace = lockStatus?.reason === "grace";
  const isLocked = lockStatus?.reason === "locked";
  const convPct = useMemo(() => billing?.limits?.maxConversationsPerMonth ? (billing.usage.conversationsCreated / billing.limits.maxConversationsPerMonth) * 100 : 0, [billing]);
  const msgPct = useMemo(() => billing?.limits?.maxMessagesPerMonth ? (billing.usage.messagesSent / billing.limits.maxMessagesPerMonth) * 100 : 0, [billing]);
  const aiPct = useMemo(() => stats?.ai.monthlyLimit ? (stats.ai.monthlyUsage / stats.ai.monthlyLimit) * 100 : 0, [stats]);
  const usageFull = convPct >= 100 || msgPct >= 100;

  const widgetOk = !!stats?.widget.enabled && (stats?.widget.totalLoads ?? 0) > 0;
  const aiOk = !!stats?.ai.enabled;
  const domainsOk = !!org && ((org.allowedDomains?.length ?? 0) > 0 || org.allowLocalhost);
  const setupDone = [widgetOk, aiOk, domainsOk].filter(Boolean).length;
  const planBadge = billing?.plan.key === "free" ? t("dashboard.currentUsage.freeTrial") : billing?.plan.name || "";

  if (authLoading) return <div className="flex items-center justify-center py-20"><div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-slate-900" /></div>;

  return (
    <div className="space-y-8">
      {/* ── System banners ── */}
      {billing?.trial && (billing.trial.isTrialing || billing.trial.isExpired) && (
        <TrialBanner daysLeft={billing.trial.daysLeft} isExpired={billing.trial.isExpired} isTrialing={billing.trial.isTrialing} endsAt={billing.trial.endsAt} />
      )}
      {billing?.limits && billing?.usage && (
        <UsageNudge usedConversations={billing.usage.conversationsCreated} limitConversations={billing.limits.maxConversationsPerMonth}
          usedMessages={billing.usage.messagesSent} limitMessages={billing.limits.maxMessagesPerMonth} />
      )}

      {error && <ErrorBanner message={error} requestId={errorRequestId} onDismiss={() => { setError(null); setErrorRequestId(null); }} />}

      {loading || !billing ? (
        <div className="flex items-center justify-center py-24"><div className="flex flex-col items-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F3E8D8] border-t-amber-600" /><p className="text-sm text-[#94A3B8]">{t("billing.loadingBilling")}</p></div></div>
      ) : (
        <>
          {/* ── Alerts ── */}
          {(isGrace || isLocked) && (
            <div className={`flex items-start gap-4 rounded-2xl border p-5 ${isLocked ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
              <AlertTriangle size={20} className={isLocked ? "text-red-500 mt-0.5" : "text-amber-500 mt-0.5"} />
              <div className="flex-1"><p className={`text-sm font-bold ${isLocked ? "text-red-900" : "text-amber-900"}`}>{isGrace ? t("billing.gracePeriodActive") : t("billing.billingLocked")}</p><p className={`mt-1 text-xs ${isLocked ? "text-red-700" : "text-amber-700"}`} suppressHydrationWarning>{isGrace && lockStatus?.graceEndsAt ? `${t("billing.graceEndsOn")} ${new Date(lockStatus.graceEndsAt).toLocaleDateString()}.` : t("billing.writeDisabled")}</p></div>
            </div>
          )}

          {!billing.stripeConfigured && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4">
              <Zap size={18} className="text-amber-600" /><p className="text-sm text-amber-800">{t("billing.notConfigured")}</p>
            </div>
          )}

          {usageFull && (
            <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-6 py-4">
              <div className="flex items-center gap-3"><AlertTriangle size={18} className="text-red-500" /><p className="text-sm font-bold text-red-800">{t("billing.limitReached")}</p></div>
              {billing.stripeConfigured && <button onClick={scrollToPlans} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">{t("billing.upgradeNow")}</button>}
            </div>
          )}

          {/* ═══════════ SETUP WIZARD ═══════════ */}
          <div className="rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
            <div className="flex items-center justify-between px-8 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9] text-sm font-extrabold text-[#64748B]">{setupDone}/4</div>
                <div>
                  <h2 className="text-base font-bold text-[#1A1D23]">{t("dashboard.setupBanner")}</h2>
                  <p className="text-sm text-[#64748B]">{t("dashboard.setupBanner.desc")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {billing.stripeConfigured && (
                  <button onClick={scrollToPlans} className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-bold text-white hover:from-amber-600 hover:to-amber-700">{t("billing.upgradeNow")}</button>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════ QUICK ACTIONS ═══════════ */}
          <div>
            <h3 className="mb-4 text-base font-bold text-[#1A1D23]">{t("dashboard.quickActions")}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { href: "/portal/inbox", icon: MessageSquare, label: t("dashboard.quickActions.liveConversations"), desc: `${stats?.conversations.open ?? 0} ${t("dashboard.quickActions.liveConversationsDesc").replace("{count}", "")}`.trim(), iconBg: "bg-amber-50", iconColor: "text-amber-600" },
                { href: "/portal/ai", icon: Bot, label: t("dashboard.quickActions.aiAgent"), desc: aiOk ? `${stats?.ai.monthlyUsage ?? 0}/${stats?.ai.monthlyLimit ?? 0}` : t("dashboard.projectStatus.setupAi"), iconBg: "bg-violet-50", iconColor: "text-violet-600" },
                { href: "/portal/widget", icon: Code, label: t("dashboard.projectStatus.chatWidget"), desc: widgetOk ? `${stats?.widget.totalLoads ?? 0} ${t("common.abbrev.loads")}` : t("dashboard.projectStatus.installWidget"), iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
                { href: "/portal/usage", icon: BarChart3, label: t("portalOnboarding.quickActions.usage.title"), desc: `${stats?.messages.thisMonth ?? 0} ${t("common.abbrev.messages")}`, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
                { href: "/portal/team", icon: Users, label: t("portalOnboarding.quickActions.team.title"), desc: `${billing.limits?.maxAgents ?? 0} ${t("billing.agentSeats").toLowerCase()}`, iconBg: "bg-pink-50", iconColor: "text-pink-600" },
              ].map((a) => {
                const Icon = a.icon;
                return (
                  <Link key={a.href} href={a.href} className="group rounded-2xl border border-[#F3E8D8] bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-200">
                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${a.iconBg}`}><Icon size={18} className={a.iconColor} /></div>
                    <p className="text-sm font-bold text-[#1A1D23]">{a.label}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">{a.desc}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ═══════════ MAIN GRID: Content + Sidebar ═══════════ */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">

            {/* ═══ LEFT (3/4) ═══ */}
            <div className="space-y-8 lg:col-span-3">

              {/* ── Plan Overview Card ── */}
              <div className="rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#F3E8D8] px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
                      <Crown size={22} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{t("billing.currentPlan")}</p>
                      <h2 className="text-xl font-bold text-[#1A1D23]">{tPlan(billing.plan.key, billing.plan.name)}</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${subStatus === "active" ? "bg-emerald-50 text-emerald-700" : subStatus === "trialing" ? "bg-amber-50 text-amber-700" : "bg-[#FFFBF5] text-[#475569]"}`}>
                      <span className={`h-2 w-2 rounded-full ${subStatus === "active" ? "bg-emerald-500" : subStatus === "trialing" ? "bg-amber-500" : "bg-[#94A3B8]"}`} />
                      {(() => { const k = `billing.status.${subStatus}` as TranslationKey; const v = t(k); return v === k ? subStatus : v; })()}
                    </span>
                    {billing.stripeConfigured && (
                      <button onClick={scrollToPlans} className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:from-amber-600 hover:to-amber-700">
                        <ArrowUpRight size={14} className="mr-1.5 inline" />{billing.plan.key === "free" ? t("billing.upgradeNow") : t("billing.viewPlans")}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#F3E8D8] sm:grid-cols-4">
                  <div className="px-8 py-6">
                    <p className="text-xs text-[#94A3B8]">{t("billing.price")}</p>
                    <p className="mt-1 text-2xl font-extrabold text-[#1A1D23]">{billing.plan.monthlyPriceUsd != null && billing.plan.monthlyPriceUsd > 0 ? `$${billing.plan.monthlyPriceUsd}` : t("billing.free")}<span className="text-sm font-normal text-[#94A3B8]">{billing.plan.monthlyPriceUsd ? t("billing.perMonth") : ""}</span></p>
                  </div>
                  <div className="px-8 py-6">
                    <p className="text-xs text-[#94A3B8]">{t("billing.agentSeats")}</p>
                    <p className="mt-1 text-2xl font-extrabold text-[#1A1D23]">{billing.limits?.maxAgents ?? 0}</p>
                  </div>
                  <div className="px-8 py-6">
                    <p className="text-xs text-[#94A3B8]">{t("billing.period")}</p>
                    <p className="mt-1 text-lg font-bold text-[#1A1D23]">{billing.usage.monthKey}</p>
                    {billing.usage.nextResetDate && <p className="text-[10px] text-[#94A3B8]" suppressHydrationWarning>{t("billing.nextReset")} {new Date(billing.usage.nextResetDate).toLocaleDateString()}</p>}
                  </div>
                  <div className="px-8 py-6">
                    <p className="text-xs text-[#94A3B8]">{billing.subscription.cancelAtPeriodEnd ? t("billing.cancelsOn") : t("billing.renewsOn")}</p>
                    <p className="mt-1 text-lg font-bold text-[#1A1D23]" suppressHydrationWarning>{billing.subscription.currentPeriodEnd ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
              </div>

              {/* ── Insight Tip ── */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#F3E8D8] bg-white px-6 py-4 shadow-sm">
                <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600"><Sparkles size={10} className="mr-1 inline" />{t("dashboard.insight")}</span>
                <p className="text-sm text-[#64748B]">{t("dashboard.insight.proactive")} <Link href="/portal/inbox" className="font-semibold text-amber-600 hover:underline">{t("dashboard.insight.chatWithVisitors")}</Link></p>
              </div>

              {/* ── Usage Metrics ── */}
              <div>
                <h3 className="mb-4 text-base font-bold text-[#1A1D23]">{t("billing.usageThisMonth")}</h3>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-600"><MessageSquare size={16} /><span className="text-xs font-semibold text-[#64748B]">{t("usage.conversations")}</span></div>
                    <p className="mt-4 text-3xl font-extrabold tabular-nums text-[#1A1D23]">{billing.usage.conversationsCreated.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">/ {billing.limits?.maxConversationsPerMonth.toLocaleString()} {t("billing.perMo")}</p>
                    <ProgressBar pct={convPct} color="bg-amber-500" />
                  </div>
                  <div className="rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2 text-violet-600"><Mail size={16} /><span className="text-xs font-semibold text-[#64748B]">{t("usage.messages")}</span></div>
                    <p className="mt-4 text-3xl font-extrabold tabular-nums text-[#1A1D23]">{billing.usage.messagesSent.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">/ {billing.limits?.maxMessagesPerMonth.toLocaleString()} {t("billing.perMo")}</p>
                    <ProgressBar pct={msgPct} color="bg-violet-500" />
                  </div>
                  <div className="rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-600"><Bot size={16} /><span className="text-xs font-semibold text-[#64748B]">AI</span></div>
                    <p className="mt-4 text-3xl font-extrabold tabular-nums text-[#1A1D23]">{(stats?.ai.monthlyUsage ?? 0).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">/ {(stats?.ai.monthlyLimit ?? 100).toLocaleString()} {t("billing.perMo")}</p>
                    <ProgressBar pct={aiPct} color="bg-emerald-500" />
                  </div>
                  <div className="rounded-2xl border border-[#F3E8D8] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-600"><Eye size={16} /><span className="text-xs font-semibold text-[#64748B]">{t("dashboard.currentUsage.visitorsReached")}</span></div>
                    <p className="mt-4 text-3xl font-extrabold tabular-nums text-[#1A1D23]">{(stats?.usage.visitorsReached ?? 0).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">{t("dashboard.currentUsage.unlimited")}</p>
                  </div>
                </div>
              </div>

              {/* ── Performance Row ── */}
              <div className="rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
                <div className="grid grid-cols-4 divide-x divide-[#F3E8D8]">
                  {[
                    { label: t("dashboard.performance.repliedLive"), value: stats?.usage.humanConversations ?? 0, dot: "bg-gradient-to-r from-amber-500 to-amber-600" },
                    { label: t("dashboard.performance.aiConversations"), value: stats?.ai.totalResponses ?? 0, dot: "bg-emerald-500" },
                    { label: t("dashboard.currentUsage.visitorsReached"), value: stats?.usage.visitorsReached ?? 0, dot: "bg-amber-500" },
                    { label: t("dashboard.performance.interactions"), value: stats?.messages.today ?? 0, dot: "bg-[#334155]" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center gap-3 px-6 py-5">
                      <span className={`h-3 w-3 flex-shrink-0 rounded-full ${m.dot}`} />
                      <div>
                        <p className="text-sm font-medium text-[#475569]">{m.label}</p>
                        <p className="text-lg font-bold tabular-nums text-[#1A1D23]">{m.value.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Upgrade CTA ── */}
              {billing.plan.key === "free" && billing.stripeConfigured && (
                <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-8 py-6">
                  <div className="flex items-center gap-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg shadow-indigo-600/25"><Sparkles size={24} className="text-white" /></div>
                    <div><p className="text-lg font-bold text-[#1A1D23]">{t("billing.upgradeTo")} {tPlan(billing.recommendedPlan || "pro", "Pro")}</p><p className="text-sm text-[#64748B]">{t("billing.unlockPremiumFeatures")}</p></div>
                  </div>
                  <button onClick={scrollToPlans} className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-3 text-sm font-bold text-white shadow-sm hover:from-amber-600 hover:to-amber-700">{t("billing.viewPlans")} <ArrowRight size={14} className="ml-1 inline" /></button>
                </div>
              )}

              {/* ── Plans ── */}
              {billing.stripeConfigured && billing.availablePlans.length > 0 && (
                <div id="plans-section" className="rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-[#F3E8D8] px-8 py-5"><BarChart3 size={18} className="text-amber-600" /><p className="text-base font-bold text-[#1A1D23]">{t("billing.availablePlans")}</p></div>
                  <div className="space-y-4 p-8">
                    {showPromoInput && (
                      <div className="rounded-xl border border-[#F3E8D8] bg-[#FFFBF5] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{t("billing.promoCodeLabel")}</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input
                            value={promoCodeInput}
                            onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                            placeholder={t("billing.promoCodePlaceholder")}
                            className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#334155] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                          />
                          <button
                            onClick={handleApplyCode}
                            disabled={applyingPromo}
                            className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white hover:from-amber-600 hover:to-amber-700 disabled:opacity-50"
                          >
                            {applyingPromo ? t("common.loading") : t("billing.applyPromoCode")}
                          </button>
                        </div>
                        {appliedCode && (
                          <p className="mt-2 text-sm font-medium text-emerald-700">
                            {t("billing.promoSavedInline").replace("{code}", appliedCode)}
                          </p>
                        )}
                      </div>
                    )}
                    <PlanComparisonTable plans={billing.availablePlans} currentPlanKey={billing.plan.key} onUpgrade={handleCheckout} upgradeLoading={checkoutLoading} showBillingToggle mode="portal" recommendedPlan={billing.recommendedPlan} />
                  </div>
                </div>
              )}

              {/* ── Invoices ── */}
              {billing.stripeConfigured && (
                <div className="rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#F3E8D8] px-8 py-5">
                    <div className="flex items-center gap-3"><FileText size={18} className="text-[#94A3B8]" /><p className="text-base font-bold text-[#1A1D23]">{t("billing.billingHistory")}</p></div>
                    {hasCustomer && <button onClick={handleManage} disabled={portalLoading} className="text-sm font-semibold text-amber-600 hover:text-amber-800">{t("billing.manageBilling")} <ChevronRight size={14} className="inline" /></button>}
                  </div>
                  <div className="p-8">
                    {invoicesLoading && <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F3E8D8] border-t-amber-600" /></div>}
                    {invoicesError && <p className="text-sm text-red-600">{invoicesError}</p>}
                    {!invoicesLoading && !invoicesError && (!hasCustomer || invoices.length === 0) && (
                      <div className="flex flex-col items-center py-12"><FileText size={36} className="text-[#E2E8F0]" /><p className="mt-3 text-sm font-semibold text-[#94A3B8]">{t("billing.noInvoices")}</p><p className="mt-1 text-xs text-[#CBD5E1]">{t("billing.noBillingHistory")}</p></div>
                    )}
                    {invoices.length > 0 && (
                      <table className="w-full">
                        <thead><tr className="border-b border-[#F3E8D8]">
                          <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{t("billing.invoice")}</th>
                          <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{t("billing.date")}</th>
                          <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{t("billing.amount")}</th>
                          <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{t("billing.status")}</th>
                          <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{t("billing.actions")}</th>
                        </tr></thead>
                        <tbody className="divide-y divide-[#F3E8D8]">
                          {invoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-[#FFFBF5]">
                              <td className="py-4 text-sm font-medium text-[#1A1D23]">{inv.number || inv.id.slice(0, 16)}</td>
                              <td className="py-4 text-sm text-[#475569]" suppressHydrationWarning>{new Date(inv.created * 1000).toLocaleDateString()}</td>
                              <td className="py-4 text-sm font-bold text-[#1A1D23]">{fmtAmount(inv.amountDue, inv.currency)}</td>
                              <td className="py-4"><InvBadge status={inv.status} t={t} /></td>
                              <td className="py-4 text-right">
                                {inv.hostedInvoiceUrl && <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="mr-2 text-xs font-semibold text-amber-600 hover:text-amber-800"><ExternalLink size={12} className="mr-1 inline" />{t("billing.view")}</a>}
                                {inv.invoicePdf && <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#64748B] hover:text-[#334155]"><Download size={12} className="mr-1 inline" />{t("common.document.pdf")}</a>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ RIGHT SIDEBAR (1/4) ═══ */}
            <div className="space-y-6">

              {/* ── Project Status ── */}
              <div className="rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
                <div className="border-b border-[#F3E8D8] px-6 py-4"><h3 className="text-sm font-bold text-[#1A1D23]">{t("dashboard.projectStatus")}</h3></div>
                <div className="p-5 space-y-4">
                  {[
                    { ok: widgetOk, label: t("dashboard.projectStatus.chatWidget"), okText: t("dashboard.projectStatus.chatWidgetInstalled"), noText: t("dashboard.projectStatus.chatWidgetNotInstalled"), action: t("dashboard.projectStatus.installWidget"), href: "/portal/widget" },
                    { ok: aiOk, label: t("dashboard.projectStatus.aiAgent"), okText: t("dashboard.projectStatus.aiAgentActive"), noText: t("dashboard.projectStatus.aiAgentInactive"), action: t("dashboard.projectStatus.setupAi"), href: "/portal/ai" },
                    { ok: domainsOk, label: t("dashboard.projectStatus.domains"), okText: t("dashboard.projectStatus.domainsConfigured"), noText: t("dashboard.projectStatus.domainsNotConfigured"), action: t("dashboard.projectStatus.configureDomains"), href: "/portal/security" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      {s.ok ? <CheckCircle2 size={18} className="mt-0.5 text-emerald-500" /> : <X size={18} className="mt-0.5 rounded-full bg-red-100 p-0.5 text-red-500" />}
                      <div>
                        <p className="text-sm font-bold text-[#334155]">{s.label}</p>
                        <p className={`text-xs ${s.ok ? "text-emerald-600" : "text-red-500"}`}>{s.ok ? s.okText : s.noText}</p>
                        {!s.ok && <Link href={s.href} className="text-xs font-semibold text-amber-600 hover:text-amber-700">{s.action}</Link>}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-[#F3E8D8] pt-3">
                    <p className="mb-2 text-xs text-[#94A3B8]">{t("dashboard.projectStatus.addChannel")}</p>
                    <div className="flex gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50"><MessageSquare size={15} className="text-blue-500" /></div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFFBF5] opacity-40"><Mail size={15} className="text-[#94A3B8]" /></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Current Usage ── */}
              <div className="rounded-2xl border border-[#F3E8D8] bg-white shadow-sm">
                <div className="border-b border-[#F3E8D8] px-6 py-4"><h3 className="text-sm font-bold text-[#1A1D23]">{t("dashboard.currentUsage")}</h3></div>
                <div className="p-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between"><span className="text-sm font-bold text-[#334155]">{t("dashboard.currentUsage.customerService")}</span><span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">{planBadge}</span></div>
                    <div className="mt-2 flex items-center justify-between text-xs text-[#64748B]"><span>{t("dashboard.currentUsage.billableConversations")}</span><span className="font-bold text-[#334155] tabular-nums">{billing.usage.conversationsCreated} / {billing.limits?.maxConversationsPerMonth ?? 0}</span></div>
                    <ProgressBar pct={convPct} color="bg-amber-500" />
                    {!widgetOk && <Link href="/portal/widget" className="mt-2 block text-xs font-semibold text-amber-600">{t("dashboard.projectStatus.installWidget")}</Link>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between"><span className="text-sm font-bold text-[#334155]">{t("dashboard.quickActions.aiAgent")}</span></div>
                    <div className="mt-2 flex items-center justify-between text-xs text-[#64748B]"><span>{t("dashboard.currentUsage.aiConversations")}</span><span className="font-bold text-[#334155] tabular-nums">{stats?.ai.monthlyUsage ?? 0} / {stats?.ai.monthlyLimit ?? 100}</span></div>
                    <ProgressBar pct={aiPct} color="bg-emerald-500" />
                    {!aiOk && <Link href="/portal/ai" className="mt-2 block text-xs font-semibold text-amber-600">{t("dashboard.projectStatus.setupAi")}</Link>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between"><span className="text-sm font-bold text-[#334155]">{t("dashboard.currentUsage.visitorsReached")}</span></div>
                    <p className="mt-1 text-lg font-extrabold tabular-nums text-[#1A1D23]">{stats?.usage.visitorsReached ?? 0}</p>
                    <p className="text-[10px] text-[#94A3B8]">{t("dashboard.currentUsage.unlimited")}</p>
                  </div>

                  <Link href="/portal/billing#plans-section" className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-bold text-white hover:from-amber-600 hover:to-amber-700">
                    <Crown size={14} /> {t("dashboard.currentUsage.upgrade")}
                  </Link>
                </div>
              </div>

              {/* ── Quick Nav ── */}
              <div className="rounded-2xl border border-[#F3E8D8] bg-white shadow-sm overflow-hidden">
                <div className="divide-y divide-[#F3E8D8]">
                  {[
                    { href: "/portal/settings", icon: Settings, label: t("portalOnboarding.quickActions.settings.title") },
                    { href: "/portal/security", icon: Shield, label: t("nav.security") },
                    { href: "/portal/audit", icon: Activity, label: t("nav.auditLogs") },
                    { href: "/portal/widget-appearance", icon: Palette, label: t("portalOnboarding.task.appearance.title") },
                  ].map(a => {
                    const Icon = a.icon;
                    return (
                      <Link key={a.href} href={a.href} className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-[#475569] hover:bg-[#FFFBF5] hover:text-[#1A1D23]">
                        <Icon size={16} className="text-[#94A3B8]" /> {a.label} <ChevronRight size={14} className="ml-auto text-[#CBD5E1]" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
