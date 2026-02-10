/**
 * Portal session token utilities
 *
 * Uses signed, short JSON payloads stored in a dedicated cookie.
 * Cookie name: helvino_portal_sid
 */

import crypto from "crypto";
import { prisma } from "../prisma";

export const PORTAL_SESSION_COOKIE = "helvino_portal_sid";
export const PORTAL_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const PORTAL_REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Backward-compatible alias used across routes for cookie max-age.
export const PORTAL_SESSION_TTL_MS = PORTAL_ACCESS_TOKEN_TTL_MS;

interface PortalSessionPayload {
  userId: string;
  orgId: string;
  role: string;
  jti?: string;
  iat: number;
  exp: number;
}

export interface PortalTokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface PortalSessionCreateInput {
  orgUserId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  loginCountry?: string | null;
  loginCity?: string | null;
}

export interface PortalSessionCreateResult {
  revokedSession: {
    id: string;
    deviceName: string | null;
  } | null;
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

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function createPortalSessionToken(
  payload: Omit<PortalSessionPayload, "iat" | "exp">,
  secret: string,
  ttlMs = PORTAL_ACCESS_TOKEN_TTL_MS
): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + ttlMs) / 1000);
  // Include nonce so concurrent logins in same second never share tokenHash.
  const fullPayload: PortalSessionPayload = {
    ...payload,
    jti: payload.jti || base64UrlEncode(crypto.randomBytes(12)),
    iat: now,
    exp,
  };

  const header = base64UrlEncode(
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  );
  const body = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload)));
  const signature = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export function verifyPortalSessionToken(
  token: string,
  secret: string,
  options?: { ignoreExpiration?: boolean }
): PortalSessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expected = sign(`${header}.${body}`, secret);
    if (!safeEqual(signature, expected)) return null;

    const payload = JSON.parse(base64UrlDecode(body).toString("utf-8"));
    if (!payload || typeof payload !== "object") return null;

    const now = Math.floor(Date.now() / 1000);
    if (!options?.ignoreExpiration && payload.exp && now > payload.exp) return null;

    return payload as PortalSessionPayload;
  } catch {
    return null;
  }
}

export function createPortalTokenPair(
  payload: Omit<PortalSessionPayload, "iat" | "exp">,
  secret: string
): PortalTokenPair {
  const accessToken = createPortalSessionToken(payload, secret, PORTAL_ACCESS_TOKEN_TTL_MS);
  return {
    accessToken,
    refreshToken: crypto.randomBytes(48).toString("hex"),
    accessExpiresAt: new Date(Date.now() + PORTAL_ACCESS_TOKEN_TTL_MS),
    refreshExpiresAt: new Date(Date.now() + PORTAL_REFRESH_TOKEN_TTL_MS),
  };
}

export async function createPortalSessionWithLimit(
  input: PortalSessionCreateInput
): Promise<PortalSessionCreateResult> {
  const activeSessions = await prisma.portalSession.findMany({
    where: { orgUserId: input.orgUserId, revokedAt: null },
    orderBy: { lastSeenAt: "asc" },
    select: { id: true, deviceName: true },
  });

  let revokedSession: { id: string; deviceName: string | null } | null = null;
  if (activeSessions.length >= 3) {
    const oldest = activeSessions[0];
    await prisma.portalSession.update({
      where: { id: oldest.id },
      data: { revokedAt: new Date() },
    });
    revokedSession = oldest;
  }

  await prisma.portalSession.create({
    data: {
      orgUserId: input.orgUserId,
      tokenHash: crypto.createHash("sha256").update(input.accessToken).digest("hex"),
      refreshToken: input.refreshToken,
      accessExpiresAt: input.accessExpiresAt,
      refreshExpiresAt: input.refreshExpiresAt,
      ip: input.ip || null,
      userAgent: input.userAgent || null,
      deviceFingerprint: input.deviceFingerprint || null,
      deviceId: input.deviceId || null,
      deviceName: input.deviceName || null,
      loginCountry: input.loginCountry || null,
      loginCity: input.loginCity || null,
    },
  });

  return { revokedSession };
}
