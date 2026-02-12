"use client";

import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, Home, Send, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { EMOJI_LIST, bubbleBorderRadius, resolveWidgetBubbleTheme } from "@helvino/shared";

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  bubbleShape?: "circle" | "rounded-square";
  bubbleIcon?: "chat" | "message" | "help" | "custom";
  bubbleSize?: number;
  bubblePosition?: "bottom-right" | "bottom-left";
  greetingText?: string;
  greetingEnabled?: boolean;
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
  botSrc?: string | null;
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

export default function WidgetPreviewRenderer({
  settings,
  theme,
  size,
  avatars,
  launcher,
}: WidgetPreviewRendererProps) {
  const { t } = useI18n();
  const [widgetState, setWidgetState] = useState<WidgetState>("welcome");
  const [messageInput, setMessageInput] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [widgetY, setWidgetY] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const scaledWidgetRef = useRef<HTMLDivElement>(null);

  const RECENT_EMOJI_KEY = "helvino_recent_emojis_preview";
  const MAX_RECENT = 16;
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) || "[]");
    } catch {
      return [];
    }
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
      try {
        localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setEmojiOpen(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setWidgetY(0);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const animate = (time: number) => {
      if (start === null) start = time;
      const elapsed = (time - start) / 1000;
      setWidgetY(Math.sin(elapsed * 1.4) * 7);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const grad = theme?.gradient || {
    from: settings.primaryColor,
    to: theme?.accentColor || settings.primaryColor,
    angle: 135,
  };
  const effectiveLauncherStyle =
    settings.launcher === "icon" ? "button" : settings.launcher === "bubble" ? "bubble" : (launcher?.style ?? "bubble");
  const bubbleTheme = resolveWidgetBubbleTheme(
    {
      primaryColor: settings.primaryColor,
      bubbleShape: settings.bubbleShape,
      bubbleIcon: settings.bubbleIcon,
      bubbleSize: settings.bubbleSize,
      bubblePosition: settings.bubblePosition,
      greetingText: settings.greetingText,
      greetingEnabled: settings.greetingEnabled,
    },
    {
      position: settings.position,
      launcher: settings.launcher,
      launcherLabel: launcher?.label,
    }
  );
  const bubbleRadius = bubbleBorderRadius(bubbleTheme.bubbleShape, bubbleTheme.bubbleSize);
  const showGreeting = bubbleTheme.greetingEnabled && bubbleTheme.greetingText.length > 0;
  const bubblePositionClass = bubbleTheme.bubblePosition === "bottom-left" ? "left-5" : "right-5";

  const bubbleIcon = () => {
    if (bubbleTheme.bubbleIcon === "help" || effectiveLauncherStyle === "button") {
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9.4a2.3 2.3 0 0 1 4.4.9c0 1.9-2.2 2.1-2.2 3.5" />
          <circle cx="12" cy="17.1" r="1" fill="#FFF" stroke="none" />
        </svg>
      );
    }
    if (bubbleTheme.bubbleIcon === "message") {
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v10H8l-4 4V5z" />
        </svg>
      );
    }
    if (bubbleTheme.bubbleIcon === "custom") {
      return <span className="text-[16px] font-bold text-white">★</span>;
    }
    return (
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={2}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  };

  const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
    Math.round(outMin + ((Math.min(Math.max(v, inMin), inMax) - inMin) / (inMax - inMin)) * (outMax - outMin));
  const previewWidth = size ? mapRange(size.customWidth, 320, 520, 280, 360) : 320;
  const previewHeight = size ? mapRange(size.customMaxHeight, 420, 900, 300, 460) : 360;
  const previewFloatY = reducedMotion ? 0 : widgetY;

  useEffect(() => {
    const updateScale = () => {
      if (!previewBodyRef.current || !scaledWidgetRef.current) {
        setPreviewScale(1);
        return;
      }
      const containerRect = previewBodyRef.current.getBoundingClientRect();
      const widgetRect = scaledWidgetRef.current.getBoundingClientRect();
      const availableH = Math.max(1, containerRect.height - 24);
      const availableW = Math.max(1, containerRect.width - 24);
      const heightScale = availableH / widgetRect.height;
      const widthScale = availableW / widgetRect.width;
      const next = Math.min(1, heightScale, widthScale);
      setPreviewScale(Math.max(0.55, next));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [previewWidth, previewHeight, widgetState, messageInput, emojiOpen, settings.welcomeMessage, settings.welcomeTitle]);

  const handlePreviewMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !previewBodyRef.current) return;
    const rect = previewBodyRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = ((e.clientY - centerY) / rect.height) * 8;
    const y = ((e.clientX - centerX) / rect.width) * -8;
    setTilt({ x, y });
  };

  const handlePreviewMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const toggleWidget = () => {
    if (widgetState === "closed") setWidgetState("welcome");
    else setWidgetState("closed");
  };
  const startChat = () => setWidgetState("open");

  const stateButtons: { key: WidgetState; labelKey: string; emoji: string }[] = [
    { key: "closed", labelKey: "widgetPreview.stateLauncher", emoji: "🚀" },
    { key: "welcome", labelKey: "widgetPreview.stateWelcome", emoji: "👋" },
    { key: "open", labelKey: "widgetPreview.stateChat", emoji: "💬" },
  ];

  const WidgetBrandFooter = () => (
    <div
      className="border-t px-[14px] py-[11px] text-center"
      style={{
        borderColor: "rgba(0,0,0,0.04)",
        background: "linear-gradient(180deg, rgba(255,251,235,0.2), rgba(255,251,235,0.5))",
      }}
      role="contentinfo"
    >
      <span className="inline-flex items-center justify-center gap-[6px]">
        <span
          className="inline-flex h-[14px] w-[14px] items-center justify-center rounded"
          style={{
            background: "linear-gradient(135deg, #F59E0B, #D97706, #B45309)",
            boxShadow: "0 1px 4px rgba(245,158,11,0.3)",
          }}
        >
          <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: 7, color: "#FFF" }}>H</span>
        </span>
        <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: 11, color: "#92400E" }}>
          {t("widgetPreview.poweredBy")}
        </span>
      </span>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[20px] border border-black/[0.05] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between border-b border-black/[0.04] px-[22px] py-4">
        <div className="flex items-center gap-2">
          <h3 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 15, color: "#1A1D23" }}>
            {t("widgetAppearance.preview")}
          </h3>
          <span
            className="inline-flex items-center gap-[5px] rounded-[20px] bg-emerald-500/10 px-2.5 py-[3px]"
            style={{ animation: "pulseGlow 2s ease infinite" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 11, color: "#10B981" }}>
              {t("widgetPreview.live")}
            </span>
          </span>
        </div>
      </div>

      <div className="border-b border-black/[0.04] bg-black/[0.015] px-[18px] py-3">
        <div className="flex gap-[3px] rounded-[10px] bg-black/[0.04] p-[3px]">
          {stateButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setWidgetState(btn.key)}
              className="flex-1 rounded-lg px-3 py-2 text-center transition-all"
              style={{
                fontFamily: "'Satoshi', sans-serif",
                fontWeight: 600,
                fontSize: 12.5,
                background: widgetState === btn.key ? "#FFF" : "transparent",
                color: widgetState === btn.key ? "#1A1D23" : "#94A3B8",
                boxShadow: widgetState === btn.key ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {btn.emoji} {t(btn.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={previewBodyRef}
        className="relative overflow-y-auto p-5"
        onMouseMove={handlePreviewMouseMove}
        onMouseLeave={handlePreviewMouseLeave}
        style={{
          height: "clamp(400px, calc(100vh - 200px), 600px)",
          minHeight: 400,
          maxHeight: 600,
          overflow: "hidden",
          perspective: "800px",
          perspectiveOrigin: "center center",
          background: `linear-gradient(180deg, ${grad.from}24 0%, ${grad.from}14 24%, #FFFFFF 55%, #FFFFFF 100%)`,
          transition: "background 0.6s ease",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[42%]"
          style={{
            backgroundImage: `linear-gradient(135deg, ${grad.from}1A 0%, transparent 40%, ${grad.from}14 60%, transparent 100%)`,
            backgroundSize: "300% 300%",
            backgroundPosition: "300% center",
            backgroundRepeat: "no-repeat",
            animation: "diamondShimmer 10s linear infinite",
            transition: "background-image 0.6s ease",
            zIndex: 0,
          }}
        />

        <div
          className="relative h-[120px] overflow-hidden rounded-[14px] p-6"
          style={{
            zIndex: 1,
            background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.7))",
            backdropFilter: "blur(8px)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            border: "1px solid rgba(255,255,255,0.6)",
            transform: `rotateX(${tilt.x * 0.3}deg) rotateY(${tilt.y * 0.3}deg)`,
            transformStyle: "preserve-3d",
            transition: "transform 0.2s ease-out",
          }}
        >
          <p style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 12, color: "#94A3B8" }}>
            {(settings.brandName || t("widgetPreview.defaultTeam")).trim()}
          </p>
          <p className="mt-1" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 11, color: "#CBD5E1" }}>
            {t("widgetPreview.yourWebsite")}
          </p>
          <div className="mt-3 flex flex-col gap-[7px]">
            <div className="h-2 w-[85%] rounded" style={{ background: `${grad.from}33`, transition: "background 0.5s ease" }} />
            <div className="h-2 w-[60%] rounded" style={{ background: `${grad.from}26`, transition: "background 0.5s ease" }} />
            <div className="h-2 w-[72%] rounded" style={{ background: `${grad.from}1A`, transition: "background 0.5s ease" }} />
            <div className="h-2 w-[45%] rounded" style={{ background: `${grad.from}14`, transition: "background 0.5s ease" }} />
          </div>
        </div>

        {widgetState === "closed" ? (
          <div className={`absolute bottom-5 ${bubblePositionClass}`} style={{ zIndex: 2 }}>
            {showGreeting ? (
              <div
                className="mb-2 max-w-[200px] truncate rounded-2xl rounded-br-sm px-3.5 py-2 text-white"
                style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
              >
                {bubbleTheme.greetingText}
              </div>
            ) : null}
            <button
              onClick={toggleWidget}
              className="flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
                boxShadow: `0 6px 24px ${grad.from}66`,
                transition: "all 0.5s ease",
                width: bubbleTheme.bubbleSize,
                height: bubbleTheme.bubbleSize,
                borderRadius: bubbleRadius,
              }}
              aria-label={t("widgetPreview.openChat")}
            >
              {bubbleIcon()}
            </button>
          </div>
        ) : (
          <div className={`absolute bottom-4 z-[2] flex ${settings.position === "right" ? "right-4 justify-end" : "left-4 justify-start"}`}>
            <div
              style={{
                width: previewWidth,
                transformOrigin: settings.position === "right" ? "bottom right" : "bottom left",
                transform: `translateY(${previewFloatY}px) scale(${previewScale}) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: "transform 0.15s ease-out",
              }}
            >
            <div ref={scaledWidgetRef}>
            <div
              className="overflow-hidden rounded-[18px] bg-white"
              style={{
                boxShadow: `${tilt.y * 2}px ${tilt.x * 2 + 12}px 40px rgba(0,0,0,0.12), ${tilt.y}px ${(tilt.x + 12) * 0.5}px 24px ${grad.from}26`,
                transition: "box-shadow 0.5s ease",
                transformStyle: "preserve-3d",
              }}
            >
              <div
                className="relative flex items-center justify-between overflow-hidden px-[18px] py-[18px]"
                style={{
                  background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
                  transition: "background 0.5s ease",
                }}
              >
                <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.12), transparent 60%)" }} />
                <div className="relative flex items-center gap-2.5">
                  <div
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[17px]"
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      backdropFilter: "blur(4px)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    💬
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 14, color: "#FFF" }}>
                      {settings.brandName || t("widgetPreview.defaultTeam")}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" style={{ boxShadow: "0 0 6px #4ADE8080" }} />
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                        {t("widgetPreview.online")}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center gap-1">
                  {widgetState === "open" ? (
                    <button onClick={() => setWidgetState("welcome")} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10" aria-label={t("widgetPreview.backToHome")}>
                      <Home size={16} color="#FFF" />
                    </button>
                  ) : null}
                  <button onClick={toggleWidget} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10" aria-label={t("widgetPreview.closeWidget")}>
                    {widgetState === "welcome" ? <ChevronDown size={18} color="#FFF" /> : <X size={16} color="#FFF" />}
                  </button>
                </div>
              </div>

              {widgetState === "welcome" ? (
                <>
                  <div className="px-[18px] pb-0 pt-[22px] text-center">
                    <div className="mx-auto mb-2.5 flex h-[46px] w-[46px] items-center justify-center rounded-[12px] text-[21px]" style={{ background: `${grad.from}1F`, transition: "background 0.5s ease" }}>
                      💬
                    </div>
                    <h4 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 18, color: "#1A1D23", marginBottom: 4 }}>{settings.welcomeTitle}</h4>
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 13, color: "#94A3B8" }}>{settings.welcomeMessage}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pt-3">
                    <button onClick={startChat} className="flex items-center gap-2.5 rounded-xl border border-black/[0.05] px-3 py-[11px] text-left">
                      <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] text-[14px]" style={{ background: `${grad.from}14`, transition: "background 0.5s ease" }}>💬</span>
                      <span>
                        <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: 12.5, color: "#1A1D23" }}>{t("widgetPreview.sendMessage")}</span>
                        <span className="block" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 10.5, color: "#B0B0B0" }}>{t("widgetPreview.replyTime")}</span>
                      </span>
                    </button>
                    <button className="flex items-center gap-2.5 rounded-xl border border-black/[0.05] px-3 py-[11px] text-left">
                      <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] text-[14px]" style={{ background: `${grad.from}14`, transition: "background 0.5s ease" }}>📚</span>
                      <span>
                        <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: 12.5, color: "#1A1D23" }}>{t("widgetPreview.searchHelp")}</span>
                        <span className="block" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 10.5, color: "#B0B0B0" }}>{t("widgetPreview.browseArticles")}</span>
                      </span>
                    </button>
                  </div>
                  <WidgetBrandFooter />
                </>
              ) : (
                <>
                  <div className="space-y-3 overflow-y-auto bg-[#FAFAF8] px-3.5 py-3.5" style={{ height: previewHeight }}>
                    <div className="flex items-start gap-2.5">
                      {avatars?.botSrc ? (
                        <img src={avatars.botSrc} alt="Bot" className="h-8 w-8 flex-shrink-0 rounded-full object-cover shadow-sm" />
                      ) : (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
                          AI
                        </div>
                      )}
                      <div className="rounded-2xl rounded-tl-sm border border-black/[0.04] bg-white px-3 py-2 shadow-sm">
                        <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 12.5, color: "#334155" }}>{t("widgetPreview.botGreeting")}</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm" style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
                        <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 12.5, color: "#FFF" }}>{t("widgetPreview.userMessage")}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-black/[0.04] bg-white px-3.5 py-3">
                    <div className="relative flex items-center gap-2">
                      <button type="button" onClick={() => setEmojiOpen((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] text-[18px] hover:bg-black/[0.03]" aria-label={t("widgetPreview.emojiBtn")}>😀</button>
                      {emojiOpen ? (
                        <div className="absolute bottom-full left-0 right-0 mb-1 grid max-h-[160px] grid-cols-8 gap-0.5 overflow-y-auto rounded-xl border border-black/[0.08] bg-white p-2 shadow-lg">
                          {recentEmojis.length > 0 && recentEmojis.map((e, i) => (
                            <button key={`r-${i}`} type="button" onClick={() => pickEmoji(e)} className="rounded-md p-1 text-center text-lg hover:bg-black/[0.03]">{e}</button>
                          ))}
                          {EMOJI_LIST.map((e, i) => (
                            <button key={i} type="button" onClick={() => pickEmoji(e)} className="rounded-md p-1 text-center text-lg hover:bg-black/[0.03]">{e}</button>
                          ))}
                        </div>
                      ) : null}
                      <input
                        ref={previewInputRef}
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder={t("widgetPreview.typePlaceholder")}
                        className="flex-1 rounded-lg border border-black/[0.08] bg-[#FAFAF8] px-3 py-2.5"
                        style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: "#1A1D23" }}
                      />
                      <button style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }} disabled={!messageInput.trim()} className="flex h-9 w-9 items-center justify-center rounded-lg text-white hover:opacity-90 disabled:opacity-40" aria-label={t("widgetPreview.sendBtn")}>
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                  <WidgetBrandFooter />
                </>
              )}
            </div>
            </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 border-t border-black/[0.04] px-[18px] py-2.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: grad.from, transition: "background 0.5s ease" }} />
        <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 11.5, color: "#94A3B8" }}>
          {previewScale < 0.999
            ? t("widgetPreview.previewScaled", { percent: String(Math.round(previewScale * 100)) })
            : t("widgetAppearance.preview")}
        </span>
      </div>

      <style jsx>{`
        .helvino-diamond-text {
          animation: diamondShimmer 6s linear infinite;
        }
        @keyframes diamondShimmer {
          0% { background-position: 300% center; }
          100% { background-position: -300% center; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.3); }
          50% { box-shadow: 0 0 0 4px rgba(16,185,129,0.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
