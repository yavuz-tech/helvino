import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { createConversation, sendMessage, requestAiHelp, API_URL, getOrgKey, getSiteId, getOrgToken, Message, loadBootloader, BootloaderConfig, setOrgToken } from "./api";
import { EMOJI_LIST, bubbleBorderRadius, resolveWidgetBubbleTheme } from "@helvino/shared";
import { sanitizeHTML, sanitizePlainText } from "./sanitize";
import { getVisitorId } from "./utils/visitor";
import "./App.css";

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
}

function sanitizeMessage(message: Message): Message {
  return {
    ...message,
    content: sanitizeHTML(message.content || ""),
  };
}

function App({ externalIsOpen, onOpenChange }: AppProps = {}) {
  const [bootloaderConfig, setBootloaderConfig] = useState<BootloaderConfig | null>(null);
  const [bootloaderError, setBootloaderError] = useState<string | null>(null);
  const [isOpen, setIsOpenInternal] = useState(false);
  const warnedDisabledRef = useRef(false);
  const warnedUnauthorizedRef = useRef(false);

  // Use external control if provided, otherwise internal state
  const actualIsOpen = externalIsOpen !== undefined ? externalIsOpen : isOpen;
  useEffect(() => { console.log("[Widget] isOpen changed:", isOpen, "actualIsOpen:", actualIsOpen); }, [isOpen, actualIsOpen]);
  const setIsOpen = (open: boolean) => {
    setIsOpenInternal(open);
    onOpenChange?.(open);
  };
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "refreshing" | "error" | null>(null);
  const [agentTyping, setAgentTyping] = useState(false);
  const [aiTyping, setAiTyping] = useState(false); // Distinguish AI vs human typing
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
  const socketRef = useRef<Socket | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  /** Whether branding must be shown (server-enforced, defaults true) */
  const brandingRequired = bootloaderConfig?.config?.brandingRequired !== false;

  // Keep ref in sync so socket listener always sees current conversationId
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

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
        transports: ["polling", "websocket"],
        auth,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        randomizationFactor: 0.3,
        timeout: 15000,
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
          agentTypingTimerRef.current = setTimeout(() => { setAgentTyping(false); setAiTyping(false); }, 8000);
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

  // Emit typing events to server
  const emitTyping = () => {
    if (!socketRef.current || !conversationIdRef.current) return;
    socketRef.current.emit("typing:start", { conversationId: conversationIdRef.current });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", { conversationId: conversationIdRef.current });
    }, 1500);
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
  const bgPatternStyle = bgPatternId !== "none" && BG_PATTERNS[bgPatternId] ? { backgroundImage: BG_PATTERNS[bgPatternId] } : {};

  return (
    <div
      className="widget-container"
      lang={lang}
      dir={typeof document !== "undefined" ? (document.documentElement.getAttribute("dir") || undefined) : undefined}
      style={{ "--primary-color": primaryColor, pointerEvents: "auto" } as React.CSSProperties}
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
          <div className={`chat-window ${isLoginContext ? "auth-mode" : isLeftV3 ? "position-left" : "position-right"}`} style={{ width: widgetDim.w, height: widgetDim.h, zIndex: 2147483646 }}>
          <div className="chat-header-v3" style={{ background: ag, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.12), transparent 60%)" }} />
            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "1px solid rgba(255,255,255,0.15)" }}>{botAvatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#FFF" }}>{headerText}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80" }} />{subText}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          
          {/* Connection status banner */}
          {connectionStatus && (
            <div className={`connection-status ${connectionStatus}`}>
              {connectionStatus === "refreshing" && "🔄 Bağlanıyor..."}
              {connectionStatus === "error" && "⚠️ Bağlantı sorunu, yeniden deneniyor..."}
            </div>
          )}
          
          <div className="chat-messages" style={bgPatternStyle}>
            {isUnauthorized && (
              <div style={{ margin: "8px 12px", padding: "10px 14px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #FCD34D", fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
                <strong style={{ display: "block", marginBottom: 4 }}>{unauthorizedCopy.title}</strong>
                {unauthorizedCopy.body}
              </div>
            )}
            {messages.length === 0 ? (
              <div className="widget-home-view">
                <div style={{ textAlign: "center", padding: "16px 12px 8px" }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "#1A1D23", marginBottom: 4 }}>{headerText}</p>
                  <p style={{ fontSize: 12.5, color: "#64748B" }}>{welcomeMsg}</p>
                </div>
                {activeStarters.length > 0 && (
                  <div style={{ padding: "8px 14px" }}>
                    {activeStarters.slice(0, 4).map((st: any) => (
                      <div
                        key={st.id}
                        onClick={() => { setInputValue(st.text.replace(/^[^\s]+\s/, "")); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 11, marginBottom: 7, background: "#FAFAF8", border: "1px solid #F1F5F9", cursor: "pointer", fontSize: 13.5, fontWeight: 500, color: "#1A1D23", transition: "all 0.2s" }}
                      >
                        {st.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${msg.role}${msg.role === "assistant" ? " ai-message" : ""}`}
                  >
                    {msg.role === "assistant" && aiLabelEnabled && (
                      <div className="ai-badge-v3" style={{ background: `rgba(${acRgb}, 0.08)`, color: ac }}>
                        <span style={{ fontSize: 10, fontWeight: 700 }}>{aiName}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: `rgba(${acRgb}, 0.12)`, color: ac }}>AI</span>
                      </div>
                    )}
                    <div className="message-content" dangerouslySetInnerHTML={{ __html: msg.content }} />
                    <div className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {aiSuggestions && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "4px 0" }}>
                    {["💰 Planları gör", "📞 İletişim"].map((s, i) => (
                      <div key={i} onClick={() => setInputValue(s.replace(/^[^\s]+\s/, ""))}
                        style={{ fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 9, background: `rgba(${acRgb}, 0.06)`, border: `1.5px solid rgba(${acRgb}, 0.12)`, color: ac, cursor: "pointer" }}>{s}</div>
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
            {agentTyping && (
              <div className={`typing-indicator${aiTyping ? " ai-typing" : ""}`}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-label">{aiTyping ? `${aiName} yazıyor...` : "Agent yazıyor..."}</span>
              </div>
            )}
          </div>
          
          {!writeEnabled ? (
            <div className="chat-disabled-notice">
              {offlineMsg}
            </div>
          ) : (
            <div className="chat-input-v3" style={{ borderTop: `1px solid rgba(${acRgb}, 0.08)` }}>
              {showEmojiPicker && (
                <button
                  className="chat-emoji-btn"
                  onClick={() => setEmojiOpen((v) => !v)}
                  aria-label="Insert emoji"
                  type="button"
                >
                  😊
                </button>
              )}
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
              <input
                ref={inputRef}
                type="text"
                placeholder={chatInputPlaceholder}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); emitTyping(); }}
                onKeyPress={handleKeyPress}
                disabled={isLoading || !conversationId}
                style={{ borderColor: `rgba(${acRgb}, 0.15)` }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !conversationId || !inputValue.trim()}
                style={{ background: ag, borderRadius: 10 }}
              >
                {isLoading ? "..." : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
              </button>
            </div>
          )}

          {(brandingRequired || showBrandingFlag) && (
            <div className="widget-powered-by-v3" style={{ borderTop: `1px solid rgba(${acRgb}, 0.06)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px 4px 8px", borderRadius: 20, background: `rgba(${acRgb}, 0.04)` }}>
                <div style={{ width: 16, height: 16, borderRadius: 5, background: ag, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white"/></svg>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#9CA3AF" }}>Powered by <a href={HELVINO_SITE_URL} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800, color: ac, textDecoration: "none" }}>{APP_NAME}</a></span>
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
