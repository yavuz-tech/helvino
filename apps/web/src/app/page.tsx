"use client";

import Link from "next/link";
import Image from "next/image";
import { MessageSquare, Users, ShieldCheck, BarChart3 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import FeatureCard from "@/components/FeatureCard";
import { designTokens } from "@/lib/designTokens";

export default function Home() {
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
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F0F9F9] via-white to-white">
        <Image
          src="/marketing/gradient-hero-1.svg"
          alt=""
          aria-hidden="true"
          fill
          priority
          className="object-cover opacity-40"
        />
        <Image
          src="/marketing/blob-mesh-1.svg"
          alt=""
          aria-hidden="true"
          width={520}
          height={520}
          className="absolute -top-24 -right-24 w-[520px] opacity-40"
        />
        <div className={`${designTokens.layout.maxWidth} pt-20 sm:pt-28 pb-20 sm:pb-24 relative`}>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className={designTokens.typography.heroTitle + " mb-6"}>
                {t("home.heroTitle")}
              </h1>
              <p className={designTokens.typography.heroSubtitle + " max-w-xl mb-8"}>
                {t("home.heroSubtitle")}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-start gap-3 mb-8">
                <Link href="/portal/login?reauth=1" className={designTokens.buttons.primaryLg + " w-full sm:w-auto"}>
                  {t("home.ctaStartFree")}
                </Link>
                <Link href="/pricing" className={designTokens.buttons.secondaryLg + " w-full sm:w-auto"}>
                  {t("home.ctaViewPricing")}
                </Link>
              </div>

              {/* Trust strip */}
              <div className="flex flex-wrap items-center gap-3">
                {[t("home.trustedSecurity"), t("home.trustedUptime"), t("home.trustedCompliance")].map((label) => (
                  <div key={label} className={designTokens.chips.pill}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Visual preview block */}
            <div className="relative hidden lg:block">
              <div className={`bg-white border border-slate-200/80 rounded-2xl ${designTokens.shadows.elevated} p-5`}>
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
      <section className="bg-slate-50/50 border-t border-slate-200/40">
        <div className={`${designTokens.layout.maxWidth} ${designTokens.spacing.sectionY}`}>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              {t("home.featureTitle")}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
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
          className="inline-flex items-center gap-3 px-5 py-3 bg-white border border-slate-200/80 text-slate-600 rounded-full text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-slate-300 transition-all duration-150"
        >
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
          {t("home.systemOperational")}
        </Link>
      </section>
    </PublicLayout>
  );
}
