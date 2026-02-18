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
  unreadMap: Record<string, number>;
  markConversationRead: (conversationId: string) => void;
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
  unreadMap: {},
  markConversationRead: () => {},
};

const PortalInboxNotificationContext = createContext<PortalInboxNotificationContextValue>(defaultValue);

export function usePortalInboxNotification() {
  return useContext(PortalInboxNotificationContext);
}

// ══════════════════════════════════════════════════════════════════════
// SOUND SYSTEM — persistent AudioContext + old phone ring
// ══════════════════════════════════════════════════════════════════════
// Key: AudioContext must be created/resumed inside a user gesture.
// We create ONE AudioContext on first click/key/touch, then reuse it forever.

let _userHasInteracted = false;
let _audioCtx: AudioContext | null = null;

function _getOrCreateAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      _audioCtx = new Ctor();
      console.warn("[NOTIF] AudioContext created, state:", _audioCtx.state);
    }
    if (_audioCtx.state === "suspended") {
      _audioCtx.resume().catch(() => {});
      console.warn("[NOTIF] AudioContext resumed from suspended");
    }
    return _audioCtx;
  } catch (e) {
    console.warn("[NOTIF] AudioContext create/resume FAIL:", e);
    return null;
  }
}

if (typeof window !== "undefined") {
  const initAudioOnGesture = () => {
    _userHasInteracted = true;
    // Create AudioContext RIGHT INSIDE the user gesture — guaranteed to be "running"
    _getOrCreateAudioCtx();
    document.removeEventListener("click", initAudioOnGesture);
    document.removeEventListener("keydown", initAudioOnGesture);
    document.removeEventListener("touchstart", initAudioOnGesture);
  };
  document.addEventListener("click", initAudioOnGesture);
  document.addEventListener("keydown", initAudioOnGesture);
  document.addEventListener("touchstart", initAudioOnGesture);
}

// ── Old phone ring: "brrring-brrring" ──
// Two-tone (440Hz+480Hz) rapid bursts, like a classic rotary phone.
function playPhoneRing() {
  try {
    const ctx = _getOrCreateAudioCtx();
    if (!ctx) {
      console.warn("[NOTIF] playPhoneRing: no AudioContext");
      return;
    }
    console.warn("[NOTIF] playPhoneRing CALLED, ctx.state:", ctx.state);

    const now = ctx.currentTime;

    // Helper: play a single note at absolute time
    const tone = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    // Ring pattern: 6 rapid ding-dong pairs (like old phone bell)
    // Each pair = high note + low note, very short
    const pairs = [
      // First burst (0.0s - 0.36s)
      { t: 0.00 }, { t: 0.06 }, { t: 0.12 }, { t: 0.18 }, { t: 0.24 }, { t: 0.30 },
      // Second burst after pause (0.50s - 0.86s)
      { t: 0.50 }, { t: 0.56 }, { t: 0.62 }, { t: 0.68 }, { t: 0.74 }, { t: 0.80 },
    ];

    pairs.forEach(({ t }) => {
      tone(880, now + t, 0.05, 0.4);         // high bell
      tone(698.46, now + t + 0.025, 0.05, 0.3); // lower bell (F5)
    });

    console.warn("[NOTIF] phone ring OK — 12 pairs scheduled");
  } catch (e) {
    console.warn("[NOTIF] phone ring FAIL:", e);
  }
}

// ── Ring repeat manager (module-level) ──
// Keeps ringing every RING_INTERVAL until agent opens the conversation.
const _ringingConvs = new Set<string>();
let _ringInterval: ReturnType<typeof setInterval> | null = null;
let _ringRepeatCount = 0;
const RING_INTERVAL_MS = 10_000; // 10 seconds between rings
const MAX_RING_REPEATS = 30;     // ~5 minutes then stop

function _startRinging(conversationId: string) {
  _ringingConvs.add(conversationId);
  _ringRepeatCount = 0;
  if (_ringInterval) return; // interval already running
  _ringInterval = setInterval(() => {
    if (_ringingConvs.size === 0 || _ringRepeatCount >= MAX_RING_REPEATS) {
      _stopAllRinging();
      return;
    }
    // Resume AudioContext (may have been suspended by browser inactivity)
    try { _audioCtx?.resume().catch(() => {}); } catch { /* */ }
    playPhoneRing();
    _ringRepeatCount++;
    console.warn("[NOTIF] ring repeat #" + _ringRepeatCount, "pending convs:", Array.from(_ringingConvs));
  }, RING_INTERVAL_MS);
  console.warn("[NOTIF] ring loop started for:", conversationId);
}

