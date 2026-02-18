"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  DatabaseZap,
  Globe,
  Layers,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Zap,
} from "lucide-react";
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

  const compare = [
    { href: "/compare/tidio", title: "Helvion vs Tidio", desc: t("home.compareTidioDesc") },
    { href: "/compare/crisp", title: "Helvion vs Crisp", desc: t("home.compareCrispDesc") },
  ];

  return (
    <PublicLayout>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#FFFBF5] via-[#FFF6EA] to-white">
        <div className="absolute inset-0 opacity-[0.10]">
          <Image src="/marketing/blob-mesh-1.svg" alt="" aria-hidden="true" fill className="object-cover" />
        </div>
        <div className="pointer-events-none absolute -left-56 top-10 h-[640px] w-[640px] rounded-full bg-amber-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-56 -top-12 h-[640px] w-[640px] rounded-full bg-rose-300/18 blur-3xl" />

        <div className={`${designTokens.layout.maxWidth} relative pt-16 sm:pt-24 pb-16 sm:pb-24`}>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                <Sparkles size={14} className="text-amber-600" />
                <span>{t("home.heroPill")}</span>
              </div>

              <h1 className="mt-6 text-[40px] sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.04]">
                {t("home.heroTitle")}
                <span className="block mt-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                  {t("home.heroSubline")}
                </span>
              </h1>

              <p className="mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl">
                {t("home.heroSubtitle")}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-[15px] font-semibold text-white rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-[0_12px_34px_rgba(245,158,11,0.34)] hover:shadow-[0_16px_44px_rgba(245,158,11,0.42)] transition-all duration-200 hover:-translate-y-0.5"
                >
                  {t("home.ctaStartFree")}
                  <ArrowRight size={16} className="opacity-90 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/product"
                  className="inline-flex items-center justify-center px-8 py-4 text-[15px] font-semibold text-slate-800 bg-white/85 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 transition-all duration-150"
                >
                  {t("home.ctaExploreProduct")}
                </Link>
              </div>

              <div className="mt-8 grid gap-2.5">
                {[t("home.heroBullet1"), t("home.heroBullet2"), t("home.heroBullet3")].map((txt) => (
                  <div key={txt} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 border border-slate-200 shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    </span>
                    <span className="text-sm sm:text-[15px] leading-relaxed text-slate-700">{txt}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-2.5">
                {[
                  { icon: <Timer size={14} className="text-amber-700" />, label: t("home.metricSetup") },
                  { icon: <DatabaseZap size={14} className="text-amber-700" />, label: t("home.metricInbox") },
                  { icon: <ShieldCheck size={14} className="text-amber-700" />, label: t("home.metricSecurity") },
                ].map((m) => (
                  <div key={m.label} className="inline-flex items-center gap-2 rounded-full border border-amber-200/65 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                    {m.icon}
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="grid gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm">
                        <Zap size={18} className="text-white" />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">{t("home.bento1Title")}</p>
                        <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t("home.bento1Desc")}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 shadow-sm">
                        <Code2 size={18} className="text-white" />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">{t("home.bentoDevTitle")}</p>
                        <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t("home.bentoDevDesc")}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_28px_70px_-24px_rgba(0,0,0,0.36)] ring-1 ring-slate-900/5 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-white to-amber-50">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Globe size={14} className="text-amber-600" />
                      <span>{t("home.previewLabel")}</span>
                    </div>
                    <span className="text-[11px] font-black tracking-[0.14em] text-amber-800 bg-amber-100 border border-amber-200/70 px-2 py-1 rounded-full">
                      {t("home.previewBadge")}
                    </span>
                  </div>
                  <div className="p-4">
                    <Image
                      src="/marketing/mock-inbox.svg"
                      alt=""
                      aria-hidden="true"
                      width={1200}
                      height={820}
                      className="w-full h-auto rounded-xl"
                      priority
                    />
                  </div>
                </div>
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
              {t("home.featureSubtitle")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Developer-ready ── */}
      <section className="border-t border-slate-100 bg-gradient-to-b from-white to-[#FFFBF5]">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-24`}>
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                <Code2 size={14} className="text-slate-900" />
                <span>{t("home.devPill")}</span>
              </div>
              <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                {t("home.devTitle")}
              </h2>
              <p className="mt-3 text-slate-600 leading-relaxed">
                {t("home.devSubtitle")}
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/developers"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  {t("home.devCtaDocs")}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/product#live-chat"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {t("home.devCtaWidget")}
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10)] overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-gradient-to-r from-white to-slate-50">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <Code2 size={14} className="text-slate-900" />
                    <span>{t("home.devSnippetTitle")}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{t("home.devSnippetHint")}</span>
                </div>
                <pre className="m-0 overflow-x-auto p-4 text-[12.5px] leading-relaxed bg-[#0B1220]">
                  <code className="text-slate-100">{`<!-- Helvion widget -->\n<script>\n  (function(){\n    var s=document.createElement('script');\n    s.src='https://app.helvion.io/widget-v2/loader.js';\n    s.async=true;\n    s.dataset.org='YOUR_ORG_KEY';\n    document.head.appendChild(s);\n  })();\n</script>`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Compare ── */}
      <section className="bg-white border-t border-slate-100">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-24`}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {t("home.compareTitle")}
            </h2>
            <p className="mt-3 text-slate-600">
              {t("home.compareSubtitle")}
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {compare.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_10px_28px_rgba(15,23,42,0.06)] hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)] transition-all"
              >
                <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-200/35 blur-3xl transition-opacity group-hover:opacity-90" />
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm">
                    <Layers size={18} className="text-white" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold tracking-tight text-slate-900">{c.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-slate-600">{c.desc}</div>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
                      {t("home.compareCta")}
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-slate-100 bg-gradient-to-b from-white to-[#FFFBF5]">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-24`}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1A1D23] tracking-tight">
              {t("home.howTitle")}
            </h2>
            <p className="mt-3 text-slate-600">
              {t("home.howSubtitle")}
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              { n: "01", title: t("home.how1Title"), desc: t("home.how1Desc") },
              { n: "02", title: t("home.how2Title"), desc: t("home.how2Desc") },
              { n: "03", title: t("home.how3Title"), desc: t("home.how3Desc") },
            ].map((s) => (
              <div
                key={s.n}
                className="relative overflow-hidden rounded-2xl border border-amber-200/55 bg-white/75 p-7 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur-sm"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-200/35 blur-2xl" />
                <div className="text-xs font-black tracking-[0.22em] text-amber-700">{s.n}</div>
                <div className="mt-3 text-lg font-extrabold tracking-tight text-slate-900">{s.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-white border-t border-slate-100">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-24`}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1A1D23] tracking-tight">
              {t("home.testimonialsTitle")}
            </h2>
            <p className="mt-3 text-slate-600">
              {t("home.testimonialsSubtitle")}
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              { quote: t("home.t1Quote"), name: t("home.t1Name"), role: t("home.t1Role") },
              { quote: t("home.t2Quote"), name: t("home.t2Name"), role: t("home.t2Role") },
              { quote: t("home.t3Quote"), name: t("home.t3Name"), role: t("home.t3Role") },
            ].map((x) => (
              <figure
                key={x.name}
                className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-100 blur-2xl" />
                <blockquote className="text-[15px] leading-relaxed text-slate-700">
                  “{x.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-black shadow-sm">
                    {String(x.name || "H").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{x.name}</div>
                    <div className="text-xs font-semibold text-slate-500">{x.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-slate-100 bg-gradient-to-b from-white to-[#FFFBF5]">
        <div className={`${designTokens.layout.maxWidth} py-16 sm:py-20`}>
          <div className="relative overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-8 sm:p-12 shadow-[0_30px_80px_rgba(149,115,22,0.18)]">
            <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
            <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />

            <div className="relative mx-auto max-w-2xl text-center">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                {t("home.finalCtaTitle")}
              </h2>
              <p className="mt-3 text-slate-600">
                {t("home.finalCtaSubtitle")}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-4 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all hover:brightness-105"
                >
                  {t("home.finalCtaPrimary")}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/product"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-8 py-4 text-[15px] font-semibold text-slate-700 hover:bg-white"
                >
                  {t("home.finalCtaSecondary")}
                </Link>
              </div>
            </div>
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
