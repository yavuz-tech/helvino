import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./frame.css";
import { io, type Socket } from "socket.io-client";
import { createConversation, fetchBootloader, getApiBase, getCachedAuth, getMessages, sendMessage, type ApiMessage } from "./api";
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

type UiCopy = {
  title: string;
  subtitle: string;
  welcome: string;
  placeholder: string;
  starters: string[];
  botAvatar: string;
};

function PoweredByHelvion() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animRef = React.useRef<number>(0);
  const starsRef = React.useRef<any[]>([]);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (starsRef.current.length === 0) {
      for (let i = 0; i < 20; i++) {
        starsRef.current.push({
          x: Math.random() * 340,
          y: Math.random() * 40,
          r: Math.random() * 1.5 + 0.5,
          phase: Math.random() * Math.PI * 2,
          hue: Math.random() > 0.4 ? "245,158,11" : "217,119,6",
        });
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 340,
      H = 40;
    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.scale(2, 2);
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.01;
      const stars = starsRef.current;
      const intensity = hovered ? 1 : 0.4;

      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 65) {
            const alpha = (1 - dist / 65) * 0.18 * intensity;
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.strokeStyle = "rgba(217,119,6," + alpha + ")";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      stars.forEach((s: any) => {
        const twinkle = (Math.sin(t * 3 + s.phase) + 1) / 2;
        const alpha = (0.3 + twinkle * 0.7) * intensity;
        const radius = s.r * (hovered ? 1 + twinkle * 0.5 : 1);

        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + s.hue + "," + alpha + ")";
        ctx.fill();

        if (hovered && twinkle > 0.8) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(" + s.hue + "," + alpha * 0.15 + ")";
          ctx.fill();
        }
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [hovered]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.open("https://helvion.io", "_blank")}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "11px 0",
        cursor: "pointer",
        position: "relative",
        background: "linear-gradient(180deg, #FAFAFA, #F5F5F7)",
        borderTop: "1px solid #EBEBED",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "340px",
          height: "40px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            transition: "transform 0.5s ease",
            transform: hovered ? "rotate(72deg)" : "rotate(0deg)",
            filter: hovered ? "drop-shadow(0 0 4px rgba(245,158,11,0.4))" : "none",
          }}
        >
          <path
            d="M8 0L9.8 5.2L15.6 5.2L10.9 8.8L12.7 14L8 10.4L3.3 14L5.1 8.8L0.4 5.2L6.2 5.2Z"
            fill={hovered ? "#F59E0B" : "#D97706"}
            style={{ transition: "fill 0.3s" }}
          />
        </svg>
        <span
          style={{
            fontSize: "15.5px",
            fontWeight: 800,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-0.01em",
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            transition: "all 0.4s ease",
            filter: hovered ? "brightness(1.15)" : "brightness(1)",
          }}
        >
          Helvion
        </span>
        <span
          style={{
            fontSize: "12.5px",
            color: hovered ? "#78716C" : "#A1A1AA",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 600,
            letterSpacing: "0.005em",
            transition: "color 0.3s",
          }}
        >
          tarafından desteklenmektedir
        </span>
      </div>
    </div>
  );
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
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  // Avoid theme/text flash: render a loading state until bootloader resolves.
  const [ui, setUi] = useState<UiCopy | null>(null);
  const spinnerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingStartedRef = useRef(false);

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
      setUi({
        title: "Nasıl yardımcı olabiliriz?",
        subtitle: "Genellikle birkaç dakika içinde yanıt veriyoruz",
        welcome: "Merhaba! 👋 Size nasıl yardımcı olabilirim?",
        placeholder: "Mesajınızı yazın...",
        starters: [
          "💰 Fiyatlandırma hakkında bilgi",
          "🔧 Teknik destek istiyorum",
          "📦 Siparişimi takip etmek istiyorum",
        ],
        botAvatar: "🤖",
      });
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

        const enDefaults = new Set([
          "Chat with us",
          "We reply as soon as possible",
          "Write your message...",
          "We typically reply within minutes",
        ]);
        const normalize = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
        const normalizeCpc = (value: unknown): string => {
          const s = normalize(value);
          if (!s) return "";
          return enDefaults.has(s) ? "" : s;
        };

        // Theme: apply primary color from bootloader as CSS variables.
        // Keep hardcoded fallbacks in CSS for when bootloader fails.
        const themeId = typeof ws.themeId === "string" ? ws.themeId.trim().toLowerCase() : "";
        const useCustomColor = ws.useCustomColor === true;
        const customColor = typeof ws.customColor === "string" ? ws.customColor.trim() : "";
        const wsPrimaryColor = typeof ws.primaryColor === "string" ? ws.primaryColor.trim() : "";
        const themeMap: Record<string, string> = {
          rose: "#F43F5E",
          violet: "#8B5CF6",
          ocean: "#0EA5E9",
          amber: "#F59E0B",
          emerald: "#10B981",
        };

        let primaryColor = "";
        if (useCustomColor && customColor && isHexColor(customColor)) primaryColor = customColor;
        else if (wsPrimaryColor && isHexColor(wsPrimaryColor)) primaryColor = wsPrimaryColor;
        else if (themeId && themeMap[themeId] && isHexColor(themeMap[themeId]!)) primaryColor = themeMap[themeId]!;

        if (primaryColor) {
          const root = document.documentElement;
          root.style.setProperty("--hv-primary", primaryColor);
          root.style.setProperty("--hv-primary-dark", darkenColor(primaryColor, 15));
        }

        // New fallback order requested: widgetSettings first.
        const title =
          normalize(ws.headerText) ||
          normalize(ws.headerTitle) ||
          normalizeCpc(cpc.title) ||
          "Nasıl yardımcı olabiliriz?";
        const subtitle =
          normalize(ws.subText) ||
          normalize(ws.headerSubtitle) ||
          normalizeCpc(cpc.subtitle) ||
          "Genellikle birkaç dakika içinde yanıt veriyoruz";
        const placeholder =
          normalize(ws.placeholder) ||
          normalize(ws.inputPlaceholder) ||
          normalizeCpc(cpc.placeholder) ||
          "Mesajınızı yazın...";
        const welcome =
          normalize(ws.welcomeMsg) ||
          normalize(ws.aiWelcome) ||
          normalize(ws.welcomeMessage) ||
          "Merhaba! 👋 Size nasıl yardımcı olabilirim?";
        const botAvatar = normalize(ws.botAvatar) || "🤖";

        let starters: string[] = [];
        const startersRaw = ws.starters;
        if (Array.isArray(startersRaw)) {
          starters = startersRaw
            .filter((x) => {
              if (typeof x === "string") return true;
              if (!x || typeof x !== "object") return false;
              // Only active starters, if provided.
              if (typeof (x as any).active === "boolean") return (x as any).active === true;
              return true;
            })
            .map((x) => {
              if (typeof x === "string") return x;
              if (x && typeof x === "object" && typeof (x as any).text === "string") return String((x as any).text);
              return "";
            })
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 6);
        }

        if (starters.length === 0) {
          starters = [
            "💰 Fiyatlandırma hakkında bilgi",
            "🔧 Teknik destek istiyorum",
            "📦 Siparişimi takip etmek istiyorum",
          ];
        }

        // Set all UI copy at once to avoid partial render/flash.
        setUi({ title, subtitle, welcome, placeholder, starters, botAvatar });
      })
      .catch((err) => {
        console.error("[Widget v2] Bootloader failed:", err);
        if (!cancelled) setBootOk(false);
        if (!cancelled) {
          setUi({
            title: "Nasıl yardımcı olabiliriz?",
            subtitle: "Genellikle birkaç dakika içinde yanıt veriyoruz",
            welcome: "Merhaba! 👋 Size nasıl yardımcı olabilirim?",
            placeholder: "Mesajınızı yazın...",
            starters: [
              "💰 Fiyatlandırma hakkında bilgi",
              "🔧 Teknik destek istiyorum",
              "📦 Siparişimi takip etmek istiyorum",
            ],
            botAvatar: "🤖",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  // Spinner animation (no CSS changes)
  useEffect(() => {
    if (ui) return;
    const el = spinnerRef.current;
    if (!el || typeof el.animate !== "function") return;
    const anim = el.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
      duration: 900,
      iterations: Infinity,
      easing: "linear",
    });
    return () => {
      try {
        anim.cancel();
      } catch {
        // ignore
      }
    };
  }, [ui]);

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
        console.warn("[Widget v2] bootOk=false; send may fail until bootloader succeeds");
      }

      let cid = conversationId;
      const isFirstMessage = !cid;
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

      // First message fix: Socket hasn't connected yet when the first message
      // is sent (it connects after conversationId state update). The AI response
      // is emitted via socket before the widget joins the room, so it's lost.
      // Poll once after a delay to catch the AI response.
      if (isFirstMessage) {
        const pollCid = cid;
        const doRecoveryFetch = async (delayMs: number) => {
          await new Promise((r) => setTimeout(r, delayMs));
          try {
            const msgs = await getMessages(pollCid);
            if (msgs.length > 0) {
              setMessages((prev) => {
                const seenIds = new Set(prev.map((m) => m.serverId).filter(Boolean));
                const newMsgs: ChatMessage[] = [];
                for (const m of msgs) {
                  if (seenIds.has(m.id)) continue;
                  if (m.role === "user") continue;
                  newMsgs.push({
                    id: `s_${m.id}`,
                    serverId: m.id,
                    role: "agent",
                    text: m.content,
                    time: formatTimeFromIso(m.timestamp),
                  });
                }
                if (newMsgs.length === 0) return prev;
                return [...prev, ...newMsgs];
              });
            }
          } catch {
            // ignore fetch errors
          }
        };
        // Try twice: once at 3s (AI might have responded), once at 6s (slower models)
        doRecoveryFetch(3000);
        doRecoveryFetch(6000);
      }
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
    // Stop typing immediately after sending
    try {
      const cid = conversationId;
      if (cid && socketRef.current) {
        socketRef.current.emit("typing:stop", { conversationId: cid });
      }
    } catch {
      // ignore
    }
  };

  const onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    onSend();
  };

  // Socket.IO realtime (polling removed)
  useEffect(() => {
    if (!conversationId) return;

    const { orgToken } = getCachedAuth();
    if (!orgToken) {
      console.warn("[Widget v2] Socket skipped: orgToken not ready");
      return;
    }

    // Reuse existing socket if any
    if (socketRef.current) {
      try {
        socketRef.current.emit("conversation:join", { conversationId });
      } catch {
        // ignore
      }
      return;
    }

    const apiBase = getApiBase().replace(/\/+$/, "");
    const socket = io(apiBase, {
      auth: {
        // Server expects `token`; also send `orgToken` for forward-compat with this widget spec.
        token: orgToken,
        orgToken,
        siteId,
        visitorId,
      },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to Socket.IO", { id: socket.id });
      try {
        socket.emit("conversation:join", { conversationId });
      } catch {
        // ignore
      }
    });
    socket.on("disconnect", () => {
      console.log("❌ Disconnected from Socket.IO");
    });
    socket.on("connect_error", (err: any) => {
      console.warn("❌ Socket.IO connect_error", err?.message || err);
    });

    socket.on("message:new", (data: { conversationId: string; message: ApiMessage }) => {
      try {
        if (!data || data.conversationId !== conversationId) return;
        const msg = data.message;
        // Only append agent/AI messages (our user messages are already optimistic).
        if (!msg || msg.role === "user") return;

        setMessages((prev) => {
          const seen = new Set<string>();
          for (const m of prev) {
            if (m.serverId) seen.add(m.serverId);
          }
          if (seen.has(msg.id)) return prev;
          return [
            ...prev,
            {
              id: `s_${msg.id}`,
              serverId: msg.id,
              role: "agent",
              text: msg.content,
              time: formatTimeFromIso(msg.timestamp),
            },
          ];
        });
        setIsAgentTyping(false);
      } catch {
        // ignore
      }
    });

    socket.on("agent:typing", (data: { conversationId: string }) => {
      if (data?.conversationId !== conversationId) return;
      setIsAgentTyping(true);
    });
    socket.on("agent:typing:stop", (data: { conversationId: string }) => {
      if (data?.conversationId !== conversationId) return;
      setIsAgentTyping(false);
    });

    return () => {
      try {
        socket.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, [conversationId, siteId, visitorId]);

  const emitTypingStartDebounced = () => {
    const cid = conversationId;
    const s = socketRef.current;
    if (!cid || !s) return;

    try {
      if (!typingStartedRef.current) {
        typingStartedRef.current = true;
        s.emit("typing:start", { conversationId: cid });
      }
    } catch {
      // ignore
    }

    if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => {
      try {
        typingStartedRef.current = false;
        s.emit("typing:stop", { conversationId: cid });
      } catch {
        // ignore
      }
    }, 3000);
  };

  return (
    <div className="hv-app">
      {!ui ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            ref={spinnerRef}
            aria-label="Loading"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              border: "3px solid rgba(0,0,0,0.12)",
              borderTopColor: "rgba(0,0,0,0.45)",
            }}
          />
          <div style={{ fontSize: "13px", color: "#6b7280" }}>Loading...</div>
        </div>
      ) : (
        <>
          {/* HEADER */}
          <div className="hv-header">
            <div className="hv-header-avatar">{ui.botAvatar}</div>
            <div className="hv-header-info">
              <div className="hv-header-title">{ui.title}</div>
              <div className="hv-header-subtitle">
                <span className="hv-status-dot" />
                {ui.subtitle}
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
              <h2 className="hv-home-title">{ui.title}</h2>
              <p className="hv-home-subtitle">{ui.welcome}</p>
              <div className="hv-starters">
                {ui.starters.map((label) => (
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
                      <div className="hv-msg-avatar">{ui.botAvatar}</div>
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

              {isAgentTyping ? (
                <div className="hv-typing" aria-label="Agent typing">
                  <div className="hv-typing-dot" />
                  <div className="hv-typing-dot" />
                  <div className="hv-typing-dot" />
                </div>
              ) : null}

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
                placeholder={ui.placeholder}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  emitTypingStartDebounced();
                }}
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
          </div>
        </>
      )}
      <PoweredByHelvion />
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
