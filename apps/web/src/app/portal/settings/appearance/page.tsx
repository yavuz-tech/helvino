"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, Layout, MessageCircle, Palette } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { p } from "@/styles/theme";

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
  const [s, setS] = useState<WidgetAppearance | null>(null);

  useEffect(() => {
    portalApiFetch("/portal/widget/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setS(data?.settings ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className={p.sectionGap}>
      <PageHeader
        title={t("settingsPortal.appearance")}
        subtitle={t("settingsPortal.appearanceSubtitle")}
        action={
          <Link href="/portal/widget-appearance" className={p.btnPrimary}>
            {t("settingsPortal.openAppearanceStudio")}
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {/* ── Compact Summary Row ── */}
      <Card>
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Color */}
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 flex-shrink-0 rounded-lg border border-slate-200"
              style={{ backgroundColor: s?.primaryColor ?? "#3B82F6" }}
            />
            <div className="min-w-0">
              <p className={p.overline}>{t("widgetAppearance.primaryColor")}</p>
              <p className="text-[13px] font-semibold text-slate-800 truncate">
                {s?.primaryColor ?? "-"}
              </p>
            </div>
          </div>

          {/* Position */}
          <div className="flex items-center gap-3">
            <div className={`${p.iconSm} ${p.iconSlate}`}>
              <Layout size={14} />
            </div>
            <div className="min-w-0">
              <p className={p.overline}>{t("widgetAppearance.position")}</p>
              <p className="text-[13px] font-semibold text-slate-800">
                {s?.position === "left"
                  ? t("widgetAppearance.positionLeft")
                  : t("widgetAppearance.positionRight")}
              </p>
            </div>
          </div>

          {/* Launcher */}
          <div className="flex items-center gap-3">
            <div className={`${p.iconSm} ${p.iconSlate}`}>
              <Eye size={14} />
            </div>
            <div className="min-w-0">
              <p className={p.overline}>{t("widgetAppearance.launcher")}</p>
              <p className="text-[13px] font-semibold text-slate-800">
                {s?.launcher === "icon"
                  ? t("widgetAppearance.launcherIcon")
                  : t("widgetAppearance.launcherBubble")}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Welcome Screen Preview ── */}
      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconBlue}`}>
            <MessageCircle size={14} />
          </div>
          <h3 className={p.h3}>{t("widgetAppearance.welcomeTitle")}</h3>
        </div>

        {/* Mini widget preview */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="mx-auto max-w-xs">
            {/* Simulated widget header */}
            <div
              className="rounded-t-xl px-4 py-3"
              style={{ backgroundColor: s?.primaryColor ?? "#3B82F6" }}
            >
              <p className="text-[12px] font-semibold text-white/90">
                {s?.brandName ?? "Helvino"}
              </p>
            </div>
            {/* Content */}
            <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-4">
              <p className="text-[13px] font-semibold text-slate-800">
                {s?.welcomeTitle ?? "-"}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
                {s?.welcomeMessage ?? "-"}
              </p>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-400">
                  {t("settingsPortal.chatPlaceholder")}...
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Brand Info ── */}
      {s?.brandName && (
        <Card>
          <div className="flex items-center gap-3">
            <div className={`${p.iconSm} ${p.iconViolet}`}>
              <Palette size={14} />
            </div>
            <div>
              <p className={p.overline}>{t("widgetAppearance.primaryColor")}</p>
              <p className="text-[13px] font-semibold text-slate-800">
                {s.brandName}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
