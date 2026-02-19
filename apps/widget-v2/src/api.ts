const API_BASE = import.meta.env.VITE_API_URL || "https://api.helvion.io";

let cachedOrgToken: string | null = null;
let cachedOrgKey: string | null = null;
let cachedSiteId: string | null = null;
let cachedVisitorId: string | null = null;
let tokenFetchedAt = 0; // timestamp (ms) when orgToken was obtained
const TOKEN_REFRESH_MS = 4 * 60 * 1000; // refresh 1 min before 5-min expiry

export function getApiBase(): string {
  return API_BASE;
}

export function getCachedAuth(): {
  siteId: string | null;
  visitorId: string | null;
  orgToken: string | null;
  orgKey: string | null;
} {
  return {
    siteId: cachedSiteId,
    visitorId: cachedVisitorId,
    orgToken: cachedOrgToken,
    orgKey: cachedOrgKey,
  };
}

// Polling/backoff state (getMessages is called frequently by the UI).
let pollDelayMs = 3000; // base: 3s
let nextPollAllowedAt = 0;
let loggedPollingErrorOnce = false;
const lastMessagesCache = new Map<string, ApiMessage[]>();

export type BootloaderResponse = {
  ok: boolean;
  org?: { id: string; key: string; name: string };
  configVersion?: number;
  config?: {
    widgetEnabled?: boolean;
    writeEnabled?: boolean;
    aiEnabled?: boolean;
    language?: string;
    branding?: { widgetName?: string; widgetSubtitle?: string };
    widgetSettings?: Record<string, unknown>;
    chatPageConfig?: {
      title?: string;
      subtitle?: string;
      placeholder?: string;
    };
  };
  // Some callers expect chatPageConfig at top-level (be permissive).
  chatPageConfig?: {
    title?: string;
    subtitle?: string;
    placeholder?: string;
  };
  orgToken?: string;
  timestamp?: string;
  env?: string;
};

export type CreateConversationResponse = {
  id: string;
  createdAt?: string;
  m3Limited?: boolean;
};

export type ApiMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function increaseBackoff(reason: string): void {
  // backoff: 3s -> 6s -> 12s -> 24s -> max 30s
  if (pollDelayMs < 6000) pollDelayMs = 6000;
  else pollDelayMs = Math.min(pollDelayMs * 2, 30000);
  nextPollAllowedAt = Date.now() + pollDelayMs;

  if (!loggedPollingErrorOnce) {
    loggedPollingErrorOnce = true;
    // Avoid console spam: log only the first error in a backoff period.
    console.error("[Widget v2] getMessages polling error:", { reason, nextDelayMs: pollDelayMs });
  }
}

function resetBackoff(): void {
  pollDelayMs = 3000;
  nextPollAllowedAt = 0;
  loggedPollingErrorOnce = false;
}

function assertContext(): {
  siteId: string;
  visitorId: string;
  orgToken: string;
  orgKey: string;
} {
  if (!cachedSiteId) throw new Error("siteId missing");
  if (!cachedVisitorId) throw new Error("visitorId missing");
  if (!cachedOrgToken) throw new Error("orgToken missing");
  if (!cachedOrgKey) throw new Error("orgKey missing");
  return {
    siteId: cachedSiteId,
    visitorId: cachedVisitorId,
    orgToken: cachedOrgToken,
    orgKey: cachedOrgKey,
  };
}

function setContext(partial: { siteId?: string; visitorId?: string; orgToken?: string; orgKey?: string }): void {
  if (partial.siteId) cachedSiteId = partial.siteId;
  if (partial.visitorId) cachedVisitorId = partial.visitorId;
  if (partial.orgToken) cachedOrgToken = partial.orgToken;
  if (partial.orgKey) cachedOrgKey = partial.orgKey;
}

function buildHeaders(
  extra?: Record<string, string>,
  opts?: { requireToken?: boolean }
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cachedSiteId) headers["x-site-id"] = cachedSiteId;
  if (cachedVisitorId) headers["x-visitor-id"] = cachedVisitorId;
  if (cachedOrgKey) headers["x-org-key"] = cachedOrgKey;
  if ((opts?.requireToken ?? false) && cachedOrgToken) headers["x-org-token"] = cachedOrgToken;
  return { ...headers, ...(extra || {}) };
}

