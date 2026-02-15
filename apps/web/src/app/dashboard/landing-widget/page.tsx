"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import { InputField, SelectField, TextareaField } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nContext";
import { checkAuth, type AdminUser } from "@/lib/auth";
import { apiFetch, parseApiError } from "@/utils/api";
import { premiumToast } from "@/components/PremiumToast";
import type { TranslationKey } from "@/i18n/translations";

type AiProvider = "gemini" | "openai" | "claude";
type Position = "br" | "bl";
type HoursRow = { day: string; on: boolean; start: string; end: string };

const DEFAULT_ORG_KEY = "helvion";

function defaultHours(): HoursRow[] {
  return [
    { day: "Mon", on: true, start: "09:00", end: "18:00" },
    { day: "Tue", on: true, start: "09:00", end: "18:00" },
    { day: "Wed", on: true, start: "09:00", end: "18:00" },
    { day: "Thu", on: true, start: "09:00", end: "18:00" },
    { day: "Fri", on: true, start: "09:00", end: "18:00" },
    { day: "Sat", on: false, start: "09:00", end: "18:00" },
    { day: "Sun", on: false, start: "09:00", end: "18:00" },
  ];
}

export default function LandingWidgetAdminPage() {
  const router = useRouter();
  const { t } = useI18n();

  const orgKey = DEFAULT_ORG_KEY;

  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#F59E0B");
  const [position, setPosition] = useState<Position>("br");
  const [aiAutoReply, setAiAutoReply] = useState(true);
  const [aiProvider, setAiProvider] = useState<AiProvider>("gemini");
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [hours, setHours] = useState<HoursRow[]>(defaultHours());
  const [offlineMessage, setOfflineMessage] = useState("");

  const aiProviderOptions = useMemo(
    () => [
      { value: "gemini", label: t("landingWidget.aiProvider.gemini") },
      { value: "openai", label: t("landingWidget.aiProvider.openai") },
      { value: "claude", label: t("landingWidget.aiProvider.claude") },
    ],
    [t]
  );

  const positionOptions = useMemo(
    () => [
      { value: "br", label: t("landingWidget.position.br") },
      { value: "bl", label: t("landingWidget.position.bl") },
    ],
    [t]
  );

  // Auth gate
  useEffect(() => {
    const run = async () => {
      const u = await checkAuth();
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setAuthLoading(false);
    };
    run();
  }, [router]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/internal/landing-widget/${encodeURIComponent(orgKey)}`);
      if (!res.ok) {
        const parsed = await parseApiError(res, t("landingWidget.loadFailed"));
        premiumToast.error({ title: parsed.message });
        return;
      }
      const data = await res.json();
      const cfg = data?.config || {};
      setEnabled(Boolean(cfg.enabled));
      setWelcomeMessage(typeof cfg.welcomeMessage === "string" ? cfg.welcomeMessage : "");
      setPrimaryColor(typeof cfg.primaryColor === "string" ? cfg.primaryColor : "#F59E0B");
      setPosition(cfg.position === "bl" ? "bl" : "br");
      setAiAutoReply(Boolean(cfg.aiAutoReply));
      setAiProvider(cfg.aiProvider === "openai" || cfg.aiProvider === "claude" ? cfg.aiProvider : "gemini");
      setHoursEnabled(Boolean(cfg.hoursEnabled));
      setTimezone(typeof cfg.timezone === "string" ? cfg.timezone : "Europe/Istanbul");
      setHours(Array.isArray(cfg.hours) ? cfg.hours : defaultHours());
      setOfflineMessage(typeof cfg.offlineMessage === "string" ? cfg.offlineMessage : "");
    } catch {
      premiumToast.error({ title: t("landingWidget.loadFailed") });
    } finally {
      setLoading(false);
    }
  }, [orgKey, t]);

  useEffect(() => {
    if (!authLoading && user) void loadConfig();
  }, [authLoading, user, loadConfig]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/internal/landing-widget/${encodeURIComponent(orgKey)}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          welcomeMessage,
          primaryColor,
          position,
          aiAutoReply,
          aiProvider,
          hoursEnabled,
          timezone,
          hours,
          offlineMessage,
        }),
      });
      if (!res.ok) {
        const parsed = await parseApiError(res, t("landingWidget.saveFailed"));
        premiumToast.error({ title: parsed.message });
        return;
      }
      premiumToast.success({ title: t("landingWidget.saveSuccess") });
      await loadConfig(); // refresh with canonical data
    } catch {
      premiumToast.error({ title: t("landingWidget.saveFailed") });
    } finally {
      setSaving(false);
    }
  }, [
    aiAutoReply,
    aiProvider,
    enabled,
    hours,
    hoursEnabled,
    loadConfig,
    offlineMessage,
    orgKey,
    position,
    primaryColor,
    t,
    timezone,
    welcomeMessage,
  ]);

  const updateHours = (idx: number, patch: Partial<HoursRow>) => {
    setHours((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const dayLabelKey: Record<string, TranslationKey> = {
    Mon: "landingWidget.hours.day.Mon",
    Tue: "landingWidget.hours.day.Tue",
    Wed: "landingWidget.hours.day.Wed",
    Thu: "landingWidget.hours.day.Thu",
    Fri: "landingWidget.hours.day.Fri",
    Sat: "landingWidget.hours.day.Sat",
    Sun: "landingWidget.hours.day.Sun",
  };

  if (authLoading || !user) {
    return (
      <DashboardLayout user={null}>
        <div className="p-6">{t("common.loading")}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={async () => { /* handled by layout on other pages */ }}>
      <div className="p-6">
        <PageHeader
          title={t("landingWidget.title")}
          subtitle={t("landingWidget.subtitle")}
          action={
            <button
              type="button"
              onClick={() => void saveConfig()}
              disabled={saving || loading}
              className="rounded-xl bg-amber-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          }
        />

        <div className="mt-6 grid grid-cols-1 gap-4">
          <Card>
            <div className="space-y-4">
              <Toggle
                label={t("landingWidget.enabled.label")}
                description={t("landingWidget.enabled.desc")}
                checked={enabled}
                onChange={setEnabled}
              />

              <TextareaField
                label={t("landingWidget.welcomeMessage.label")}
                description={t("landingWidget.welcomeMessage.desc")}
                value={welcomeMessage}
                onChange={setWelcomeMessage}
                rows={3}
              />

              <InputField
                label={t("landingWidget.primaryColor.label")}
                description={t("landingWidget.primaryColor.desc")}
                value={primaryColor}
                onChange={setPrimaryColor}
                placeholder="#F59E0B"
              />

              <SelectField
                label={t("landingWidget.position.label")}
                description={t("landingWidget.position.desc")}
                value={position}
                onChange={(v) => setPosition(v === "bl" ? "bl" : "br")}
                options={positionOptions}
              />
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <Toggle
                label={t("landingWidget.aiAutoReply.label")}
                description={t("landingWidget.aiAutoReply.desc")}
                checked={aiAutoReply}
                onChange={setAiAutoReply}
              />

              <SelectField
                label={t("landingWidget.aiProvider.label")}
                description={t("landingWidget.aiProvider.desc")}
                value={aiProvider}
                onChange={(v) =>
                  setAiProvider(v === "openai" || v === "claude" ? v : "gemini")
                }
                options={aiProviderOptions}
              />
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <Toggle
                label={t("landingWidget.hoursEnabled.label")}
                description={t("landingWidget.hoursEnabled.desc")}
                checked={hoursEnabled}
                onChange={setHoursEnabled}
              />

              <InputField
                label={t("landingWidget.timezone.label")}
                description={t("landingWidget.timezone.desc")}
                value={timezone}
                onChange={setTimezone}
                placeholder="Europe/Istanbul"
              />

              <div className="rounded-xl border border-[#F3E8D8] bg-[#FFFBF5] p-4">
                <div className="mb-3 text-[13px] font-bold text-slate-900">
                  {t("landingWidget.hours.title")}
                </div>
                <div className="space-y-2">
                  {hours.map((row, idx) => (
                    <div
                      key={row.day}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2"
                    >
                      <div className="w-[56px] text-[12px] font-semibold text-slate-700">
                        {t(dayLabelKey[row.day] || "landingWidget.hours.day.Mon")}
                      </div>
                      <button
                        type="button"
                        onClick={() => updateHours(idx, { on: !row.on })}
                        className={[
                          "rounded-lg px-3 py-1 text-[12px] font-bold",
                          row.on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {row.on ? t("common.enabled") : t("common.disabled")}
                      </button>
                      <input
                        type="time"
                        value={row.start}
                        onChange={(e) => updateHours(idx, { start: e.target.value })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px]"
                        disabled={!row.on}
                      />
                      <span className="text-[12px] text-slate-400">-</span>
                      <input
                        type="time"
                        value={row.end}
                        onChange={(e) => updateHours(idx, { end: e.target.value })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px]"
                        disabled={!row.on}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <TextareaField
                label={t("landingWidget.offlineMessage.label")}
                description={t("landingWidget.offlineMessage.desc")}
                value={offlineMessage}
                onChange={setOfflineMessage}
                rows={3}
              />
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

