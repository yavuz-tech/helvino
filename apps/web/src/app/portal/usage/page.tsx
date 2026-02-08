"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { ChevronLeft } from "lucide-react";

/* ────────── Types ────────── */

interface Limits {
  maxConversationsPerMonth: number;
  maxMessagesPerMonth: number;
  maxAgents: number;
  extraConversationQuota?: number;
  extraMessageQuota?: number;
}

interface Usage {
  monthKey: string;
  conversationsCreated: number;
  messagesSent: number;
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

/* ────────── Components ────────── */

function UsageRing({
  label,
  used,
  limit,
  extra,
}: {
  label: string;
  used: number;
  limit: number;
  extra?: number;
}) {
  const { t } = useI18n();
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;
  const isFull = pct >= 100;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  const color = isFull
    ? "stroke-red-500"
    : isHigh
      ? "stroke-amber-500"
      : "stroke-emerald-500";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r={radius}
            strokeWidth="10"
            fill="none"
            className="stroke-slate-200"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            strokeWidth="10"
            fill="none"
            className={`${color} transition-all duration-700`}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-2xl font-bold ${isFull ? "text-red-600" : isHigh ? "text-amber-600" : "text-slate-900"}`}
          >
            {pct.toFixed(0)}%
          </span>
          <span className="text-xs text-slate-500">used</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-900">{label}</p>
      <p className="text-xs text-slate-500" suppressHydrationWarning>
        {used.toLocaleString()} / {limit.toLocaleString()}
      </p>
      {extra != null && extra > 0 && (
        <p className="text-xs text-blue-600 mt-0.5" suppressHydrationWarning>
          +{extra.toLocaleString()} {t("usage.extra")}
        </p>
      )}
    </div>
  );
}

function AlertBanner({
  variant,
  children,
}: {
  variant: "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    danger: "bg-red-50 border-red-200 text-red-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  };
  return (
    <div className={`rounded-lg border p-4 text-sm ${styles[variant]}`}>
      {children}
    </div>
  );
}

/* ────────── Main ────────── */

export default function PortalUsagePage() {
  const { user, loading: authLoading } = usePortalAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      try {
        const [billingRes, lockRes] = await Promise.all([
          portalApiFetch("/portal/billing/status"),
          portalApiFetch("/portal/billing/lock-status"),
        ]);
        if (billingRes.ok) setBilling(await billingRes.json());
        else setError(t("usage.failedLoad"));
        if (lockRes.ok) setLockStatus(await lockRes.json());
      } catch {
        setError(t("common.networkError"));
      }
      setLoading(false);
    };
    load();
  }, [authLoading, t]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  const limits = billing?.limits;
  const usage = billing?.usage;
  const isLocked = lockStatus?.locked === true;
  const isGrace = lockStatus?.reason === "grace";

  const convPct =
    limits && limits.maxConversationsPerMonth > 0
      ? ((usage?.conversationsCreated || 0) / limits.maxConversationsPerMonth) * 100
      : 0;
  const msgPct =
    limits && limits.maxMessagesPerMonth > 0
      ? ((usage?.messagesSent || 0) / limits.maxMessagesPerMonth) * 100
      : 0;
  const anyHigh = convPct >= 80 || msgPct >= 80;
  const anyFull = convPct >= 100 || msgPct >= 100;

  return (
    <>
      <div className="mb-6">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#1A1A2E] transition-colors mb-3 group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          {t("portalOnboarding.backToDashboard")}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{t("usage.title")}</h1>
        <p className="text-sm text-slate-600 mt-1">
          {t("usage.subtitle")}
        </p>
      </div>

      {error && (
        <AlertBanner variant="danger">
          {error}{" "}
          <button
            onClick={() => setError(null)}
            className="underline font-medium ml-2"
          >
            {t("usage.dismiss")}
          </button>
        </AlertBanner>
      )}

      {loading || !billing ? (
        <div className="text-slate-600">{t("usage.loadingUsage")}</div>
      ) : (
        <div className="space-y-6">
          {/* Locked / Grace banner */}
          {isLocked && (
            <AlertBanner variant="danger">
              {t("usage.locked")}{" "}
              <Link
                href="/portal/billing"
                className="underline font-medium"
              >
                {t("billing.manageBilling")}
              </Link>
            </AlertBanner>
          )}

          {isGrace && !isLocked && (
            <AlertBanner variant="warning">
              {t("usage.gracePeriod")}{" "}
              {lockStatus?.graceEndsAt && (
                <>
                  <strong suppressHydrationWarning>
                    {new Date(lockStatus.graceEndsAt).toLocaleDateString()}
                  </strong>
                </>
              )}{" "}
              <Link
                href="/portal/billing"
                className="underline font-medium"
              >
                {t("billing.manageBilling")}
              </Link>
            </AlertBanner>
          )}

          {/* High usage banner */}
          {anyFull && !isLocked && (
            <AlertBanner variant="danger">
              {t("usage.limitReached")}{" "}
              <Link
                href="/portal/billing"
                className="underline font-medium"
              >
                {t("billing.viewPlans")}
              </Link>
            </AlertBanner>
          )}

          {anyHigh && !anyFull && !isLocked && (
            <AlertBanner variant="warning">
              {t("usage.approachingLimit")}{" "}
              <Link
                href="/portal/billing"
                className="underline font-medium"
              >
                {t("billing.viewPlans")}
              </Link>
            </AlertBanner>
          )}

          {/* Usage rings */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                {t("usage.currentPeriod")}
              </h2>
              <div className="text-right text-xs text-slate-500">
                <div>{t("usage.month")} {usage?.monthKey}</div>
                {usage?.nextResetDate && (
                  <div suppressHydrationWarning>
                    {t("usage.resetDate")}{" "}
                    {new Date(usage.nextResetDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {limits ? (
              <div className="flex flex-wrap justify-center gap-10">
                <UsageRing
                  label={t("usage.conversations")}
                  used={usage?.conversationsCreated || 0}
                  limit={limits.maxConversationsPerMonth}
                  extra={limits.extraConversationQuota}
                />
                <UsageRing
                  label={t("usage.messages")}
                  used={usage?.messagesSent || 0}
                  limit={limits.maxMessagesPerMonth}
                  extra={limits.extraMessageQuota}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center">
                {t("usage.noLimits")}
              </p>
            )}
          </div>

          {/* Plan info card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              {t("usage.planDetails")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">{t("usage.plan")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {billing.plan.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("usage.status")}</p>
                <p className="text-lg font-semibold text-slate-900 capitalize">
                  {(() => {
                    const sKey = `billing.status.${billing.subscription.status}` as TranslationKey;
                    const sTranslated = t(sKey);
                    return sTranslated === sKey
                      ? (billing.subscription.status === "none" ? t("usage.noSubscription") : billing.subscription.status.replace("_", " "))
                      : sTranslated;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("usage.agentSeats")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {limits?.maxAgents ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
              <Link
                href="/portal/billing"
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                {t("billing.manageBilling")}
              </Link>
              {isLocked && (
                <span className="px-4 py-2 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
                  {t("usage.contactSupport")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
