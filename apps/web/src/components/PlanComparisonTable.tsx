"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import SecurityBadges from "@/components/SecurityBadges";
import type { TranslationKey } from "@/i18n/translations";

/**
 * PlanComparisonTable — reusable plan comparison with feature checklist.
 *
 * Used by: /pricing (public) and /portal/billing (portal).
 *
 * Props:
 *   plans: plan data from API (or static for public)
 *   currentPlanKey: highlights the current plan (optional)
 *   onUpgrade: called with planKey when CTA is clicked (optional)
 *   upgradeLoading: planKey currently loading (optional)
 *   showBillingToggle: show monthly/yearly toggle (default true)
 *   mode: "public" shows "Start Free" CTA; "portal" shows "Upgrade to X"
 */

export interface PlanData {
  key: string;
  name: string;
  monthlyPriceUsd: number | null;
  maxConversationsPerMonth: number;
  maxMessagesPerMonth: number;
  maxAgents: number;
  stripePriceId?: string | null;
}

interface PlanComparisonTableProps {
  plans: PlanData[];
  currentPlanKey?: string;
  onUpgrade?: (planKey: string) => void;
  upgradeLoading?: string | null;
  showBillingToggle?: boolean;
  mode?: "public" | "portal";
  recommendedPlan?: string;
}

/** Static feature checklist per plan tier — aligned with pricing-page.jsx */
const FEATURE_MATRIX: Record<string, Record<string, boolean | string>> = {
  free: {
    "pricing.feature.teamManagement": true,
    "pricing.feature.widgetCustomization": true,
    "pricing.feature.apiAccess": false,
    "pricing.feature.mfa": true,
    "pricing.feature.passkeys": true,
    "pricing.feature.auditLog": false,
    "pricing.feature.customDomains": false,
    "pricing.feature.prioritySupport": false,
    "pricing.feature.sla": false,
  },
  starter: {
    "pricing.feature.teamManagement": true,
    "pricing.feature.widgetCustomization": true,
    "pricing.feature.apiAccess": false,
    "pricing.feature.mfa": true,
    "pricing.feature.passkeys": true,
    "pricing.feature.auditLog": false,
    "pricing.feature.customDomains": false,
    "pricing.feature.prioritySupport": false,
    "pricing.feature.sla": false,
  },
  pro: {
    "pricing.feature.teamManagement": true,
    "pricing.feature.widgetCustomization": true,
    "pricing.feature.apiAccess": true,
    "pricing.feature.mfa": true,
    "pricing.feature.passkeys": true,
    "pricing.feature.auditLog": true,
    "pricing.feature.customDomains": true,
    "pricing.feature.prioritySupport": false,
    "pricing.feature.sla": false,
  },
  business: {
    "pricing.feature.teamManagement": true,
    "pricing.feature.widgetCustomization": true,
    "pricing.feature.apiAccess": true,
    "pricing.feature.mfa": true,
    "pricing.feature.passkeys": true,
    "pricing.feature.auditLog": true,
    "pricing.feature.customDomains": true,
    "pricing.feature.prioritySupport": true,
    "pricing.feature.sla": true,
  },
};

