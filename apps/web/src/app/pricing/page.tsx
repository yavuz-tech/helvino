"use client";

import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import PlanComparisonTable, { type PlanData } from "@/components/PlanComparisonTable";
import type { TranslationKey } from "@/i18n/translations";

/**
 * Public pricing page — accessible without authentication.
 * Uses static plan data (same structure as API).
 */

const STATIC_PLANS: PlanData[] = [
  {
    key: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    maxConversationsPerMonth: 100,
    maxMessagesPerMonth: 500,
    maxAgents: 1,
    stripePriceId: null,
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPriceUsd: 29,
    maxConversationsPerMonth: 1000,
    maxMessagesPerMonth: 10000,
    maxAgents: 5,
    stripePriceId: "static",
  },
  {
    key: "business",
    name: "Business",
    monthlyPriceUsd: 99,
    maxConversationsPerMonth: 10000,
    maxMessagesPerMonth: 100000,
    maxAgents: 25,
    stripePriceId: "static",
  },
];

const FAQ_KEYS = [
  { q: "pricing.faq1Q", a: "pricing.faq1A" },
  { q: "pricing.faq2Q", a: "pricing.faq2A" },
  { q: "pricing.faq3Q", a: "pricing.faq3A" },
  { q: "pricing.faq4Q", a: "pricing.faq4A" },
  { q: "pricing.faq5Q", a: "pricing.faq5A" },
  { q: "pricing.faq6Q", a: "pricing.faq6A" },
];

export default function PricingPage() {
  const { t } = useI18n();

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          {t("pricing.title")}
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          {t("pricing.subtitle")}
        </p>
      </section>

      {/* Plan comparison */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <PlanComparisonTable
          plans={STATIC_PLANS}
          showBillingToggle={true}
          mode="public"
        />
      </section>

      {/* Trust badges */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <p className="text-center text-sm text-slate-500 mb-6">
          {t("pricing.trustBadges")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {[
            { icon: "shield", label: t("home.trustedSecurity") },
            { icon: "zap", label: t("home.trustedUptime") },
            { icon: "check", label: t("home.trustedCompliance") },
          ].map((badge, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600"
            >
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{badge.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">
          {t("pricing.faqTitle")}
        </h2>
        <div className="space-y-4">
          {FAQ_KEYS.map((faq, i) => (
            <details
              key={i}
              className="bg-white rounded-xl border border-slate-200 group"
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                <span className="text-sm font-medium text-slate-900">
                  {t(faq.q as TranslationKey)}
                </span>
                <svg
                  className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-4 text-sm text-slate-600 leading-relaxed">
                {t(faq.a as TranslationKey)}
              </div>
            </details>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
