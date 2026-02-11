"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/Card";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useSearchParams } from "next/navigation";
import WidgetGallery from "@/components/widget/WidgetGallery";
import WidgetPreviewRenderer from "@/components/widget/WidgetPreviewRenderer";
import AvatarSelector from "@/components/widget/AvatarSelector";
import {
  WIDGET_THEME_PRESETS,
  PREMIUM_PALETTES,
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

const THEME_SHOWCASE = [
  { id: "midnight-blue", name: "Gece Mavisi", color: "#1E293B", ring: "#334155" },
  { id: "ocean-teal", name: "Okyanus", color: "#0D9488", ring: "#14B8A6" },
  { id: "sunset-orange", name: "Gün Batımı", color: "#F59E0B", ring: "#D97706" },
  { id: "royal-purple", name: "Kraliyet", color: "#8B5CF6", ring: "#7C3AED" },
  { id: "charcoal-cream", name: "Kömür", color: "#44403C", ring: "#57534E" },
  { id: "emerald-forest", name: "Zümrüt", color: "#059669", ring: "#047857" },
] as const;

const LEGACY_THEME_ID_MAP: Record<string, (typeof THEME_SHOWCASE)[number]["id"]> = {
  midnight: "midnight-blue",
  ocean: "ocean-teal",
  sunset: "sunset-orange",
  royal: "royal-purple",
  charcoal: "charcoal-cream",
  emerald: "emerald-forest",
};

function resolveThemeId(id: string): (typeof THEME_SHOWCASE)[number]["id"] | null {
  if ((THEME_SHOWCASE as readonly { id: string }[]).some((t) => t.id === id)) {
    return id as (typeof THEME_SHOWCASE)[number]["id"];
  }
  return LEGACY_THEME_ID_MAP[id] ?? null;
}

function MiniWidget({
  color,
  ring,
}: {
  color: string;
  ring: string;
}) {
  return (
    <div className="relative h-16 w-full overflow-hidden rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <div
        className="flex h-5 items-center gap-1.5 px-2"
        style={{ background: `linear-gradient(135deg, ${color}, ${ring})` }}
      >
        <span className="h-2 w-2 rounded-full bg-white/30" />
        <span className="h-1 w-8 rounded bg-white/40" />
      </div>
      <div className="space-y-1 px-2 py-1.5">
        <div className="h-[3px] w-7 rounded bg-slate-200" />
        <div className="h-[3px] w-5 rounded bg-slate-200" />
      </div>
      <span
        className="absolute bottom-1 right-1 h-[14px] w-[14px] rounded-full shadow-[0_2px_6px]"
        style={{ background: `linear-gradient(135deg, ${color}, ${ring})`, boxShadow: `0 2px 6px ${color}66` }}
      />
    </div>
  );
}

/** Helper: resolve avatar src from an AssetValue */
function resolveAvatarSrc(asset: { kind: string; value?: string }): string | null {
  if (asset.kind === "url" && asset.value) return asset.value;
  if (asset.kind === "uploadData" && asset.value) return asset.value;
  return null;
}

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
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

export default function PortalWidgetAppearancePage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const showDebugGallery =
    process.env.NODE_ENV === "development" && searchParams.get("debug") === "1";

  const [settings, setSettings] = useState<WidgetSettings>({
    primaryColor: DEFAULT_PRESET.primaryColor,
    position: "right",
    launcher: "bubble",
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

  const canEdit = user?.role === "owner" || user?.role === "admin";
  const isFree = planKey === "free";

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
      setSettings(s);
      setRequestId(data.requestId || null);

      // Plan entitlements
      if (data.planKey) setPlanKey(data.planKey);
      if (data.brandingRequired !== undefined) setBrandingRequired(data.brandingRequired);
      if (data.domainMismatchCount !== undefined) setDomainMismatchCount(data.domainMismatchCount);

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
      welcomeTitle: settings.welcomeTitle,
    };
    window.dispatchEvent(
      new CustomEvent("widget-settings-live-preview", {
        detail: { settings: liveSettings },
      })
    );
  }, [user, effectivePrimaryColor, settings.position, settings.launcher, settings.welcomeTitle]);

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
      setTimeout(() => setSaveMessage(null), 3000);
      const savedSettings = data?.settings && typeof data.settings === "object"
        ? {
            primaryColor: String(data.settings.primaryColor ?? settings.primaryColor),
            position: (data.settings.position === "left" ? "left" : "right") as "left" | "right",
            launcher: (data.settings.launcher === "icon" ? "icon" : "bubble") as "bubble" | "icon",
            welcomeTitle: String(data.settings.welcomeTitle ?? settings.welcomeTitle),
          }
        : {
            primaryColor: payloadSettings.primaryColor,
            position: settings.position,
            launcher: settings.launcher,
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
    setSaveMessage(t("widgetTheme.resetDone"));
    setTimeout(() => setSaveMessage(null), 3000);
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

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="widget-appear-animate flex items-center gap-1.5 text-[13px] font-[var(--font-body)]"
        style={{ ["--appear-delay" as string]: "0ms" }}
      >
        <a href="/portal" className="text-[#94A3B8] transition-colors hover:text-[#64748B]">
          {t("portalOnboarding.backToDashboard")}
        </a>
        <span className="text-[#D4D4D8]">/</span>
        <span className="font-semibold text-[#F59E0B]">{t("widgetAppearance.title")}</span>
      </div>
      <div
        className="widget-appear-animate flex items-start justify-between gap-4"
        style={{ ["--appear-delay" as string]: "50ms" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-[var(--font-heading)] text-[30px] font-extrabold leading-none text-[#1A1D23]">
              {t("widgetAppearance.title")}
            </h1>
            <span
              className="rounded-lg px-3 py-1 font-[var(--font-heading)] text-[12px] font-bold"
              style={{
                background: `linear-gradient(135deg, ${selectedShowcase.color}1A, ${selectedShowcase.color}0D)`,
                color: "#B45309",
              }}
            >
              5 {t("widgetConfig.slots")}
            </span>
          </div>
          <p className="mt-1.5 font-[var(--font-body)] text-[14px] text-[#64748B]">
            {t("widgetAppearance.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReset}
            disabled={!canEdit}
            className="rounded-xl border px-5 py-2.5 font-[var(--font-heading)] text-[13px] font-semibold text-[#64748B] transition-colors hover:bg-black/[0.04] disabled:opacity-50"
            style={{ borderColor: "rgba(0,0,0,0.1)" }}
          >
            ↻ {t("widgetTheme.reset")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canEdit}
            className="rounded-xl px-7 py-2.5 font-[var(--font-heading)] text-[14px] font-bold text-white transition-all hover:-translate-y-[1px] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              boxShadow: "0 4px 16px rgba(245,158,11,0.25)",
            }}
          >
            ✓ {saving ? t("widgetTheme.saving") : t("widgetTheme.save")}
          </button>
        </div>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          requestId={requestId}
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      )}

      {saveMessage && (
        <div className="mb-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 font-medium">
          {saveMessage}
        </div>
      )}
      {upgradeNotice && (
        <div
          className="mb-4 rounded-2xl border px-4 py-3 shadow-[0_6px_20px_rgba(245,158,11,0.12)]"
          style={{
            background: "linear-gradient(135deg, rgba(255,251,235,0.95), rgba(254,243,199,0.82))",
            borderColor: "rgba(245,158,11,0.28)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span
                className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  boxShadow: "0 4px 10px rgba(245,158,11,0.26)",
                }}
                aria-hidden="true"
              >
                <span className="text-[13px] text-white">✨</span>
              </span>
              <div>
                <p className="font-[var(--font-heading)] text-[13px] font-bold text-[#92400E]">
                  {upgradeNotice}
                </p>
              </div>
            </div>
            <Link
              href="/portal/billing"
              className="shrink-0 rounded-xl px-3 py-2 font-[var(--font-heading)] text-[12px] font-bold text-white transition hover:brightness-105"
              style={{
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                boxShadow: "0 4px 12px rgba(245,158,11,0.22)",
              }}
            >
              {t("settingsPortal.channelUpgrade")}
            </Link>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">
          {t("common.loading")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_440px]">
          {/* ─── LEFT: Settings Form ─── */}
          <div className="space-y-[14px]">
            {/* ── Theme Presets — Tidio/Crisp style ── */}
            <div
              className="widget-appear-animate rounded-[20px] border bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.03)]"
              style={{ ["--appear-delay" as string]: "100ms", borderColor: "rgba(0,0,0,0.05)" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] text-[16px]"
                    style={{
                      background: `linear-gradient(135deg, ${selectedShowcase.color}2E, ${selectedShowcase.color}14)`,
                      transition: "background 0.5s ease",
                    }}
                  >
                    🎭
                  </div>
                  <div>
                    <p className="font-[var(--font-heading)] text-[15px] font-bold text-[#1A1D23]">
                      {t("widgetTheme.presetsTitle")}
                    </p>
                    <p className="font-[var(--font-body)] text-[12px] text-[#94A3B8]">
                      {t("widgetTheme.presetsSubtitle")}
                    </p>
                  </div>
                </div>
                <span
                  className="rounded-lg px-3 py-1 font-[var(--font-heading)] text-[11px] font-bold"
                  style={{
                    background: `${selectedShowcase.color}1F`,
                    color: selectedShowcase.color,
                  }}
                >
                  {selectedShowcase.name} aktif
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {THEME_SHOWCASE.map((theme, index) => {
                  const preset = WIDGET_THEME_PRESETS.find((p) => p.presetId === theme.id);
                  const isActive = resolveThemeId(localTheme.presetId) === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => preset && applyPreset(preset)}
                      disabled={!canEdit || !preset}
                      title={theme.name}
                      className={`widget-theme-card widget-appear-animate rounded-2xl p-3 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                        isActive ? "widget-theme-card-active" : "widget-theme-card-default"
                      }`}
                      style={{
                        ["--theme-color" as string]: theme.color,
                        ["--appear-delay" as string]: `${150 + index * 50}ms`,
                      }}
                    >
                      <MiniWidget color={theme.color} ring={theme.ring} />
                      <div className="mt-2.5 flex items-center justify-between">
                        <span
                          className="font-[var(--font-heading)] text-[12.5px] font-bold transition-colors duration-300"
                          style={{ color: isActive ? theme.color : "#1A1D23" }}
                        >
                          {theme.name}
                        </span>
                        <span
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-all ${
                            isActive ? "border-[var(--theme-color)] bg-[var(--theme-color)]" : "border-black/10 bg-transparent"
                          }`}
                        >
                          {isActive ? (
                            <svg width={9} height={9} viewBox="0 0 24 24" fill="none">
                              <polyline
                                points="20 6 9 17 4 12"
                                stroke="#fff"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : null}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {accordionItems.map((item, index) => {
              const isOpen =
                (item.id === "customize" && showCustomize) ||
                (item.id === "premiumPalettes" && showPremiumPalettes) ||
                (item.id === "avatarLauncher" && showAvatarLauncher) ||
                (item.id === "size" && showSizeMenu) ||
                (item.id === "settings" && showSettings);
              return (
                <div
                  key={item.id}
                  className="widget-appear-animate rounded-2xl bg-white"
                  style={{
                    ["--appear-delay" as string]: `${300 + index * 50}ms`,
                    border: isOpen
                      ? `1px solid ${selectedShowcase.color}33`
                      : "1px solid rgba(0,0,0,0.05)",
                    boxShadow: isOpen
                      ? `0 4px 24px ${selectedShowcase.color}14`
                      : "0 1px 4px rgba(0,0,0,0.02)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => togglePanel(item.id)}
                    className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left"
                  >
                    <div
                      className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl text-[18px]"
                      style={{
                        background: isOpen
                          ? `linear-gradient(135deg, ${selectedShowcase.color}, ${selectedShowcase.ring})`
                          : `linear-gradient(135deg, ${selectedShowcase.color}1A, ${selectedShowcase.color}0A)`,
                        boxShadow: isOpen ? `0 4px 16px ${selectedShowcase.color}4D` : "none",
                        filter: "none",
                        transition: "all 0.35s ease",
                      }}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-[var(--font-heading)] text-[14.5px] font-bold"
                          style={{ color: isOpen ? "#B45309" : "#1A1D23", transition: "color 0.3s ease" }}
                        >
                          {item.title}
                        </span>
                        {item.pro ? (
                          <span
                            className="rounded-md px-2 py-[2px] font-[var(--font-heading)] text-[10px] font-bold text-white"
                            style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
                          >
                            PRO
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-[var(--font-body)] text-[12px] text-[#94A3B8]">
                        {item.desc}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="rounded-md bg-black/[0.03] px-2 py-[2px] font-[var(--font-body)] text-[11px] text-[#CBD5E1]">
                        {item.items} ayar
                      </span>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg"
                        style={{
                          background: isOpen ? `${selectedShowcase.color}1F` : "rgba(0,0,0,0.03)",
                          transition: "all 0.3s ease",
                        }}
                      >
                        <svg
                          width={14}
                          height={14}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={isOpen ? selectedShowcase.color : "#94A3B8"}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "all 0.3s ease" }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </div>
                  </button>
                  {isOpen ? (
                    <div
                      style={{
                        borderTop: `1px solid ${selectedShowcase.color}14`,
                        padding: "8px 0 12px",
                      }}
                    >
                      {item.id === "customize" ? (
                        <div className="space-y-2">
                          <p className="px-4 pb-1 pt-3 font-[var(--font-heading)] text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: selectedShowcase.color }}>
                            {t("widgetTheme.groupBrand")}
                          </p>
                          <ColorRow
                            label={t("widgetAppearance.primaryColor")}
                            value={settings.primaryColor}
                            themeColor={selectedShowcase.color}
                            disabled={!canEdit}
                            onChange={(v) => {
                              setSettings({ ...settings, primaryColor: v });
                            }}
                            validate={validateColor}
                          />
                          <ColorRow
                            label={t("widgetTheme.accentColor")}
                            value={localTheme.accentColor}
                            themeColor={selectedShowcase.color}
                            disabled={!canEdit}
                            onChange={(v) => updateLocal({ accentColor: v })}
                            validate={validateColor}
                          />
                          <ColorRow
                            label={t("widgetTheme.surfaceColor")}
                            value={localTheme.surfaceColor}
                            themeColor={selectedShowcase.color}
                            disabled={!canEdit}
                            onChange={(v) => updateLocal({ surfaceColor: v })}
                            validate={validateColor}
                          />
                          <div className="mx-4 my-2 h-px bg-black/[0.04]" />
                          <p className="px-4 pb-1 pt-1 font-[var(--font-heading)] text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: selectedShowcase.color }}>
                            {t("widgetTheme.groupGradient")}
                          </p>
                          <ColorRow
                            label={t("widgetTheme.gradientFrom")}
                            value={localTheme.gradientFrom}
                            themeColor={selectedShowcase.color}
                            disabled={!canEdit}
                            onChange={(v) => updateLocal({ gradientFrom: v })}
                            validate={validateColor}
                          />
                          <ColorRow
                            label={t("widgetTheme.gradientTo")}
                            value={localTheme.gradientTo}
                            themeColor={selectedShowcase.color}
                            disabled={!canEdit}
                            onChange={(v) => updateLocal({ gradientTo: v })}
                            validate={validateColor}
                          />
                          <div
                            className="mx-4 mb-2 mt-1 h-2 rounded"
                            style={{
                              background: `linear-gradient(90deg, ${localTheme.gradientFrom}, ${localTheme.gradientTo})`,
                              boxShadow: `0 2px 8px ${localTheme.gradientFrom}4D`,
                            }}
                          />
                          <div className="mx-4 my-2 h-px bg-black/[0.04]" />
                          <p className="px-4 pb-1 pt-1 font-[var(--font-heading)] text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: selectedShowcase.color }}>
                            {t("widgetTheme.groupLayout")}
                          </p>
                          <div className="px-4 pt-1">
                            <p className="mb-2 font-[var(--font-body)] text-[12px] text-[#64748B]">{t("widgetAppearance.position")}</p>
                            <div className="flex gap-2">
                              <OptionBtn
                                selected={settings.position === "left"}
                                themeColor={selectedShowcase.color}
                                onClick={() => setSettings({ ...settings, position: "left" })}
                                disabled={!canEdit}
                              >
                                <span>☰</span>
                                <span>{t("widgetAppearance.positionLeft")}</span>
                              </OptionBtn>
                              <OptionBtn
                                selected={settings.position === "right"}
                                themeColor={selectedShowcase.color}
                                onClick={() => setSettings({ ...settings, position: "right" })}
                                disabled={!canEdit}
                              >
                                <span>☰</span>
                                <span>{t("widgetAppearance.positionRight")}</span>
                              </OptionBtn>
                            </div>
                          </div>
                          <div className="px-4 pt-2">
                            <p className="mb-2 font-[var(--font-body)] text-[12px] text-[#64748B]">{t("widgetAppearance.launcher")}</p>
                            <div className="flex gap-2">
                              <OptionBtn
                                selected={settings.launcher === "bubble"}
                                themeColor={selectedShowcase.color}
                                onClick={() => setSettings({ ...settings, launcher: "bubble" })}
                                disabled={!canEdit}
                              >
                                <span>💬</span>
                                <span>{t("widgetAppearance.launcherBubble")}</span>
                              </OptionBtn>
                              <OptionBtn
                                selected={settings.launcher === "icon"}
                                themeColor={selectedShowcase.color}
                                onClick={() => setSettings({ ...settings, launcher: "icon" })}
                                disabled={!canEdit}
                              >
                                <span>😊</span>
                                <span>{t("widgetAppearance.launcherIcon")}</span>
                              </OptionBtn>
                            </div>
                          </div>
                          <div className="px-4 pt-3">
                            <button
                              onClick={handleReset}
                              disabled={!canEdit}
                              className="rounded-[10px] border border-black/10 px-4 py-2 font-[var(--font-body)] text-[12px] text-[#94A3B8] transition-colors hover:bg-black/[0.02] disabled:opacity-50"
                            >
                              ↺ {t("widgetTheme.reset")}
                            </button>
                          </div>
                        </div>
                      ) : item.id === "premiumPalettes" ? (
                        <div className="space-y-2 px-4 py-1">
                          {PREMIUM_PALETTES.map((palette) => {
                            const isSelected =
                              premiumPreviewId === palette.id ||
                              (!isFree &&
                                settings.primaryColor === palette.primaryColor &&
                                localTheme.gradientFrom === palette.gradient.from &&
                                localTheme.gradientTo === palette.gradient.to);
                            const paletteTone = palette.primaryColor;
                            return (
                              <button
                                key={palette.id}
                                onClick={() => {
                                  if (isFree) {
                                    if (premiumPreviewId === palette.id) revertPremiumPreview();
                                    else applyPremiumPreview(palette);
                                  } else {
                                    setSettings({ ...settings, primaryColor: palette.primaryColor });
                                    updateLocal({
                                      accentColor: palette.accentColor,
                                      surfaceColor: palette.surfaceColor,
                                      gradientFrom: palette.gradient.from,
                                      gradientTo: palette.gradient.to,
                                      gradientAngle: palette.gradient.angle,
                                    });
                                  }
                                }}
                                disabled={!canEdit}
                                className="flex w-full items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-3 text-left transition-all"
                                style={{
                                  background: isSelected ? `${selectedShowcase.color}0F` : "transparent",
                                  borderColor: isSelected ? `${selectedShowcase.color}4D` : "transparent",
                                }}
                              >
                                <div
                                  className="h-8 w-[52px] flex-shrink-0 rounded-[10px]"
                                  style={{
                                    background: `linear-gradient(135deg, ${palette.gradient.from}, ${palette.gradient.to})`,
                                    boxShadow: isSelected ? `0 4px 16px ${paletteTone}4D` : "0 2px 6px rgba(0,0,0,0.08)",
                                  }}
                                />
                                <div className="flex items-center gap-[5px]">
                                  {palette.colors.slice(0, 5).map((c, i) => (
                                    <span key={i} className="h-[14px] w-[14px] rounded-full border-[1.5px] border-white/50 shadow-[0_1px_3px_rgba(0,0,0,0.1)]" style={{ backgroundColor: c }} />
                                  ))}
                                </div>
                                <span className="ml-1 flex-1 font-[var(--font-heading)] text-[13px] font-bold" style={{ color: isSelected ? selectedShowcase.color : "#1A1D23" }}>
                                  {t(`widgetConfig.palette.${palette.id}`)}
                                </span>
                                {isSelected ? (
                                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full" style={{ background: selectedShowcase.color }}>
                                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                                      <polyline points="20 6 9 17 4 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                          <div
                            className="mx-0 mt-2 flex items-center gap-2.5 rounded-xl border px-4 py-3"
                            style={{
                              background: `linear-gradient(135deg, ${selectedShowcase.color}14, ${selectedShowcase.color}08)`,
                              borderColor: `${selectedShowcase.color}26`,
                            }}
                          >
                            <span className="text-[18px]">✨</span>
                            <div className="min-w-0">
                              <p className="font-[var(--font-heading)] text-[12px] font-bold text-[#1A1D23]">
                                {t("widgetConfig.premiumPalettesLocked")}
                              </p>
                              <p className="mt-0.5 font-[var(--font-body)] text-[11px] font-semibold" style={{ color: selectedShowcase.color }}>
                                {t("widgetConfig.unlockPalettes")} →
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : item.id === "avatarLauncher" ? (
                        <div className="px-4 py-1">
                          <AvatarSelector currentPlan={currentPlan} onAvatarChange={handleAvatarChange} />
                        </div>
                      ) : item.id === "size" ? (
                        <div className="flex flex-col gap-4 px-4 py-1">
                          <div>
                            <p className="mb-2 font-[var(--font-heading)] text-[12px] font-semibold text-[#64748B]">{t("widgetConfig.widthPreset")}</p>
                            <div className="flex gap-2">
                              {(["compact", "default", "large"] as WidthPreset[]).map((preset) => {
                                const active = widgetConfig.size.customWidth === getWidthFromPreset(preset);
                                return (
                                  <OptionBtn
                                    key={preset}
                                    selected={active}
                                    themeColor={selectedShowcase.color}
                                    onClick={() => updateWidgetConfig({ size: { widthPreset: preset, customWidth: getWidthFromPreset(preset) } })}
                                    disabled={!canEdit}
                                  >
                                    {t(`widgetConfig.width${preset.charAt(0).toUpperCase() + preset.slice(1)}`)}
                                  </OptionBtn>
                                );
                              })}
                            </div>
                            <input
                              type="range"
                              min={320}
                              max={520}
                              step={10}
                              value={Math.min(520, Math.max(320, widgetConfig.size.customWidth))}
                              onChange={(e) => updateWidgetConfig({ size: { customWidth: Number(e.target.value) } })}
                              disabled={!canEdit}
                              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full"
                              style={getRangeTrackStyle(widgetConfig.size.customWidth, 320, 520)}
                            />
                          </div>
                          <div>
                            <p className="mb-2 font-[var(--font-heading)] text-[12px] font-semibold text-[#64748B]">{t("widgetConfig.heightPreset")}</p>
                            <div className="flex gap-2">
                              {(["short", "auto", "default"] as HeightPreset[]).map((preset) => {
                                const active = widgetConfig.size.customMaxHeight === getMaxHeightFromPreset(preset);
                                return (
                                  <OptionBtn
                                    key={preset}
                                    selected={active}
                                    themeColor={selectedShowcase.color}
                                    onClick={() => updateWidgetConfig({ size: { heightPreset: preset, customMaxHeight: getMaxHeightFromPreset(preset) } })}
                                    disabled={!canEdit}
                                  >
                                    {t(`widgetConfig.height${preset.charAt(0).toUpperCase() + preset.slice(1)}`)}
                                  </OptionBtn>
                                );
                              })}
                            </div>
                            <input
                              type="range"
                              min={420}
                              max={900}
                              step={20}
                              value={(() => {
                                const v = Number(widgetConfig.size.customMaxHeight);
                                return Number.isFinite(v) ? Math.min(900, Math.max(420, v)) : 560;
                              })()}
                              onChange={(e) => {
                                const num = parseInt(e.target.value, 10);
                                if (!Number.isFinite(num)) return;
                                const clamped = Math.min(900, Math.max(420, num));
                                updateWidgetConfig({ size: { ...widgetConfig.size, customMaxHeight: clamped } });
                              }}
                              disabled={!canEdit}
                              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full"
                              style={getRangeTrackStyle(widgetConfig.size.customMaxHeight, 420, 900)}
                            />
                          </div>
                          <div>
                            <p className="mb-2 font-[var(--font-heading)] text-[12px] font-semibold text-[#64748B]">{t("widgetConfig.density")}</p>
                            <div className="flex gap-2">
                              {(["compact", "comfortable"] as const).map((d) => (
                                <OptionBtn
                                  key={d}
                                  selected={widgetConfig.size.density === d}
                                  themeColor={selectedShowcase.color}
                                  onClick={() => updateWidgetConfig({ size: { density: d } })}
                                  disabled={!canEdit}
                                >
                                  {t(d === "compact" ? "widgetConfig.densityCompact" : "widgetConfig.densityComfortable")}
                                </OptionBtn>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 px-4 py-1">
                          <div>
                            <label className="mb-1.5 block font-[var(--font-heading)] text-[12.5px] font-semibold text-[#1A1D23]">{t("widgetAppearance.welcomeTitle")}</label>
                            <input
                              type="text"
                              value={settings.welcomeTitle}
                              onChange={(e) => setSettings({ ...settings, welcomeTitle: e.target.value.slice(0, 60) })}
                              disabled={!canEdit}
                              maxLength={60}
                              className="w-full rounded-xl border-[1.5px] border-black/10 bg-[#FAFAF8] px-3.5 py-2.5 font-[var(--font-body)] text-[13px] text-[#1A1D23] focus:outline-none"
                              style={{ boxShadow: `0 0 0 0 ${selectedShowcase.color}` }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = selectedShowcase.color;
                                e.currentTarget.style.boxShadow = `0 0 0 3px ${selectedShowcase.color}26`;
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
                                e.currentTarget.style.boxShadow = "none";
                              }}
                            />
                            <p className="mt-1 font-[var(--font-body)] text-[11px]" style={{ color: selectedShowcase.color }}>
                              {settings.welcomeTitle.length}/60
                            </p>
                          </div>
                          <div>
                            <label className="mb-1.5 block font-[var(--font-heading)] text-[12.5px] font-semibold text-[#1A1D23]">{t("widgetAppearance.welcomeMessage")}</label>
                            <textarea
                              value={settings.welcomeMessage}
                              onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value.slice(0, 240) })}
                              disabled={!canEdit}
                              maxLength={240}
                              rows={4}
                              className="min-h-[80px] w-full resize-y rounded-xl border-[1.5px] border-black/10 bg-[#FAFAF8] px-3.5 py-3 font-[var(--font-body)] text-[13px] leading-[1.5] text-[#1A1D23] focus:outline-none"
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = selectedShowcase.color;
                                e.currentTarget.style.boxShadow = `0 0 0 3px ${selectedShowcase.color}26`;
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
                                e.currentTarget.style.boxShadow = "none";
                              }}
                            />
                            <p className="mt-1 font-[var(--font-body)] text-[11px]" style={{ color: selectedShowcase.color }}>
                              {settings.welcomeMessage.length}/240
                            </p>
                          </div>
                          <div>
                            <label className="mb-1.5 block font-[var(--font-heading)] text-[12.5px] font-semibold text-[#1A1D23]">{t("widgetAppearance.brandName")}</label>
                            <input
                              type="text"
                              value={settings.brandName || ""}
                              onChange={(e) => setSettings({ ...settings, brandName: e.target.value.slice(0, 40) || null })}
                              disabled={!canEdit}
                              maxLength={40}
                              className="w-full rounded-xl border-[1.5px] border-black/10 bg-[#FAFAF8] px-3.5 py-2.5 font-[var(--font-body)] text-[13px] text-[#1A1D23] focus:outline-none"
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = selectedShowcase.color;
                                e.currentTarget.style.boxShadow = `0 0 0 3px ${selectedShowcase.color}26`;
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
                                e.currentTarget.style.boxShadow = "none";
                              }}
                            />
                            <p className="mt-1 font-[var(--font-body)] text-[11px]" style={{ color: selectedShowcase.color }}>
                              {(settings.brandName || "").length}/40
                            </p>
                          </div>
                          <div className="mx-0 my-1 h-px bg-black/[0.04]" />
                          <div>
                            <label className="mb-2 block font-[var(--font-heading)] text-[12.5px] font-semibold text-[#1A1D23]">{t("widgetConfig.brandingToggle")}</label>
                            <div className="flex gap-2">
                              <OptionBtn selected={brandingRequired} themeColor={selectedShowcase.color} onClick={() => {}} disabled={brandingRequired}>
                                👁️ {t("widgetConfig.brandingOn")}
                              </OptionBtn>
                              <OptionBtn selected={!brandingRequired} themeColor={selectedShowcase.color} onClick={() => {}} disabled={brandingRequired}>
                                🙈 {t("widgetConfig.brandingOff")}
                              </OptionBtn>
                            </div>
                            <div
                              className="mt-2 rounded-xl border px-4 py-3"
                              style={{
                                background: `linear-gradient(135deg, ${selectedShowcase.color}14, ${selectedShowcase.color}08)`,
                                borderColor: `${selectedShowcase.color}26`,
                              }}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="mt-0.5 text-[16px]">✨</span>
                                <div className="min-w-0">
                                  <p className="font-[var(--font-body)] text-[12px] text-[#64748B]">{t("widgetConfig.brandingFreeLocked")}</p>
                                  <p className="mt-0.5 font-[var(--font-body)] text-[11px] font-semibold" style={{ color: selectedShowcase.color }}>
                                    {t("widgetConfig.brandingUpgrade")}
                                  </p>
                                </div>
                              </div>
                              <Link
                                href="/portal/billing"
                                className="mt-3 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 font-[var(--font-heading)] text-[12px] font-bold text-white transition hover:brightness-105"
                                style={{
                                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                                  boxShadow: "0 4px 10px rgba(245,158,11,0.22)",
                                }}
                              >
                                {t("settingsPortal.channelUpgrade")} →
                              </Link>
                            </div>
                          </div>
                          {domainMismatchCount > 0 ? (
                            <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2.5">
                              <p className="font-[var(--font-heading)] text-[12px] font-semibold text-[#B91C1C]">
                                {t("widgetConfig.domainMismatch")} ({domainMismatchCount})
                              </p>
                              <p className="mt-0.5 font-[var(--font-body)] text-[11px] text-[#7F1D1D]">
                                {t("widgetConfig.domainMismatchDesc")}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* ─── RIGHT: Live Preview (clean — no controls on top) ─── */}
          <div className="space-y-6 self-start">
            <div className="sticky top-5 self-start max-h-[calc(100vh-100px)] overflow-y-auto">
              <WidgetPreviewRenderer
                settings={settings}
                theme={{
                  accentColor: localTheme.accentColor,
                  surfaceColor: localTheme.surfaceColor,
                  gradient: {
                    from: localTheme.gradientFrom,
                    to: localTheme.gradientTo,
                    angle: localTheme.gradientAngle,
                  },
                }}
                size={{
                  customWidth: widgetConfig.size.customWidth,
                  customMaxHeight: widgetConfig.size.customMaxHeight,
                }}
                avatars={{
                  botSrc: widgetConfig.avatars.botEnabled ? resolveAvatarSrc(widgetConfig.avatars.botAsset) : null,
                  agentSrcs: widgetConfig.avatars.agents.map((a) => resolveAvatarSrc(a.asset)),
                }}
                launcher={{
                  label: widgetConfig.launcher.launcherLabel,
                  style: widgetConfig.launcher.launcherStyle === "button" ? "button" : "bubble",
                }}
              />
            </div>

            {/* Debug Gallery — only dev+debug=1 */}
            {showDebugGallery && (
              <Card variant="elevated" padding="none">
                <button
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    {showDebugPanel ? (
                      <ChevronDown size={18} className="text-slate-500" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-500" />
                    )}
                    <span className="text-sm font-semibold text-slate-700">
                      Reference Gallery (Debug)
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                      Optional
                    </span>
                  </div>
                </button>

                {showDebugPanel && (
                  <div className="px-5 pb-5">
                    <WidgetGallery />
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
      <style jsx>{`
        .widget-appear-animate {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeSlideUp 0.5s ease both;
          animation-delay: var(--appear-delay, 0ms);
        }
        .widget-theme-card {
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid rgba(0, 0, 0, 0.04);
          background: #fafaf9;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .widget-theme-card-default:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
          background: rgba(0, 0, 0, 0.015);
        }
        .widget-theme-card-active {
          background: color-mix(in srgb, var(--theme-color) 6%, white);
          border-color: var(--theme-color);
          box-shadow: 0 6px 24px color-mix(in srgb, var(--theme-color) 18%, transparent);
        }
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .widget-appear-animate,
          .widget-theme-card {
            animation: none !important;
            transition-duration: 0.01ms !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

function OptionBtn({
  selected,
  themeColor,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  themeColor: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-[var(--font-heading)] text-[12.5px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${themeColor}, ${themeColor}DD)`,
              color: "#FFFFFF",
              boxShadow: `0 3px 12px ${themeColor}4D`,
            }
          : {
              background: "#FFFFFF",
              color: "#64748B",
              border: "1.5px solid rgba(0,0,0,0.08)",
            }
      }
    >
      {children}
    </button>
  );
}

function ColorRow({
  label,
  value,
  themeColor,
  disabled,
  onChange,
  validate,
}: {
  label: string;
  value: string;
  themeColor: string;
  disabled: boolean;
  onChange: (v: string) => void;
  validate: (v: string) => boolean;
}) {
  const safe = validate(value) ? value : "#000000";
  return (
    <div className="group mx-2 flex items-center gap-3.5 rounded-[14px] px-4 py-3 transition-all hover:bg-black/[0.015]">
      <label className="relative flex h-[42px] w-[42px] flex-shrink-0 cursor-pointer">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div
          className="h-[42px] w-[42px] rounded-xl border-[3px] border-white transition-all"
          style={{
            backgroundColor: safe,
            boxShadow: `0 3px 12px ${safe}4D`,
            outline: "2px solid transparent",
          }}
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="font-[var(--font-heading)] text-[13px] font-semibold text-[#1A1D23]">{label}</p>
        <p className="font-[var(--font-body)] text-[12px] uppercase tracking-[0.05em] text-[#94A3B8]">{safe}</p>
      </div>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.03] opacity-30 transition-opacity group-hover:opacity-100">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
      <style jsx>{`
        .group:hover label > div {
          outline-color: ${themeColor};
        }
      `}</style>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (validate(v) || v.startsWith("#")) onChange(v);
        }}
        disabled={disabled}
        className="hidden"
      />
    </div>
  );
}
