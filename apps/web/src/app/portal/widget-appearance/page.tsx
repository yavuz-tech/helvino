"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import WidgetGallery from "@/components/widget/WidgetGallery";
import WidgetPreviewRenderer from "@/components/widget/WidgetPreviewRenderer";

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
}

export default function PortalWidgetAppearancePage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState<WidgetSettings>({
    primaryColor: "#1A1A2E",
    position: "right",
    launcher: "bubble",
    welcomeTitle: "Welcome",
    welcomeMessage: "How can we help you today?",
    brandName: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "admin";

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
      setSettings(data.settings);
      setRequestId(data.requestId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading) {
      fetchSettings();
    }
  }, [authLoading, fetchSettings]);

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
      setSaveMessage(t("widgetAppearance.saved"));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const validateColor = (color: string): boolean => {
    return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
  };

  if (authLoading) {
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
        backButton={{ href: "/portal", label: t("portalOnboarding.backToDashboard") }}
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
          {/* Settings Form */}
          <div className="space-y-6">
            <Card variant="elevated" padding="lg">
              <SectionTitle title={t("portal.settings")} />

              {/* Primary Color */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("widgetAppearance.primaryColor")}
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, primaryColor: e.target.value })
                    }
                    disabled={!canEdit}
                    className="h-11 w-20 rounded-xl border-2 border-slate-300 cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (validateColor(val) || val.startsWith("#")) {
                        setSettings({ ...settings, primaryColor: val });
                      }
                    }}
                    disabled={!canEdit}
                    placeholder="#1A1A2E"
                    className="flex-1 px-3 py-2.5 border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                  />
                </div>
              </div>

              {/* Position */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("widgetAppearance.position")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSettings({ ...settings, position: "right" })}
                    disabled={!canEdit}
                    className={`px-4 py-3 text-sm font-semibold rounded-xl border-2 transition-all duration-150 ${
                      settings.position === "right"
                        ? "border-slate-900 bg-slate-50 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {t("widgetAppearance.positionRight")}
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, position: "left" })}
                    disabled={!canEdit}
                    className={`px-4 py-3 text-sm font-semibold rounded-xl border-2 transition-all duration-150 ${
                      settings.position === "left"
                        ? "border-slate-900 bg-slate-50 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {t("widgetAppearance.positionLeft")}
                  </button>
                </div>
              </div>

              {/* Launcher Style */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("widgetAppearance.launcher")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSettings({ ...settings, launcher: "bubble" })}
                    disabled={!canEdit}
                    className={`px-4 py-3 text-sm font-semibold rounded-xl border-2 transition-all duration-150 ${
                      settings.launcher === "bubble"
                        ? "border-slate-900 bg-slate-50 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {t("widgetAppearance.launcherBubble")}
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, launcher: "icon" })}
                    disabled={!canEdit}
                    className={`px-4 py-3 text-sm font-semibold rounded-xl border-2 transition-all duration-150 ${
                      settings.launcher === "icon"
                        ? "border-slate-900 bg-slate-50 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {t("widgetAppearance.launcherIcon")}
                  </button>
                </div>
              </div>

              {/* Welcome Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("widgetAppearance.welcomeTitle")}
                </label>
                <input
                  type="text"
                  value={settings.welcomeTitle}
                  onChange={(e) =>
                    setSettings({ ...settings, welcomeTitle: e.target.value.slice(0, 60) })
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
                  {saving ? t("common.saving") : t("widgetAppearance.save")}
                </button>
              )}
            </Card>
          </div>

          {/* Live Preview */}
          <div className="space-y-6">
            <Card variant="elevated" padding="lg" className="sticky top-6">
              <SectionTitle title={t("widgetAppearance.preview")} />
              
              {/* Real Widget Preview Renderer */}
              <WidgetPreviewRenderer settings={settings} />
            </Card>

            {/* Debug Panel (Collapsible) */}
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
          </div>
        </div>
      )}
    </>
  );
}
