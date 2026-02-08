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
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "admin";

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
          <div className="space-y-6">
            {/* ── Preset Swatches ── */}
            <Card variant="elevated" padding="lg">
              <SectionTitle title={t("widgetTheme.presetsTitle")} />
              <p className="text-sm text-slate-500 mb-4">
                {t("widgetTheme.presetsSubtitle")}
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {WIDGET_THEME_PRESETS.map((preset) => {
                  const isActive = localTheme.presetId === preset.presetId;
                  return (
                    <button
                      key={preset.presetId}
                      onClick={() => applyPreset(preset)}
                      disabled={!canEdit}
                      className={`group flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all duration-150 ${
                        isActive
                          ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/10"
                          : "border-slate-200 hover:border-slate-400"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={t(`widgetTheme.preset.${preset.presetId}.desc`)}
                      data-preset-id={preset.presetId}
                    >
                      {/* Gradient swatch circle */}
                      <div
                        className={`w-12 h-12 rounded-full shadow-md transition-transform duration-150 ${
                          isActive ? "scale-110 ring-2 ring-white" : "group-hover:scale-105"
                        }`}
                        style={{
                          background: `linear-gradient(${preset.gradient.angle}deg, ${preset.gradient.from}, ${preset.gradient.to})`,
                        }}
                      />
                      <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
                        {t(`widgetTheme.preset.${preset.presetId}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* ── Customize Accordion ── */}
            <Card variant="elevated" padding="none">
              <button
                onClick={() => setShowCustomize(!showCustomize)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-2">
                  {showCustomize ? (
                    <ChevronDown size={18} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-700">
                    {t("widgetTheme.customizeTitle")}
                  </span>
                </div>
              </button>

              {showCustomize && (
                <div className="px-5 pb-5 space-y-5">
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
            </Card>

            {/* ── Content fields ── */}
            <Card variant="elevated" padding="lg">
              <SectionTitle title={t("portal.settings")} />

              {/* Welcome Title */}
              <div className="mb-6">
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
              <div className="mb-6">
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
              <div className="mb-6">
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
            </Card>
          </div>

          {/* ─── RIGHT: Live Preview ─── */}
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
