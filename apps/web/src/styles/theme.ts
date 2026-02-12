/* ═══════════════════════════════════════════════════════════
   Helvion Portal — Premium Design System Tokens
   Tidio / Intercom / Stripe level
   ═══════════════════════════════════════════════════════════ */

export {
  colors,
  fonts,
  fontSize,
  fontWeight,
  spacing,
  radius,
  shadow,
  transition,
  presets,
  emoji,
  ui,
} from "@/lib/design-tokens";

export const p = {
  /* ── Surfaces ── */
  page: "min-h-screen bg-[#f8f9fb]",
  sectionGap: "space-y-8",

  /* ── Card ── */
  card: "bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200",
  cardHover:
    "hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-[1px]",
  cardPadding: "p-6",

  /* ── Elevations ── */
  shadowSm: "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  shadowMd: "shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
  shadowLg: "shadow-[0_8px_30px_rgba(0,0,0,0.08)]",

  /* ── Typography (standard scale) ── */
  h1: "text-[24px] font-semibold tracking-[-0.02em] text-slate-900",
  h2: "text-[18px] font-semibold tracking-[-0.01em] text-slate-900",
  h3: "text-[15px] font-semibold text-slate-800",
  label: "text-[13px] font-medium text-slate-600",
  body: "text-[14px] leading-relaxed text-slate-600",
  caption: "text-[12px] text-slate-500",
  overline:
    "text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400",

  /* ── Icon containers ── */
  iconSm:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
  iconMd:
    "inline-flex h-10 w-10 items-center justify-center rounded-[10px] flex-shrink-0",
  iconLg:
    "inline-flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",

  /* ── Color tokens for icon backgrounds ── */
  iconBlue: "bg-blue-50 text-blue-600",
  iconIndigo: "bg-indigo-50 text-indigo-600",
  iconViolet: "bg-violet-50 text-violet-600",
  iconEmerald: "bg-emerald-50 text-emerald-600",
  iconAmber: "bg-amber-50 text-amber-600",
  iconRose: "bg-rose-50 text-rose-600",
  iconSlate: "bg-slate-100 text-slate-500",

  /* ── Buttons ── */
  btnPrimary:
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-[12px] font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
  btnSecondary:
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all duration-150",
  btnDanger:
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all duration-150",
  btnGhost:
    "inline-flex items-center justify-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors",

  /* ── Inputs ── */
  input:
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-400",
  textarea:
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none min-h-[96px]",
  select:
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-800 outline-none transition-all duration-150 focus:border-blue-400 focus:ring-2 focus:ring-blue-50",

  /* ── Toggle row ── */
  toggleRow:
    "flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50",

  /* ── Status badges ── */
  badgeGreen:
    "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700",
  badgeRed:
    "inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700",
  badgeAmber:
    "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700",
  badgeSlate:
    "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500",

  /* ── Divider ── */
  divider: "border-t border-slate-100",
} as const;

/* Backward-compat alias so old imports still work */
export const portalTheme = {
  page: p.page,
  sectionGap: p.sectionGap,
  cardBase: `${p.card} ${p.cardPadding} ${p.cardHover}`,
  iconWrap: `${p.iconMd} ${p.iconBlue}`,
  primaryButton: p.btnPrimary,
  secondaryButton: p.btnSecondary,
  title: p.h1,
  subtitle: p.body,
} as const;
