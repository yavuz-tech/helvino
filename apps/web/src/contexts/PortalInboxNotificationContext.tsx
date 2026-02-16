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
 * Notification sound (rebuilt per requirements):
 * - Try MP3 first
 * - If MP3 fails, try WebAudio beep fallback
 * - Always console.warn with [NOTIF] (production-safe)
 */
async function playPortalNotificationSound(): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    console.warn("[NOTIF] attempting to play sound");

    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0.5;
      await audio.play();
      console.warn("[NOTIF] sound played OK");
      return;
    } catch (e) {
      console.warn("[NOTIF] mp3 failed, trying beep fallback");
      console.warn("[NOTIF] sound error:", e);
    }

    try {
      const ACtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ACtor) {
        console.warn("[NOTIF] all sound failed: AudioContext not available");
        return;
      }

      const ctx = new ACtor();
      try {
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
      } catch (e) {
        console.warn("[NOTIF] sound error:", e);
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);

      console.warn("[NOTIF] beep played OK");
      setTimeout(() => { try { ctx.close(); } catch { /* */ } }, 300);
    } catch (e2) {
      console.warn("[NOTIF] all sound failed:", e2);
    }
  } catch (e) {
    console.warn("[NOTIF] all sound failed:", e);
  }
}

export function PortalInboxNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = usePortalAuth();
  const router = useRouter();
  console.warn("[Portal Notification Context] mounted, user:", user?.email, "orgKey:", user?.orgKey);
  const socketRef = useRef<unknown>(null);
  const openConversationIdRef = useRef<string | null>(null);
  const soundRepeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRepeatCountRef = useRef(0);
  const soundRepeatConversationIdRef = useRef<string | null>(null);
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

  // Track which conversation is currently open (so we can suppress sound when chat is open).
  useEffect(() => {
    const onOpened = (event: Event) => {
      try {
        const id = String((event as CustomEvent<{ conversationId?: string | null }>).detail?.conversationId || "") || null;
        openConversationIdRef.current = id;
        console.warn("[NOTIF] openConversationIdRef ->", id);

        // If we're repeating sound for this conversation, stop immediately.
        if (id && soundRepeatConversationIdRef.current === id && soundRepeatTimerRef.current) {
          console.warn("[NOTIF] stop sound repeat (conversation opened):", id);
          clearInterval(soundRepeatTimerRef.current);
          soundRepeatTimerRef.current = null;
          soundRepeatConversationIdRef.current = null;
          soundRepeatCountRef.current = 0;
        }
      } catch { /* */ }
    };
    window.addEventListener("portal-inbox-conversation-opened", onOpened as EventListener);
    return () => window.removeEventListener("portal-inbox-conversation-opened", onOpened as EventListener);
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
            console.warn("[NOTIF] message:new received:", payload);
            console.warn("[NOTIF] current pathname:", window.location.pathname);

            const conversationId = payload?.conversationId || "";
            const preview = (payload?.message?.content || "").slice(0, 80);
            const role = payload?.message?.role || "";
            const isVisitorMessage = role === "user";
            setLastMessageAt(new Date().toLocaleTimeString());

            // DOM discovery logs (NO style manipulation)
            try {
              const sidebarInboxSelector = 'a[href="/portal/inbox"]';
              const sidebarEl = document.querySelector(sidebarInboxSelector);
              console.warn("[NOTIF] sidebar inbox selector:", sidebarInboxSelector);
              console.warn("[NOTIF] sidebar inbox element:", sidebarEl);
            } catch { /* */ }
            try {
              const cardSelector = conversationId ? `[data-conversation-id="${conversationId}"]` : "";
              const cardEl = cardSelector ? document.querySelector(cardSelector) : null;
              console.warn("[NOTIF] conversation card selector:", cardSelector);
              console.warn("[NOTIF] conversation card element:", cardEl);
            } catch { /* */ }

            // Sound (rebuilt): play on new visitor message, but NOT if that chat is currently open.
            if (isVisitorMessage && soundEnabledRef.current) {
              const openId = openConversationIdRef.current;
              const isChatOpen = Boolean(openId && conversationId && openId === conversationId);
              if (isChatOpen) {
                console.warn("[NOTIF] playing sound skipped (chat open):", conversationId);
              } else {
                console.warn("[NOTIF] playing sound");
                void playPortalNotificationSound();

                // Repeat every 15s while unfocused until conversation opened, max 5 repeats.
                if (typeof document !== "undefined" && !document.hasFocus()) {
                  // Reset any previous repeat loop.
                  if (soundRepeatTimerRef.current) clearInterval(soundRepeatTimerRef.current);
                  soundRepeatTimerRef.current = null;
                  soundRepeatCountRef.current = 0;
                  soundRepeatConversationIdRef.current = conversationId || null;
                  console.warn("[NOTIF] start sound repeat loop for:", soundRepeatConversationIdRef.current);

                  soundRepeatTimerRef.current = setInterval(() => {
                    try {
                      const currentOpen = openConversationIdRef.current;
                      const targetId = soundRepeatConversationIdRef.current;
                      const opened = Boolean(currentOpen && targetId && currentOpen === targetId);
                      const focused = document.hasFocus();

                      if (focused) {
                        console.warn("[NOTIF] stop sound repeat (focused)");
                        if (soundRepeatTimerRef.current) clearInterval(soundRepeatTimerRef.current);
                        soundRepeatTimerRef.current = null;
                        soundRepeatConversationIdRef.current = null;
                        soundRepeatCountRef.current = 0;
                        return;
                      }

                      if (opened) {
                        console.warn("[NOTIF] stop sound repeat (conversation opened):", targetId);
                        if (soundRepeatTimerRef.current) clearInterval(soundRepeatTimerRef.current);
                        soundRepeatTimerRef.current = null;
                        soundRepeatConversationIdRef.current = null;
                        soundRepeatCountRef.current = 0;
                        return;
                      }

                      if (soundRepeatCountRef.current >= 5) {
                        console.warn("[NOTIF] stop sound repeat (max repeats reached)");
                        if (soundRepeatTimerRef.current) clearInterval(soundRepeatTimerRef.current);
                        soundRepeatTimerRef.current = null;
                        soundRepeatConversationIdRef.current = null;
                        soundRepeatCountRef.current = 0;
                        return;
                      }

                      if (soundEnabledRef.current) {
                        console.warn("[NOTIF] playing sound (repeat)", soundRepeatCountRef.current + 1, "/ 5");
                        void playPortalNotificationSound();
                      }
                      soundRepeatCountRef.current += 1;
                    } catch (e) {
                      console.warn("[NOTIF] sound repeat loop error:", e);
                      if (soundRepeatTimerRef.current) clearInterval(soundRepeatTimerRef.current);
                      soundRepeatTimerRef.current = null;
                      soundRepeatConversationIdRef.current = null;
                      soundRepeatCountRef.current = 0;
                    }
                  }, 15_000);
                }
              }
            }

            // Browser notification (existing)
            try {
              if (isVisitorMessage && typeof window !== "undefined" && "Notification" in window) {
                if (Notification.permission === "default") {
                  Notification.requestPermission().then((perm) => {
                    if (perm === "granted") {
                      const n = new Notification("Yeni mesaj - Helvion", {
                        body: preview || "Ziyaretçi yeni mesaj gönderdi",
                        tag: conversationId,
                        icon: "/favicon.ico",
                      });
                      n.onclick = () => { try { window.focus(); n.close(); router.push(`/portal/inbox?c=${conversationId}`); } catch { /* */ } };
                    }
                  }).catch(() => {});
                } else if (Notification.permission === "granted") {
                  const n = new Notification("Yeni mesaj - Helvion", {
                    body: preview || "Ziyaretçi yeni mesaj gönderdi",
                    tag: conversationId,
                    icon: "/favicon.ico",
                  });
                  n.onclick = () => { try { window.focus(); n.close(); router.push(`/portal/inbox?c=${conversationId}`); } catch { /* */ } };
                }
              }
            } catch { /* */ }

            // Dispatch events:
            // - `portal-inbox-unread-increment` triggers the sidebar flash state in `PortalLayout`.
            try {
              if (isVisitorMessage) {
                window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh"));
                window.dispatchEvent(new CustomEvent("portal-inbox-badge-pulse"));
                window.dispatchEvent(new CustomEvent("portal-inbox-unread-increment"));
              }
            } catch { /* */ }

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
    void playPortalNotificationSound();
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
