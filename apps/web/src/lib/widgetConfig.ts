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

export interface WidgetStarterItem {
  id: number;
  text: string;
  active: boolean;
}

export interface WidgetHourItem {
  day: string;
  on: boolean;
  start: string;
  end: string;
}

export interface WidgetPageRuleItem {
  id: number;
  url: string;
  action: string;
}

export interface WidgetConfig {
  size: WidgetSizeConfig;
  avatars: WidgetAvatarsConfig;
  branding: WidgetBrandingConfig;
  launcher: WidgetLauncherConfig;
  // v3 content fields
  headerText?: string;
  subText?: string;
  welcomeMsg?: string;
  offlineMsg?: string;
  launcherLabel?: string;
  starters?: WidgetStarterItem[];
  // v3 avatars
  botAvatar?: string;
  agentAvatar?: string;
  agentImageUrl?: string | null;
  // v3 background
  bgPatternId?: string;
  // v3 attention grabber
  attGrabberId?: string;
  attGrabberText?: string;
  attGrabberDelay?: number;
  // v3 working hours
  hoursEnabled?: boolean;
  timezone?: string;
  hours?: WidgetHourItem[];
  // v3 general toggles
  showOnMobile?: boolean;
  showOffline?: boolean;
  soundEnabled?: boolean;
  autoOpen?: boolean;
  showUnread?: boolean;
  preChatEnabled?: boolean;
  typingIndicator?: boolean;
  fileUpload?: boolean;
  emojiPicker?: boolean;
  readReceipts?: boolean;
  responseTime?: boolean;
  transcriptEmail?: boolean;
  visitorNotes?: boolean;
  // v3 AI settings
  aiName?: string;
  aiTone?: string;
  aiLength?: string;
  aiEmoji?: boolean;
  aiLabel?: boolean;
  aiWelcome?: string;
  aiModel?: string;
  aiSuggestions?: boolean;
  // v3 PRO features
  csat?: boolean;
  whiteLabel?: boolean;
  autoReply?: boolean;
  autoReplyMsg?: string;
  customCss?: string;
  consentEnabled?: boolean;
  consentText?: string;
  // v3 page rules
  pageRules?: WidgetPageRuleItem[];
}

