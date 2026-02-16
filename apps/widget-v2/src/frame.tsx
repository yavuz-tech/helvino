import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./frame.css";
import { createConversation, fetchBootloader, getMessages, sendMessage, type ApiMessage } from "./api";
import { getVisitorId } from "./visitor";

type ViewMode = "home" | "chat";
type MsgRole = "agent" | "user";
type ChatMessage = {
  id: string; // stable client id for React keys
  role: MsgRole;
  text: string;
  time: string;
  status?: "sending" | "failed";
  serverId?: string; // backend message id for dedupe
};

function nowTime(): string {
  try {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatTimeFromIso(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function darkenColor(hex: string, percent: number): string {
  // hex: #RRGGBB, percent: 0..100
  const p = Math.min(100, Math.max(0, percent)) / 100;
  if (!isHexColor(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.max(0, Math.min(255, Math.round(r * (1 - p))));
  const dg = Math.max(0, Math.min(255, Math.round(g * (1 - p))));
  const db = Math.max(0, Math.min(255, Math.round(b * (1 - p))));
  return (
    "#" +
    dr.toString(16).padStart(2, "0") +
    dg.toString(16).padStart(2, "0") +
    db.toString(16).padStart(2, "0")
  );
}

function getSiteIdFromRuntime(): string {
  try {
    const qs = new URLSearchParams(window.location.search);
    const fromQuery = (qs.get("siteId") || "").trim();
    if (fromQuery) return fromQuery;
  } catch {
    // ignore
  }

  const w = window as unknown as Record<string, unknown>;
  if (typeof w.HELVION_SITE_ID === "string" && w.HELVION_SITE_ID) return w.HELVION_SITE_ID;
  return "";
}

function App() {
  const close = () => {
    try {
      window.parent.postMessage("helvion:close", "*");
    } catch {
      // cross-origin safety
    }
  };

  const [view, setView] = useState<ViewMode>("home");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [bootOk, setBootOk] = useState(false);

  const [headerTitle, setHeaderTitle] = useState("Nasıl yardımcı olabiliriz?");
  const [headerSubtitle, setHeaderSubtitle] = useState("Genellikle birkaç dakika içinde yanıt veriyoruz");
  const [homeTitle, setHomeTitle] = useState("Nasıl yardımcı olabiliriz?");
  const [homeSubtitle, setHomeSubtitle] = useState("Merhaba! 👋 Size nasıl yardımcı olabilirim?");
  const [placeholder, setPlaceholder] = useState("Mesajınızı yazın...");
  const [starters, setStarters] = useState<string[]>([
    "💰 Fiyatlandırma hakkında bilgi",
    "🔧 Teknik destek istiyorum",
    "📦 Siparişimi takip etmek istiyorum",
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const visitorId = useMemo(() => getVisitorId(), []);
  const siteId = useMemo(() => getSiteIdFromRuntime(), []);

  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch {
      // non-fatal
    }
  };

  // Bootloader (best-effort)
  useEffect(() => {
    let cancelled = false;
    if (!siteId) {
      console.error("[Widget v2] Missing siteId (query param ?siteId= or window.HELVION_SITE_ID)");
      return;
    }

    fetchBootloader(siteId)
      .then((boot) => {
        if (cancelled) return;
        setBootOk(Boolean(boot?.ok));

        // Debug: dump config to confirm where localized strings live.
        try {
          console.log("[Widget v2] bootloader config:", JSON.stringify(boot?.config || null, null, 2));
        } catch {
          // ignore
        }

        const cfg = (boot?.config || {}) as Record<string, unknown>;
        const ws = (cfg.widgetSettings || {}) as Record<string, unknown>;
        const cpc = (cfg.chatPageConfig || {}) as Record<string, unknown>;
        const language = typeof cfg.language === "string" ? cfg.language.trim().toLowerCase() : "";

        const normalize = (value: unknown): string => {
          const s = typeof value === "string" ? value.trim() : "";
          if (!s) return "";

          // If org language is TR but chatPageConfig still contains default EN strings,
          // treat them as "unset" so widgetSettings (or hardcoded TR) can take over.
          if (language === "tr") {
            const enDefaults = new Set([
              "Chat with us",
              "We typically reply within minutes",
              "Write your message...",
            ]);
            if (enDefaults.has(s)) return "";
          }
          return s;
        };

        // Theme: apply primary color from bootloader as CSS variables.
        // Keep hardcoded fallbacks in CSS for when bootloader fails.
        const primaryColor = typeof ws.primaryColor === "string" ? ws.primaryColor.trim() : "";
        if (primaryColor && isHexColor(primaryColor)) {
          const root = document.documentElement;
          root.style.setProperty("--hv-primary", primaryColor);
          root.style.setProperty("--hv-primary-dark", darkenColor(primaryColor, 15));
        }

        // Fallback order requested:
        // chatPageConfig > widgetSettings > hardcoded
        const title =
          normalize(cpc.title) ||
          normalize(ws.headerTitle) ||
          normalize(ws.welcomeTitle) ||
          "Nasıl yardımcı olabiliriz?";
        const subtitle =
          normalize(cpc.subtitle) ||
          normalize(ws.headerSubtitle) ||
          "Genellikle birkaç dakika içinde yanıt veriyoruz";
        const welcome =
          normalize(ws.welcomeMessage) ||
          "Merhaba! 👋 Size nasıl yardımcı olabilirim?";
        const ph =
          normalize(cpc.placeholder) ||
          normalize(ws.placeholder) ||
          "Mesajınızı yazın...";

        setHeaderTitle(title);
        setHomeTitle(title);
        setHeaderSubtitle(subtitle);
        setHomeSubtitle(welcome);
        setPlaceholder(ph);

        // Starters: accept array of strings or array of {text, active}
        const startersRaw = ws.starters;
        if (Array.isArray(startersRaw)) {
          const parsed = startersRaw
            .map((x) => {
              if (typeof x === "string") return x;
              if (x && typeof x === "object" && typeof (x as any).text === "string") return String((x as any).text);
              return "";
            })
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 6);
          if (parsed.length > 0) setStarters(parsed);
        }
      })
      .catch((err) => {
        console.error("[Widget v2] Bootloader failed:", err);
        if (!cancelled) setBootOk(false);
      });

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  // Auto-scroll on new messages in chat
  useEffect(() => {
    if (view !== "chat") return;
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, messages.length]);

  const pushUserMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setView("chat");
    const clientId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setMessages((prev) => [
      ...prev,
      { id: clientId, role: "user", text: trimmed, time: nowTime(), status: "sending" },
    ]);

    try {
      if (!siteId) throw new Error("missing_site_id");
      if (!bootOk) {
        // UI works with defaults; sending likely fails if orgToken missing.
        console.warn("[Widget v2] bootOk=false; send may fail until bootloader succeeds");
      }

      let cid = conversationId;
      if (!cid) {
        const conv = await createConversation(siteId, visitorId);
        cid = conv.id;
        setConversationId(cid);
      }

      const sent = await sendMessage(cid, trimmed);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientId
            ? {
                ...m,
                status: undefined,
                serverId: sent.id,
                time: formatTimeFromIso(sent.timestamp) || m.time,
              }
            : m
        )
      );
    } catch (err) {
      console.error("[Widget v2] send failed:", err);
      setMessages((prev) => prev.map((m) => (m.id === clientId ? { ...m, status: "failed" } : m)));
    }
  };

  const onSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    void pushUserMessage(trimmed);
    setInputValue("");
  };

  const onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    onSend();
  };

  // Polling for new messages (every 3s)
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    let timer: number | null = null;

    const mergeServerMessages = (incoming: ApiMessage[]) => {
      if (!incoming || incoming.length === 0) return;

      setMessages((prev) => {
        const seen = new Set<string>();
        for (const m of prev) {
          if (m.serverId) seen.add(m.serverId);
        }

        const next = [...prev];
        for (const sm of incoming) {
          if (!sm?.id) continue;
          if (seen.has(sm.id)) continue;

          const role: MsgRole = sm.role === "assistant" ? "agent" : "user";
          next.push({
            id: `s_${sm.id}`,
            serverId: sm.id,
            role,
            text: sm.content,
            time: formatTimeFromIso(sm.timestamp),
          });
          seen.add(sm.id);
        }

        return next;
      });
    };

    const tick = async () => {
      try {
        const list = await getMessages(conversationId);
        if (cancelled) return;
        mergeServerMessages(list);
      } catch (err) {
        console.error("[Widget v2] polling getMessages failed:", err);
      } finally {
        if (!cancelled) timer = window.setTimeout(tick, 3000);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [conversationId]);

  return (
    <div className="hv-app">
      {/* HEADER */}
      <div className="hv-header">
        <div className="hv-header-avatar">🤖</div>
        <div className="hv-header-info">
          <div className="hv-header-title">{headerTitle}</div>
          <div className="hv-header-subtitle">
            <span className="hv-status-dot" />
            {headerSubtitle}
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
          <h2 className="hv-home-title">{homeTitle}</h2>
          <p className="hv-home-subtitle">{homeSubtitle}</p>
          <div className="hv-starters">
            {starters.map((label) => (
              <button key={label} className="hv-starter" type="button" onClick={() => void pushUserMessage(label)}>
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
                  {m.status === "failed" ? <div className="hv-msg-failed">⚠︎ gonderilemedi</div> : null}
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
            placeholder={placeholder}
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
          <span className="hv-powered-text">Powered by</span>
          <a
            href="https://helvion.io"
            target="_blank"
            rel="noreferrer"
            className="hv-powered-brand"
          >
            <svg className="hv-powered-logo" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M7 5v14M17 5v14M7 12h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Helvion</span>
          </a>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
