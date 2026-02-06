/**
 * Site ID generation utilities
 * 
 * Generates public site identifiers for widget embedding.
 * Format: site_ + random string (similar to Crisp/Intercom)
 */

import crypto from "crypto";

/**
 * Generate a new site ID
 * @returns Site ID in format: site_xxxxxxxxxxxxxxxx
 */
export function generateSiteId(): string {
  // Generate 16 bytes of random data
  const randomBytes = crypto.randomBytes(16);
  
  // Convert to base62-like string (using alphanumeric only)
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  
  for (let i = 0; i < randomBytes.length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return `site_${result}`;
}

/**
 * Validate site ID format
 * @param siteId Site ID to validate
 * @returns True if valid format
 */
export function isValidSiteId(siteId: string): boolean {
  // Must start with "site_" and be followed by alphanumeric characters
  return /^site_[0-9a-zA-Z]{16,32}$/.test(siteId);
}
