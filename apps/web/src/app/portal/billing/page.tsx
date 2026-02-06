"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/PortalLayout";
import {
  checkPortalAuth,
  portalLogout,
  portalApiFetch,
  type PortalUser,
} from "@/lib/portal-auth";

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

interface BillingStatus {
  stripeConfigured: boolean;
  org: { id: string; key: string; name: string };
  plan: PlanInfo;
  limits: Limits | null;
  usage: Usage;
  subscription: Subscription;
  availablePlans: AvailablePlan[];
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
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.none}`}
    >
      {status === "none" ? "No subscription" : status.replace("_", " ")}
    </span>
  );
}

function StateBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    grace: "bg-amber-100 text-amber-800",
    locked: "bg-red-100 text-red-800",
    free: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[state] || colors.free}`}
    >
      {state.toUpperCase()}
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
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [lockStatus, setLockStatus] = useState<BillingLockStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Auth check
  useEffect(() => {
    const verify = async () => {
      const portalUser = await checkPortalAuth();
      if (!portalUser) {
        router.push("/portal/login");
        return;
      }
      setUser(portalUser);
      setAuthLoading(false);
    };
    verify();
  }, [router]);

  // Load billing status
  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      try {
        const res = await portalApiFetch("/portal/billing/status");
        if (!res.ok) {
          setError("Failed to load billing information");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setBilling(data);
      } catch {
        setError("Network error loading billing");
      }
      setLoading(false);
    };
    load();
  }, [authLoading]);

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
          setInvoicesError("Stripe not configured");
        } else if (res.status === 409) {
          // No customer yet — not an error, just no invoices
          setInvoices([]);
        } else if (!res.ok) {
          setInvoicesError("Could not load invoices");
        } else {
          const data = await res.json();
          setInvoices(data.invoices || []);
        }
      } catch {
        setInvoicesError("Network error loading invoices");
      }
      setInvoicesLoading(false);
    };
    loadInvoices();
  }, [billing]);

  const handleLogout = async () => {
    await portalLogout();
    router.push("/portal/login");
  };

  const handleCheckout = async (planKey: string) => {
    setCheckoutLoading(planKey);
    try {
      const res = await portalApiFetch("/portal/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          planKey,
          returnUrl: window.location.origin + "/portal/billing",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Checkout failed");
        setCheckoutLoading(null);
        return;
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setError("Checkout failed");
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await portalApiFetch("/portal/billing/portal-session", {
        method: "POST",
        body: JSON.stringify({
          returnUrl: window.location.origin + "/portal/billing",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Could not open billing portal");
        setPortalLoading(false);
        return;
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal");
      setPortalLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  const isFreePlan = billing?.plan?.key === "free";
  const hasSubscription = billing?.subscription?.stripeSubscriptionId != null;
  const hasCustomer = billing?.subscription?.stripeCustomerId != null;
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

  return (
    <PortalLayout user={user} onLogout={handleLogout}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your plan, usage, and subscription
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>
            Last sync:{" "}
            {lockStatus?.lastReconcileAt
              ? new Date(lockStatus.lastReconcileAt).toLocaleString()
              : "Never"}
          </span>
          <StateBadge state={stateLabel} />
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading || !billing ? (
        <div className="text-slate-600">Loading billing...</div>
      ) : (
        <div className="space-y-6">
          {(isGrace || isLocked) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {isGrace
                      ? "Payment required — grace period active"
                      : "Payment required — billing locked"}
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    {isGrace && lockStatus?.graceEndsAt
                      ? `Grace ends on ${new Date(
                          lockStatus.graceEndsAt
                        ).toLocaleDateString()}.`
                      : "Widget write operations are disabled until payment is resolved."}
                  </p>
                </div>
                {billing.stripeConfigured && hasCustomer ? (
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {portalLoading ? "Opening portal..." : "Manage Subscription"}
                  </button>
                ) : (
                  <span className="text-sm text-amber-700">
                    Billing portal unavailable in this environment.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stripe not configured notice */}
          {!billing.stripeConfigured && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-900 text-sm">
              <strong>Billing not configured.</strong> Stripe environment
              variables are not set. Subscription features will be unavailable
              until configured.
            </div>
          )}

          {/* Current Plan Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Current Plan
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  {billing.plan.name}
                </h2>
                {billing.plan.monthlyPriceUsd != null &&
                  billing.plan.monthlyPriceUsd > 0 && (
                    <p className="text-sm text-slate-600 mt-0.5">
                      ${billing.plan.monthlyPriceUsd}/month
                    </p>
                  )}
                {isFreePlan && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    Free forever
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
                        ? "Cancels on"
                        : "Renews on"}
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(
                        billing.subscription.currentPeriodEnd
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {billing.subscription.trialEndsAt && (
                  <div>
                    <p className="text-xs text-slate-500">Trial ends</p>
                    <p className="text-sm font-medium text-slate-900">
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
                Your subscription will be canceled at the end of the current
                billing period. You can reactivate from the billing portal.
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
                    ? "Opening portal..."
                    : "Manage Subscription"}
                </button>
              </div>
            )}
          </div>

          {/* Usage Section */}
          {billing.limits && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">
                Usage This Month
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Period: {billing.usage.monthKey}
              </p>
              <div className="space-y-4">
                <UsageBar
                  label="Conversations"
                  used={billing.usage.conversationsCreated}
                  limit={billing.limits.maxConversationsPerMonth}
                />
                <UsageBar
                  label="Messages"
                  used={billing.usage.messagesSent}
                  limit={billing.limits.maxMessagesPerMonth}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Agent seats</span>
                  <span className="font-medium text-slate-900">
                    {billing.limits.maxAgents} included
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Available Plans */}
          {billing.stripeConfigured && billing.availablePlans.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">
                Available Plans
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                {billing.availablePlans.map((plan) => {
                  const isCurrent = plan.key === billing.plan.key;
                  const canUpgrade =
                    !isCurrent &&
                    plan.key !== "free" &&
                    plan.stripePriceId != null;

                  return (
                    <div
                      key={plan.key}
                      className={`border rounded-lg p-4 ${isCurrent ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-900">
                          {plan.name}
                        </h4>
                        {isCurrent && (
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-bold text-slate-900">
                        {plan.monthlyPriceUsd != null &&
                        plan.monthlyPriceUsd > 0
                          ? `$${plan.monthlyPriceUsd}/mo`
                          : "Free"}
                      </p>
                      <ul className="mt-3 space-y-1 text-sm text-slate-600">
                        <li>
                          {plan.maxConversationsPerMonth.toLocaleString()}{" "}
                          conversations/mo
                        </li>
                        <li>
                          {plan.maxMessagesPerMonth.toLocaleString()}{" "}
                          messages/mo
                        </li>
                        <li>{plan.maxAgents} agents</li>
                      </ul>
                      {canUpgrade && (
                        <button
                          onClick={() => handleCheckout(plan.key)}
                          disabled={checkoutLoading === plan.key}
                          className="mt-4 w-full px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                          {checkoutLoading === plan.key
                            ? "Redirecting..."
                            : `Upgrade to ${plan.name}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Billing History (Invoices) ─── */}
          {billing.stripeConfigured && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">
                Billing History
              </h3>

              {invoicesLoading && (
                <p className="text-sm text-slate-500">Loading invoices...</p>
              )}

              {invoicesError && (
                <p className="text-sm text-red-600">{invoicesError}</p>
              )}

              {!invoicesLoading && !invoicesError && !hasCustomer && (
                <p className="text-sm text-slate-500">
                  No billing history yet. Start a subscription to see invoices
                  here.
                </p>
              )}

              {!invoicesLoading &&
                !invoicesError &&
                hasCustomer &&
                invoices.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No invoices found yet.
                  </p>
                )}

              {invoices.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-2 pr-4 font-medium text-slate-600">
                          Invoice
                        </th>
                        <th className="py-2 pr-4 font-medium text-slate-600">
                          Date
                        </th>
                        <th className="py-2 pr-4 font-medium text-slate-600">
                          Amount
                        </th>
                        <th className="py-2 pr-4 font-medium text-slate-600">
                          Status
                        </th>
                        <th className="py-2 font-medium text-slate-600">
                          Actions
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
                          <td className="py-3 pr-4 text-slate-700">
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
                                  View
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
    </PortalLayout>
  );
}
