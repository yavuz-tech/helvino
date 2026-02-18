"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, Layout, MessageCircle, Palette } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { portalApiFetch } from "@/lib/portal-auth";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { p } from "@/styles/theme";
import { colors, fonts } from "@/lib/design-tokens";

type WidgetAppearance = {
  primaryColor: string;
  position: "left" | "right";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
};

export default function PortalSettingsAppearancePage() {
  void fonts;
  const { t } = useI18n();
  const [s, setS] = useState<WidgetAppearance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApiFetch("/portal/widget/settings")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error("LOAD_FAILED");
        return data;
      })
      .then((data) => {
        setError(null);
        setS(data?.settings ?? null);
      })
      .catch(() => {
        setError(t("common.networkError"));
        setS(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  return (
    <div className={p.sectionGap} style={{ background: colors.brand.ultraLight, borderRadius: 16, padding: 16 }}>
      <PageHeader
        title={t("settingsPortal.appearance")}
        subtitle={t("settingsPortal.appearanceSubtitle")}
        action={
          <Link
            href="/portal/widget-appearance"
            className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02]"
            style={{ background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})` }}
          >
            {t("settingsPortal.openAppearanceStudio")}
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ── Compact Summary Row ── */}
      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Color */}
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 flex-shrink-0 rounded-lg border border-[#E2E8F0]"
              style={{ backgroundColor: s?.primaryColor ?? "#3B82F6" }}
            />
            <div className="min-w-0">
              <p className={p.overline}>{t("widgetAppearance.primaryColor")}</p>
              <p className="text-[13px] font-semibold text-[#1A1D23] truncate">
                {s?.primaryColor ?? "-"}
              </p>
            </div>
          </div>

          {/* Position */}
          <div className="flex items-center gap-3">
            <div className={`${p.iconSm} ${p.iconAmber}`}>
              <Layout size={14} />
            </div>
            <div className="min-w-0">
              <p className={p.overline}>{t("widgetAppearance.position")}</p>
              <p className="text-[13px] font-semibold text-[#1A1D23]">
                {s?.position === "left"
                  ? t("widgetAppearance.positionLeft")
                  : t("widgetAppearance.positionRight")}
              </p>
            </div>
          </div>

          {/* Launcher */}
          <div className="flex items-center gap-3">
            <div className={`${p.iconSm} ${p.iconAmber}`}>
              <Eye size={14} />
            </div>
            <div className="min-w-0">
              <p className={p.overline}>{t("widgetAppearance.launcher")}</p>
              <p className="text-[13px] font-semibold text-[#1A1D23]">
                {s?.launcher === "icon"
                  ? t("widgetAppearance.launcherIcon")
                  : t("widgetAppearance.launcherBubble")}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Welcome Screen Preview ── */}
      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconAmber}`}>
            <MessageCircle size={14} />
          </div>
          <h3 className="font-heading font-semibold text-[15px] text-[#1A1D23]">{t("widgetAppearance.welcomeTitle")}</h3>
        </div>

        {/* Mini widget preview */}
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
          <div className="mx-auto max-w-xs">
            {/* Simulated widget header */}
            <div
              className="rounded-t-xl px-4 py-3"
              style={{ backgroundColor: s?.primaryColor ?? "#3B82F6" }}
            >
              <p className="text-[12px] font-semibold text-white/90">
                {s?.brandName ?? "Helvion"}
              </p>
            </div>
            {/* Content */}
            <div className="rounded-b-xl border border-t-0 border-[#E2E8F0] bg-white p-4">
              <p className="text-[13px] font-semibold text-[#1A1D23]">
                {s?.welcomeTitle ?? "-"}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#64748B]">
                {s?.welcomeMessage ?? "-"}
              </p>
              <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <p className="text-[11px] text-[#94A3B8]">
                  {t("settingsPortal.chatPlaceholder")}...
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Brand Info ── */}
      {s?.brandName && (
        <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
          <div className="flex items-center gap-3">
            <div className={`${p.iconSm} ${p.iconViolet}`}>
              <Palette size={14} />
            </div>
            <div>
              <p className={p.overline}>{t("widgetAppearance.primaryColor")}</p>
              <p className="text-[13px] font-semibold text-[#1A1D23]">
                {s.brandName}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
