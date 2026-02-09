/**
 * API Service for Helvino Widget
 */

import { getVisitorId } from "./utils/visitor";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Token management state
let cachedOrgToken: string | null = null;
let cachedOrgTokenExp: number | null = null; // Unix timestamp (seconds)
let tokenRefreshPromise: Promise<void> | null = null; // For concurrency control
const requestQueue: Array<() => void> = []; // Queue for requests waiting on token refresh

/**
 * Get site ID from window object (preferred method)
 */
function getSiteId(): string | null {
  return (window as any).HELVINO_SITE_ID || null;
}

/**
 * Get orgKey from window object (legacy support)
 */
function getOrgKey(): string | null {
  return (window as any).HELVINO_ORG_KEY || null;
}

/**
 * Get organization identifier (siteId preferred, orgKey fallback)
 * @returns Object with either siteId or orgKey
 */
function getOrgIdentifier(): { siteId?: string; orgKey?: string } {
  const siteId = getSiteId();
  const orgKey = getOrgKey();

  if (!siteId && !orgKey) {
    console.error("Neither HELVINO_SITE_ID nor HELVINO_ORG_KEY is set on window object");
    throw new Error("Organization identifier not configured");
  }

  return siteId ? { siteId } : { orgKey: orgKey! };
}

/**
 * Parse token payload to extract expiration time
 */
