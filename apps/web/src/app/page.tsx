"use client";

import Link from "next/link";
import Image from "next/image";
import { MessageSquare, Users, ShieldCheck, BarChart3 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import FeatureCard from "@/components/ui/FeatureCard";
import { designTokens } from "@/lib/designTokens";
import { colors, fonts } from "@/lib/design-tokens";

export default function Home() {
  void colors;
  void fonts;
  const { t } = useI18n();

  const features = [
    { title: t("home.feature1Title"), desc: t("home.feature1Desc"), icon: MessageSquare },
    { title: t("home.feature2Title"), desc: t("home.feature2Desc"), icon: Users },
    { title: t("home.feature3Title"), desc: t("home.feature3Desc"), icon: ShieldCheck },
    { title: t("home.feature4Title"), desc: t("home.feature4Desc"), icon: BarChart3 },
  ];

  return (
    <PublicLayout>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#FFFBF5] via-[#FFF8EE] to-white">
        {/* Subtle glow orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-amber-300/15 rounded-full blur-3xl translate-y-1/2" />
        <div className={`${designTokens.layout.maxWidth} pt-16 sm:pt-24 pb-20 sm:pb-28 relative`}>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/80 border border-amber-200/60 text-amber-800 text-xs font-medium mb-6">
                ✨ {t("home.trustedCompliance")}
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1A1D23] tracking-tight leading-[1.08] mb-6">
                {t("home.heroTitle")}
                <span className="block mt-1 bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">
                  {t("home.heroSubline")}
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl mb-8">
                {t("home.heroSubtitle")}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-start gap-3 mb-8">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-1.5 px-8 py-4 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-[0_4px_14px_rgba(245,158,11,0.4)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] transition-all duration-200 hover:-translate-y-0.5 w-full sm:w-auto"
                >
                  {t("home.ctaStartFree")}
                  <span className="text-white/90">→</span>
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 w-full sm:w-auto"
                >
                  {t("home.ctaViewPricing")}
                </Link>
              </div>

              {/* Trust strip */}
              <div className="flex flex-wrap items-center gap-3">
                {[t("home.trustedSecurity"), t("home.trustedUptime"), t("home.trustedCompliance")].map((label) => (
                  <div
                    key={label}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/80 border border-slate-200/80 text-sm font-medium text-slate-600 shadow-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Visual preview block */}
            <div className="relative hidden lg:block">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.12)] p-4 ring-1 ring-slate-900/5">
                <Image
                  src="/marketing/mock-dashboard.svg"
                  alt=""
                  aria-hidden="true"
                  width={1200}
                  height={800}
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Showcase ── */}
      <section className="bg-white border-t border-slate-100">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-24`}>
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1A1D23] tracking-tight">
              {t("home.featureTitle")}
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              {t("home.heroSubtitle")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* ── System status strip ── */}
      <section className={`${designTokens.layout.maxWidth} py-12 sm:py-16`}>
        <Link
          href="/status"
          className="inline-flex items-center gap-3 px-5 py-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-100 hover:border-slate-300 transition-all duration-150"
        >
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          {t("home.systemOperational")}
        </Link>
      </section>
    </PublicLayout>
  );
}
