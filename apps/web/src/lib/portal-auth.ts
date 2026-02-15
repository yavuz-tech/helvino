/**
 * Customer Portal auth utilities
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PORTAL_REFRESH_TOKEN_STORAGE_KEY = "helvino_portal_refresh_token";
const PORTAL_ONBOARDING_DEFER_STORAGE_KEY = "helvino_portal_onboarding_deferred";
const REQUEST_TIMEOUT_MS = 12000;

// Security: Refresh token is stored ONLY in memory (closure variable).
// This prevents XSS attacks from stealing the long-lived refresh token.
// Trade-off: Full page refresh loses the refresh token, but the httpOnly
// access token cookie (60 min) still maintains the session.
let memoryRefreshToken: string | null = null;
let memoryAccessToken: string | null = null;

function saveRefreshToken(token: string | null) {
  memoryRefreshToken = token;
  // Intentionally NOT persisting to sessionStorage — XSS mitigation.
  // On full page reload, the httpOnly access token cookie handles auth.
  // Clean up any legacy sessionStorage entry:
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(PORTAL_REFRESH_TOKEN_STORAGE_KEY);
    } catch {
      // ignore — may be blocked in some contexts
    }
  }
}

export function storePortalRefreshToken(token: string | null) {
  saveRefreshToken(token);
}

export function storePortalAccessToken(token: string | null) {
  memoryAccessToken = token;
}

export function markPortalOnboardingDeferredForSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PORTAL_ONBOARDING_DEFER_STORAGE_KEY, "1");
}

export function clearPortalOnboardingDeferredForSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PORTAL_ONBOARDING_DEFER_STORAGE_KEY);
}

export function isPortalOnboardingDeferredForSession(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(PORTAL_ONBOARDING_DEFER_STORAGE_KEY) === "1";
}

function readRefreshToken(): string | null {
  // Only read from memory — never from sessionStorage (XSS mitigation).
  return memoryRefreshToken;
}

function readAccessToken(): string | null {
  // Access token in-memory fallback for browsers blocking cross-site cookies.
  return memoryAccessToken;
}

/** Public read-only accessor so Socket.IO auth can attach the token. */
export function getPortalAccessToken(): string | null {
  return memoryAccessToken;
}

export interface PortalUser {
  id: string;
  email: string;
  role: string;
  orgId: string;
  orgKey: string;
  orgName: string;
  planKey?: string;
  mfaEnabled?: boolean;
  showSecurityOnboarding?: boolean;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkPortalAuth(): Promise<PortalUser | null> {
  try {
    const accessToken = readAccessToken();
    let response = await fetchWithTimeout(`${API_URL}/portal/auth/me`, {
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const code = typeof data?.error === "object" ? data.error?.code : undefined;
      // Attempt refresh for any 401 auth miss. Some browsers may drop the short-lived
      // cookie while refresh token is still valid in storage.
      if (response.status === 401) {
        const refreshed = await portalRefreshAccessToken();
        if (!refreshed.ok) return null;
        const refreshedAccessToken = readAccessToken();
        response = await fetchWithTimeout(`${API_URL}/portal/auth/me`, {
          credentials: "include",
          headers: refreshedAccessToken ? { Authorization: `Bearer ${refreshedAccessToken}` } : undefined,
        });
        if (!response.ok) return null;
      } else if (code !== "TOKEN_EXPIRED") {
        return null;
      }
    }
    const data = await response.json();
    if (!data?.user) return null;
    return {
      ...data.user,
      showSecurityOnboarding: Boolean(data.showSecurityOnboarding),
    };
  } catch {
    return null;
  }
}

export async function portalLogin(
  email: string,
  password: string,
  captchaToken?: string,
  device?: { fingerprint?: string; deviceId?: string; deviceName?: string },
  locale?: string,
): Promise<{ ok: boolean; user?: PortalUser; error?: string; errorCode?: string; statusCode?: number; mfaRequired?: boolean; mfaToken?: string; mfaSetupToken?: string; showSecurityOnboarding?: boolean; isRateLimited?: boolean; retryAfterSec?: number; requestId?: string; loginAttempts?: number; refreshToken?: string }> {
  try {
    // New login should re-enable onboarding checks unless user chooses "later" again.
    clearPortalOnboardingDeferredForSession();
    const response = await fetchWithTimeout(`${API_URL}/portal/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, captchaToken, locale, ...device }),
    });

    const data = await response.json();

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = data?.error?.retryAfterSec
        || parseInt(response.headers.get("retry-after") || "30", 10);
      return {
        ok: false,
        error: data?.error?.message || "Too many requests",
        statusCode: 429,
        isRateLimited: true,
        retryAfterSec: retryAfter,
      };
    }

    if (data.mfaRequired) {
      return { ok: false, mfaRequired: true, mfaToken: data.mfaToken };
    }

    if (!response.ok) {
      const msg = typeof data.error === "object" ? data.error.message : data.error;
      const errorCode = typeof data.error === "object" ? data.error.code : undefined;
      const requestId = typeof data.error === "object" ? data.error.requestId : data.requestId;
      const loginAttempts = typeof data.error === "object" ? data.error.loginAttempts : undefined;
      const mfaSetupToken = typeof data.error === "object" ? data.error.mfaSetupToken : undefined;
      return { ok: false, error: msg || "Login failed", errorCode, statusCode: response.status, requestId, loginAttempts, mfaSetupToken };
    }

    if (data.refreshToken) {
      saveRefreshToken(data.refreshToken);
    }
    if (data.accessToken) {
      storePortalAccessToken(data.accessToken);
    }
    return { ok: true, user: data.user, showSecurityOnboarding: Boolean(data.showSecurityOnboarding) };
  } catch {
    return { ok: false, error: "Network error", errorCode: "NETWORK_ERROR" };
  }
}

export async function portalLogout(): Promise<void> {
  try {
    saveRefreshToken(null);
    storePortalAccessToken(null);
    clearPortalOnboardingDeferredForSession();
    await fetchWithTimeout(`${API_URL}/portal/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
}

export async function portalRefreshAccessToken(): Promise<{ ok: boolean; refreshToken?: string }> {
  const refreshToken = readRefreshToken();
  if (!refreshToken) {
    return { ok: false };
  }

  try {
    const response = await fetchWithTimeout(`${API_URL}/portal/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        saveRefreshToken(null);
        storePortalAccessToken(null);
      }
      return { ok: false };
    }
    if (data.refreshToken) {
      saveRefreshToken(data.refreshToken);
    }
    if (data.accessToken) {
      storePortalAccessToken(data.accessToken);
    }
    return { ok: true, refreshToken: data.refreshToken };
  } catch {
    return { ok: false };
  }
}

export async function portalApiFetch(
  path: string,
  options: RequestInit = {}
) {
  const accessToken = readAccessToken();
  let response = await fetchWithTimeout(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    const refreshed = await portalRefreshAccessToken();
    if (refreshed.ok) {
      const refreshedAccessToken = readAccessToken();
      response = await fetchWithTimeout(`${API_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(refreshedAccessToken ? { Authorization: `Bearer ${refreshedAccessToken}` } : {}),
          ...options.headers,
        },
      });
    }
  }
  return response;
}

export { API_URL };
