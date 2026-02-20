"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Globe,
  Inbox,
  MessageSquare,
  Play,
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
import { designTokens as dt } from "@/lib/designTokens";

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */
function Fade({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.25, 1, 0.5, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const MAX = "max-w-7xl mx-auto px-5 sm:px-8";
const TEAL = "#0F5C5C";
const TEAL_SOFT = "#1E88A8";

/* ────────────────────────────────────────────────────────
   Visual Components — polished, large-scale product previews
   ──────────────────────────────────────────────────────── */

/* Shared Inbox — full-width polished card */
function InboxVisual() {
  const rows = [
    { avatar: "A", name: "Ayşe D.", preview: "Ödeme sayfasında sorun yaşıyorum…", time: "2m", color: `bg-[${TEAL}]`, unread: true },
    { avatar: "C", name: "Carlos M.", preview: "How do I reset my password?", time: "8m", color: "bg-emerald-500", unread: false },
    { avatar: "L", name: "Lina S.", preview: "Widget installation question", time: "15m", color: "bg-amber-500", unread: false },
    { avatar: "T", name: "Tom K.", preview: "Can I export conversation data?", time: "1h", color: "bg-violet-500", unread: false },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
        <Inbox size={18} className="text-slate-400" />
        <span className="text-sm font-bold text-slate-800">Inbox</span>
        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">4 open</span>
        <div className="ml-auto flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
          <Search size={13} className="text-slate-400" />
          <span className="text-xs text-slate-400 hidden sm:inline">Search conversations…</span>
        </div>
      </div>
      {/* rows */}
      <div>
        {rows.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 px-5 py-4 border-b border-slate-50 transition cursor-pointer ${
              i === 0 ? "bg-[#0F5C5C]/[0.04]" : "hover:bg-slate-50/60"
            }`}
          >
            <div className={`h-9 w-9 shrink-0 rounded-full ${r.color} flex items-center justify-center text-white text-xs font-bold`}>
              {r.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm truncate ${r.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                  {r.name}
                </span>
                {r.unread && <span className="h-2 w-2 rounded-full bg-[#0F5C5C] shrink-0" />}
              </div>
              <p className="text-[13px] text-slate-500 truncate mt-0.5">{r.preview}</p>
            </div>
            <span className="text-xs text-slate-400 shrink-0">{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* AI Agent — polished chat card */
function AgentVisual() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] flex items-center justify-center shadow-sm">
          <Bot size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-800">Helvion AI</div>
          <div className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            Online · 67% auto-resolve
          </div>
        </div>
        <span className="rounded-full bg-[#E6F4F4] px-2.5 py-1 text-[10px] font-bold text-[#0F5C5C]">
          <Sparkles size={10} className="inline -mt-0.5 mr-0.5" /> AI
        </span>
      </div>
      {/* messages */}
      <div className="px-5 py-5 space-y-3">
        <div className="flex gap-3">
          <div className="h-7 w-7 shrink-0 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] font-bold mt-0.5">S</div>
          <div className="rounded-2xl rounded-tl-lg bg-slate-100 px-4 py-2.5 max-w-[75%]">
            <p className="text-[13px] text-slate-700">How do I upgrade my plan?</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <div className="rounded-2xl rounded-tr-lg bg-[#0F5C5C] px-4 py-2.5 max-w-[75%]">
            <p className="text-[13px] text-white leading-relaxed">
              You can upgrade anytime from <span className="font-semibold">Settings → Billing</span>. Would you like me to walk you through it step by step?
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="h-7 w-7 shrink-0 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] font-bold mt-0.5">S</div>
          <div className="rounded-2xl rounded-tl-lg bg-slate-100 px-4 py-2.5 max-w-[75%]">
            <p className="text-[13px] text-slate-700">Yes, please!</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <div className="rounded-2xl rounded-tr-lg bg-[#0F5C5C] px-4 py-2.5 max-w-[75%]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={11} className="text-amber-300" />
              <span className="text-[10px] font-semibold text-white/60">AI composing…</span>
            </div>
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      </div>
      {/* input */}
      <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-3">
        <div className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-400">Type a message…</div>
        <button className="h-9 w-9 rounded-xl bg-[#0F5C5C] flex items-center justify-center shadow-sm hover:bg-[#0D4F4F] transition">
          <Send size={15} className="text-white" />
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   MAIN PAGE
   ──────────────────────────────────────────────────────── */
export default function Home() {
  const { t } = useI18n();

  const logos = ["Acme Corp", "TechFlow", "Buildify", "LaunchPad", "DataSync", "CloudBase", "Nextera", "Shipfast"];

  const features = [
    { icon: Bot, title: t("home.fg1Title"), desc: t("home.fg1Desc") },
    { icon: Inbox, title: t("home.fg2Title"), desc: t("home.fg2Desc") },
    { icon: Zap, title: t("home.fg3Title"), desc: t("home.fg3Desc") },
    { icon: BarChart3, title: t("home.pf6Title"), desc: t("home.pf6Desc") },
    { icon: Shield, title: t("home.trustedSecurity"), desc: t("home.trustedCompliance") },
    { icon: Globe, title: t("home.pf2Title"), desc: t("home.pf2Desc") },
  ];

  const steps = [
    { num: "01", title: t("home.ts1Title"), desc: t("home.ts1Desc") },
    { num: "02", title: t("home.ts2Title"), desc: t("home.ts2Desc") },
    { num: "03", title: t("home.ts3Title"), desc: t("home.ts3Desc") },
  ];

  const testimonials = [
    { quote: t("home.t1Quote"), name: t("home.t1Name"), role: t("home.t1Role") },
    { quote: t("home.t2Quote"), name: t("home.t2Name"), role: t("home.t2Role") },
    { quote: t("home.t3Quote"), name: t("home.t3Name"), role: t("home.t3Role") },
  ];

  return (
    <PublicLayout>
      {/* ═══════════  §1 HERO  ═══════════ */}
      <section className="relative overflow-hidden bg-[#0A0A0F]">
        {/* ambient glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[700px] w-[900px] rounded-full bg-[#0F5C5C]/[0.07] blur-[120px]" />

        <div className={`${MAX} relative pt-20 sm:pt-32 pb-20 sm:pb-32`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-center">
            {/* copy */}
            <Fade>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-slate-400 backdrop-blur-sm mb-6">
                <Sparkles size={13} className="text-amber-400" />
                {t("home.heroPill")}
              </p>

              <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-extrabold tracking-tight text-white leading-[1.08]">
                {t("home.heroTitle")}
              </h1>
              <p className="mt-2 text-4xl sm:text-5xl lg:text-[58px] font-extrabold tracking-tight leading-[1.08] bg-gradient-to-r from-[#0F5C5C] via-[#1E88A8] to-emerald-400 bg-clip-text text-transparent">
                {t("home.heroSubline")}
              </p>

              <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-xl">
                {t("home.heroSubtitle")}
              </p>

              <div className="mt-10 flex flex-wrap gap-4 items-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-[#0F5C5C] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_0_0_1px_rgba(15,92,92,0.3),0_8px_30px_rgba(15,92,92,0.35)] hover:shadow-[0_0_0_1px_rgba(15,92,92,0.5),0_12px_40px_rgba(15,92,92,0.45)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  {t("home.finalCtaPrimary")}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/product"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/[0.08] backdrop-blur transition-all"
                >
                  <Play size={15} />
                  {t("home.heroCtaDemo")}
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-500">{t("home.heroNoCreditCard")}</p>
            </Fade>

            {/* product visual */}
            <Fade delay={0.2} className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#0F5C5C]/20 via-transparent to-[#1E88A8]/10 blur-2xl" />
                <div className="relative rounded-2xl border border-white/[0.08] bg-[#12121A] shadow-2xl overflow-hidden">
                  {/* browser chrome */}
                  <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                    <span className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                    </span>
                    <div className="ml-3 flex-1 rounded-md bg-white/[0.05] px-3 py-1 text-[11px] text-slate-500 font-medium">
                      app.helvion.com
                    </div>
                  </div>
                  {/* 3-panel inbox */}
                  <div className="flex h-[380px]">
                    {/* sidebar */}
                    <div className="w-12 flex flex-col items-center gap-3 border-r border-white/[0.05] py-4">
                      <div className="h-7 w-7 rounded-lg bg-[#0F5C5C] flex items-center justify-center text-[9px] font-black text-white">H</div>
                      <div className="h-7 w-7 rounded-lg bg-white/[0.08] flex items-center justify-center"><Inbox size={13} className="text-slate-400" /></div>
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center"><Bot size={13} className="text-slate-500" /></div>
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center"><BarChart3 size={13} className="text-slate-500" /></div>
                    </div>
                    {/* conversation list */}
                    <div className="w-52 border-r border-white/[0.05] flex flex-col">
                      <div className="px-3 py-3 border-b border-white/[0.05]">
                        <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                          <Search size={11} className="text-slate-500" />
                          <span className="text-[10px] text-slate-500">Search…</span>
                        </div>
                      </div>
                      {[
                        { n: "Ayşe D.", m: "Ödeme hatası", t: "2m", active: true },
                        { n: "Carlos M.", m: "Password reset", t: "8m", active: false },
                        { n: "Lina S.", m: "Widget setup", t: "15m", active: false },
                        { n: "Tom K.", m: "Data export", t: "1h", active: false },
                      ].map((c, i) => (
                        <div key={i} className={`flex items-center gap-2.5 px-3 py-3 border-b border-white/[0.03] transition ${c.active ? "bg-white/[0.04] border-l-2 border-l-[#0F5C5C]" : "border-l-2 border-l-transparent"}`}>
                          <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${i === 0 ? "bg-[#0F5C5C]" : i === 1 ? "bg-emerald-500" : i === 2 ? "bg-amber-500" : "bg-violet-500"}`}>
                            {c.n[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-[11px] truncate ${c.active ? "font-bold text-slate-200" : "text-slate-400"}`}>{c.n}</span>
                              <span className="text-[9px] text-slate-600 shrink-0">{c.t}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{c.m}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* chat pane */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.05]">
                        <div className="h-7 w-7 rounded-full bg-[#0F5C5C] flex items-center justify-center text-white text-[9px] font-bold">A</div>
                        <div>
                          <div className="text-[12px] font-semibold text-slate-200">Ayşe Demir</div>
                          <div className="text-[10px] text-emerald-400">Online</div>
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                          <span className="rounded-full bg-[#0F5C5C]/20 px-2 py-0.5 text-[9px] font-semibold text-[#1E88A8]">
                            <Sparkles size={9} className="inline -mt-0.5 mr-0.5" />AI assist
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 px-4 py-4 space-y-3 overflow-hidden">
                        <div className="flex justify-start"><div className="rounded-2xl rounded-tl-lg bg-white/[0.06] px-3.5 py-2 text-[12px] text-slate-300 max-w-[80%]">Ödeme sayfasında hata alıyorum, yardımcı olur musunuz?</div></div>
                        <div className="flex justify-end"><div className="rounded-2xl rounded-tr-lg bg-[#0F5C5C] px-3.5 py-2 text-[12px] text-white max-w-[80%]">Tabii ki! Hangi tarayıcıyı kullanıyorsunuz?</div></div>
                        <div className="flex justify-start"><div className="rounded-2xl rounded-tl-lg bg-white/[0.06] px-3.5 py-2 text-[12px] text-slate-300 max-w-[80%]">Chrome, en son sürüm.</div></div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#0F5C5C]/20 px-2 py-0.5 text-[9px] font-semibold text-[#1E88A8]"><Sparkles size={9} /> AI drafting…</span>
                        </div>
                      </div>
                      <div className="border-t border-white/[0.05] px-4 py-2.5 flex items-center gap-2">
                        <div className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-[11px] text-slate-500">Type a message…</div>
                        <div className="h-7 w-7 rounded-lg bg-[#0F5C5C] flex items-center justify-center"><Send size={12} className="text-white" /></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Fade>
          </div>
        </div>
      </section>

      {/* ═══════════  §2 TRUST LOGOS  ═══════════ */}
      <section className="border-b border-slate-200/60 bg-white overflow-hidden">
        <div className="py-8 sm:py-10">
          <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex shrink-0 animate-[marquee_25s_linear_infinite] gap-16 px-8">
              {[...logos, ...logos].map((name, i) => (
                <span key={i} className="whitespace-nowrap text-base font-bold text-slate-300 select-none tracking-wide">{name}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════  §3 STATS  ═══════════ */}
      <section className="bg-slate-50">
        <div className={`${MAX} py-16 sm:py-20`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            {[
              { val: t("home.stat1Val"), label: t("home.stat1Label") },
              { val: t("home.stat2Val"), label: t("home.stat2Label") },
              { val: t("home.stat3Val"), label: t("home.stat3Label") },
            ].map((s, i) => (
              <Fade key={i} delay={i * 0.1} className="text-center py-6 sm:py-0">
                <div className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900">{s.val}</div>
                <div className="mt-1.5 text-sm text-slate-500 font-medium">{s.label}</div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════  §4 FEATURES GRID — 6 cards  ═══════════ */}
      <section className="bg-white">
        <div className={`${MAX} py-24 sm:py-32`}>
          <Fade className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-[42px] font-extrabold tracking-tight text-slate-900 leading-tight">
              {t("home.featureGridTitle")}
            </h2>
            <p className="mt-4 text-lg text-slate-500">{t("home.platformSubtitle")}</p>
          </Fade>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Fade key={i} delay={i * 0.06}>
                <div className="group relative h-full rounded-2xl border border-slate-200/80 bg-white p-7 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] shadow-md mb-5 group-hover:scale-110 transition-transform duration-300">
                    <f.icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════  §5 SHOWCASE: AI Agent  ═══════════ */}
      <section className="bg-slate-50">
        <div className={`${MAX} py-24 sm:py-32`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-center">
            <Fade>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4F4] px-3 py-1 text-[11px] font-bold text-[#0F5C5C] uppercase tracking-wider mb-4">
                <Bot size={12} /> AI Agent
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                {t("home.showcase2Title")}
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">{t("home.showcase2Desc")}</p>
              <ul className="mt-6 space-y-3">
                {["67% auto-resolution rate", "Trained on your knowledge base", "Seamless human handoff"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 size={16} className="text-[#0F5C5C] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/product"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#0F5C5C] hover:text-[#0D4F4F] transition group"
              >
                {t("home.fg1Cta")}
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Fade>
            <Fade delay={0.15}>
              <AgentVisual />
            </Fade>
          </div>
        </div>
      </section>

      {/* ═══════════  §6 SHOWCASE: Shared Inbox  ═══════════ */}
      <section className="bg-white">
        <div className={`${MAX} py-24 sm:py-32`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-center">
            <Fade delay={0.15} className="order-2 lg:order-1">
              <InboxVisual />
            </Fade>
            <Fade className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4F4] px-3 py-1 text-[11px] font-bold text-[#0F5C5C] uppercase tracking-wider mb-4">
                <Inbox size={12} /> Shared Inbox
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                {t("home.showcase1Title")}
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">{t("home.showcase1Desc")}</p>
              <ul className="mt-6 space-y-3">
                {["All channels in one place", "Smart routing & assignments", "Real-time collaboration"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 size={16} className="text-[#0F5C5C] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/product"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#0F5C5C] hover:text-[#0D4F4F] transition group"
              >
                {t("home.fg2Cta")}
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Fade>
          </div>
        </div>
      </section>

      {/* ═══════════  §7 THREE STEPS  ═══════════ */}
      <section className="bg-slate-50">
        <div className={`${MAX} py-24 sm:py-32`}>
          <Fade className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-[42px] font-extrabold tracking-tight text-slate-900 leading-tight">
              {t("home.stepsTitle")}
            </h2>
          </Fade>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {steps.map((step, i) => (
              <Fade key={i} delay={i * 0.1}>
                <div className="relative h-full rounded-2xl border border-slate-200/80 bg-white p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <span className="text-4xl font-extrabold text-[#0F5C5C]/10">{step.num}</span>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════  §8 TESTIMONIALS  ═══════════ */}
      <section className="bg-white">
        <div className={`${MAX} py-24 sm:py-32`}>
          <Fade className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-[42px] font-extrabold tracking-tight text-slate-900 leading-tight">
              {t("home.socialProofCount")}
            </h2>
            <p className="mt-4 text-lg text-slate-500">{t("home.testimonialsSubtitle")}</p>
          </Fade>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((x, i) => (
              <Fade key={i} delay={i * 0.08}>
                <figure className="h-full rounded-2xl border border-slate-200/80 bg-white p-7 hover:shadow-lg transition-shadow duration-300">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star key={si} size={15} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="text-[15px] leading-relaxed text-slate-800">
                    &ldquo;{x.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] text-white flex items-center justify-center text-sm font-bold">
                      {String(x.name || "H")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{x.name}</div>
                      <div className="text-xs text-slate-500">{x.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════  §9 CTA  ═══════════ */}
      <section className="relative overflow-hidden bg-[#0A0A0F]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-[#0F5C5C]/[0.08] blur-[100px]" />

        <div className={`${MAX} relative py-24 sm:py-32`}>
          <Fade className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-[42px] font-extrabold tracking-tight text-white leading-tight">
              {t("home.finalCtaTitle")}
            </h2>
            <p className="mt-4 text-lg text-slate-400">{t("home.finalCtaSubtitle")}</p>

            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#0F5C5C] px-8 py-4 text-[15px] font-semibold text-white shadow-[0_0_0_1px_rgba(15,92,92,0.3),0_8px_30px_rgba(15,92,92,0.35)] hover:shadow-[0_0_0_1px_rgba(15,92,92,0.5),0_12px_40px_rgba(15,92,92,0.45)] hover:-translate-y-0.5 transition-all duration-200"
              >
                {t("home.finalCtaPrimary")}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-8 py-4 text-[15px] font-semibold text-white hover:bg-white/[0.08] backdrop-blur transition-all"
              >
                {t("home.finalCtaSecondary")}
              </Link>
            </div>
            <p className="mt-5 text-xs text-slate-500">{t("home.heroNoCreditCard")}</p>
          </Fade>
        </div>
      </section>

      {/* ═══════════  Status  ═══════════ */}
      <section className="bg-white">
        <div className={`${MAX} py-10`}>
          <Link
            href="/status"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {t("home.systemOperational")}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
