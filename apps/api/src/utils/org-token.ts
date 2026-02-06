/**
 * Organization Token Utilities
 * 
 * Generates and verifies short-lived signed tokens for widget operations.
 * Uses HMAC SHA256 for signing (JWT-like but custom implementation).
 * 
 * Token format: header.payload.signature (all base64url encoded)
 * Payload: { orgId, orgKey, iat, exp }
 * Expiry: 5 minutes
 */

import crypto from "crypto";

const TOKEN_SECRET = process.env.ORG_TOKEN_SECRET;
const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Verify secret is set on boot
if (!TOKEN_SECRET) {
  throw new Error("❌ FATAL: ORG_TOKEN_SECRET environment variable is not set");
}

interface OrgTokenPayload {
  orgId: string;
  orgKey: string;
  iat: number; // Issued at (Unix timestamp in seconds)
  exp: number; // Expiration (Unix timestamp in seconds)
}

/**
 * Base64URL encode (JWT-style encoding)
 */
function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Base64URL decode
 */
function base64urlDecode(str: string): string {
  // Add padding back
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Create HMAC signature
 */
function createSignature(data: string): string {
  const hmac = crypto.createHmac("sha256", TOKEN_SECRET!);
  hmac.update(data);
  return base64urlEncode(hmac.digest().toString("base64"));
}

/**
 * Create a signed org token
 * 
 * @param orgId - Organization ID
 * @param orgKey - Organization key
 * @returns Signed token string (header.payload.signature)
 */
export function createOrgToken(params: { orgId: string; orgKey: string }): string {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: "HS256",
    typ: "OrgToken",
  };

  const payload: OrgTokenPayload = {
    orgId: params.orgId,
    orgKey: params.orgKey,
    iat: now,
    exp: now + Math.floor(TOKEN_EXPIRY_MS / 1000),
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signature = createSignature(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode an org token
 * 
 * @param token - Token string to verify
 * @returns Decoded payload if valid, null if invalid/expired
 */
export function verifyOrgToken(token: string): OrgTokenPayload | null {
  try {
    const parts = token.split(".");
    
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const expectedSignature = createSignature(`${encodedHeader}.${encodedPayload}`);
    if (signature !== expectedSignature) {
      console.warn("⚠️  Invalid org token signature");
      return null;
    }

    // Decode payload
    const payload: OrgTokenPayload = JSON.parse(base64urlDecode(encodedPayload));

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.warn("⚠️  Org token expired", {
        exp: payload.exp,
        now,
        ageSeconds: now - payload.exp,
      });
      return null;
    }

    return payload;
  } catch (error) {
    console.error("❌ Error verifying org token:", error);
    return null;
  }
}

/**
 * Get token expiry time in seconds (for client-side token refresh)
 */
export function getTokenExpiryMs(): number {
  return TOKEN_EXPIRY_MS;
}
