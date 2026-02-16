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

function playNotificationSound() {
  try {
    if (typeof window === "undefined") return;
    const ACtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = new ACtor();
    const now = ctx.currentTime;

    const notes = [
      { freq: 880, start: 0, end: 0.12 },
      { freq: 1100, start: 0.15, end: 0.27 },
      { freq: 880, start: 0.30, end: 0.50 },
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = n.freq;
      gain.gain.setValueAtTime(0.4, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.01, now + n.end);
      osc.start(now + n.start);
      osc.stop(now + n.end + 0.05);
    });

    console.warn("[NOTIF] notification sound OK");
    setTimeout(() => { try { ctx.close(); } catch { /* */ } }, 800);
  } catch (e) {
    console.warn("[NOTIF] sound fail:", e);
  }
}

export function PortalInboxNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = usePortalAuth();
  const router = useRouter();
  console.warn("[Portal Notification Context] mounted, user:", user?.email, "orgKey:", user?.orgKey);
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
    console.warn("[Portal Socket] user check:", !!user, "orgKey:", user?.orgKey);
    if (!user?.orgKey) {
      console.warn("[Portal Socket] skipping: no user or orgKey");
      setSocketStatus("no-user");
      return;
    }

    let socketInstance: ReturnType<typeof import("socket.io-client").io> | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        // Lazy import so socket.io-client failure never crashes the page
        const { io } = await import("socket.io-client");
        const { API_URL, getPortalAccessToken, portalRefreshAccessToken } = await import("@/lib/portal-auth");

        if (cancelled) return;

        // If no in-memory token (e.g. page refresh), attempt a token refresh first.
        // The cookie-based fallback on the API handles auth too, but having the
        // token explicitly is more reliable across different browser cookie policies.
        let portalSocketToken = getPortalAccessToken() || undefined;
        if (!portalSocketToken) {
          console.warn("[Portal Socket] no in-memory token, attempting refresh...");
          await portalRefreshAccessToken().catch(() => {});
          portalSocketToken = getPortalAccessToken() || undefined;
        }
        console.warn("[Portal Socket] connecting to", API_URL, { orgKey: user.orgKey, hasToken: !!portalSocketToken });

        if (cancelled) return;
        setSocketStatus("connecting");

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
          console.warn("[Portal Socket] connected:", socketInstance?.id);
          setSocketStatus("connected:" + socketInstance?.id);
        });

        socketInstance.on("connect_error", (err: Error) => {
          console.warn("[Portal Socket] error:", err.message);
          setSocketStatus("error:" + err.message);
        });

        socketInstance.on("disconnect", (reason: string) => {
          console.warn("[Portal Socket] disconnected:", reason);
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
            console.warn("[NOTIF] message:new:", payload);

            const conversationId = payload?.conversationId || "";
            const role = payload?.message?.role || "";
            const isVisitorMessage = role === "user";
            setLastMessageAt(new Date().toLocaleTimeString());

            // 1. Beep (every visitor message, once, immediately)
            if (isVisitorMessage) {
              playNotificationSound();
            }

            // 2. Dispatch single unified event for PortalLayout badge + inbox list
            try {
              window.dispatchEvent(new CustomEvent("helvion-new-message", { detail: payload }));
            } catch { /* */ }

            // 3. Keep existing events for inbox list real-time update
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
          } catch (err) {
            console.warn("[NOTIF] message:new handler crashed:", err);
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
    playNotificationSound();
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
