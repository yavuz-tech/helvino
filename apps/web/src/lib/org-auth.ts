/**
 * Org User Authentication Utilities (Customer Portal)
 * 
 * Separate from internal admin auth to avoid session conflicts
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface OrgUser {
  id: string;
  email: string;
  role: string;
  orgId: string;
  orgKey: string;
  orgName: string;
}

/**
 * Check if org user is authenticated (customer portal)
 * 
 * Returns user data if authenticated, null otherwise
 */
export async function checkOrgAuth(): Promise<OrgUser | null> {
  try {
    const response = await fetch(`${API_URL}/org/auth/me`, {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error("Org auth check failed:", error);
    return null;
  }
}

/**
 * Login org user (customer portal)
 */
export async function orgLogin(email: string, password: string): Promise<{
  ok: boolean;
  user?: OrgUser;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_URL}/org/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      return {
        ok: false,
        error: data.error || "Login failed",
      };
    }

    const data = await response.json();
    return {
      ok: true,
      user: data.user,
    };
  } catch (error) {
    console.error("Org login failed:", error);
    return {
      ok: false,
      error: "Network error",
    };
  }
}

/**
 * Logout org user (customer portal)
 */
export async function orgLogout(): Promise<void> {
  try {
    await fetch(`${API_URL}/org/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Org logout failed:", error);
  }
}

/**
 * Org API fetch wrapper (customer portal)
 * 
 * All requests:
 * - Include session cookie (credentials: "include")
 * - Scoped to org user's organization automatically via session
 */
export async function orgApiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include", // Send session cookie
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  return response;
}

export { API_URL };
