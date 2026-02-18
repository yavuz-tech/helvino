"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Crown, Lock, Mail, MessageSquare, Plug } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import type { TranslationKey } from "@/i18n/translations";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { p } from "@/styles/theme";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { planTier } from "@helvino/shared";

type Channel = {
  channelType: string;
  enabled: boolean;
  configured: boolean;
};

/* ── Channel metadata ── */
const CHANNEL_LABELS: Record<string, TranslationKey> = {
  live_chat: "settingsPortal.channelLiveChat",
  email: "settingsPortal.channelEmail",
  whatsapp: "settingsPortal.channelWhatsapp",
  facebook: "settingsPortal.channelFacebook",
  instagram: "settingsPortal.channelInstagram",
};

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  live_chat: MessageSquare,
  email: Mail,
  whatsapp: MessageSquare,
  facebook: MessageSquare,
  instagram: MessageSquare,
};

const CHANNEL_COLORS: Record<string, string> = {
  live_chat: p.iconBlue,
  email: p.iconIndigo,
  whatsapp: p.iconEmerald,
  facebook: p.iconBlue,
  instagram: p.iconViolet,
};

/* Channels available on Free plan */
const FREE_CHANNELS = new Set(["live_chat", "email"]);

export default function PortalSettingsChannelsPage() {
  const { t } = useI18n();
  const { planKey } = useFeatureAccess();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* Fetch channels + plan */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    portalApiFetch("/portal/settings/channels")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error("CHANNELS_FAILED");
        if (!cancelled) setChannels(data?.channels || []);
      })
      .catch(() => {
        if (cancelled) return;
        setChannels([]);
        setLoadError(t("common.networkError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isPro = planTier(planKey) >= 2;

  const toggleChannel = async (channelType: string, enabled: boolean) => {
    setSaving(channelType);
    try {
      const res = await portalApiFetch("/portal/settings/channels", {
        method: "PUT",
        body: JSON.stringify({ channelType, enabled }),
      });
      if (res.ok) {
        setChannels((prev) =>
          prev.map((ch) =>
            ch.channelType === channelType ? { ...ch, enabled } : ch
          )
        );
        premiumToast.success({ title: t("toast.settingsSaved"), description: t("toast.settingsSavedDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
    setSaving(null);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  const enabledCount = channels.filter((c) => c.enabled).length;

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader
        title={t("settingsPortal.channels")}
        subtitle={t("settingsPortal.channelsSubtitle")}
      />

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("settingsPortal.channels")}
          value={String(channels.length)}
          icon={Plug}
          color="amber"
        />
        <StatCard
          label={t("common.enabled")}
          value={String(enabledCount)}
          icon={MessageSquare}
          color="emerald"
        />
        <StatCard
          label={t("common.disabled")}
          value={String(channels.length - enabledCount)}
          icon={Mail}
          color="slate"
        />
      </div>

      {/* ── Channel Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {channels.map((channel) => {
          const Icon = CHANNEL_ICONS[channel.channelType] || Plug;
          const iconColor = CHANNEL_COLORS[channel.channelType] || p.iconSlate;
          const isSaving = saving === channel.channelType;
          const isFreeChannel = FREE_CHANNELS.has(channel.channelType);
          const isLocked = !isFreeChannel && !isPro;

          return (
            <Card key={channel.channelType} className="border-[#F3E8D8] hover:border-[#E8D5BC]">
              <div
                className="flex items-center gap-4 rounded-lg pl-3"
                style={{ borderLeft: channel.enabled ? "3px solid #10B981" : "3px solid #F3E8D8" }}
              >
                <div className={`${p.iconMd} ${isLocked ? p.iconSlate : iconColor}`}>
                  {isLocked ? <Lock size={18} /> : <Icon size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-800">
                      {t(
                        CHANNEL_LABELS[channel.channelType] ??
                          "settingsPortal.channels"
                      )}
                    </span>
                    {isFreeChannel ? (
                      <span className={p.badgeGreen}>
                        {t("settingsPortal.channelFree")}
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isPro
                            ? "bg-violet-50 text-violet-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Crown size={10} />
                        {t("settingsPortal.channelPremium")}
                      </span>
                    )}
                  </div>
                  {isLocked ? (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {t("settingsPortal.channelPremiumDesc")}
                    </p>
                  ) : (
                    <span
                      className={`mt-1 ${
                        channel.enabled ? p.badgeGreen : p.badgeSlate
                      }`}
                    >
                      {channel.enabled
                        ? t("common.enabled")
                        : t("common.disabled")}
                    </span>
                  )}
                </div>

                {/* Toggle or Upgrade CTA */}
                {isLocked ? (
                  <Link
                    href="/portal/pricing"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-colors"
                    style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
                  >
                    <Crown size={11} />
                    {t("settingsPortal.channelUpgrade")}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      toggleChannel(channel.channelType, !channel.enabled)
                    }
                    className={[
                      "relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
                      channel.enabled
                        ? "bg-amber-500"
                        : "bg-slate-200 hover:bg-slate-300",
                      isSaving
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                        channel.enabled
                          ? "translate-x-[22px]"
                          : "translate-x-0.5",
                      ].join(" ")}
                    />
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
