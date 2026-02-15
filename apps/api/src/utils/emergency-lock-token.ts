import crypto from "crypto";
import { redis } from "../redis";

interface EmergencyLockPayload {
  userId: string;
  exp: number;
}

const CONSUMED_PREFIX = "emg:consumed:";

function getSecret(): string {
  const secret = process.env.SIGNED_LINK_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "CRITICAL: SIGNED_LINK_SECRET or SESSION_SECRET environment variable is required for emergency lock tokens"
    );
  }
  return secret;
}

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 ? "=".repeat(4 - (padded.length % 4)) : "";
  return Buffer.from(padded + pad, "base64");
}

function sign(data: string): string {
  return base64UrlEncode(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

export function createEmergencyLockToken(userId: string, ttlMs = 60 * 60 * 1000): string {
  const payload: EmergencyLockPayload = {
    userId,
    exp: Math.floor((Date.now() + ttlMs) / 1000),
  };
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyEmergencyLockToken(token: string): EmergencyLockPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    const expected = sign(encoded);
    if (expected.length !== signature.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
    const payload = JSON.parse(base64UrlDecode(encoded).toString("utf-8")) as EmergencyLockPayload;
    if (!payload?.userId || !payload?.exp) return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Mark an emergency lock token as consumed (single-use enforcement).
 * Returns `true` if this is the first consumption, `false` if already used.
 * Uses Redis NX to ensure atomicity across instances.
 */
export async function markEmergencyTokenConsumed(token: string): Promise<boolean> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const key = `${CONSUMED_PREFIX}${tokenHash}`;
  const TTL_SECONDS = 2 * 60 * 60; // 2h (slightly longer than token TTL for safety)

  try {
    if (redis.status === "ready") {
      const result = await redis.set(key, "1", "EX", TTL_SECONDS, "NX");
      return result === "OK"; // "OK" = first time, null = already consumed
    }
  } catch {
    // Redis unavailable — fall through to allow usage (fail-open for emergency)
  }
  return true;
}
