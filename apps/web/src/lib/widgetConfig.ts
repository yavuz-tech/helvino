/**
 * Widget config: size, avatars, branding, launcher (frontend-only).
 * Persisted in localStorage. No API change.
 */

export type WidthPreset = "compact" | "default" | "large";
export type HeightPreset = "auto" | "short" | "default";
export type DensityPreset = "compact" | "comfortable";
export type AvatarShape = "circle" | "rounded";
export type AvatarSizePreset = "sm" | "md";

export type AssetValue =
  | { kind: "none" }
  | { kind: "initials"; value: string }
  | { kind: "preset"; value: string }
  | { kind: "url"; value: string }
  | { kind: "uploadData"; value: string };

export interface WidgetSizeConfig {
  widthPreset: WidthPreset;
  customWidth: number;
  heightPreset: HeightPreset;
  customMaxHeight: number;
  density: DensityPreset;
}

export interface WidgetAgentEntry {
  id: string;
  name?: string;
  asset: AssetValue;
}

export interface WidgetAvatarsConfig {
  botEnabled: boolean;
  botAsset: AssetValue;
  agents: WidgetAgentEntry[];
  avatarShape: AvatarShape;
  avatarSize: AvatarSizePreset;
}

export interface WidgetBrandingConfig {
  brandEnabled: boolean;
  brandAsset: AssetValue;
}

export type LauncherStyle = "bubble" | "button";
export type LauncherSizePreset = "sm" | "md" | "lg";
export type UnreadBadgeMode = "off" | "dot" | "count";

export interface WidgetLauncherConfig {
  launcherStyle: LauncherStyle;
  launcherSize: LauncherSizePreset;
  launcherLabel: string;
  unreadBadge: UnreadBadgeMode;
}

export interface WidgetConfig {
  size: WidgetSizeConfig;
  avatars: WidgetAvatarsConfig;
  branding: WidgetBrandingConfig;
  launcher: WidgetLauncherConfig;
}

export type WidgetConfigPatch = {
  size?: Partial<WidgetSizeConfig>;
  avatars?: Partial<WidgetAvatarsConfig>;
  branding?: Partial<WidgetBrandingConfig>;
  launcher?: Partial<WidgetLauncherConfig>;
};

/* ── Constants ── */

const WIDTH_PRESET_PX: Record<WidthPreset, number> = {
  compact: 320,
  default: 380,
  large: 440,
};

const HEIGHT_PRESET_PX: Record<HeightPreset, number> = {
  auto: 560,
  short: 420,
  default: 720,
};

const DEFAULT_AGENT_IDS = ["agent-1", "agent-2", "agent-3"] as const;

function defaultAsset(): AssetValue {
  return { kind: "initials", value: "" };
}

function defaultAgents(): WidgetAgentEntry[] {
  return DEFAULT_AGENT_IDS.map((id) => ({ id, asset: defaultAsset() }));
}

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  size: {
    widthPreset: "default",
    customWidth: WIDTH_PRESET_PX.default,
    heightPreset: "auto",
    customMaxHeight: HEIGHT_PRESET_PX.auto,
    density: "comfortable",
  },
  avatars: {
    botEnabled: false,
    botAsset: defaultAsset(),
    agents: defaultAgents(),
    avatarShape: "circle",
    avatarSize: "md",
  },
  branding: {
    brandEnabled: false,
    brandAsset: defaultAsset(),
  },
  launcher: {
    launcherStyle: "bubble",
    launcherSize: "md",
    launcherLabel: "",
    unreadBadge: "count",
  },
};

/* ── Preset helpers ── */

export function getWidthFromPreset(p: WidthPreset): number {
  return WIDTH_PRESET_PX[p] ?? WIDTH_PRESET_PX.default;
}

export function getMaxHeightFromPreset(p: HeightPreset): number {
  return HEIGHT_PRESET_PX[p] ?? HEIGHT_PRESET_PX.default;
}

/* ── localStorage persistence ── */

const WIDGET_CONFIG_KEY = "helvino-widget-config";
const UPLOAD_DATA_MAX_BYTES = 120 * 1024;

export function getUploadDataMaxBytes(): number {
  return UPLOAD_DATA_MAX_BYTES;
}

function normalizeAsset(a: unknown): AssetValue {
  if (a && typeof a === "object" && "kind" in a) {
    const k = (a as { kind: string }).kind;
    const v = (a as { value?: string }).value;
    if (k === "none") return { kind: "none" };
    if (k === "initials" && typeof v === "string") return { kind: "initials", value: v };
    if (k === "preset" && typeof v === "string") return { kind: "preset", value: v };
    if (k === "url" && typeof v === "string") return { kind: "url", value: v };
    if (k === "uploadData" && typeof v === "string") return { kind: "uploadData", value: v };
  }
  return defaultAsset();
}

function mergeWithDefaults(partial: Partial<WidgetConfig>): WidgetConfig {
  const def = DEFAULT_WIDGET_CONFIG;
  const a = partial.avatars;
  const b = partial.branding;

  let agents: WidgetAgentEntry[] = defaultAgents();
  if (a?.agents && Array.isArray(a.agents) && a.agents.length > 0) {
    agents = a.agents
      .slice(0, 3)
      .map((entry: WidgetAgentEntry, i: number) => ({
        id: entry?.id ?? DEFAULT_AGENT_IDS[i],
        name: entry?.name,
        asset: normalizeAsset(entry?.asset),
      }));
    while (agents.length < 3) {
      agents.push({ id: DEFAULT_AGENT_IDS[agents.length], asset: defaultAsset() });
    }
  }

  return {
    size: { ...def.size, ...partial.size },
    avatars: {
      botEnabled: a?.botEnabled ?? def.avatars.botEnabled,
      botAsset: normalizeAsset(a?.botAsset ?? def.avatars.botAsset),
      agents,
      avatarShape: a?.avatarShape ?? def.avatars.avatarShape,
      avatarSize: a?.avatarSize ?? def.avatars.avatarSize,
    },
    branding: {
      brandEnabled: b?.brandEnabled ?? def.branding.brandEnabled,
      brandAsset: normalizeAsset(b?.brandAsset ?? def.branding.brandAsset),
    },
    launcher: { ...def.launcher, ...partial.launcher },
  };
}

export function loadWidgetConfig(): WidgetConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WIDGET_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WidgetConfig>;
    return mergeWithDefaults(parsed);
  } catch {
    return null;
  }
}

export function saveWidgetConfig(config: WidgetConfig): void {
  try {
    localStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // storage full or unavailable
  }
}