export default function PlanComparisonTable({
  plans,
  currentPlanKey,
  onUpgrade,
  upgradeLoading,
  showBillingToggle = true,
  mode = "public",
  recommendedPlan,
}: PlanComparisonTableProps) {
  const { t } = useI18n();
  const { formatUsd } = useCurrency();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const formatLimit = (n: number): string => {
    if (n < 0) return t("pricing.unlimited" as TranslationKey);
    return n.toLocaleString();
  };

  const translatePlanName = (key: string, fallbackName: string): string => {
    const i18nKey = `billing.planName.${key}` as TranslationKey;
    const translated = t(i18nKey);
    return translated === i18nKey ? fallbackName : translated;
  };

  const featureKeys = [
    "pricing.feature.conversations",
    "pricing.feature.messages",
    "pricing.feature.agents",
    "pricing.feature.teamManagement",
    "pricing.feature.widgetCustomization",
    "pricing.feature.apiAccess",
    "pricing.feature.mfa",
    "pricing.feature.passkeys",
    "pricing.feature.auditLog",
    "pricing.feature.customDomains",
    "pricing.feature.prioritySupport",
    "pricing.feature.sla",
  ];

  const isPopular = (key: string) => key === "pro";

  return (
    <div>
      {/* Billing cycle toggle */}
      {showBillingToggle && (
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-150 ${
              billingCycle === "monthly"
                ? "bg-gradient-to-r from-[#4B45FF] to-[#6C67FF] text-white shadow-lg"
                : "bg-white text-[#4B45FF] border-2 border-slate-200/80 hover:border-[#4B45FF]/30"
            }`}
          >
            {t("pricing.monthly")}
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-150 ${
              billingCycle === "yearly"
                ? "bg-gradient-to-r from-[#4B45FF] to-[#6C67FF] text-white shadow-lg"
                : "bg-white text-[#4B45FF] border-2 border-slate-200/80 hover:border-[#4B45FF]/30"
            }`}
          >
            {t("pricing.yearly")}
            <span className="ml-1.5 text-xs text-emerald-600 font-semibold">
              {t("pricing.yearlyDiscount")}
            </span>
          </button>
        </div>
      )}

      {/* Plan cards grid */}
      <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
        {plans.map((plan) => {
          const isCurrent = plan.key === currentPlanKey;
          const isRecommended = !isCurrent && plan.key === recommendedPlan;
          const popular = isPopular(plan.key);
          const canUpgrade =
            !isCurrent && plan.key !== "free" && plan.stripePriceId != null;
          const features = FEATURE_MATRIX[plan.key] || FEATURE_MATRIX.free;

          const displayPrice =
            plan.monthlyPriceUsd != null && plan.monthlyPriceUsd > 0
              ? billingCycle === "yearly"
                ? Math.round(plan.monthlyPriceUsd * 0.8)
                : plan.monthlyPriceUsd
              : 0;

          return (
            <div
              key={plan.key}
              className={`relative rounded-3xl border-2 p-10 flex flex-col min-h-[560px] transition-all duration-150 ${
                popular
                  ? "border-[#4B45FF] shadow-2xl scale-[1.03] bg-white"
                  : isCurrent
                    ? "border-emerald-400 bg-emerald-50/40 shadow-lg"
                    : isRecommended
                      ? "border-[#4B45FF]/60 bg-[#EDEDFF]/40 shadow-lg"
                      : "border-slate-200/80 hover:border-[#4B45FF]/30 hover:shadow-xl"
              }`}
            >
              {/* Popular badge */}
              {popular && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#1A1A2E] text-white text-xs font-bold rounded-full shadow-xl">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {t("pricing.mostPopular")}
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrent && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-xl">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {t("pricing.currentPlan")}
                  </span>
                </div>
              )}

              {/* Recommended plan badge */}
              {isRecommended && !popular && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-[#4B45FF] to-[#6C67FF] text-white text-xs font-bold rounded-full shadow-xl">
                    {t("pricing.recommended")}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="text-center mb-10 pt-2">
                <h3 className="text-2xl font-semibold text-[#0D0D12] mb-5">
                  {translatePlanName(plan.key, plan.name)}
                </h3>
                <div className="mt-2">
                  {displayPrice > 0 ? (
                    <div>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-6xl font-semibold text-[#0D0D12]">
                          {formatUsd(displayPrice, { decimals: 0 })}
                        </span>
                        <span className="text-[#5A5B6A] text-base font-semibold">
                          {billingCycle === "yearly"
                            ? t("pricing.perMonth")
                            : t("pricing.perMonth")}
                        </span>
                      </div>
                      {billingCycle === "yearly" && (
                        <p className="text-sm text-[#5A5B6A] mt-2 font-medium">
                          ${displayPrice * 12} {t("pricing.perYear")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-6xl font-semibold text-[#0D0D12]">
                        {t("billing.free")}
                      </span>
                      <p className="text-sm text-[#5A5B6A] mt-2 font-medium">
                        {t("billing.freeForever")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* CTA button */}
              <div className="mb-10">
                {isCurrent ? (
                  <div className="w-full px-6 py-3.5 text-center text-sm font-semibold text-emerald-700 bg-emerald-100 rounded-2xl">
                    {t("pricing.currentPlan")}
                  </div>
                ) : mode === "public" && plan.key === "free" ? (
                  <Link
                    href="/portal/login?reauth=1"
                    className="block w-full px-6 py-3.5 text-center text-base font-semibold bg-[#EDEDFF] text-[#4B45FF] rounded-2xl hover:bg-[#E0E0FF] transition-all duration-150"
                  >
                    {t("pricing.startFree")}
                  </Link>
                ) : canUpgrade && onUpgrade ? (
                  <button
                    onClick={() => onUpgrade(plan.key)}
                    disabled={upgradeLoading === plan.key}
                    className={`w-full px-6 py-3.5 text-base font-semibold rounded-2xl transition-all duration-150 disabled:opacity-50 ${
                      popular
                        ? "bg-[#1A1A2E] text-white hover:bg-[#15152A] shadow-xl hover:shadow-2xl"
                        : "bg-[#EDEDFF] text-[#4B45FF] hover:bg-[#E0E0FF]"
                    }`}
                  >
                    {upgradeLoading === plan.key
                      ? t("billing.redirecting")
                      : `${t("pricing.upgrade")}`}
                  </button>
                ) : mode === "public" && plan.key !== "free" ? (
                  <Link
                    href="/portal/login?reauth=1"
                    className={`block w-full px-6 py-3.5 text-center text-base font-semibold rounded-2xl transition-all duration-150 ${
                      popular
                        ? "bg-[#1A1A2E] text-white hover:bg-[#15152A] shadow-xl hover:shadow-2xl"
                        : "bg-[#EDEDFF] text-[#4B45FF] hover:bg-[#E0E0FF]"
                    }`}
                  >
                    {t("pricing.upgrade")}
                  </Link>
                ) : null}
              </div>

              {/* Feature list */}
              <div className="flex-1 border-t border-slate-200/60 pt-6">
                <p className="text-xs font-bold text-[#4B45FF] uppercase tracking-wider mb-4">
                  {t("pricing.features")}
                </p>
                <ul className="space-y-3">
                  {featureKeys.map((fKey) => {
                    let value: boolean | string;

                    // Dynamic limit features
                    if (fKey === "pricing.feature.conversations") {
                      value = formatLimit(plan.maxConversationsPerMonth);
                    } else if (fKey === "pricing.feature.messages") {
                      value = formatLimit(plan.maxMessagesPerMonth);
                    } else if (fKey === "pricing.feature.agents") {
                      value = plan.maxAgents.toLocaleString();
                    } else {
                      value = features[fKey] ?? false;
                    }

                    const isIncluded = value === true || (typeof value === "string" && value !== "false");

                    return (
                      <li key={fKey} className="flex items-start gap-2.5 text-sm">
                        {isIncluded ? (
                          <svg
                            className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-slate-300 mt-0.5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                        <span
                          className={
                            isIncluded ? "text-[#0D0D12] font-medium" : "text-[#8E8EA0]"
                          }
                        >
                          {typeof value === "string" && value !== "true" && value !== "false"
                            ? `${value} ${t(fKey as TranslationKey)}`
                            : t(fKey as TranslationKey)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust badges footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[#8E8EA0] mb-3">
          {t("pricing.trustBadges")}
        </p>
        <div className="flex justify-center">
          <SecurityBadges mfaEnabled={true} passkeysCount={1} auditActive={true} />
        </div>
      </div>
    </div>
  );
}
