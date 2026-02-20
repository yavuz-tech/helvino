"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  ChevronRight,
  Inbox,
  MessageSquare,
  Megaphone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
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

/* ─── browser frame wrapper ─── */
function BrowserFrame({ children, url = "app.helvion.com" }: { children: ReactNode; url?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </span>
        <div className="ml-3 flex-1 rounded-md bg-slate-100 px-3 py-1 text-[11px] text-slate-400 font-medium truncate">
          {url}
        </div>
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}

/* ─── dark browser frame for hero ─── */
function DarkBrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1A1D23] shadow-[0_40px_120px_rgba(0,0,0,0.50)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#1F2937] px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </span>
        <div className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-[11px] text-slate-500 font-medium truncate">
          app.helvion.com/inbox
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ─── Inline coded UI: Inbox ─── */
function InboxUI() {
  const conversations = [
    { name: "Ayşe Demir", msg: "Ödeme sayfasında hata alıyorum", time: "2dk", unread: true, color: "bg-[#0F5C5C]" },
    { name: "Carlos M.", msg: "How do I reset my password?", time: "8dk", unread: false, color: "bg-emerald-500" },
    { name: "Lina S.", msg: "Widget kurulumu hakkında", time: "15dk", unread: false, color: "bg-amber-500" },
  ];
  return (
    <div className="flex h-[340px] sm:h-[400px] text-[13px]">
      {/* Sidebar */}
      <div className="hidden sm:flex w-14 flex-col items-center gap-3 border-r border-slate-100 bg-slate-50/60 py-4">
        <div className="h-8 w-8 rounded-lg bg-[#0F5C5C] flex items-center justify-center">
          <span className="text-white text-[10px] font-black">H</span>
        </div>
        <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center"><Inbox size={14} className="text-slate-500" /></div>
        <div className="h-8 w-8 rounded-lg hover:bg-slate-200 flex items-center justify-center transition"><Users size={14} className="text-slate-400" /></div>
        <div className="h-8 w-8 rounded-lg hover:bg-slate-200 flex items-center justify-center transition"><BarChart3 size={14} className="text-slate-400" /></div>
      </div>
      {/* Conversation list */}
      <div className="w-56 sm:w-64 border-r border-slate-100 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5">
            <Search size={12} className="text-slate-400" />
            <span className="text-[11px] text-slate-400">Search…</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {conversations.map((c, i) => (
            <div key={i} className={`flex items-start gap-2.5 px-3 py-3 cursor-pointer transition ${i === 0 ? "bg-[#0F5C5C]/5 border-l-2 border-[#0F5C5C]" : "hover:bg-slate-50 border-l-2 border-transparent"}`}>
              <div className={`h-8 w-8 shrink-0 rounded-full ${c.color} flex items-center justify-center text-white text-[10px] font-bold`}>
                {c.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 truncate text-[12px]">{c.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-1">{c.time}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.msg}</p>
              </div>
              {c.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0F5C5C]" />}
            </div>
          ))}
        </div>
      </div>
      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <div className="h-7 w-7 rounded-full bg-[#0F5C5C] flex items-center justify-center text-white text-[10px] font-bold">A</div>
          <div>
            <div className="text-[12px] font-semibold text-slate-900">Ayşe Demir</div>
            <div className="text-[10px] text-emerald-500 font-medium">Online</div>
          </div>
        </div>
        <div className="flex-1 px-4 py-3 space-y-3 overflow-hidden">
          <div className="flex justify-start"><div className="max-w-[80%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2 text-[12px] text-slate-700">Ödeme sayfasında hata alıyorum, yardımcı olabilir misiniz?</div></div>
          <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-tr-md bg-[#0F5C5C] px-3.5 py-2 text-[12px] text-white">Tabii, hangi tarayıcıyı kullanıyorsunuz?</div></div>
          <div className="flex justify-start"><div className="max-w-[80%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2 text-[12px] text-slate-700">Chrome, en son sürüm.</div></div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4F4] px-2 py-0.5 text-[10px] font-semibold text-[#0F5C5C]"><Sparkles size={10} /> AI</span>
            <span className="text-[10px] text-slate-400 italic">Drafting reply…</span>
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-[11px] text-slate-400">Type a message…</div>
          <div className="h-7 w-7 rounded-lg bg-[#0F5C5C] flex items-center justify-center"><Send size={12} className="text-white" /></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline coded UI: Analytics ─── */
function AnalyticsUI() {
  const bars = [35, 55, 40, 70, 60, 85, 75, 90];
  return (
    <div className="p-5 sm:p-6 space-y-5 h-[340px] sm:h-[400px]">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Conversations", val: "1,284", change: "+12%", up: true },
          { label: "Avg. Response", val: "1.4m", change: "-23%", up: false },
          { label: "Satisfaction", val: "96%", change: "+3%", up: true },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="text-[10px] text-slate-500 font-medium">{s.label}</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{s.val}</div>
            <div className={`mt-0.5 text-[10px] font-semibold ${s.up ? "text-emerald-600" : "text-[#0F5C5C]"}`}>{s.change}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 flex-1">
        <div className="text-[11px] font-semibold text-slate-700 mb-3">Weekly volume</div>
        <div className="flex items-end gap-2 h-28">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-[#0F5C5C]" style={{ height: `${h}%` }} />
              <span className="text-[9px] text-slate-400">{["M", "T", "W", "T", "F", "S", "S", "M"][i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <div className="text-[10px] text-slate-500 font-medium">AI Resolved</div>
          <div className="mt-1 text-base font-bold text-slate-900">42%</div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200"><div className="h-1.5 rounded-full bg-[#0F5C5C]" style={{ width: "42%" }} /></div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <div className="text-[10px] text-slate-500 font-medium">First Reply</div>
          <div className="mt-1 text-base font-bold text-slate-900">&lt;2min</div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: "88%" }} /></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline coded UI: AI Agent builder ─── */
function AIAgentUI() {
  return (
    <div className="p-5 sm:p-6 h-[340px] sm:h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px] font-bold text-slate-900">Support Agent</div>
          <div className="text-[10px] text-emerald-500 font-medium">Active</div>
        </div>
        <div className="rounded-lg bg-[#0F5C5C] px-3 py-1.5 text-[11px] font-semibold text-white">Deploy</div>
      </div>
      <div className="flex-1 space-y-3 overflow-hidden">
        {/* Workflow nodes */}
        <div className="rounded-xl border-2 border-[#0F5C5C] bg-[#E6F4F4]/40 p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#0F5C5C] flex items-center justify-center"><Zap size={14} className="text-white" /></div>
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-slate-900">Trigger: New message</div>
            <div className="text-[10px] text-slate-500">When visitor sends a message</div>
          </div>
        </div>
        <div className="flex justify-center"><ChevronRight size={16} className="text-slate-300 rotate-90" /></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#1E88A8]/10 flex items-center justify-center"><Bot size={14} className="text-[#0F5C5C]" /></div>
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-slate-900">AI: Check knowledge base</div>
            <div className="text-[10px] text-slate-500">Search docs for answer</div>
          </div>
          <span className="rounded-full bg-[#E6F4F4] px-2 py-0.5 text-[9px] font-bold text-[#0F5C5C]">AI</span>
        </div>
        <div className="flex justify-center"><ChevronRight size={16} className="text-slate-300 rotate-90" /></div>
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="text-[10px] font-bold text-emerald-700 mb-1">Found</div>
            <div className="text-[10px] text-slate-600">Auto-reply with answer</div>
          </div>
          <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-[10px] font-bold text-amber-700 mb-1">Not found</div>
            <div className="text-[10px] text-slate-600">Route to human agent</div>
          </div>
        </div>
        <div className="flex justify-center"><ChevronRight size={16} className="text-slate-300 rotate-90" /></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center"><BarChart3 size={14} className="text-emerald-600" /></div>
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-slate-900">Log & measure</div>
            <div className="text-[10px] text-slate-500">Track resolution rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline coded UI: Knowledge Base ─── */
function KnowledgeBaseUI() {
  const articles = [
    { cat: "Getting Started", title: "How to install the widget", color: "bg-[#0F5C5C]" },
    { cat: "Billing", title: "Upgrade your plan", color: "bg-emerald-500" },
    { cat: "Integrations", title: "Connect Slack & Teams", color: "bg-amber-500" },
    { cat: "Security", title: "Enable MFA for your team", color: "bg-rose-500" },
  ];
  return (
    <div className="p-5 sm:p-6 h-[340px] sm:h-[400px] flex flex-col">
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 mb-4">
        <Search size={14} className="text-slate-400" />
        <span className="text-[12px] text-slate-400">Search articles…</span>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {["All", "Getting Started", "Billing", "Security"].map((c, i) => (
          <span key={i} className={`rounded-full px-3 py-1 text-[10px] font-semibold ${i === 0 ? "bg-[#0F5C5C] text-white" : "bg-slate-100 text-slate-600"}`}>{c}</span>
        ))}
      </div>
      <div className="flex-1 space-y-2.5 overflow-hidden">
        {articles.map((a, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-3 flex items-center gap-3 hover:border-[#0F5C5C]/30 transition cursor-pointer">
            <div className={`h-2 w-2 rounded-full ${a.color} shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-medium">{a.cat}</div>
              <div className="text-[12px] font-semibold text-slate-900 truncate">{a.title}</div>
            </div>
            <ChevronRight size={14} className="text-slate-300 shrink-0" />
          </div>
        ))}
      </div>
      <div className="mt-3 text-center text-[10px] text-slate-400 font-medium">4 articles · Powered by Helvion</div>
    </div>
  );
}

/* ─── Inline coded UI: Widget preview ─── */
function WidgetPreviewUI() {
  return (
    <div className="p-5 sm:p-6 h-[340px] sm:h-[400px] flex items-end justify-end bg-gradient-to-br from-slate-50 to-slate-100/50 relative">
      {/* Fake page content */}
      <div className="absolute top-6 left-6 right-6 space-y-3">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="h-2 w-48 rounded bg-slate-150" />
        <div className="h-2 w-40 rounded bg-slate-100" />
        <div className="mt-4 h-20 rounded-xl bg-white border border-slate-200" />
        <div className="h-2 w-36 rounded bg-slate-100" />
        <div className="h-2 w-44 rounded bg-slate-100" />
      </div>
      {/* Widget */}
      <div className="relative w-72 rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.12)] overflow-hidden">
        <div className="bg-[#0F5C5C] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">H</div>
            <div>
              <div className="text-[12px] font-semibold text-white">Helvion Support</div>
              <div className="text-[10px] text-white/70">Typically replies in minutes</div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex justify-start"><div className="rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2 text-[11px] text-slate-700 max-w-[85%]">Hi! How can we help you today?</div></div>
          <div className="flex justify-end"><div className="rounded-2xl rounded-tr-md bg-[#0F5C5C] px-3 py-2 text-[11px] text-white max-w-[85%]">I need help with billing</div></div>
          <div className="flex justify-start"><div className="rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2 text-[11px] text-slate-700 max-w-[85%]">Sure! Let me pull up your account details.</div></div>
        </div>
        <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-2">
          <div className="flex-1 text-[11px] text-slate-400">Type a message…</div>
          <Send size={14} className="text-[#0F5C5C]" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const { t } = useI18n();
  const [activeStep, setActiveStep] = useState(0);

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

  const stepUIs = [<WidgetPreviewUI key={0} />, <InboxUI key={1} />, <AIAgentUI key={2} />, <AnalyticsUI key={3} />];

  const showcases: { badge: string; title: string; desc: string; cta: string; href: string; ui: ReactNode; reverse?: boolean }[] = [
    { badge: "Shared Inbox", title: t("home.showcase1Title"), desc: t("home.showcase1Desc"), cta: t("home.showcase1Cta"), href: "/product", ui: <InboxUI /> },
    { badge: "AI Agent", title: t("home.showcase2Title"), desc: t("home.showcase2Desc"), cta: t("home.showcase2Cta"), href: "/product", ui: <AIAgentUI />, reverse: true },
    { badge: "Knowledge Base", title: t("home.showcase3Title"), desc: t("home.showcase3Desc"), cta: t("home.showcase3Cta"), href: "/product", ui: <KnowledgeBaseUI /> },
  ];

  const testimonials = [
    { quote: t("home.t1Quote"), name: t("home.t1Name"), role: t("home.t1Role"), stars: 5 },
    { quote: t("home.t2Quote"), name: t("home.t2Name"), role: t("home.t2Role"), stars: 5 },
    { quote: t("home.t3Quote"), name: t("home.t3Name"), role: t("home.t3Role"), stars: 5 },
  ];

  const trustLogos = ["Acme Corp", "TechFlow", "Buildify", "LaunchPad", "DataSync", "CloudBase", "Nextera", "Shipfast"];

  return (
    <PublicLayout>
      {/* ══════════════════════════════════════════════════════
          § 1  HERO
         ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#1A1D23] via-[#1F2937] to-[#0F3D3D]">
        <div className="pointer-events-none absolute -left-44 top-10 h-[560px] w-[560px] rounded-full bg-[#0F5C5C]/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-48 -top-24 h-[620px] w-[620px] rounded-full bg-[#1E88A8]/8 blur-3xl" />

        <div className={`${designTokens.layout.maxWidth} relative pt-20 sm:pt-28 pb-16 sm:pb-24`}>
          <FadeIn className="mx-auto max-w-[920px] text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0F5C5C]/30 bg-[#0F5C5C]/10 px-4 py-2 text-xs font-semibold text-[#1E88A8] backdrop-blur">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F5C5C]/20">
                <Sparkles size={12} className="text-[#1E88A8]" />
              </span>
              <span>{t("home.heroPill")}</span>
            </div>

            <h1 className="mt-7 text-[40px] font-extrabold tracking-tight text-white leading-[1.03] sm:text-6xl">
              {t("home.heroTitle")}
              <span className="block mt-2 bg-gradient-to-r from-[#0F5C5C] via-[#1E88A8] to-[#34D399] bg-clip-text text-transparent">
                {t("home.heroSubline")}
              </span>
            </h1>

            <p className="mt-5 text-lg text-slate-400 leading-relaxed sm:text-xl">
              {t("home.heroSubtitle")}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F5C5C] to-[#1E88A8] px-8 py-4 text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(15,92,92,0.36)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_54px_rgba(15,92,92,0.44)]"
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
          </FadeIn>

          {/* Real coded dashboard inside dark browser frame */}
          <FadeIn delay={0.15} className="mt-14 sm:mt-20 mx-auto max-w-[1120px]">
            <DarkBrowserFrame>
              <InboxUI />
            </DarkBrowserFrame>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 2  TRUST LOGOS — marquee
         ══════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200/60 bg-white overflow-hidden">
        <div className="py-8 sm:py-10">
          <div className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-6">
            {t("home.logosTitle")}
          </div>
          <div className="relative flex overflow-hidden">
            <div className="flex shrink-0 animate-[marquee_30s_linear_infinite] gap-12 px-6">
              {[...trustLogos, ...trustLogos].map((name, i) => (
                <span key={i} className="whitespace-nowrap text-lg font-bold text-slate-300 select-none">{name}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 3  PLATFORM GRID — 6 feature cards
         ══════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200/60 bg-slate-50">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <FadeIn className="mx-auto max-w-[720px] text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {t("home.platformTitle")}
            </h2>
            <p className="mt-3 text-slate-600">{t("home.platformSubtitle")}</p>
          </FadeIn>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {platformFeatures.map((f, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <div className="group h-full rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_14px_40px_rgba(15,92,92,0.08)] hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] shadow-[0_2px_8px_rgba(15,92,92,0.25)] mb-5 group-hover:scale-105 transition-transform">
                    <f.icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-[15px] font-extrabold text-slate-900 tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F5C5C] hover:text-[#0D4F4F] transition-colors"
            >
              {t("home.platformIncluded")}
              <ArrowRight size={14} />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 4  FEATURE SHOWCASES — 3 sections with real coded UIs
         ══════════════════════════════════════════════════════ */}
      {showcases.map((sc, i) => (
        <section key={i} className={`border-t border-slate-200/60 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
          <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
            <div className={`grid gap-12 lg:grid-cols-2 lg:gap-16 items-center ${sc.reverse ? "lg:grid-flow-dense" : ""}`}>
              <FadeIn className={sc.reverse ? "lg:col-start-2" : ""}>
                <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full bg-[#E6F4F4] text-[#0F5C5C]">
                  {sc.badge}
                </span>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl leading-tight">
                  {sc.title}
                </h2>
                <p className="mt-4 text-slate-600 leading-relaxed">{sc.desc}</p>
                <Link
                  href={sc.href}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1A1D23] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0F3D3D] transition-colors"
                >
                  {sc.cta}
                  <ArrowRight size={14} />
                </Link>
              </FadeIn>
              <FadeIn delay={0.1} className={sc.reverse ? "lg:col-start-1" : ""}>
                <BrowserFrame>
                  {sc.ui}
                </BrowserFrame>
              </FadeIn>
            </div>
          </div>
        </section>
      ))}

      {/* ══════════════════════════════════════════════════════
          § 5  AI AGENT 4-STEP — stepper + changing UI
         ══════════════════════════════════════════════════════ */}
      <section className="border-t border-slate-200/60 bg-white">
        <div className={`${designTokens.layout.maxWidth} py-20 sm:py-28`}>
          <FadeIn className="mx-auto max-w-[720px] text-center">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] mb-4 px-3 py-1 rounded-full bg-[#E6F4F4] text-[#0F5C5C]">
              {t("home.stepperBadge")}
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {t("home.stepperTitle")}
            </h2>
            <p className="mt-3 text-slate-600">{t("home.stepperSubtitle")}</p>
          </FadeIn>

          <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-16 items-start">
            <FadeIn>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveStep(i)}
                    className={`w-full text-left rounded-2xl border-2 p-6 transition-all duration-200 ${
                      activeStep === i
                        ? "border-[#0F5C5C] bg-[#E6F4F4]/40 shadow-[0_4px_16px_rgba(15,92,92,0.10)]"
                        : "border-slate-200/80 bg-white hover:border-[#0F5C5C]/30"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-colors ${activeStep === i ? "bg-[#0F5C5C] text-white" : "bg-slate-100 text-slate-600"}`}>
                        {i + 1}
                      </span>
                      <div>
                        <div className={`text-[15px] font-extrabold tracking-tight ${activeStep === i ? "text-slate-900" : "text-slate-600"}`}>
                          {step.title}
                        </div>
                        {activeStep === i && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-2 text-sm leading-relaxed text-slate-600"
                          >
                            {step.desc}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={0.1} className="sticky top-24">
              <BrowserFrame url={["widget.helvion.com", "app.helvion.com/inbox", "app.helvion.com/ai-agent", "app.helvion.com/analytics"][activeStep]}>
                {stepUIs[activeStep]}
              </BrowserFrame>
            </FadeIn>
          </div>

          <FadeIn className="mt-12 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F5C5C] to-[#1E88A8] px-8 py-4 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(15,92,92,0.35)] transition-all hover:-translate-y-0.5"
            >
              {t("home.stepperCta")}
              <ArrowRight size={16} />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 6  TESTIMONIALS — 3 cards with stars
         ══════════════════════════════════════════════════════ */}
      <section className="bg-slate-50 border-t border-slate-200/60">
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
                <figure className="relative h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_28px_rgba(15,92,92,0.08)] transition-all duration-300">
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
          § 7  CTA BANNER — Dark
         ══════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-[#1A1D23] via-[#1F2937] to-[#0F3D3D]">
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
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F5C5C] to-[#1E88A8] px-8 py-4 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(15,92,92,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,92,92,0.45)]"
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

