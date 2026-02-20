"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import PlanComparisonTable, { type PlanData } from "@/components/PlanComparisonTable";
import { designTokens } from "@/lib/designTokens";
import { colors, fonts } from "@/lib/design-tokens";
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
    // Product rule: manual chat is unlimited on ALL plans
    maxConversationsPerMonth: -1,
    maxMessagesPerMonth: -1,
    maxAgents: 3,
    stripePriceId: null,
  },
  {
    key: "starter",
    name: "Starter",
    monthlyPriceUsd: 15,
    maxConversationsPerMonth: -1,
    maxMessagesPerMonth: -1,
    maxAgents: 5,
    stripePriceId: "static",
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPriceUsd: 39,
    maxConversationsPerMonth: -1,
    maxMessagesPerMonth: -1,
    maxAgents: 15,
    stripePriceId: "static",
  },
  {
    key: "business",
    name: "Business",
    monthlyPriceUsd: 119,
    maxConversationsPerMonth: -1,
    maxMessagesPerMonth: -1,
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
  void colors;
  void fonts;
  const { t } = useI18n();

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0D0D12] via-[#13131A] to-[#1A1A2E]">
        <div className="pointer-events-none absolute -left-32 top-0 h-[400px] w-[400px] rounded-full bg-[#4B45FF]/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 -top-20 h-[450px] w-[450px] rounded-full bg-[#6C67FF]/8 blur-3xl" />
        <div className={`${designTokens.layout.maxWidth} pt-20 sm:pt-28 pb-16 sm:pb-20 text-center relative`}>
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full bg-[#4B45FF]/15 text-[#6C67FF]">
            Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white font-heading mb-4 tracking-tight">
            {t("pricing.title")}
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
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
      <section className="bg-[#F7F8FA] border-t border-slate-200/60">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <p className="text-center text-xs text-[#8E8EA0] mb-6">
            {t("pricing.trustBadges")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: t("home.trustedSecurity") },
              { label: t("home.trustedUptime") },
              { label: t("home.trustedCompliance") },
            ].map((badge, i) => (
              <div key={i} className="px-4 py-2 bg-white border border-slate-200/80 rounded-full text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-[#5A5B6A]">
                <Image src="/marketing/icon-spark.svg" alt="" aria-hidden="true" width={16} height={16} className="w-4 h-4 mr-1.5 inline-block" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
          <span className="block text-center text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full bg-[#EDEDFF] text-[#4B45FF] w-fit mx-auto">
            FAQ
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0D0D12] font-heading text-center mb-10 tracking-tight">
            {t("pricing.faqTitle")}
          </h2>
          <div className="space-y-3">
            {FAQ_KEYS.map((faq, i) => (
              <details
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 group shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(75,69,255,0.06)] transition-all duration-150"
              >
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none">
                  <span className="text-base font-semibold text-[#0D0D12] font-heading pr-4">
                    {t(faq.q as TranslationKey)}
                  </span>
                  <svg
                    className="w-4 h-4 text-[#8E8EA0] group-open:rotate-180 group-open:text-[#4B45FF] transition-all duration-150 flex-shrink-0"
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
                <div className="px-6 pb-5 text-sm text-[#5A5B6A] leading-relaxed border-t border-slate-100 pt-4">
                  {t(faq.a as TranslationKey)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
