"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Code2, MessageSquare, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import { designTokens } from "@/lib/designTokens";

export default function Home() {
  const { t } = useI18n();

  return (
    <PublicLayout>
      {/* Hero — Dark Crisp style */}
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
                <ArrowRight
                  size={16}
                  className="opacity-90 transition-transform duration-200 group-hover:translate-x-0.5"
                />
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

      {/* Trust / Logos */}
      <section className="border-t border-slate-200/60 bg-[#F7F8FA]">
        <div className={`${designTokens.layout.maxWidth} py-14 sm:py-16`}>
          <div className="mx-auto max-w-[920px] text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#0D0D12] sm:text-3xl">
              {t("home.logosTitle")}
            </h2>
            <p className="mt-2 text-[#5A5B6A]">{t("home.logosSubtitle")}</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {["Studio", "Craft", "North", "Atlas", "Weld", "Nova"].map((name) => (
              <div
                key={name}
                className="flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-sm font-extrabold tracking-tight text-[#0D0D12]/40"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Bento */}
      <section className="border-t border-slate-200/60 bg-white">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <div className="mx-auto max-w-[920px] text-center">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full bg-[#EDEDFF] text-[#4B45FF]">
              Features
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0D0D12] sm:text-4xl">
              {t("home.bentoTitle")}
            </h2>
            <p className="mt-3 text-[#5A5B6A]">{t("home.bentoSubtitle")}</p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-12">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_18px_50px_rgba(75,69,255,0.08)] transition-all duration-300 lg:col-span-7">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4B45FF] to-[#6C67FF] shadow-[0_2px_8px_rgba(75,69,255,0.25)]">
                  <MessageSquare size={20} className="text-white" />
                </span>
                <div className="min-w-0">
                  <div className="text-lg font-extrabold tracking-tight text-[#0D0D12]">
                    {t("home.bentoA1Title")}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-[#5A5B6A]">
                    {t("home.bentoA1Desc")}
                  </div>
                  <div className="mt-5 grid gap-2 text-sm text-[#0D0D12]">
                    {[t("home.bentoA1Bullet1"), t("home.bentoA1Bullet2"), t("home.bentoA1Bullet3")].map(
                      (x) => (
                        <div key={x} className="flex items-start gap-2">
                          <span className="mt-0.5 h-2 w-2 rounded-full bg-[#4B45FF]" />
                          <span className="leading-relaxed">{x}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_18px_50px_rgba(75,69,255,0.08)] transition-all duration-300 lg:col-span-5">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0D0D12] to-[#1A1A2E] shadow-sm">
                  <Code2 size={20} className="text-white" />
                </span>
                <div className="min-w-0">
                  <div className="text-lg font-extrabold tracking-tight text-[#0D0D12]">
                    {t("home.bentoA2Title")}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-[#5A5B6A]">
                    {t("home.bentoA2Desc")}
                  </div>
                </div>
              </div>
              <pre className="mt-6 overflow-x-auto rounded-2xl bg-[#0D0D12] p-4 text-[12.5px] leading-relaxed">
                <code className="text-slate-300">{`<!-- Helvion widget -->\n<script>\n  (function(){\n    var s=document.createElement('script');\n    s.src='https://app.helvion.io/widget-v2/loader.js';\n    s.async=true;\n    s.dataset.org='YOUR_ORG_KEY';\n    document.head.appendChild(s);\n  })();\n</script>`}</code>
              </pre>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_14px_40px_rgba(75,69,255,0.06)] transition-all duration-300 lg:col-span-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDEDFF] text-[#4B45FF]">
                  <Zap size={18} />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-[#0D0D12]">{t("home.bentoMini1Title")}</div>
                  <div className="mt-1 text-sm leading-relaxed text-[#5A5B6A]">{t("home.bentoMini1Desc")}</div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_14px_40px_rgba(75,69,255,0.06)] transition-all duration-300 lg:col-span-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-[#0D0D12]">{t("home.bentoMini2Title")}</div>
                  <div className="mt-1 text-sm leading-relaxed text-[#5A5B6A]">{t("home.bentoMini2Desc")}</div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_14px_40px_rgba(75,69,255,0.06)] transition-all duration-300 lg:col-span-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-[#4B45FF]">
                  <Users size={18} />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-[#0D0D12]">{t("home.bentoMini3Title")}</div>
                  <div className="mt-1 text-sm leading-relaxed text-[#5A5B6A]">{t("home.bentoMini3Desc")}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 flex justify-center">
            <Link
              href="/product"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-[#0D0D12] shadow-sm hover:bg-slate-50 transition-all"
            >
              {t("home.bentoCta")}
              <ArrowRight size={16} className="opacity-90" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-[#F7F8FA] border-t border-slate-200/60">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full bg-[#EDEDFF] text-[#4B45FF]">
              Testimonials
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0D0D12] tracking-tight">
              {t("home.testimonialsTitle")}
            </h2>
            <p className="mt-3 text-[#5A5B6A]">{t("home.testimonialsSubtitle")}</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              { quote: t("home.t1Quote"), name: t("home.t1Name"), role: t("home.t1Role") },
              { quote: t("home.t2Quote"), name: t("home.t2Name"), role: t("home.t2Role") },
              { quote: t("home.t3Quote"), name: t("home.t3Name"), role: t("home.t3Role") },
            ].map((x) => (
              <figure
                key={x.name}
                className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_28px_rgba(75,69,255,0.08)] transition-all duration-300"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#EDEDFF] blur-2xl" />
                <blockquote className="text-[15px] leading-relaxed text-[#0D0D12]">"{x.quote}"</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
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

      {/* Final CTA — Dark */}
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

