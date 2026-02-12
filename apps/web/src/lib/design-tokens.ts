/**
 * Helvion Design System — Warm Premium Theme
 * Tek kaynak: Tum renkler, fontlar, spacing burada tanimli.
 * Sayfalar bu dosyadan import ederek kullanmali.
 */

// === RENKLER ===
export const colors = {
  // Ana Marka
  brand: {
    primary: "#F59E0B", // Amber — ana marka rengi
    secondary: "#D97706", // Koyu amber
    tertiary: "#B45309", // En koyu amber
    light: "#FEF3C7", // Acik amber arka plan
    ultraLight: "#FFFBF5", // Cok acik warm arka plan
  },

  // Gradient
  gradient: {
    sidebar: "linear-gradient(180deg, #F59E0B, #D97706)",
    header: "linear-gradient(135deg, #F59E0B, #D97706)",
    card: "linear-gradient(135deg, #FFFBF5, #FEF3C7)",
    hero: "linear-gradient(135deg, #1A1D23 0%, #2D2D44 100%)",
  },

  // Notr (Metin ve arka planlar)
  neutral: {
    900: "#1A1D23", // En koyu metin
    800: "#1E293B", // Baslik metni
    700: "#334155", // Alt baslik
    600: "#475569", // Body metin
    500: "#64748B", // Ikincil metin
    400: "#94A3B8", // Placeholder
    300: "#CBD5E1", // Border
    200: "#E2E8F0", // Acik border
    100: "#F1F5F9", // Acik arka plan
    50: "#F8FAFC", // En acik arka plan
    white: "#FFFFFF",
  },

  // Durum Renkleri
  status: {
    success: "#059669",
    successLight: "#D1FAE5",
    warning: "#D97706",
    warningLight: "#FEF3C7",
    error: "#DC2626",
    errorLight: "#FEE2E2",
    info: "#2563EB",
    infoLight: "#DBEAFE",
  },

  // Aksan Renkler (Warm Premium)
  accent: {
    lavender: "#7C3AED",
    lavenderLight: "#EDE9FE",
    mint: "#059669",
    mintLight: "#D1FAE5",
    coral: "#F97316",
    coralLight: "#FFF7ED",
    teal: "#0D9488",
    tealLight: "#CCFBF1",
  },

  // Sidebar Ozel
  sidebar: {
    bg: "linear-gradient(180deg, #F59E0B, #D97706)",
    activeItem: "#FFFFFF",
    activeText: "#D97706",
    hoverBg: "rgba(255,255,255,0.15)",
    text: "rgba(255,255,255,0.85)",
    textMuted: "rgba(255,255,255,0.5)",
    iconBox: "#F8FAFC",
    divider: "#F3E8D8",
  },

  // Widget
  widget: {
    defaultPrimary: "#0F5C5C",
    bubble: "#F59E0B",
  },

  // Border
  border: {
    warm: "#F3E8D8",
    default: "#E2E8F0",
    light: "#F1F5F9",
  },
} as const;

// === FONTLAR ===
export const fonts = {
  heading: "var(--font-heading), var(--font-satoshi), Satoshi, sans-serif",
  body: "var(--font-manrope), Manrope, sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
} as const;

// === FONT BOYUTLARI ===
export const fontSize = {
  xs: "11px",
  sm: "13px",
  base: "14px",
  md: "15px",
  lg: "17px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "30px",
  "4xl": "36px",
} as const;

// === FONT AGIRLIK ===
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

// === SPACING ===
export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "32px",
  "4xl": "40px",
  "5xl": "48px",
} as const;

// === BORDER RADIUS ===
export const radius = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
  full: "9999px",
} as const;

// === SHADOW ===
export const shadow = {
  sm: "0 1px 2px rgba(0,0,0,0.05)",
  md: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
  lg: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05)",
  xl: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
  card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
  cardHover: "0 10px 25px rgba(0,0,0,0.08)",
  amber: "0 4px 14px rgba(245,158,11,0.15)",
  amberStrong: "0 4px 20px rgba(245,158,11,0.25)",
} as const;

// === TRANSITION ===
export const transition = {
  fast: "all 0.15s ease",
  normal: "all 0.2s ease",
  slow: "all 0.3s ease",
} as const;