export type WidgetConfigPatch = {
  size?: Partial<WidgetSizeConfig>;
  avatars?: Partial<WidgetAvatarsConfig>;
  branding?: Partial<WidgetBrandingConfig>;
  launcher?: Partial<WidgetLauncherConfig>;
  headerText?: string;
  subText?: string;
  welcomeMsg?: string;
  offlineMsg?: string;
  launcherLabel?: string;
  starters?: WidgetStarterItem[];
  botAvatar?: string;
  agentAvatar?: string;
  agentImageUrl?: string | null;
  bgPatternId?: string;
  attGrabberId?: string;
  attGrabberText?: string;
  attGrabberDelay?: number;
  hoursEnabled?: boolean;
  timezone?: string;
  hours?: WidgetHourItem[];
  showOnMobile?: boolean;
  showOffline?: boolean;
  soundEnabled?: boolean;
  autoOpen?: boolean;
  showUnread?: boolean;
  preChatEnabled?: boolean;
  typingIndicator?: boolean;
  fileUpload?: boolean;
  emojiPicker?: boolean;
  readReceipts?: boolean;
  responseTime?: boolean;
  transcriptEmail?: boolean;
  visitorNotes?: boolean;
  aiName?: string;
  aiTone?: string;
  aiLength?: string;
  aiEmoji?: boolean;
  aiLabel?: boolean;
  aiWelcome?: string;
  aiModel?: string;
  aiSuggestions?: boolean;
  csat?: boolean;
  whiteLabel?: boolean;
  autoReply?: boolean;
  autoReplyMsg?: string;
  customCss?: string;
  consentEnabled?: boolean;
  consentText?: string;
  pageRules?: WidgetPageRuleItem[];
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
  // v3 fields
  headerText: "Nasil yardimci olabiliriz?",
  subText: "Genellikle birkac dakika icinde yanit veriyoruz",
  welcomeMsg: "Merhaba! 👋 Size nasil yardimci olabilirim?",
  offlineMsg: "Su an cevrimdisiyiz. Mesajinizi birakin, en kisa surede donus yapacagiz.",
  launcherLabel: "Bize yazin",
  starters: [
    { id: 1, text: "💰 Fiyatlandirma hakkinda bilgi", active: true },
    { id: 2, text: "🚀 Demo talep et", active: true },
    { id: 3, text: "🔧 Teknik destek", active: true },
  ],
  botAvatar: "🤖",
  agentAvatar: "👩‍💼",
  agentImageUrl: null,
  bgPatternId: "none",
  attGrabberId: "none",
  attGrabberText: "Merhaba! Yardima ihtiyaciniz var mi? 👋",
  attGrabberDelay: 5,
  hoursEnabled: true,
  timezone: "Europe/Istanbul",
  hours: ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"].map((d, i) => ({
    day: d,
    on: i < 5,
    start: "09:00",
    end: "18:00",
  })),
  showOnMobile: true,
  showOffline: true,
  soundEnabled: true,
  autoOpen: false,
  showUnread: true,
  preChatEnabled: true,
  typingIndicator: true,
  fileUpload: true,
  emojiPicker: true,
  readReceipts: true,
  responseTime: true,
  transcriptEmail: false,
  visitorNotes: true,
  aiName: "Helvion AI",
  aiTone: "friendly",
  aiLength: "standard",
  aiEmoji: true,
  aiLabel: true,
  aiWelcome: "Merhaba! Ben Helvion AI asistaniniz 🤖 Size nasil yardimci olabilirim?",
  aiModel: "auto",
  aiSuggestions: true,
  csat: false,
  whiteLabel: false,
  autoReply: false,
  autoReplyMsg: "Mesajiniz alindi! En kisa surede donus yapacagiz.",
  customCss: "",
  consentEnabled: false,
  consentText: "Sohbet baslayarak gizlilik politikamizi kabul edersiniz.",
  pageRules: [{ id: 1, url: "/pricing", action: "show" }],
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
    headerText: partial.headerText ?? def.headerText,
    subText: partial.subText ?? def.subText,
    welcomeMsg: partial.welcomeMsg ?? def.welcomeMsg,
    offlineMsg: partial.offlineMsg ?? def.offlineMsg,
    launcherLabel: partial.launcherLabel ?? def.launcherLabel,
    starters: partial.starters ?? def.starters,
    botAvatar: partial.botAvatar ?? def.botAvatar,
    agentAvatar: partial.agentAvatar ?? def.agentAvatar,
    agentImageUrl: partial.agentImageUrl ?? def.agentImageUrl,
    bgPatternId: partial.bgPatternId ?? def.bgPatternId,
    attGrabberId: partial.attGrabberId ?? def.attGrabberId,
    attGrabberText: partial.attGrabberText ?? def.attGrabberText,
    attGrabberDelay: partial.attGrabberDelay ?? def.attGrabberDelay,
    hoursEnabled: partial.hoursEnabled ?? def.hoursEnabled,
    timezone: partial.timezone ?? def.timezone,
    hours: partial.hours ?? def.hours,
    showOnMobile: partial.showOnMobile ?? def.showOnMobile,
    showOffline: partial.showOffline ?? def.showOffline,
    soundEnabled: partial.soundEnabled ?? def.soundEnabled,
    autoOpen: partial.autoOpen ?? def.autoOpen,
    showUnread: partial.showUnread ?? def.showUnread,
    preChatEnabled: partial.preChatEnabled ?? def.preChatEnabled,
    typingIndicator: partial.typingIndicator ?? def.typingIndicator,
    fileUpload: partial.fileUpload ?? def.fileUpload,
    emojiPicker: partial.emojiPicker ?? def.emojiPicker,
    readReceipts: partial.readReceipts ?? def.readReceipts,
    responseTime: partial.responseTime ?? def.responseTime,
    transcriptEmail: partial.transcriptEmail ?? def.transcriptEmail,
    visitorNotes: partial.visitorNotes ?? def.visitorNotes,
    aiName: partial.aiName ?? def.aiName,
    aiTone: partial.aiTone ?? def.aiTone,
    aiLength: partial.aiLength ?? def.aiLength,
    aiEmoji: partial.aiEmoji ?? def.aiEmoji,
    aiLabel: partial.aiLabel ?? def.aiLabel,
    aiWelcome: partial.aiWelcome ?? def.aiWelcome,
    aiModel: partial.aiModel ?? def.aiModel,
    aiSuggestions: partial.aiSuggestions ?? def.aiSuggestions,
    csat: partial.csat ?? def.csat,
    whiteLabel: partial.whiteLabel ?? def.whiteLabel,
    autoReply: partial.autoReply ?? def.autoReply,
    autoReplyMsg: partial.autoReplyMsg ?? def.autoReplyMsg,
    customCss: partial.customCss ?? def.customCss,
    consentEnabled: partial.consentEnabled ?? def.consentEnabled,
    consentText: partial.consentText ?? def.consentText,
    pageRules: partial.pageRules ?? def.pageRules,
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
