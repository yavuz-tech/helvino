"use client";

import { useEffect, useState } from "react";
import { Globe, MessageSquare, RotateCcw, Save, Users, Clock3 } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Toggle from "@/components/ui/Toggle";
import { InputField, TextareaField } from "@/components/ui/Field";
import { p } from "@/styles/theme";
import ErrorBanner from "@/components/ErrorBanner";

type ChatPageConfig = {
  id: string;
  title: string;
  subtitle: string;
  placeholder: string;
  showAgentAvatars: boolean;
  showOperatingHours: boolean;
};

/* English defaults from the DB — used to detect untranslated values */
const EN_DEFAULTS = {
  title: "Chat with us",
  subtitle: "We reply as soon as possible",
  placeholder: "Write your message...",
};

export default function PortalSettingsChatPage() {
  const { t, locale } = useI18n();
  const [config, setConfig] = useState<ChatPageConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeEnglishDefaults = (cfg: ChatPageConfig): ChatPageConfig => {
    if (locale === "en") return cfg;
    return {
      ...cfg,
      title: cfg.title === EN_DEFAULTS.title ? t("settingsPortal.chatTitleDefault") : cfg.title,
      subtitle:
        cfg.subtitle === EN_DEFAULTS.subtitle
          ? t("settingsPortal.chatSubtitleDefault")
          : cfg.subtitle,
      placeholder:
        cfg.placeholder === EN_DEFAULTS.placeholder
          ? t("settingsPortal.chatPlaceholderDefault")
          : cfg.placeholder,
    };
  };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    portalApiFetch("/portal/settings/chat-page")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.config) throw new Error("LOAD_FAILED");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setConfig(normalizeEnglishDefaults(data.config));
      })
      .catch(() => {
        if (cancelled) return;
        setError(t("common.networkError"));
        setConfig(null);
      });
    return () => { cancelled = true; };
  }, [locale]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await portalApiFetch("/portal/settings/chat-page", {
        method: "PUT",
        body: JSON.stringify(config),
      });
      if (res.ok) {
        premiumToast.success({ title: t("toast.settingsSaved"), description: t("toast.settingsSavedDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
    setSaving(false);
  };

  /* Apply locale-specific default values */
  const applyLocaleDefaults = () => {
    if (!config) return;
    setConfig({
      ...config,
      title: t("settingsPortal.chatTitleDefault"),
      subtitle: t("settingsPortal.chatSubtitleDefault"),
      placeholder: t("settingsPortal.chatPlaceholderDefault"),
    });
    premiumToast.info({ title: t("settingsPortal.defaultsApplied"), description: t("settingsPortal.resetToLocaleDefaults") });
  };

  /* Detect if current values are the untranslated English defaults */
  const hasEnglishDefaults =
    config &&
    (config.title === EN_DEFAULTS.title ||
      config.subtitle === EN_DEFAULTS.subtitle ||
      config.placeholder === EN_DEFAULTS.placeholder);

  if (!config) {
    if (!error)
      return (
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
        </div>
      );

    return (
      <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
        <PageHeader title={t("settingsPortal.chatPage")} subtitle={t("settingsPortal.chatPageSubtitle")} />
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>
    );
  }

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader
        title={t("settingsPortal.chatPage")}
        subtitle={t("settingsPortal.chatPageSubtitle")}
        action={
          <div className="flex items-center gap-2">
            <button onClick={applyLocaleDefaults} className={p.btnSecondary}>
              <RotateCcw size={12} />
              {t("settingsPortal.resetToLocaleDefaults")}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
            >
              <Save size={13} />
              {saving ? t("common.saving") : t("portal.saveSettings")}
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Language hint banner — shown when English defaults are detected */}
      {hasEnglishDefaults && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Globe size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-amber-800">
              {t("settingsPortal.chatPage")}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700 leading-snug">
              {t("settingsPortal.resetToLocaleDefaults")}
            </p>
          </div>
          <button onClick={applyLocaleDefaults} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-200">
            <RotateCcw size={11} />
            {t("settingsPortal.resetToLocaleDefaults")}
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("settingsPortal.chatTitle")} value={config.title || "-"} icon={MessageSquare} color="blue" />
        <StatCard label={t("settingsPortal.showAgentAvatars")} value={config.showAgentAvatars ? t("common.yes") : t("common.no")} icon={Users} color="violet" />
        <StatCard label={t("settingsPortal.showOperatingHours")} value={config.showOperatingHours ? t("common.yes") : t("common.no")} icon={Clock3} color="emerald" />
      </div>

      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconBlue}`}><MessageSquare size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.chatPage")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label={t("settingsPortal.chatTitle")}
            value={config.title}
            onChange={(v) => setConfig({ ...config, title: v })}
            placeholder={t("settingsPortal.chatTitleDefault")}
          />
          <InputField
            label={t("settingsPortal.chatSubtitle")}
            value={config.subtitle}
            onChange={(v) => setConfig({ ...config, subtitle: v })}
            placeholder={t("settingsPortal.chatSubtitleDefault")}
          />
        </div>
        <div className="mt-4">
          <TextareaField
            label={t("settingsPortal.chatPlaceholder")}
            value={config.placeholder}
            onChange={(v) => setConfig({ ...config, placeholder: v })}
            placeholder={t("settingsPortal.chatPlaceholderDefault")}
          />
        </div>
      </Card>

      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconViolet}`}><Users size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.general")}</h2>
        </div>
        <div className="space-y-2">
          <Toggle label={t("settingsPortal.showAgentAvatars")} checked={config.showAgentAvatars} onChange={(v) => setConfig({ ...config, showAgentAvatars: v })} />
          <Toggle label={t("settingsPortal.showOperatingHours")} checked={config.showOperatingHours} onChange={(v) => setConfig({ ...config, showOperatingHours: v })} />
        </div>
      </Card>
    </div>
  );
}
