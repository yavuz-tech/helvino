"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Globe,
  Inbox,
  MessageSquare,
  MousePointerClick,
  Search,
  Send,
  Shield,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";

/* ─────────────── helpers ─────────────── */
function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const W = "max-w-[1280px] mx-auto px-6 sm:px-8";

/* ─────────────── Bento cards ─────────────── */

function BentoInbox() {
  const items = [
    { av: "A", name: "Ayşe Demir", msg: "Ödeme hatası alıyorum", time: "2m", color: "bg-teal-600" },
    { av: "C", name: "Carlos M.", msg: "Password reset help", time: "8m", color: "bg-emerald-500" },
    { av: "L", name: "Lina S.", msg: "Widget kurulum sorusu", time: "15m", color: "bg-amber-500" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Inbox size={16} className="text-teal-600" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inbox</span>
        <span className="ml-auto rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">3 new</span>
      </div>
      <div className="flex-1 space-y-2">
        {items.map((c, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${i === 0 ? "bg-teal-50 ring-1 ring-teal-200" : "hover:bg-slate-50"}`}>
            <div className={`h-8 w-8 shrink-0 rounded-full ${c.color} flex items-center justify-center text-white text-[10px] font-bold`}>{c.av}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-slate-800 truncate">{c.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{c.msg}</div>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0">{c.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BentoAI() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center">
          <Bot size={14} className="text-white" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-slate-800">Helvion AI</div>
          <div className="text-[10px] text-emerald-500 font-medium">Active</div>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-tl-lg bg-slate-100 px-3.5 py-2 text-[12px] text-slate-700 max-w-[85%]">
            How do I upgrade my plan?
          </div>
        </div>
        <div className="flex justify-end">
          <div className="rounded-2xl rounded-tr-lg bg-teal-600 px-3.5 py-2 text-[12px] text-white max-w-[85%]">
            Go to Settings → Billing. Want me to guide you?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-tl-lg bg-slate-100 px-3.5 py-2 text-[12px] text-slate-700">Yes!</div>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-1 text-[10px] font-semibold text-teal-700">
            <Sparkles size={10} /> Composing…
          </span>
        </div>
      </div>
    </div>
  );
}

function BentoStats() {
  const bars = [40, 65, 50, 80, 60, 90, 70, 85];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-teal-600" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analytics</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-teal-50 p-3">
          <div className="text-[10px] text-teal-600 font-semibold">Resolution</div>
          <div className="text-xl font-extrabold text-slate-900">67%</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <div className="text-[10px] text-amber-600 font-semibold">Avg. Reply</div>
          <div className="text-xl font-extrabold text-slate-900">1.4m</div>
        </div>
      </div>
      <div className="flex-1 flex items-end gap-1.5">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-t bg-gradient-to-t from-teal-600 to-cyan-400" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BentoWidget() {
  return (
    <div className="h-full flex flex-col items-center justify-center relative">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl" />
      <div className="relative">
        {/* page skeleton */}
        <div className="space-y-2 mb-4 opacity-40">
          <div className="h-2 w-24 rounded bg-slate-300" />
          <div className="h-2 w-32 rounded bg-slate-200" />
          <div className="h-2 w-20 rounded bg-slate-200" />
        </div>
        {/* widget bubble */}
        <div className="absolute -bottom-2 -right-2">
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <MessageSquare size={20} className="text-white" />
            </div>
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">1</span>
          </div>
        </div>
      </div>
      <div className="relative mt-6 text-center">
        <div className="text-[11px] font-bold text-slate-600">Live Chat Widget</div>
        <div className="text-[10px] text-slate-400">Embed in 30 seconds</div>
      </div>
    </div>
  );
}

/* ─────────────── Interactive stepper ─────────────── */
function StepperSection({ steps }: { steps: { title: string; desc: string }[] }) {
  const [active, setActive] = useState(0);
  const visuals = [
    <div key={0} className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/20">
          <MousePointerClick size={36} className="text-white" />
        </div>
        <div className="font-mono text-sm text-slate-500 bg-slate-100 rounded-lg px-4 py-2 inline-block">
          {'<script src="helvion.js" />'}
        </div>
      </div>
    </div>,
    <div key={1} className="flex items-center justify-center h-full">
      <div className="space-y-3 w-full max-w-xs">
        {["Support Team", "Sales Team", "VIP Queue"].map((t, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${i === 0 ? "bg-teal-600" : i === 1 ? "bg-amber-500" : "bg-violet-500"}`}>
              {t[0]}
            </div>
            <span className="text-sm font-medium text-slate-700">{t}</span>
            <Users size={14} className="ml-auto text-slate-400" />
          </div>
        ))}
      </div>
    </div>,
    <div key={2} className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
          <Zap size={36} className="text-white" />
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {[
            { label: "CSAT", val: "96%" },
            { label: "Resolved", val: "67%" },
          ].map((s, i) => (
            <div key={i} className="rounded-xl bg-white border border-slate-200 px-4 py-2 shadow-sm">
              <div className="text-lg font-extrabold text-slate-900">{s.val}</div>
              <div className="text-[10px] text-slate-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
      <div className="space-y-3">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-full text-left rounded-2xl p-6 transition-all duration-300 ${
              active === i
                ? "bg-white shadow-lg shadow-teal-900/5 ring-2 ring-teal-600/20"
                : "bg-white/60 hover:bg-white hover:shadow-md"
            }`}
          >
            <div className="flex items-start gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-colors ${
                active === i ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-400"
              }`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className={`text-base font-bold transition-colors ${active === i ? "text-slate-900" : "text-slate-500"}`}>
                  {step.title}
                </div>
                <AnimatePresence>
                  {active === i && (
                    <motion.p
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="text-sm text-slate-500 leading-relaxed overflow-hidden"
                    >
                      {step.desc}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/80 p-8 min-h-[320px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            {visuals[active]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */
export default function Home() {
  const { t } = useI18n();

  const logos = ["Acme Corp", "TechFlow", "Buildify", "LaunchPad", "DataSync", "CloudBase", "Nextera", "Shipfast"];

  return (
    <PublicLayout>

      {/* ═══════  HERO  ═══════ */}
      <section className="relative overflow-hidden bg-[#080810] min-h-[90vh] flex items-center">
        {/* mesh gradient */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-teal-900/30 blur-[150px]" />
          <div className="absolute bottom-[-10%] right-[-5%] h-[500px] w-[500px] rounded-full bg-cyan-900/20 blur-[120px]" />
          <div className="absolute top-[30%] right-[20%] h-[300px] w-[300px] rounded-full bg-amber-900/10 blur-[100px]" />
        </div>

        <div className={`${W} relative py-20 sm:py-28`}>
          <Reveal className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[13px] font-medium text-slate-400 backdrop-blur mb-8">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {t("home.heroPill")}
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]">
              <span className="text-white">{t("home.heroTitle")}</span>
              <br />
              <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                {t("home.heroSubline")}
              </span>
            </h1>

            <p className="mt-6 text-xl text-slate-400 leading-relaxed max-w-2xl">
              {t("home.heroSubtitle")}
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-[15px] font-bold text-slate-900 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:-translate-y-0.5 transition-all duration-300"
              >
                {t("home.finalCtaPrimary")}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-4 text-[15px] font-semibold text-white hover:bg-white/5 transition-all"
              >
                {t("home.heroCtaDemo")}
              </Link>
            </div>

            <p className="mt-5 text-sm text-slate-500">{t("home.heroNoCreditCard")}</p>
          </Reveal>

          {/* floating stats */}
          <Reveal delay={0.3} className="mt-16 sm:mt-20">
            <div className="flex flex-wrap gap-8 sm:gap-16">
              {[
                { val: t("home.stat1Val"), label: t("home.stat1Label") },
                { val: t("home.stat2Val"), label: t("home.stat2Label") },
                { val: t("home.stat3Val"), label: t("home.stat3Label") },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{s.val}</div>
                  <div className="text-sm text-slate-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════  LOGOS  ═══════ */}
      <section className="border-b border-slate-200/60 bg-white overflow-hidden">
        <div className="py-8 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex shrink-0 animate-[marquee_20s_linear_infinite] gap-16 px-8">
            {[...logos, ...logos].map((name, i) => (
              <span key={i} className="whitespace-nowrap text-sm font-bold text-slate-300 select-none uppercase tracking-widest">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════  BENTO GRID  ═══════ */}
      <section className="bg-slate-50">
        <div className={`${W} py-24 sm:py-32`}>
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              {t("home.featureGridTitle")}
            </h2>
            <p className="mt-4 text-lg text-slate-500">{t("home.platformSubtitle")}</p>
          </Reveal>

          {/* bento layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[280px]">
            {/* inbox — spans 2 cols */}
            <Reveal className="sm:col-span-2 rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <BentoInbox />
            </Reveal>
            {/* AI agent */}
            <Reveal delay={0.1} className="sm:col-span-2 lg:col-span-1 rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <BentoAI />
            </Reveal>
            {/* widget */}
            <Reveal delay={0.15} className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <BentoWidget />
            </Reveal>
            {/* stats — spans 2 */}
            <Reveal delay={0.1} className="sm:col-span-2 rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <BentoStats />
            </Reveal>
            {/* security */}
            <Reveal delay={0.15} className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <Shield size={28} className="text-teal-400 mb-3" />
                <h3 className="text-lg font-bold text-white">{t("home.trustedSecurity")}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{t("home.trustedCompliance")}</p>
              </div>
              <div className="flex gap-2 mt-4">
                {["GDPR", "SOC 2", "MFA"].map((b) => (
                  <span key={b} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-teal-300">{b}</span>
                ))}
              </div>
            </Reveal>
            {/* globe */}
            <Reveal delay={0.2} className="rounded-3xl bg-gradient-to-br from-teal-600 to-cyan-500 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-white">
              <div>
                <Globe size={28} className="text-white/80 mb-3" />
                <h3 className="text-lg font-bold">{t("home.pf2Title")}</h3>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{t("home.pf2Desc")}</p>
              </div>
              <div className="text-4xl font-extrabold mt-4 text-white/90">24/7</div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════  HOW IT WORKS — interactive stepper  ═══════ */}
      <section className="bg-white">
        <div className={`${W} py-24 sm:py-32`}>
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              {t("home.stepsTitle")}
            </h2>
          </Reveal>
          <Reveal>
            <StepperSection
              steps={[
                { title: t("home.ts1Title"), desc: t("home.ts1Desc") },
                { title: t("home.ts2Title"), desc: t("home.ts2Desc") },
                { title: t("home.ts3Title"), desc: t("home.ts3Desc") },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════  TESTIMONIALS  ═══════ */}
      <section className="bg-slate-50">
        <div className={`${W} py-24 sm:py-32`}>
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              {t("home.socialProofCount")}
            </h2>
            <p className="mt-4 text-lg text-slate-500">{t("home.testimonialsSubtitle")}</p>
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { q: t("home.t1Quote"), n: t("home.t1Name"), r: t("home.t1Role") },
              { q: t("home.t2Quote"), n: t("home.t2Name"), r: t("home.t2Role") },
              { q: t("home.t3Quote"), n: t("home.t3Name"), r: t("home.t3Role") },
            ].map((x, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <figure className="h-full rounded-3xl bg-white border border-slate-200/80 p-8 hover:shadow-lg transition-shadow duration-300">
                  <div className="flex gap-0.5 mb-5">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star key={si} size={16} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="text-[15px] leading-relaxed text-slate-700">
                    &ldquo;{x.q}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 pt-5 border-t border-slate-100">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-600 to-cyan-500 text-white flex items-center justify-center text-sm font-bold">
                      {x.n[0]}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{x.n}</div>
                      <div className="text-xs text-slate-500">{x.r}</div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════  CTA  ═══════ */}
      <section className="relative overflow-hidden bg-[#080810]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-teal-900/20 blur-[150px]" />
        </div>

        <div className={`${W} relative py-28 sm:py-36`}>
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {t("home.finalCtaTitle")}
            </h2>
            <p className="mt-5 text-lg text-slate-400">{t("home.finalCtaSubtitle")}</p>

            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-8 py-4 text-[15px] font-bold text-slate-900 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:-translate-y-0.5 transition-all duration-300"
              >
                {t("home.finalCtaPrimary")}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-8 py-4 text-[15px] font-semibold text-white hover:bg-white/5 transition-all"
              >
                {t("home.finalCtaSecondary")}
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500">{t("home.heroNoCreditCard")}</p>
          </Reveal>
        </div>
      </section>

      {/* Status */}
      <section className="bg-white">
        <div className={`${W} py-10`}>
          <Link href="/status" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {t("home.systemOperational")}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
