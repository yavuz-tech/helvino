import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { createConversation, sendMessage, API_URL, getOrgKey, Message, loadBootloader, BootloaderConfig, setOrgToken } from "./api";
import { EMOJI_LIST } from "@helvino/shared";
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) || "[]"); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  /** Whether branding must be shown (server-enforced, defaults true) */
  const brandingRequired = bootloaderConfig?.config?.brandingRequired !== false;

  /** Detect embed-config mismatch: config tries to hide branding but server says required */
  useEffect(() => {
    if (!bootloaderConfig) return;
    const embedWantsBrandOff = (window as any).HELVINO_BRAND_DISABLED === true;
    if (embedWantsBrandOff && brandingRequired) {
      console.warn("[Helvino] Branding mismatch: embed config requests branding off, but server entitlement requires branding. Enforcing branding.");
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
        setConversationId(storedId);
      } else {
        try {
          setConnectionStatus("refreshing");
          const conv = await createConversation();
          setConversationId(conv.id);
          localStorage.setItem(STORAGE_KEY, conv.id);
          setConnectionStatus(null);
        } catch (error) {
          console.error("Failed to create conversation:", error);
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
        // Only append if it's for our conversation
        if (data.conversationId === conversationId) {
          setMessages((prev) => [...prev, data.message]);
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

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      // Show refreshing status if token is being renewed
      setConnectionStatus("refreshing");
      
      // Send message to API (auto-refreshes token if needed)
      const message = await sendMessage(conversationId, userMessage);
      
      // Clear status on success
      setConnectionStatus(null);
      
      // Add user message to UI (Socket.IO will also emit it, but this is instant)
      setMessages((prev) => [...prev, message]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setConnectionStatus("error");
      
      // Auto-clear error status after 3 seconds
      setTimeout(() => setConnectionStatus(null), 3000);
      
      // Don't use alert, just log - the status banner will show the error
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

  const primaryColor = bootloaderConfig.config.theme.primaryColor;
  const writeEnabled = bootloaderConfig.config.writeEnabled;
  const lang = bootloaderConfig.config.language || "en";
  const poweredBy = POWERED_BY[lang] || POWERED_BY.en;
  const unauthorizedCopy = UNAUTHORIZED_COPY[lang] || UNAUTHORIZED_COPY.en;

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
        {poweredByBlock}
      </div>
    );
  }

  return (
    <div className="widget-container" style={{ "--primary-color": primaryColor } as React.CSSProperties}>
      <h1>{APP_NAME} Widget</h1>
      <p>Embeddable AI Chat Widget</p>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="widget-button"
        style={{ backgroundColor: primaryColor }}
      >
        {isOpen ? "Close" : "Open"} Chat
      </button>

      {/* Branding visible even when widget is closed */}
      {!actualIsOpen && poweredByBlock}

      {actualIsOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <h3>{APP_NAME} Assistant</h3>
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
                <p>👋 Hello! How can I help you today?</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${msg.role}`}
                >
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
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
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
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
      )}
    </div>
  );
}

export default App;
export type { AppProps };
