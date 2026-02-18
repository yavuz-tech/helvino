import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./frame.css";
import { io, type Socket } from "socket.io-client";
import { createConversation, fetchBootloader, getApiBase, getCachedAuth, getMessages, sendMessage, type ApiMessage } from "./api";
import { getVisitorId } from "./visitor";
import { resolveWidgetLang, tWidget, type WidgetLang } from "./i18n";

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
  primaryColor: string;
  primaryColorDark: string;
};

// Full theme map matching the API's THEME_COLORS (12 themes)
const THEME_MAP: Record<string, string> = {
  amber: "#F59E0B",
  ocean: "#0EA5E9",
  emerald: "#10B981",
  violet: "#8B5CF6",
  rose: "#F43F5E",
  slate: "#475569",
  teal: "#14B8A6",
  indigo: "#6366F1",
  sunset: "#F97316",
  aurora: "#06B6D4",
  midnight: "#1E293B",
  cherry: "#BE123C",
};

const EN_DEFAULTS = new Set([
  "Chat with us",
  "We reply as soon as possible",
  "Write your message...",
  "We typically reply within minutes",
]);

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normForDefaultCompare(s: string): string {
  // Normalize small variations: case, whitespace, unicode ellipsis.
  return s
    .trim()
    .toLowerCase()
    .replace(/\u2026/g, "...") // unicode ellipsis
    .replace(/\s+/g, " ");
}

function normalizeCpc(value: unknown): string {
  const s = normalize(value);
  if (!s) return "";
  // Ignore default English boilerplate coming from chatPageConfig.
  // Compare loosely to avoid missing due to casing/ellipsis variations.
  for (const d of EN_DEFAULTS) {
    if (normForDefaultCompare(s) === normForDefaultCompare(d)) return "";
  }
  return s;
}

/**
 * Parse widgetSettings (from bootloader or live config-update) into UiCopy.
 * Also applies CSS variables for primaryColor.
 */