async function readJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export async function fetchBootloader(siteId: string): Promise<BootloaderResponse> {
  setContext({ siteId });
  const res = await fetch(`${API_BASE}/api/bootloader?siteId=${encodeURIComponent(siteId)}`, {
    method: "GET",
    headers: {
      "x-site-id": siteId,
    },
  });
  const data = (await readJsonSafe(res)) as BootloaderResponse;
  if (!res.ok) {
    throw new Error((data as any)?.error || `bootloader_failed_${res.status}`);
  }
  if (data?.orgToken) {
    setContext({ orgToken: data.orgToken });
    tokenFetchedAt = Date.now();
  }
  if (data?.org?.key) setContext({ orgKey: data.org.key });
  return data;
}

/**
 * Silently refresh orgToken if it's close to expiry (4 min mark of 5 min TTL).
 * Called before write operations (createConversation, sendMessage) to ensure
 * the token is always fresh. Failures are silent — the existing token might
 * still be valid for another minute.
 */
async function ensureFreshToken(): Promise<void> {
  if (!cachedSiteId || !tokenFetchedAt) return;
  const age = Date.now() - tokenFetchedAt;
  if (age < TOKEN_REFRESH_MS) return; // still fresh
  try {
    console.warn("[Widget v2] Refreshing orgToken (age:", Math.round(age / 1000), "s)");
    await fetchBootloader(cachedSiteId);
  } catch {
    // silent — existing token might still work
  }
}

export async function createConversation(siteId: string, visitorId: string): Promise<CreateConversationResponse> {
  setContext({ siteId, visitorId });
  await ensureFreshToken();
  const { orgToken, orgKey } = assertContext();

  const res = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: {
      ...buildHeaders({ "x-site-id": siteId, "x-visitor-id": visitorId, "x-org-token": orgToken, "x-org-key": orgKey }, { requireToken: true }),
    },
    body: JSON.stringify({ siteId, visitorId, channel: "WEB_WIDGET" }),
  });
  const data = (await readJsonSafe(res)) as CreateConversationResponse | { error?: string };
  if (!res.ok) {
    throw new Error((data as any)?.error || `create_conversation_failed_${res.status}`);
  }
  return data as CreateConversationResponse;
}

export async function sendMessage(conversationId: string, text: string): Promise<ApiMessage> {
  await ensureFreshToken();
  const { siteId, visitorId, orgToken, orgKey } = assertContext();

  const body = {
    // Current API requires role+content; keep extra fields for v2 forward-compat.
    role: "user",
    content: text,
    type: "TEXT",
    sender: "visitor",
  };

  const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: buildHeaders({ "x-site-id": siteId, "x-visitor-id": visitorId, "x-org-token": orgToken, "x-org-key": orgKey }, { requireToken: true }),
    body: JSON.stringify(body),
  });
  const data = (await readJsonSafe(res)) as ApiMessage | { error?: any };
  if (!res.ok) {
    throw new Error((data as any)?.error?.message || (data as any)?.error || `send_message_failed_${res.status}`);
  }
  return data as ApiMessage;
}

export async function getMessages(conversationId: string): Promise<ApiMessage[]> {
  const { siteId, visitorId, orgToken, orgKey } = assertContext();
  const headers = buildHeaders(
    { "x-site-id": siteId, "x-visitor-id": visitorId, "x-org-token": orgToken, "x-org-key": orgKey },
    { requireToken: true }
  );

  // Throttle requests even if caller keeps polling every 3s.
  const now = Date.now();
  if (now < nextPollAllowedAt) {
    // Return cached messages to avoid hammering the server.
    return lastMessagesCache.get(conversationId) || [];
  }

  // NOTE:
  // The API currently does NOT expose GET /conversations/:id/messages for widgets.
  // Instead it exposes GET /conversations/:id which returns { ...conversation, messages: [...] }.
  // Using the correct endpoint avoids hundreds of 404s in the console.
  try {
    // Small jitter to desync multiple tabs (best-effort).
    if (pollDelayMs > 3000) {
      await sleep(Math.floor(Math.random() * 250));
    }

    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}`, {
      method: "GET",
      headers,
    });
    const data = await readJsonSafe(res);
    if (!res.ok) {
      increaseBackoff(`http_${res.status}`);
      return lastMessagesCache.get(conversationId) || [];
    }

    const msgs = Array.isArray((data as any)?.messages) ? ((data as any).messages as ApiMessage[]) : [];
    lastMessagesCache.set(conversationId, msgs);
    resetBackoff();
    return msgs;
  } catch (err) {
    increaseBackoff("network_or_parse");
    return lastMessagesCache.get(conversationId) || [];
  }
}

