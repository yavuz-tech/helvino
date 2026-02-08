"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import ErrorBanner from "@/components/ErrorBanner";
import type { TranslationKey } from "@/i18n/translations";
import { useStepUp } from "@/contexts/StepUpContext";
import PlanComparisonTable from "@/components/PlanComparisonTable";
import TrialBanner from "@/components/TrialBanner";
import UsageNudge from "@/components/UsageNudge";
import { ChevronLeft } from "lucide-react";

/* ────────── Types ────────── */

interface PlanInfo {
  key: string;
  name: string;
  monthlyPriceUsd: number | null;
}

interface Limits {
  maxConversationsPerMonth: number;
  maxMessagesPerMonth: number;
  maxAgents: number;
}

interface Usage {
  monthKey: string;
  conversationsCreated: number;
  messagesSent: number;
  nextResetDate?: string;
}

interface Subscription {
  status: string;
  planStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  billingEnforced: boolean;
  billingGraceDays: number;
}

interface AvailablePlan {
  key: string;
  name: string;
  stripePriceId: string | null;
  monthlyPriceUsd: number | null;
  maxConversationsPerMonth: number;
  maxMessagesPerMonth: number;
  maxAgents: number;
}

interface TrialInfo {
  isTrialing: boolean;
  isExpired: boolean;
  daysLeft: number;
  endsAt: string | null;
}

interface BillingStatus {
  stripeConfigured: boolean;
  org: { id: string; key: string; name: string };
  plan: PlanInfo;
  limits: Limits | null;
  usage: Usage;
  subscription: Subscription;
  availablePlans: AvailablePlan[];
  trial?: TrialInfo;
  recommendedPlan?: string;
}

interface BillingLockStatus {
  locked: boolean;
  graceEndsAt: string | null;
  billingLockedAt: string | null;
  reason: string;
  lastReconcileAt: string | null;
}

interface Invoice {
  id: string;
  number: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  created: number;
  periodEnd: number;
}

