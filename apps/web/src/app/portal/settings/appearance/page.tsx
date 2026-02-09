"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import { ArrowUpRight, Palette, MessageCircle, Sparkles } from "lucide-react";

type WidgetAppearance = {
  primaryColor: string;
  position: "left" | "right";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
};

export default function PortalSettingsAppearancePage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<WidgetAppearance | null>(null);

  useEffect(() => {
    portalApiFetch("/portal/widget/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSettings(data?.settings ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/30 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.appearance")}</h1>
            <p className="text-sm text-slate-600 mt-1">{t("settingsPortal.appearanceSubtitle")}</p>
          </div>
          <Link
            href="/portal/widget-appearance"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            {t("settingsPortal.openAppearanceStudio")}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 mb-3">
            <Palette size={18} />
          </div>
          <p className="text-xs text-slate-500">{t("widgetAppearance.primaryColor")}</p>
          <p className="text-base font-semibold text-slate-900 mt-1">{settings?.primaryColor ?? "-"}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mb-3">
            <MessageCircle size={18} />
          </div>
          <p className="text-xs text-slate-500">{t("widgetAppearance.launcher")}</p>
          <p className="text-base font-semibold text-slate-900 mt-1">
            {settings?.launcher === "icon" ? t("widgetAppearance.launcherIcon") : t("widgetAppearance.launcherBubble")}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 mb-3">
            <Sparkles size={18} />
          </div>
          <p className="text-xs text-slate-500">{t("widgetAppearance.position")}</p>
          <p className="text-base font-semibold text-slate-900 mt-1">
            {settings?.position === "left" ? t("widgetAppearance.positionLeft") : t("widgetAppearance.positionRight")}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs text-slate-500 mb-1">{t("widgetAppearance.welcomeTitle")}</p>
        <p className="text-sm font-semibold text-slate-900">{settings?.welcomeTitle ?? "-"}</p>
        <p className="text-xs text-slate-500 mt-4 mb-1">{t("widgetAppearance.welcomeMessage")}</p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{settings?.welcomeMessage ?? "-"}</p>
      </div>
    </div>
  );
}
