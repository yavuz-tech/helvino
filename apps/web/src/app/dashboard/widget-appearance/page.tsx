"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import DashboardLayout from "@/components/DashboardLayout";
import { useOrg } from "@/contexts/OrgContext";
import { checkAuth, type AdminUser } from "@/lib/auth";
import { apiFetch, parseApiError } from "@/utils/api";
import { useI18n } from "@/i18n/I18nContext";
import WidgetAppearanceUltimateV2 from "@/app/portal/widget-appearance/widget-appearance-v3-ultimate";
import { ChevronLeft } from "lucide-react";

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
  [key: string]: unknown;
}

export default function DashboardWidgetAppearancePage() {
  const { t } = useI18n();
  const { selectedOrg, isLoading: orgLoading } = useOrg();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const fetchIdRef = useRef(0);

  const fetchSettings = useCallback(async () => {
    if (!selectedOrg?.key) return;
    const thisId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/internal/widget/settings", { orgKey: selectedOrg.key, cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (thisId !== fetchIdRef.current) return;
      if (!res.ok) {
        const parsed = await parseApiError(res, t("common.error"));
        throw new Error(parsed.message || data?.error || t("common.error"));
      }
      if (data?.settings && typeof data.settings === "object") {
        setSettings(data.settings as WidgetSettings);
        setSettingsVersion((v) => v + 1);
      }
    } catch (err) {
      if (thisId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      if (thisId === fetchIdRef.current) setLoading(false);
    }
  }, [selectedOrg?.key, t]);

  const handleSave = useCallback(async (incomingPayload?: Record<string, unknown>) => {
    if (!selectedOrg?.key) return;
    setError(null);
    try {
      const res = await apiFetch("/internal/widget/settings", {
        method: "PUT",
        orgKey: selectedOrg.key,
        body: JSON.stringify(incomingPayload ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || data?.error || t("common.saveFailed");
        throw new Error(msg);
      }
      if (data?.settings && typeof data.settings === "object") {
        setSettings(data.settings as WidgetSettings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveFailed"));
      throw err;
    }
  }, [selectedOrg?.key, t]);

  useEffect(() => {
    const verifyAuth = async () => {
      const u = await checkAuth();
      if (!u) {
        window.location.href = "/login";
        return;
      }
      setUser(u);
      setAuthLoading(false);
    };
    verifyAuth();
  }, []);

  useEffect(() => {
    if (!authLoading && user && !orgLoading && selectedOrg) void fetchSettings();
  }, [authLoading, fetchSettings, orgLoading, selectedOrg, user]);

  const readySettings = loading || !settings ? undefined : settings;

  return (
    <DashboardLayout user={user}>
      <div className="p-6">
        <div className="mb-5">
          <Link
            href="/dashboard"
            className="mb-2.5 inline-flex items-center gap-1 font-[var(--font-body)] text-[13px] font-medium text-[#94A3B8] transition-colors hover:text-[#64748B] group"
          >
            <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
            {t("nav.overview")}
          </Link>
          <h1 className="font-[var(--font-heading)] text-[28px] font-extrabold leading-tight text-[#1A1D23]">
            {t("widgetAppearance.pageTitle")}
          </h1>
          <p className="mt-1 font-[var(--font-body)] text-[14px] text-[#64748B]">
            {t("widgetAppearance.pageDesc")}
          </p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        {!selectedOrg?.key ? (
          <Card>
            <div style={{ padding: 12, fontSize: 12, color: "#B45309" }}>
              {t("common.error")}
            </div>
          </Card>
        ) : (
          <WidgetAppearanceUltimateV2
            planKey="enterprise"
            onSave={handleSave}
            loading={loading || authLoading}
            initialSettings={readySettings}
            settingsVersion={settingsVersion}
            orgKey={selectedOrg.key}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

