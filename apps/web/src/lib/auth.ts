/**
 * Auth utilities for admin dashboard
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  ok: boolean;
  user?: AdminUser;
  error?: string;
}

/**
 * Check if the current user is authenticated
 * Returns user info if authenticated, null otherwise
 */
export async function checkAuth(): Promise<AdminUser | null> {
  try {
    const response = await fetch(`${API_URL}/internal/auth/me`, {
      credentials: "include", // Important: Send cookies
    });

    if (!response.ok) {
      return null;
    }

    const data: AuthResponse = await response.json();
    return data.user || null;
  } catch (error) {
    console.error("Auth check failed:", error);
    return null;
  }
}

/**
 * Logout the current user
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/internal/auth/logout`, {
      method: "POST",
      credentials: "include", // Important: Send cookies
    });
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

/**
 * Fetch with credentials (includes cookies)
 * Use this for authenticated API requests
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include", // Always include cookies
    headers: {
      ...options?.headers,
      // No need for x-internal-key anymore!
    },
  });
}