function _stopRingingForConv(conversationId: string) {
  _ringingConvs.delete(conversationId);
  console.warn("[NOTIF] ring stopped for:", conversationId, "remaining:", Array.from(_ringingConvs));
  if (_ringingConvs.size === 0) {
    _stopAllRinging();
  }
}

function _stopAllRinging() {
  if (_ringInterval) {
    clearInterval(_ringInterval);
    _ringInterval = null;
  }
  _ringingConvs.clear();
  _ringRepeatCount = 0;
  console.warn("[NOTIF] all ringing stopped");
}

export function PortalInboxNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = usePortalAuth();
  const router = useRouter();
  const socketRef = useRef<unknown>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const soundEnabledRef = useRef(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [socketStatus, setSocketStatus] = useState("not-initialized");
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null);
  // unreadMap: always initialize with {} to avoid SSR hydration mismatch.
  // sessionStorage is read/written in a SINGLE useEffect (client-only, after hydration).
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const unreadMapLoadedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Portal Notification Context] mounted, user:", user?.email, "orgKey:", user?.orgKey);
    }
  }, [user?.email, user?.orgKey]);

  // Combined read-on-mount + write-on-change effect
  useEffect(() => {
    if (!unreadMapLoadedRef.current) {
      // First run: read from sessionStorage, skip writing {} back
      unreadMapLoadedRef.current = true;
      try {
        const s = sessionStorage.getItem("helvion_unread");
        if (s) {
          const parsed = JSON.parse(s);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            console.warn("[NOTIF] restored unreadMap from sessionStorage:", parsed);
            setUnreadMap(parsed);
            return; // Don't overwrite storage with {} on initial load
          }
        }
      } catch {
        // sessionStorage unavailable
      }
    }
    // Subsequent runs: persist to sessionStorage
    try {
      sessionStorage.setItem("helvion_unread", JSON.stringify(unreadMap));
    } catch {
      // sessionStorage unavailable
    }
  }, [unreadMap]);

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

  // ── Stop ringing when conversation is opened (from inbox click) ──
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const id = (e as CustomEvent).detail?.conversationId;
        if (id) _stopRingingForConv(id);
      } catch { /* */ }
    };
    window.addEventListener("portal-inbox-conversation-opened", handler);
    return () => window.removeEventListener("portal-inbox-conversation-opened", handler);
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
            console.warn("[NOTIF] === message:new EVENT FIRED ===", payload);

            const conversationId = payload?.conversationId || "";
            const role = payload?.message?.role || "";
            const isVisitorMessage = role === "user";
            setLastMessageAt(new Date().toLocaleTimeString());

            // 1. SOUND — phone ring for every visitor message, repeats until conv opened
            if (isVisitorMessage) {
              console.warn("[NOTIF] visitor message → playing phone ring, _userHasInteracted:", _userHasInteracted, "audioCtx state:", _audioCtx?.state);
              try { _audioCtx?.resume().catch(() => {}); } catch { /* */ }
              playPhoneRing();
              if (conversationId) {
                _startRinging(conversationId);
              }
            }

            // 2. Visitor-only: unread tracking + badge + poll
            if (isVisitorMessage) {
              if (conversationId) {
                setUnreadMap(prev => ({
                  ...prev,
                  [conversationId]: (prev[conversationId] || 0) + 1,
                }));
                console.warn("[NOTIF] unreadMap++:", conversationId);
              }

              try {
                window.dispatchEvent(new CustomEvent("helvion-new-message", { detail: payload }));
              } catch { /* */ }
              setTimeout(() => {
                try { window.dispatchEvent(new CustomEvent("portal-inbox-unread-refresh")); } catch { /* */ }
              }, 500);
            }

            // 2. Inbox list update — for ALL messages (visitor + bot/AI)
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
      _stopAllRinging();
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

  const markConversationRead = useCallback((conversationId: string) => {
    console.warn("[INBOX] markConversationRead called with:", conversationId);
    _stopRingingForConv(conversationId);
    setUnreadMap((prev) => {
      console.warn("[INBOX] unreadMap BEFORE:", JSON.stringify(prev));
      const next = { ...prev };
      delete next[conversationId];
      console.warn("[INBOX] unreadMap AFTER delete:", JSON.stringify(next));
      return next;
    });
  }, []);

  const testSound = useCallback(() => {
    playPhoneRing();
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
    unreadMap,
    markConversationRead,
  };

  // ALWAYS render children — provider must never block page content
  return (
    <PortalInboxNotificationContext.Provider value={value}>
      {children}
    </PortalInboxNotificationContext.Provider>
  );
}