function parseWidgetSettings(
  ws: Record<string, unknown>,
  cpc: Record<string, unknown>,
  lang: WidgetLang
): UiCopy {
  // Theme: apply primary color as CSS variables
  const themeId = typeof ws.themeId === "string" ? ws.themeId.trim().toLowerCase() : "";
  const useCustomColor = ws.useCustomColor === true;
  const customColor = typeof ws.customColor === "string" ? ws.customColor.trim() : "";
  const wsPrimaryColor = typeof ws.primaryColor === "string" ? ws.primaryColor.trim() : "";

  let primaryColor = "";
  if (useCustomColor && customColor && isHexColor(customColor)) primaryColor = customColor;
  else if (wsPrimaryColor && isHexColor(wsPrimaryColor)) primaryColor = wsPrimaryColor;
  else if (themeId && THEME_MAP[themeId] && isHexColor(THEME_MAP[themeId]!)) primaryColor = THEME_MAP[themeId]!;

  if (primaryColor) {
    const root = document.documentElement;
    root.style.setProperty("--hv-primary", primaryColor);
    root.style.setProperty("--hv-primary-dark", darkenColor(primaryColor, 15));
    if (isHexColor(primaryColor)) {
      const r = parseInt(primaryColor.slice(1, 3), 16);
      const g = parseInt(primaryColor.slice(3, 5), 16);
      const b = parseInt(primaryColor.slice(5, 7), 16);
      root.style.setProperty("--hv-primary-rgb", `${r},${g},${b}`);
    }
  }

  const title =
    normalize(ws.headerText) ||
    normalize(ws.headerTitle) ||
    normalizeCpc(cpc.title) ||
    tWidget(lang, "defaultTitle");
  const subtitle =
    normalize(ws.subText) ||
    normalize(ws.headerSubtitle) ||
    normalizeCpc(cpc.subtitle) ||
    tWidget(lang, "defaultSubtitle");
  const placeholder =
    normalize(ws.placeholder) ||
    normalize(ws.inputPlaceholder) ||
    normalizeCpc(cpc.placeholder) ||
    tWidget(lang, "defaultPlaceholder");
  const welcome =
    normalize(ws.welcomeMsg) ||
    normalize(ws.aiWelcome) ||
    normalize(ws.welcomeMessage) ||
    tWidget(lang, "defaultWelcome");
  const botAvatar = normalize(ws.botAvatar) || "🤖";

  let starters: string[] = [];
  const startersRaw = ws.starters;
  if (Array.isArray(startersRaw)) {
    starters = startersRaw
      .filter((x) => {
        if (typeof x === "string") return true;
        if (!x || typeof x !== "object") return false;
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
      tWidget(lang, "starterPricing"),
      tWidget(lang, "starterSupport"),
      tWidget(lang, "starterOrder"),
    ];
  }

  const resolvedColor = primaryColor || "#8B5CF6";
  const resolvedDark = primaryColor ? darkenColor(primaryColor, 15) : "#7C3AED";

  return { title, subtitle, welcome, placeholder, starters, botAvatar, primaryColor: resolvedColor, primaryColorDark: resolvedDark };
}

const TURKISH_CHARS_RE = /[çğıöşüİ]/i;

function inferLangFromContent(
  initial: WidgetLang,
  ws: Record<string, unknown>,
  cpc: Record<string, unknown>
): WidgetLang {
  // Legacy fallback: only used when language is NOT explicitly set.
  if (initial !== "en") return initial;
  const sample = [
    normalize(ws.headerText),
    normalize(ws.subText),
    normalize(ws.welcomeMsg),
    normalize(ws.welcomeMessage),
    normalize(ws.launcherLabel),
    normalizeCpc(cpc.title),
    normalizeCpc(cpc.subtitle),
  ]
    .filter(Boolean)
    .join(" ");
  return TURKISH_CHARS_RE.test(sample) ? "tr" : initial;
}

function resolveWidgetLangExplicit(raw: unknown): { lang: WidgetLang; explicit: boolean } {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const explicit = v === "tr" || v === "en" || v === "es";
  return { lang: resolveWidgetLang(raw), explicit };
}

function PoweredByHelvion({ lang }: { lang: WidgetLang }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animRef = React.useRef<number>(0);
  const starsRef = React.useRef<any[]>([]);
  const [hovered, setHovered] = React.useState(false);
  const suffixMode = lang === "tr";

  const HelvionFullLogo = ({ height = 18 }: { height?: number }) => (
    <svg
      width={(280 / 48) * height}
      height={height}
      viewBox="0 0 280 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path d="M3.6 19.2C3.6 12.572 8.972 7.2 15.6 7.2H20.4C27.028 7.2 32.4 12.572 32.4 19.2V21.6C32.4 28.228 27.028 33.6 20.4 33.6H16.8L9.6 39V33.6C6.3 31.5 3.6 27.6 3.6 24V19.2Z" fill="#FBBF24"/>
      <path d="M20.4 19.2C20.4 13.898 24.698 9.6 30 9.6H32.4C37.702 9.6 42 13.898 42 19.2V21.6C42 26.902 37.702 31.2 32.4 31.2H30L25.2 34.8V31.32C22.56 29.76 20.4 26.7 20.4 24V19.2Z" fill="#D97706"/>
      <text x="50" y="33" font-family="Manrope, -apple-system, sans-serif" font-size="28" font-weight="800" letter-spacing="-0.5" fill="#0C0A09">
        Helvion<tspan fill="#F59E0B">.</tspan>
      </text>
    </svg>
  );

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
        padding: "11px 12px",
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
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: hovered ? "rgba(var(--hv-primary-rgb,245,158,11),0.08)" : "rgba(255,255,255,0.7)",
            border: hovered ? "1px solid rgba(var(--hv-primary-rgb,245,158,11),0.20)" : "1px solid rgba(0,0,0,0.06)",
            boxShadow: hovered ? "0 6px 16px rgba(245,158,11,0.12)" : "0 2px 10px rgba(0,0,0,0.06)",
            backdropFilter: "blur(8px)",
            transition: "all 180ms ease",
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              color: hovered ? "#57534E" : "#A1A1AA",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.005em",
              transition: "color 0.18s",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
            }}
          >
            {suffixMode ? (
              <>
                <HelvionFullLogo height={18} />
                <span>{tWidget(lang, "poweredByLine")}</span>
              </>
            ) : (
              <>
                <span>{tWidget(lang, "poweredByLine")}</span>
                <HelvionFullLogo height={18} />
              </>
            )}
          </span>
        </div>
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
  const [lang, setLang] = useState<WidgetLang>("tr");
  const langRef = useRef<WidgetLang>("tr");

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
      setUi(parseWidgetSettings({}, {}, lang));
      return;
    }

    console.warn("[Widget v2] Fetching bootloader for siteId:", siteId);
    fetchBootloader(siteId)
      .then((boot) => {
        if (cancelled) return;
        setBootOk(Boolean(boot?.ok));

        const cfg = (boot?.config || {}) as Record<string, unknown>;
        const ws = (cfg.widgetSettings || {}) as Record<string, unknown>;
        const cpc = (cfg.chatPageConfig || {}) as Record<string, unknown>;
        // Language: respect explicit language selection (do NOT override via inference).
        // Allow legacy inference only when language is missing/invalid/"auto".
        const rawLang = (cfg as any).language ?? (ws as any).language;
        const { lang: resolvedLang, explicit } = resolveWidgetLangExplicit(rawLang);
        const detectedLang = explicit ? resolvedLang : inferLangFromContent(resolvedLang, ws, cpc);
        setLang(detectedLang);
        langRef.current = detectedLang;
        try {
          document.documentElement.lang = detectedLang;
        } catch {
          // ignore
        }

        // Diagnostic: log the exact color values from bootloader
        console.warn("[Widget v2] Boot OK. lang:", detectedLang,
          "themeId:", ws.themeId,
          "primaryColor:", ws.primaryColor,
          "useCustomColor:", ws.useCustomColor,
          "customColor:", ws.customColor);

        const parsed = parseWidgetSettings(ws, cpc, detectedLang);
        console.warn("[Widget v2] Resolved color:", parsed.primaryColor);
        setUi(parsed);

        // Forward bootloader settings to parent loader so launcher also gets the correct color
        try {
          window.parent.postMessage({
            type: "helvion:config-update",
            settings: ws,
            language: detectedLang,
          }, "*");
        } catch { /* cross-origin safety */ }
      })
      .catch((err) => {
        console.warn("[Widget v2] Bootloader FAILED:", err?.message || err);
        if (!cancelled) setBootOk(false);
        if (!cancelled) {
          setUi(parseWidgetSettings({}, {}, langRef.current));
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
    } catch (err: any) {
      console.warn("[Widget v2] send FAILED:", err?.message || err);
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

  // Socket.IO — connect right after bootloader (for live config updates + messaging)
  // We store conversationId in a ref so the socket listeners always see the latest value
  // without needing to teardown/recreate the socket on every conversationId change.
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  useEffect(() => {
    if (!bootOk) return;

    const { orgToken } = getCachedAuth();
    if (!orgToken || !siteId) return;

    if (socketRef.current) return;

    const apiBase = getApiBase().replace(/\/+$/, "");
    const socket = io(apiBase, {
      auth: {
        token: orgToken,
        orgToken,
        siteId,
        visitorId,
      },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Widget v2] Socket connected", { id: socket.id });
      const cid = conversationIdRef.current;
      if (cid) {
        try { socket.emit("conversation:join", { conversationId: cid }); } catch { /* */ }
      }
    });
    socket.on("disconnect", () => {
      console.log("[Widget v2] Socket disconnected");
    });
    socket.on("connect_error", (err: any) => {
      console.warn("[Widget v2] Socket connect_error", err?.message || err);
    });

    // Live config updates — API emits this when portal saves widget settings.
    // The payload now includes `language` so we can update locale immediately.
    socket.on("widget:config-updated", (data: { settings?: Record<string, unknown>; language?: string }) => {
      try {
        console.log("[Widget v2] Live config update received", data.language || "no-lang");

        // Update language from event payload (explicit only).
        if (typeof data?.language === "string") {
          const { lang: newLang, explicit } = resolveWidgetLangExplicit(data.language);
          if (explicit) {
            setLang(newLang);
            langRef.current = newLang;
            try { document.documentElement.lang = newLang; } catch { /* ignore */ }

            // Forward language update to parent so launcher aria labels stay in sync.
            try {
              window.parent.postMessage({ type: "helvion:config-update", settings: null, language: newLang }, "*");
            } catch { /* */ }
          }
        }

        const ws = data?.settings;
        if (ws && typeof ws === "object") {
          const langNow = langRef.current;
          const parsed = parseWidgetSettings(ws, {}, langNow);
          setUi(parsed);

          // Forward settings + language to parent (loader.ts) so launcher updates too
          try {
            window.parent.postMessage({
              type: "helvion:config-update",
              settings: ws,
              language: langNow,
            }, "*");
          } catch { /* cross-origin safety */ }
        }
      } catch {
        // ignore
      }
    });

    // Realtime messages
    socket.on("message:new", (data: { conversationId: string; message: ApiMessage }) => {
      try {
        const cid = conversationIdRef.current;
        if (!data || !cid || data.conversationId !== cid) return;
        const msg = data.message;
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

    // Typing indicators
    socket.on("agent:typing", (data: { conversationId: string }) => {
      if (data?.conversationId !== conversationIdRef.current) return;
      setIsAgentTyping(true);
    });
    socket.on("agent:typing:stop", (data: { conversationId: string }) => {
      if (data?.conversationId !== conversationIdRef.current) return;
      setIsAgentTyping(false);
    });

    return () => {
      try { socket.disconnect(); } catch { /* */ }
      socketRef.current = null;
    };
  }, [bootOk, siteId, visitorId]);

  // When conversationId changes, join the conversation room on existing socket
  useEffect(() => {
    if (!conversationId || !socketRef.current) return;
    try {
      socketRef.current.emit("conversation:join", { conversationId });
    } catch {
      // ignore
    }
  }, [conversationId]);

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
          <div style={{ fontSize: "13px", color: "#6b7280" }}>{tWidget(lang, "loading")}</div>
        </div>
      ) : (
        <>
          {/* HEADER — inline style guarantees color even if CSS var fails */}
          <div className="hv-header" style={{ background: `linear-gradient(135deg, ${ui.primaryColor}, ${ui.primaryColorDark})` }}>
            <div className="hv-header-avatar">{ui.botAvatar}</div>
            <div className="hv-header-info">
              <div className="hv-header-title">{ui.title}</div>
              <div className="hv-header-subtitle">
                <span className="hv-status-dot" />
                {ui.subtitle}
              </div>
            </div>
            <button className="hv-header-close" onClick={close} aria-label={tWidget(lang, "closeChat")}>
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
                      <div className="hv-msg-bubble" style={{ background: `linear-gradient(135deg, ${ui.primaryColor}, ${ui.primaryColorDark})` }}>
                        <div className="hv-msg-sender">
                          Helvion AI <span className="hv-badge-ai">{tWidget(lang, "aiAgentBadge")}</span>
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
                      {m.status === "failed" ? <div className="hv-msg-failed">{tWidget(lang, "failedSend")}</div> : null}
                    </div>
                  </div>
                );
              })}

              {isAgentTyping ? (
                <div className="hv-typing-wrap">
                  <div className="hv-typing" aria-label="Agent typing" style={{ background: `linear-gradient(135deg, ${ui.primaryColor}, ${ui.primaryColorDark})` }}>
                    <div className="hv-typing-dot" />
                    <div className="hv-typing-dot" />
                    <div className="hv-typing-dot" />
                  </div>
                  <span className="hv-typing-label">{tWidget(lang, "typing")}</span>
                </div>
              ) : null}

              {/* Suggestion chips — shown after bot messages when no user messages yet */}
              {messages.length > 0 && messages.every((m) => m.role === "agent") && ui.starters.length > 0 ? (
                <div className="hv-suggestions">
                  {ui.starters.map((label) => (
                    <button
                      key={label}
                      className="hv-suggestion-chip"
                      type="button"
                      onClick={() => void pushUserMessage(label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* FOOTER */}
          <div className="hv-footer">
            <div className="hv-input-bar">
              <button className="hv-input-emoji" type="button" aria-label={tWidget(lang, "emoji")}>
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
                onFocus={(e) => { e.currentTarget.style.borderColor = ui.primaryColor; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
              />
              <button className="hv-input-attach" type="button" aria-label={tWidget(lang, "attach")}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <button className="hv-input-send" type="button" onClick={onSend} aria-label={tWidget(lang, "send")} style={{ background: ui.primaryColor }}>
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
      <PoweredByHelvion lang={lang} />
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
