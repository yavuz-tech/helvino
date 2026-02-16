import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./frame.css";

type ViewMode = "home" | "chat";
type MsgRole = "agent" | "user";
type ChatMessage = {
  id: string;
  role: MsgRole;
  text: string;
  time: string;
};

function nowTime(): string {
  try {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "agent",
    text: "Merhaba! Size nasıl yardımcı olabilirim?",
    time: "14:30",
  },
  {
    id: "m2",
    role: "user",
    text: "Fiyatlandırma hakkında bilgi almak istiyorum",
    time: "14:31",
  },
];

function App() {
  const close = () => {
    try {
      window.parent.postMessage("helvion:close", "*");
    } catch {
      // cross-origin safety
    }
  };

  const [view, setView] = useState<ViewMode>("home");
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const starters = useMemo(
    () => [
      "💰 Fiyatlandırma hakkında bilgi",
      "🔧 Teknik destek istiyorum",
      "📦 Siparişimi takip etmek istiyorum",
    ],
    []
  );

  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (view !== "chat") return;
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, messages.length]);

  const pushUserMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setView("chat");
    setMessages((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        text: trimmed,
        time: nowTime(),
      },
    ]);
  };

  const onSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    pushUserMessage(trimmed);
    setInputValue("");
  };

  const onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    onSend();
  };

  return (
    <div className="hv-app">
      {/* HEADER */}
      <div className="hv-header">
        <div className="hv-header-avatar">🤖</div>
        <div className="hv-header-info">
          <div className="hv-header-title">Nasıl yardımcı olabiliriz?</div>
          <div className="hv-header-subtitle">
            <span className="hv-status-dot" />
            Genellikle birkaç dakika içinde yanıt veriyoruz
          </div>
        </div>
        <button className="hv-header-close" onClick={close} aria-label="Close chat">
          ✕
        </button>
      </div>

      {/* BODY */}
      {view === "home" ? (
        <div className="hv-home">
          <div className="hv-home-icon">💬</div>
          <h2 className="hv-home-title">Nasıl yardımcı olabiliriz?</h2>
          <p className="hv-home-subtitle">Merhaba! 👋 Size nasıl yardımcı olabilirim?</p>
          <div className="hv-starters">
            {starters.map((label) => (
              <button
                key={label}
                className="hv-starter"
                type="button"
                onClick={() => pushUserMessage(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="hv-messages" role="log" aria-label="Messages">
          {messages.map((m) => {
            if (m.role === "agent") {
              return (
                <div key={m.id} className="hv-msg hv-msg-agent">
                  <div className="hv-msg-avatar">🤖</div>
                  <div className="hv-msg-bubble">
                    <div className="hv-msg-sender">
                      Helvion AI <span className="hv-badge-ai">AI</span>
                    </div>
                    <div className="hv-msg-text">{m.text}</div>
                    <div className="hv-msg-time">{m.time}</div>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="hv-msg hv-msg-user">
                <div className="hv-msg-bubble">
                  <div className="hv-msg-text">{m.text}</div>
                  <div className="hv-msg-time">{m.time}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* FOOTER */}
      <div className="hv-footer">
        <div className="hv-input-bar">
          <button className="hv-input-emoji" type="button" aria-label="Emoji">
            😊
          </button>
          <input
            className="hv-input-field"
            placeholder="Mesajınızı yazın..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <button className="hv-input-send" type="button" onClick={onSend} aria-label="Send">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4z" />
            </svg>
          </button>
        </div>
        <div className="hv-powered">
          ⚡ Powered by{" "}
          <a href="https://helvion.io" target="_blank" rel="noreferrer">
            Helvion
          </a>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
