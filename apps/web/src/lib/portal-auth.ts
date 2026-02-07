/**
 * Customer Portal auth utilities
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface PortalUser {
  id: string;
  email: string;
  role: string;
  orgId: string;
  orgKey: string;
  orgName: string;
}

export async function checkPortalAuth(): Promise<PortalUser | null> {
  try {
    const response = await fetch(`${API_URL}/portal/auth/me`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user;
  } catch {
    return null;
  }
}

export async function portalLogin(
  email: string,
  password: string
): Promise<{ ok: boolean; user?: PortalUser; error?: string; errorCode?: string; mfaRequired?: boolean; mfaToken?: string; isRateLimited?: boolean; retryAfterSec?: number; requestId?: string }> {
  try {
    const response = await fetch(`${API_URL}/portal/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = data?.error?.retryAfterSec
        || parseInt(response.headers.get("retry-after") || "30", 10);
      return {
        ok: false,
        error: data?.error?.message || "Too many requests",
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
      return { ok: false, error: msg || "Login failed", errorCode, requestId };
    }

    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function portalLogout(): Promise<void> {
  try {
    await fetch(`${API_URL}/portal/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
}

export async function portalApiFetch(
  path: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return response;
}

export { API_URL };
