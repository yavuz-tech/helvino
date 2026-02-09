"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { Plug, MessageSquare, Mail, Check, AlertCircle } from "lucide-react";

type Channel = {
  channelType: string;
  enabled: boolean;
  configured: boolean;
};

const CHANNEL_LABELS: Record<string, TranslationKey> = {
  live_chat: "settingsPortal.channelLiveChat",
  email: "settingsPortal.channelEmail",
  whatsapp: "settingsPortal.channelWhatsapp",
  facebook: "settingsPortal.channelFacebook",
  instagram: "settingsPortal.channelInstagram",
};

const CHANNEL_ICONS: Record<string, { icon: React.FC<{ size?: number; className?: string }>; color: string; bg: string }> = {
  live_chat: { icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
  email: { icon: Mail, color: "text-emerald-600", bg: "bg-emerald-50" },
  whatsapp: { icon: MessageSquare, color: "text-green-600", bg: "bg-green-50" },
  facebook: { icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-50" },
  instagram: { icon: MessageSquare, color: "text-pink-600", bg: "bg-pink-50" },
};

export default function PortalSettingsChannelsPage() {
  const { t } = useI18n();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    portalApiFetch("/portal/settings/channels")
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []))
      .catch(() => setStatus(t("common.networkError")));
  }, [t]);

  const toggleChannel = async (channelType: string, enabled: boolean) => {
    setSaving(channelType);
    setStatus("");
    const res = await portalApiFetch("/portal/settings/channels", {
      method: "PUT",
      body: JSON.stringify({ channelType, enabled }),
    });
    if (res.ok) {
      setChannels((prev) =>
        prev.map((ch) => (ch.channelType === channelType ? { ...ch, enabled } : ch))
      );
      setStatus(t("portal.settingsSaved"));
    } else {
      setStatus(t("portal.failedSaveSettings"));
    }
    setSaving(null);
  };

  if (!channels.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  const enabledCount = channels.filter((c) => c.enabled).length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-violet-50/40 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <Plug size={18} className="text-violet-600" />
          <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.channels")}</h1>
        </div>
        <p className="text-sm text-slate-600 mt-1">{t("settingsPortal.channelsSubtitle")}</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.channels")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{channels.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("common.enabled")}</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{enabledCount}</p>
          </div>
        </div>
      </div>

      {status && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          status.includes(t("portal.settingsSaved"))
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-red-50 border-red-200 text-red-900"
        }`}>
          {status.includes(t("portal.settingsSaved")) ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{status}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-5 uppercase tracking-wider">{t("settingsPortal.channels")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => {
            const cfg = CHANNEL_ICONS[channel.channelType] || { icon: Plug, color: "text-slate-600", bg: "bg-slate-50" };
            const Icon = cfg.icon;
            return (
              <div
                key={channel.channelType}
                className={`border-2 rounded-xl p-5 transition-all hover:shadow-md ${
                  channel.enabled
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200 bg-slate-50/30"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                      <Icon size={18} className={cfg.color} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{t(CHANNEL_LABELS[channel.channelType] ?? "settingsPortal.channels")}</p>
                      <p className={`text-xs font-medium ${channel.enabled ? "text-emerald-600" : "text-slate-500"}`}>
                        {channel.enabled ? t("common.enabled") : t("common.disabled")}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channel.enabled}
                      onChange={(e) => toggleChannel(channel.channelType, e.target.checked)}
                      disabled={saving === channel.channelType}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
                {saving === channel.channelType && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                    {t("common.saving")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
