const API_BASE = import.meta.env.VITE_API_URL || "https://api.helvion.io";

let cachedOrgToken: string | null = null;
let cachedOrgKey: string | null = null;
let cachedSiteId: string | null = null;
let cachedVisitorId: string | null = null;

export type BootloaderResponse = {
  ok: boolean;
  org?: { id: string; key: string; name: string };
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
  if (data?.orgToken) setContext({ orgToken: data.orgToken });
  if (data?.org?.key) setContext({ orgKey: data.org.key });
  return data;
}

export async function createConversation(siteId: string, visitorId: string): Promise<CreateConversationResponse> {
  setContext({ siteId, visitorId });
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

  // Prefer the requested endpoint; fall back to existing API shape (GET /conversations/:id).
  const preferred = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "GET",
    headers,
  });
  if (preferred.ok) {
    const data = await readJsonSafe(preferred);
    if (Array.isArray(data)) return data as ApiMessage[];
    if (Array.isArray((data as any)?.messages)) return (data as any).messages as ApiMessage[];
    return [];
  }

  // Fallback: GET /conversations/:id returns { ... , messages: [...] }
  const fallback = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}`, {
    method: "GET",
    headers,
  });
  const data = await readJsonSafe(fallback);
  if (!fallback.ok) {
    throw new Error((data as any)?.error || `get_messages_failed_${fallback.status}`);
  }
  return Array.isArray((data as any)?.messages) ? ((data as any).messages as ApiMessage[]) : [];
}

