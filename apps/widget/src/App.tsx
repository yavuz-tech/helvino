import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { createConversation, sendMessage, API_URL, getOrgKey, Message, loadBootloader, BootloaderConfig, setOrgToken } from "./api";
import "./App.css";

const APP_NAME = "Helvino";

const STORAGE_KEY = "helvino_conversation_id";

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
  const socketRef = useRef<Socket | null>(null);

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
            <div className="chat-input">
              <input
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
        </div>
      )}
    </div>
  );
}

export default App;
export type { AppProps };
