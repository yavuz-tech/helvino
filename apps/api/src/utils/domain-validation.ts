/**
 * Domain Validation Utilities
 * 
 * Enhanced domain validation with wildcard support for Origin/Referer checks.
 */

/**
 * Check if a domain matches an allowed pattern
 * @param domain The domain to check (e.g., "app.helvion.io")
 * @param pattern The pattern to match against (supports wildcards, e.g., "*.helvion.io")
 * @returns True if domain matches pattern
 */
export function matchesDomainPattern(domain: string, pattern: string): boolean {
  // Exact match
  if (domain === pattern) {
    return true;
  }

  // Wildcard pattern
  if (pattern.startsWith("*.")) {
    const baseDomain = pattern.slice(2); // Remove "*.
    
    // Match exact subdomain: app.helvion.io matches *.helvion.io
    if (domain.endsWith(`.${baseDomain}`)) {
      return true;
    }
    
    // Also match the base domain itself: helvion.io matches *.helvion.io
    if (domain === baseDomain) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a domain is localhost-related
 * @param domain The domain to check
 * @returns True if domain is localhost or 127.0.0.1
 */
export function isLocalhost(domain: string): boolean {
  const localhostPatterns = [
    "localhost",
    "127.0.0.1",
    "::1",
    "[::1]",
  ];

  // Check exact matches
  if (localhostPatterns.includes(domain)) {
    return true;
  }

  // Check localhost with port
  if (domain.startsWith("localhost:") || domain.startsWith("127.0.0.1:")) {
    return true;
  }

  return false;
}

/**
 * Extract domain from Origin or Referer header
 * @param url Full URL from Origin/Referer header
 * @returns Domain (hostname with port if present)
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Return hostname + port (e.g., "localhost:3000" or "app.helvion.io")
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if a request origin is allowed
 * @param origin Origin or Referer from request headers
 * @param allowedDomains List of allowed domain patterns
 * @param allowLocalhost Whether to allow localhost domains
 * @returns True if origin is allowed
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedDomains: string[],
  allowLocalhost: boolean
): boolean {
  if (!origin) {
    return false; // No origin = not allowed (except in specific cases handled by caller)
  }

  const domain = extractDomain(origin);
  if (!domain) {
    return false; // Invalid origin format
  }

  // Check localhost
  if (isLocalhost(domain)) {
    return allowLocalhost;
  }

  // Check against allowed domains
  for (const pattern of allowedDomains) {
    if (matchesDomainPattern(domain, pattern)) {
      return true;
    }
  }

  return false;
}
