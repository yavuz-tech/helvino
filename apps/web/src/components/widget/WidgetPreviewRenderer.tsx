"use client";

import { useState, useRef } from "react";
import { MessageCircle, X, Send, ChevronDown, Home, HelpCircle, User } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { EMOJI_LIST } from "@helvino/shared";

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
}

interface ThemeOverrides {
  accentColor?: string;
  surfaceColor?: string;
  gradient?: { from: string; to: string; angle: number };
}

interface SizeConfig {
  customWidth: number;
  customMaxHeight: number;
}

interface AvatarConfig {
  /** Resolved src for bot avatar (url or data-url) */
  botSrc?: string | null;
  /** Resolved src list for agent avatars */
  agentSrcs?: (string | null)[];
}

interface LauncherConfig {
  label?: string;
  style?: "bubble" | "button";
}

interface WidgetPreviewRendererProps {
  settings: WidgetSettings;
  theme?: ThemeOverrides;
  size?: SizeConfig;
  avatars?: AvatarConfig;
  launcher?: LauncherConfig;
}

type WidgetState = "closed" | "open" | "welcome";

export default function WidgetPreviewRenderer({ settings, theme, size, avatars, launcher }: WidgetPreviewRendererProps) {
  const { t } = useI18n();
  const [widgetState, setWidgetState] = useState<WidgetState>("closed");
  const [messageInput, setMessageInput] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const previewInputRef = useRef<HTMLInputElement>(null);

  const RECENT_EMOJI_KEY = "helvino_recent_emojis_preview";
  const MAX_RECENT = 16;
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) || "[]"); } catch { return []; }
  });

  const pickEmoji = (emoji: string) => {
    const input = previewInputRef.current;
    if (input) {
      const start = input.selectionStart ?? messageInput.length;
      const end = input.selectionEnd ?? messageInput.length;
      setMessageInput(messageInput.slice(0, start) + emoji + messageInput.slice(end));
    } else {
      setMessageInput((v) => v + emoji);
    }
    setRecentEmojis((prev) => {
      const updated = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
    setEmojiOpen(false);
  };

  const accent = theme?.accentColor || settings.primaryColor;
  const surface = theme?.surfaceColor || "#F8FAFC";
  const grad = theme?.gradient || { from: settings.primaryColor, to: settings.primaryColor, angle: 135 };
  const headerBg = `linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})`;

  // Resolve avatar sources for header display
  const headerAvatarSrcs: string[] = [];
  if (avatars?.agentSrcs) {
    avatars.agentSrcs.forEach((s) => { if (s) headerAvatarSrcs.push(s); });
  }
  if (avatars?.botSrc) headerAvatarSrcs.push(avatars.botSrc);
  const hasAvatars = headerAvatarSrcs.length > 0;

  const HeaderAvatarRow = () => (
    <div className="flex -space-x-2">
      {hasAvatars ? (
        headerAvatarSrcs.slice(0, 3).map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            style={{ objectPosition: "50% 15%" }}
            className="w-8 h-8 rounded-full object-cover border-2 border-white/80 shadow-sm"
          />
        ))
      ) : (
        <>
          <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
            <User size={16} />
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
            <User size={16} />
          </div>
        </>
      )}
    </div>
  );

  /* ── Proportional scaling: map config values into preview-safe range ── */
  const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
    Math.round(outMin + ((Math.min(Math.max(v, inMin), inMax) - inMin) / (inMax - inMin)) * (outMax - outMin));
  // Width  320-520 → 300-440   |   Height 420-900 → 320-560
  const previewWidth = size ? mapRange(size.customWidth, 320, 520, 300, 440) : 360;
  const previewHeight = size ? mapRange(size.customMaxHeight, 420, 900, 320, 560) : 520;

  const toggleWidget = () => {
    if (widgetState === "closed") {
      setWidgetState("welcome");
    } else {
      setWidgetState("closed");
    }
  };

  const startChat = () => {
    setWidgetState("open");
  };

  /* ── State selector buttons ── */
  const stateButtons: { key: WidgetState; labelKey: string }[] = [
    { key: "closed", labelKey: "widgetPreview.stateLauncher" },
    { key: "welcome", labelKey: "widgetPreview.stateWelcome" },
    { key: "open", labelKey: "widgetPreview.stateChat" },
  ];

  return (
    <div>
      {/* State switcher */}
      <div className="flex items-center gap-1 mb-4">
        {stateButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setWidgetState(btn.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              widgetState === btn.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t(btn.labelKey)}
          </button>
        ))}
      </div>

      <div className="relative rounded-2xl h-[600px] overflow-hidden border border-slate-200/80 shadow-sm" style={{ background: `linear-gradient(135deg, ${surface}ee, #f1f5f9)` }}>
        {/* Simulated Website Background */}
        <div className="absolute inset-0 p-8">
          <div className="text-slate-400 text-sm mb-3">{t("widgetPreview.yourWebsite")}</div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4 opacity-50" />
            <div className="h-4 bg-slate-200 rounded w-1/2 opacity-50" />
            <div className="h-4 bg-slate-200 rounded w-5/6 opacity-50" />
          </div>
        </div>

        {/* Widget Launcher */}
        {widgetState === "closed" && (
          <div className={`absolute bottom-6 flex items-end gap-2 ${
            settings.position === "right" ? "right-6" : "left-6"
          }`}>
            {launcher?.label && (
              <div
                style={{ background: headerBg }}
                className="px-4 py-2.5 rounded-2xl rounded-br-sm shadow-lg text-white text-sm font-medium max-w-[200px] truncate mb-1"
              >
                {launcher.label}
              </div>
            )}
            <button
              onClick={toggleWidget}
              style={{ background: headerBg }}
              className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-all duration-200 group relative flex-shrink-0"
              aria-label={t("widgetPreview.openChat")}
            >
              {(launcher?.style ?? settings.launcher) === "bubble" ? (
                <MessageCircle size={24} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
              ) : (
                <HelpCircle size={24} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
              )}
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: accent }}>
                2
              </span>
            </button>
          </div>
        )}

        {/* Welcome State */}
        {widgetState === "welcome" && (
          <div
            className={`absolute bottom-6 ${
              settings.position === "right" ? "right-6" : "left-6"
            } bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden`}
            style={{ width: `${previewWidth}px` }}
          >
            {/* Header with gradient */}
            <div
              style={{ background: headerBg }}
              className="px-5 py-4 text-white flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <HeaderAvatarRow />
                <div>
                  <div className="font-semibold text-sm">
                    {settings.brandName || t("widgetPreview.defaultTeam")}
                  </div>
                  <div className="text-xs opacity-90 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    {t("widgetPreview.online")}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleWidget}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label={t("widgetPreview.closeWidget")}
              >
                <ChevronDown size={20} />
              </button>
            </div>

            {/* Welcome Content */}
            <div className="p-6" style={{ backgroundColor: surface }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ background: `${accent}20` }}>
                  <MessageCircle size={24} style={{ color: accent }} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {settings.welcomeTitle}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {settings.welcomeMessage}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2 mb-4">
                <button
                  onClick={startChat}
                  className="w-full px-4 py-3 bg-white hover:bg-slate-50 rounded-xl text-left transition-colors group border border-slate-200/50"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle size={18} style={{ color: accent }} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{t("widgetPreview.sendMessage")}</div>
                      <div className="text-xs text-slate-500">{t("widgetPreview.replyTime")}</div>
                    </div>
                  </div>
                </button>
                <button className="w-full px-4 py-3 bg-white hover:bg-slate-50 rounded-xl text-left transition-colors group border border-slate-200/50">
                  <div className="flex items-center gap-3">
                    <HelpCircle size={18} style={{ color: accent }} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{t("widgetPreview.searchHelp")}</div>
                      <div className="text-xs text-slate-500">{t("widgetPreview.browseArticles")}</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="text-center text-[0.7rem] tracking-wide leading-none py-1.5 select-none text-slate-500" role="contentinfo">
                {t("widgetPreview.poweredByPrefix")}
                <a href="https://helvion.io" target="_blank" rel="noopener noreferrer" className="helvino-brand-shimmer hover:opacity-85 transition-opacity">
                  Helvion
                </a>
                {t("widgetPreview.poweredBySuffix")}
              </div>
            </div>
          </div>
        )}

        {/* Open Chat State */}
        {widgetState === "open" && (
          <div
            className={`absolute bottom-6 ${
              settings.position === "right" ? "right-6" : "left-6"
            } bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col`}
            style={{
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
            }}
          >
            {/* Header with gradient */}
            <div
              style={{ background: headerBg }}
              className="px-5 py-4 text-white flex items-center justify-between flex-shrink-0"
            >
              <div className="flex items-center gap-3">
                <HeaderAvatarRow />
                <div>
                  <div className="font-semibold text-sm">
                    {settings.brandName || t("widgetPreview.defaultTeam")}
                  </div>
                  <div className="text-xs opacity-90 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    {t("widgetPreview.online")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setWidgetState("welcome")}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                  aria-label={t("widgetPreview.backToHome")}
                >
                  <Home size={18} />
                </button>
                <button
                  onClick={toggleWidget}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                  aria-label={t("widgetPreview.closeWidget")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: surface }}>
              {/* Bot Welcome Message */}
              <div className="flex items-start gap-3">
                {avatars?.botSrc ? (
                  <img src={avatars.botSrc} alt="Bot" style={{ objectPosition: "50% 15%" }} className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-sm" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${accent}, ${settings.primaryColor})` }}>
                    AI
                  </div>
                )}
                <div className="flex-1">
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-200/80">
                    <p className="text-sm text-slate-800 leading-relaxed">
                      {t("widgetPreview.botGreeting")}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 px-1">{t("widgetPreview.justNow")}</div>
                </div>
              </div>

              {/* User Message */}
              <div className="flex items-start gap-3 justify-end">
                <div className="flex-1 flex flex-col items-end">
                  <div
                    style={{ background: headerBg }}
                    className="rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm max-w-[80%]"
                  >
                    <p className="text-sm text-white leading-relaxed">
                      {t("widgetPreview.userMessage")}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 px-1">{t("widgetPreview.timeAgo")}</div>
                </div>
              </div>
            </div>

            {/* Message Composer */}
            <div className="px-4 py-3 bg-white border-t border-slate-200/80 flex-shrink-0">
              <div className="flex gap-2 items-center relative">
                <button
                  type="button"
                  onClick={() => setEmojiOpen((v) => !v)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 border border-slate-300 flex-shrink-0 transition-colors"
                  aria-label={t("widgetPreview.emojiBtn")}
                >
                  <span className="text-lg" aria-hidden>😀</span>
                </button>
                {emojiOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[180px] overflow-y-auto grid grid-cols-8 gap-0.5 p-2 z-10">
                    {recentEmojis.length > 0 && recentEmojis.map((e, i) => (
                      <button key={`r-${i}`} type="button" onClick={() => pickEmoji(e)} className="text-lg p-1 rounded-lg hover:bg-slate-100 transition-colors text-center">{e}</button>
                    ))}
                    {EMOJI_LIST.map((e, i) => (
                      <button key={i} type="button" onClick={() => pickEmoji(e)} className="text-lg p-1 rounded-lg hover:bg-slate-100 transition-colors text-center">{e}</button>
                    ))}
                  </div>
                )}
                <input
                  ref={previewInputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={t("widgetPreview.typePlaceholder")}
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                />
                <button
                  style={{ background: headerBg }}
                  disabled={!messageInput.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
                  aria-label={t("widgetPreview.sendBtn")}
                >
                  <Send size={18} />
                </button>
              </div>
              {/* Branding – always visible in preview (server-enforced in production) */}
              <div className="text-center text-[0.7rem] tracking-wide leading-none pt-2.5 pb-0.5 select-none text-slate-500" role="contentinfo">
                {t("widgetPreview.poweredByPrefix")}
                <a href="https://helvion.io" target="_blank" rel="noopener noreferrer" className="helvino-brand-shimmer hover:opacity-85 transition-opacity">
                  Helvion
                </a>
                {t("widgetPreview.poweredBySuffix")}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
