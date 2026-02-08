/* ═══════════════════════════════════════════════════════════════
 * Widget Theme Presets
 * ═══════════════════════════════════════════════════════════════
 * Frontend-only preset definitions that map to WidgetSettings API fields.
 * Each preset populates primaryColor + visual hints for the preview.
 * Persist uses the existing PUT /portal/widget/settings endpoint.
 * ═══════════════════════════════════════════════════════════════ */

export interface WidgetTheme {
  presetId: string;
  name: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  gradient: { from: string; to: string; angle: number };
  position: "right" | "left";
  launcher: "bubble" | "icon";
  radius: "md" | "lg" | "xl";
  shadow: "sm" | "md" | "lg";
}

export const WIDGET_THEME_PRESETS: WidgetTheme[] = [
  {
    presetId: "midnight-blue",
    name: "Midnight Blue",
    description: "Professional dark blue with clean accents",
    primaryColor: "#1A1A2E",
    accentColor: "#4F8EF7",
    surfaceColor: "#F8FAFC",
    textColor: "#0F172A",
    gradient: { from: "#1A1A2E", to: "#16213E", angle: 135 },
    position: "right",
    launcher: "bubble",
    radius: "xl",
    shadow: "lg",
  },
  {
    presetId: "ocean-teal",
    name: "Ocean Teal",
    description: "Fresh teal gradient, modern feel",
    primaryColor: "#0F766E",
    accentColor: "#2DD4BF",
    surfaceColor: "#F0FDFA",
    textColor: "#134E4A",
    gradient: { from: "#0F766E", to: "#0D9488", angle: 145 },
    position: "right",
    launcher: "bubble",
    radius: "xl",
    shadow: "md",
  },
  {
    presetId: "sunset-orange",
    name: "Sunset Orange",
    description: "Warm orange with bold personality",
    primaryColor: "#EA580C",
    accentColor: "#FB923C",
    surfaceColor: "#FFF7ED",
    textColor: "#431407",
    gradient: { from: "#EA580C", to: "#DC2626", angle: 120 },
    position: "right",
    launcher: "bubble",
    radius: "lg",
    shadow: "lg",
  },
  {
    presetId: "royal-purple",
    name: "Royal Purple",
    description: "Elegant purple with depth",
    primaryColor: "#7C3AED",
    accentColor: "#A78BFA",
    surfaceColor: "#FAF5FF",
    textColor: "#3B0764",
    gradient: { from: "#7C3AED", to: "#6D28D9", angle: 150 },
    position: "right",
    launcher: "bubble",
    radius: "xl",
    shadow: "md",
  },
  {
    presetId: "charcoal-cream",
    name: "Charcoal & Cream",
    description: "Sophisticated dark with warm accents",
    primaryColor: "#1C1917",
    accentColor: "#D4A574",
    surfaceColor: "#FEFCE8",
    textColor: "#1C1917",
    gradient: { from: "#1C1917", to: "#292524", angle: 135 },
    position: "right",
    launcher: "bubble",
    radius: "lg",
    shadow: "lg",
  },
  {
    presetId: "emerald-forest",
    name: "Emerald Forest",
    description: "Natural green with trust-building tone",
    primaryColor: "#065F46",
    accentColor: "#34D399",
    surfaceColor: "#ECFDF5",
    textColor: "#064E3B",
    gradient: { from: "#065F46", to: "#047857", angle: 140 },
    position: "right",
    launcher: "bubble",
    radius: "xl",
    shadow: "md",
  },
];

export const DEFAULT_PRESET = WIDGET_THEME_PRESETS[0];

export function getPresetById(id: string): WidgetTheme | undefined {
  return WIDGET_THEME_PRESETS.find((p) => p.presetId === id);
}

/** Map API settings to closest preset (by primaryColor match) */
export function findPresetByColor(hex: string): WidgetTheme | undefined {
  return WIDGET_THEME_PRESETS.find(
    (p) => p.primaryColor.toLowerCase() === hex.toLowerCase()
  );
}

/* ═══════════════════════════════════════════════════════════════
 * Premium Curated Color Palettes — harmonized multi-color schemes
 * ═══════════════════════════════════════════════════════════════ */

export interface PremiumPalette {
  id: string;
  colors: [string, string, string, string, string]; // 5 harmonized colors
  gradient: { from: string; to: string; angle: number };
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
}

export const PREMIUM_PALETTES: PremiumPalette[] = [
  {
    id: "aurora",
    colors: ["#0f172a", "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"],
    gradient: { from: "#6366f1", to: "#8b5cf6", angle: 135 },
    primaryColor: "#6366f1",
    accentColor: "#a78bfa",
    surfaceColor: "#f5f3ff",
  },
  {
    id: "coral-reef",
    colors: ["#881337", "#e11d48", "#f43f5e", "#fb7185", "#fda4af"],
    gradient: { from: "#e11d48", to: "#f43f5e", angle: 140 },
    primaryColor: "#e11d48",
    accentColor: "#fb7185",
    surfaceColor: "#fff1f2",
  },
  {
    id: "northern-lights",
    colors: ["#064e3b", "#059669", "#10b981", "#34d399", "#6ee7b7"],
    gradient: { from: "#059669", to: "#10b981", angle: 150 },
    primaryColor: "#059669",
    accentColor: "#34d399",
    surfaceColor: "#ecfdf5",
  },
  {
    id: "sapphire",
    colors: ["#1e3a5f", "#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd"],
    gradient: { from: "#1d4ed8", to: "#3b82f6", angle: 135 },
    primaryColor: "#1d4ed8",
    accentColor: "#60a5fa",
    surfaceColor: "#eff6ff",
  },
  {
    id: "golden-hour",
    colors: ["#78350f", "#b45309", "#d97706", "#f59e0b", "#fbbf24"],
    gradient: { from: "#b45309", to: "#d97706", angle: 130 },
    primaryColor: "#b45309",
    accentColor: "#f59e0b",
    surfaceColor: "#fffbeb",
  },
  {
    id: "cyber-rose",
    colors: ["#4a044e", "#a21caf", "#d946ef", "#e879f9", "#f0abfc"],
    gradient: { from: "#a21caf", to: "#d946ef", angle: 145 },
    primaryColor: "#a21caf",
    accentColor: "#e879f9",
    surfaceColor: "#fdf4ff",
  },
  {
    id: "midnight-ember",
    colors: ["#18181b", "#dc2626", "#ef4444", "#f87171", "#fca5a5"],
    gradient: { from: "#18181b", to: "#dc2626", angle: 160 },
    primaryColor: "#18181b",
    accentColor: "#ef4444",
    surfaceColor: "#fef2f2",
  },
  {
    id: "ocean-breeze",
    colors: ["#164e63", "#0891b2", "#06b6d4", "#22d3ee", "#67e8f9"],
    gradient: { from: "#0891b2", to: "#06b6d4", angle: 135 },
    primaryColor: "#0891b2",
    accentColor: "#22d3ee",
    surfaceColor: "#ecfeff",
  },
];
