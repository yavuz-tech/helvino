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
): Promise<{ ok: boolean; user?: PortalUser; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/portal/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { ok: false, error: data.error || "Login failed" };
    }

    const data = await response.json();
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
