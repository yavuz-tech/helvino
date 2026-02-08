"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useSearchParams } from "next/navigation";
import WidgetGallery from "@/components/widget/WidgetGallery";
import WidgetPreviewRenderer from "@/components/widget/WidgetPreviewRenderer";
import {
  WIDGET_THEME_PRESETS,
  DEFAULT_PRESET,
  findPresetByColor,
  type WidgetTheme,
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
  type LauncherStyle,
} from "@/lib/widgetConfig";

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
}

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
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showAvatarLauncher, setShowAvatarLauncher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(
    () => loadWidgetConfig() ?? DEFAULT_WIDGET_CONFIG
  );

  // Plan entitlements from API
  const [planKey, setPlanKey] = useState<string>("free");
  const [brandingRequired, setBrandingRequired] = useState(true);
  const [maxAgents, setMaxAgents] = useState(1);
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
      if (data.maxAgents !== undefined) setMaxAgents(data.maxAgents);
      if (data.domainMismatchCount !== undefined) setDomainMismatchCount(data.domainMismatchCount);

      /* Restore local theme overrides */
      const saved = loadLocalTheme();
      if (saved) {
        setLocalTheme(saved);
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

  /* ── Apply a preset ── */
  const applyPreset = useCallback(
    (preset: WidgetTheme, persist = true) => {
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

  /* ── Save to API ── */
  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/widget/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
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

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("widgetAppearance.title")}
        subtitle={t("widgetAppearance.subtitle")}
        backButton={{
          href: "/portal",
          label: t("portalOnboarding.backToDashboard"),
        }}
      />

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

      {loading ? (
        <div className="text-center py-12 text-slate-500">
          {t("common.loading")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ─── LEFT: Settings Form ─── */}
          <div className="space-y-4">
            {/* ── Preset Theme Cards (stunning) ── */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {t("widgetTheme.presetsTitle")}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {WIDGET_THEME_PRESETS.map((preset) => {
                  const isActive = localTheme.presetId === preset.presetId;
                  return (
                    <button
                      key={preset.presetId}
                      onClick={() => applyPreset(preset)}
                      disabled={!canEdit}
                      className={`preset-card ${isActive ? "active" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                      style={{
                        background: `linear-gradient(${preset.gradient.angle}deg, ${preset.gradient.from}, ${preset.gradient.to})`,
                        ["--preset-glow" as string]: `${preset.gradient.from}80`,
                      }}
                      title={t(`widgetTheme.preset.${preset.presetId}.desc`)}
                      data-preset-id={preset.presetId}
                    >
                      <div className="preset-card-inner">
                        {/* Large gradient swatch */}
                        <div
                          className="w-full aspect-square rounded-lg shadow-inner"
                          style={{
                            background: `linear-gradient(${preset.gradient.angle + 45}deg, ${preset.gradient.from}, ${preset.primaryColor}, ${preset.gradient.to})`,
                          }}
                        />
                        <span className="text-[10px] font-bold text-slate-700 text-center leading-tight truncate w-full">
                          {t(`widgetTheme.preset.${preset.presetId}`)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 1. Renkleri Özelleştir — customize-btn-animated ── */}
            <div>
              <button
                type="button"
                onClick={() => setShowCustomize(!showCustomize)}
                className="w-full rounded-xl customize-btn-animated text-left"
              >
                <div className="customize-btn-inner">
                  <div className="flex items-center gap-2">
                    {showCustomize ? (
                      <ChevronDown size={18} className="text-slate-600" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-600" />
                    )}
                    <span className="text-sm font-semibold text-slate-800">
                      {t("widgetTheme.customizeTitle")}
                    </span>
                  </div>
                </div>
              </button>

              {showCustomize && (
                <div className="mt-3 bg-white rounded-xl border border-slate-200 px-5 pt-4 pb-5 space-y-5">
                  {/* Primary Color */}
                  <ColorField
                    label={t("widgetAppearance.primaryColor")}
                    value={settings.primaryColor}
                    disabled={!canEdit}
                    onChange={(v) => {
                      setSettings({ ...settings, primaryColor: v });
                      updateLocal({ gradientFrom: v });
                    }}
                    validate={validateColor}
                  />
                  {/* Accent Color */}
                  <ColorField
                    label={t("widgetTheme.accentColor")}
                    value={localTheme.accentColor}
                    disabled={!canEdit}
                    onChange={(v) => updateLocal({ accentColor: v })}
                    validate={validateColor}
                  />
                  {/* Surface Color */}
                  <ColorField
                    label={t("widgetTheme.surfaceColor")}
                    value={localTheme.surfaceColor}
                    disabled={!canEdit}
                    onChange={(v) => updateLocal({ surfaceColor: v })}
                    validate={validateColor}
                  />
                  {/* Gradient From */}
                  <ColorField
                    label={t("widgetTheme.gradientFrom")}
                    value={localTheme.gradientFrom}
                    disabled={!canEdit}
                    onChange={(v) => updateLocal({ gradientFrom: v })}
                    validate={validateColor}
                  />
                  {/* Gradient To */}
                  <ColorField
                    label={t("widgetTheme.gradientTo")}
                    value={localTheme.gradientTo}
                    disabled={!canEdit}
                    onChange={(v) => updateLocal({ gradientTo: v })}
                    validate={validateColor}
                  />

                  {/* Position */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("widgetAppearance.position")}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["right", "left"] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() =>
                            setSettings({ ...settings, position: pos })
                          }
                          disabled={!canEdit}
                          className={`px-4 py-3 text-sm font-semibold rounded-xl border-2 transition-all duration-150 ${
                            settings.position === pos
                              ? "border-slate-900 bg-slate-50 text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {t(
                            pos === "right"
                              ? "widgetAppearance.positionRight"
                              : "widgetAppearance.positionLeft"
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Launcher Style */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("widgetAppearance.launcher")}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["bubble", "icon"] as const).map((ls) => (
                        <button
                          key={ls}
                          onClick={() =>
                            setSettings({ ...settings, launcher: ls })
                          }
                          disabled={!canEdit}
                          className={`px-4 py-3 text-sm font-semibold rounded-xl border-2 transition-all duration-150 ${
                            settings.launcher === ls
                              ? "border-slate-900 bg-slate-50 text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {t(
                            ls === "bubble"
                              ? "widgetAppearance.launcherBubble"
                              : "widgetAppearance.launcherIcon"
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reset button */}
                  <button
                    onClick={handleReset}
                    disabled={!canEdit}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    {t("widgetTheme.reset")}
                  </button>
                </div>
              )}
            </div>

            {/* ── 2. Avatar, Logo & Launcher — customize-btn-animated ── */}
            <div>
              <button
                type="button"
                onClick={() => setShowAvatarLauncher(!showAvatarLauncher)}
                className="w-full rounded-xl customize-btn-animated text-left"
              >
                <div className="customize-btn-inner">
                  <div className="flex items-center gap-2">
                    {showAvatarLauncher ? (
                      <ChevronDown size={18} className="text-slate-600" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-600" />
                    )}
                    <span className="text-sm font-semibold text-slate-800">
                      {t("widgetConfig.avatarTitle")}
                    </span>
                  </div>
                </div>
              </button>

              {showAvatarLauncher && (
                <div className="mt-3 bg-white rounded-xl border border-slate-200 px-5 pt-4 pb-5 space-y-5">
                  {/* Bot Avatar */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 mb-2">
                      <input
                        type="checkbox"
                        checked={widgetConfig.avatars.botEnabled}
                        onChange={(e) =>
                          updateWidgetConfig({ avatars: { botEnabled: e.target.checked } })
                        }
                        disabled={!canEdit}
                        className="rounded border-slate-300"
                      />
                      {t("widgetConfig.botAvatarEnabled")}
                    </label>
                    {widgetConfig.avatars.botEnabled && widgetConfig.avatars.botAsset.kind !== "none" && (
                      <input
                        type="url"
                        value={widgetConfig.avatars.botAsset.kind === "url" ? widgetConfig.avatars.botAsset.value : ""}
                        onChange={(e) =>
                          updateWidgetConfig({
                            avatars: { botAsset: { kind: "url", value: e.target.value.trim() } },
                          })
                        }
                        disabled={!canEdit}
                        placeholder={t("widgetConfig.avatarUrl")}
                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    )}
                  </div>

                  {/* Agent Avatars (limited by maxAgents) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      {t("widgetConfig.agentAvatars")}
                    </label>
                    {widgetConfig.avatars.agents.slice(0, maxAgents).map((agent, i) => (
                      <div key={agent.id} className="mt-1">
                        <input
                          type="url"
                          value={agent.asset.kind === "url" ? agent.asset.value : ""}
                          onChange={(e) => {
                            const next = [...widgetConfig.avatars.agents];
                            next[i] = { ...next[i], asset: { kind: "url", value: e.target.value.trim() } };
                            updateWidgetConfig({ avatars: { agents: next } });
                          }}
                          disabled={!canEdit}
                          placeholder={`${t("widgetConfig.agentAvatar")} ${i + 1}`}
                          className="w-full px-3 py-2 border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                    ))}
                    {isFree && widgetConfig.avatars.agents.length > maxAgents && (
                      <p className="mt-2 text-xs text-amber-600">
                        {t("widgetConfig.maxAgentsReached")}{" "}
                        <a href="/portal/billing" className="underline font-medium hover:text-amber-700">
                          {t("widgetConfig.upgradeForMore")}
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Avatar Shape */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      {t("widgetConfig.avatarShape")}
                    </label>
                    <div className="flex gap-2">
                      {(["circle", "rounded"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateWidgetConfig({ avatars: { avatarShape: s } })}
                          disabled={!canEdit}
                          className={`px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                            widgetConfig.avatars.avatarShape === s
                              ? "border-slate-900 bg-slate-100 text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {t(s === "circle" ? "widgetConfig.shapeCircle" : "widgetConfig.shapeRounded")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Launcher Style */}
                  <div className="border-t border-slate-200 pt-4">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      {t("widgetConfig.launcherStyle")}
                    </label>
                    <div className="flex gap-2">
                      {(["bubble", "button"] as LauncherStyle[]).map((style) => (
                        <button
                          key={style}
                          onClick={() => updateWidgetConfig({ launcher: { launcherStyle: style } })}
                          disabled={!canEdit}
                          className={`px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                            widgetConfig.launcher.launcherStyle === style
                              ? "border-slate-900 bg-slate-100 text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {t(style === "bubble" ? "widgetConfig.launcherStyleBubble" : "widgetConfig.launcherStyleButton")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Launcher Label */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {t("widgetConfig.launcherLabel")}
                    </label>
                    <input
                      type="text"
                      value={widgetConfig.launcher.launcherLabel}
                      onChange={(e) =>
                        updateWidgetConfig({ launcher: { launcherLabel: e.target.value.slice(0, 24) } })
                      }
                      disabled={!canEdit}
                      maxLength={24}
                      placeholder={t("widgetConfig.launcherLabel")}
                      className="w-full px-3 py-2 border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  {/* Unread Badge */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      {t("widgetConfig.unreadBadge")}
                    </label>
                    <div className="flex gap-2">
                      {(["off", "dot", "count"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => updateWidgetConfig({ launcher: { unreadBadge: mode } })}
                          disabled={!canEdit}
                          className={`px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                            widgetConfig.launcher.unreadBadge === mode
                              ? "border-slate-900 bg-slate-100 text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {t(`widgetConfig.badge${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── 3. Boyut (Genişlik + Yükseklik + Yoğunluk) — customize-btn-animated ── */}
            <div>
              <button
                type="button"
                onClick={() => setShowSizeMenu(!showSizeMenu)}
                className="w-full rounded-xl customize-btn-animated text-left"
              >
                <div className="customize-btn-inner">
                  <div className="flex items-center gap-2">
                    {showSizeMenu ? (
                      <ChevronDown size={18} className="text-slate-600" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-600" />
                    )}
                    <span className="text-sm font-semibold text-slate-800">
                      {t("widgetConfig.sizeTitle")}
                    </span>
                  </div>
                </div>
              </button>

              {showSizeMenu && (
                <div className="mt-3 bg-white rounded-xl border border-slate-200 px-5 pt-4 pb-5 space-y-5">
                  {/* Genişlik (Width) */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">
                      {t("widgetConfig.widthPreset")}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {(["compact", "default", "large"] as WidthPreset[]).map((preset) => {
                        const presetPx = getWidthFromPreset(preset);
                        const isActive = widgetConfig.size.customWidth === presetPx;
                        return (
                          <button
                            key={preset}
                            onClick={() =>
                              updateWidgetConfig({
                                size: { widthPreset: preset, customWidth: presetPx },
                              })
                            }
                            disabled={!canEdit}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                              isActive
                                ? "border-slate-900 bg-slate-100 text-slate-900"
                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {t(`widgetConfig.width${preset.charAt(0).toUpperCase() + preset.slice(1)}`)}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="range"
                      min={320}
                      max={520}
                      step={10}
                      value={Math.min(520, Math.max(320, widgetConfig.size.customWidth))}
                      onChange={(e) =>
                        updateWidgetConfig({ size: { customWidth: Number(e.target.value) } })
                      }
                      disabled={!canEdit}
                      className="w-full h-1.5 rounded-lg appearance-none bg-slate-200 accent-slate-700 disabled:opacity-50"
                    />
                  </div>
                  {/* Yükseklik (Height) */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">
                      {t("widgetConfig.heightPreset")}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {(["short", "auto", "default"] as HeightPreset[]).map((preset) => {
                        const presetPx = getMaxHeightFromPreset(preset);
                        const isActive = widgetConfig.size.customMaxHeight === presetPx;
                        return (
                          <button
                            key={preset}
                            onClick={() =>
                              updateWidgetConfig({
                                size: {
                                  heightPreset: preset,
                                  customMaxHeight: presetPx,
                                },
                              })
                            }
                            disabled={!canEdit}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                              isActive
                                ? "border-slate-900 bg-slate-100 text-slate-900"
                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {t(`widgetConfig.height${preset.charAt(0).toUpperCase() + preset.slice(1)}`)}
                          </button>
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
                      className="w-full h-1.5 rounded-lg appearance-none bg-slate-200 accent-slate-700 disabled:opacity-50"
                    />
                  </div>
                  {/* Yoğunluk (Density) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      {t("widgetConfig.density")}
                    </label>
                    <div className="flex gap-2">
                      {(["compact", "comfortable"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() =>
                            updateWidgetConfig({ size: { density: d } })
                          }
                          disabled={!canEdit}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                            widgetConfig.size.density === d
                              ? "border-slate-900 bg-slate-100 text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {t(d === "compact" ? "widgetConfig.densityCompact" : "widgetConfig.densityComfortable")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── 4. Ayarlar (Settings) — customize-btn-animated ── */}
            <div>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="w-full rounded-xl customize-btn-animated text-left"
              >
                <div className="customize-btn-inner">
                  <div className="flex items-center gap-2">
                    {showSettings ? (
                      <ChevronDown size={18} className="text-slate-600" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-600" />
                    )}
                    <span className="text-sm font-semibold text-slate-800">
                      {t("portal.settings")}
                    </span>
                  </div>
                </div>
              </button>

              {showSettings && (
                <div className="mt-3 bg-white rounded-xl border border-slate-200 px-5 pt-4 pb-5 space-y-5">
                  {/* Welcome Title */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("widgetAppearance.welcomeTitle")}
                    </label>
                    <input
                      type="text"
                      value={settings.welcomeTitle}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          welcomeTitle: e.target.value.slice(0, 60),
                        })
                      }
                      disabled={!canEdit}
                      maxLength={60}
                      className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {settings.welcomeTitle.length}/60
                    </div>
                  </div>

                  {/* Welcome Message */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("widgetAppearance.welcomeMessage")}
                    </label>
                    <textarea
                      value={settings.welcomeMessage}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          welcomeMessage: e.target.value.slice(0, 240),
                        })
                      }
                      disabled={!canEdit}
                      maxLength={240}
                      rows={3}
                      className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {settings.welcomeMessage.length}/240
                    </div>
                  </div>

                  {/* Brand Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("widgetAppearance.brandName")}
                    </label>
                    <input
                      type="text"
                      value={settings.brandName || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          brandName: e.target.value.slice(0, 40) || null,
                        })
                      }
                      disabled={!canEdit}
                      maxLength={40}
                      className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {(settings.brandName || "").length}/40
                    </div>
                  </div>

                  {/* ── Branding toggle (plan-gated) ── */}
                  <div className="border-t border-slate-200 pt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("widgetConfig.brandingToggle")}
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {/* branding always on for free */}}
                        disabled={brandingRequired}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                          brandingRequired
                            ? "border-slate-900 bg-slate-100 text-slate-900"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {t("widgetConfig.brandingOn")}
                      </button>
                      <button
                        onClick={() => {/* only available on paid plans */}}
                        disabled={brandingRequired}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                          !brandingRequired
                            ? "border-slate-900 bg-slate-100 text-slate-900"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {t("widgetConfig.brandingOff")}
                      </button>
                    </div>
                    {isFree && (
                      <p className="mt-2 text-xs text-amber-600">
                        {t("widgetConfig.brandingFreeLocked")}{" "}
                        <a href="/portal/billing" className="underline font-medium hover:text-amber-700">
                          {t("widgetConfig.brandingUpgrade")}
                        </a>
                      </p>
                    )}
                  </div>

                  {/* ── Domain mismatch alert ── */}
                  {domainMismatchCount > 0 && (
                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <span className="text-amber-500 text-lg flex-shrink-0">⚠</span>
                        <div>
                          <p className="text-sm font-medium text-amber-800">
                            {t("widgetConfig.domainMismatch")}
                          </p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            {t("widgetConfig.domainMismatchDesc")}
                          </p>
                          <p className="text-xs font-semibold text-amber-800 mt-1">
                            {t("widgetConfig.domainMismatchCount").replace("{count}", String(domainMismatchCount))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  {canEdit && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full px-4 py-3.5 bg-[#1A1A2E] text-white text-sm font-semibold rounded-xl hover:bg-[#15152A] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                    >
                      {saving ? t("widgetTheme.saving") : t("widgetTheme.save")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT: Live Preview (clean — no controls on top) ─── */}
          <div className="space-y-6">
            <Card variant="elevated" padding="lg" className="sticky top-6">
              <SectionTitle title={t("widgetAppearance.preview")} />

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
              />
            </Card>

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
    </>
  );
}

/* ─── Reusable color field ─── */
function ColorField({
  label,
  value,
  disabled,
  onChange,
  validate,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  validate: (v: string) => boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      <div className="flex gap-3 items-center">
        <input
          type="color"
          value={validate(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-11 w-20 rounded-xl border-2 border-slate-300 cursor-pointer disabled:opacity-50"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (validate(v) || v.startsWith("#")) {
              onChange(v);
            }
          }}
          disabled={disabled}
          placeholder="#000000"
          className="flex-1 px-3 py-2.5 border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
        />
      </div>
    </div>
  );
}
