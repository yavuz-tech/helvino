import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import { PLAN_AI_LIMITS, PLAN_MAX_AGENTS } from "@helvino/shared";

/* ═══════════════════════════════════════════════════════════════
   HELVION.IO — Fiyatlandırma Sayfası v1
   Portal entegrasyonu için tek dosya — Cursor'a ver, birebir yapsın.

   ── KURULUM TALİMATLARI ──
   1. Bu dosyayı /app/portal/pricing/pricing-page.jsx olarak kaydet
   2. /app/portal/pricing/page.tsx oluştur - wrapper component
   3. Sidebar layout'a "Fiyatlandırma" menü linki ekle:
      - HESAP kategorisi altında, Faturalama'nın altına
      - Href: /portal/pricing
      - Icon: pricing icon SVG
      - Label: "Fiyatlandırma"

   ── page.tsx WRAPPER ──
   "use client";
   import { usePortalAuth } from "@/contexts/PortalAuthContext";
   import PricingPage from "./pricing-page";
   export default function PortalPricingPage -- {
     const { user, loading } = usePortalAuth--;
     if -- loading -- return null;
     return PricingPage with planKey=user?.planKey and orgKey=user?.orgKey;
   }
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════
// PLAN DATA — fiyatlar, özellikler, limitler
// ═══════════════════════════════════════════

const PRICES = {
  free: {
    monthly: { usd: 0, try: 0, eur: 0 },
    yearly: { usd: 0, try: 0, eur: 0 },
  },
  starter: {
    monthly: { usd: 15, try: 499, eur: 14 },
    yearly: { usd: 12, try: 399, eur: 11 },
  },
  pro: {
    monthly: { usd: 39, try: 1299, eur: 36 },
    yearly: { usd: 29, try: 999, eur: 27 },
  },
  business: {
    monthly: { usd: 119, try: 3999, eur: 109 },
    yearly: { usd: 89, try: 2999, eur: 99 },
  },
};

const PLANS = [
  {
    id: "free",
    nameKey: "pricingV2.plan.free.name",
    descKey: "pricingV2.plan.free.desc",
    color: "#059669",
    colorLight: "#D1FAE5",
    colorDark: "#047857",
    iconBg: "#D1FAE5",
    iconStroke: "#059669",
    gradient: null,
    tintBg: "linear-gradient(168deg,#F0FDF8 0%,#FFF 45%,#F7FDFB 100%)",
    borderColor: "rgba(16,185,129,0.18)",
    borderHover: "rgba(16,185,129,0.3)",
    hoverShadow: "0 12px 40px rgba(16,185,129,0.06)",
    priceColor: "#059669",
    ctaStyle: "green",
    ctaLabelKey: "pricingV2.plan.free.cta",
    ctaHref: "/register",
    capacity: [
      { labelKey: "pricingV2.capacity.agent", valueNum: PLAN_MAX_AGENTS.free, bold: true },
      { labelKey: "pricingV2.capacity.chatPerMonth", valueKey: "pricing.unlimited", bold: true },
      { labelKey: "pricingV2.capacity.messagePerMonth", valueKey: "pricing.unlimited", bold: true },
      { labelKey: "pricingV2.capacity.aiReplyPerMonth", valueNum: PLAN_AI_LIMITS.free, bold: true },
    ],
    features: [
      { textKey: "pricingV2.feature.liveChatWidget", has: true },
      { textKey: "pricingV2.feature.basicWidgetCustomization", has: true },
      { textKey: "pricingV2.feature.starterCount2", has: true },
      { textKey: "pricingV2.feature.offlineMessageForm", has: true },
      { textKey: "pricingV2.feature.mobileFriendlyUi", has: true },
      { textKey: "pricingV2.feature.workingHours", has: false },
      { textKey: "pricingV2.feature.autoReply", has: false },
      { textKey: "pricingV2.feature.preChatForm", has: false },
    ],
    featureHeaderKey: "pricingV2.featureHeader.included",
    popular: false,
  },
  {
    id: "starter",
    nameKey: "pricingV2.plan.starter.name",
    descKey: "pricingV2.plan.starter.desc",
    color: "#0EA5E9",
    colorLight: "#E0F2FE",
    colorDark: "#0284C7",
    iconBg: "#E0F2FE",
    iconStroke: "#0284C7",
    gradient: null,
    tintBg: "linear-gradient(168deg,#F0F9FF 0%,#FFF 45%,#F7FBFF 100%)",
    borderColor: "rgba(14,165,233,0.18)",
    borderHover: "rgba(14,165,233,0.3)",
    hoverShadow: "0 12px 40px rgba(14,165,233,0.06)",
    priceColor: "#0284C7",
    ctaStyle: "blue",
    ctaLabelKey: "pricingV2.plan.starter.cta",
    ctaHref: "/register?plan=starter",
    capacity: [
      { labelKey: "pricingV2.capacity.agent", valueNum: PLAN_MAX_AGENTS.starter, bold: true },
      { labelKey: "pricingV2.capacity.chatPerMonth", valueKey: "pricing.unlimited", bold: true },
      { labelKey: "pricingV2.capacity.messagePerMonth", valueKey: "pricing.unlimited", bold: true },
      { labelKey: "pricingV2.capacity.aiReplyPerMonth", valueNum: PLAN_AI_LIMITS.starter, bold: true },
    ],
    features: [
      { textKey: "pricingV2.feature.advancedWidgetCustomization", has: true },
      { textKey: "pricingV2.feature.starterCount5", has: true },
      { textKey: "pricingV2.feature.allAttentionGrabbers", has: true },
      { textKey: "pricingV2.feature.workingHoursManagement", has: true },
      { textKey: "pricingV2.feature.autoReply", has: true },
      { textKey: "pricingV2.feature.readReceipt", has: true },
      { textKey: "pricingV2.feature.fileSharing", has: true },
      { textKey: "pricingV2.feature.emailSupport", has: true },
      { textKey: "pricingV2.feature.removeBranding", has: true },
    ],
    featureHeaderKey: "pricingV2.featureHeader.plusFree",
    popular: false,
  },
  {
    id: "pro",
    nameKey: "pricingV2.plan.pro.name",
    descKey: "pricingV2.plan.pro.desc",
    color: "#F59E0B",
    colorLight: "#FEF3C7",
    colorDark: "#D97706",
    iconBg: "#FEF3C7",
    iconStroke: "#D97706",
    gradient: "linear-gradient(135deg,#F59E0B,#D97706)",
    tintBg: "linear-gradient(168deg,#FFFBF0 0%,#FFF 50%)",
    borderColor: "#F59E0B",
    borderHover: "#D97706",
    hoverShadow: "0 0 0 1px rgba(245,158,11,0.15),0 12px 40px rgba(245,158,11,0.1)",
    priceColor: "#D97706",
    ctaStyle: "amber",
    ctaLabelKey: "pricingV2.plan.pro.cta",
    ctaHref: "/register?plan=pro",
    capacity: [
      { labelKey: "pricingV2.capacity.agent", valueNum: PLAN_MAX_AGENTS.pro, bold: true },
      { labelKey: "pricingV2.capacity.chatPerMonth", valueKey: "pricing.unlimited", bold: true },
      { labelKey: "pricingV2.capacity.messagePerMonth", valueKey: "pricing.unlimited", bold: true },
      { labelKey: "pricingV2.capacity.aiReplyPerMonth", valueNum: PLAN_AI_LIMITS.pro, bold: true },
    ],
    features: [
      { textKey: "pricingV2.feature.removeBranding", has: true, star: true },
      { textKey: "pricingV2.feature.allAiModels", has: true, star: true },
      { textKey: "pricingV2.feature.fullWidgetCustomization", has: true },
      { textKey: "pricingV2.feature.unlimitedConversationStarters", has: true },
      { textKey: "pricingV2.feature.preChatForm", has: true },
      { textKey: "pricingV2.feature.csatSurvey", has: true },
      { textKey: "pricingV2.feature.smartAiReplies", has: true },
      { textKey: "pricingV2.feature.customCss", has: true },
      { textKey: "pricingV2.feature.pageRules", has: true },
      { textKey: "pricingV2.feature.auditLogs", has: true },
      { textKey: "pricingV2.feature.advancedAnalytics", has: true, soon: true },
      { textKey: "pricingV2.feature.liveAndEmailSupport", has: true },
    ],
    featureHeaderKey: "pricingV2.featureHeader.plusStarter",
    popular: true,
  },
  {
    id: "business",
    nameKey: "pricingV2.plan.business.name",
    descKey: "pricingV2.plan.business.desc",
    color: "#8B5CF6",
    colorLight: "#EDE9FE",
    colorDark: "#7C3AED",
    iconBg: "#EDE9FE",
    iconStroke: "#8B5CF6",
    gradient: "linear-gradient(135deg,#8B5CF6,#7C3AED)",
    tintBg: "linear-gradient(168deg,#F8F5FF 0%,#FFF 45%,#FAF7FF 100%)",
    borderColor: "rgba(139,92,246,0.2)",
    borderHover: "rgba(139,92,246,0.3)",
    hoverShadow: "0 12px 40px rgba(139,92,246,0.06)",
    priceColor: "#8B5CF6",
    ctaStyle: "violet",
    ctaLabelKey: "pricingV2.plan.business.cta",
    ctaHref: "/contact",
    capacity: [
      { labelKey: "pricingV2.capacity.agent", value: "50", bold: true },
      { labelKey: "pricingV2.capacity.chat", valueKey: "pricing.unlimited", bold: true },
      { labelKey: "pricingV2.capacity.message", valueKey: "pricing.unlimited", bold: true },
      { labelKey: "pricingV2.capacity.aiReplyPerMonth", valueKey: "pricing.unlimited", bold: true },
    ],
    features: [
      { textKey: "pricingV2.feature.customAiModelSupport", has: true, star: true },
      { textKey: "pricingV2.feature.slaGuarantee", has: true },
      { textKey: "pricingV2.feature.unlimitedLanguageSupport", has: true },
      { textKey: "pricingV2.feature.auditLogsOneYear", has: true },
      { textKey: "pricingV2.feature.unlimitedPageRules", has: true },
      { textKey: "pricingV2.feature.dedicatedAccountManager", has: true },
      { textKey: "pricingV2.feature.whitelabel", has: true, soon: true },
      { textKey: "pricingV2.feature.sso", has: true, soon: true },
      { textKey: "pricingV2.feature.webhook", has: true, soon: true },
      { textKey: "pricingV2.feature.knowledgeBase", has: true, soon: true },
      { textKey: "pricingV2.feature.analyticsExport", has: true, soon: true },
      { textKey: "pricingV2.feature.apiAccess", has: true, soon: true },
    ],
    featureHeaderKey: "pricingV2.featureHeader.plusPro",
    popular: false,
  },
];

// ═══ PLAN ICONS (SVG paths) ═══
const PLAN_ICONS = {
  free: (stroke) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
      <path d="M8 12h8M12 8v8"/>
    </svg>
  ),
  starter: (stroke) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  pro: (stroke) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  business: (stroke) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
};

// ═══ COMPARISON TABLE DATA ═══
const TABLE_SECTIONS = [
  {
    titleKey: "pricingV2.table.capacity.title",
    rows: [
      { labelKey: "pricingV2.table.row.agentCount", values: [PLAN_MAX_AGENTS.free, PLAN_MAX_AGENTS.starter, { vNum: PLAN_MAX_AGENTS.pro, hl: "amber" }, PLAN_MAX_AGENTS.business] },
      { labelKey: "pricingV2.table.row.monthlyChat", values: [{ key: "pricing.unlimited" }, { key: "pricing.unlimited" }, { key: "pricing.unlimited", hl: "amber" }, { key: "pricing.unlimited", hl: "amber" }] },
      { labelKey: "pricingV2.table.row.monthlyMessage", values: [{ key: "pricing.unlimited" }, { key: "pricing.unlimited" }, { key: "pricing.unlimited", hl: "amber" }, { key: "pricing.unlimited", hl: "amber" }] },
      { labelKey: "pricingV2.table.row.monthlyAi", values: [PLAN_AI_LIMITS.free, PLAN_AI_LIMITS.starter, { vNum: PLAN_AI_LIMITS.pro, hl: "amber" }, { key: "pricing.unlimited", hl: "amber" }] },
    ],
  },
  {
    titleKey: "pricingV2.table.ai.title",
    rows: [
      { labelKey: "pricingV2.table.row.aiModelSelection", values: [{ key: "pricingV2.table.value.automatic" }, { key: "pricingV2.table.value.automatic" }, { key: "pricingV2.table.value.all", hl: "green" }, { key: "pricingV2.table.value.allPlusCustom", hl: "green" }] },
      { labelKey: "pricingV2.table.row.smartAiReplies", values: ["—", "—", { v: "✓", hl: "green" }, { v: "✓", hl: "green" }] },
    ],
  },
  {
    titleKey: "pricingV2.table.widgetBrand.title",
    rows: [
      { labelKey: "pricingV2.table.row.widgetCustomization", values: [{ key: "pricingV2.table.value.basic" }, { key: "pricingV2.table.value.advanced" }, { key: "pricingV2.table.value.fullCss", hl: "green" }, { key: "pricingV2.table.value.fullCss", hl: "green" }] },
      { labelKey: "pricingV2.table.row.removeBranding", values: ["—", { v: "✓", hl: "green" }, { v: "✓", hl: "green" }, { v: "✓", hl: "green" }] },
      { labelKey: "pricingV2.table.row.conversationStarters", values: ["2", "5", { key: "pricing.unlimited", hl: "amber" }, { key: "pricing.unlimited", hl: "amber" }] },
      { labelKey: "pricingV2.table.row.attentionGrabber", values: [{ key: "pricingV2.table.value.basic" }, { key: "pricingV2.table.value.all", hl: "green" }, { key: "pricingV2.table.value.all", hl: "green" }, { key: "pricingV2.table.value.all", hl: "green" }] },
    ],
  },
  {
    titleKey: "pricingV2.table.features.title",
    rows: [
      { labelKey: "pricingV2.table.row.preChatForm", values: ["—", "—", { v: "✓", hl: "green" }, { v: "✓", hl: "green" }] },
      { labelKey: "pricingV2.table.row.workingHours", values: ["—", { v: "✓", hl: "green" }, { v: "✓", hl: "green" }, { v: "✓", hl: "green" }] },
      { labelKey: "pricingV2.table.row.csatSurvey", values: ["—", "—", { v: "✓", hl: "green" }, { v: "✓", hl: "green" }] },
      { labelKey: "pricingV2.table.row.autoReply", values: ["—", { v: "✓", hl: "green" }, { v: "✓", hl: "green" }, { v: "✓", hl: "green" }] },
      { labelKey: "pricingV2.table.row.readReceipt", values: ["—", { v: "✓", hl: "green" }, { v: "✓", hl: "green" }, { v: "✓", hl: "green" }] },
      { labelKey: "pricingV2.table.row.pageRules", values: ["—", "—", { v: "✓", hl: "green" }, { key: "pricing.unlimited", hl: "amber" }] },
      { labelKey: "pricingV2.table.row.auditLogs", values: ["—", "—", { key: "pricingV2.table.value.days30" }, { key: "pricingV2.table.value.year1" }] },
    ],
  },
  {
    titleKey: "pricingV2.table.support.title",
    rows: [
      { labelKey: "pricingV2.table.row.supportChannel", values: [{ key: "pricingV2.table.value.community" }, { key: "pricingV2.table.value.email" }, { key: "pricingV2.table.value.liveEmail", hl: "green" }, { key: "pricingV2.table.value.dedicatedManager", hl: "amber" }] },
    ],
  },
];

// ═══ FAQ DATA ═══
const FAQ_DATA = [
  {
    qKey: "pricingV2.faq.q1",
    boldKey: "pricingV2.faq.q1Bold",
    restKey: "pricingV2.faq.q1Rest",
  },
  {
    qKey: "pricingV2.faq.q2",
    boldKey: "pricingV2.faq.q2Bold",
    restKey: "pricingV2.faq.q2Rest",
  },
  {
    qKey: "pricingV2.faq.q3",
    boldKey: "pricingV2.faq.q3Bold",
    restKey: "pricingV2.faq.q3Rest",
  },
  {
    qKey: "pricingV2.faq.q4",
    boldKey: "pricingV2.faq.q4Bold",
    restKey: "pricingV2.faq.q4Rest",
  },
  {
    qKey: "pricingV2.faq.q5",
    boldKey: "pricingV2.faq.q5Bold",
    restKey: "pricingV2.faq.q5Rest",
  },
  {
    qKey: "pricingV2.faq.q6",
    boldKey: "pricingV2.faq.q6Bold",
    restKey: "pricingV2.faq.q6Rest",
  },
  {
    qKey: "pricingV2.faq.q7",
    boldKey: "pricingV2.faq.q7Bold",
    restKey: "pricingV2.faq.q7Rest",
  },
];

// ═══ TRUST ITEMS ═══
const TRUST_ITEMS = [
  { icon: "lock", t1Key: "pricingV2.trust.lock.title", t2Key: "pricingV2.trust.lock.subtitle" },
  { icon: "shield", t1Key: "pricingV2.trust.shield.title", t2Key: "pricingV2.trust.shield.subtitle" },
  { icon: "card", t1Key: "pricingV2.trust.card.title", t2Key: "pricingV2.trust.card.subtitle" },
  { icon: "clock", t1Key: "pricingV2.trust.clock.title", t2Key: "pricingV2.trust.clock.subtitle" },
];

const TRUST_ICONS = {
  lock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  shield: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  card: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  clock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
};

// ═══ CTA BUTTON STYLES ═══
const CTA_STYLES = {
  green: {
    background: "linear-gradient(135deg,#10B981,#059669)",
    color: "#FFF",
    boxShadow: "0 4px 14px rgba(16,185,129,0.18)",
    hoverShadow: "0 6px 20px rgba(16,185,129,0.28)",
  },
  blue: {
    background: "linear-gradient(135deg,#0EA5E9,#0284C7)",
    color: "#FFF",
    boxShadow: "0 4px 14px rgba(14,165,233,0.18)",
    hoverShadow: "0 6px 20px rgba(14,165,233,0.28)",
  },
  amber: {
    background: "linear-gradient(135deg,#F59E0B,#D97706)",
    color: "#FFF",
    boxShadow: "0 4px 14px rgba(245,158,11,0.2)",
    hoverShadow: "0 6px 20px rgba(245,158,11,0.3)",
  },
  violet: {
    background: "linear-gradient(135deg,#8B5CF6,#7C3AED)",
    color: "#FFF",
    boxShadow: "0 4px 14px rgba(139,92,246,0.2)",
    hoverShadow: "0 6px 20px rgba(139,92,246,0.3)",
  },
};

const PLAN_ORDER = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

function detectBrowserCurrencyFallback() {
  if (typeof window === "undefined") return "usd";
  try {
    const language = String(navigator.language || "").toLowerCase();
    const languages = Array.isArray(navigator.languages)
      ? navigator.languages.map((l) => String(l).toLowerCase())
      : [];
    const timezone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "");

    const allLocales = [language, ...languages].filter(Boolean).join(",");
    const isTurkish = allLocales.includes("tr") || timezone.includes("Istanbul");
    if (isTurkish) return "try";

    const euroLocaleHints = ["de", "fr", "es", "it", "nl", "pt", "fi", "el", "sk", "sl", "et", "lv", "lt"];
    const isEuroLike =
      euroLocaleHints.some((prefix) => allLocales.includes(`${prefix}-`)) ||
      /Europe\/(Berlin|Paris|Madrid|Rome|Amsterdam|Lisbon|Vienna|Brussels|Helsinki|Athens)/.test(
        timezone
      );
    if (isEuroLike) return "eur";
  } catch (_) {
    // ignore and fallback
  }
  return "usd";
}

// ═══════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════
export default function PricingPage({ planKey = "free", orgKey = "" }) {
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState("m"); // m = monthly, y = yearly
  const [openFaq, setOpenFaq] = useState(-1);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [currency, setCurrency] = useState("usd");
  const [discountInfo, setDiscountInfo] = useState({
    hasDiscount: false,
    discountPercent: 0,
    type: "none",
  });
  const [fmData, setFmData] = useState({ remaining: 200, available: true, limit: 200 });
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const sym = currency === "usd" ? "$" : currency === "eur" ? "€" : "₺";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const activeOrgKey = orgKey || "demo";
  const nf = new Intl.NumberFormat(
    locale === "tr" ? "tr-TR" : locale === "es" ? "es-ES" : "en-US"
  );

  useEffect(() => {
    let mounted = true;
    portalApiFetch("/api/currency")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const normalized = String(data?.currency || "")
          .trim()
          .toLowerCase();
        const country = String(data?.country || "")
          .trim()
          .toUpperCase();
        const browserFallback = detectBrowserCurrencyFallback();
        if (normalized === "try" || normalized === "usd" || normalized === "eur") {
          if (country === "ZZ" && normalized === "usd" && browserFallback !== "usd") {
            setCurrency(browserFallback);
          } else {
            setCurrency(normalized);
          }
        } else {
          setCurrency(browserFallback);
        }
      })
      .catch(() => {
        setCurrency(detectBrowserCurrencyFallback());
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/founding-member-status`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.remaining === "number" && typeof d?.available === "boolean") {
          setFmData({
            remaining: d.remaining,
            available: d.available,
            limit: typeof d?.limit === "number" ? d.limit : 200,
          });
        }
      })
      .catch(() => {
        // keep default fallback
      });
  }, [API_URL]);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_URL}/api/active-discount?orgKey=${encodeURIComponent(activeOrgKey)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const discountPercent =
          typeof d?.discountPercent === "number" && d.discountPercent > 0
            ? Math.min(100, d.discountPercent)
            : 0;
        setDiscountInfo({
          hasDiscount: Boolean(d?.hasDiscount && discountPercent > 0),
          discountPercent,
          type: d?.type === "founding" ? "founding" : d?.type === "global" ? "global" : "none",
        });
      })
      .catch(() => {
        if (!mounted) return;
        setDiscountInfo({
          hasDiscount: false,
          discountPercent: 0,
          type: "none",
        });
      });
    return () => {
      mounted = false;
    };
  }, [API_URL, activeOrgKey]);

  function getPrice(plan) {
    const billingPeriod = period === "y" ? "yearly" : "monthly";
    return PRICES[plan.id]?.[billingPeriod]?.[currency] ?? PRICES[plan.id]?.[billingPeriod]?.usd ?? 0;
  }

  function formatPrice(v) {
    if (v === 0) return "0";
    if (currency === "try") return v.toLocaleString("tr-TR");
    if (currency === "eur") return v.toLocaleString("de-DE");
    return v.toLocaleString("en-US");
  }

  function getDiscountedPrice(originalPrice) {
    return (originalPrice * (100 - discountInfo.discountPercent) / 100).toFixed(2);
  }

  function getYearlyNote(plan) {
    if (period !== "y" || plan.id === "free") return null;
    const yearlyMonthly = PRICES[plan.id]?.yearly?.[currency] ?? PRICES[plan.id]?.yearly?.usd ?? 0;
    return t("pricingV2.yearlyBilledAt", { amount: `${sym}${formatPrice(yearlyMonthly)}` });
  }

  async function handleCheckout(targetPlanKey) {
    const selectedPeriod = period === "y" ? "yearly" : "monthly";
    setCheckoutError("");
    setCheckoutLoadingPlan(targetPlanKey);
    try {
      const res = await portalApiFetch("/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          planKey: targetPlanKey,
          period: selectedPeriod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCheckoutError(
          typeof data?.error === "string" ? data.error : t("billing.checkoutFailed")
        );
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setCheckoutError(t("billing.checkoutFailed"));
    } catch {
      setCheckoutError(t("common.networkError"));
    } finally {
      setCheckoutLoadingPlan(null);
    }
  }

  // ═══ STYLES — exact Warm Premium tokens ═══
  const s = {
    font: "'Manrope',sans-serif",
    fontH: "'Satoshi',sans-serif",
    bg: "#FAF9F7",
    card: "#FFF",
    border: "#E8E0D4",
    borderLight: "#F3EDE4",
    borderWarm: "#F3E8D8",
    txt: "#1A1D23",
    txt2: "#475569",
    txt3: "#64748B",
    mute: "#94A3B8",
    amberD: "#D97706",
    amberBg: "#FEF3C7",
    greenD: "#059669",
    greenBg: "#D1FAE5",
  };

  return (
    <div style={{ fontFamily: s.font, paddingBottom: 48, width: "100%" }}>
      <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dotPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.3)}50%{box-shadow:0 0 0 6px rgba(245,158,11,0)}}
        @keyframes badgePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
        @media (max-width: 1100px){.pricing-cards-grid{grid-template-columns:repeat(2,1fr)!important}}
        @media (max-width: 640px){.pricing-cards-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* ═══ HERO ═══ */}
      <section style={{ textAlign: "center", padding: "32px 0 24px", animation: "fadeUp 0.5s ease both" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: s.fontH, fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: s.amberD, marginBottom: 24 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", animation: "dotPulse 2s ease infinite" }} />
          {t("pricing.title")}
        </div>
        <h1 style={{ fontFamily: s.fontH, fontSize: "clamp(30px,4.8vw,48px)", fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 14 }}>
          {t("pricingV2.heroTitlePrefix")}{" "}
          <em style={{ fontStyle: "normal", background: "linear-gradient(135deg,#F59E0B,#D97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {t("pricingV2.heroTitleHighlight")}
          </em>
        </h1>
        <p style={{ fontSize: 16, color: s.txt3, maxWidth: 420, margin: "0 auto 44px", lineHeight: 1.65 }}>
          {t("pricingV2.heroSubtitleLine1")}<br />{t("pricingV2.heroSubtitleLine2")}
        </p>

        {/* Toggle */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 52 }}>
          <div style={{ display: "flex", background: s.card, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            {["m", "y"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "10px 28px", border: "none", background: period === p ? s.txt : "none",
                  fontFamily: s.font, fontSize: 14, fontWeight: 600,
                  color: period === p ? "#FFF" : s.mute,
                  borderRadius: 9, cursor: "pointer", transition: "all 0.3s",
                  boxShadow: period === p ? "0 2px 8px rgba(26,29,35,0.12)" : "none",
                }}
              >
                {p === "m" ? t("pricing.monthly") : t("pricing.yearly")}
              </button>
            ))}
          </div>
          <span
            style={{
              fontSize: 11.5, fontWeight: 700, padding: "5px 13px", borderRadius: 100,
              background: s.greenBg, color: s.greenD,
              opacity: period === "y" ? 1 : 0, transition: "all 0.3s",
              transform: period === "y" ? "translateX(0)" : "translateX(-6px)",
            }}
          >
            {t("pricing.yearlyDiscount")}
          </span>
        </div>
        {checkoutError ? (
          <p style={{ fontSize: 13, color: "#B91C1C", marginTop: -32, marginBottom: 12 }}>
            {checkoutError}
          </p>
        ) : null}
      </section>

      {discountInfo.hasDiscount ? (
        <section style={{ marginBottom: 20, animation: "fadeUp 0.45s ease both" }}>
          <div
            style={{
              borderRadius: 16,
              padding: "16px 18px",
              border: "1px solid rgba(217,119,6,0.24)",
              background:
                discountInfo.type === "founding"
                  ? "linear-gradient(135deg,#F59E0B 0%,#B45309 100%)"
                  : "linear-gradient(135deg,#FEF3C7 0%,#FDE68A 52%,#FCD34D 100%)",
              color: discountInfo.type === "founding" ? "#FFF7ED" : "#7C2D12",
              boxShadow:
                discountInfo.type === "founding"
                  ? "0 10px 30px rgba(180,83,9,0.24)"
                  : "0 8px 24px rgba(245,158,11,0.18)",
              fontFamily: s.fontH,
              fontWeight: 700,
              letterSpacing: -0.1,
            }}
          >
            {discountInfo.type === "founding" ? (
              <span>
                {"🏆 "}
                {t("pricingV2.foundingDiscountBanner")}{" "}
                {t("pricingV2.foundingRemaining", {
                  remaining: String(fmData.remaining),
                  limit: String(fmData.limit),
                })}
              </span>
            ) : (
              <span>
                {"🎉 "}
                {t("pricingV2.globalDiscountBanner", {
                  percent: String(discountInfo.discountPercent),
                })}
              </span>
            )}
          </div>
        </section>
      ) : null}

      {/* ═══ CARDS ═══ */}
      <section style={{ width: "100%", animation: "fadeUp 0.5s ease both", animationDelay: "0.06s" }}>
        <div className="pricing-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
          {PLANS.map((plan) => {
            const isHovered = hoveredCard === plan.id;
            const cta = CTA_STYLES[plan.ctaStyle];
            const originalPrice = getPrice(plan);
            const hasPlanDiscount =
              discountInfo.hasDiscount && plan.id !== "free" && originalPrice > 0;
            const discountedPrice = hasPlanDiscount ? getDiscountedPrice(originalPrice) : null;
            const isCurrentPlan = plan.id === planKey;
            const isCheckoutPlan = plan.id === "starter" || plan.id === "pro";
            const isDowngradeTarget = PLAN_ORDER[plan.id] < (PLAN_ORDER[planKey] ?? 0);
            const isCheckoutDisabled =
              isCurrentPlan ||
              !isCheckoutPlan ||
              isDowngradeTarget ||
              checkoutLoadingPlan != null;
            return (
              <div
                key={plan.id}
                onMouseEnter={() => setHoveredCard(plan.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: plan.tintBg,
                  border: `1.5px solid ${plan.borderColor}`,
                  borderRadius: 22, padding: "30px 24px 26px",
                  display: "flex", flexDirection: "column", position: "relative",
                  transition: "all 0.25s ease",
                  boxShadow: isHovered ? plan.hoverShadow : "0 1px 3px rgba(0,0,0,0.02),0 4px 16px rgba(0,0,0,0.03)",
                  transform: isHovered ? "translateY(-3px)" : "none",
                  borderColor: isHovered ? plan.borderHover : plan.borderColor,
                }}
              >
                {/* Top tags */}
                {isCurrentPlan ? (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: "linear-gradient(135deg,#0EA5E9,#0284C7)", color: "#FFF",
                    fontFamily: s.fontH, fontSize: 11, fontWeight: 700,
                    padding: "5px 18px", borderRadius: 100, letterSpacing: 0.3,
                    whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(14,165,233,0.22)",
                  }}>
                    {t("pricing.currentPlan")}
                  </div>
                ) : null}
                {!isCurrentPlan && plan.popular && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#FFF",
                    fontFamily: s.fontH, fontSize: 11, fontWeight: 700,
                    padding: "5px 18px", borderRadius: 100, letterSpacing: 0.3,
                    whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(217,119,6,0.2)",
                  }}>
                    {t("pricing.mostPopular")}
                  </div>
                )}

                {/* Icon */}
                <div style={{ width: 42, height: 42, borderRadius: 12, background: plan.iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  {PLAN_ICONS[plan.id](plan.iconStroke)}
                </div>

                <div style={{ fontFamily: s.fontH, fontSize: 18, fontWeight: 700, marginBottom: 3 }}>{t(plan.nameKey)}</div>
                <div style={{ fontSize: 14, color: s.mute, lineHeight: 1.5, marginBottom: 20, minHeight: 36 }}>{t(plan.descKey)}</div>

                {/* Price */}
                {plan.id === "free" ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: s.fontH, fontSize: 34, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1, color: plan.priceColor }}>
                      {t("pricingV2.freePriceLabel")}
                    </span>
                  </div>
                ) : hasPlanDiscount ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        title={t("pricingV2.originalPrice")}
                        style={{
                          textDecoration: "line-through",
                          color: "#94A3B8",
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}
                      >
                        {sym}{formatPrice(originalPrice)}{t("pricing.perMonth")}
                      </span>
                      <span
                        style={{
                          background: "linear-gradient(135deg,#F59E0B,#D97706)",
                          color: "#FFF",
                          borderRadius: 8,
                          padding: "4px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 0.2,
                          animation: "badgePulse 2.2s ease-in-out infinite",
                        }}
                      >
                        {t("pricingV2.discountBadge", {
                          percent: String(discountInfo.discountPercent),
                        })}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                      <span style={{ fontFamily: s.fontH, fontSize: 17, fontWeight: 700, color: "#059669", marginTop: 4, alignSelf: "flex-start" }}>{sym}</span>
                      <span style={{ fontFamily: s.fontH, fontSize: 44, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: "#059669" }}>
                        {Number(discountedPrice).toLocaleString(currency === "try" ? "tr-TR" : "en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span style={{ fontSize: 14, color: "#059669", fontWeight: 800, marginLeft: 2 }}>{period === "y" ? t("pricing.perYear") : t("pricing.perMonth")}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                    <span style={{ fontFamily: s.fontH, fontSize: 17, fontWeight: 700, color: s.txt2, marginTop: 4, alignSelf: "flex-start" }}>{sym}</span>
                    <span style={{ fontFamily: s.fontH, fontSize: 44, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: plan.priceColor }}>{formatPrice(originalPrice)}</span>
                    <span style={{ fontSize: 14, color: s.mute, fontWeight: 500, marginLeft: 2 }}>{period === "y" ? t("pricing.perYear") : t("pricing.perMonth")}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, color: s.mute, marginTop: 3, marginBottom: 20, minHeight: 15 }}>
                  {getYearlyNote(plan) || "\u00A0"}
                </div>

                {/* CTA */}
                {plan.id === "free" || plan.id === "business" || isDowngradeTarget ? (
                  <a
                    href={plan.id === "free" ? "/register" : "/contact"}
                    style={{
                      display: "block", width: "100%", padding: 13, borderRadius: 12, border: "none",
                      fontFamily: s.font, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      textAlign: "center", textDecoration: "none", transition: "all 0.2s",
                      background: cta.background, color: cta.color, boxShadow: cta.boxShadow,
                    }}
                  >
                    {isDowngradeTarget ? t("pricing.contactSales") : t(plan.ctaLabelKey)}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.id)}
                    disabled={isCheckoutDisabled}
                    style={{
                      display: "block", width: "100%", padding: 13, borderRadius: 12, border: "none",
                      fontFamily: s.font, fontSize: 14, fontWeight: 700, cursor: isCheckoutDisabled ? "not-allowed" : "pointer",
                      textAlign: "center", textDecoration: "none", transition: "all 0.2s",
                      background: isCurrentPlan ? "#E2E8F0" : cta.background,
                      color: isCurrentPlan ? "#475569" : cta.color,
                      boxShadow: isCurrentPlan ? "none" : cta.boxShadow,
                      opacity: checkoutLoadingPlan === plan.id ? 0.75 : 1,
                    }}
                  >
                    {checkoutLoadingPlan === plan.id
                      ? t("billing.redirecting")
                      : isCurrentPlan
                        ? t("pricing.currentPlan")
                        : discountInfo.hasDiscount
                          ? `${t("pricingV2.discountedCTA")} →`
                          : t("pricingV2.defaultCheckoutCTA")}
                  </button>
                )}

                <div style={{ height: 1, background: s.borderLight, margin: "22px 0 18px" }} />

                {/* Capacity */}
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: s.mute, marginBottom: 7 }}>{t("pricingV2.capacity")}</div>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                  {plan.capacity.map((c, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 14, lineHeight: 1.4, color: s.txt2 }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, flexShrink: 0, marginTop: 1, background: plan.id === "business" ? "#EDE9FE" : s.amberBg, color: plan.id === "business" ? "#8B5CF6" : s.amberD }}>★</span>
                      <span>
                        <strong style={{ color: s.txt, fontWeight: 600 }}>
                          {c.valueKey ? t(c.valueKey) : typeof c.valueNum === "number" ? nf.format(c.valueNum) : c.value}
                        </strong>{" "}
                        {t(c.labelKey)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Features */}
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: s.mute, margin: "12px 0 7px" }}>{t(plan.featureHeaderKey)}</div>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 14, lineHeight: 1.4, color: f.has ? s.txt2 : s.mute }}>
                      {f.has ? (
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 8, flexShrink: 0, marginTop: 1,
                          background: f.star ? (plan.id === "business" ? "#EDE9FE" : s.amberBg) : s.greenBg,
                          color: f.star ? (plan.id === "business" ? "#8B5CF6" : s.amberD) : s.greenD,
                        }}>
                          {f.star ? "★" : "✓"}
                        </span>
                      ) : (
                        <span style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, flexShrink: 0, marginTop: 1, background: "#F1EDE7", color: "#C4B9AA" }}>–</span>
                      )}
                      <span>
                        {f.star ? <strong style={{ color: s.txt, fontWeight: 600 }}>{t(f.textKey)}</strong> : t(f.textKey)}
                        {f.soon && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: s.amberBg, color: s.amberD, marginLeft: 4, letterSpacing: 0.2 }}>{t("pricingV2.soon")}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ FOUNDING MEMBER ═══ */}
      <div style={{ margin: "48px 0 0", animation: "fadeUp 0.5s ease both", animationDelay: "0.1s" }}>
        <div style={{
          background: s.txt, borderRadius: 16, padding: "28px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
          position: "relative", overflow: "hidden",
          opacity: fmData.available ? 1 : 0.72,
        }}>
          <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, background: "radial-gradient(circle,rgba(245,158,11,0.12),transparent 65%)", pointerEvents: "none" }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ fontFamily: s.fontH, fontSize: 16, fontWeight: 700, color: "#FFF", marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
              {t("pricingV2.foundingTitle")}
              <span style={{ fontSize: 8.5, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#FFF", letterSpacing: 0.3 }}>{t("pricingV2.limited")}</span>
            </h4>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, maxWidth: 360 }}>
              {t("pricingV2.foundingDescription")}
            </p>
            <p style={{ color: "rgba(255,255,255,0.74)", fontSize: 12.5, marginTop: 10, fontWeight: 700 }}>
              {fmData.available
                ? t("pricingV2.foundingRemaining", {
                    remaining: String(fmData.remaining),
                    limit: String(fmData.limit),
                  })
                : t("pricingV2.foundingSoldOut")}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ fontFamily: s.fontH, fontSize: 40, fontWeight: 900, background: "linear-gradient(135deg,#F59E0B,#D97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>%40</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
              <strong style={{ display: "block", color: "#FFF", fontSize: 14, fontWeight: 700 }}>{t("pricingV2.permanentDiscount")}</strong>
              {t("pricingV2.validOnYearly")}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ COMPARISON TABLE ═══ */}
      <section style={{ margin: "72px 0 0" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{ fontFamily: s.fontH, fontSize: 28, fontWeight: 800, letterSpacing: -0.5, marginBottom: 5 }}>{t("pricingV2.comparisonTitle")}</h2>
          <p style={{ color: s.txt3, fontSize: 15 }}>{t("pricingV2.comparisonSubtitle")}</p>
        </div>
        <div style={{ background: s.card, border: `1.5px solid ${s.border}`, borderRadius: 20, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02),0 4px 16px rgba(0,0,0,0.03)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {[t("pricing.features"), t("pricingV2.plan.free.name"), t("pricingV2.plan.starter.name"), t("pricingV2.plan.pro.name"), t("pricingV2.plan.business.name")].map((h, i) => (
                    <th key={i} style={{
                      padding: "16px 16px", fontWeight: 700, fontSize: 13,
                      background: i === 3 ? "linear-gradient(180deg,#FFFBF0,#FEF3C7)" : "linear-gradient(180deg,#FAF7F2,#F5F0E8)",
                      borderBottom: `1.5px solid ${s.border}`, textAlign: i === 0 ? "left" : "center",
                      color: i === 3 ? s.amberD : s.txt2,
                      textTransform: i > 0 ? "uppercase" : "none", letterSpacing: i > 0 ? 0.5 : 0,
                      minWidth: i === 0 ? 170 : "auto",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_SECTIONS.map((section, si) => (
                  <React.Fragment key={`s-${si}`}>
                    <tr>
                      <td colSpan={5} style={{ background: "#FAF7F2", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: s.amberD, padding: "10px 16px" }}>{t(section.titleKey)}</td>
                    </tr>
                    {section.rows.map((row, ri) => (
                      <tr key={`r-${si}-${ri}`}>
                        <td style={{ padding: "12px 16px", borderBottom: `1px solid ${s.borderLight}`, textAlign: "left", color: s.txt3, fontWeight: 500 }}>{t(row.labelKey)}</td>
                        {row.values.map((v, vi) => {
                          const isObj = typeof v === "object";
                          const text = isObj
                            ? (v.key ? t(v.key) : typeof v.vNum === "number" ? nf.format(v.vNum) : v.v)
                            : (typeof v === "number" ? nf.format(v) : v);
                          const hl = isObj ? v.hl : null;
                          let color = s.txt2;
                          let fw = 500;
                          if (text === "—") { color = "#D1C8BE"; }
                          else if (hl === "green") { color = s.greenD; fw = 600; }
                          else if (hl === "amber") { color = s.amberD; fw = 600; }
                          return (
                            <td key={vi} style={{ padding: "12px 16px", borderBottom: `1px solid ${s.borderLight}`, textAlign: "center", color, fontWeight: fw }}>{text}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section style={{ maxWidth: 700, margin: "72px auto 0" }}>
        <h2 style={{ fontFamily: s.fontH, fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 32, letterSpacing: -0.5 }}>{t("pricing.faqTitle")}</h2>
        {FAQ_DATA.map((faq, i) => {
          const isOpen = openFaq === i;
          const restText =
            faq.restKey === "pricingV2.faq.q1Rest"
              ? t(faq.restKey, {
                  agents: nf.format(PLAN_MAX_AGENTS.free),
                  ai: nf.format(PLAN_AI_LIMITS.free),
                })
              : t(faq.restKey);
          return (
            <div key={i} style={{ borderBottom: `1px solid ${s.borderLight}` }}>
              <div
                onClick={() => setOpenFaq(isOpen ? -1 : i)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0", cursor: "pointer", gap: 14, userSelect: "none" }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: s.txt, lineHeight: 1.4 }}>{t(faq.qKey)}</span>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, flexShrink: 0, transition: "all 0.3s",
                  background: isOpen ? s.amberBg : "#F1EDE7",
                  color: isOpen ? s.amberD : s.mute,
                  transform: isOpen ? "rotate(45deg)" : "none",
                }}>+</span>
              </div>
              <div style={{ maxHeight: isOpen ? 400 : 0, overflow: "hidden", transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={{ fontSize: 14.5, color: s.txt3, lineHeight: 1.8, paddingBottom: 18 }}>
                  <strong style={{ color: s.txt, fontWeight: 600 }}>{t(faq.boldKey)}</strong>
                  {restText}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ═══ TRUST ═══ */}
      <section style={{ textAlign: "center", padding: "56px 0 32px" }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: s.mute, marginBottom: 24 }}>{t("pricing.trustBadges")}</h3>
        <div style={{ display: "flex", justifyContent: "center", gap: 36, flexWrap: "wrap" }}>
          {TRUST_ITEMS.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F1EDE7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {TRUST_ICONS[item.icon]}
              </div>
              <div>
                <div style={{ fontFamily: s.fontH, fontSize: 13, fontWeight: 700, color: s.txt }}>{t(item.t1Key)}</div>
                <div style={{ fontSize: 11.5, color: s.mute }}>{t(item.t2Key)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <div style={{ margin: "48px 0 0" }}>
        <div style={{
          background: "linear-gradient(135deg,#FFFBF0,#FEF3E2)",
          border: `1.5px solid ${s.borderWarm}`, borderRadius: 20,
          padding: "48px 36px", textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          <h2 style={{ fontFamily: s.fontH, fontSize: 26, fontWeight: 800, marginBottom: 6, letterSpacing: -0.5 }}>{t("pricingV2.bottomCtaTitle")}</h2>
          <p style={{ color: s.txt3, fontSize: 15, marginBottom: 24 }}>{t("pricingV2.bottomCtaSubtitle")}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <a href="/register" style={{
              padding: "12px 30px", borderRadius: 12, fontFamily: s.font, fontSize: 14, fontWeight: 700,
              textDecoration: "none", background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#FFF",
              boxShadow: "0 4px 14px rgba(245,158,11,0.2)",
            }}>
              {t("pricing.startFree")}
            </a>
            <a href="/contact" style={{
              padding: "12px 30px", borderRadius: 12, fontFamily: s.font, fontSize: 14, fontWeight: 700,
              textDecoration: "none", background: s.card, color: s.txt, border: `1.5px solid ${s.border}`,
            }}>
              {t("pricing.contactSales")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
