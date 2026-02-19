import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./frame.css";
import { io, type Socket } from "socket.io-client";
import { createConversation, fetchBootloader, getApiBase, getCachedAuth, getMessages, sendMessage, type ApiMessage } from "./api";
import { getVisitorId } from "./visitor";
import { resolveWidgetLang, tWidget, type WidgetLang } from "./i18n";

type ViewMode = "home" | "chat";
type MsgRole = "agent" | "user" | "system";
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
  offlineMsg: string;
  placeholder: string;
  starters: string[];
  botAvatar: string;
  brandLogoDataUrl?: string;
  emojiPickerEnabled: boolean;
  fileUploadEnabled: boolean;
  aiName: string;
  aiLabelEnabled: boolean;
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

type SystemEvent =
  | { type: "conversation_closed" }
  | { type: "agent_joined"; name?: string }
  | { type: "ai_handoff" }
  | { type: "unknown"; raw: string };

function parseSystemEvent(raw: string): SystemEvent | null {
  const text = String(raw || "").trim();
  const m = text.match(/^\[(system)\]\s*([a-z0-9_]+)(?::(.*))?$/i);
  if (!m) return null;
  const key = String(m[2] || "").trim().toLowerCase();
  const param = (m[3] || "").trim();

  if (key === "conversation_closed") return { type: "conversation_closed" };
  if (key === "agent_joined") return { type: "agent_joined", name: param || undefined };
  if (key === "ai_handoff") return { type: "ai_handoff" };
  return { type: "unknown", raw: text };
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
    // Legacy fallbacks (bootloader always includes them for backward compatibility)
    normalize(ws.welcomeTitle) ||
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
  const offlineMsg =
    normalize(ws.offlineMsg) ||
    normalize(ws.offlineMessage) ||
    tWidget(lang, "chatDisabled");
  const botAvatar = normalize(ws.botAvatar) || "🤖";
  const brandLogoDataUrl = normalize(ws.brandLogoDataUrl);
  const emojiPickerEnabled = ws.emojiPicker !== false && ws.emojiPickerEnabled !== false; // default ON
  const fileUploadEnabled = ws.fileUpload !== false && ws.fileUploadEnabled !== false; // default ON
  const aiName = normalize(ws.aiName) || "Helvion";
  // Avoid "Helvion AI AI" duplication when the name already includes AI.
  const aiLabelEnabled = ws.aiLabel !== false && !/\bai\b/i.test(aiName); // default ON

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

  return {
    title,
    subtitle,
    welcome,
    offlineMsg,
    placeholder,
    starters,
    botAvatar,
    brandLogoDataUrl: brandLogoDataUrl || undefined,
    emojiPickerEnabled,
    fileUploadEnabled,
    aiName,
    aiLabelEnabled,
    primaryColor: resolvedColor,
    primaryColorDark: resolvedDark,
  };
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
  const suffixMode = lang === "tr";

  const HelvionMark = ({ height = 20 }: { height?: number }) => {
    const iconW = (42 / 48) * height;
    const wordSize = Math.round(height * 0.62); // visually matches the previous SVG scale
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <svg
          width={iconW}
          height={height}
          viewBox="0 0 42 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
          style={{ display: "block" }}
        >
          <path d="M3.6 19.2C3.6 12.572 8.972 7.2 15.6 7.2H20.4C27.028 7.2 32.4 12.572 32.4 19.2V21.6C32.4 28.228 27.028 33.6 20.4 33.6H16.8L9.6 39V33.6C6.3 31.5 3.6 27.6 3.6 24V19.2Z" fill="#FBBF24"/>
          <path d="M20.4 19.2C20.4 13.898 24.698 9.6 30 9.6H32.4C37.702 9.6 42 13.898 42 19.2V21.6C42 26.902 37.702 31.2 32.4 31.2H30L25.2 34.8V31.32C22.56 29.76 20.4 26.7 20.4 24V19.2Z" fill="#D97706"/>
        </svg>
        <span
          style={{
            fontFamily: "Manrope, system-ui, -apple-system, sans-serif",
            fontSize: wordSize,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#0C0A09",
            lineHeight: 1,
          }}
        >
          Helvion<span style={{ color: "#F59E0B" }}>.</span>
        </span>
      </span>
    );
  };

  return (
    <div
      onClick={() => window.open("https://helvion.io", "_blank")}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 12px",
        cursor: "pointer",
        position: "relative",
        background: "#FAFAFA",
        borderTop: "1px solid #EBEBED",
      }}
    >
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              color: "#78716C",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.005em",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            }}
          >
            {suffixMode ? (
              <>
                <HelvionMark />
                <span>{tWidget(lang, "poweredByLine")}</span>
              </>
            ) : (
              <>
                <span>{tWidget(lang, "poweredByLine")}</span>
                <HelvionMark />
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

  const hostLangPref = useMemo(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      // `hl` is set by loader.ts from Helvion's `helvino_lang` cookie or
      // an explicit window.HELVION_WIDGET_LANG provided by the embedder.
      return resolveWidgetLangExplicit(qs.get("hl"));
    } catch {
      return resolveWidgetLangExplicit("");
    }
  }, []);
  const hostLangRef = useRef<WidgetLang | null>(hostLangPref.explicit ? hostLangPref.lang : null);

  const [view, setView] = useState<ViewMode>("home");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [bootOk, setBootOk] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const initialLang = hostLangRef.current || "tr";
  const [lang, setLang] = useState<WidgetLang>(initialLang);
  const langRef = useRef<WidgetLang>(initialLang);

  const wsRef = useRef<Record<string, unknown>>({});
  const cpcRef = useRef<Record<string, unknown>>({});

  const EMOJIS = ["😀","😁","😂","😊","😍","😎","🤝","🙏","👍","🔥","✨","🎉","💯","💬","✅","⚡","🤖","🧡","📦","🛠️","💡","📍","⭐","🚀"];

  function parseFilePayload(raw: string): { name: string; mime: string; dataUrl: string } | null {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (!s || s[0] !== "{") return null;
    try {
      const j = JSON.parse(s);
      if (!j || typeof j !== "object") return null;
      if ((j as any).type !== "file") return null;
      const name = typeof (j as any).name === "string" ? (j as any).name : "file";
      const mime = typeof (j as any).mime === "string" ? (j as any).mime : "application/octet-stream";
      const dataUrl = typeof (j as any).dataUrl === "string" ? (j as any).dataUrl : "";
      if (!dataUrl.startsWith("data:")) return null;
      return { name, mime, dataUrl };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    function onParentMessage(e: MessageEvent) {
      if (e.source !== window.parent) return;
      if (e?.data?.type !== "helvion:host-lang") return;
      if (typeof e?.data?.language !== "string") return;
      const { lang: next, explicit } = resolveWidgetLangExplicit(e.data.language);
      if (!explicit) return;
      hostLangRef.current = next;
      if (next === langRef.current) return;
      setLang(next);
      langRef.current = next;
      try { document.documentElement.lang = next; } catch { /* ignore */ }
      try { setUi(parseWidgetSettings(wsRef.current, cpcRef.current, next)); } catch { /* ignore */ }
    }
    window.addEventListener("message", onParentMessage);
    return () => window.removeEventListener("message", onParentMessage);
  }, []);

  // Avoid theme/text flash: render a loading state until bootloader resolves.
  const [ui, setUi] = useState<UiCopy | null>(null);
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [writeEnabled, setWriteEnabled] = useState(true);
  const [conversationClosed, setConversationClosed] = useState(false);
  const spinnerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingStartedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const visitorId = useMemo(() => getVisitorId(), []);
  const siteId = useMemo(() => getSiteIdFromRuntime(), []);
  const configVersionRef = useRef<number>(0);

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
      setUi(parseWidgetSettings({}, {}, langRef.current));
      return;
    }

    // If the host page provided a locale, apply it immediately so footer copy doesn't flash.
    if (hostLangRef.current) {
      try {
        document.documentElement.lang = langRef.current;
      } catch {
        // ignore
      }
    }

    console.warn("[Widget v2] Fetching bootloader for siteId:", siteId);
    fetchBootloader(siteId)
      .then((boot) => {
        if (cancelled) return;
        setBootOk(Boolean(boot?.ok));
        if (typeof (boot as any)?.configVersion === "number") {
          configVersionRef.current = (boot as any).configVersion;
        }

        const cfg = (boot?.config || {}) as Record<string, unknown>;
        const we = (cfg as any).widgetEnabled;
        const wre = (cfg as any).writeEnabled;
        setWidgetEnabled(we !== false);
        setWriteEnabled(wre !== false);
        const ws = (cfg.widgetSettings || {}) as Record<string, unknown>;
        const cpc = (cfg.chatPageConfig || {}) as Record<string, unknown>;
        wsRef.current = ws;
        cpcRef.current = cpc;
        // Language: respect explicit language selection (do NOT override via inference).
        // Allow legacy inference only when language is missing/invalid/"auto".
        const rawLang = (cfg as any).language ?? (ws as any).language;
        const { lang: resolvedLang, explicit } = resolveWidgetLangExplicit(rawLang);
        const detectedLang = hostLangRef.current
          ? hostLangRef.current
          : (explicit ? resolvedLang : inferLangFromContent(resolvedLang, ws, cpc));
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
        // + and so the loader can hide the widget when disabled.
        try {
          window.parent.postMessage({
            type: "helvion:config-update",
            settings: ws,
            language: detectedLang,
            config: { widgetEnabled: we !== false, writeEnabled: wre !== false },
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

  // Lightweight config polling:
  // - widget settings already update via socket (`widget:config-updated`)
  // - org-level toggles (widgetEnabled/writeEnabled/aiEnabled) may not emit socket events
  //   so we refresh from bootloader when configVersion changes.
  useEffect(() => {
    if (!siteId) return;
    let stopped = false;
    const apiBase = getApiBase().replace(/\/+$/, "");
    const poll = async () => {
      try {
        const res = await fetch(`${apiBase}/api/bootloader/version?siteId=${encodeURIComponent(siteId)}`, {
          method: "GET",
          headers: { "x-site-id": siteId },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return;
        const v = typeof data.configVersion === "number" ? data.configVersion : 0;
        if (v > 0 && v !== configVersionRef.current) {
          const boot = await fetchBootloader(siteId);
          if (stopped) return;
          if (typeof (boot as any)?.configVersion === "number") {
            configVersionRef.current = (boot as any).configVersion;
          }
          const cfg = (boot?.config || {}) as Record<string, unknown>;
          const we = (cfg as any).widgetEnabled;
          const wre = (cfg as any).writeEnabled;
          setWidgetEnabled(we !== false);
          setWriteEnabled(wre !== false);
          const ws = (cfg.widgetSettings || {}) as Record<string, unknown>;
          const cpc = (cfg.chatPageConfig || {}) as Record<string, unknown>;
          wsRef.current = ws;
          cpcRef.current = cpc;
          try {
            setUi(parseWidgetSettings(ws, cpc, langRef.current));
          } catch {
            // ignore
          }
          try {
            window.parent.postMessage(
              { type: "helvion:config-update", settings: ws, language: langRef.current, config: { widgetEnabled: we !== false, writeEnabled: wre !== false } },
              "*"
            );
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    };
    const timer = window.setInterval(() => {
      if (!stopped) void poll();
    }, 25_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
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

  // Close emoji popover on outside click / escape
  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.(".hv-emoji-wrap")) return;
      setEmojiOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmojiOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  const pushUserMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!writeEnabled || conversationClosed) {
      setView("chat");
      const msg: ChatMessage = {
        id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: "system",
        text: tWidget(langRef.current, "chatDisabled"),
        time: nowTime(),
      };
      setMessages((prev) => [...prev, msg]);
      return;
    }

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
                  const sys = parseSystemEvent(m.content);
                  if (sys?.type === "conversation_closed") {
                    setConversationClosed(true);
                  }
                  newMsgs.push({
                    id: `s_${m.id}`,
                    serverId: m.id,
                    role: sys ? "system" : "agent",
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

  const pushUserFile = async (file: File) => {
    if (!file) return;
    if (!ui?.fileUploadEnabled) return;

    // Server enforces a 32KB message content limit. Keep payloads tiny.
    const MAX_FILE_BYTES = 18 * 1024;
    if (file.size > MAX_FILE_BYTES) {
      console.warn("[Widget v2] file too large for inline send:", file.size);
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("file_read_failed"));
      reader.readAsDataURL(file);
    });

    const payload = JSON.stringify({
      type: "file",
      name: file.name || "file",
      mime: file.type || "application/octet-stream",
      dataUrl,
    });
    const bytes = new TextEncoder().encode(payload).length;
    if (bytes > 30 * 1024) {
      console.warn("[Widget v2] inline file payload too large:", bytes);
      return;
    }

    setView("chat");
    const clientId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [...prev, { id: clientId, role: "user", text: payload, time: nowTime(), status: "sending" }]);

    try {
      if (!siteId) throw new Error("missing_site_id");
      if (!bootOk) console.warn("[Widget v2] bootOk=false; send may fail until bootloader succeeds");

      let cid = conversationId;
      if (!cid) {
        const conv = await createConversation(siteId, visitorId);
        cid = conv.id;
        setConversationId(cid);
      }

      const sent = await sendMessage(cid, payload);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientId
            ? { ...m, status: undefined, serverId: sent.id, time: formatTimeFromIso(sent.timestamp) || m.time }
            : m
        )
      );
    } catch (err: any) {
      console.warn("[Widget v2] file send FAILED:", err?.message || err);
      setMessages((prev) => prev.map((m) => (m.id === clientId ? { ...m, status: "failed" } : m)));
    }
  };

  const onSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (!writeEnabled || conversationClosed) return;
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
        if (!hostLangRef.current && typeof data?.language === "string") {
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
          wsRef.current = ws as Record<string, unknown>;
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
        const sys = parseSystemEvent(msg.content);
        if (sys?.type === "conversation_closed") {
          setConversationClosed(true);
        }

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
              role: sys ? "system" : "agent",
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
      {!widgetEnabled ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
          {/* Keep this minimal; the loader should hide the widget entirely. */}
        </div>
      ) : !ui ? (
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
            <div className="hv-header-avatar">
              {ui.brandLogoDataUrl ? (
                <img className="hv-avatar-img" src={ui.brandLogoDataUrl} alt="Logo" />
              ) : (
                ui.botAvatar
              )}
            </div>
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
              <p className="hv-home-subtitle">{writeEnabled ? ui.welcome : ui.offlineMsg}</p>
              <div className="hv-starters">
                {ui.starters.map((label) => (
                  <button key={label} className="hv-starter" type="button" onClick={() => void pushUserMessage(label)} disabled={!writeEnabled || conversationClosed}>
                    {label}
                  </button>
                ))}
                {/* Handoff CTA (safe UX improvement): always available */}
                <button
                  className="hv-starter hv-starter-agent"
                  type="button"
                  onClick={() => void pushUserMessage(tWidget(lang, "talkToAgent"))}
                  disabled={!writeEnabled || conversationClosed}
                >
                  {tWidget(lang, "talkToAgent")}
                </button>
              </div>
            </div>
          ) : (
            <div className="hv-messages" role="log" aria-label="Messages">
              {messages.map((m) => {
                const filePayload = parseFilePayload(m.text);
                if (m.role === "system") {
                  const ev = parseSystemEvent(m.text);
                  let label = m.text;
                  if (ev?.type === "conversation_closed") label = tWidget(lang, "systemConversationClosed");
                  else if (ev?.type === "agent_joined") {
                    label = ev.name ? `${tWidget(lang, "systemAgentJoined")}: ${ev.name}` : tWidget(lang, "systemAgentJoined");
                  }
                  else if (ev?.type === "ai_handoff") label = tWidget(lang, "systemAiHandoff");
                  return (
                    <div key={m.id} className="hv-system">
                      <span className="hv-system-pill">{label}</span>
                    </div>
                  );
                }

                if (m.role === "agent") {
                  return (
                    <div key={m.id} className="hv-msg hv-msg-agent">
                      <div className="hv-msg-avatar">
                        {ui.brandLogoDataUrl ? (
                          <img className="hv-avatar-img" src={ui.brandLogoDataUrl} alt="Logo" />
                        ) : (
                          ui.botAvatar
                        )}
                      </div>
                      <div className="hv-msg-bubble" style={{ background: `linear-gradient(135deg, ${ui.primaryColor}, ${ui.primaryColorDark})` }}>
                        <div className="hv-msg-sender">
                          {ui.aiName}
                          {ui.aiLabelEnabled ? <span className="hv-badge-ai">{tWidget(lang, "aiBadge")}</span> : null}
                        </div>
                        <div className="hv-msg-text">
                          {filePayload ? <img className="hv-msg-img" src={filePayload.dataUrl} alt={filePayload.name} /> : m.text}
                        </div>
                        <div className="hv-msg-time">{m.time}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className="hv-msg hv-msg-user">
                    <div className="hv-msg-bubble">
                      <div className="hv-msg-text">
                        {filePayload ? <img className="hv-msg-img" src={filePayload.dataUrl} alt={filePayload.name} /> : m.text}
                      </div>
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
              <input
                className="hv-input-field"
                placeholder={writeEnabled && !conversationClosed ? ui.placeholder : ui.offlineMsg}
                value={inputValue}
                disabled={!writeEnabled || conversationClosed}
                ref={(el) => {
                  inputRef.current = el;
                }}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  emitTypingStartDebounced();
                }}
                onKeyDown={onInputKeyDown}
                onFocus={(e) => { e.currentTarget.style.borderColor = ui.primaryColor; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
              />
              {ui.emojiPickerEnabled ? (
                <div className="hv-emoji-wrap">
                  <button
                    className="hv-input-emoji"
                    type="button"
                    aria-label={tWidget(lang, "emoji")}
                    disabled={!writeEnabled || conversationClosed}
                    onClick={() => setEmojiOpen((v) => !v)}
                  >
                    😊
                  </button>
                  {emojiOpen ? (
                    <div className="hv-emoji-pop" role="dialog" aria-label={tWidget(lang, "emoji")}>
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          className="hv-emoji-item"
                          type="button"
                          disabled={!writeEnabled || conversationClosed}
                          onClick={() => {
                            setInputValue((p) => `${p}${e}`);
                            setEmojiOpen(false);
                            try { inputRef.current?.focus(); } catch { /* */ }
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {ui.fileUploadEnabled ? (
                <>
                  <input
                    ref={(el) => {
                      fileInputRef.current = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      if (!f) return;
                      void pushUserFile(f);
                    }}
                  />
                  <button
                    className="hv-input-gif"
                    type="button"
                    aria-label={tWidget(lang, "gif")}
                    disabled={!writeEnabled || conversationClosed}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    GIF
                  </button>
                  <button
                    className="hv-input-attach"
                    type="button"
                    aria-label={tWidget(lang, "attach")}
                    disabled={!writeEnabled || conversationClosed}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                </>
              ) : null}
              <button
                className="hv-input-send"
                type="button"
                onClick={onSend}
                aria-label={tWidget(lang, "send")}
                disabled={!writeEnabled || conversationClosed}
                style={{ background: ui.primaryColor }}
              >
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
