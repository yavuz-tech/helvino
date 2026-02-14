"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import WidgetAppearanceUltimateV2 from "./widget-appearance-v3-ultimate";

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
  [key: string]: unknown;
}

export default function PortalWidgetAppearancePage() {
  const { user, loading: authLoading } = usePortalAuth();
  const { t } = useI18n();

  // Settings state — null means "not yet loaded from API"
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeNotice, setUpgradeNotice] = useState<string | null>(null);
  const [planKey, setPlanKey] = useState<string>("free");
  const [brandingRequired, setBrandingRequired] = useState(true);
  const [domainMismatchCount, setDomainMismatchCount] = useState(0);
  // Version counter: increments each time settings are freshly loaded from API
  const [settingsVersion, setSettingsVersion] = useState(0);
  const fetchIdRef = useRef(0);

  const isPro = planKey === "pro" || planKey === "business" || planKey === "enterprise";
  const isFree = planKey === "free";

  const fetchSettings = useCallback(async () => {
    const thisId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/widget/settings");
      const data = await res.json().catch(() => ({}));
      // Abort if a newer fetch has started
      if (thisId !== fetchIdRef.current) return;
      if (!res.ok) {
        throw new Error(data?.error || t("common.error"));
      }
      if (data?.settings && typeof data.settings === "object") {
        console.log("[FETCH] API response settings:", data.settings);
        setSettings(data.settings as WidgetSettings);
        setSettingsVersion((v) => v + 1);
      }
      if (data?.planKey) setPlanKey(String(data.planKey));
      if (typeof data?.brandingRequired === "boolean") setBrandingRequired(data.brandingRequired);
      if (typeof data?.domainMismatchCount === "number") setDomainMismatchCount(data.domainMismatchCount);
    } catch (err) {
      if (thisId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      if (thisId === fetchIdRef.current) setLoading(false);
    }
  }, [t]);

  const handleSave = useCallback(async (incomingPayload?: Record<string, unknown>) => {
    if (!user) return;
    setError(null);

    const payloadSettings: Record<string, unknown> = {
      ...(incomingPayload ?? {}),
    };

    // Server-side plan gating safety net
    if (!isPro) {
      payloadSettings.aiModel = "auto";
      payloadSettings.csat = false;
      payloadSettings.whiteLabel = false;
      payloadSettings.autoReply = false;
      payloadSettings.autoReplyMsg = "";
      payloadSettings.customCss = "";
      payloadSettings.consentEnabled = false;
      payloadSettings.consentText = "";
      payloadSettings.transcriptEmail = false;
      payloadSettings.showBranding = true;
      payloadSettings.preChatEnabled = false;
      payloadSettings.pageRules = [];
    }
    if (isFree) {
      const premiumThemes = new Set(["sunset", "aurora", "midnight", "cherry"]);
      const premiumPatterns = new Set(["diamonds", "circles", "confetti"]);
      if (typeof payloadSettings.themeId === "string" && premiumThemes.has(payloadSettings.themeId)) {
        payloadSettings.themeId = "amber";
      }
      if (typeof payloadSettings.bgPatternId === "string" && premiumPatterns.has(payloadSettings.bgPatternId)) {
        payloadSettings.bgPatternId = "none";
      }
    }

    try {
      const res = await portalApiFetch("/portal/widget/settings", {
        method: "PUT",
        body: JSON.stringify(payloadSettings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || t("common.saveFailed"));
      }
      // After successful save, replace local settings with API response
      // This ensures our local state matches what the DB actually has
      if (data?.settings && typeof data.settings === "object") {
        setSettings(data.settings as WidgetSettings);
        // NOTE: do NOT increment settingsVersion here — v3-ultimate should keep
        // its current working state. Version only bumps on full re-fetch.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveFailed"));
      throw err; // Re-throw so v3-ultimate knows save failed
    }
  }, [isFree, isPro, t, user]);

  useEffect(() => {
    if (!authLoading && user) void fetchSettings();
  }, [authLoading, fetchSettings, user]);

  // Suppress unused variable warnings for state used only in JSX conditionals
  void brandingRequired;
  void upgradeNotice;

  // Only pass initialSettings when we have actual API data
  const readySettings = loading || !settings ? undefined : settings;

  return (
    <>
      {error ? <ErrorBanner message={error} /> : null}
      {domainMismatchCount > 0 ? (
        <Card>
          <div style={{ padding: 12, fontSize: 12, color: "#B45309" }}>
            Domain allowlist uyumsuzlugu algilandi.
          </div>
        </Card>
      ) : null}
      <WidgetAppearanceUltimateV2
        planKey={planKey}
        onSave={handleSave}
        loading={loading || authLoading}
        initialSettings={readySettings}
        settingsVersion={settingsVersion}
        orgKey={user?.orgKey || ""}
      />
      {upgradeNotice ? (
        <div style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "#1A1D23", color: "#FFF", padding: "10px 14px", borderRadius: 10, fontSize: 12 }}>
          {upgradeNotice}
        </div>
      ) : null}
    </>
  );
}
