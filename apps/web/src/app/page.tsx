"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";

export default function Home() {
  const { t } = useI18n();

  const features = [
    {
      title: t("home.feature1Title"),
      desc: t("home.feature1Desc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      title: t("home.feature2Title"),
      desc: t("home.feature2Desc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      title: t("home.feature3Title"),
      desc: t("home.feature3Desc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: t("home.feature4Title"),
      desc: t("home.feature4Desc"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <PublicLayout>
      {/* ── Hero Section ── */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-5">
          {t("home.heroTitle")}
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
          {t("home.heroSubtitle")}
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <Link
            href="/portal/login"
            className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
          >
            {t("home.ctaStartFree")}
          </Link>
          <Link
            href="/pricing"
            className="px-6 py-3 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
          >
            {t("home.ctaViewPricing")}
          </Link>
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>{t("home.trustedSecurity")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>{t("home.trustedUptime")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span>{t("home.trustedCompliance")}</span>
          </div>
        </div>
      </section>

      {/* ── Feature Grid ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
          {t("home.featureTitle")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-sm transition-shadow"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700 mb-4">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── System status strip ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20 text-center">
        <Link
          href="/status"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm font-medium hover:bg-green-100 transition-colors"
        >
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          {t("home.systemOperational")}
        </Link>
      </section>
    </PublicLayout>
  );
}
