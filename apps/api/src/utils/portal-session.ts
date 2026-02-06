/**
 * Portal session token utilities
 *
 * Uses signed, short JSON payloads stored in a dedicated cookie.
 * Cookie name: helvino_portal_sid
 */

import crypto from "crypto";

export const PORTAL_SESSION_COOKIE = "helvino_portal_sid";
export const PORTAL_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface PortalSessionPayload {
  userId: string;
  orgId: string;
  role: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 ? "=".repeat(4 - (padded.length % 4)) : "";
  return Buffer.from(padded + pad, "base64");
}

function sign(data: string, secret: string): string {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(data).digest());
}

export function createPortalSessionToken(
  payload: Omit<PortalSessionPayload, "iat" | "exp">,
  secret: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + PORTAL_SESSION_TTL_MS) / 1000);
  const fullPayload: PortalSessionPayload = { ...payload, iat: now, exp };

  const header = base64UrlEncode(
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  );
  const body = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload)));
  const signature = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export function verifyPortalSessionToken(
  token: string,
  secret: string
): PortalSessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expected = sign(`${header}.${body}`, secret);
    if (signature !== expected) return null;

    const payload = JSON.parse(base64UrlDecode(body).toString("utf-8"));
    if (!payload || typeof payload !== "object") return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;

    return payload as PortalSessionPayload;
  } catch {
    return null;
  }
}
