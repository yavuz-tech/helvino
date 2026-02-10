/**
 * Customer Portal auth utilities
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PORTAL_REFRESH_TOKEN_STORAGE_KEY = "helvino_portal_refresh_token";
const REQUEST_TIMEOUT_MS = 12000;

let memoryRefreshToken: string | null = null;

function saveRefreshToken(token: string | null) {
  memoryRefreshToken = token;
  if (typeof window === "undefined") return;
  if (!token) {
    window.sessionStorage.removeItem(PORTAL_REFRESH_TOKEN_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(PORTAL_REFRESH_TOKEN_STORAGE_KEY, token);
}

export function storePortalRefreshToken(token: string | null) {
  saveRefreshToken(token);
}

function readRefreshToken(): string | null {
  if (memoryRefreshToken) return memoryRefreshToken;
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(PORTAL_REFRESH_TOKEN_STORAGE_KEY);
  if (stored) {
    memoryRefreshToken = stored;
    return stored;
  }
  return null;
}

export interface PortalUser {
  id: string;
  email: string;
  role: string;
  orgId: string;
  orgKey: string;
  orgName: string;
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
    let response = await fetchWithTimeout(`${API_URL}/portal/auth/me`, {
      credentials: "include",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const code = typeof data?.error === "object" ? data.error?.code : undefined;
      if (response.status === 401 && code === "TOKEN_EXPIRED") {
        const refreshed = await portalRefreshAccessToken();
        if (!refreshed.ok) return null;
        response = await fetchWithTimeout(`${API_URL}/portal/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) return null;
      } else {
        return null;
      }
    }
    const data = await response.json();
    return data.user;
  } catch {
    return null;
  }
}

export async function portalLogin(
  email: string,
  password: string,
  captchaToken?: string,
  device?: { fingerprint?: string; deviceId?: string; deviceName?: string }
): Promise<{ ok: boolean; user?: PortalUser; error?: string; errorCode?: string; statusCode?: number; mfaRequired?: boolean; mfaToken?: string; mfaSetupToken?: string; showSecurityOnboarding?: boolean; isRateLimited?: boolean; retryAfterSec?: number; requestId?: string; loginAttempts?: number; refreshToken?: string }> {
  try {
    const response = await fetchWithTimeout(`${API_URL}/portal/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, captchaToken, ...device }),
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
    return { ok: true, user: data.user, showSecurityOnboarding: Boolean(data.showSecurityOnboarding) };
  } catch {
    return { ok: false, error: "Network error", errorCode: "NETWORK_ERROR" };
  }
}

export async function portalLogout(): Promise<void> {
  try {
    saveRefreshToken(null);
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
      }
      return { ok: false };
    }
    if (data.refreshToken) {
      saveRefreshToken(data.refreshToken);
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
  let response = await fetchWithTimeout(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (response.status === 401) {
    const data = await response.clone().json().catch(() => null);
    const code = typeof data?.error === "object" ? data.error?.code : undefined;
    if (code === "TOKEN_EXPIRED") {
      const refreshed = await portalRefreshAccessToken();
      if (refreshed.ok) {
        response = await fetchWithTimeout(`${API_URL}${path}`, {
          ...options,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
        });
      }
    }
  }
  return response;
}

export { API_URL };
