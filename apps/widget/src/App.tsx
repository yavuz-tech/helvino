import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { createConversation, sendMessage, requestAiHelp, API_URL, getOrgKey, getSiteId, getOrgToken, Message, loadBootloader, loadBootloaderVersion, BootloaderConfig, setOrgToken } from "./api";
import { EMOJI_LIST, bubbleBorderRadius, resolveWidgetBubbleTheme } from "@helvino/shared";
import { sanitizeHTML, sanitizePlainText } from "./sanitize";
import { getVisitorId } from "./utils/visitor";

const APP_NAME = "Helvion";
const HELVINO_SITE_URL = "https://helvion.io";

const STORAGE_KEY = "helvino_conversation_id";
const RECENT_EMOJI_KEY = "helvino_recent_emojis";
const MAX_RECENT = 16;

/** AI offline help strings */
const AI_OFFLINE_COPY: Record<string, { button: string; joined: string; systemMsg: string }> = {
  en: { button: "No operators available. Get AI help now", joined: "AI Assistant has joined to help you", systemMsg: "No operators available. AI Assistant will help." },
  tr: { button: "Operatör yok. Şimdi AI yardımı alın", joined: "AI Asistan size yardım etmek için katıldı", systemMsg: "Operatör yok. AI Asistan yardım edecek." },
  es: { button: "Sin operadores. Obtener ayuda AI ahora", joined: "El Asistente AI se ha unido para ayudarte", systemMsg: "Sin operadores disponibles. El Asistente AI ayudará." },
};

const UNAUTHORIZED_COPY: Record<string, { title: string; body: string }> = {
  en: {
    title: "Unauthorized domain",
    body: "This domain is not allowed. Please update the allowlist in the portal.",
  },
  tr: {
    title: "Yetkisiz alan adı",
    body: "Bu alan adı yetkili değil. Lütfen portalda allowlist’i güncelleyin.",
  },
  es: {
    title: "Dominio no autorizado",
    body: "Este dominio no está permitido. Actualiza la allowlist en el portal.",
  },
};

interface AppProps {
  externalIsOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  /** iframe mode hides launcher and asks parent to close instead of rendering launcher */
  mode?: "embed" | "frame";
  onRequestClose?: () => void;
}

function sanitizeMessage(message: Message): Message {
  return {
    ...message,
    content: sanitizeHTML(message.content || ""),
  };
}

