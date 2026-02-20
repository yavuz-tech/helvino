/**
 * Design Tokens — Centralized Tailwind class strings for premium visual language.
 * Used across all public, portal, and admin surfaces.
 *
 * Color palette: Indigo primary (#4B45FF → #6C67FF), dark neutrals.
 * No CSS-in-JS or runtime — pure class string constants.
 */

export const designTokens = {
  /* ── Brand Colors ── */
  colors: {
    primary: "#4B45FF",
    primaryHover: "#3B35EF",
    primarySoft: "#6C67FF",
    heroBg: "#0D0D12",
    heroBgAlt: "#13131A",
    footerBg: "#0D0D12",
    surface: "bg-white",
    surfaceRaised: "bg-white",
    surfaceAlt: "bg-[#F7F8FA]",
    background: "bg-[#F7F8FA]",
    backgroundSubtle: "bg-slate-100/60",
    muted: "text-[#5A5B6A]",
    mutedForeground: "text-[#8E8EA0]",
  },

  /* ── Gradients ── */
  gradients: {
    hero: "bg-gradient-to-b from-[#0D0D12] via-[#13131A] to-[#1A1A2E]",
    heroLight: "bg-gradient-to-b from-[#F7F8FA] via-white to-white",
    accent: "bg-gradient-to-r from-[#4B45FF] to-[#6C67FF]",
    accentSoft: "bg-gradient-to-br from-[#EDEDFF] to-[#F7F8FA]",
    accentSubtle: "bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60",
    loginBg: "bg-gradient-to-br from-[#0D0D12] via-[#13131A] to-[#1A1A2E]",
  },

  /* ── Shadows ── */
  shadows: {
    card: "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(75,69,255,0.08)]",
    cardHover: "hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_rgba(75,69,255,0.14)]",
    elevated: "shadow-[0_4px_16px_rgba(0,0,0,0.06),0_12px_32px_rgba(75,69,255,0.10)]",
    input: "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    button: "shadow-[0_1px_3px_rgba(75,69,255,0.2)]",
    buttonHover: "hover:shadow-[0_4px_12px_rgba(75,69,255,0.25)]",
  },

  /* ── Border Radius ── */
  radius: {
    card: "rounded-2xl",
    cardLg: "rounded-3xl",
    input: "rounded-xl",
    button: "rounded-xl",
    pill: "rounded-full",
    badge: "rounded-full",
  },

  /* ── Borders ── */
  borders: {
    light: "border border-slate-200/80",
    strong: "border-2 border-slate-200",
    input: "border border-slate-200",
    focus: "focus:border-[#4B45FF] focus:ring-2 focus:ring-[#4B45FF]/10",
  },

  /* ── Button Variants ── */
  buttons: {
    primary:
      "inline-flex items-center justify-center px-6 py-3 bg-[#4B45FF] text-white rounded-xl font-semibold text-sm hover:bg-[#3B35EF] active:bg-[#2E29D6] transition-all duration-150 shadow-[0_1px_3px_rgba(75,69,255,0.2)] hover:shadow-[0_4px_12px_rgba(75,69,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed",
    primaryLg:
      "inline-flex items-center justify-center px-8 py-4 bg-[#4B45FF] text-white rounded-xl font-semibold text-base hover:bg-[#3B35EF] active:bg-[#2E29D6] transition-all duration-150 shadow-[0_1px_3px_rgba(75,69,255,0.2)] hover:shadow-[0_4px_12px_rgba(75,69,255,0.25)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed",
    secondary:
      "inline-flex items-center justify-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed",
    secondaryLg:
      "inline-flex items-center justify-center px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-base hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed",
    ghost:
      "inline-flex items-center justify-center px-4 py-2.5 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
    danger:
      "inline-flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 active:bg-red-800 transition-all duration-150 shadow-[0_1px_3px_rgba(220,38,38,0.2)] disabled:opacity-50 disabled:cursor-not-allowed",
  },

  /* ── Input / Form ── */
  inputs: {
    base: "w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#4B45FF] focus:ring-2 focus:ring-[#4B45FF]/10 transition-all duration-150 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
    select: "w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-sm text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#4B45FF] focus:ring-2 focus:ring-[#4B45FF]/10 transition-all duration-150 disabled:bg-slate-50 disabled:cursor-not-allowed",
    label: "block text-sm font-medium text-slate-700 mb-1.5",
    helper: "text-xs text-slate-500 mt-1",
    error: "text-xs text-red-600 mt-1",
  },

  /* ── Chip / Pill ── */
  chips: {
    pill: "px-4 py-2 bg-white border border-slate-200/80 rounded-full text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-slate-600",
  },

  /* ── Typography ── */
  typography: {
    heroTitle: "text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.08]",
    heroSubtitle: "text-lg sm:text-xl text-slate-300 leading-relaxed",
    pageTitle: "text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight",
    sectionTitle: "text-xl font-semibold text-slate-900 tracking-tight",
    cardTitle: "text-base font-semibold text-slate-900",
    body: "text-sm text-slate-600 leading-relaxed",
    caption: "text-xs text-slate-500",
    overline: "text-[11px] font-semibold text-slate-500 uppercase tracking-widest",
  },

  /* ── Spacing ── */
  spacing: {
    sectionY: "py-20 sm:py-24",
    sectionGap: "space-y-16",
    cardGap: "gap-6",
    stackSm: "space-y-3",
    stackMd: "space-y-4",
    stackLg: "space-y-6",
  },

  /* ── Layout ── */
  layout: {
    maxWidth: "max-w-6xl mx-auto px-6",
    maxWidthNarrow: "max-w-xl mx-auto px-6",
    maxWidthWide: "max-w-7xl mx-auto px-6",
  },
};
