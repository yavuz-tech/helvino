"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
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

/** Static feature checklist per plan tier */
const FEATURE_MATRIX: Record<string, Record<string, boolean | string>> = {
  free: {
    "pricing.feature.teamManagement": true,
    "pricing.feature.widgetCustomization": true,
    "pricing.feature.apiAccess": true,
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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

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
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              billingCycle === "monthly"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t("pricing.monthly")}
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              billingCycle === "yearly"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
      <div className="grid gap-6 md:grid-cols-3">
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
              className={`relative rounded-xl border-2 p-6 flex flex-col ${
                popular
                  ? "border-slate-900 shadow-lg"
                  : isCurrent
                    ? "border-emerald-300 bg-emerald-50/30"
                    : isRecommended
                      ? "border-blue-300 bg-blue-50/30 shadow-md"
                      : "border-slate-200"
              }`}
            >
              {/* Popular badge */}
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-slate-900 text-white text-xs font-semibold rounded-full">
                    {t("pricing.mostPopular")}
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full">
                    {t("pricing.currentPlan")}
                  </span>
                </div>
              )}

              {/* Recommended plan badge */}
              {isRecommended && !popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                    {t("pricing.recommended")}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="text-center mb-6 pt-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {translatePlanName(plan.key, plan.name)}
                </h3>
                <div className="mt-3">
                  {displayPrice > 0 ? (
                    <div>
                      <span className="text-4xl font-bold text-slate-900">
                        ${displayPrice}
                      </span>
                      <span className="text-slate-500 text-sm">
                        {billingCycle === "yearly"
                          ? t("pricing.perMonth")
                          : t("pricing.perMonth")}
                      </span>
                      {billingCycle === "yearly" && (
                        <p className="text-xs text-slate-400 mt-1">
                          ${displayPrice * 12}{t("pricing.perYear")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-4xl font-bold text-slate-900">
                        {t("billing.free")}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        {t("billing.freeForever")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* CTA button */}
              <div className="mb-6">
                {isCurrent ? (
                  <div className="w-full px-4 py-2.5 text-center text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg">
                    {t("pricing.currentPlan")}
                  </div>
                ) : mode === "public" && plan.key === "free" ? (
                  <Link
                    href="/portal/login"
                    className="block w-full px-4 py-2.5 text-center text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    {t("pricing.startFree")}
                  </Link>
                ) : canUpgrade && onUpgrade ? (
                  <button
                    onClick={() => onUpgrade(plan.key)}
                    disabled={upgradeLoading === plan.key}
                    className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      popular
                        ? "bg-slate-900 text-white hover:bg-slate-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {upgradeLoading === plan.key
                      ? t("billing.redirecting")
                      : `${t("pricing.upgrade")}`}
                  </button>
                ) : mode === "public" && plan.key !== "free" ? (
                  <Link
                    href="/portal/login"
                    className={`block w-full px-4 py-2.5 text-center text-sm font-medium rounded-lg transition-colors ${
                      popular
                        ? "bg-slate-900 text-white hover:bg-slate-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {t("pricing.upgrade")}
                  </Link>
                ) : null}
              </div>

              {/* Feature list */}
              <div className="flex-1 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  {t("pricing.features")}
                </p>
                <ul className="space-y-2.5">
                  {featureKeys.map((fKey) => {
                    let value: boolean | string;

                    // Dynamic limit features
                    if (fKey === "pricing.feature.conversations") {
                      value = String(plan.maxConversationsPerMonth);
                    } else if (fKey === "pricing.feature.messages") {
                      value = String(plan.maxMessagesPerMonth);
                    } else if (fKey === "pricing.feature.agents") {
                      value = String(plan.maxAgents);
                    } else {
                      value = features[fKey] ?? false;
                    }

                    const isIncluded = value === true || (typeof value === "string" && value !== "false");

                    return (
                      <li key={fKey} className="flex items-start gap-2 text-sm">
                        {isIncluded ? (
                          <svg
                            className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4 text-slate-300 mt-0.5 shrink-0"
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
                            isIncluded ? "text-slate-700" : "text-slate-400"
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
        <p className="text-xs text-slate-500 mb-3">
          {t("pricing.trustBadges")}
        </p>
        <div className="flex justify-center">
          <SecurityBadges mfaEnabled={true} passkeysCount={1} auditActive={true} />
        </div>
      </div>
    </div>
  );
}
