"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { usePortalAuth } from "@/contexts/PortalAuthContext";

const SOUND_STORAGE_KEY = "helvino_portal_sound_enabled";

interface PortalInboxNotificationContextValue {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  emitAgentTyping: (conversationId: string) => void;
  emitAgentTypingStop: (conversationId: string) => void;
  onUserTyping: (cb: (data: { conversationId: string }) => void) => () => void;
  onUserTypingStop: (cb: (data: { conversationId: string }) => void) => () => void;
  testSound: () => void;
  socketStatus: string;
  lastMessageAt: string | null;
}

const noop = () => () => {};
const defaultValue: PortalInboxNotificationContextValue = {
  soundEnabled: true,
  setSoundEnabled: () => {},
  notificationPermission: "default",
  requestNotificationPermission: async () => "default",
  emitAgentTyping: () => {},
  emitAgentTypingStop: () => {},
  onUserTyping: noop,
  onUserTypingStop: noop,
  testSound: () => {},
  socketStatus: "not-initialized",
  lastMessageAt: null,
};

const PortalInboxNotificationContext = createContext<PortalInboxNotificationContextValue>(defaultValue);

export function usePortalInboxNotification() {
  return useContext(PortalInboxNotificationContext);
}

// ── Sound helper: HTML5 Audio with base64 WAV (most reliable cross-browser) ──
// Tiny two-tone WAV generated at build time — no file dependency, no autoplay issues
// after a single user gesture (click anywhere on portal page).
let _userHasInteracted = false;

if (typeof window !== "undefined") {
  const markInteracted = () => {
    _userHasInteracted = true;
    document.removeEventListener("click", markInteracted);
    document.removeEventListener("keydown", markInteracted);
    document.removeEventListener("touchstart", markInteracted);
  };
  document.addEventListener("click", markInteracted);
  document.addEventListener("keydown", markInteracted);
  document.addEventListener("touchstart", markInteracted);
}

/**
 * Play notification beep using Web Audio API.
 * Falls back silently if anything fails.
 */
function safePlayBeep(): void {
  try {
    if (typeof window === "undefined") {
      return;
    }

    if (!_userHasInteracted) {
      return;
    }

    // Use AudioContext for programmatic beep — create fresh each time to avoid state issues
    const ACtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!ACtor) {
      return;
    }

    const ctx = new ACtor();

    // Resume if needed, then play
    const play = () => {
      try {
        // First tone (C6 = 1047 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.value = 1047;
        osc1.type = "sine";
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);

        // Second tone (E6 = 1319 Hz) after short gap
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1319;
        osc2.type = "sine";
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.35);

        // Clean up context after sound finishes
        setTimeout(() => { try { ctx.close(); } catch { /* */ } }, 500);

      } catch (e) {
        console.warn("[Portal Sound] Failed to play beep:", e);
      }
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(play).catch((e) => {
        console.warn("[Portal Sound] Failed to resume AudioContext:", e);
      });
    } else {
      play();
    }
  } catch (e) {
    console.warn("[Portal Sound] safePlayBeep error:", e);
  }
}

/**
 * Prefer an MP3 file if present, otherwise fall back to Web Audio beep.
 * NOTE: the repository includes `public/sounds/README.md` describing this.
 */
function safePlayInboxSound(): void {
  try {
    if (typeof window === "undefined") return;
    if (!_userHasInteracted) return;

    // Try MP3 file first. If missing/blocked, fall back to WebAudio beep.
    const audio = new Audio("/sounds/notification.mp3");
    audio.volume = 0.7;
    const p = audio.play();
    if (p && typeof (p as Promise<void>).catch === "function") {
      (p as Promise<void>).catch(() => safePlayBeep());
    }
  } catch {
    safePlayBeep();
  }
}