/* ────────── Small components ────────── */

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    trialing: "bg-blue-100 text-blue-800",
    past_due: "bg-amber-100 text-amber-800",
    canceled: "bg-red-100 text-red-800",
    unpaid: "bg-red-100 text-red-800",
    incomplete: "bg-yellow-100 text-yellow-800",
    none: "bg-slate-100 text-slate-600",
    paid: "bg-emerald-100 text-emerald-800",
    open: "bg-blue-100 text-blue-800",
    void: "bg-slate-100 text-slate-500",
    draft: "bg-slate-100 text-slate-500",
    uncollectible: "bg-red-100 text-red-800",
  };

  const statusKey = `billing.status.${status}` as TranslationKey;
  const translated = t(statusKey);
  const label = translated === statusKey ? (status === "none" ? t("billing.noSubscription") : status.replace("_", " ")) : translated;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.none}`}
    >
      {label}
    </span>
  );
}

function StateBadge({ state }: { state: string }) {
  const { t } = useI18n();
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    grace: "bg-amber-100 text-amber-800",
    locked: "bg-red-100 text-red-800",
    free: "bg-slate-100 text-slate-700",
  };

  const stateKey = `billing.state.${state}` as TranslationKey;
  const translated = t(stateKey);
  const label = translated === stateKey ? state.toUpperCase() : translated.toUpperCase();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[state] || colors.free}`}
    >
      {label}
    </span>
  );
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;
  const isFull = pct >= 100;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span
          className={`font-medium ${isFull ? "text-red-600" : isHigh ? "text-amber-600" : "text-slate-900"}`}
          suppressHydrationWarning
        >
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${isFull ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/* ────────── Main page ────────── */

export default function PortalBillingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = usePortalAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [lockStatus, setLockStatus] = useState<BillingLockStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { t } = useI18n();
  const { withStepUp } = useStepUp();

  // Load billing status
  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      try {
        const res = await portalApiFetch("/portal/billing/status");
        if (!res.ok) {
          setErrorRequestId(res.headers.get("x-request-id") || null);
          setError(t("billing.failedLoad"));
          setLoading(false);
          return;
        }
        const data = await res.json();
        setBilling(data);
      } catch {
        setError(t("billing.networkError"));
      }
      setLoading(false);
    };
    load();
  }, [authLoading, t]);

  // Load billing lock/grace status
  useEffect(() => {
    if (authLoading) return;
    const loadLockStatus = async () => {
      try {
        const res = await portalApiFetch("/portal/billing/lock-status");
        if (res.ok) {
          const data = await res.json();
          setLockStatus(data);
        }
      } catch {
        // Ignore lock status errors (non-blocking)
      }
    };
    loadLockStatus();
  }, [authLoading]);

  // Load invoices (after billing loads, only if stripe configured + customer exists)
  useEffect(() => {
    if (!billing || !billing.stripeConfigured) return;
    if (!billing.subscription.stripeCustomerId) return;

    setInvoicesLoading(true);
    const loadInvoices = async () => {
      try {
        const res = await portalApiFetch("/portal/billing/invoices?limit=10");
        if (res.status === 501) {
          setInvoicesError(t("billing.stripeNotConfigured"));
        } else if (res.status === 409) {
          // No customer yet — not an error, just no invoices
          setInvoices([]);
        } else if (!res.ok) {
          setInvoicesError(t("billing.failedLoadInvoices"));
        } else {
          const data = await res.json();
          setInvoices(data.invoices || []);
        }
      } catch {
        setInvoicesError(t("billing.networkErrorInvoices"));
      }
      setInvoicesLoading(false);
    };
    loadInvoices();
  }, [billing, t]);

  const handleCheckout = async (planKey: string) => {
    setCheckoutLoading(planKey);
    const result = await withStepUp(() =>
      portalApiFetch("/portal/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          planKey,
          returnUrl: window.location.origin + "/portal/billing",
        }),
      }),
      "portal"
    );
    if (result.cancelled) { setCheckoutLoading(null); return; }
    if (!result.ok) {
      const errData = result.data as Record<string, string> | undefined;
      setError(errData?.error || t("billing.checkoutFailed"));
      setCheckoutLoading(null);
      return;
    }
    const successData = result.data as Record<string, string> | undefined;
    if (successData?.url) window.location.href = successData.url;
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    const result = await withStepUp(() =>
      portalApiFetch("/portal/billing/portal-session", {
        method: "POST",
        body: JSON.stringify({
          returnUrl: window.location.origin + "/portal/billing",
        }),
      }),
      "portal"
    );
    if (result.cancelled) { setPortalLoading(false); return; }
    if (!result.ok) {
      const errData = result.data as Record<string, string> | undefined;
      setError(errData?.error || t("billing.failedOpenPortal"));
      setPortalLoading(false);
      return;
    }
    const successData = result.data as Record<string, string> | undefined;
    if (successData?.url) window.location.href = successData.url;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  const isFreePlan = billing?.plan?.key === "free";
  const hasSubscription = billing?.subscription?.stripeSubscriptionId != null;
  const hasCustomer = billing?.subscription?.stripeCustomerId != null;

  /** Translate plan name using i18n keys, fallback to raw name */
  const translatePlanName = (key: string, fallbackName: string): string => {
    const i18nKey = `billing.planName.${key}` as TranslationKey;
    const translated = t(i18nKey);
    // If translation key is returned as-is, it means no translation found
    return translated === i18nKey ? fallbackName : translated;
  };
  const subStatus = billing?.subscription?.status || "none";
  const isGrace = lockStatus?.reason === "grace";
  const isLocked = lockStatus?.reason === "locked";
  const stateLabel =
    lockStatus?.reason === "active" || lockStatus?.reason === "free"
      ? lockStatus.reason
      : isGrace
        ? "grace"
        : isLocked
          ? "locked"
          : "free";

  // Usage percentages for alert banners
  const convPct =
    billing?.limits && billing.limits.maxConversationsPerMonth > 0
      ? (billing.usage.conversationsCreated / billing.limits.maxConversationsPerMonth) * 100
      : 0;
  const msgPct =
    billing?.limits && billing.limits.maxMessagesPerMonth > 0
      ? (billing.usage.messagesSent / billing.limits.maxMessagesPerMonth) * 100
      : 0;
  const usageHigh = convPct >= 80 || msgPct >= 80;
  const usageFull = convPct >= 100 || msgPct >= 100;

  return (
    <>
      {billing?.trial && (billing.trial.isTrialing || billing.trial.isExpired) && (
        <TrialBanner
          daysLeft={billing.trial.daysLeft}
          isExpired={billing.trial.isExpired}
          isTrialing={billing.trial.isTrialing}
          endsAt={billing.trial.endsAt}
          className="mb-4"
        />
      )}

      {billing?.limits && billing?.usage && (
        <UsageNudge
          usedConversations={billing.usage.conversationsCreated}
          limitConversations={billing.limits.maxConversationsPerMonth}
          usedMessages={billing.usage.messagesSent}
          limitMessages={billing.limits.maxMessagesPerMonth}
          className="mb-4"
        />
      )}

      <div className="mb-6">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#1A1A2E] transition-colors mb-3 group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          {t("portalOnboarding.backToDashboard")}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{t("billing.title")}</h1>
        <p className="text-sm text-slate-600 mt-1">
          {t("billing.subtitle")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span suppressHydrationWarning>
            {t("billing.lastSync")}{" "}
            {lockStatus?.lastReconcileAt
              ? new Date(lockStatus.lastReconcileAt).toLocaleString()
              : t("billing.never")}
          </span>
          <StateBadge state={stateLabel} />
        </div>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          requestId={errorRequestId}
          onDismiss={() => { setError(null); setErrorRequestId(null); }}
          className="mb-6"
        />
      )}

      {loading || !billing ? (
        <div className="text-slate-600">{t("billing.loadingBilling")}</div>
      ) : (
        <div className="space-y-6">
          {(isGrace || isLocked) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {isGrace
                      ? t("billing.gracePeriodActive")
                      : t("billing.billingLocked")}
                  </p>
                  <p className="text-sm text-amber-800 mt-1" suppressHydrationWarning>
                    {isGrace && lockStatus?.graceEndsAt
                      ? `${t("billing.graceEndsOn")} ${new Date(
                          lockStatus.graceEndsAt
                        ).toLocaleDateString()}.`
                      : t("billing.writeDisabled")}
                  </p>
                </div>
                {billing.stripeConfigured && hasCustomer ? (
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {portalLoading ? t("billing.openingPortal") : t("billing.manageSubscription")}
                  </button>
                ) : (
                  <span className="text-sm text-amber-700">
                    {t("billing.portalUnavailable")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stripe not configured notice */}
          {!billing.stripeConfigured && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-900 text-sm">
              {t("billing.notConfigured")}
            </div>
          )}

          {/* Usage alert banners */}
          {usageFull && !isLocked && !isGrace && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-900 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {t("billing.limitReached")}
              </div>
              {billing.stripeConfigured && (
                <button
                  onClick={() => {
                    const plansSection = document.getElementById("available-plans");
                    plansSection?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  {t("billing.upgradeNow")}
                </button>
              )}
            </div>
          )}

          {usageHigh && !usageFull && !isLocked && !isGrace && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {t("billing.approachingLimit")}
              </div>
              {billing.stripeConfigured && (
                <button
                  onClick={() => {
                    const plansSection = document.getElementById("available-plans");
                    plansSection?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
                >
                  {t("billing.viewPlans")}
                </button>
              )}
            </div>
          )}

          {/* Current Plan Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  {t("billing.currentPlan")}
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  {translatePlanName(billing.plan.key, billing.plan.name)}
                </h2>
                {billing.plan.monthlyPriceUsd != null &&
                  billing.plan.monthlyPriceUsd > 0 && (
                    <p className="text-sm text-slate-600 mt-0.5">
                      ${billing.plan.monthlyPriceUsd}{t("billing.perMonth")}
                    </p>
                  )}
                {isFreePlan && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {t("billing.freeForever")}
                  </p>
                )}
              </div>
              <StatusBadge status={subStatus} />
            </div>

            {/* Subscription details */}
            {hasSubscription && (
              <div className="mt-4 pt-4 border-t border-slate-100 grid gap-3 sm:grid-cols-2">
                {billing.subscription.currentPeriodEnd && (
                  <div>
                    <p className="text-xs text-slate-500">
                      {billing.subscription.cancelAtPeriodEnd
                        ? t("billing.cancelsOn")
                        : t("billing.renewsOn")}
                    </p>
                    <p className="text-sm font-medium text-slate-900" suppressHydrationWarning>
                      {new Date(
                        billing.subscription.currentPeriodEnd
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {billing.subscription.trialEndsAt && (
                  <div>
                    <p className="text-xs text-slate-500">{t("billing.trialEnds")}</p>
                    <p className="text-sm font-medium text-slate-900" suppressHydrationWarning>
                      {new Date(
                        billing.subscription.trialEndsAt
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {billing.subscription.cancelAtPeriodEnd && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                {t("billing.cancelAtPeriodEnd")}
              </div>
            )}

            {/* Manage Subscription button */}
            {hasCustomer && billing.stripeConfigured && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {portalLoading
                    ? t("billing.openingPortal")
                    : t("billing.manageSubscription")}
                </button>
              </div>
            )}
          </div>

          {/* Usage Section */}
          {billing.limits && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">
                {t("billing.usageThisMonth")}
              </h3>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500">
                  {t("billing.period")} {billing.usage.monthKey}
                </p>
                {billing.usage.nextResetDate && (
                  <p className="text-xs text-slate-500" suppressHydrationWarning>
                    {t("billing.nextReset")} {new Date(billing.usage.nextResetDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <UsageBar
                  label={t("usage.conversations")}
                  used={billing.usage.conversationsCreated}
                  limit={billing.limits.maxConversationsPerMonth}
                />
                <UsageBar
                  label={t("usage.messages")}
                  used={billing.usage.messagesSent}
                  limit={billing.limits.maxMessagesPerMonth}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t("billing.agentSeats")}</span>
                  <span className="font-medium text-slate-900">
                    {billing.limits.maxAgents} {t("billing.included")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Locked — contact support */}
          {isLocked && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-900 text-sm">
              {t("billing.accountLocked")}
            </div>
          )}

          {/* Available Plans — full comparison */}
          {billing.stripeConfigured && billing.availablePlans.length > 0 && (
            <div id="available-plans" className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-6 uppercase tracking-wider">
                {t("billing.availablePlans")}
              </h3>
              <PlanComparisonTable
                plans={billing.availablePlans}
                currentPlanKey={billing.plan.key}
                onUpgrade={handleCheckout}
                upgradeLoading={checkoutLoading}
                showBillingToggle={true}
                mode="portal"
                recommendedPlan={billing.recommendedPlan}
              />
            </div>
          )}

          {/* ─── Billing History (Invoices) ─── */}
          {billing.stripeConfigured && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">
                {t("billing.billingHistory")}
              </h3>

              {invoicesLoading && (
                <p className="text-sm text-slate-500">{t("billing.loadingInvoices")}</p>
              )}

              {invoicesError && (
                <p className="text-sm text-red-600">{invoicesError}</p>
              )}

              {!invoicesLoading && !invoicesError && !hasCustomer && (
                <p className="text-sm text-slate-500">
                  {t("billing.noBillingHistory")}
                </p>
              )}

              {!invoicesLoading &&
                !invoicesError &&
                hasCustomer &&
                invoices.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {t("billing.noInvoices")}
                  </p>
                )}

              {invoices.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-2 pr-4 font-medium text-slate-600">
                          {t("billing.invoice")}
                        </th>
                        <th className="py-2 pr-4 font-medium text-slate-600">
                          {t("billing.date")}
                        </th>
                        <th className="py-2 pr-4 font-medium text-slate-600">
                          {t("billing.amount")}
                        </th>
                        <th className="py-2 pr-4 font-medium text-slate-600">
                          {t("billing.status")}
                        </th>
                        <th className="py-2 font-medium text-slate-600">
                          {t("billing.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-3 pr-4 font-mono text-xs text-slate-700">
                            {inv.number || inv.id.slice(0, 16)}
                          </td>
                          <td className="py-3 pr-4 text-slate-700" suppressHydrationWarning>
                            {new Date(inv.created * 1000).toLocaleDateString()}
                          </td>
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {formatAmount(inv.amountDue, inv.currency)}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              {inv.hostedInvoiceUrl && (
                                <a
                                  href={inv.hostedInvoiceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {t("billing.view")}
                                </a>
                              )}
                              {inv.invoicePdf && (
                                <a
                                  href={inv.invoicePdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  PDF
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
