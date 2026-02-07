/**
 * API utility with debug logging
 * 
 * Supports admin dashboard API calls with:
 * - Session cookie authentication (credentials: "include")
 * - Organization key header (x-org-key) for multi-tenant data access
 * - Request ID extraction from x-request-id response header
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

/**
 * Extract x-request-id from a Response object.
 * Returns null if not present.
 */
export function getRequestId(response: Response): string | null {
  return response.headers.get("x-request-id") || null;
}

/**
 * Parsed API error result.
 */
export interface ParsedApiError {
  message: string;
  requestId: string | null;
  /** If true, this is a rate-limit (429) error */
  isRateLimited: boolean;
  /** Seconds until retry is allowed (present on 429) */
  retryAfterSec: number | null;
  /** Machine-readable error code from API */
  code: string | null;
}

/**
 * Parse an API error response and extract the error message + requestId.
 * Works with both old format { error: "string" } and new envelope { error: { code, message, requestId } }.
 * Detects 429 RATE_LIMITED responses and extracts retryAfterSec.
 */
export async function parseApiError(
  response: Response,
  fallbackMessage?: string
): Promise<ParsedApiError> {
  const requestId = getRequestId(response);
  const retryAfterHeader = response.headers.get("retry-after");
  const isRateLimited = response.status === 429;

  try {
    const data = await response.json();

    // New envelope format: { error: { code, message, requestId, retryAfterSec } }
    if (data.error && typeof data.error === "object") {
      return {
        message: data.error.message || fallbackMessage || `HTTP ${response.status}`,
        requestId: data.error.requestId || requestId,
        isRateLimited,
        retryAfterSec: data.error.retryAfterSec ?? (retryAfterHeader ? parseInt(retryAfterHeader, 10) : null),
        code: data.error.code || null,
      };
    }
    // Old format: { error: "string" }
    if (typeof data.error === "string") {
      return {
        message: data.error,
        requestId,
        isRateLimited,
        retryAfterSec: retryAfterHeader ? parseInt(retryAfterHeader, 10) : null,
        code: null,
      };
    }
    return {
      message: data.message || fallbackMessage || `HTTP ${response.status}`,
      requestId,
      isRateLimited,
      retryAfterSec: retryAfterHeader ? parseInt(retryAfterHeader, 10) : null,
      code: null,
    };
  } catch {
    return {
      message: fallbackMessage || `HTTP ${response.status}`,
      requestId,
      isRateLimited,
      retryAfterSec: retryAfterHeader ? parseInt(retryAfterHeader, 10) : null,
      code: null,
    };
  }
}

export { API_URL };