export function PortalInboxNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = usePortalAuth();
  const router = useRouter();
  console.log("[Portal Notification Context] mounted");
  console.log("[Portal Notification Context] user:", user?.email, "orgKey:", user?.orgKey);
  const socketRef = useRef<unknown>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const soundEnabledRef = useRef(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [socketStatus, setSocketStatus] = useState("not-initialized");
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null);

  soundEnabledRef.current = soundEnabled;

  // ── Load sound preference from localStorage (safe) ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOUND_STORAGE_KEY);
      setSoundEnabledState(stored !== "false");
    } catch {
      // localStorage unavailable — keep default
    }
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try { localStorage.setItem(SOUND_STORAGE_KEY, String(enabled)); } catch { /* */ }
  }, []);

  // ── Notification permission (safe) ──
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return "denied";
      if (Notification.permission !== "default") {
        setNotificationPermission(Notification.permission);
        return Notification.permission;
      }
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      return perm;
    } catch {
      return "denied";
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        setNotificationPermission(Notification.permission);
      }
    } catch { /* */ }
  }, []);

  // ── Socket.IO connection (fully wrapped in try-catch, lazy import) ──
  useEffect(() => {
    console.log("[Portal Socket] user check:", !!user, "orgKey:", user?.orgKey);
    if (!user?.orgKey) {
      console.log("[Portal Socket] skipping: no user or orgKey");
      setSocketStatus("no-user");
      return;
    }

    let socketInstance: ReturnType<typeof import("socket.io-client").io> | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        console.log("[Portal Socket] attempting connection...", { orgKey: user.orgKey });
        // Lazy import so socket.io-client failure never crashes the page
        const { io } = await import("socket.io-client");
        const { API_URL } = await import("@/lib/portal-auth");

        if (cancelled) return;

        setSocketStatus("connecting");
        // Use the in-memory access token (portal-auth stores tokens in memory for XSS safety,
        // NOT in sessionStorage). This is the same JWT used for API calls.
        const { getPortalAccessToken } = await import("@/lib/portal-auth");
        const portalSocketToken = getPortalAccessToken() || undefined;
        socketInstance = io(API_URL, {
          transports: ["websocket", "polling"],
          auth: { orgKey: user.orgKey, token: portalSocketToken },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 15000,
          randomizationFactor: 0.3,
          timeout: 10000,
          withCredentials: true,
        });
        socketRef.current = socketInstance;

        socketInstance.on("connect", () => {
          console.log("[Portal Socket] connected:", socketInstance?.id);
          setSocketStatus("connected:" + socketInstance?.id);
        });

        socketInstance.on("connect_error", (err: Error) => {
          console.warn("[Portal Socket] error:", err.message);
          setSocketStatus("error:" + err.message);
        });

        socketInstance.on("disconnect", (reason: string) => {
          console.log("[Portal Socket] disconnected:", reason);
          setSocketStatus("disconnected:" + reason);
        });

        // Relay user:typing and user:typing:stop via custom events to inbox
        socketInstance.on("user:typing", (data: { conversationId?: string }) => {
          try { window.dispatchEvent(new CustomEvent("portal-user-typing", { detail: data })); } catch { /* */ }
        });
        socketInstance.on("user:typing:stop", (data: { conversationId?: string }) => {
          try { window.dispatchEvent(new CustomEvent("portal-user-typing-stop", { detail: data })); } catch { /* */ }
        });

        socketInstance.on("message:new", (payload: { conversationId?: string; message?: { id?: string; content?: string; role?: string; timestamp?: string; createdAt?: string; isAIGenerated?: boolean } }) => {
          try {
            console.log("[Portal Notification] new message received:", payload);
            const conversationId = payload?.conversationId || "";
            const preview = (payload?.message?.content || "").slice(0, 80);
            const role = payload?.message?.role || "";
            const isVisitorMessage = role === "user";
            setLastMessageAt(new Date().toLocaleTimeString());

            // Sound + notification only for visitor/customer messages
            if (isVisitorMessage && soundEnabledRef.current) {
              console.log("[Portal Notification] playing sound");
              safePlayInboxSound();
            }

            // Desktop notification
            try {
              if (isVisitorMessage && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                const n = new Notification("New message", {
                  body: preview || "New message in conversation",
                  tag: conversationId,
                  icon: "/favicon.ico",
                });
                n.onclick = () => {
                  try {
                    window.focus();
                    n.close();
                    router.push(`/portal/inbox?c=${conversationId}`);
                  } catch { /* */ }
                };
              }
            } catch { /* notification failed, no crash */ }

            // Tell bell badge to refresh only for visitor/customer messages
            try {
              if (isVisitorMessage) {
                window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
                window.dispatchEvent(new CustomEvent("portal-inbox-badge-pulse"));
                window.dispatchEvent(new CustomEvent("portal-inbox-unread-increment"));
              }
            } catch { /* */ }

            // Notify inbox screen so it can mark active conversation as read + push message immediately
            try {
              const msg = payload?.message;
              window.dispatchEvent(new CustomEvent("portal-inbox-message-new", {
                detail: {
                  conversationId,
                  content: msg?.content || "",
                  role,
                  message: msg ? {
                    id: msg.id || `rt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    conversationId,
                    content: msg.content || "",
                    role: (msg.role as "user" | "assistant") || "user",
                    timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
                    isAIGenerated: msg.isAIGenerated || false,
                  } : undefined,
                },
              }));
            } catch { /* */ }
          } catch {
            // message:new handler failed — never crash
          }
        });
      } catch (err) {
        console.warn("[Portal Socket] Failed to connect (non-fatal):", err);
        // Socket failed — pages still work, just no real-time updates
      }
    };

    connect();

    return () => {
      cancelled = true;
      try {
        if (socketInstance) {
          socketInstance.off("message:new");
          socketInstance.off("user:typing");
          socketInstance.off("user:typing:stop");
          socketInstance.disconnect();
        }
      } catch { /* */ }
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.orgKey, router]);

  const emitAgentTyping = useCallback((conversationId: string) => {
    try {
      const s = socketRef.current as { emit?: (e: string, d: unknown) => void } | null;
      s?.emit?.("agent:typing:start", { conversationId });
    } catch { /* */ }
  }, []);

  const emitAgentTypingStop = useCallback((conversationId: string) => {
    try {
      const s = socketRef.current as { emit?: (e: string, d: unknown) => void } | null;
      s?.emit?.("agent:typing:stop", { conversationId });
    } catch { /* */ }
  }, []);

  const onUserTyping = useCallback((cb: (data: { conversationId: string }) => void) => {
    const handler = (e: Event) => { try { cb((e as CustomEvent).detail); } catch { /* */ } };
    window.addEventListener("portal-user-typing", handler);
    return () => window.removeEventListener("portal-user-typing", handler);
  }, []);

  const onUserTypingStop = useCallback((cb: (data: { conversationId: string }) => void) => {
    const handler = (e: Event) => { try { cb((e as CustomEvent).detail); } catch { /* */ } };
    window.addEventListener("portal-user-typing-stop", handler);
    return () => window.removeEventListener("portal-user-typing-stop", handler);
  }, []);

  const testSound = useCallback(() => {
    safePlayInboxSound();
  }, []);

  const value: PortalInboxNotificationContextValue = {
    soundEnabled,
    setSoundEnabled,
    notificationPermission,
    requestNotificationPermission,
    emitAgentTyping,
    emitAgentTypingStop,
    onUserTyping,
    onUserTypingStop,
    testSound,
    socketStatus,
    lastMessageAt,
  };

  // ALWAYS render children — provider must never block page content
  return (
    <PortalInboxNotificationContext.Provider value={value}>
      {children}
    </PortalInboxNotificationContext.Provider>
  );
}
