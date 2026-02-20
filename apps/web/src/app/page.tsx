"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  ChevronRight,
  Inbox,
  MessageSquare,
  Play,
  Search,
  Send,
  Sparkles,
  Star,
  Users,
  Zap,
  Workflow,
  Globe,
  ShoppingCart,
  FileCode2,
  Link2,
  Plug,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import PublicLayout from "@/components/PublicLayout";
import { designTokens } from "@/lib/designTokens";

/* ─── scroll fade-in wrapper ─── */
function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Inline coded UI: AI Agent chat ─── */
function AIAgentChatUI() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </span>
        <div className="ml-3 flex-1 rounded-md bg-slate-100 px-3 py-1 text-[11px] text-slate-400 font-medium truncate">
          app.helvion.com/ai-agent
        </div>
      </div>
      <div className="p-5 space-y-3 h-[320px] sm:h-[380px]">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[#0F5C5C] flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <div className="text-[12px] font-bold text-slate-900">Helvion AI Agent</div>
            <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2 text-[12px] text-slate-700 max-w-[80%]">
              How do I upgrade my plan?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tr-md bg-[#0F5C5C] px-3.5 py-2 text-[12px] text-white max-w-[80%]">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles size={10} className="text-amber-300" />
                <span className="text-[9px] font-semibold text-white/70">AI Agent</span>
              </div>
              You can upgrade from Settings → Billing. Would you like me to walk you through it?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2 text-[12px] text-slate-700 max-w-[80%]">
              Yes please!
            </div>
          </div>
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tr-md bg-[#0F5C5C] px-3.5 py-2 text-[12px] text-white max-w-[80%]">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles size={10} className="text-amber-300" />
                <span className="text-[9px] font-semibold text-white/70">AI Agent</span>
              </div>
              Here&apos;s a step-by-step guide...
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4F4] px-2 py-0.5 text-[10px] font-semibold text-[#0F5C5C]">
            <Sparkles size={10} /> 96% CSAT
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            67% resolved
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline coded UI: Help Desk / Inbox ─── */
function HelpDeskUI() {
  const conversations = [
    { name: "Ayşe D.", msg: "Ödeme sayfasında hata alıyorum", time: "2m", unread: true, status: "open" },
    { name: "Carlos M.", msg: "How do I reset my password?", time: "8m", unread: false, status: "pending" },
    { name: "Lina S.", msg: "Widget kurulumu hakkında", time: "15m", unread: false, status: "resolved" },
    { name: "Tom K.", msg: "Can I export my data?", time: "1h", unread: false, status: "open" },
  ];
  const statusColors: Record<string, string> = { open: "bg-amber-400", pending: "bg-blue-400", resolved: "bg-emerald-400" };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </span>
        <div className="ml-3 flex-1 rounded-md bg-slate-100 px-3 py-1 text-[11px] text-slate-400 font-medium truncate">
          app.helvion.com/inbox
        </div>
      </div>
      <div className="flex h-[320px] sm:h-[380px] text-[13px]">
        <div className="hidden sm:flex w-12 flex-col items-center gap-2.5 border-r border-slate-100 bg-slate-50/60 py-3">
          <div className="h-7 w-7 rounded-lg bg-[#0F5C5C] flex items-center justify-center">
            <span className="text-white text-[9px] font-black">H</span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-slate-200 flex items-center justify-center"><Inbox size={13} className="text-slate-500" /></div>
          <div className="h-7 w-7 rounded-lg hover:bg-slate-200 flex items-center justify-center transition"><Users size={13} className="text-slate-400" /></div>
          <div className="h-7 w-7 rounded-lg hover:bg-slate-200 flex items-center justify-center transition"><BarChart3 size={13} className="text-slate-400" /></div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-slate-900">Inbox</span>
              <span className="rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[9px] font-bold">4</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1">
              <Search size={11} className="text-slate-400" />
              <span className="text-[10px] text-slate-400">Search…</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {conversations.map((c, i) => (
              <div key={i} className={`flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-50 cursor-pointer transition ${i === 0 ? "bg-[#0F5C5C]/5" : "hover:bg-slate-50"}`}>
                <div className={`h-7 w-7 shrink-0 rounded-full ${i === 0 ? "bg-[#0F5C5C]" : i === 1 ? "bg-emerald-500" : i === 2 ? "bg-amber-500" : "bg-slate-400"} flex items-center justify-center text-white text-[9px] font-bold`}>
                  {c.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] truncate ${c.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{c.name}</span>
                    <span className="text-[9px] text-slate-400 shrink-0 ml-1">{c.time}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">{c.msg}</p>
                </div>
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusColors[c.status]}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline coded UI: Automations / Workflow builder ─── */
function AutomationsUI() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </span>
        <div className="ml-3 flex-1 rounded-md bg-slate-100 px-3 py-1 text-[11px] text-slate-400 font-medium truncate">
          app.helvion.com/automations
        </div>
      </div>
      <div className="p-5 h-[320px] sm:h-[380px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-bold text-slate-900">Lead Capture Flow</div>
          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[9px] font-bold">Active</span>
        </div>
        <div className="flex-1 space-y-2.5 overflow-hidden">
          <div className="rounded-xl border-2 border-[#0F5C5C] bg-[#E6F4F4]/40 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#0F5C5C] flex items-center justify-center"><Zap size={14} className="text-white" /></div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-900">Trigger: Visitor opens chat</div>
              <div className="text-[9px] text-slate-500">First-time visitors only</div>
            </div>
          </div>
          <div className="flex justify-center"><ChevronRight size={14} className="text-slate-300 rotate-90" /></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center"><MessageSquare size={14} className="text-amber-600" /></div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-900">Send welcome message</div>
              <div className="text-[9px] text-slate-500">&quot;Hi! How can we help?&quot;</div>
            </div>
          </div>
          <div className="flex justify-center"><ChevronRight size={14} className="text-slate-300 rotate-90" /></div>
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
              <div className="text-[9px] font-bold text-emerald-700 mb-0.5">Interested</div>
              <div className="text-[9px] text-slate-600">Collect email → CRM</div>
            </div>
            <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
              <div className="text-[9px] font-bold text-slate-600 mb-0.5">Browsing</div>
              <div className="text-[9px] text-slate-500">Show product tour</div>
            </div>
          </div>
          <div className="flex justify-center"><ChevronRight size={14} className="text-slate-300 rotate-90" /></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#1E88A8]/10 flex items-center justify-center"><BarChart3 size={14} className="text-[#0F5C5C]" /></div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-900">Track & measure</div>
              <div className="text-[9px] text-slate-500">Conversion analytics</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero product screenshot: dark inbox ─── */
function HeroInboxUI() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1A1D23] shadow-[0_40px_120px_rgba(0,0,0,0.50)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#1F2937] px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </span>
        <div className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-[11px] text-slate-500 font-medium truncate">
          app.helvion.com
        </div>
      </div>
      <div className="flex h-[280px] sm:h-[360px] text-[13px]">
        <div className="hidden sm:flex w-12 flex-col items-center gap-2.5 border-r border-white/5 bg-white/[0.02] py-3">
          <div className="h-7 w-7 rounded-lg bg-[#0F5C5C] flex items-center justify-center">
            <span className="text-white text-[9px] font-black">H</span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center"><Inbox size={13} className="text-slate-400" /></div>
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"><Bot size={13} className="text-slate-500" /></div>
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"><BarChart3 size={13} className="text-slate-500" /></div>
        </div>
        <div className="w-48 sm:w-56 border-r border-white/5 flex flex-col">
          <div className="px-3 py-2.5 border-b border-white/5">
            <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1">
              <Search size={11} className="text-slate-500" />
              <span className="text-[10px] text-slate-500">Search…</span>
            </div>
          </div>
          {[
            { name: "Ayşe D.", msg: "Ödeme hatası", time: "2m", active: true },
            { name: "Carlos M.", msg: "Password reset", time: "8m", active: false },
            { name: "Lina S.", msg: "Widget setup", time: "15m", active: false },
          ].map((c, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition ${c.active ? "bg-white/5 border-l-2 border-[#0F5C5C]" : "border-l-2 border-transparent hover:bg-white/[0.02]"}`}>
              <div className={`h-6 w-6 shrink-0 rounded-full ${i === 0 ? "bg-[#0F5C5C]" : i === 1 ? "bg-emerald-500" : "bg-amber-500"} flex items-center justify-center text-white text-[8px] font-bold`}>
                {c.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-300 truncate">{c.name}</span>
                  <span className="text-[8px] text-slate-500 shrink-0">{c.time}</span>
                </div>
                <p className="text-[9px] text-slate-500 truncate">{c.msg}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
            <div className="h-6 w-6 rounded-full bg-[#0F5C5C] flex items-center justify-center text-white text-[8px] font-bold">A</div>
            <div className="text-[11px] font-semibold text-slate-300">Ayşe Demir</div>
            <span className="ml-auto text-[9px] text-emerald-400">Online</span>
          </div>
          <div className="flex-1 px-3 py-3 space-y-2 overflow-hidden">
            <div className="flex justify-start"><div className="rounded-2xl rounded-tl-md bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 max-w-[80%]">Ödeme sayfasında hata alıyorum</div></div>
            <div className="flex justify-end"><div className="rounded-2xl rounded-tr-md bg-[#0F5C5C] px-3 py-1.5 text-[11px] text-white max-w-[80%]">Hangi tarayıcıyı kullanıyorsunuz?</div></div>
            <div className="flex justify-start"><div className="rounded-2xl rounded-tl-md bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 max-w-[80%]">Chrome, en son sürüm</div></div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0F5C5C]/20 px-2 py-0.5 text-[9px] font-semibold text-[#1E88A8]"><Sparkles size={9} /> AI drafting…</span>
            </div>
          </div>
          <div className="border-t border-white/5 px-3 py-2 flex items-center gap-2">
            <div className="flex-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] text-slate-500">Type a message…</div>
            <div className="h-6 w-6 rounded-lg bg-[#0F5C5C] flex items-center justify-center"><Send size={11} className="text-white" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT — Tidio-style layout
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const { t } = useI18n();

  const trustLogos = ["Acme Corp", "TechFlow", "Buildify", "LaunchPad", "DataSync", "CloudBase", "Nextera", "Shipfast"];

  const featureCards: { icon: typeof Bot; title: string; desc: string; cta: string; href: string; ui: ReactNode }[] = [
    { icon: Bot, title: t("home.fg1Title"), desc: t("home.fg1Desc"), cta: t("home.fg1Cta"), href: "/product", ui: <AIAgentChatUI /> },
    { icon: Inbox, title: t("home.fg2Title"), desc: t("home.fg2Desc"), cta: t("home.fg2Cta"), href: "/product", ui: <HelpDeskUI /> },
    { icon: Workflow, title: t("home.fg3Title"), desc: t("home.fg3Desc"), cta: t("home.fg3Cta"), href: "/product", ui: <AutomationsUI /> },
  ];

  const stats = [
    { val: t("home.stat1Val"), label: t("home.stat1Label") },
    { val: t("home.stat2Val"), label: t("home.stat2Label") },
    { val: t("home.stat3Val"), label: t("home.stat3Label") },
  ];

  const threeSteps = [
    { num: "1", title: t("home.ts1Title"), desc: t("home.ts1Desc"), icon: Zap },
    { num: "2", title: t("home.ts2Title"), desc: t("home.ts2Desc"), icon: Plug },
    { num: "3", title: t("home.ts3Title"), desc: t("home.ts3Desc"), icon: BarChart3 },
  ];

  const integrations = [
    { name: "Shopify", icon: ShoppingCart },
    { name: "WordPress", icon: Globe },
    { name: "Zapier", icon: Zap },
    { name: "Slack", icon: MessageSquare },
    { name: "GitHub", icon: FileCode2 },
    { name: "Webhooks", icon: Link2 },
  ];

  const testimonials = [
    { quote: t("home.t1Quote"), name: t("home.t1Name"), role: t("home.t1Role"), stars: 5 },
    { quote: t("home.t2Quote"), name: t("home.t2Name"), role: t("home.t2Role"), stars: 5 },
    { quote: t("home.t3Quote"), name: t("home.t3Name"), role: t("home.t3Role"), stars: 5 },
  ];

  return (
    <PublicLayout>
      {/* ══════════════════════════════════════════════════════
          § 1  HERO — Tidio-style dark bg, left text, right product
         ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: "var(--hero-bg, #1A1D23)" }}>
        <div className="pointer-events-none absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-[#0F5C5C]/8 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 -top-20 h-[500px] w-[500px] rounded-full bg-[#1E88A8]/6 blur-3xl" />

        <div className={`${designTokens.layout.maxWidthWide} relative pt-16 sm:pt-24 pb-16 sm:pb-24`}>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left: text */}
            <FadeIn>
              <h1 className="text-[36px] sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-white leading-[1.06]">
                {t("home.heroTitle")}
                <span className="block mt-2 bg-gradient-to-r from-[#0F5C5C] via-[#1E88A8] to-[#34D399] bg-clip-text text-transparent">
                  {t("home.heroSubline")}
                </span>
              </h1>

              <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-lg">
                {t("home.heroSubtitle")}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className={`${designTokens.buttons.primaryLg} gap-2`}
                >
                  {t("home.finalCtaPrimary")}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/product"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  <Play size={16} className="text-slate-500" />
                  {t("home.heroCtaDemo")}
                </Link>
              </div>

              <p className="mt-4 text-xs text-slate-500 font-medium">
                {t("home.heroNoCreditCard")}
              </p>
            </FadeIn>

            {/* Right: product screenshot */}
            <FadeIn delay={0.15}>
              <HeroInboxUI />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 2  FEATURE GRID — 3 big cards with real coded UIs
         ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-slate-200/60">
        <div className={`${designTokens.layout.maxWidthWide} py-20 sm:py-28`}>
          <FadeIn className="mx-auto max-w-[800px] text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {t("home.featureGridTitle")}
            </h2>
          </FadeIn>

          <div className="mt-16 space-y-20">
            {featureCards.map((fc, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <div className={`grid gap-10 lg:grid-cols-2 lg:gap-16 items-center ${i % 2 === 1 ? "lg:grid-flow-dense" : ""}`}>
                  <div className={i % 2 === 1 ? "lg:col-start-2" : ""}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] shadow-[0_2px_8px_rgba(15,92,92,0.25)] mb-5">
                      <fc.icon size={20} className="text-white" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                      {fc.title}
                    </h3>
                    <p className="mt-3 text-slate-600 leading-relaxed max-w-md">
                      {fc.desc}
                    </p>
                    <Link
                      href={fc.href}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0F5C5C] hover:text-[#0D4F4F] transition-colors group"
                    >
                      {fc.cta}
                      <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                  <div className={i % 2 === 1 ? "lg:col-start-1" : ""}>
                    {fc.ui}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 3  STATISTICS — 3 big numbers
         ══════════════════════════════════════════════════════ */}
      <section className="bg-slate-50 border-t border-slate-200/60">
        <div className={`${designTokens.layout.maxWidth} py-16 sm:py-20`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4">
            {stats.map((s, i) => (
              <FadeIn key={i} delay={i * 0.08} className="text-center">
                <div className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900">
                  {s.val}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-500">
                  {s.label}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 4  TRUST LOGOS — marquee, dark bg
         ══════════════════════════════════════════════════════ */}
      <section className="overflow-hidden" style={{ background: "var(--hero-bg, #1A1D23)" }}>
        <div className="py-10 sm:py-14">
          <div className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-6">
            {t("home.logosTitle")}
          </div>
          <div className="relative flex overflow-hidden">
            <div className="flex shrink-0 animate-[marquee_30s_linear_infinite] gap-14 px-6">
              {[...trustLogos, ...trustLogos].map((name, i) => (
                <span key={i} className="whitespace-nowrap text-lg font-bold text-slate-600 select-none">{name}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 5  TESTIMONIALS — 3 cards
         ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-slate-200/60">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <FadeIn className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {t("home.socialProofCount")}
            </h2>
            <p className="mt-3 text-slate-600">{t("home.testimonialsSubtitle")}</p>
          </FadeIn>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((x, i) => (
              <FadeIn key={x.name} delay={i * 0.08}>
                <figure className={`relative h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 ${designTokens.shadows.card} hover:shadow-[0_10px_28px_rgba(15,92,92,0.08)] transition-all duration-300`}>
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: x.stars }).map((_, si) => (
                      <Star key={si} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="text-[15px] leading-relaxed text-slate-900">&ldquo;{x.quote}&rdquo;</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] text-white flex items-center justify-center text-sm font-black shadow-[0_2px_8px_rgba(15,92,92,0.25)]">
                      {String(x.name || "H").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{x.name}</div>
                      <div className="text-xs font-semibold text-slate-400">{x.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 6  3-STEP GUIDE — Tidio-style
         ══════════════════════════════════════════════════════ */}
      <section className="bg-slate-50 border-t border-slate-200/60">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <FadeIn className="mx-auto max-w-[720px] text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {t("home.stepsTitle")}
            </h2>
          </FadeIn>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {threeSteps.map((step, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className={`relative h-full rounded-2xl border border-slate-200/80 bg-white p-8 ${designTokens.shadows.card} hover:shadow-[0_14px_40px_rgba(15,92,92,0.08)] hover:-translate-y-0.5 transition-all duration-300`}>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] text-white text-lg font-black shadow-[0_2px_8px_rgba(15,92,92,0.25)]">
                      {step.num}
                    </span>
                    <step.icon size={20} className="text-slate-400" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {step.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="mt-10 text-center">
            <Link
              href="/signup"
              className={`${designTokens.buttons.primaryLg} gap-2`}
            >
              {t("home.finalCtaPrimary")}
              <ArrowRight size={16} />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 7  INTEGRATIONS — logo grid
         ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-slate-200/60">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <FadeIn className="mx-auto max-w-[720px] text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {t("home.integrationsTitle")}
            </h2>
          </FadeIn>

          <div className="mt-12 grid grid-cols-3 sm:grid-cols-6 gap-5">
            {integrations.map((ig, i) => (
              <FadeIn key={i} delay={i * 0.04}>
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-[#0F5C5C]/30 hover:shadow-[0_8px_24px_rgba(15,92,92,0.06)] transition-all cursor-pointer">
                  <ig.icon size={28} className="text-slate-500" />
                  <span className="text-[11px] font-semibold text-slate-600">{ig.name}</span>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="mt-8 text-center">
            <Link
              href="/product"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F5C5C] hover:text-[#0D4F4F] transition-colors group"
            >
              {t("home.integrationsCta")}
              <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-1 text-xs text-slate-400">{t("home.integrationsNote")}</p>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 8  CTA BANNER — dark
         ══════════════════════════════════════════════════════ */}
      <section style={{ background: "var(--hero-bg, #1A1D23)" }}>
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <FadeIn className="relative mx-auto max-w-2xl text-center">
            <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-[#0F5C5C]/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-32 -bottom-32 h-72 w-72 rounded-full bg-[#1E88A8]/10 blur-3xl" />

            <h2 className="relative text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              {t("home.finalCtaTitle")}
            </h2>
            <p className="relative mt-4 text-slate-400">{t("home.finalCtaSubtitle")}</p>
            <div className="relative mt-10 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/signup"
                className={`${designTokens.buttons.primaryLg} gap-2`}
              >
                {t("home.finalCtaPrimary")}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/product"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 backdrop-blur transition-all"
              >
                {t("home.finalCtaSecondary")}
              </Link>
            </div>
            <p className="relative mt-4 text-xs text-slate-500 font-medium">
              {t("home.heroNoCreditCard")}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Status */}
      <section className="bg-white">
        <div className={`${designTokens.layout.maxWidth} py-10 sm:py-14`}>
          <Link
            href="/status"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t("home.systemOperational")}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