// === HAZIR STILLER (sik kullanilan kombinasyonlar) ===
export const presets = {
  card: {
    background: colors.neutral.white,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border.warm}`,
    boxShadow: shadow.card,
    padding: spacing["2xl"],
  },
  cardHover: {
    boxShadow: shadow.cardHover,
    borderColor: colors.brand.primary,
  },
  pageTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.neutral[900],
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[800],
  },
  bodyText: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    fontWeight: fontWeight.normal,
    color: colors.neutral[600],
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.neutral[900],
  },
  badge: {
    fontFamily: fonts.heading,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    borderRadius: radius.full,
    padding: "2px 10px",
  },
  amberButton: {
    background: colors.gradient.header,
    color: colors.neutral.white,
    fontFamily: fonts.heading,
    fontWeight: fontWeight.bold,
    borderRadius: radius.md,
    border: "none",
    cursor: "pointer",
    transition: transition.normal,
  },
} as const;

// === EMOJI HARITASI ===
export const emoji = {
  success: "✅",
  warning: "⚠️",
  error: "❌",
  info: "💡",
  sparkle: "✨",
  security: "🔒",
  ai: "🤖",
  settings: "⚙️",
  performance: "⚡",
  chat: "💬",
  team: "👥",
  billing: "💳",
  analytics: "📊",
  notification: "🔔",
  online: "🟢",
  offline: "🔴",
  away: "🟡",
} as const;

// === UI COMPONENT PRESETS ===
export const ui = {
  // Butonlar
  button: {
    primary: {
      background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
      color: colors.neutral.white,
      fontFamily: fonts.heading,
      fontWeight: fontWeight.bold,
      fontSize: fontSize.base,
      borderRadius: radius.md,
      padding: "10px 20px",
      border: "none",
      boxShadow: shadow.amber,
      cursor: "pointer",
      transition: transition.normal,
    },
    secondary: {
      background: colors.neutral.white,
      color: colors.neutral[800],
      fontFamily: fonts.heading,
      fontWeight: fontWeight.semibold,
      fontSize: fontSize.base,
      borderRadius: radius.md,
      padding: "10px 20px",
      border: `1px solid ${colors.border.default}`,
      boxShadow: shadow.sm,
      cursor: "pointer",
      transition: transition.normal,
    },
    danger: {
      background: colors.status.error,
      color: colors.neutral.white,
      fontFamily: fonts.heading,
      fontWeight: fontWeight.bold,
      fontSize: fontSize.base,
      borderRadius: radius.md,
      padding: "10px 20px",
      border: "none",
      cursor: "pointer",
      transition: transition.normal,
    },
    ghost: {
      background: "transparent",
      color: colors.neutral[600],
      fontFamily: fonts.heading,
      fontWeight: fontWeight.medium,
      fontSize: fontSize.base,
      borderRadius: radius.md,
      padding: "10px 20px",
      border: "none",
      cursor: "pointer",
      transition: transition.normal,
    },
  },

  // Input / Select
  input: {
    default: {
      fontFamily: fonts.body,
      fontSize: fontSize.base,
      color: colors.neutral[900],
      background: colors.neutral.white,
      border: `1px solid ${colors.border.default}`,
      borderRadius: radius.md,
      padding: "10px 14px",
      transition: transition.fast,
      outline: "none",
    },
    focus: {
      borderColor: colors.brand.primary,
      boxShadow: `0 0 0 3px rgba(245, 158, 11, 0.15)`,
    },
    error: {
      borderColor: colors.status.error,
      boxShadow: `0 0 0 3px rgba(220, 38, 38, 0.1)`,
    },
  },

  // Badge
  badge: {
    success: {
      background: colors.status.successLight,
      color: colors.status.success,
      ...presets.badge,
    },
    warning: {
      background: colors.status.warningLight,
      color: colors.status.warning,
      ...presets.badge,
    },
    error: {
      background: colors.status.errorLight,
      color: colors.status.error,
      ...presets.badge,
    },
    info: {
      background: colors.status.infoLight,
      color: colors.status.info,
      ...presets.badge,
    },
    brand: {
      background: colors.brand.light,
      color: colors.brand.tertiary,
      ...presets.badge,
    },
  },

  // Toast / Alert
  toast: {
    success: {
      background: colors.status.successLight,
      borderLeft: `4px solid ${colors.status.success}`,
      color: colors.neutral[800],
      fontFamily: fonts.body,
      borderRadius: radius.md,
      padding: "14px 18px",
    },
    warning: {
      background: colors.status.warningLight,
      borderLeft: `4px solid ${colors.status.warning}`,
      color: colors.neutral[800],
      fontFamily: fonts.body,
      borderRadius: radius.md,
      padding: "14px 18px",
    },
    error: {
      background: colors.status.errorLight,
      borderLeft: `4px solid ${colors.status.error}`,
      color: colors.neutral[800],
      fontFamily: fonts.body,
      borderRadius: radius.md,
      padding: "14px 18px",
    },
    info: {
      background: colors.status.infoLight,
      borderLeft: `4px solid ${colors.status.info}`,
      color: colors.neutral[800],
      fontFamily: fonts.body,
      borderRadius: radius.md,
      padding: "14px 18px",
    },
  },

  // Kart
  card: {
    default: presets.card,
    hover: presets.cardHover,
    flat: {
      background: colors.neutral[50],
      borderRadius: radius.lg,
      border: `1px solid ${colors.border.light}`,
      padding: spacing["2xl"],
    },
    warm: {
      background: colors.brand.ultraLight,
      borderRadius: radius.lg,
      border: `1px solid ${colors.border.warm}`,
      padding: spacing["2xl"],
    },
  },

  // Tablo
  table: {
    headerBg: colors.neutral[50],
    headerText: colors.neutral[600],
    headerFont: fonts.heading,
    headerWeight: fontWeight.semibold,
    headerSize: fontSize.xs,
    rowBorder: `1px solid ${colors.border.light}`,
    cellFont: fonts.body,
    cellSize: fontSize.sm,
    cellColor: colors.neutral[700],
    hoverBg: colors.brand.ultraLight,
  },

  // Divider
  divider: {
    warm: { borderTop: `1px solid ${colors.border.warm}`, margin: `${spacing.xl} 0` },
    default: { borderTop: `1px solid ${colors.border.default}`, margin: `${spacing.lg} 0` },
  },
} as const;
