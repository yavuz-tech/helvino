"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Code2,
  Inbox,
  MessageSquare,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import { designTokens } from "@/lib/designTokens";

export default function Home() {
  const { t } = useI18n();
  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  const platformFeatures = [
    { icon: Bot, title: t("home.pf1Title"), desc: t("home.pf1Desc") },
    { icon: MessageSquare, title: t("home.pf2Title"), desc: t("home.pf2Desc") },
    { icon: Inbox, title: t("home.pf3Title"), desc: t("home.pf3Desc") },
    { icon: BookOpen, title: t("home.pf4Title"), desc: t("home.pf4Desc") },
    { icon: Users, title: t("home.pf5Title"), desc: t("home.pf5Desc") },
    { icon: BarChart3, title: t("home.pf6Title"), desc: t("home.pf6Desc") },
  ];

  const steps = [
    { title: t("home.step1Title"), desc: t("home.step1Desc") },
    { title: t("home.step2Title"), desc: t("home.step2Desc") },
    { title: t("home.step3Title"), desc: t("home.step3Desc") },
    { title: t("home.step4Title"), desc: t("home.step4Desc") },
  ];

  const showcases = [
    { title: t("home.showcase1Title"), desc: t("home.showcase1Desc"), cta: t("home.showcase1Cta"), href: "/product", icon: Inbox },
    { title: t("home.showcase2Title"), desc: t("home.showcase2Desc"), cta: t("home.showcase2Cta"), href: "/product", icon: BookOpen },
    { title: t("home.showcase3Title"), desc: t("home.showcase3Desc"), cta: t("home.showcase3Cta"), href: "/product", icon: Workflow },
  ];

  const builtForTabs = [
    { label: t("home.builtForSupport"), desc: t("home.builtForSupportDesc"), icon: ShieldCheck },
    { label: t("home.builtForSales"), desc: t("home.builtForSalesDesc"), icon: Zap },
    { label: t("home.builtForMarketing"), desc: t("home.builtForMarketingDesc"), icon: Megaphone },
  ];

  const testimonials = [
    { quote: t("home.t1Quote"), name: t("home.t1Name"), role: t("home.t1Role") },
    { quote: t("home.t2Quote"), name: t("home.t2Name"), role: t("home.t2Role") },
    { quote: t("home.t3Quote"), name: t("home.t3Name"), role: t("home.t3Role") },
    { quote: t("home.t4Quote"), name: t("home.t4Name"), role: t("home.t4Role") },
    { quote: t("home.t5Quote"), name: t("home.t5Name"), role: t("home.t5Role") },
    { quote: t("home.t6Quote"), name: t("home.t6Name"), role: t("home.t6Role") },
  ];

  return (
    <PublicLayout>
      {/* ═══════════════════════════════════════════════════════════
          HERO — Dark gradient, pill badge, big title, 2 CTAs, screenshot
         ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0D0D12] via-[#13131A] to-[#1A1A2E]">
        <div className="pointer-events-none absolute -left-44 top-10 h-[560px] w-[560px] rounded-full bg-[#4B45FF]/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-48 -top-24 h-[620px] w-[620px] rounded-full bg-[#6C67FF]/8 blur-3xl" />

        <div className={`${designTokens.layout.maxWidth} relative pt-20 sm:pt-28 pb-16 sm:pb-24`}>
          <div className="mx-auto max-w-[920px] text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#4B45FF]/30 bg-[#4B45FF]/10 px-4 py-2 text-xs font-semibold text-[#6C67FF] backdrop-blur">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#4B45FF]/20">
                <Sparkles size={12} className="text-[#6C67FF]" />
              </span>
              <span>{t("home.heroPill")}</span>
            </div>

            <h1 className="mt-7 text-[40px] font-extrabold tracking-tight text-white leading-[1.03] sm:text-6xl">
              {t("home.heroTitle")}
              <span className="block mt-2 bg-gradient-to-r from-[#4B45FF] via-[#6C67FF] to-[#9B8AFF] bg-clip-text text-transparent">
                {t("home.heroSubline")}
              </span>
            </h1>

            <p className="mt-5 text-lg text-slate-400 leading-relaxed sm:text-xl">
              {t("home.heroSubtitle")}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4B45FF] to-[#6C67FF] px-8 py-4 text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(75,69,255,0.36)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_54px_rgba(75,69,255,0.44)]"
              >
                {t("home.ctaStartFree")}
                <ArrowRight size={16} className="opacity-90 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-white/5 px-8 py-4 text-[15px] font-semibold text-white shadow-sm hover:bg-white/10 backdrop-blur transition-all"
              >
                {t("home.ctaExploreProduct")}
              </Link>
            </div>

            <div className="mt-6 text-xs font-semibold text-slate-500">
              {t("home.heroNote")}
            </div>
          </div>

          <div className="mt-14 sm:mt-18">
            <div className="mx-auto max-w-[1120px] rounded-3xl bg-gradient-to-br from-[#4B45FF]/30 via-[#13131A] to-[#6C67FF]/20 p-[1px] shadow-[0_34px_110px_rgba(75,69,255,0.18)]">
              <div className="rounded-3xl border border-white/5 bg-[#13131A]/80 p-4 backdrop-blur-2xl sm:p-5">
                <Image
                  src="/marketing/mock-dashboard.svg"
                  alt=""
                  aria-hidden="true"
                  width={1400}
                  height={900}
                  className="h-auto w-full rounded-2xl border border-slate-700/50 shadow-[0_18px_55px_rgba(0,0,0,0.30)]"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          PLATFORM FEATURE GRID — 6 cards with icons (Crisp style)
         ═══════════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200/60 bg-[#F7F8FA]">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <div className="mx-auto max-w-[720px] text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0D0D12] sm:text-4xl">
              {t("home.platformTitle")}
            </h2>
            <p className="mt-3 text-[#5A5B6A]">{t("home.platformSubtitle")}</p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {platformFeatures.map((f, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_14px_40px_rgba(75,69,255,0.08)] hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4B45FF] to-[#6C67FF] shadow-[0_2px_8px_rgba(75,69,255,0.25)] mb-5 group-hover:scale-105 transition-transform">
                  <f.icon size={22} className="text-white" />
                </div>
                <h3 className="text-[15px] font-extrabold text-[#0D0D12] tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5A5B6A]">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#4B45FF] hover:text-[#3B35EF] transition-colors"
            >
              {t("home.platformIncluded")}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          4-STEP STEPPER — Interactive, Crisp "Build your AI Agent" style
         ═══════════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200/60 bg-white">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <div className="mx-auto max-w-[720px] text-center">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full bg-[#EDEDFF] text-[#4B45FF]">
              How it works
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0D0D12] sm:text-4xl">
              {t("home.stepperTitle")}
            </h2>
            <p className="mt-3 text-[#5A5B6A]">{t("home.stepperSubtitle")}</p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-16 items-start">
            <div className="space-y-3">
              {steps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`w-full text-left rounded-2xl border-2 p-6 transition-all duration-200 ${
                    activeStep === i
                      ? "border-[#4B45FF] bg-[#EDEDFF]/40 shadow-[0_4px_16px_rgba(75,69,255,0.10)]"
                      : "border-slate-200/80 bg-white hover:border-[#4B45FF]/30"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-colors ${
                        activeStep === i
                          ? "bg-[#4B45FF] text-white"
                          : "bg-slate-100 text-[#5A5B6A]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className={`text-[15px] font-extrabold tracking-tight ${activeStep === i ? "text-[#0D0D12]" : "text-[#5A5B6A]"}`}>
                        {step.title}
                      </div>
                      {activeStep === i && (
                        <p className="mt-2 text-sm leading-relaxed text-[#5A5B6A] animate-in fade-in duration-200">
                          {step.desc}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-[#4B45FF]/20 via-[#EDEDFF] to-[#6C67FF]/10 p-[1px] shadow-[0_20px_60px_rgba(75,69,255,0.12)]">
                <div className="rounded-3xl bg-white p-6 sm:p-8">
                  <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-50 to-[#EDEDFF]/60 flex items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4B45FF] to-[#6C67FF] shadow-[0_4px_16px_rgba(75,69,255,0.30)]">
                        {activeStep === 0 && <Code2 size={28} className="text-white" />}
                        {activeStep === 1 && <Users size={28} className="text-white" />}
                        {activeStep === 2 && <Bot size={28} className="text-white" />}
                        {activeStep === 3 && <BarChart3 size={28} className="text-white" />}
                      </div>
                      <p className="mt-4 text-lg font-extrabold text-[#0D0D12]">{steps[activeStep].title}</p>
                      <p className="mt-2 max-w-xs mx-auto text-sm text-[#5A5B6A] leading-relaxed">{steps[activeStep].desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4B45FF] to-[#6C67FF] px-8 py-4 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(75,69,255,0.35)] transition-all hover:-translate-y-0.5"
            >
              {t("home.stepperCta")}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          3x FEATURE SHOWCASES — Full-width, alternating layout
         ═══════════════════════════════════════════════════════════ */}
      {showcases.map((sc, i) => (
        <section
          key={i}
          className={`border-t border-slate-200/60 ${i % 2 === 0 ? "bg-[#F7F8FA]" : "bg-white"}`}
        >
          <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
            <div className={`grid gap-12 lg:grid-cols-2 lg:gap-16 items-center ${i % 2 === 1 ? "lg:grid-flow-dense" : ""}`}>
              <div className={i % 2 === 1 ? "lg:col-start-2" : ""}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4B45FF] to-[#6C67FF] shadow-[0_2px_8px_rgba(75,69,255,0.25)] mb-6">
                  <sc.icon size={22} className="text-white" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-[#0D0D12] sm:text-3xl">
                  {sc.title}
                </h2>
                <p className="mt-4 text-[#5A5B6A] leading-relaxed">{sc.desc}</p>
                <Link
                  href={sc.href}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#4B45FF] hover:text-[#3B35EF] transition-colors"
                >
                  {sc.cta}
                  <ArrowRight size={14} />
                </Link>
              </div>
              <div className={i % 2 === 1 ? "lg:col-start-1" : ""}>
                <div className="rounded-3xl bg-gradient-to-br from-[#4B45FF]/15 via-[#EDEDFF]/60 to-[#6C67FF]/10 p-[1px] shadow-[0_16px_48px_rgba(75,69,255,0.10)]">
                  <div className="rounded-3xl bg-white p-5">
                    <div className="aspect-[16/10] rounded-2xl bg-gradient-to-br from-slate-50 to-[#EDEDFF]/40 flex items-center justify-center">
                      <sc.icon size={48} className="text-[#4B45FF]/30" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ═══════════════════════════════════════════════════════════
          BUILT FOR — 3 tabs (Support, Sales, Marketing)
         ═══════════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200/60 bg-white">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <div className="mx-auto max-w-[720px] text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0D0D12] sm:text-4xl">
              {t("home.builtForTitle")}
            </h2>
            <p className="mt-2 text-lg text-[#5A5B6A]">{t("home.builtForSubtitle")}</p>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {builtForTabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 ${
                  activeTab === i
                    ? "bg-[#0D0D12] text-white shadow-lg"
                    : "bg-slate-100 text-[#5A5B6A] hover:bg-slate-200"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-10 mx-auto max-w-2xl">
            <div className="rounded-3xl border border-slate-200/80 bg-[#F7F8FA] p-8 sm:p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4B45FF] to-[#6C67FF] shadow-[0_4px_16px_rgba(75,69,255,0.25)] mb-6">
                {(() => { const Icon = builtForTabs[activeTab].icon; return <Icon size={28} className="text-white" />; })()}
              </div>
              <h3 className="text-xl font-extrabold text-[#0D0D12]">{builtForTabs[activeTab].label}</h3>
              <p className="mt-3 text-[#5A5B6A] leading-relaxed">{builtForTabs[activeTab].desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TESTIMONIALS — 6 quotes in 2-row grid
         ═══════════════════════════════════════════════════════════ */}
      <section className="bg-[#F7F8FA] border-t border-slate-200/60">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full bg-[#EDEDFF] text-[#4B45FF]">
              Testimonials
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D0D12] tracking-tight">
              {t("home.socialProofCount")}
            </h2>
            <p className="mt-3 text-[#5A5B6A]">{t("home.testimonialsSubtitle")}</p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((x) => (
              <figure
                key={x.name}
                className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_28px_rgba(75,69,255,0.08)] transition-all duration-300"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#EDEDFF] blur-2xl" />
                <blockquote className="relative text-[15px] leading-relaxed text-[#0D0D12]">&ldquo;{x.quote}&rdquo;</blockquote>
                <figcaption className="relative mt-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#4B45FF] to-[#6C67FF] text-white flex items-center justify-center text-sm font-black shadow-[0_2px_8px_rgba(75,69,255,0.25)]">
                    {String(x.name || "H").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0D0D12]">{x.name}</div>
                    <div className="text-xs font-semibold text-[#8E8EA0]">{x.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FINAL CTA — Dark banner
         ═══════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-[#0D0D12] via-[#13131A] to-[#1A1A2E]">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <div className="relative mx-auto max-w-2xl text-center">
            <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-[#4B45FF]/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-32 -bottom-32 h-72 w-72 rounded-full bg-[#6C67FF]/10 blur-3xl" />

            <h2 className="relative text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              {t("home.finalCtaTitle")}
            </h2>
            <p className="relative mt-4 text-slate-400">{t("home.finalCtaSubtitle")}</p>
            <div className="relative mt-10 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4B45FF] to-[#6C67FF] px-8 py-4 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(75,69,255,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(75,69,255,0.45)]"
              >
                {t("home.finalCtaPrimary")}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-white/5 px-8 py-4 text-[15px] font-semibold text-white hover:bg-white/10 backdrop-blur transition-all"
              >
                {t("home.finalCtaSecondary")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Status */}
      <section className="bg-white">
        <div className={`${designTokens.layout.maxWidth} py-10 sm:py-14`}>
          <Link
            href="/status"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#0D0D12] shadow-sm hover:bg-slate-50 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t("home.systemOperational")}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

