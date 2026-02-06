/**
 * API utility with debug logging
 * 
 * Supports admin dashboard API calls with:
 * - Session cookie authentication (credentials: "include")
 * - Organization key header (x-org-key) for multi-tenant data access
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Store for logging callback (set by DebugContext consumer)
let logRequestCallback: ((method: string, path: string, status: number | null) => void) | null = null;

export function setDebugLogger(logger: (method: string, path: string, status: number | null) => void) {
  logRequestCallback = logger;
}

interface ApiFetchOptions extends RequestInit {
  orgKey?: string; // Optional org key for multi-tenant requests
}

/**
 * Fetch wrapper that logs requests to debug panel
 * 
 * ADMIN AUTHENTICATION:
 * - Includes credentials (session cookie) with every request
 * - This allows admin-authenticated POST requests to bypass org token requirement
 * - See API middleware: require-org-token.ts (admin session bypass)
 * 
 * MULTI-ORG SUPPORT:
 * - Pass `orgKey` in options to set x-org-key header
 * - Required for tenant-specific data access (conversations, messages, settings)
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const method = options.method || "GET";
  const url = `${API_URL}${path}`;
  const { orgKey, ...fetchOptions } = options;

  // Log request start
  if (logRequestCallback) {
    logRequestCallback(method, path, null);
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...fetchOptions.headers as Record<string, string>,
    };

    // Add org key header if provided (for multi-tenant data access)
    if (orgKey) {
      headers["x-org-key"] = orgKey;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      credentials: "include", // CRITICAL: Send session cookie for admin auth
      headers,
    });

    // Log request complete
    if (logRequestCallback) {
      logRequestCallback(method, path, response.status);
    }

    return response;
  } catch (error) {
    // Log request error
    if (logRequestCallback) {
      logRequestCallback(method, path, 0);
    }
    throw error;
  }
}

export { API_URL };
