"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import PlanComparisonTable, { type PlanData } from "@/components/PlanComparisonTable";
import { designTokens } from "@/lib/designTokens";
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
    maxConversationsPerMonth: 200,
    maxMessagesPerMonth: 2000,
    maxAgents: 2,
    stripePriceId: null,
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPriceUsd: 49,
    maxConversationsPerMonth: 2000,
    maxMessagesPerMonth: 20000,
    maxAgents: 10,
    stripePriceId: "static",
  },
  {
    key: "business",
    name: "Business",
    monthlyPriceUsd: 199,
    maxConversationsPerMonth: 10000,
    maxMessagesPerMonth: 100000,
    maxAgents: 50,
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
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F0F9F9] via-white to-white">
        <Image
          src="/marketing/gradient-hero-2.svg"
          alt=""
          aria-hidden="true"
          fill
          priority
          className="object-cover opacity-50"
        />
        <div className={`${designTokens.layout.maxWidth} pt-20 sm:pt-24 pb-16 sm:pb-20 text-center relative`}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
            {t("pricing.title")}
          </h1>
          <p className={`${designTokens.typography.heroSubtitle} max-w-2xl mx-auto`}>
            {t("pricing.subtitle")}
          </p>
        </div>
      </section>

      {/* Plan comparison */}
      <section className={`${designTokens.layout.maxWidth} py-16 sm:py-20`}>
        <PlanComparisonTable
          plans={STATIC_PLANS}
          showBillingToggle={true}
          mode="public"
        />
      </section>

      {/* Trust badges */}
      <section className="bg-slate-50/50 border-t border-slate-200/40">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <p className={`text-center ${designTokens.typography.caption} mb-6`}>
            {t("pricing.trustBadges")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: t("home.trustedSecurity") },
              { label: t("home.trustedUptime") },
              { label: t("home.trustedCompliance") },
            ].map((badge, i) => (
              <div key={i} className={designTokens.chips.pill}>
                <Image src="/marketing/icon-spark.svg" alt="" aria-hidden="true" width={16} height={16} className="w-4 h-4 mr-1.5 inline-block" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-10 tracking-tight">
          {t("pricing.faqTitle")}
        </h2>
        <div className="space-y-3">
          {FAQ_KEYS.map((faq, i) => (
            <details
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 group shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-150"
            >
              <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none">
                <span className="text-base font-semibold text-slate-900 pr-4">
                  {t(faq.q as TranslationKey)}
                </span>
                <svg
                  className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform duration-150 flex-shrink-0"
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
              <div className="px-6 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
                {t(faq.a as TranslationKey)}
              </div>
            </details>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
