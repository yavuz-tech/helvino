import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { createConversation, sendMessage, requestAiHelp, API_URL, getOrgKey, getOrgToken, Message, loadBootloader, BootloaderConfig, setOrgToken } from "./api";
import { EMOJI_LIST, bubbleBorderRadius, resolveWidgetBubbleTheme } from "@helvino/shared";
import { sanitizeHTML, sanitizePlainText } from "./sanitize";
import "./App.css";

const APP_NAME = "Helvion";
const HELVINO_SITE_URL = "https://helvion.io";

const STORAGE_KEY = "helvino_conversation_id";
const RECENT_EMOJI_KEY = "helvino_recent_emojis";
const MAX_RECENT = 16;

/** Language-aware branding strings */
const POWERED_BY: Record<string, { before: string; after: string }> = {
  en: { before: "Powered by ", after: "" },
  tr: { before: "", after: " tarafından desteklenmektedir" },
  es: { before: "Desarrollado por ", after: "" },
};

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

  // Use external control if provided, otherwise internal state
  const actualIsOpen = externalIsOpen !== undefined ? externalIsOpen : isOpen;
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

  // Load bootloader config on mount
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load bootloader";
        console.error("❌ Bootloader error:", errorMessage);
        setBootloaderError(errorMessage);
      }
    };

    initBootloader();
  }, []);

  // Initialize conversation and Socket.IO on widget open
  useEffect(() => {
    if (!actualIsOpen) return;

    // Get or create conversation
    const initConversation = async () => {
      const storedId = localStorage.getItem(STORAGE_KEY);
      
      if (storedId) {
        console.log("[Widget] using stored conversationId", storedId);
        setConversationId(storedId);
      } else {
        try {
          setConnectionStatus("refreshing");
          console.log("[Widget] creating new conversation...", { API_URL });
          const conv = await createConversation();
          console.log("[Widget] conversation created", conv.id);
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

    // Connect to Socket.IO with orgKey auth
    if (!socketRef.current) {
      try {
        const orgKey = getOrgKey();
        socketRef.current = io(API_URL, {
          transports: ["websocket", "polling"],
          auth: {
            orgKey,
            token: getOrgToken() || undefined,
          },
        });

        socketRef.current.on("connect", () => {
          console.log("✅ Connected to Socket.IO with orgKey:", orgKey);
        });
      } catch (error) {
        console.error("Failed to connect Socket.IO:", error);
        return;
      }

      socketRef.current.on("message:new", (data: { conversationId: string; message: Message }) => {
        if (data.conversationId === conversationIdRef.current) {
          setMessages((prev) => [...prev, sanitizeMessage(data.message)]);
          setAgentTyping(false);
          // Response received → cancel AI wait timer and hide button
          if (data.message.role === "assistant") {
            gotResponseSinceLastMsgRef.current = true;
            setShowAiHelpButton(false);
            if (aiWaitTimerRef.current) { clearTimeout(aiWaitTimerRef.current); aiWaitTimerRef.current = null; }
          }
        }
      });

      // Agent typing indicator (supports AI vs human distinction)
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

      socketRef.current.on("disconnect", () => {
        console.log("❌ Disconnected from Socket.IO");
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [actualIsOpen, conversationId]);

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

  const primaryColor =
    bootloaderConfig.config.widgetSettings?.primaryColor ||
    bootloaderConfig.config.theme.primaryColor;
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
  const lang = bootloaderConfig.config.language || "en";
  const poweredBy = POWERED_BY[lang] || POWERED_BY.en;
  const unauthorizedCopy = UNAUTHORIZED_COPY[lang] || UNAUTHORIZED_COPY.en;
  const aiOfflineCopy = AI_OFFLINE_COPY[lang] || AI_OFFLINE_COPY.en;
  const widgetContext = (window as unknown as { HELVINO_WIDGET_CONTEXT?: string }).HELVINO_WIDGET_CONTEXT;
  const isLoginContext = widgetContext === "portal-login";
  const isLeft = isLoginContext ? false : bubbleTheme.bubblePosition === "bottom-left";
  const shouldShowGreeting = !actualIsOpen && bubbleTheme.greetingEnabled && bubbleTheme.greetingText.trim().length > 0;
  const launcherRadius = bubbleBorderRadius(bubbleTheme.bubbleShape, bubbleTheme.bubbleSize);
  const widgetTitle =
    bootloaderConfig.config.widgetSettings?.brandName?.trim() ||
    bootloaderConfig.config.branding?.widgetName ||
    APP_NAME;
  const widgetSubtitle = bootloaderConfig.config.branding?.widgetSubtitle || "";
  const welcomeTitle = bootloaderConfig.config.widgetSettings?.welcomeTitle || widgetTitle;
  const welcomeMessage =
    bootloaderConfig.config.widgetSettings?.welcomeMessage || "How can we help you today?";
  const chatInputPlaceholder =
    bootloaderConfig.config.chatPageConfig?.placeholder || "Type a message...";

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

  /** Reusable branding block */
  const poweredByBlock = brandingRequired ? (
    <div className="widget-powered-by" role="contentinfo">
      {poweredBy.before}
      <a href={HELVINO_SITE_URL} target="_blank" rel="noopener noreferrer" className="widget-powered-by-brand">
        {APP_NAME}
      </a>
      {poweredBy.after}
    </div>
  ) : null;

  // Unauthorized domain: show safe disabled state
  if (bootloaderConfig.config.unauthorizedDomain) {
    return (
      <div
        className="widget-container widget-unauthorized"
        style={{ "--primary-color": primaryColor } as React.CSSProperties}
      >
        <div className="widget-unauthorized-card" role="status" aria-live="polite">
          <div className="widget-unauthorized-title">{unauthorizedCopy.title}</div>
          <div className="widget-unauthorized-body">{unauthorizedCopy.body}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-container" style={{ "--primary-color": primaryColor } as React.CSSProperties}>
      {!actualIsOpen && (
        <div
          className={`widget-launcher-wrap ${isLeft ? "left" : "right"}`}
          style={{ bottom: 24 }}
        >
          {shouldShowGreeting && (
            <div className={`widget-greeting-badge ${isLeft ? "left" : "right"}`}>
              {bubbleTheme.greetingText}
            </div>
          )}
          <button
            onClick={() => setIsOpen(true)}
            className="widget-launcher-button"
            style={{
              backgroundColor: primaryColor,
              width: bubbleTheme.bubbleSize,
              height: bubbleTheme.bubbleSize,
              borderRadius: launcherRadius,
              boxShadow: `0 8px 24px ${primaryColor}55, 0 4px 10px ${primaryColor}35`,
            }}
            aria-label="Open chat"
          >
            {renderBubbleIcon()}
          </button>
        </div>
      )}

      {actualIsOpen && (
        <div className={isLoginContext ? "widget-auth-overlay" : undefined}>
          <div className={`chat-window ${isLoginContext ? "auth-mode" : isLeft ? "position-left" : "position-right"}`}>
          <div className="chat-header">
            <div>
              <h3>{widgetTitle}</h3>
              {widgetSubtitle ? (
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                  {widgetSubtitle}
                </p>
              ) : null}
            </div>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>
          
          {/* Connection status banner */}
          {connectionStatus && (
            <div className={`connection-status ${connectionStatus}`}>
              {connectionStatus === "refreshing" && "🔄 Connecting..."}
              {connectionStatus === "error" && "⚠️ Connection issue, retrying..."}
            </div>
          )}
          
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="welcome-message">
                <p style={{ marginBottom: "6px", fontWeight: 700, color: "#1f2937" }}>
                  {welcomeTitle}
                </p>
                <p>{welcomeMessage}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${msg.role}${msg.role === "assistant" ? " ai-message" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="ai-badge">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                      <span>AI</span>
                    </div>
                  )}
                  <div className="message-content" dangerouslySetInnerHTML={{ __html: msg.content }} />
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
            {/* AI auto-joined system message */}
            {aiAutoJoinedShown && (
              <div className="ai-system-message">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                <span>{aiOfflineCopy.joined}</span>
              </div>
            )}

            {/* "Get AI Help" button when no response after 30s */}
            {showAiHelpButton && aiEnabled && (
              <div className="ai-help-prompt">
                <button className="ai-help-button" onClick={handleAiHelp} disabled={aiHelpLoading}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                  {aiHelpLoading ? "..." : aiOfflineCopy.button}
                  {!aiHelpLoading && <span className="ai-help-zap">⚡</span>}
                </button>
              </div>
            )}

            {agentTyping && (
              <div className={`typing-indicator${aiTyping ? " ai-typing" : ""}`}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-label">{aiTyping ? "AI Assistant is typing..." : "Agent is typing..."}</span>
              </div>
            )}
          </div>
          
          {!writeEnabled ? (
            <div className="chat-disabled-notice">
              💬 Chat is temporarily unavailable.
            </div>
          ) : (
            <div className="chat-input" style={{ position: "relative" }}>
              <button
                className="chat-emoji-btn"
                onClick={() => setEmojiOpen((v) => !v)}
                aria-label="Insert emoji"
                type="button"
              >
                😀
              </button>
              {emojiOpen && (
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
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !conversationId || !inputValue.trim()}
              >
                {isLoading ? "..." : "Send"}
              </button>
            </div>
          )}

          {/* Branding – server-enforced */}
          {poweredByBlock}
        </div>
        </div>
      )}
    </div>
  );
}

export default App;
export type { AppProps };
