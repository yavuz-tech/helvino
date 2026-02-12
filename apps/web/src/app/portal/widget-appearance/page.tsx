"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useRouter, useSearchParams } from "next/navigation";
// v3-deprecated: import WidgetGallery from "@/components/widget/WidgetGallery";
import WidgetPreviewRenderer from "@/components/widget/WidgetPreviewRenderer";
// v3-deprecated: import AvatarSelector from "@/components/widget/AvatarSelector";
// v3-deprecated: import { PREMIUM_PALETTES } from "@/lib/widgetThemePresets";
import {
  WIDGET_THEME_PRESETS,
  DEFAULT_PRESET,
  findPresetByColor,
  type WidgetTheme,
  type PremiumPalette,
} from "@/lib/widgetThemePresets";
import {
  DEFAULT_WIDGET_CONFIG,
  loadWidgetConfig,
  saveWidgetConfig,
  getWidthFromPreset,
  getMaxHeightFromPreset,
  type WidgetConfig,
  type WidgetConfigPatch,
  type WidthPreset,
  type HeightPreset,
} from "@/lib/widgetConfig";
import { resolveWidgetBubbleTheme } from "@helvino/shared";
import { colors, fonts } from "@/lib/design-tokens";
import { sanitizePlainText } from "@/utils/sanitize";
import { MiniWidget, resolveThemeId, THEME_SHOWCASE } from "./theme-showcase";
import { ColorRow, OptionBtn } from "./form-controls";
import {
  THEMES,
  LAUNCHERS,
  POSITIONS,
  PREVIEW_STATES,
  SIZES,
  BACKGROUNDS,
  ATTENTION_GRABBERS,
  DAYS_TR,
  AI_TONES,
  AI_LENGTHS,
  AI_MODELS,
} from "./constants";
import { hexToRgb as hexToRgbHelper, getStyleSystem, computeThemeColors } from "./helpers";

/** Helper: resolve avatar src from an AssetValue */
function resolveAvatarSrc(asset: { kind: string; value?: string }): string | null {
  if (asset.kind === "url" && asset.value) return asset.value;
  if (asset.kind === "uploadData" && asset.value) return asset.value;
  return null;
}

/** Helper: convert hex color to RGB string for rgba() usage */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  bubbleShape: "circle" | "rounded-square";
  bubbleIcon: "chat" | "message" | "help" | "custom";
  bubbleSize: number;
  bubblePosition: "bottom-right" | "bottom-left";
  greetingText: string;
  greetingEnabled: boolean;
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
}

type SubscriptionPlan = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";

/**
 * Local-only theme overrides persisted to localStorage.
 * primaryColor/position/launcher go to the API; the rest is frontend visual.
 */
interface LocalThemeOverrides {
  presetId: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
}

const LOCAL_THEME_KEY = "helvino-widget-theme-overrides";

function loadLocalTheme(): LocalThemeOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_THEME_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalThemeOverrides;
  } catch {
    return null;
  }
}