function parseTokenExpiration(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    // Add padding for base64 decode
    let paddedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (paddedPayload.length % 4) {
      paddedPayload += "=";
    }

    const decoded = JSON.parse(atob(paddedPayload));
    return decoded.exp || null;
  } catch (error) {
    console.error("Failed to parse token expiration:", error);
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 */
function isTokenExpiredOrExpiring(): boolean {
  if (!cachedOrgToken || !cachedOrgTokenExp) {
    return true; // No token = needs refresh
  }

  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = 15; // Refresh if token expires within 15 seconds

  return cachedOrgTokenExp - now <= bufferSeconds;
}

/**
 * Refresh org token from bootloader
 */
async function refreshOrgToken(): Promise<void> {
  // If refresh already in progress, wait for it
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  // Start new refresh
  tokenRefreshPromise = (async () => {
    try {
      console.log("🔄 Refreshing org token...");
      
      const identifier = getOrgIdentifier();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-visitor-id": getVisitorId(),
      };
      
      // Use siteId (preferred) or orgKey (legacy)
      if (identifier.siteId) {
        headers["x-site-id"] = identifier.siteId;
      } else if (identifier.orgKey) {
        headers["x-org-key"] = identifier.orgKey;
      }
      
      const response = await fetch(`${API_URL}/api/bootloader`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Bootloader failed: ${response.status}`);
      }

      const config: BootloaderConfig = await response.json();
      
      if (!config.orgToken) {
        throw new Error("No orgToken in bootloader response");
      }

      // Parse expiration from token
      const exp = parseTokenExpiration(config.orgToken);
      if (!exp) {
        throw new Error("Could not parse token expiration");
      }

      // Update cached token
      cachedOrgToken = config.orgToken;
      cachedOrgTokenExp = exp;

      console.log(`✅ Org token refreshed, expires at ${new Date(exp * 1000).toISOString()}`);

      // Flush queued requests
      const queuedResolvers = [...requestQueue];
      requestQueue.length = 0; // Clear queue
      queuedResolvers.forEach((resolve) => resolve());
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      
      // Clear queued requests (they will timeout/fail naturally)
      requestQueue.length = 0;
      
      throw error;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
}

/**
 * Ensure we have a valid token before making a POST request
 */
async function ensureValidToken(): Promise<void> {
  if (isTokenExpiredOrExpiring()) {
    // Need to refresh token
    if (tokenRefreshPromise) {
      // Refresh already in progress, queue this request
      return new Promise<void>((resolve) => {
        requestQueue.push(resolve);
      }).then(() => {
        // After refresh completes, check if we actually got a token
        if (!cachedOrgToken) {
          throw new Error("Token refresh failed");
        }
      });
    } else {
      // Start refresh
      await refreshOrgToken();
    }
  }
}

// Get common headers for all API requests
function getHeaders(options?: { useOrgToken?: boolean }): Record<string, string> {
  const identifier = getOrgIdentifier();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-visitor-id": getVisitorId(),
  };

  // Add organization identifier (siteId preferred, orgKey legacy)
  if (identifier.siteId) {
    headers["x-site-id"] = identifier.siteId;
  } else if (identifier.orgKey) {
    headers["x-org-key"] = identifier.orgKey;
  }

  // Add org token for write operations (POST requests)
  if (options?.useOrgToken && cachedOrgToken) {
    headers["x-org-token"] = cachedOrgToken;
  }

  return headers;
}

// Set org token (called after bootloader loads)
export function setOrgToken(token: string): void {
  cachedOrgToken = token;
  cachedOrgTokenExp = parseTokenExpiration(token);
  
  if (cachedOrgTokenExp) {
    console.log(`✅ Org token cached, expires at ${new Date(cachedOrgTokenExp * 1000).toISOString()}`);
  } else {
    console.warn("⚠️  Could not parse token expiration");
  }
}

// Get org token (for debugging/internal use)
export function getOrgToken(): string | null {
  return cachedOrgToken;
}

// Get token expiration (for debugging/internal use)
export function getOrgTokenExpiration(): number | null {
  return cachedOrgTokenExp;
}

// Check if token refresh is in progress (for UI state)
export function isTokenRefreshing(): boolean {
  return tokenRefreshPromise !== null;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  createdAt: string;
}

export interface BootloaderConfig {
  ok: boolean;
  org: {
    id: string;
    key: string;
    name: string;
  };
  config: {
    widgetEnabled: boolean;
    writeEnabled: boolean;
    aiEnabled: boolean;
    language: string;
    theme: {
      primaryColor: string;
    };
    /** Server-enforced entitlement: true = branding must be shown */
    brandingRequired?: boolean;
    /** Max agents allowed by plan (server-authoritative) */
    maxAgents?: number;
    /** true if widget is loaded from an unauthorized domain */
    unauthorizedDomain?: boolean;
  };
  orgToken: string; // Short-lived signed token for write operations
  env: string;
  timestamp: string;
}

/**
 * Create a new conversation
 */
export async function createConversation(): Promise<Conversation> {
  const url = `${API_URL}/conversations`;
  console.log("[Widget API] createConversation called", { url, hasToken: !!getOrgToken() });

  // Ensure we have a valid token (auto-refresh if needed)
  await ensureValidToken();

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders({ useOrgToken: true }), // Use org token for write operation
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to create conversation" }));
    console.error("[Widget API] createConversation failed", { status: response.status, url, error });
    const message =
      typeof error.error === "string"
        ? error.error
        : error.error?.message || "Failed to create conversation";
    throw new Error(message);
  }

  const data = await response.json();
  console.log("[Widget API] createConversation success", { conversationId: data?.id });
  return data;
}

/**
 * Send a message to a conversation
 */
export async function sendMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  const url = `${API_URL}/conversations/${conversationId}/messages`;
  console.log("[Widget API] sendMessage called", { url, conversationId, hasToken: !!getOrgToken() });

  // Ensure we have a valid token (auto-refresh if needed)
  await ensureValidToken();

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders({ useOrgToken: true }), // Use org token for write operation
    body: JSON.stringify({
      role: "user",
      content,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to send message" }));
    console.error("[Widget API] sendMessage failed", { status: response.status, url, error });
    const message =
      typeof error.error === "string"
        ? error.error
        : error.error?.message || "Failed to send message";
    throw new Error(message);
  }

  const data = await response.json();
  console.log("[Widget API] sendMessage success", { messageId: data?.id });
  return data;
}

/**
 * Load bootloader configuration
 */
export async function loadBootloader(): Promise<BootloaderConfig> {
  // Build bootloader URL with parentHost for domain validation
  let bootloaderUrl = `${API_URL}/api/bootloader`;
  const parentHost = (window as any).HELVINO_PARENT_HOST;
  if (parentHost) {
    bootloaderUrl += `?parentHost=${encodeURIComponent(parentHost)}`;
  }

  const response = await fetch(bootloaderUrl, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to load bootloader config");
  }

  return response.json();
}

/**
 * Request AI help for a conversation (on-demand trigger)
 */
export async function requestAiHelp(conversationId: string): Promise<{ ok: boolean; message?: Message }> {
  const url = `${API_URL}/conversations/${conversationId}/ai-help`;
  console.log("[Widget API] requestAiHelp called", { conversationId });

  await ensureValidToken();

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders({ useOrgToken: true }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "AI help unavailable" }));
    console.error("[Widget API] requestAiHelp failed", { status: response.status, error });
    throw new Error(typeof error.error === "string" ? error.error : "AI help unavailable");
  }

  return response.json();
}

export { API_URL, getOrgKey };
