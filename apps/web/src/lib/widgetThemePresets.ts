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