function App({ externalIsOpen, onOpenChange, mode = "embed", onRequestClose }: AppProps = {}) {
  const [bootloaderConfig, setBootloaderConfig] = useState<BootloaderConfig | null>(null);
  const [bootloaderError, setBootloaderError] = useState<string | null>(null);
  const [isOpen, setIsOpenInternal] = useState(false);
  const warnedDisabledRef = useRef(false);
  const warnedUnauthorizedRef = useRef(false);

  const isFrame = mode === "frame";

  // Use external control if provided, otherwise internal state
  const actualIsOpen = isFrame ? true : (externalIsOpen !== undefined ? externalIsOpen : isOpen);
  useEffect(() => { console.log("[Widget] isOpen changed:", isOpen, "actualIsOpen:", actualIsOpen); }, [isOpen, actualIsOpen]);
  const setIsOpen = (open: boolean) => {
    if (isFrame && open === false) {
      // In iframe mode, closing means "tell parent to hide the iframe".
      onRequestClose?.();
      return;
    }
    setIsOpenInternal(open);
    onOpenChange?.(open);
  };
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "refreshing" | "error" | null>(null);
  // Suppress connection banners for the first 5s after mount (initial load grace period).
  const [connGracePeriod, setConnGracePeriod] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setConnGracePeriod(false), 5000);
    return () => clearTimeout(t);
  }, []);
  const [agentTyping, setAgentTyping] = useState(false);
  const [_aiTyping, setAiTyping] = useState(false); // Distinguish AI vs human typing (reserved for future use)
  void _aiTyping;
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) || "[]"); } catch { return []; }
  });

  // AI offline help state
  const [showAiHelpButton, setShowAiHelpButton] = useState(false);
  const [aiHelpLoading, setAiHelpLoading] = useState(false);
  const [aiAutoJoinedShown, setAiAutoJoinedShown] = useState(false);
  const aiWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMsgTimeRef = useRef<number>(0);
  const gotResponseSinceLastMsgRef = useRef(false);

  // Attention grabber delay — show only after N seconds
  const [attGrabberVisible, setAttGrabberVisible] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const lastConfigVersionRef = useRef<number | null>(null);
  const configPollInFlightRef = useRef(false);

  /** Whether branding must be shown (server-enforced, defaults true) */
  const brandingRequired = bootloaderConfig?.config?.brandingRequired !== false;

  // Keep ref in sync so socket listener always sees current conversationId
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Body scroll lock is handled by the HOST loader (iframe architecture).

  /** Detect embed-config mismatch: config tries to hide branding but server says required */
  useEffect(() => {
    if (!bootloaderConfig) return;
    const embedWantsBrandOff = (window as any).HELVINO_BRAND_DISABLED === true;
    if (embedWantsBrandOff && brandingRequired) {
      console.warn("[Helvion] Branding mismatch: embed config requests branding off, but server entitlement requires branding. Enforcing branding.");
    }
  }, [bootloaderConfig, brandingRequired]);

  // Auto-open widget on first load if configured in portal
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!bootloaderConfig || autoOpenedRef.current) return;
    const _v3s = (bootloaderConfig.config.widgetSettings || {}) as Record<string, unknown>;
    if (_v3s.autoOpen === true) {
      autoOpenedRef.current = true;
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [bootloaderConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attention grabber delay — show after configured seconds
  useEffect(() => {
    if (!bootloaderConfig) return;
    const _v3s = (bootloaderConfig.config.widgetSettings || {}) as Record<string, unknown>;
    const grabId = _v3s.attGrabberId || "none";
    if (grabId === "none") { setAttGrabberVisible(false); return; }
    const delaySec = typeof _v3s.attGrabberDelay === "number" ? _v3s.attGrabberDelay : 3;
    const timer = setTimeout(() => setAttGrabberVisible(true), delaySec * 1000);
    return () => clearTimeout(timer);
  }, [bootloaderConfig]);

  // Keyboard handling is isolated inside the iframe.

  const pickEmoji = (emoji: string) => {
    // Insert at cursor position
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? inputValue.length;
      const end = input.selectionEnd ?? inputValue.length;
      const next = inputValue.slice(0, start) + emoji + inputValue.slice(end);
      setInputValue(next);
      setTimeout(() => { input.focus(); input.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
    } else {
      setInputValue((v) => v + emoji);
    }
    // Update recent emojis
    setRecentEmojis((prev) => {
      const updated = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(updated));
      return updated;
    });
    setEmojiOpen(false);
  };

  // Load bootloader config on mount and refresh when widget opens
  const bootloaderLoadedRef = useRef(false);
  useEffect(() => {
    const initBootloader = async () => {
      try {
        const config = await loadBootloader();
        console.log("Bootloader config loaded", config);
        
        // Cache org token for subsequent API requests
        if (config.orgToken) {
          setOrgToken(config.orgToken);
        } else {
          console.warn("⚠️  No orgToken in bootloader response");
        }
        
        if (typeof config.configVersion === "number") {
          lastConfigVersionRef.current = config.configVersion;
        }
        setBootloaderConfig(config);
        bootloaderLoadedRef.current = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load bootloader";
        console.error("❌ Bootloader error:", errorMessage);
        setBootloaderError(errorMessage);
      }
    };

    initBootloader();
  }, []);

  // Poll for config changes (safe + lightweight): check version every 60s,
  // reload full bootloader only when version changes.
  useEffect(() => {
    if (!bootloaderLoadedRef.current) return;

    const isDebug = () =>
      (window as any).HELVION_DEBUG_WIDGET === true || (window as any).HELVINO_DEBUG_WIDGET === true;

    const tick = async () => {
      if (configPollInFlightRef.current) return;
      configPollInFlightRef.current = true;
      try {
        const v = await loadBootloaderVersion();
        const prev = lastConfigVersionRef.current;
        if (prev != null && v.configVersion === prev) {
          if (isDebug()) console.log("[Widget] config poll: unchanged", { configVersion: v.configVersion });
          return;
        }
        if (isDebug()) console.log("[Widget] config poll: changed, refreshing...", { prev, next: v.configVersion });

        const nextConfig = await loadBootloader();
        if (typeof nextConfig.configVersion === "number") {
          lastConfigVersionRef.current = nextConfig.configVersion;
        } else {
          lastConfigVersionRef.current = v.configVersion;
        }
        setBootloaderConfig((current) => {
          // Avoid re-render when nothing changed (extra safety).
          const currentV = current?.configVersion;
          const nextV = nextConfig.configVersion;
          if (typeof currentV === "number" && typeof nextV === "number" && currentV === nextV) {
            if (isDebug()) console.log("[Widget] skip setBootloaderConfig: same version", { currentV });
            return current;
          }
          return nextConfig;
        });
      } catch (e) {
        if (isDebug()) console.warn("[Widget] config poll failed (ignored)", e);
      } finally {
        configPollInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, [bootloaderConfig?.org?.id]);

  // Surface "silent" non-render conditions in the console to make production
  // debugging easier for customers who embedded the script correctly.
  useEffect(() => {
    if (!bootloaderConfig) return;

    if (!bootloaderConfig.config.widgetEnabled && !warnedDisabledRef.current) {
      warnedDisabledRef.current = true;
      console.warn(
        "[Helvion Widget] widgetEnabled=false — widget UI will not render. Enable the widget in the portal settings."
      );
    }

    if (bootloaderConfig.config.unauthorizedDomain && !warnedUnauthorizedRef.current) {
      warnedUnauthorizedRef.current = true;
      console.warn(
        `[Helvion Widget] Unauthorized domain detected (${window.location.hostname}). ` +
          "Widget UI is hidden by default. Add this domain to the allowlist in the portal, " +
          "or set window.HELVION_DEBUG_WIDGET=true before loading embed.js to show the warning card."
      );
    }
  }, [bootloaderConfig]);

  // Connect Socket.IO only after bootloader token is available.
  // Otherwise the handshake fails and we never receive real-time updates.
  useEffect(() => {
    const token = bootloaderConfig?.orgToken || getOrgToken();
    if (!token) return;
    if (socketRef.current) return;
    try {
      const siteId = getSiteId();
      const orgKey = getOrgKey();
      const auth: Record<string, unknown> = {
        token,
        visitorId: getVisitorId(),
      };
      if (siteId) auth.siteId = siteId;
      else if (orgKey) auth.orgKey = orgKey;

      socketRef.current = io(API_URL, {
        transports: ["websocket", "polling"],
        auth,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        randomizationFactor: 0.3,
        timeout: 10000,
      });
      socketRef.current.on("connect", () => {
        console.log("✅ Connected to Socket.IO", { siteId, orgKey });
      });
      socketRef.current.on("disconnect", () => {
        console.log("❌ Disconnected from Socket.IO");
      });
      socketRef.current.on("connect_error", (err: any) => {
        console.warn("❌ Socket.IO connect_error", {
          message: err?.message,
          description: err?.description,
          context: err?.context,
        });
      });

      // Real-time config updates: when portal user saves settings, widget updates instantly
      socketRef.current.on("widget:config-updated", () => {
        console.log("[Widget] Config updated via socket — refreshing...");
        loadBootloader()
          .then((config) => {
            if (config.orgToken) setOrgToken(config.orgToken);
            setBootloaderConfig(config);
            console.log("[Widget] Config refreshed after portal save");
          })
          .catch((err) => console.warn("[Widget] Failed to refresh config:", err));
      });

      // Chat event listeners — always registered, filtered by conversationId
      socketRef.current.on("message:new", (data: { conversationId: string; message: Message }) => {
        if (data.conversationId === conversationIdRef.current) {
          setMessages((prev) => [...prev, sanitizeMessage(data.message)]);
          setAgentTyping(false);
          // Play notification sound if enabled and message is from agent/AI
          if (data.message.role === "assistant") {
            try {
              const _sws = (bootloaderConfig?.config?.widgetSettings || {}) as Record<string, unknown>;
              if (_sws.soundEnabled !== false) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                osc.type = "sine";
                gain.gain.value = 0.1;
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
              }
            } catch { /* sound not critical */ }
          }
          if (data.message.role === "assistant") {
            gotResponseSinceLastMsgRef.current = true;
            setShowAiHelpButton(false);
            if (aiWaitTimerRef.current) { clearTimeout(aiWaitTimerRef.current); aiWaitTimerRef.current = null; }
          }
        }
      });
      socketRef.current.on("agent:typing", (data: { conversationId: string; isAI?: boolean }) => {
        if (data.conversationId === conversationIdRef.current) {
          setAgentTyping(true);
          setAiTyping(Boolean(data.isAI));
          if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current);
          agentTypingTimerRef.current = setTimeout(() => { setAgentTyping(false); setAiTyping(false); }, 3000);
        }
      });
      socketRef.current.on("agent:typing:stop", (data: { conversationId: string }) => {
        if (data.conversationId === conversationIdRef.current) {
          setAgentTyping(false);
          setAiTyping(false);
          if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current);
        }
      });
    } catch (error) {
      console.error("Failed to connect Socket.IO:", error);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [bootloaderConfig?.orgToken]);

  // Join the visitor's conversation room once we have a conversationId
  useEffect(() => {
    if (!socketRef.current || !conversationId) return;
    try {
      socketRef.current.emit(
        "conversation:join",
        { conversationId },
        (res: { ok?: boolean; error?: string } | undefined) => {
          if (res?.ok !== true) {
            console.warn("[Widget] conversation:join failed:", res?.error || "unknown");
          }
        }
      );
    } catch (e) {
      console.warn("[Widget] conversation:join emit failed:", e);
    }
  }, [conversationId]);

  // Initialize conversation on widget open (no socket logic here — socket is always connected above)
  useEffect(() => {
    if (!actualIsOpen) return;
    const initConversation = async () => {
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        setConversationId(storedId);
      } else {
        try {
          setConnectionStatus("refreshing");
          const conv = await createConversation();
          setConversationId(conv.id);
          localStorage.setItem(STORAGE_KEY, conv.id);
          setConnectionStatus(null);
        } catch (error) {
          console.error("[Widget] create conversation failed", error);
          setConnectionStatus("error");
          setTimeout(() => setConnectionStatus(null), 3000);
        }
      }
    };
    initConversation();
  }, [actualIsOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || !conversationId || isLoading) return;

    const userMessage = sanitizePlainText(inputValue).trim();
    if (!userMessage) return;
    console.log("[Widget] handleSend", { conversationId, API_URL, hasToken: !!getOrgToken() });
    setInputValue("");
    setIsLoading(true);
    setShowAiHelpButton(false);
    gotResponseSinceLastMsgRef.current = false;
    lastUserMsgTimeRef.current = Date.now();

    // Clear previous wait timer
    if (aiWaitTimerRef.current) { clearTimeout(aiWaitTimerRef.current); aiWaitTimerRef.current = null; }

    try {
      setConnectionStatus("refreshing");
      const message = await sendMessage(conversationId, userMessage);
      setConnectionStatus(null);
      setMessages((prev) => [...prev, sanitizeMessage(message)]);

      // Start 30s auto-trigger timer: if no response arrives, show AI help button
      // (only if AI is enabled for this org)
      const aiEnabled = bootloaderConfig?.config?.aiEnabled;
      if (aiEnabled) {
        aiWaitTimerRef.current = setTimeout(() => {
          if (!gotResponseSinceLastMsgRef.current) {
            console.log("[Widget] No response after 30s, showing AI help button");
            setShowAiHelpButton(true);

            // Auto-trigger AI help after showing button for 5s
            setTimeout(async () => {
              if (!gotResponseSinceLastMsgRef.current && conversationIdRef.current) {
                console.log("[Widget] Auto-triggering AI help");
                try {
                  setAiAutoJoinedShown(true);
                  await requestAiHelp(conversationIdRef.current);
                  setShowAiHelpButton(false);
                } catch (err) {
                  console.warn("[Widget] Auto AI help failed:", err);
                }
              }
            }, 5000);
          }
        }, 30000);
      }
    } catch (error) {
      console.error("[Widget] send failed", error);
      setConnectionStatus("error");
      setTimeout(() => setConnectionStatus(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Manual AI help button click
  const handleAiHelp = async () => {
    if (!conversationId || aiHelpLoading) return;
    setAiHelpLoading(true);
    try {
      await requestAiHelp(conversationId);
      setShowAiHelpButton(false);
      setAiAutoJoinedShown(true);
      if (aiWaitTimerRef.current) { clearTimeout(aiWaitTimerRef.current); aiWaitTimerRef.current = null; }
    } catch (err) {
      console.warn("[Widget] AI help request failed:", err);
    } finally {
      setAiHelpLoading(false);
    }
  };

  // Emit typing events to server — debounce 500ms, auto-stop after 2s idle
  const emitTyping = () => {
    if (!socketRef.current || !conversationIdRef.current) return;
    socketRef.current.emit("typing:start", { conversationId: conversationIdRef.current });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", { conversationId: conversationIdRef.current });
    }, 2000);
  };

  // Don't render if bootloader failed or widget is disabled
  if (bootloaderError) {
    return null;
  }

  if (!bootloaderConfig) {
    return null; // Still loading
  }

  if (!bootloaderConfig.config.widgetEnabled) {
    return null; // Widget disabled by config
  }

  // v3 mobile visibility check — read here before full v3 extraction
  const _ws = bootloaderConfig.config.widgetSettings;
  const _v3 = (_ws || {}) as Record<string, unknown>;
  const _showOnMobile = _v3.showOnMobile !== false;
  if (!_showOnMobile && typeof window !== "undefined" && window.innerWidth <= 640) {
    return null; // Widget hidden on mobile by portal setting
  }

  const ws = bootloaderConfig.config.widgetSettings;
  const v3 = (ws || {}) as any;

  // ── Unified v3 color resolution ──
  // Portal stores: themeId, customColor, useCustomColor in configJson.
  // We must derive the effective primaryColor from these v3 fields first,
  // then fall back to the legacy column value from widgetSettings.primaryColor.
  const V3_THEME_COLORS_RESOLVE: Record<string, string> = {
    amber: "#F59E0B", ocean: "#0EA5E9", emerald: "#10B981", violet: "#8B5CF6",
    rose: "#F43F5E", slate: "#475569", teal: "#14B8A6", indigo: "#6366F1",
    sunset: "#F97316", aurora: "#06B6D4", midnight: "#1E293B", cherry: "#BE123C",
  };
  const v3ThemeId = v3.themeId || "amber";
  const v3UseCustom = v3.useCustomColor === true;
  const v3CustomColor = typeof v3.customColor === "string" ? v3.customColor : "#F59E0B";
  // Effective primary color: custom > theme lookup > legacy column > org default
  const primaryColor = v3UseCustom
    ? v3CustomColor
    : V3_THEME_COLORS_RESOLVE[v3ThemeId] || bootloaderConfig.config.widgetSettings?.primaryColor || bootloaderConfig.config.theme.primaryColor;

  const bubbleTheme = resolveWidgetBubbleTheme(
    {
      primaryColor,
      bubbleShape: bootloaderConfig.config.theme.bubbleShape,
      bubbleIcon: bootloaderConfig.config.theme.bubbleIcon,
      bubbleSize: bootloaderConfig.config.theme.bubbleSize,
      bubblePosition: bootloaderConfig.config.theme.bubblePosition,
      greetingText: bootloaderConfig.config.theme.greetingText,
      greetingEnabled: bootloaderConfig.config.theme.greetingEnabled,
    },
    {
      position: bootloaderConfig.config.widgetSettings?.position === "left" ? "left" : "right",
      launcher: bootloaderConfig.config.widgetSettings?.launcher === "icon" ? "icon" : "bubble",
      launcherLabel: bootloaderConfig.config.widgetSettings?.greetingText || "",
    }
  );
  const writeEnabled = bootloaderConfig.config.writeEnabled;
  const aiEnabled = bootloaderConfig.config.aiEnabled;
  // Detect actual content language from v3 text fields (headerText, welcomeMsg, subText).
  // The org table's `language` field may be stale (e.g. "en" while all content is Turkish).
  const orgLang = bootloaderConfig.config.language || "en";
  const v3ContentSample = `${v3.headerText || ""}${v3.welcomeMsg || ""}${v3.subText || ""}`;
  const TURKISH_CHARS = /[ğışöüçĞİŞÖÜÇ]/;
  const SPANISH_CHARS = /[áéíóúñ¿¡]/;
  const detectedLang = TURKISH_CHARS.test(v3ContentSample) ? "tr"
    : SPANISH_CHARS.test(v3ContentSample) ? "es"
    : orgLang;
  const lang = detectedLang;
  const unauthorizedCopy = UNAUTHORIZED_COPY[lang] || UNAUTHORIZED_COPY.en;
  const aiOfflineCopy = AI_OFFLINE_COPY[lang] || AI_OFFLINE_COPY.en;
  const widgetContext = (window as unknown as { HELVINO_WIDGET_CONTEXT?: string }).HELVINO_WIDGET_CONTEXT;
  const isLoginContext = widgetContext === "portal-login";
  const isLeft = isLoginContext ? false : bubbleTheme.bubblePosition === "bottom-left";
  const launcherRadius = bubbleBorderRadius(bubbleTheme.bubbleShape, bubbleTheme.bubbleSize);
  const THEME_COLORS_GRADIENT: Record<string, { color: string; dark: string }> = {
    amber: { color: "#F59E0B", dark: "#D97706" },
    ocean: { color: "#0EA5E9", dark: "#0284C7" },
    emerald: { color: "#10B981", dark: "#059669" },
    violet: { color: "#8B5CF6", dark: "#7C3AED" },
    rose: { color: "#F43F5E", dark: "#E11D48" },
    slate: { color: "#475569", dark: "#334155" },
    teal: { color: "#14B8A6", dark: "#0D9488" },
    indigo: { color: "#6366F1", dark: "#4F46E5" },
    sunset: { color: "#F97316", dark: "#C2410C" },
    aurora: { color: "#06B6D4", dark: "#0E7490" },
    midnight: { color: "#1E293B", dark: "#0F172A" },
    cherry: { color: "#BE123C", dark: "#9F1239" },
  };
  const themeColors = THEME_COLORS_GRADIENT[v3ThemeId] || THEME_COLORS_GRADIENT.amber;
  // ac (accent color) and ad (accent dark) MUST match primaryColor source
  const ac = v3UseCustom ? v3CustomColor : themeColors.color;
  const ad = v3UseCustom ? v3CustomColor : themeColors.dark;
  const ag = `linear-gradient(135deg, ${ac}, ${ad})`;
  const hexRgb = (hex: string) => {
    const h = hex.replace("#", "");
    return `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`;
  };
  const acRgb = hexRgb(ac);
  const headerText = v3.headerText || ws?.welcomeTitle || "Nasıl yardımcı olabiliriz?";
  const subText = v3.subText || "Genellikle birkaç dakika içinde yanıt veriyoruz";
  const welcomeMsg = v3.welcomeMsg || ws?.welcomeMessage || "Merhaba! 👋";
  const offlineMsg = v3.offlineMsg || "Şu an çevrimdışıyız. Mesajınızı bırakın.";
  const starters = v3.starters || [];
  const activeStarters = Array.isArray(starters) ? starters.filter((s: any) => s.active) : [];
  const botAvatar = v3.botAvatar || "🤖";
  const agentAvatar = v3.agentAvatar || "👩‍💼";
  const aiName = v3.aiName || "Helvion AI";
  const aiTone = v3.aiTone || "professional";
  const aiLabelEnabled = v3.aiLabel !== false;
  const aiSuggestions = v3.aiSuggestions !== false;
  const typingIndicatorEnabled = v3.typingIndicator !== false;
  const fileUploadEnabled = v3.fileUpload !== false;
  const showBrandingFlag = v3.showBranding !== false;
  const soundEnabled = v3.soundEnabled !== false;
  const autoOpenWidget = v3.autoOpen === true;
  const showEmojiPicker = v3.emojiPicker !== false;
  const customCss = typeof v3.customCss === "string" ? v3.customCss : "";
  const bgPatternId = v3.bgPatternId || "none";
  const attGrabberId = v3.attGrabberId || "none";
  const attGrabberText = v3.attGrabberText || "Merhaba! Yardıma ihtiyacınız var mı? 👋";
  const attGrabberDelay = typeof v3.attGrabberDelay === "number" ? v3.attGrabberDelay : 3;
  const launcherLabel = v3.launcherLabel || "Bize yazın";
  const launcherId = v3.launcherId || "rounded";
  const consentEnabled = v3.consentEnabled === true;
  const consentText = v3.consentText || "";
  // Suppress unused but planned variables
  void agentAvatar; void aiTone; void soundEnabled; void autoOpenWidget;
  void consentEnabled; void consentText; void attGrabberDelay;
  const positionId = v3.positionId || (isLeft ? "bl" : "br");
  const isLeftV3 = positionId === "bl";
  const LAUNCHER_SIZES: Record<string, { w: number; h: number; radius: string; hasText: boolean }> = {
    rounded: { w: 60, h: 60, radius: "50%", hasText: false },
    squircle: { w: 60, h: 60, radius: "16px", hasText: false },
    pill: { w: 140, h: 52, radius: "28px", hasText: true },
    bar: { w: 180, h: 48, radius: "14px", hasText: true },
  };
  const launcherDef = LAUNCHER_SIZES[launcherId] || LAUNCHER_SIZES.rounded;
  const WIDGET_SIZES: Record<string, { w: number; h: number }> = {
    compact: { w: 350, h: 480 },
    standard: { w: 380, h: 560 },
    large: { w: 420, h: 620 },
  };
  const widgetSizeId = v3.widgetSizeId || "standard";
  const widgetDim = WIDGET_SIZES[widgetSizeId] || WIDGET_SIZES.standard;
  const DEFAULT_PLACEHOLDERS: Record<string, string> = {
    tr: "Mesajınızı yazın...",
    en: "Type a message...",
    es: "Escribe un mensaje...",
    de: "Nachricht eingeben...",
    fr: "Tapez un message...",
  };
  // chatPageConfig.placeholder is often an English default that was never updated.
  // Only use it if it was explicitly customized (differs from known defaults).
  const rawChatPlaceholder = bootloaderConfig.config.chatPageConfig?.placeholder;
  const KNOWN_DEFAULT_PLACEHOLDERS = new Set(["Write your message...", "Type a message...", "Type your message..."]);
  const isCustomPlaceholder = rawChatPlaceholder && !KNOWN_DEFAULT_PLACEHOLDERS.has(rawChatPlaceholder);
  const chatInputPlaceholder = isCustomPlaceholder
    ? rawChatPlaceholder
    : (DEFAULT_PLACEHOLDERS[lang] || DEFAULT_PLACEHOLDERS.en);

  const renderBubbleIcon = () => {
    if (bubbleTheme.bubbleIcon === "help") {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9.4a2.3 2.3 0 0 1 4.4.9c0 1.9-2.2 2.1-2.2 3.5" />
          <circle cx="12" cy="17.1" r="1" fill="#FFF" stroke="none" />
        </svg>
      );
    }
    if (bubbleTheme.bubbleIcon === "message") {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v10H8l-4 4V5z" />
        </svg>
      );
    }
    if (bubbleTheme.bubbleIcon === "custom") {
      return <span style={{ color: "#FFF", fontWeight: 700, fontSize: 17 }}>★</span>;
    }
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  };

  // Unauthorized domain: still show the bubble so site owners can see the widget
  // is loading. Chat functionality is blocked server-side by the domain-allowlist
  // middleware, so there's no security risk in showing the launcher.
  const isUnauthorized = bootloaderConfig.config.unauthorizedDomain;

  // Background pattern SVG for home view
  const BG_PATTERNS: Record<string, string> = {
    dots: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='rgba(${acRgb},0.06)'/%3E%3C/svg%3E")`,
    grid: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0H0v20' fill='none' stroke='rgba(${acRgb},0.04)' stroke-width='0.5'/%3E%3C/svg%3E")`,
    waves: `url("data:image/svg+xml,%3Csvg width='40' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10c5-4 10-4 15 0s10 4 15 0s10-4 15 0' fill='none' stroke='rgba(${acRgb},0.05)' stroke-width='0.5'/%3E%3C/svg%3E")`,
  };
  return (
    <div
      className="widget-container"
      lang={lang}
      dir={typeof document !== "undefined" ? (document.documentElement.getAttribute("dir") || undefined) : undefined}
      style={{
        "--primary-color": primaryColor,
        "--ac": ac,
        "--ad": ad,
        "--ac-rgb": acRgb,
        pointerEvents: "auto",
      } as React.CSSProperties}
    >
      {/* Custom CSS from portal */}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
      {!actualIsOpen && attGrabberId !== "none" && attGrabberVisible && (
        <div className={`widget-att-grabber ${isLeftV3 ? "left" : "right"}`}
          style={{
            position: "fixed",
            bottom: launcherDef.h + 36,
            [isLeftV3 ? "left" : "right"]: 24,
            zIndex: 9997,
            animation: attGrabberId === "bounce" ? "attBounce 1s ease infinite" : attGrabberId === "pulse" ? "attPulse 1.5s ease infinite" : "attFadeUp 0.4s ease both",
          }}>
          {attGrabberId === "wave" && (
            <div style={{ fontSize: 32, animation: "attShake 1s ease infinite", cursor: "pointer" }}
              onClick={() => setIsOpen(true)}>👋</div>
          )}
          {attGrabberId === "message" && (
            <div onClick={() => setIsOpen(true)}
              style={{ background: "#FFF", borderRadius: 14, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", maxWidth: 220, cursor: "pointer", fontSize: 13, color: "#1A1D23", lineHeight: 1.4 }}>
              {attGrabberText}
            </div>
          )}
          {attGrabberId === "bounce" && (
            <div onClick={() => setIsOpen(true)}
              style={{ background: ag, width: 14, height: 14, borderRadius: "50%", cursor: "pointer", boxShadow: `0 0 12px rgba(${acRgb}, 0.4)` }} />
          )}
          {attGrabberId === "pulse" && (
            <div onClick={() => setIsOpen(true)}
              style={{ background: ag, width: 14, height: 14, borderRadius: "50%", cursor: "pointer", boxShadow: `0 0 12px rgba(${acRgb}, 0.4)` }} />
          )}
        </div>
      )}
      {!actualIsOpen && (
        !isFrame &&
        <div
          className={`widget-launcher-wrap ${isLeftV3 ? "left" : "right"}`}
          style={{ bottom: 24 }}
        >
          <button
            onClick={() => { console.log("[Widget] Launcher clicked"); setIsOpen(true); }}
            className="widget-launcher-button"
            style={{
              background: ag,
              width: launcherDef.w,
              height: launcherDef.h,
              borderRadius: launcherDef.radius || launcherRadius,
              boxShadow: `0 8px 28px rgba(${acRgb}, 0.3)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            aria-label="Open chat"
          >
            {launcherDef.hasText && (
              <span style={{ color: "#FFF", fontSize: 14, fontWeight: 700 }}>{launcherLabel}</span>
            )}
            {renderBubbleIcon()}
          </button>
        </div>
      )}

      {actualIsOpen && (
        <div className={isLoginContext ? "widget-auth-overlay" : undefined}>
          <div
            className={`chat-window ${isLoginContext ? "auth-mode" : isLeftV3 ? "position-left" : "position-right"}`}
            style={(() => {
              // CRITICAL: On mobile, inline width/height breaks keyboard-aware CSS.
              // Let CSS (fixed inset + --kb-height) control the sizing.
              const isMobile =
                typeof window !== "undefined" ? window.innerWidth <= 640 : false;
              return isMobile
                ? ({ zIndex: 2147483646 } as React.CSSProperties)
                : ({ width: widgetDim.w, height: widgetDim.h, zIndex: 2147483646 } as React.CSSProperties);
            })()}
          >
          <div className="chat-header-v3" style={{ background: ag, position: "relative", overflow: "hidden", padding: 18 }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.12), transparent 60%)" }} />
            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, border: "1px solid rgba(255,255,255,0.1)" }}>{botAvatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#FFF" }}>{headerText}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", boxShadow: "0 0 6px rgba(74,222,128,0.5)", display: "inline-block" }} />{subText}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          
          {/* Connection status banner — hidden during initial 5s grace period */}
          {connectionStatus && !connGracePeriod && (
            <div className={`connection-status ${connectionStatus}`}>
              {connectionStatus === "refreshing" && "🔄 Bağlanıyor..."}
              {connectionStatus === "error" && "⚠️ Bağlantı sorunu, yeniden deneniyor..."}
            </div>
          )}
          
          <div className="chat-messages">
            {bgPatternId !== "none" && BG_PATTERNS[bgPatternId] && (
              <div className="chat-bg-pattern" style={{ backgroundImage: BG_PATTERNS[bgPatternId] }} />
            )}
            {isUnauthorized && (
              <div style={{ margin: "8px 12px", padding: "10px 14px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #FCD34D", fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
                <strong style={{ display: "block", marginBottom: 4 }}>{unauthorizedCopy.title}</strong>
                {unauthorizedCopy.body}
              </div>
            )}
            {messages.length === 0 ? (
              <div className="widget-home-view">
                <div style={{ textAlign: "center", padding: "22px 18px 0" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: `${ac}1F`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, margin: "0 auto 10px" }}>💬</div>
                  <h4 style={{ fontWeight: 700, fontSize: 18, color: "#1A1D23", marginBottom: 4 }}>{headerText}</h4>
                  <p style={{ fontWeight: 500, fontSize: 13, color: "#94A3B8" }}>{welcomeMsg}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px 14px" }}>
                  {activeStarters.length > 0 && activeStarters.slice(0, 4).map((st: any) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => { setInputValue(st.text.replace(/^[^\s]+\s/, "")); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: "#ffffff", border: "1px solid rgba(0,0,0,0.05)", cursor: "pointer", textAlign: "left", transition: "all 0.15s", width: "100%" }}
                    >
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: `${ac}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                        {st.text.match(/^(\S+)/)?.[1] || "💬"}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 12.5, color: "#1A1D23" }}>
                        {st.text.replace(/^[^\s]+\s/, "")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const isAgent = !isUser; // treat unknown roles as agent to avoid mis-styling
                  return (
                    <div
                      key={msg.id}
                      className={`msg-row ${isAgent ? "agent" : "user"} message ${isUser ? "user" : "assistant"}`}
                    >
                      {/* Agent/bot: avatar on LEFT (portal parity) */}
                      {isAgent && (
                        <div className="msg-avatar agent-avatar" aria-hidden="true">
                          {botAvatar || "AI"}
                        </div>
                      )}
                      <div className="msg-stack">
                        {isAgent && aiLabelEnabled && (
                          <div className="ai-label-row">
                            <div className="ai-label-icon" aria-hidden="true">🤖</div>
                            <span className="ai-label-name">{aiName}</span>
                            <span className="ai-label-badge">AI Agent</span>
                          </div>
                        )}
                        <div className="msg-bubble message-content" dangerouslySetInnerHTML={{ __html: msg.content }} />
                        <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  );
                })}
                {aiSuggestions && messages.length > 0 && messages[messages.length - 1]?.role !== "user" && (
                  <div className="quick-replies">
                    {["💰 Planları gör", "📞 İletişim", "📦 Kargo bilgisi"].map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="quick-reply-pill"
                        onClick={() => setInputValue(s.replace(/^[^\s]+\s/, ""))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {aiAutoJoinedShown && (
              <div className="ai-system-message">
                <span>{aiOfflineCopy.joined}</span>
              </div>
            )}
            {showAiHelpButton && aiEnabled && (
              <div className="ai-help-prompt">
                <button className="ai-help-button" style={{ background: ag }} onClick={handleAiHelp} disabled={aiHelpLoading}>
                  {aiHelpLoading ? "..." : aiOfflineCopy.button}
                </button>
              </div>
            )}
            {typingIndicatorEnabled && agentTyping && (
              <div className="typing-indicator-row">
                <div className="typing-indicator-avatar" aria-hidden="true">
                  {botAvatar || "AI"}
                </div>
                <div className="typing-bubble">
                  <div className="typing-dots">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                  <span className="typing-label">{lang === "tr" ? "yazıyor..." : lang === "es" ? "escribiendo..." : "typing..."}</span>
                </div>
              </div>
            )}
          </div>
          
          {!writeEnabled ? (
            <div className="chat-disabled-notice">
              {offlineMsg}
            </div>
          ) : (
            <div className="chat-input-bar">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    console.warn("[Widget] File selected but upload not implemented yet:", e.target.files[0]?.name);
                  }
                  e.target.value = "";
                }}
              />
              {showEmojiPicker && emojiOpen && (
                <div className="chat-emoji-picker">
                  {recentEmojis.length > 0 && recentEmojis.map((e, i) => (
                    <button key={`r-${i}`} className="chat-emoji-picker-item" onClick={() => pickEmoji(e)} type="button">{e}</button>
                  ))}
                  {EMOJI_LIST.map((e, i) => (
                    <button key={i} className="chat-emoji-picker-item" onClick={() => pickEmoji(e)} type="button">{e}</button>
                  ))}
                </div>
              )}
              <div className="chat-input-bar-inner">
                {showEmojiPicker && (
                  <button className="chat-emoji-btn" onClick={() => setEmojiOpen((v) => !v)} aria-label="Emoji" type="button">
                    😀
                  </button>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={chatInputPlaceholder}
                  value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); emitTyping(); }}
                  onKeyPress={handleKeyPress}
                  onFocus={() => {
                    // Prevent iOS from scrolling the page when input gains focus
                    window.scrollTo(0, 0);
                    // Scroll messages to bottom after keyboard animation
                    setTimeout(() => {
                      window.scrollTo(0, 0);
                      const msgs = document.querySelector("#helvino-widget-root .chat-messages");
                      if (msgs) msgs.scrollTop = msgs.scrollHeight;
                    }, 150);
                    setTimeout(() => {
                      window.scrollTo(0, 0);
                      const msgs = document.querySelector("#helvino-widget-root .chat-messages");
                      if (msgs) msgs.scrollTop = msgs.scrollHeight;
                    }, 400);
                  }}
                  disabled={isLoading || !conversationId}
                  enterKeyHint="send"
                  autoComplete="off"
                />
                {fileUploadEnabled && (
                  <button
                    type="button"
                    className="chat-attach-btn"
                    aria-label="Attach file"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || !conversationId}
                  >
                    📎
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={isLoading || !conversationId || !inputValue.trim()}
                  className="chat-send-btn"
                >
                  {isLoading ? "..." : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
                </button>
              </div>
            </div>
          )}

          {(brandingRequired || showBrandingFlag) && (
            <div className="widget-powered-by-v3">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: `linear-gradient(135deg, ${ac}, ${ad})`, boxShadow: `0 1px 4px rgba(${acRgb}, 0.3)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontWeight: 900, fontSize: 7, color: "#FFF" }}>H</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#92400E" }}>
                  Powered by{" "}
                  <a href={HELVINO_SITE_URL} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800, color: "#92400E", textDecoration: "none" }}>
                    {APP_NAME}
                  </a>
                </span>
              </div>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
}

export default App;
export type { AppProps };