function saveLocalTheme(data: LocalThemeOverrides): void {
  try {
    localStorage.setItem(LOCAL_THEME_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — silently skip
  }
}

function SectionHeader({
  icon,
  title,
  count,
  badge,
  isOpen,
  onToggle,
  isNew,
}: {
  icon: string;
  title: string;
  count: number;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  isNew?: boolean;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 20px",
        cursor: "pointer",
        userSelect: "none",
        background: isOpen ? "linear-gradient(135deg,#FFFBF0,#FEF3E2)" : "transparent",
        borderBottom: isOpen ? "1px solid #F3E8D8" : "1px solid transparent",
        transition: "all 0.3s ease",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isOpen ? "linear-gradient(135deg,#F59E0B,#D97706)" : "#F8F4EF",
          fontSize: 16,
          transition: "all 0.35s ease",
          boxShadow: isOpen ? "0 4px 12px rgba(245,158,11,0.25)" : "none",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "'Satoshi',sans-serif",
            fontWeight: 700,
            fontSize: 13.5,
            color: isOpen ? "#92400E" : "#1A1D23",
            transition: "color 0.3s",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {title}
          {isNew && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: "linear-gradient(135deg,#10B981,#059669)",
                color: "#FFF",
                animation: "pulse 2s infinite",
              }}
            >
              YENI
            </span>
          )}
        </div>
      </div>
      {badge && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 4,
            background:
              badge === "AI"
                ? "linear-gradient(135deg,#0EA5E9,#6366F1)"
                : "linear-gradient(135deg,#8B5CF6,#7C3AED)",
            color: "#FFF",
          }}
        >
          {badge}
        </span>
      )}
      <span
        style={{
          fontFamily: "'Manrope',sans-serif",
          fontSize: 10,
          color: "#94A3B8",
          background: "#F8F4EF",
          padding: "3px 8px",
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        {count}
      </span>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#94A3B8"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: "transform 0.3s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  desc,
  pro,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  desc?: string;
  pro?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 0",
        borderBottom: "1px solid #F3EDE4",
        opacity: disabled ? 0.45 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div style={{ flex: 1, marginRight: 16 }}>
        <div
          style={{
            fontFamily: "'Satoshi',sans-serif",
            fontSize: 13.5,
            fontWeight: 700,
            color: "#1A1D23",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          {label}
          {pro && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 5,
                background: "linear-gradient(135deg,#8B5CF6,#7C3AED)",
                color: "#FFF",
              }}
            >
              PRO
            </span>
          )}
        </div>
        {desc && (
          <div
            style={{
              fontFamily: "'Manrope',sans-serif",
              fontSize: 11.5,
              color: "#94A3B8",
              marginTop: 3,
            }}
          >
            {desc}
          </div>
        )}
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 56,
          minWidth: 56,
          height: 30,
          minHeight: 30,
          borderRadius: 15,
          cursor: "pointer",
          background: checked ? "linear-gradient(135deg,#F59E0B,#D97706)" : "#C9CDD4",
          transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: checked
            ? "0 4px 14px rgba(245,158,11,0.4), inset 0 1px 1px rgba(255,255,255,0.15)"
            : "inset 0 2px 4px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.04)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: "#FFF",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(0,0,0,0.04)",
            position: "absolute",
            top: 3,
            left: checked ? 29 : 3,
            transition: "left 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}

function PortalWidgetAppearanceContent() {
  void fonts;
  void SectionHeader;
  void Toggle;
  void THEMES;
  void LAUNCHERS;
  void POSITIONS;
  void PREVIEW_STATES;
  void SIZES;
  void BACKGROUNDS;
  void ATTENTION_GRABBERS;
  void DAYS_TR;
  void AI_TONES;
  void AI_LENGTHS;
  void AI_MODELS;
  void hexToRgbHelper;
  void getStyleSystem;
  void computeThemeColors;
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showDebugGallery =
    process.env.NODE_ENV === "development" && searchParams.get("debug") === "1";

  const [settings, setSettings] = useState<WidgetSettings>({
    primaryColor: DEFAULT_PRESET.primaryColor,
    position: "right",
    launcher: "bubble",
    bubbleShape: "circle",
    bubbleIcon: "chat",
    bubbleSize: 60,
    bubblePosition: "bottom-right",
    greetingText: "",
    greetingEnabled: false,
    welcomeTitle: "Welcome",
    welcomeMessage: "How can we help you today?",
    brandName: null,
  });
  const [localTheme, setLocalTheme] = useState<LocalThemeOverrides>({
    presetId: DEFAULT_PRESET.presetId,
    accentColor: DEFAULT_PRESET.accentColor,
    surfaceColor: DEFAULT_PRESET.surfaceColor,
    textColor: DEFAULT_PRESET.textColor,
    gradientFrom: DEFAULT_PRESET.gradient.from,
    gradientTo: DEFAULT_PRESET.gradient.to,
    gradientAngle: DEFAULT_PRESET.gradient.angle,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeNotice, setUpgradeNotice] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showPremiumPalettes, setShowPremiumPalettes] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showAvatarLauncher, setShowAvatarLauncher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [premiumPreviewId, setPremiumPreviewId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [openSection, setOpenSection] = useState<number | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [manualHasChanges, setManualHasChanges] = useState(false);

  // =============================================
  // v3 States — Content & Messages
  // =============================================
  const [headerText, setHeaderText] = useState("Nasıl yardımcı olabiliriz?");
  const [subText, setSubText] = useState("Genellikle birkaç dakika içinde yanıt veriyoruz");
  const [welcomeMsg, setWelcomeMsg] = useState("Merhaba! 👋 Size nasıl yardımcı olabilirim?");
  const [offlineMsg, setOfflineMsg] = useState(
    "Şu an çevrimdışıyız. Mesajınızı bırakın, en kısa sürede dönüş yapacağız."
  );
  const [launcherLabel, setLauncherLabel] = useState("Bize yazın");

  type ThemeItem = (typeof THEMES)[number];
  type LauncherItem = (typeof LAUNCHERS)[number];
  type PositionItem = (typeof POSITIONS)[number];
  type PreviewStateItem = (typeof PREVIEW_STATES)[number];
  type SizeItem = (typeof SIZES)[number];
  type BackgroundItem = (typeof BACKGROUNDS)[number];
  type AttentionItem = (typeof ATTENTION_GRABBERS)[number];

  // =============================================
  // v3 States — Theme & Customization
  // =============================================
  const [theme, setTheme] = useState<ThemeItem>(THEMES[0]);
  const [customColor, setCustomColor] = useState("#F59E0B");
  const [useCustom, setUseCustom] = useState(false);

  // =============================================
  // v3 States — Launcher
  // =============================================
  const [launcher, setLauncher] = useState<LauncherItem>(LAUNCHERS[0]);
  const [position, setPosition] = useState<PositionItem>(POSITIONS[0]);
  const [widgetSize, setWidgetSize] = useState<SizeItem>(SIZES[1]);
  const [previewState, setPreviewState] = useState<PreviewStateItem>(PREVIEW_STATES[1]);

  // =============================================
  // v3 States — Conversation Starters
  // =============================================
  const [starters, setStarters] = useState([
    { id: 1, text: "💰 Fiyatlandırma hakkında bilgi", active: true },
    { id: 2, text: "🚀 Demo talep et", active: true },
    { id: 3, text: "🔧 Teknik destek", active: true },
  ]);
  const [newStarter, setNewStarter] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // =============================================
  // v3 States — Avatars
  // =============================================
  const [botAvatar, setBotAvatar] = useState("🤖");
  const [agentAvatar, setAgentAvatar] = useState("👩‍💼");
  const [agentImage, setAgentImage] = useState<File | null>(null);
  const [agentImagePreview, setAgentImagePreview] = useState<string | null>(null);

  // =============================================
  // v3 States — Background & Attention
  // =============================================
  const [bgPattern, setBgPattern] = useState<BackgroundItem>(BACKGROUNDS[0]);
  const [attGrabber, setAttGrabber] = useState<AttentionItem>(ATTENTION_GRABBERS[0]);
  const [attGrabberText, setAttGrabberText] = useState("Merhaba! Yardıma ihtiyacınız var mı? 👋");
  const [attGrabberDelay, setAttGrabberDelay] = useState(5);

  // =============================================
  // v3 States — Working Hours
  // =============================================
  const [hoursEnabled, setHoursEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [hours, setHours] = useState(
    DAYS_TR.map((d, i) => ({ day: d, on: i < 5, start: "09:00", end: "18:00" }))
  );

  // =============================================
  // v3 States — General Toggles
  // =============================================
  const [showBranding, setShowBranding] = useState(true);
  const [showOnMobile, setShowOnMobile] = useState(true);
  const [showOffline, setShowOffline] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoOpen, setAutoOpen] = useState(false);
  const [showUnread, setShowUnread] = useState(true);
  const [preChatEnabled, setPreChatEnabled] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [fileUpload, setFileUpload] = useState(true);
  const [emojiPicker, setEmojiPicker] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [responseTime, setResponseTime] = useState(true);
  const [transcriptEmail, setTranscriptEmail] = useState(false);
  const [visitorNotes, setVisitorNotes] = useState(true);

  // =============================================
  // v3 States — AI Settings
  // =============================================
  const [aiName, setAiName] = useState("Helvion AI");
  const [aiTone, setAiTone] = useState("friendly");
  const [aiLength, setAiLength] = useState("standard");
  const [aiEmoji, setAiEmoji] = useState(true);
  const [aiLabel, setAiLabel] = useState(true);
  const [aiWelcome, setAiWelcome] = useState(
    "Merhaba! Ben Helvion AI asistanınız 🤖 Size nasıl yardımcı olabilirim?"
  );
  const [aiModel, setAiModel] = useState("auto");
  const [aiSuggestions, setAiSuggestions] = useState(true);

  // =============================================
  // v3 States — PRO Features
  // =============================================
  const [csat, setCsat] = useState(false);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [autoReplyMsg, setAutoReplyMsg] = useState("Mesajınız alındı! En kısa sürede dönüş yapacağız.");
  const [customCss, setCustomCss] = useState("");
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [consentText, setConsentText] = useState("Sohbet başlayarak gizlilik politikamızı kabul edersiniz.");

  // =============================================
  // v3 States — Page Rules & Embed
  // =============================================
  const [pageRules, setPageRules] = useState([{ id: 1, url: "/pricing", action: "show" }]);
  const [newPageUrl, setNewPageUrl] = useState("");
  const [newPageAction, setNewPageAction] = useState("show");
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // =============================================
  // v3 States — Logo Upload
  // =============================================
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Color picker refs
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const gradientFromRef = useRef<HTMLInputElement>(null);
  const gradientToRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const agentImgRef = useRef<HTMLInputElement>(null);

  // Toggle accordion sections
  const toggleSection = (sectionIndex: number) => {
    setOpenSection(prev => prev === sectionIndex ? null : sectionIndex);
  };
  const tog = (i: number) => setOpenSection(openSection === i ? -1 : i);
  void tog;

  // Accordion: only one panel open at a time
  type Panel = "customize" | "premiumPalettes" | "avatarLauncher" | "size" | "settings";
  const togglePanel = (panel: Panel) => {
    setShowCustomize(panel === "customize" ? (p) => !p : false);
    setShowPremiumPalettes(panel === "premiumPalettes" ? (p) => !p : false);
    setShowAvatarLauncher(panel === "avatarLauncher" ? (p) => !p : false);
    setShowSizeMenu(panel === "size" ? (p) => !p : false);
    setShowSettings(panel === "settings" ? (p) => !p : false);
    // If closing premium palettes and there's a preview active, revert it
    if (panel !== "premiumPalettes" && premiumPreviewId) {
      revertPremiumPreview();
    }
  };

  // Store original colors before premium preview so we can revert
  const premiumPreviewBackup = useRef<{
    primaryColor: string;
    accentColor: string;
    surfaceColor: string;
    gradientFrom: string;
    gradientTo: string;
    gradientAngle: number;
  } | null>(null);

  const applyPremiumPreview = (palette: PremiumPalette) => {
    // Save backup on first preview
    if (!premiumPreviewBackup.current) {
      premiumPreviewBackup.current = {
        primaryColor: settings.primaryColor,
        accentColor: localTheme.accentColor,
        surfaceColor: localTheme.surfaceColor,
        gradientFrom: localTheme.gradientFrom,
        gradientTo: localTheme.gradientTo,
        gradientAngle: localTheme.gradientAngle,
      };
    }
    setPremiumPreviewId(palette.id);
    setSettings((s) => ({ ...s, primaryColor: palette.primaryColor }));
    updateLocal({
      accentColor: palette.accentColor,
      surfaceColor: palette.surfaceColor,
      gradientFrom: palette.gradient.from,
      gradientTo: palette.gradient.to,
      gradientAngle: palette.gradient.angle,
    });
  };

  const revertPremiumPreview = () => {
    if (premiumPreviewBackup.current) {
      const b = premiumPreviewBackup.current;
      setSettings((s) => ({ ...s, primaryColor: b.primaryColor }));
      updateLocal({
        accentColor: b.accentColor,
        surfaceColor: b.surfaceColor,
        gradientFrom: b.gradientFrom,
        gradientTo: b.gradientTo,
        gradientAngle: b.gradientAngle,
      });
      premiumPreviewBackup.current = null;
    }
    setPremiumPreviewId(null);
  };
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(
    () => loadWidgetConfig() ?? DEFAULT_WIDGET_CONFIG
  );

  // Plan entitlements from API
  const [planKey, setPlanKey] = useState<string>("free");
  const [brandingRequired, setBrandingRequired] = useState(true);
  const [domainMismatchCount, setDomainMismatchCount] = useState(0);

  // =============================================
  // v3 Computed — Theme Colors
  // =============================================
  const ac = useCustom ? customColor : theme.color;
  const ad = useCustom ? customColor : theme.dark;
  const al = useCustom ? customColor + "15" : theme.light;
  const ag = useCustom
    ? `linear-gradient(135deg,${customColor},${customColor})`
    : (("gradient" in theme && theme.gradient) || `linear-gradient(135deg,${theme.color},${theme.dark})`);
  const acRgb = hexToRgbHelper(ac);
  const adRgb = hexToRgbHelper(ad);

  // =============================================
  // v3 Computed — Style System
  // =============================================
  const s = getStyleSystem();

  // =============================================
  // v3 Computed — Embed Code & Direct Link
  // =============================================
  const projectId = (settings as WidgetSettings & { projectId?: string })?.projectId || "YOUR_PROJECT_ID";
  const embedCode = `<script src="https://cdn.helvion.io/widget.js" data-project="${projectId}"></script>`;
  const directChatLink = `https://chat.helvion.io/${projectId}`;

  void ac;
  void ad;
  void al;
  void ag;
  void acRgb;
  void adRgb;
  void s;
  void projectId;
  void embedCode;
  void directChatLink;
  void launcher;
  void previewState;
  void botAvatar;
  void agentAvatar;
  void agentImage;
  void bgPattern;
  void attGrabber;
  void logoFile;
  void showEmbed;

  const canEdit = user?.role === "owner" || user?.role === "admin";
  const isFree = planKey === "free";
  const isPro = planKey === "pro" || planKey === "business" || planKey === "enterprise";

  const updateWidgetConfig = (patch: WidgetConfigPatch) => {
    const updated: WidgetConfig = {
      size: { ...widgetConfig.size, ...patch.size },
      avatars: { ...widgetConfig.avatars, ...patch.avatars },
      branding: { ...widgetConfig.branding, ...patch.branding },
      launcher: { ...widgetConfig.launcher, ...patch.launcher },
    };
    setWidgetConfig(updated);
    saveWidgetConfig(updated);
  };

  /* ── Fetch API settings ── */
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/widget/settings");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRequestId(data?.requestId || res.headers.get("x-request-id"));
        throw new Error(data?.error || t("common.error"));
      }
      const data = await res.json();
      const s: WidgetSettings = data.settings;
      const normalizedBubble = resolveWidgetBubbleTheme(
        {
          primaryColor: s.primaryColor,
          bubbleShape: s.bubbleShape,
          bubbleIcon: s.bubbleIcon,
          bubbleSize: s.bubbleSize,
          bubblePosition: s.bubblePosition,
          greetingText: s.greetingText,
          greetingEnabled: s.greetingEnabled,
        },
        {
          position: s.position,
          launcher: s.launcher,
          launcherLabel: s.greetingText,
        }
      );
      setSettings({
        ...s,
        bubbleShape: normalizedBubble.bubbleShape,
        bubbleIcon: normalizedBubble.bubbleIcon,
        bubbleSize: normalizedBubble.bubbleSize,
        bubblePosition: normalizedBubble.bubblePosition,
        greetingText: normalizedBubble.greetingText,
        greetingEnabled: normalizedBubble.greetingEnabled,
      });
      setRequestId(data.requestId || null);

      // Plan entitlements
      if (data.planKey) setPlanKey(data.planKey);
      if (data.brandingRequired !== undefined) setBrandingRequired(data.brandingRequired);
      if (data.domainMismatchCount !== undefined) setDomainMismatchCount(data.domainMismatchCount);
      const incoming =
        data?.settings && typeof data.settings === "object" ? data.settings : data;

      if (incoming.headerText) setHeaderText(incoming.headerText);
      if (incoming.subText) setSubText(incoming.subText);
      if (incoming.welcomeMsg) setWelcomeMsg(incoming.welcomeMsg);
      if (incoming.offlineMsg) setOfflineMsg(incoming.offlineMsg);
      if (incoming.launcherLabel) setLauncherLabel(incoming.launcherLabel);

      if (incoming.themeId) {
        const foundTheme = THEMES.find((item) => item.id === incoming.themeId);
        if (foundTheme) setTheme(foundTheme);
      }
      if (incoming.customColor) setCustomColor(incoming.customColor);
      if (incoming.useCustomColor !== undefined) setUseCustom(Boolean(incoming.useCustomColor));

      if (incoming.launcherId) {
        const foundLauncher = LAUNCHERS.find((item) => item.id === incoming.launcherId);
        if (foundLauncher) setLauncher(foundLauncher);
      }
      if (incoming.positionId) {
        const foundPosition = POSITIONS.find((item) => item.id === incoming.positionId);
        if (foundPosition) setPosition(foundPosition);
      }
      if (incoming.widgetSizeId) {
        const foundWidgetSize = SIZES.find((item) => item.id === incoming.widgetSizeId);
        if (foundWidgetSize) setWidgetSize(foundWidgetSize);
      }

      if (incoming.starters) setStarters(incoming.starters);
      if (incoming.botAvatar) setBotAvatar(incoming.botAvatar);
      if (incoming.agentAvatar) setAgentAvatar(incoming.agentAvatar);
      if (incoming.agentImageUrl) setAgentImagePreview(incoming.agentImageUrl);

      if (incoming.bgPatternId) {
        const foundBgPattern = BACKGROUNDS.find((item) => item.id === incoming.bgPatternId);
        if (foundBgPattern) setBgPattern(foundBgPattern);
      }
      if (incoming.attGrabberId) {
        const foundAttention = ATTENTION_GRABBERS.find((item) => item.id === incoming.attGrabberId);
        if (foundAttention) setAttGrabber(foundAttention);
      }
      if (incoming.attGrabberText) setAttGrabberText(incoming.attGrabberText);
      if (incoming.attGrabberDelay !== undefined) setAttGrabberDelay(Number(incoming.attGrabberDelay));

      if (incoming.hoursEnabled !== undefined) setHoursEnabled(Boolean(incoming.hoursEnabled));
      if (incoming.timezone) setTimezone(incoming.timezone);
      if (incoming.hours) setHours(incoming.hours);

      if (incoming.showBranding !== undefined) setShowBranding(Boolean(incoming.showBranding));
      if (incoming.showOnMobile !== undefined) setShowOnMobile(Boolean(incoming.showOnMobile));
      if (incoming.showOffline !== undefined) setShowOffline(Boolean(incoming.showOffline));
      if (incoming.soundEnabled !== undefined) setSoundEnabled(Boolean(incoming.soundEnabled));
      if (incoming.autoOpen !== undefined) setAutoOpen(Boolean(incoming.autoOpen));
      if (incoming.showUnread !== undefined) setShowUnread(Boolean(incoming.showUnread));
      if (incoming.preChatEnabled !== undefined) setPreChatEnabled(Boolean(incoming.preChatEnabled));
      if (incoming.typingIndicator !== undefined) setTypingIndicator(Boolean(incoming.typingIndicator));
      if (incoming.fileUpload !== undefined) setFileUpload(Boolean(incoming.fileUpload));
      if (incoming.emojiPicker !== undefined) setEmojiPicker(Boolean(incoming.emojiPicker));
      if (incoming.readReceipts !== undefined) setReadReceipts(Boolean(incoming.readReceipts));
      if (incoming.responseTime !== undefined) setResponseTime(Boolean(incoming.responseTime));
      if (incoming.transcriptEmail !== undefined) setTranscriptEmail(Boolean(incoming.transcriptEmail));
      if (incoming.visitorNotes !== undefined) setVisitorNotes(Boolean(incoming.visitorNotes));

      if (incoming.aiName) setAiName(incoming.aiName);
      if (incoming.aiTone) setAiTone(incoming.aiTone);
      if (incoming.aiLength) setAiLength(incoming.aiLength);
      if (incoming.aiEmoji !== undefined) setAiEmoji(Boolean(incoming.aiEmoji));
      if (incoming.aiLabel !== undefined) setAiLabel(Boolean(incoming.aiLabel));
      if (incoming.aiWelcome) setAiWelcome(incoming.aiWelcome);
      if (incoming.aiModel) setAiModel(incoming.aiModel);
      if (incoming.aiSuggestions !== undefined) setAiSuggestions(Boolean(incoming.aiSuggestions));

      if (incoming.csat !== undefined) setCsat(Boolean(incoming.csat));
      if (incoming.whiteLabel !== undefined) setWhiteLabel(Boolean(incoming.whiteLabel));
      if (incoming.autoReply !== undefined) setAutoReply(Boolean(incoming.autoReply));
      if (incoming.autoReplyMsg) setAutoReplyMsg(incoming.autoReplyMsg);
      if (incoming.customCss !== undefined) setCustomCss(String(incoming.customCss));
      if (incoming.consentEnabled !== undefined) setConsentEnabled(Boolean(incoming.consentEnabled));
      if (incoming.consentText) setConsentText(incoming.consentText);
      if (incoming.pageRules) setPageRules(incoming.pageRules);

      /* Restore local theme overrides */
      const saved = loadLocalTheme();
      if (saved) {
        setLocalTheme(saved);
        const resolvedSavedId = resolveThemeId(saved.presetId);
        const presetFromSaved = WIDGET_THEME_PRESETS.find(
          (p) => p.presetId === resolvedSavedId
        );
        if (presetFromSaved) {
          setSettings((prev) => ({ ...prev, primaryColor: presetFromSaved.primaryColor }));
        }
      } else {
        /* Match API primaryColor to a preset */
        const match = findPresetByColor(s.primaryColor);
        if (match) {
          applyPreset(match, false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchSettings();
    }
  }, [authLoading, user, fetchSettings]);

  const selectedPreset = WIDGET_THEME_PRESETS.find(
    (p) => p.presetId === resolveThemeId(localTheme.presetId)
  );
  const effectivePrimaryColor = selectedPreset?.primaryColor ?? settings.primaryColor;

  // Live sync floating bubble in PortalLayout while editing.
  useEffect(() => {
    if (!user) return;
    const liveSettings = {
      primaryColor: effectivePrimaryColor,
      position: settings.position,
      launcher: settings.launcher,
      bubbleShape: settings.bubbleShape,
      bubbleIcon: settings.bubbleIcon,
      bubbleSize: settings.bubbleSize,
      bubblePosition: settings.bubblePosition,
      greetingText: settings.greetingText,
      greetingEnabled: settings.greetingEnabled,
      welcomeTitle: settings.welcomeTitle,
    };
    window.dispatchEvent(
      new CustomEvent("widget-settings-live-preview", {
        detail: { settings: liveSettings },
      })
    );
  }, [user, effectivePrimaryColor, settings.position, settings.launcher, settings.welcomeTitle]);

  // Responsive: detect mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-dismiss upgrade notice after 3s
  useEffect(() => {
    if (!upgradeNotice) return;
    const timer = setTimeout(() => setUpgradeNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [upgradeNotice]);

  /* ── Apply a preset ── */
  const applyPreset = useCallback(
    (preset: WidgetTheme, persist = true) => {
      setPremiumPreviewId(null);
      premiumPreviewBackup.current = null;
      setSettings((prev) => ({
        ...prev,
        primaryColor: preset.primaryColor,
        position: preset.position,
        launcher: preset.launcher,
      }));
      const newLocal: LocalThemeOverrides = {
        presetId: preset.presetId,
        accentColor: preset.accentColor,
        surfaceColor: preset.surfaceColor,
        textColor: preset.textColor,
        gradientFrom: preset.gradient.from,
        gradientTo: preset.gradient.to,
        gradientAngle: preset.gradient.angle,
      };
      setLocalTheme(newLocal);
      if (persist) saveLocalTheme(newLocal);
    },
    []
  );

  const currentPlan: SubscriptionPlan = (() => {
    const normalized = planKey.trim().toLowerCase();
    if (normalized === "free") return "FREE";
    if (normalized === "starter") return "STARTER";
    if (normalized === "enterprise" || normalized === "business") return "ENTERPRISE";
    return "PRO";
  })();

  const handleAvatarChange = useCallback(
    (role: string, avatarId: string) => {
      if (role === "logo") {
        updateWidgetConfig({
          branding: {
            brandEnabled: true,
            brandAsset: { kind: "uploadData", value: avatarId },
          },
        });
        return;
      }

      const validAvatarIds = ["female9", "female17", "male1", "male4", "male8", "male9"];
      if (!validAvatarIds.includes(avatarId)) return;
      const src = `/avatars/${avatarId}.png`;

      if (role === "bot") {
        updateWidgetConfig({
          avatars: {
            botEnabled: true,
            botAsset: { kind: "url", value: src },
          },
        });
        return;
      }

      if (role === "user") {
        updateWidgetConfig({
          branding: {
            brandEnabled: true,
            brandAsset: { kind: "url", value: src },
          },
        });
        return;
      }

      if (role === "rep") {
        const nextAgents = [...widgetConfig.avatars.agents];
        if (!nextAgents[0]) {
          nextAgents[0] = { id: "agent-1", asset: { kind: "url", value: src } };
        } else {
          nextAgents[0] = { ...nextAgents[0], asset: { kind: "url", value: src } };
        }
        updateWidgetConfig({ avatars: { agents: nextAgents } });
      }
    },
    [widgetConfig.avatars.agents]
  );

  /* ── Save to API ── */
  const handleSave = async () => {
    if (!canEdit) return;
    // Free plan cannot persist premium palette previews.
    if (isFree && premiumPreviewId) {
      setSaveMessage(null);
      setRequestId(null);
      setError(null);
      setUpgradeNotice(`${t("widgetConfig.premiumPalettesLocked")} ${t("widgetConfig.unlockPalettes")}`);
      return;
    }
    setSaving(true);
    setUpgradeNotice(null);
    setSaveMessage(null);
    setError(null);
    saveWidgetConfig(widgetConfig);
    const payloadSettings = {
      ...settings,
      primaryColor: effectivePrimaryColor,
      bubbleShape: settings.launcher === "icon" ? "rounded-square" : settings.bubbleShape,
      bubbleIcon: settings.launcher === "icon" ? "help" : settings.bubbleIcon,
      bubbleSize:
        widgetConfig.launcher.launcherSize === "sm"
          ? 52
          : widgetConfig.launcher.launcherSize === "lg"
            ? 68
            : settings.bubbleSize,
      bubblePosition: settings.position === "left" ? "bottom-left" : "bottom-right",
      greetingText:
        sanitizePlainText(widgetConfig.launcher.launcherLabel).trim() ||
        sanitizePlainText(settings.greetingText).trim(),
      greetingEnabled:
        Boolean(widgetConfig.launcher.launcherLabel.trim()) || settings.greetingEnabled,
      welcomeTitle: sanitizePlainText(settings.welcomeTitle).slice(0, 60),
      welcomeMessage: sanitizePlainText(settings.welcomeMessage).slice(0, 240),
      brandName: settings.brandName ? sanitizePlainText(settings.brandName).slice(0, 40) : null,
      // v3 Content
      headerText,
      subText,
      welcomeMsg,
      offlineMsg,
      launcherLabel,
      // v3 Theme
      themeId: theme.id,
      customColor,
      useCustomColor: useCustom,
      // v3 Launcher
      launcherId: launcher.id,
      positionId: position.id,
      widgetSizeId: widgetSize.id,
      // v3 Starters
      starters,
      // v3 Avatars
      botAvatar,
      agentAvatar,
      // v3 Background & Attention
      bgPatternId: bgPattern.id,
      attGrabberId: attGrabber.id,
      attGrabberText,
      attGrabberDelay,
      // v3 Hours
      hoursEnabled,
      timezone,
      hours,
      // v3 Toggles
      showBranding,
      showOnMobile,
      showOffline,
      soundEnabled,
      autoOpen,
      showUnread,
      preChatEnabled,
      typingIndicator,
      fileUpload,
      emojiPicker,
      readReceipts,
      responseTime,
      transcriptEmail,
      visitorNotes,
      // v3 AI
      aiName,
      aiTone,
      aiLength,
      aiEmoji,
      aiLabel,
      aiWelcome,
      aiModel,
      aiSuggestions,
      // v3 PRO
      csat,
      whiteLabel,
      autoReply,
      autoReplyMsg,
      customCss,
      consentEnabled,
      consentText,
      // v3 Page Rules
      pageRules,
    };
    try {
      const res = await portalApiFetch("/portal/widget/settings", {
        method: "PUT",
        body: JSON.stringify(payloadSettings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRequestId(data?.requestId || res.headers.get("x-request-id"));
        throw new Error(data?.error || t("common.saveFailed"));
      }
      /* Also persist local theme overrides */
      saveLocalTheme(localTheme);
      setSaveMessage(t("widgetTheme.saved"));
      setManualHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
      const savedSettings = data?.settings && typeof data.settings === "object"
        ? {
            primaryColor: String(data.settings.primaryColor ?? settings.primaryColor),
            position: (data.settings.position === "left" ? "left" : "right") as "left" | "right",
            launcher: (data.settings.launcher === "icon" ? "icon" : "bubble") as "bubble" | "icon",
            bubbleShape:
              (data.settings.bubbleShape === "rounded-square" ? "rounded-square" : "circle") as
                | "rounded-square"
                | "circle",
            bubbleIcon:
              (["chat", "message", "help", "custom"].includes(data.settings.bubbleIcon)
                ? data.settings.bubbleIcon
                : "chat") as "chat" | "message" | "help" | "custom",
            bubbleSize: Number(data.settings.bubbleSize || 60),
            bubblePosition:
              (data.settings.bubblePosition === "bottom-left"
                ? "bottom-left"
                : "bottom-right") as "bottom-left" | "bottom-right",
            greetingText: String(data.settings.greetingText || ""),
            greetingEnabled: Boolean(data.settings.greetingEnabled),
            welcomeTitle: String(data.settings.welcomeTitle ?? settings.welcomeTitle),
          }
        : {
            primaryColor: payloadSettings.primaryColor,
            position: settings.position,
            launcher: settings.launcher,
            bubbleShape: payloadSettings.bubbleShape,
            bubbleIcon: payloadSettings.bubbleIcon,
            bubbleSize: payloadSettings.bubbleSize,
            bubblePosition: payloadSettings.bubblePosition,
            greetingText: payloadSettings.greetingText,
            greetingEnabled: payloadSettings.greetingEnabled,
            welcomeTitle: settings.welcomeTitle,
          };
      window.dispatchEvent(
        new CustomEvent("widget-settings-live-preview", {
          detail: {
            settings: savedSettings,
          },
        })
      );
      /* Notify layout to refresh the floating bubble */
      window.dispatchEvent(
        new CustomEvent("widget-settings-updated", {
          detail: { settings: savedSettings },
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  /* ── Reset ── */
  const handleReset = () => {
    applyPreset(DEFAULT_PRESET);
    setManualHasChanges(false);
    setSaveMessage(t("widgetTheme.resetDone"));
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // =============================================
  // v3 Handler — Mark Changed
  // =============================================
  const markChanged = () => {
    setManualHasChanges(true);
  };

  // =============================================
  // v3 Handler — Show Upgrade
  // =============================================
  const showUpgrade = (feature: string) => {
    setUpgradeNotice(feature);
    setTimeout(() => setUpgradeNotice(null), 3000);
  };

  // =============================================
  // v3 Handler — Agent Image Upload
  // =============================================
  const handleAgentImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      window.alert("Dosya boyutu 2MB'dan küçük olmalıdır");
      return;
    }
    setAgentImage(file);
    const reader = new FileReader();
    reader.onload = () => {
      setAgentImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    markChanged();
  };

  const removeAgentImage = () => {
    setAgentImage(null);
    setAgentImagePreview(null);
    setAgentAvatar("👩‍💼");
    if (agentImgRef.current) agentImgRef.current.value = "";
    markChanged();
  };

  // =============================================
  // v3 Handler — Logo Upload
  // =============================================
  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      window.alert("Dosya boyutu 2MB'dan küçük olmalıdır");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    markChanged();
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoRef.current) logoRef.current.value = "";
    markChanged();
  };

  // =============================================
  // v3 Handler — Conversation Starters
  // =============================================
  const addStarter = () => {
    if (!newStarter.trim()) return;
    setStarters((prev) => [...prev, { id: Date.now(), text: newStarter, active: true }]);
    setNewStarter("");
    markChanged();
  };

  const toggleStarter = (id: number) => {
    setStarters((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item))
    );
    markChanged();
  };

  const removeStarter = (id: number) => {
    setStarters((prev) => prev.filter((item) => item.id !== id));
    markChanged();
  };

  const handleDragStart = (i: number) => setDragIdx(i);

  const handleDragOver = (e: DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) return;
    setStarters((prev) => {
      const next = [...prev];
      const item = next[dragIdx];
      if (!item) return prev;
      next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
    setDragIdx(targetIdx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    markChanged();
  };

  // =============================================
  // v3 Handler — Working Hours
  // =============================================
  const toggleDay = (i: number) => {
    setHours((prev) => prev.map((item, idx) => (idx === i ? { ...item, on: !item.on } : item)));
    markChanged();
  };

  const updateHour = (i: number, field: "start" | "end", val: string) => {
    setHours((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: val } : item))
    );
    markChanged();
  };

  const applyToAll = () => {
    const first = hours.find((item) => item.on);
    if (!first) return;
    setHours((prev) =>
      prev.map((item) => (item.on ? { ...item, start: first.start, end: first.end } : item))
    );
    markChanged();
  };

  // =============================================
  // v3 Handler — Page Rules
  // =============================================
  const addPageRule = () => {
    if (!newPageUrl.trim()) return;
    setPageRules((prev) => [
      ...prev,
      { id: Date.now(), url: newPageUrl.trim(), action: newPageAction },
    ]);
    setNewPageUrl("");
    markChanged();
  };

  const removePageRule = (id: number) => {
    setPageRules((prev) => prev.filter((item) => item.id !== id));
    markChanged();
  };

  // =============================================
  // v3 Handler — Embed & Link Copy
  // =============================================
  const copyEmbed = () => {
    navigator.clipboard?.writeText(embedCode).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    });
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(directChatLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  /* ── Color helpers ── */
  const validateColor = (color: string): boolean =>
    /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);

  const updateLocal = (patch: Partial<LocalThemeOverrides>) => {
    const updated = { ...localTheme, ...patch, presetId: "custom" };
    setLocalTheme(updated);
    saveLocalTheme(updated);
  };

  const selectedShowcase =
    THEME_SHOWCASE.find((t) => t.id === resolveThemeId(localTheme.presetId)) ??
    THEME_SHOWCASE.find((t) => t.color.toLowerCase() === settings.primaryColor.toLowerCase()) ??
    THEME_SHOWCASE.find((t) => t.id === "sunset-orange")!;
  const getRangeTrackStyle = (value: number, min: number, max: number) => {
    const safe = Math.min(max, Math.max(min, value));
    const percent = ((safe - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(90deg, ${selectedShowcase.color} 0%, ${selectedShowcase.color} ${percent}%, rgba(0,0,0,0.08) ${percent}%, rgba(0,0,0,0.08) 100%)`,
      boxShadow: `0 2px 8px ${selectedShowcase.color}40`,
    };
  };
  const accordionItems = [
    {
      id: "customize" as const,
      icon: "🎨",
      title: t("widgetTheme.customizeTitle"),
      desc: t("widgetTheme.groupBrand"),
      items: 4,
    },
    {
      id: "premiumPalettes" as const,
      icon: "💎",
      title: t("widgetConfig.premiumPalettes"),
      desc: t("widgetConfig.unlockPalettes"),
      items: 8,
      pro: true,
    },
    {
      id: "avatarLauncher" as const,
      icon: "🖼️",
      title: t("widgetConfig.avatarTitle"),
      desc: t("widgetConfig.sectionLauncherDesc"),
      items: 3,
    },
    {
      id: "size" as const,
      icon: "📐",
      title: t("widgetConfig.sizeTitle"),
      desc: t("widgetConfig.widthPreset"),
      items: 2,
    },
    {
      id: "settings" as const,
      icon: "⚙️",
      title: t("portal.settings"),
      desc: t("widgetAppearance.subtitle"),
      items: 5,
    },
  ];

  // Check if there are unsaved changes
  const hasChanges =
    manualHasChanges || saving || saveMessage !== null || premiumPreviewId !== null;
  const premiumPaletteList: PremiumPalette[] = THEMES.filter(
    (theme): theme is (typeof THEMES)[number] & { pro: true } => Boolean("pro" in theme && theme.pro)
  ).map((theme) => ({
    id: theme.id,
    colors: [theme.dark, theme.color, theme.dark, theme.light, theme.light] as [
      string,
      string,
      string,
      string,
      string,
    ],
    gradient: {
      from: theme.color,
      to: theme.dark,
      angle: 135,
    },
    primaryColor: theme.color,
    accentColor: theme.color,
    surfaceColor: theme.light,
  }));

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  // LOADING SKELETON
  if (loading) {
    return (
      <div style={{
        display: "flex",
        gap: isMobile ? "20px" : "28px",
        maxWidth: "1320px",
        margin: "0 auto",
        padding: "24px 28px",
        minHeight: "100vh",
        alignItems: "flex-start",
        flexDirection: isMobile ? "column" : "row"
      }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header skeleton */}
          <div style={{ padding: "20px 24px", background: "#FFFCF9", borderRadius: "16px", border: "1px solid #F0E6D6" }}>
            <div style={{ width: "220px", height: "26px", borderRadius: "8px", background: "#E8E0D4", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: "300px", height: "16px", borderRadius: "6px", background: "#F0E6D6", animation: "pulse 1.5s ease-in-out infinite", marginTop: "10px" }} />
          </div>
          {/* Section skeletons */}
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ width: "100%", height: "56px", borderRadius: "14px", background: "#F8F4EF", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        {!isMobile && (
          <div style={{ width: "420px", height: "500px", borderRadius: "16px", background: "#F8F4EF", animation: "pulse 1.5s ease-in-out infinite" }} />
        )}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {/* Main Page Container */}
      <div style={{
        display: "flex",
        gap: isMobile ? "20px" : "28px",
        maxWidth: "1320px",
        margin: "0 auto",
        padding: "24px 28px",
        fontFamily: "'Satoshi', 'Manrope', sans-serif",
        minHeight: "100vh",
        alignItems: "flex-start",
        flexDirection: isMobile ? "column" : "row"
      }}>
        {/* LEFT PANEL - Form/Settings */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          {/* Domain Mismatch Warning */}
          {domainMismatchCount > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 20px",
              borderRadius: "14px",
              background: "#FEF2F2",
              border: "1px solid #FECACA"
            }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Satoshi", fontSize: "13.5px", fontWeight: 700, color: "#991B1B" }}>
                  {t("widgetAppearance.domain.warning")}
                </div>
                <div style={{ fontFamily: "Manrope", fontSize: "12px", fontWeight: 500, color: "#DC2626", marginTop: "2px" }}>
                  {t("widgetAppearance.domain.desc").replace("{count}", String(domainMismatchCount))}
                </div>
              </div>
              <button
                onClick={() => router.push("/portal/settings")}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "1px solid #FECACA",
                  background: "white",
                  fontFamily: "Satoshi",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#DC2626",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#FEF2F2"}
                onMouseLeave={(e) => e.currentTarget.style.background = "white"}
              >
                {t("widgetAppearance.domain.action")}
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && <ErrorBanner message={error} />}

          {/* HEADER */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            padding: "20px 24px",
            background: "#FFFCF9",
            borderRadius: "16px",
            border: "1px solid #F0E6D6"
          }}>
            {/* Left: Title + Badge + Description */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{
                  fontFamily: "Satoshi",
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#1A1D23",
                  letterSpacing: "-0.02em"
                }}>
                  {t("widgetAppearance.pageTitle")}
                </h1>
                <span style={{
                  display: "inline-flex",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  fontFamily: "Satoshi",
                  letterSpacing: "0.03em",
                  background: planKey === "enterprise" || planKey === "business"
                    ? "rgba(139,92,246,0.1)"
                    : planKey === "pro"
                      ? "rgba(245,158,11,0.1)"
                      : "#F1F5F9",
                  color: planKey === "enterprise" || planKey === "business"
                    ? "#7C3AED"
                    : planKey === "pro"
                      ? "#D97706"
                      : "#64748B"
                }}>
                  {t(("widgetAppearance.planBadge." + planKey) as any)}
                </span>
              </div>
              <p style={{
                fontFamily: "Manrope",
                fontSize: "13.5px",
                fontWeight: 500,
                color: "#64748B"
              }}>
                {t("widgetAppearance.pageDesc")}
              </p>
            </div>

            {/* Right: Reset + Save Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {hasChanges && (
                <button
                  onClick={handleReset}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "10px",
                    border: "1.5px solid #E2E8F0",
                    background: "white",
                    fontFamily: "Satoshi",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#64748B",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F8FAFC";
                    e.currentTarget.style.borderColor = "#CBD5E1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.borderColor = "#E2E8F0";
                  }}
                >
                  {t("widgetAppearance.reset")}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                style={{
                  padding: "9px 22px",
                  borderRadius: "10px",
                  border: "none",
                  background: saveMessage
                    ? "linear-gradient(135deg, #10B981, #059669)"
                    : "linear-gradient(135deg, #F59E0B, #D97706)",
                  fontFamily: "Satoshi",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "white",
                  cursor: (saving || !hasChanges) ? "not-allowed" : "pointer",
                  boxShadow: (saving || !hasChanges) ? "none" : "0 2px 8px rgba(245,158,11,0.25)",
                  transition: "all 0.3s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: (saving || !hasChanges) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!(saving || !hasChanges)) {
                    e.currentTarget.style.boxShadow = "0 4px 14px rgba(245,158,11,0.35)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(saving || !hasChanges)) {
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(245,158,11,0.25)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                {saving ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    {t("widgetAppearance.saving")}
                  </>
                ) : saveMessage ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t("widgetAppearance.saved")}
                  </>
                ) : (
                  t("widgetAppearance.save")
                )}
              </button>
              {hasChanges && !saving && !saveMessage && (
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B", margin: "4px auto 0" }} />
              )}
            </div>
          </div>

          {false && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            {/* ===== v3-OVERRIDE: Bu bölüm Part 5'te yeni SectionHeader + v3 içerikle değiştirilecek ===== */}
            {/* SECTION 0: TEMA SEÇİMİ */}
            <div style={{
              background: "#FFFCF9",
              borderRadius: "16px",
              border: openSection === 0 ? "1px solid rgba(245,158,11,0.2)" : "1px solid #F0E6D6",
              overflow: "hidden",
              transition: "border-color 0.2s"
            }}>
              {/* Header */}
              <div
                onClick={() => toggleSection(0)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 22px",
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.02)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>🎨</span>
                  <span style={{ fontFamily: "Satoshi", fontSize: "15px", fontWeight: 700, color: "#1A1D23" }}>
                    {t("widgetAppearance.theme.title")}
                  </span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    fontFamily: "Satoshi",
                    background: "rgba(245,158,11,0.08)",
                    color: "#D97706"
                  }}>
                    {WIDGET_THEME_PRESETS.length}
                  </span>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: "transform 0.3s",
                    transform: openSection === 0 ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Body */}
              {openSection === 0 && (
                <div style={{ padding: "4px 22px 22px", animation: "fadeUp 0.3s ease both" }}>
                  <p style={{ fontFamily: "Manrope", fontSize: "12.5px", color: "#94A3B8", marginBottom: "14px" }}>
                    {t("widgetAppearance.theme.desc")}
                  </p>

                  {/* Theme Grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: "12px"
                  }}>
                    {WIDGET_THEME_PRESETS.map((preset, index) => {
                      const isActive = localTheme.presetId === preset.presetId;
                      const isLocked = planKey === "free" && index >= 4;

                      return (
                        <div
                          key={preset.presetId}
                          onClick={() => {
                            if (isLocked) {
                              setUpgradeNotice(t("widgetAppearance.upgradeRequired"));
                              return;
                            }
                            applyPreset(preset);
                          }}
                          style={{
                            padding: "14px",
                            borderRadius: "14px",
                            border: isActive ? "2px solid #F59E0B" : "2px solid #EDE8E0",
                            background: isActive ? "#FFFBF5" : "white",
                            cursor: isLocked ? "not-allowed" : "pointer",
                            transition: "all 0.25s ease",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "10px",
                            position: "relative",
                            boxShadow: isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : "none"
                          }}
                          onMouseEnter={(e) => {
                            if (!isLocked) {
                              e.currentTarget.style.borderColor = isActive ? "#F59E0B" : "#D4C8B8";
                              e.currentTarget.style.background = isActive ? "#FFFBF5" : "#FFFDF8";
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : "0 4px 12px rgba(0,0,0,0.04)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isActive ? "#F59E0B" : "#EDE8E0";
                            e.currentTarget.style.background = isActive ? "#FFFBF5" : "white";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : "none";
                          }}
                        >
                          {/* Color Circle */}
                          <div style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            background: preset.primaryColor,
                            boxShadow: isActive
                              ? "0 2px 12px rgba(245,158,11,0.25)"
                              : "0 2px 8px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.3)"
                          }} />

                          {/* Preset Name */}
                          <span style={{
                            fontFamily: "Satoshi",
                            fontSize: "12px",
                            fontWeight: isActive ? 700 : 600,
                            color: isActive ? "#1A1D23" : "#475569",
                            textAlign: "center"
                          }}>
                            {preset.name}
                          </span>

                          {/* Active Badge */}
                          {isActive && (
                            <span style={{
                              display: "inline-flex",
                              padding: "2px 8px",
                              borderRadius: "8px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              fontFamily: "Satoshi",
                              background: "rgba(245,158,11,0.1)",
                              color: "#D97706",
                              letterSpacing: "0.02em"
                            }}>
                              {t("widgetAppearance.theme.active")}
                            </span>
                          )}

                          {/* Lock Overlay */}
                          {isLocked && (
                            <div style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: "14px",
                              background: "rgba(255,255,255,0.6)",
                              backdropFilter: "blur(2px)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 2
                            }}>
                              <span style={{ fontSize: "18px" }}>🔒</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ===== v3-OVERRIDE: Bu bölüm Part 5'te yeni SectionHeader + v3 içerikle değiştirilecek ===== */}
            {/* SECTION 1: RENK ÖZELLEŞTİRME */}
            <div style={{
              background: "#FFFCF9",
              borderRadius: "16px",
              border: openSection === 1 ? "1px solid rgba(245,158,11,0.2)" : "1px solid #F0E6D6",
              overflow: "hidden",
              transition: "border-color 0.2s"
            }}>
              {/* Header */}
              <div
                onClick={() => toggleSection(1)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 22px",
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.02)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>🎨</span>
                  <span style={{ fontFamily: "Satoshi", fontSize: "15px", fontWeight: 700, color: "#1A1D23" }}>
                    {t("widgetAppearance.color.title")}
                  </span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    fontFamily: "Satoshi",
                    background: "rgba(245,158,11,0.08)",
                    color: "#D97706"
                  }}>
                    6
                  </span>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: "transform 0.3s",
                    transform: openSection === 1 ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Body */}
              {openSection === 1 && (
                <div style={{ padding: "4px 22px 22px", animation: "fadeUp 0.3s ease both" }}>
                  <p style={{ fontFamily: "Manrope", fontSize: "12.5px", color: "#94A3B8", marginBottom: "14px" }}>
                    {t("widgetAppearance.color.desc")}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* 1A. Primary Color */}
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", minWidth: "100px" }}>
                        {t("widgetAppearance.color.primary")}
                      </span>
                      <div
                        onClick={() => colorPickerRef.current?.click()}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "12px",
                          border: "2px solid #EDE8E0",
                          cursor: "pointer",
                          flexShrink: 0,
                          background: localTheme.accentColor,
                          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)",
                          transition: "border-color 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "#D4C8B8"}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = "#EDE8E0"}
                      />
                      <input
                        ref={colorPickerRef}
                        type="color"
                        value={localTheme.accentColor}
                        onChange={(e) => updateLocal({ accentColor: e.target.value })}
                        style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
                      />
                      <input
                        type="text"
                        value={localTheme.accentColor}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (validateColor(val)) {
                            updateLocal({ accentColor: val });
                          }
                        }}
                        style={{
                          fontFamily: "Satoshi",
                          fontSize: "13px",
                          fontWeight: 600,
                          padding: "8px 12px",
                          borderRadius: "10px",
                          border: validateColor(localTheme.accentColor) ? "1.5px solid #E8E0D4" : "1.5px solid #EF4444",
                          background: "#FFFCF9",
                          color: "#1A1D23",
                          width: "110px",
                          outline: "none",
                          transition: "border-color 0.2s, box-shadow 0.2s"
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#F59E0B";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = validateColor(localTheme.accentColor) ? "#E8E0D4" : "#EF4444";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>

                    {/* 1B. Gradient Settings */}
                    <div style={{ position: "relative", opacity: planKey === "free" ? 0.4 : 1, pointerEvents: planKey === "free" ? "none" : "auto" }}>
                      {planKey === "free" && (
                        <div style={{
                          position: "absolute",
                          top: "0",
                          right: "0",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 8px",
                          borderRadius: "8px",
                          background: "rgba(245,158,11,0.08)",
                          fontSize: "10px",
                          fontWeight: 700,
                          fontFamily: "Satoshi",
                          color: "#D97706"
                        }}>
                          🔒 PRO
                        </div>
                      )}
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23" }}>
                        {t("widgetAppearance.color.gradient")}
                      </div>
                      <div style={{
                        width: "100%",
                        height: "32px",
                        borderRadius: "10px",
                        background: `linear-gradient(${localTheme.gradientAngle}deg, ${localTheme.gradientFrom}, ${localTheme.gradientTo})`,
                        border: "1px solid #EDE8E0",
                        marginTop: "8px",
                        marginBottom: "12px"
                      }} />
                      <div style={{ display: "flex", gap: "12px" }}>
                        {/* From */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "Manrope", fontSize: "11px", fontWeight: 600, color: "#94A3B8", marginBottom: "6px" }}>
                            {t("widgetAppearance.color.gradientFrom")}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              onClick={() => gradientFromRef.current?.click()}
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                border: "1.5px solid #EDE8E0",
                                cursor: "pointer",
                                flexShrink: 0,
                                background: localTheme.gradientFrom
                              }}
                            />
                            <input
                              ref={gradientFromRef}
                              type="color"
                              value={localTheme.gradientFrom}
                              onChange={(e) => updateLocal({ gradientFrom: e.target.value })}
                              style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
                            />
                            <input
                              type="text"
                              value={localTheme.gradientFrom}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (validateColor(val)) {
                                  updateLocal({ gradientFrom: val });
                                }
                              }}
                              style={{
                                fontFamily: "Satoshi",
                                fontSize: "13px",
                                fontWeight: 600,
                                padding: "8px 12px",
                                borderRadius: "10px",
                                border: "1.5px solid #E8E0D4",
                                background: "#FFFCF9",
                                color: "#1A1D23",
                                width: "100%",
                                outline: "none"
                              }}
                            />
                          </div>
                        </div>
                        {/* To */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "Manrope", fontSize: "11px", fontWeight: 600, color: "#94A3B8", marginBottom: "6px" }}>
                            {t("widgetAppearance.color.gradientTo")}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              onClick={() => gradientToRef.current?.click()}
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                border: "1.5px solid #EDE8E0",
                                cursor: "pointer",
                                flexShrink: 0,
                                background: localTheme.gradientTo
                              }}
                            />
                            <input
                              ref={gradientToRef}
                              type="color"
                              value={localTheme.gradientTo}
                              onChange={(e) => updateLocal({ gradientTo: e.target.value })}
                              style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
                            />
                            <input
                              type="text"
                              value={localTheme.gradientTo}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (validateColor(val)) {
                                  updateLocal({ gradientTo: val });
                                }
                              }}
                              style={{
                                fontFamily: "Satoshi",
                                fontSize: "13px",
                                fontWeight: 600,
                                padding: "8px 12px",
                                borderRadius: "10px",
                                border: "1.5px solid #E8E0D4",
                                background: "#FFFCF9",
                                color: "#1A1D23",
                                width: "100%",
                                outline: "none"
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Angle Slider */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                        <span style={{ fontFamily: "Manrope", fontSize: "11px", fontWeight: 600, color: "#94A3B8", minWidth: "36px" }}>
                          {t("widgetAppearance.color.gradientAngle")}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={15}
                          value={localTheme.gradientAngle}
                          onChange={(e) => updateLocal({ gradientAngle: Number(e.target.value) })}
                          style={{ flex: 1, accentColor: "#F59E0B", height: "4px", cursor: "pointer" }}
                        />
                        <span style={{ fontFamily: "Satoshi", fontSize: "12px", fontWeight: 700, color: "#D97706", minWidth: "36px", textAlign: "right" }}>
                          {localTheme.gradientAngle}°
                        </span>
                      </div>
                    </div>

                    {/* 1C. Surface & Text Color */}
                    <div style={{ display: "flex", gap: "16px", flexDirection: isMobile ? "column" : "row" }}>
                      {/* Surface */}
                      <div style={{ flex: 1, position: "relative", opacity: planKey === "free" || planKey === "starter" ? 0.4 : 1, pointerEvents: planKey === "free" || planKey === "starter" ? "none" : "auto" }}>
                        {(planKey === "free" || planKey === "starter") && (
                          <div style={{
                            position: "absolute",
                            top: "0",
                            right: "0",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                            borderRadius: "8px",
                            background: "rgba(245,158,11,0.08)",
                            fontSize: "10px",
                            fontWeight: 700,
                            fontFamily: "Satoshi",
                            color: "#D97706",
                            zIndex: 1
                          }}>
                            🔒 PRO
                          </div>
                        )}
                        <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "8px" }}>
                          {t("widgetAppearance.color.surface")}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "12px",
                              border: "2px solid #EDE8E0",
                              cursor: "pointer",
                              flexShrink: 0,
                              background: localTheme.surfaceColor,
                              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)"
                            }}
                          />
                          <input
                            type="text"
                            value={localTheme.surfaceColor}
                            style={{
                              fontFamily: "Satoshi",
                              fontSize: "13px",
                              fontWeight: 600,
                              padding: "8px 12px",
                              borderRadius: "10px",
                              border: "1.5px solid #E8E0D4",
                              background: "#FFFCF9",
                              color: "#1A1D23",
                              width: "110px",
                              outline: "none"
                            }}
                            readOnly
                          />
                        </div>
                      </div>
                      {/* Text */}
                      <div style={{ flex: 1, position: "relative", opacity: planKey === "free" || planKey === "starter" ? 0.4 : 1, pointerEvents: planKey === "free" || planKey === "starter" ? "none" : "auto" }}>
                        {(planKey === "free" || planKey === "starter") && (
                          <div style={{
                            position: "absolute",
                            top: "0",
                            right: "0",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                            borderRadius: "8px",
                            background: "rgba(245,158,11,0.08)",
                            fontSize: "10px",
                            fontWeight: 700,
                            fontFamily: "Satoshi",
                            color: "#D97706",
                            zIndex: 1
                          }}>
                            🔒 PRO
                          </div>
                        )}
                        <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "8px" }}>
                          {t("widgetAppearance.color.text")}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "12px",
                              border: "2px solid #EDE8E0",
                              cursor: "pointer",
                              flexShrink: 0,
                              background: localTheme.textColor,
                              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)"
                            }}
                          />
                          <input
                            type="text"
                            value={localTheme.textColor}
                            style={{
                              fontFamily: "Satoshi",
                              fontSize: "13px",
                              fontWeight: 600,
                              padding: "8px 12px",
                              borderRadius: "10px",
                              border: "1.5px solid #E8E0D4",
                              background: "#FFFCF9",
                              color: "#1A1D23",
                              width: "110px",
                              outline: "none"
                            }}
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ===== v3-OVERRIDE: Bu bölüm Part 6'da yeni SectionHeader + v3 içerikle değiştirilecek ===== */}
            {/* SECTION 2: LAUNCHER / BUBBLE AYARLARI */}
            <div style={{
              background: "#FFFCF9",
              borderRadius: "16px",
              border: openSection === 2 ? "1px solid rgba(245,158,11,0.2)" : "1px solid #F0E6D6",
              overflow: "hidden",
              transition: "border-color 0.2s"
            }}>
              {/* Header */}
              <div
                onClick={() => toggleSection(2)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 22px",
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.02)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>💬</span>
                  <span style={{ fontFamily: "Satoshi", fontSize: "15px", fontWeight: 700, color: "#1A1D23" }}>
                    {t("widgetAppearance.launcher.title")}
                  </span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    fontFamily: "Satoshi",
                    background: "rgba(245,158,11,0.08)",
                    color: "#D97706"
                  }}>
                    4
                  </span>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: "transform 0.3s",
                    transform: openSection === 2 ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Body */}
              {openSection === 2 && (
                <div style={{ padding: "4px 22px 22px", animation: "fadeUp 0.3s ease both" }}>
                  <p style={{ fontFamily: "Manrope", fontSize: "12.5px", color: "#94A3B8", marginBottom: "16px" }}>
                    {t("widgetAppearance.launcher.desc")}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                    {/* 2A. Şekil Seçimi */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "10px" }}>
                        {t("widgetAppearance.launcher.shape")}
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        {[
                          { id: "circle", label: t("widgetAppearance.launcher.shapeCircle"), preview: { width: "40px", height: "40px", borderRadius: "50%" } },
                          { id: "rounded-square", label: t("widgetAppearance.launcher.shapeRounded"), preview: { width: "44px", height: "40px", borderRadius: "12px" } },
                        ].map((shape) => {
                          const isActive = settings.bubbleShape === shape.id;
                          return (
                            <div
                              key={shape.id}
                              onClick={() => setSettings(prev => ({ ...prev, bubbleShape: shape.id as any }))}
                              style={{
                                flex: 1,
                                padding: "14px 10px",
                                borderRadius: "12px",
                                border: isActive ? "2px solid #F59E0B" : "2px solid #EDE8E0",
                                background: isActive ? "#FFFBF5" : "white",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "8px",
                                transition: "all 0.2s",
                                boxShadow: isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : "none"
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor = "#D4C8B8";
                                  e.currentTarget.style.background = "#FFFDF8";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor = "#EDE8E0";
                                  e.currentTarget.style.background = "white";
                                }
                              }}
                            >
                              <div style={{
                                ...shape.preview,
                                background: localTheme.accentColor || "#F59E0B",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                              </div>
                              <span style={{
                                fontFamily: "Satoshi",
                                fontSize: "11.5px",
                                fontWeight: isActive ? 700 : 600,
                                color: isActive ? "#1A1D23" : "#64748B"
                              }}>
                                {shape.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2B. Boyut Seçimi */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "10px" }}>
                        {t("widgetAppearance.launcher.size")}
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        {[
                          { id: 48, label: t("widgetAppearance.launcher.sizeSmall"), diameter: "32px" },
                          { id: 60, label: t("widgetAppearance.launcher.sizeMedium"), diameter: "40px" },
                          { id: 72, label: t("widgetAppearance.launcher.sizeLarge"), diameter: "48px" },
                        ].map((size) => {
                          const isActive = settings.bubbleSize === size.id;
                          return (
                            <div
                              key={size.id}
                              onClick={() => setSettings(prev => ({ ...prev, bubbleSize: size.id }))}
                              style={{
                                flex: 1,
                                padding: "14px 10px",
                                borderRadius: "12px",
                                border: isActive ? "2px solid #F59E0B" : "2px solid #EDE8E0",
                                background: isActive ? "#FFFBF5" : "white",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "8px",
                                transition: "all 0.2s",
                                boxShadow: isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : "none"
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor = "#D4C8B8";
                                  e.currentTarget.style.background = "#FFFDF8";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor = "#EDE8E0";
                                  e.currentTarget.style.background = "white";
                                }
                              }}
                            >
                              <div style={{
                                width: size.diameter,
                                height: size.diameter,
                                borderRadius: "50%",
                                background: localTheme.accentColor || "#F59E0B",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                              </div>
                              <span style={{
                                fontFamily: "Satoshi",
                                fontSize: "11.5px",
                                fontWeight: isActive ? 700 : 600,
                                color: isActive ? "#1A1D23" : "#64748B"
                              }}>
                                {size.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2C. Pozisyon Seçimi */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "10px" }}>
                        {t("widgetAppearance.launcher.position")}
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        {[
                          { id: "bottom-right", label: t("widgetAppearance.launcher.positionBr"), dotStyle: { bottom: "4px", right: "4px" } },
                          { id: "bottom-left", label: t("widgetAppearance.launcher.positionBl"), dotStyle: { bottom: "4px", left: "4px" } },
                        ].map((pos) => {
                          const isActive = settings.bubblePosition === pos.id;
                          return (
                            <div
                              key={pos.id}
                              onClick={() => setSettings(prev => ({ ...prev, bubblePosition: pos.id as any }))}
                              style={{
                                flex: 1,
                                padding: "14px 10px",
                                borderRadius: "12px",
                                border: isActive ? "2px solid #F59E0B" : "2px solid #EDE8E0",
                                background: isActive ? "#FFFBF5" : "white",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "8px",
                                transition: "all 0.2s",
                                boxShadow: isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : "none"
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor = "#D4C8B8";
                                  e.currentTarget.style.background = "#FFFDF8";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor = "#EDE8E0";
                                  e.currentTarget.style.background = "white";
                                }
                              }}
                            >
                              <div style={{
                                width: "60px",
                                height: "42px",
                                borderRadius: "6px",
                                border: "1.5px solid #E2E8F0",
                                position: "relative",
                                background: "#FAFAFA"
                              }}>
                                <div style={{
                                  position: "absolute",
                                  ...pos.dotStyle,
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "50%",
                                  background: localTheme.accentColor || "#F59E0B"
                                }} />
                              </div>
                              <span style={{
                                fontFamily: "Satoshi",
                                fontSize: "11.5px",
                                fontWeight: isActive ? 700 : 600,
                                color: isActive ? "#1A1D23" : "#64748B"
                              }}>
                                {pos.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2D. İkon Seçimi */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "10px" }}>
                        {t("widgetAppearance.launcher.icon")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {[
                          { id: "chat", svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
                          { id: "message", svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>' },
                          { id: "help", svg: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
                        ].map((icon) => {
                          const isActive = settings.bubbleIcon === icon.id;
                          return (
                            <div
                              key={icon.id}
                              onClick={() => setSettings(prev => ({ ...prev, bubbleIcon: icon.id as any }))}
                              style={{
                                width: "44px",
                                height: "44px",
                                borderRadius: "10px",
                                border: isActive ? "2px solid #F59E0B" : "2px solid #EDE8E0",
                                background: isActive ? "#FFFBF5" : "white",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor = "#D4C8B8";
                                  e.currentTarget.style.background = "#FFFDF8";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor = "#EDE8E0";
                                  e.currentTarget.style.background = "white";
                                }
                              }}
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={isActive ? "#F59E0B" : "#64748B"}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                dangerouslySetInnerHTML={{ __html: icon.svg }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ===== v3-OVERRIDE: Bu bölüm Part 6'da yeni SectionHeader + v3 içerikle değiştirilecek ===== */}
            {/* SECTION 3: KARŞILAMA MESAJLARI */}
            <div style={{
              background: "#FFFCF9",
              borderRadius: "16px",
              border: openSection === 3 ? "1px solid rgba(245,158,11,0.2)" : "1px solid #F0E6D6",
              overflow: "hidden",
              transition: "border-color 0.2s"
            }}>
              {/* Header */}
              <div
                onClick={() => toggleSection(3)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 22px",
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.02)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>👋</span>
                  <span style={{ fontFamily: "Satoshi", fontSize: "15px", fontWeight: 700, color: "#1A1D23" }}>
                    {t("widgetAppearance.greeting.title")}
                  </span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    fontFamily: "Satoshi",
                    background: "rgba(245,158,11,0.08)",
                    color: "#D97706"
                  }}>
                    4
                  </span>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: "transform 0.3s",
                    transform: openSection === 3 ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Body */}
              {openSection === 3 && (
                <div style={{ padding: "4px 22px 22px", animation: "fadeUp 0.3s ease both" }}>
                  <p style={{ fontFamily: "Manrope", fontSize: "12.5px", color: "#94A3B8", marginBottom: "14px" }}>
                    {t("widgetAppearance.greeting.desc")}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    {/* 3A. Welcome Title */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "6px" }}>
                        {t("widgetAppearance.greeting.welcomeTitle")}
                      </div>
                      <input
                        type="text"
                        value={settings.welcomeTitle}
                        onChange={(e) => setSettings(prev => ({ ...prev, welcomeTitle: sanitizePlainText(e.target.value) }))}
                        maxLength={60}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1.5px solid #E8E0D4",
                          background: "#FFFCF9",
                          fontFamily: "Manrope",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#1A1D23",
                          outline: "none",
                          transition: "border-color 0.2s, box-shadow 0.2s"
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#F59E0B";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#E8E0D4";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                      <div style={{ fontFamily: "Manrope", fontSize: "10px", fontWeight: 500, color: "#94A3B8", textAlign: "right", marginTop: "4px" }}>
                        {settings.welcomeTitle.length}/60
                      </div>
                    </div>

                    {/* 3B. Welcome Message */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "6px" }}>
                        {t("widgetAppearance.greeting.welcomeMsg")}
                      </div>
                      <textarea
                        value={settings.welcomeMessage}
                        onChange={(e) => setSettings(prev => ({ ...prev, welcomeMessage: sanitizePlainText(e.target.value) }))}
                        maxLength={200}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1.5px solid #E8E0D4",
                          background: "#FFFCF9",
                          fontFamily: "Manrope",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#1A1D23",
                          outline: "none",
                          resize: "vertical",
                          minHeight: "72px",
                          maxHeight: "160px",
                          transition: "border-color 0.2s, box-shadow 0.2s"
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#F59E0B";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#E8E0D4";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                      <div style={{ fontFamily: "Manrope", fontSize: "10px", fontWeight: 500, color: "#94A3B8", textAlign: "right", marginTop: "4px" }}>
                        {settings.welcomeMessage.length}/200
                      </div>
                    </div>

                    {/* 3C. Greeting Bubble Toggle */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderTop: "1px solid #F0E6D6"
                    }}>
                      <span style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23" }}>
                        {t("widgetAppearance.greeting.greetingEnabled")}
                      </span>
                      <div
                        onClick={() => setSettings(prev => ({ ...prev, greetingEnabled: !prev.greetingEnabled }))}
                        style={{
                          width: "44px",
                          height: "24px",
                          borderRadius: "12px",
                          background: settings.greetingEnabled ? "#F59E0B" : "#D1D5DB",
                          cursor: "pointer",
                          transition: "background 0.3s",
                          position: "relative",
                          flexShrink: 0
                        }}
                      >
                        <div style={{
                          position: "absolute",
                          top: "2px",
                          left: settings.greetingEnabled ? "22px" : "2px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "white",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        }} />
                      </div>
                    </div>

                    {/* 3D. Greeting Bubble Text */}
                    <div style={{
                      opacity: settings.greetingEnabled ? 1 : 0,
                      maxHeight: settings.greetingEnabled ? "200px" : "0px",
                      overflow: "hidden",
                      transition: "opacity 0.3s, max-height 0.3s"
                    }}>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "6px" }}>
                        {t("widgetAppearance.greeting.greetingText")}
                      </div>
                      <input
                        type="text"
                        value={settings.greetingText}
                        onChange={(e) => setSettings(prev => ({ ...prev, greetingText: sanitizePlainText(e.target.value) }))}
                        maxLength={100}
                        placeholder={t("widgetAppearance.greeting.placeholder")}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1.5px solid #E8E0D4",
                          background: "#FFFCF9",
                          fontFamily: "Manrope",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#1A1D23",
                          outline: "none",
                          transition: "border-color 0.2s, box-shadow 0.2s"
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#F59E0B";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#E8E0D4";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                      <div style={{ fontFamily: "Manrope", fontSize: "10px", fontWeight: 500, color: "#94A3B8", textAlign: "right", marginTop: "4px" }}>
                        {settings.greetingText.length}/100
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ===== v3-OVERRIDE: Bu bölüm Part 6'da yeni SectionHeader + v3 içerikle değiştirilecek ===== */}
            {/* SECTION 4: AVATAR & MARKA */}
            <div style={{
              background: "#FFFCF9",
              borderRadius: "16px",
              border: openSection === 4 ? "1px solid rgba(245,158,11,0.2)" : "1px solid #F0E6D6",
              overflow: "hidden",
              transition: "border-color 0.2s"
            }}>
              {/* Header */}
              <div
                onClick={() => toggleSection(4)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 22px",
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.02)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>👤</span>
                  <span style={{ fontFamily: "Satoshi", fontSize: "15px", fontWeight: 700, color: "#1A1D23" }}>
                    {t("widgetAppearance.brand.title")}
                  </span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    fontFamily: "Satoshi",
                    background: "rgba(245,158,11,0.08)",
                    color: "#D97706"
                  }}>
                    5
                  </span>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: "transform 0.3s",
                    transform: openSection === 4 ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Body */}
              {openSection === 4 && (
                <div style={{ padding: "4px 22px 22px", animation: "fadeUp 0.3s ease both" }}>
                  <p style={{ fontFamily: "Manrope", fontSize: "12.5px", color: "#94A3B8", marginBottom: "16px" }}>
                    {t("widgetAppearance.brand.desc")}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                    {/* 4A. Brand Name */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "6px" }}>
                        {t("widgetAppearance.brand.name")}
                      </div>
                      <input
                        type="text"
                        value={settings.brandName || ""}
                        onChange={(e) => setSettings(prev => ({ ...prev, brandName: sanitizePlainText(e.target.value) }))}
                        maxLength={30}
                        placeholder={t("widgetAppearance.brand.namePlaceholder")}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1.5px solid #E8E0D4",
                          background: "#FFFCF9",
                          fontFamily: "Manrope",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#1A1D23",
                          outline: "none",
                          transition: "border-color 0.2s, box-shadow 0.2s"
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#F59E0B";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#E8E0D4";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>

                    {/* 4B. Bot Avatar (simple emoji grid) */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "10px" }}>
                        {t("widgetAppearance.brand.botAvatar")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {["🤖", "💬", "🎯", "⚡", "🌟", "🔮", "🦊", "🐻"].map((emoji) => (
                          <div
                            key={emoji}
                            style={{
                              width: "44px",
                              height: "44px",
                              borderRadius: "12px",
                              border: "2px solid #EDE8E0",
                              background: "white",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "20px",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#D4C8B8";
                              e.currentTarget.style.background = "#FFFDF8";
                              e.currentTarget.style.transform = "scale(1.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#EDE8E0";
                              e.currentTarget.style.background = "white";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            {emoji}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4C. Agent Avatar */}
                    <div>
                      <div style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23", marginBottom: "10px" }}>
                        {t("widgetAppearance.brand.agentAvatar")}
                      </div>
                      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexDirection: isMobile ? "column" : "row" }}>
                        {/* Emoji seçimi */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", flex: 1 }}>
                          {["👩‍💼", "👨‍💼", "👩‍🔧", "👨‍🔧", "🧑‍💻", "👩‍⚕️", "🧑‍🏫", "👷"].map((emoji) => (
                            <div
                              key={emoji}
                              style={{
                                width: "44px",
                                height: "44px",
                                borderRadius: "12px",
                                border: "2px solid #EDE8E0",
                                background: "white",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "20px",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#D4C8B8";
                                e.currentTarget.style.background = "#FFFDF8";
                                e.currentTarget.style.transform = "scale(1.08)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "#EDE8E0";
                                e.currentTarget.style.background = "white";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                            >
                              {emoji}
                            </div>
                          ))}
                        </div>

                        {/* Photo upload zone */}
                        <div
                          onClick={() => avatarFileRef.current?.click()}
                          style={{
                            flex: 1,
                            minWidth: "140px",
                            padding: "16px",
                            borderRadius: "12px",
                            border: "2px dashed #E2E8F0",
                            background: "#FAFAF8",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.2s",
                            textAlign: "center"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#F59E0B";
                            e.currentTarget.style.background = "#FFFBF5";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#E2E8F0";
                            e.currentTarget.style.background = "#FAFAF8";
                          }}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          <span style={{ fontFamily: "Satoshi", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                            {t("widgetAppearance.brand.uploadPhoto")}
                          </span>
                          <span style={{ fontFamily: "Manrope", fontSize: "10px", color: "#94A3B8" }}>
                            PNG, JPG, WebP · Max 2MB
                          </span>
                        </div>
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) {
                              setUpgradeNotice(t("widgetAppearance.brand.fileTooLarge"));
                              return;
                            }
                            // Handle file upload (simplified - would normally upload to server)
                          }}
                        />
                      </div>
                    </div>

                    {/* 4D. Powered by Helvion Toggle */}
                    <div style={{ borderTop: "1px solid #F0E6D6", paddingTop: "18px", marginTop: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <span style={{ fontFamily: "Satoshi", fontSize: "13px", fontWeight: 700, color: "#1A1D23" }}>
                              {t("widgetAppearance.brand.poweredBy")}
                            </span>
                            <span style={{
                              display: "inline-flex",
                              padding: "2px 6px",
                              borderRadius: "6px",
                              fontSize: "9px",
                              fontWeight: 700,
                              fontFamily: "Satoshi",
                              background: "rgba(245,158,11,0.1)",
                              color: "#D97706",
                              marginLeft: "6px"
                            }}>
                              PRO
                            </span>
                          </div>
                          <div style={{ fontFamily: "Manrope", fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                            {t("widgetAppearance.brand.poweredByDesc")}
                          </div>
                        </div>
                        <div
                          onClick={() => {
                            const isFreeOrStarter = planKey === "free" || planKey === "starter";
                            if (isFreeOrStarter) {
                              setUpgradeNotice(t("widgetAppearance.upgradeRequired"));
                              return;
                            }
                            setBrandingRequired(!brandingRequired);
                          }}
                          style={{
                            width: "44px",
                            height: "24px",
                            borderRadius: "12px",
                            background: !brandingRequired ? "#F59E0B" : "#D1D5DB",
                            cursor: "pointer",
                            transition: "background 0.3s",
                            position: "relative",
                            flexShrink: 0
                          }}
                        >
                          <div style={{
                            position: "absolute",
                            top: "2px",
                            left: !brandingRequired ? "22px" : "2px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "white",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                            transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ===== v3-OVERRIDE: Bu bölüm Part 7'de yeni SectionHeader + v3 içerikle değiştirilecek ===== */}
            {/* SECTION 5: PREMIUM PALETLER */}
            <div style={{
              background: "#FFFCF9",
              borderRadius: "16px",
              border: openSection === 5 ? "1px solid rgba(245,158,11,0.2)" : "1px solid #F0E6D6",
              overflow: "hidden",
              transition: "border-color 0.2s"
            }}>
              {/* Header */}
              <div
                onClick={() => toggleSection(5)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 22px",
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.02)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>👑</span>
                  <span style={{ fontFamily: "Satoshi", fontSize: "15px", fontWeight: 700, color: "#1A1D23" }}>
                    {t("widgetAppearance.premium.title")}
                  </span>
                  <span style={{
                    padding: "2px 6px",
                    borderRadius: "6px",
                    fontSize: "9px",
                    fontWeight: 700,
                    fontFamily: "Satoshi",
                    background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(139,92,246,0.1))",
                    color: "#D97706",
                    marginLeft: "6px"
                  }}>
                    PRO
                  </span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    fontFamily: "Satoshi",
                    background: "rgba(245,158,11,0.08)",
                    color: "#D97706"
                  }}>
                    {premiumPaletteList.length}
                  </span>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: "transform 0.3s",
                    transform: openSection === 5 ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Body */}
              {openSection === 5 && (
                <div style={{ padding: "4px 22px 22px", animation: "fadeUp 0.3s ease both" }}>
                  <p style={{ fontFamily: "Manrope", fontSize: "12.5px", color: "#94A3B8", marginBottom: "14px" }}>
                    {t("widgetAppearance.premium.desc")}
                  </p>

                  {/* Premium Grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: "14px"
                  }}>
                    {premiumPaletteList.map((palette) => {
                      const isActive = premiumPreviewId === palette.id;
                      const canApply = planKey === "pro" || planKey === "business" || planKey === "enterprise";
                      const isLocked = !canApply;

                      return (
                        <div
                          key={palette.id}
                          onClick={() => {
                            if (canApply) {
                              applyPremiumPreview(palette);
                            } else {
                              setUpgradeNotice(t("widgetAppearance.upgradeRequired"));
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (!canApply && !isActive) {
                              applyPremiumPreview(palette);
                            }
                            if (!isLocked) {
                              e.currentTarget.style.borderColor = isActive ? "#F59E0B" : "#D4C8B8";
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : "0 6px 16px rgba(0,0,0,0.06)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!canApply && isActive) {
                              revertPremiumPreview();
                            }
                            e.currentTarget.style.borderColor = isActive ? "#F59E0B" : "#EDE8E0";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : "none";
                          }}
                          style={{
                            padding: "16px",
                            borderRadius: "14px",
                            border: isActive ? "2px solid #F59E0B" : isLocked && isActive ? "2px solid rgba(139,92,246,0.3)" : "2px solid #EDE8E0",
                            background: isActive ? "#FFFBF5" : "white",
                            cursor: "pointer",
                            transition: "all 0.25s ease",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "10px",
                            position: "relative",
                            overflow: "hidden",
                            boxShadow: isActive ? "0 0 0 3px rgba(245,158,11,0.12)" : isLocked && isActive ? "0 0 0 3px rgba(139,92,246,0.08)" : "none"
                          }}
                        >
                          {/* Gradient preview bar */}
                          <div style={{
                            width: "100%",
                            height: "28px",
                            borderRadius: "8px",
                            background: `linear-gradient(${palette.gradient.angle}deg, ${palette.gradient.from}, ${palette.gradient.to})`,
                            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)"
                          }} />

                          {/* Color dots */}
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            {palette.colors.slice(0, 4).map((color, idx) => (
                              <div
                                key={idx}
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  borderRadius: "50%",
                                  background: color,
                                  border: "1.5px solid rgba(255,255,255,0.8)",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                }}
                              />
                            ))}
                          </div>

                          {/* Palette name */}
                          <span style={{
                            fontFamily: "Satoshi",
                            fontSize: "12px",
                            fontWeight: isActive ? 700 : 600,
                            color: isActive ? "#1A1D23" : "#475569",
                            textAlign: "center",
                            textTransform: "capitalize"
                          }}>
                            {palette.id.replace(/-/g, " ")}
                          </span>

                          {/* Status badge */}
                          {isActive && canApply && (
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: "8px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              fontFamily: "Satoshi",
                              background: "rgba(245,158,11,0.1)",
                              color: "#D97706"
                            }}>
                              {t("widgetAppearance.premium.applied")}
                            </span>
                          )}

                          {isActive && !canApply && (
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: "8px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              fontFamily: "Satoshi",
                              background: "rgba(139,92,246,0.08)",
                              color: "#7C3AED"
                            }}>
                              {t("widgetAppearance.premium.previewBadge")}
                            </span>
                          )}

                          {/* Lock overlay */}
                          {isLocked && !isActive && (
                            <div style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: "14px",
                              background: "rgba(255,255,255,0.5)",
                              backdropFilter: "blur(2px)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              zIndex: 2
                            }}>
                              <span style={{ fontSize: "20px" }}>🔒</span>
                              <span style={{ fontFamily: "Satoshi", fontSize: "10px", fontWeight: 600, color: "#7C3AED" }}>
                                {t("widgetAppearance.premium.locked")}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* ACCORDION SECTIONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* ==================== SECTION 0: TEMA ŞABLONLARI ==================== */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="🎨" title="Tema Sablonlari" count={THEMES.length + 1} isOpen={openSection === 0} onToggle={() => tog(0)} />
              {openSection === 0 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 14 }}>
                    {THEMES.map((item) => {
                      const sel = theme.id === item.id && !useCustom;
                      const isPremium = Boolean("pro" in item && item.pro);
                      const gradient = "gradient" in item ? item.gradient : undefined;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isPremium && !isPro) return showUpgrade(item.name);
                            setTheme(item);
                            setUseCustom(false);
                            markChanged();
                          }}
                          style={{
                            borderRadius: 10,
                            overflow: "hidden",
                            cursor: "pointer",
                            boxShadow: sel ? `0 0 0 2.5px ${item.color}, 0 6px 16px ${item.color}30` : "0 1px 4px rgba(0,0,0,0.06)",
                            transition: "all 0.3s ease",
                            background: sel ? item.light : "#FAFAF8",
                            position: "relative",
                            opacity: isPremium && !isPro ? 0.7 : 1,
                          }}
                        >
                          {isPremium && (
                            <div style={{ position: "absolute", top: 3, right: 3, zIndex: 2, fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}>
                              PRO
                            </div>
                          )}
                          <MiniWidget color={item.color} ring={item.dark} />
                          <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <div style={{ width: 9, height: 9, borderRadius: 3, background: gradient || `linear-gradient(135deg,${item.color},${item.dark})` }} />
                              <span style={{ fontFamily: s.fontH, fontSize: 9.5, fontWeight: 700, color: sel ? item.color : "#475569" }}>{item.name}</span>
                            </div>
                            {sel && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div
                    onClick={() => {
                      setUseCustom(true);
                      markChanged();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: useCustom ? "#FFFBF0" : "#FAFAF8",
                      border: useCustom ? `1.5px solid ${ac}` : "1.5px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ position: "relative", width: 32, height: 32 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "conic-gradient(from 0deg,#F43F5E,#F59E0B,#10B981,#0EA5E9,#8B5CF6,#F43F5E)" }} />
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => {
                          setCustomColor(e.target.value);
                          setUseCustom(true);
                          markChanged();
                        }}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontFamily: s.fontH, fontSize: 12, fontWeight: 700, color: "#1A1D23" }}>Ozel Renk</div>
                      <div style={{ fontFamily: s.fontMono, fontSize: 10, color: "#94A3B8" }}>{customColor.toUpperCase()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== SECTION 1: ICERIK & METINLER ==================== */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="✏️" title="Icerik & Metinler" count={5} isOpen={openSection === 1} onToggle={() => tog(1)} />
              {openSection === 1 && (
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.3s ease both" }}>
                  {[
                    { l: "Baslik", v: headerText, fn: setHeaderText, multi: false },
                    { l: "Alt Yazi", v: subText, fn: setSubText, multi: false },
                    { l: "Karsilama Mesaji", v: welcomeMsg, fn: setWelcomeMsg, multi: true },
                    { l: "Cevrimdisi Mesaj", v: offlineMsg, fn: setOfflineMsg, multi: true },
                    { l: "Baslatici Etiketi", v: launcherLabel, fn: setLauncherLabel, multi: false },
                  ].map((field) => (
                    <div key={field.l}>
                      <label style={s.label}>{field.l}</label>
                      {field.multi ? (
                        <textarea
                          value={field.v}
                          onChange={(e) => {
                            field.fn(e.target.value);
                            markChanged();
                          }}
                          style={{ ...s.input, resize: "vertical", minHeight: 55 }}
                        />
                      ) : (
                        <input
                          value={field.v}
                          onChange={(e) => {
                            field.fn(e.target.value);
                            markChanged();
                          }}
                          style={s.input}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ==================== SECTION 2: KONUSMA BASLATICILAR ==================== */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="🚀" title="Konusma Baslaticilar" count={starters.length} isOpen={openSection === 2} onToggle={() => tog(2)} isNew />
              {openSection === 2 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  {starters.map((st, i) => (
                    <div
                      key={st.id}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        marginBottom: 6,
                        borderRadius: 10,
                        background: dragIdx === i ? `rgba(${acRgb},0.07)` : st.active ? `rgba(${acRgb},0.03)` : "#F8F4EF",
                        border: dragIdx === i ? `1.5px dashed ${ac}` : st.active ? `1px solid rgba(${acRgb},0.12)` : "1px solid #F1F5F9",
                        cursor: "grab",
                      }}
                    >
                      <span style={{ cursor: "grab", color: "#CBD5E1", fontSize: 12 }}>⋮⋮</span>
                      <span style={{ flex: 1, fontFamily: s.font, fontSize: 12, fontWeight: 500, color: st.active ? "#1A1D23" : "#94A3B8" }}>{st.text}</span>
                      <div onClick={() => toggleStarter(st.id)} style={{ width: 32, height: 18, borderRadius: 9, cursor: "pointer", background: st.active ? `linear-gradient(135deg,${ac},${ad})` : "#E2E8F0", padding: 1.5 }}>
                        <div style={{ width: 15, height: 15, borderRadius: 8, background: "#FFF", transform: st.active ? "translateX(14px)" : "translateX(0)", transition: "transform 0.3s" }} />
                      </div>
                      <span onClick={() => removeStarter(st.id)} style={{ cursor: "pointer", color: "#CBD5E1", fontSize: 14, padding: "0 2px" }}>x</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <input
                      value={newStarter}
                      onChange={(e) => setNewStarter(e.target.value)}
                      placeholder="Yeni baslatici ekle..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addStarter();
                      }}
                      style={{ ...s.input, flex: 1, padding: "7px 11px", fontSize: 12 }}
                    />
                    <button
                      onClick={addStarter}
                      style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${ac},${ad})`, color: "#FFF", fontFamily: s.fontH, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      + Ekle
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== SECTION 3: BASLATICI STILI ==================== */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: s.border }}>
              <SectionHeader icon="💬" title="Baslatici Stili" count={4} isOpen={openSection === 3} onToggle={() => tog(3)} />
              {openSection === 3 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <label style={{ ...s.label, marginBottom: 8 }}>Sekil</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 16 }}>
                    {LAUNCHERS.map((l) => {
                      const sel = launcher.id === l.id;
                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            setLauncher(l);
                            markChanged();
                          }}
                          style={{ padding: "12px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center", border: sel ? `2px solid ${ac}` : "2px solid #F1F5F9", background: sel ? `rgba(${acRgb},0.04)` : "#FAFAF8" }}
                        >
                          <div style={{ width: Math.min(l.w * 0.55, 46), height: Math.min(l.h * 0.55, 30), borderRadius: l.radius, margin: "0 auto 6px", background: `linear-gradient(135deg,${ac},${ad})` }} />
                          <div style={{ fontFamily: s.font, fontSize: 10, fontWeight: 600, color: sel ? ac : "#64748B" }}>{l.name}</div>
                        </div>
                      );
                    })}
                  </div>

                  <label style={{ ...s.label, marginBottom: 8 }}>Konum</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {POSITIONS.map((p) => {
                      const sel = position.id === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setPosition(p);
                            markChanged();
                          }}
                          style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", textAlign: "center", border: sel ? `2px solid ${ac}` : "2px solid #F1F5F9", background: sel ? `rgba(${acRgb},0.04)` : "#FAFAF8" }}
                        >
                          <div style={{ width: 44, height: 32, borderRadius: 6, margin: "0 auto 6px", border: "1.5px solid #E2E8F0" }} />
                          <div style={{ fontFamily: s.font, fontSize: 10, fontWeight: 600, color: sel ? ac : "#64748B" }}>{p.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ==================== SECTION 4: AI ASISTAN AYARLARI ==================== */}
            <div style={{ background: s.card, borderRadius: 14, overflow: "hidden", border: `1px solid rgba(${acRgb},0.08)` }}>
              <SectionHeader icon="🤖" title="AI Asistan Ayarlari" count={8} badge="AI" isOpen={openSection === 12} onToggle={() => tog(12)} isNew />
              {openSection === 12 && (
                <div style={{ padding: 18, animation: "fadeUp 0.3s ease both" }}>
                  <input value={aiName} onChange={(e) => { setAiName(e.target.value); markChanged(); }} style={s.input} placeholder="AI Asistan Adi" />

                  <label style={{ ...s.label, marginBottom: 8, marginTop: 10 }}>Iletisim Tonu</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 14 }}>
                    {AI_TONES.map((tone) => {
                      const sel = aiTone === tone.id;
                      return (
                        <div key={tone.id} onClick={() => { setAiTone(tone.id); markChanged(); }} style={{ padding: "10px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center", boxShadow: sel ? `0 0 0 2px ${ac}` : "0 1px 3px rgba(0,0,0,0.05)", background: sel ? `rgba(${acRgb},0.04)` : "#FAFAF8" }}>
                          <div style={{ fontSize: 18, marginBottom: 3 }}>{tone.emoji}</div>
                          <div style={{ fontFamily: s.fontH, fontSize: 11.5, fontWeight: 700, color: sel ? ac : "#1A1D23" }}>{tone.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  <label style={{ ...s.label, marginBottom: 8 }}>Yanit Uzunlugu</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 14 }}>
                    {AI_LENGTHS.map((length) => {
                      const sel = aiLength === length.id;
                      return (
                        <div key={length.id} onClick={() => { setAiLength(length.id); markChanged(); }} style={{ padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center", boxShadow: sel ? `0 0 0 2px ${ac}` : "0 1px 3px rgba(0,0,0,0.05)", background: sel ? `rgba(${acRgb},0.04)` : "#FAFAF8" }}>
                          <div style={{ fontFamily: s.fontH, fontSize: 12, fontWeight: 700, color: sel ? ac : "#1A1D23" }}>{length.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  <label style={{ ...s.label, marginBottom: 8 }}>AI Model</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 14 }}>
                    {AI_MODELS.map((model) => {
                      const sel = aiModel === model.id;
                      return (
                        <div key={model.id} onClick={() => { setAiModel(model.id); markChanged(); }} style={{ padding: "8px 5px", borderRadius: 8, cursor: "pointer", textAlign: "center", boxShadow: sel ? `0 0 0 2px ${ac}` : "0 1px 2px rgba(0,0,0,0.04)", background: sel ? `rgba(${acRgb},0.03)` : "#FAFAF8" }}>
                          <div style={{ fontFamily: s.fontH, fontSize: 11, fontWeight: 700, color: sel ? ac : "#475569" }}>{model.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  <label style={{ ...s.label, marginBottom: 6 }}>AI Karsilama Mesaji</label>
                  <textarea value={aiWelcome} onChange={(e) => { setAiWelcome(e.target.value); markChanged(); }} style={{ ...s.input, minHeight: 60, resize: "vertical" }} />

                  <Toggle checked={aiEmoji} onChange={(v) => { setAiEmoji(v); markChanged(); }} label="Emoji Kullanimi" desc="AI yanitlarinda emoji kullansin" />
                  <Toggle checked={aiLabel} onChange={(v) => { setAiLabel(v); markChanged(); }} label="AI Agent Etiketi" desc="Mesajlarda AI rozeti goster" />
                  <Toggle checked={aiSuggestions} onChange={() => showUpgrade("Akilli Oneriler")} label="Akilli Oneriler" desc="Otomatik yanit onerileri" pro />
                </div>
              )}
            </div>

            {/* Part 6'da Section 5-9 buraya eklenecek */}
            {/* Part 7'de Section 10-12 buraya eklenecek */}
          </div>
        </div>

        {/* RIGHT PANEL - Live Preview (sticky) */}
        <div style={{
          width: isMobile ? "100%" : "420px",
          position: isMobile ? "relative" : "sticky",
          top: "24px",
          alignSelf: "flex-start",
          flexShrink: 0,
          order: isMobile ? -1 : 0
        }}>
          {/* Live Preview */}
          <div style={{
            background: "#FFFCF9",
            borderRadius: "16px",
            border: "1px solid #F0E6D6",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Preview Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              borderBottom: "1px solid #F0E6D6",
              background: "#FFFCF9"
            }}>
              <span style={{ fontFamily: "Satoshi", fontSize: "14px", fontWeight: 700, color: "#1A1D23" }}>
                {t("widgetAppearance.preview.title")}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {/* Device Toggle */}
                <div style={{
                  display: "flex",
                  borderRadius: "8px",
                  border: "1.5px solid #E8E0D4",
                  overflow: "hidden",
                  background: "#F8F4EF"
                }}>
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: previewDevice === "desktop" ? "white" : "transparent",
                      fontFamily: "Satoshi",
                      fontSize: "11.5px",
                      fontWeight: previewDevice === "desktop" ? 700 : 600,
                      color: previewDevice === "desktop" ? "#1A1D23" : "#94A3B8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.2s",
                      boxShadow: previewDevice === "desktop" ? "0 1px 3px rgba(0,0,0,0.06)" : "none"
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                    {t("widgetAppearance.preview.desktop")}
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: previewDevice === "mobile" ? "white" : "transparent",
                      fontFamily: "Satoshi",
                      fontSize: "11.5px",
                      fontWeight: previewDevice === "mobile" ? 700 : 600,
                      color: previewDevice === "mobile" ? "#1A1D23" : "#94A3B8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.2s",
                      boxShadow: previewDevice === "mobile" ? "0 1px 3px rgba(0,0,0,0.06)" : "none"
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                    {t("widgetAppearance.preview.mobile")}
                  </button>
                </div>

                {/* Widget State Toggle */}
                <div style={{
                  display: "flex",
                  borderRadius: "8px",
                  border: "1.5px solid #E8E0D4",
                  overflow: "hidden",
                  background: "#F8F4EF"
                }}>
                  <button
                    onClick={() => setPreviewOpen(true)}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: previewOpen ? "white" : "transparent",
                      fontFamily: "Satoshi",
                      fontSize: "11.5px",
                      fontWeight: previewOpen ? 700 : 600,
                      color: previewOpen ? "#1A1D23" : "#94A3B8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.2s",
                      boxShadow: previewOpen ? "0 1px 3px rgba(0,0,0,0.06)" : "none"
                    }}
                  >
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ADE80" }} />
                    {t("widgetAppearance.preview.stateOpen")}
                  </button>
                  <button
                    onClick={() => setPreviewOpen(false)}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: !previewOpen ? "white" : "transparent",
                      fontFamily: "Satoshi",
                      fontSize: "11.5px",
                      fontWeight: !previewOpen ? 700 : 600,
                      color: !previewOpen ? "#1A1D23" : "#94A3B8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.2s",
                      boxShadow: !previewOpen ? "0 1px 3px rgba(0,0,0,0.06)" : "none"
                    }}
                  >
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#CBD5E1" }} />
                    {t("widgetAppearance.preview.stateClosed")}
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Body */}
            <div style={{
              position: "relative",
              background: "#F1EDE8",
              minHeight: previewDevice === "desktop" ? "520px" : "480px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transition: "all 0.4s ease",
              ...(previewDevice === "mobile" ? {
                maxWidth: "280px",
                margin: "0 auto",
                borderRadius: "24px",
                border: "4px solid #1A1D23"
              } : {})
            }}>
              {/* Mobile Notch */}
              {previewDevice === "mobile" && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "100px",
                  height: "22px",
                  background: "#1A1D23",
                  borderRadius: "0 0 14px 14px",
                  zIndex: 10
                }} />
              )}

              {/* Fake Website Background */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, #FAFAF8 0%, #F5F2EE 100%)"
              }}>
                {/* Fake Nav Bar */}
                {previewDevice === "desktop" && (
                  <div style={{
                    height: "32px",
                    background: "white",
                    borderBottom: "1px solid #E8E0D4",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    gap: "6px"
                  }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FF6B6B" }} />
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FFD93D" }} />
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6BCB77" }} />
                    <div style={{
                      flex: 1,
                      height: "16px",
                      borderRadius: "4px",
                      background: "#F1F5F9",
                      marginLeft: "8px",
                      maxWidth: "180px"
                    }} />
                  </div>
                )}

                {/* Fake Content */}
                {previewDevice === "desktop" && (
                  <>
                    <div style={{ width: "60%", height: "8px", borderRadius: "4px", background: "#E8E0D4", margin: "12px 20px 0" }} />
                    <div style={{ width: "75%", height: "8px", borderRadius: "4px", background: "#E8E0D4", margin: "8px 20px 0" }} />
                    <div style={{ width: "40%", height: "8px", borderRadius: "4px", background: "#E8E0D4", margin: "8px 20px 0" }} />
                  </>
                )}
              </div>

              {/* Widget Preview */}
              <div style={{
                position: "absolute",
                bottom: previewDevice === "mobile" ? "12px" : "16px",
                right: settings.bubblePosition === "bottom-left" ? "auto" : (previewDevice === "mobile" ? "12px" : "16px"),
                left: settings.bubblePosition === "bottom-left" ? (previewDevice === "mobile" ? "12px" : "16px") : "auto",
                zIndex: 2,
                transition: "all 0.4s ease",
                maxWidth: previewDevice === "mobile" ? "260px" : "360px",
                width: "100%"
              }}>
                {previewOpen ? (
                  /* Widget Open State */
                  <div style={{
                    width: previewDevice === "mobile" ? "240px" : "320px",
                    borderRadius: "16px",
                    background: "white",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                    overflow: "hidden"
                  }}>
                    {/* Widget Header */}
                    <div style={{
                      background: `linear-gradient(${localTheme.gradientAngle}deg, ${localTheme.gradientFrom || localTheme.accentColor}, ${localTheme.gradientTo || localTheme.accentColor})`,
                      padding: "18px 16px",
                      color: "white"
                    }}>
                      <div style={{ fontFamily: "Satoshi", fontSize: "15px", fontWeight: 700 }}>
                        {settings.brandName || t("widgetAppearance.brand.namePlaceholder")}
                      </div>
                      <div style={{ fontFamily: "Manrope", fontSize: "12px", opacity: 0.9, marginTop: "2px" }}>
                        {settings.welcomeTitle}
                      </div>
                    </div>

                    {/* Widget Body */}
                    <div style={{
                      padding: "16px",
                      minHeight: "180px",
                      background: localTheme.surfaceColor || "#FAFAFA"
                    }}>
                      <div style={{
                        display: "inline-block",
                        padding: "10px 14px",
                        borderRadius: "14px 14px 14px 4px",
                        background: "white",
                        fontFamily: "Manrope",
                        fontSize: "12.5px",
                        color: localTheme.textColor || "#1A1D23",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        maxWidth: "85%"
                      }}>
                        {settings.welcomeMessage}
                      </div>
                    </div>

                    {/* Widget Footer */}
                    <div style={{
                      padding: "10px 14px",
                      borderTop: "1px solid #F0F0F0",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <div style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        background: "#FAFAFA",
                        fontFamily: "Manrope",
                        fontSize: "12px",
                        color: "#94A3B8"
                      }}>
                        {t("widgetAppearance.greeting.placeholder")}
                      </div>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: localTheme.accentColor || "#F59E0B",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer"
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </div>
                    </div>

                    {/* Powered by Footer */}
                    {brandingRequired && (
                      <div style={{
                        padding: "7px 14px",
                        borderTop: "1px solid rgba(0,0,0,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "3px 10px 3px 7px",
                          borderRadius: "20px",
                          background: `rgba(${hexToRgb(localTheme.accentColor || "#F59E0B")}, 0.04)`,
                          border: `1px solid rgba(${hexToRgb(localTheme.accentColor || "#F59E0B")}, 0.06)`
                        }}>
                          <div style={{
                            width: "14px",
                            height: "14px",
                            borderRadius: "4px",
                            background: `linear-gradient(135deg, ${localTheme.accentColor || "#F59E0B"}, ${localTheme.gradientTo || "#D97706"})`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                          </div>
                          <span style={{ fontFamily: "Satoshi", fontSize: "9.5px", fontWeight: 600, color: "#9CA3AF" }}>
                            Powered by <span style={{ fontWeight: 800, color: localTheme.accentColor || "#F59E0B" }}>Helvion</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Widget Closed State - Launcher Button */
                  <>
                    <div
                      style={{
                        width: settings.bubbleSize === 48 ? "48px" : settings.bubbleSize === 72 ? "64px" : "56px",
                        height: settings.bubbleSize === 48 ? "48px" : settings.bubbleSize === 72 ? "64px" : "56px",
                        borderRadius: settings.bubbleShape === "circle" ? "50%" : "16px",
                        background: `linear-gradient(${localTheme.gradientAngle}deg, ${localTheme.gradientFrom || localTheme.accentColor}, ${localTheme.gradientTo || localTheme.accentColor})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                        cursor: "pointer",
                        transition: "all 0.3s"
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>

                    {/* Greeting Bubble */}
                    {settings.greetingEnabled && settings.greetingText && (
                      <div style={{
                        position: "absolute",
                        bottom: settings.bubbleSize === 72 ? "80px" : "72px",
                        right: settings.bubblePosition === "bottom-left" ? "auto" : "0",
                        left: settings.bubblePosition === "bottom-left" ? "0" : "auto",
                        padding: "10px 14px",
                        borderRadius: settings.bubblePosition === "bottom-left" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        background: "white",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                        fontFamily: "Manrope",
                        fontSize: "12px",
                        color: "#1A1D23",
                        maxWidth: "200px",
                        zIndex: 3,
                        animation: "fadeUp 0.3s ease both"
                      }}>
                        {settings.greetingText}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Notice Toast */}
      {upgradeNotice && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 20px",
          borderRadius: "12px",
          background: "#1A1D23",
          color: "white",
          fontFamily: "Satoshi",
          fontSize: "13px",
          fontWeight: 600,
          boxShadow: "0 8px 30px rgba(0,0,0,0.2)"
        }}>
          <span>🔒</span>
          <span>{upgradeNotice}</span>
          <button
            onClick={() => router.push("/portal/billing")}
            style={{
              padding: "5px 12px",
              borderRadius: "8px",
              background: "#F59E0B",
              color: "white",
              fontSize: "12px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer"
            }}
          >
            {t("widgetAppearance.upgradeBtn")}
          </button>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </>
  );
}

export default function PortalWidgetAppearancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-600">Loading...</div>
        </div>
      }
    >
      <PortalWidgetAppearanceContent />
    </Suspense>
  );
}
