import crypto from "crypto";

interface EmergencyLockPayload {
  userId: string;
  exp: number;
}

function getSecret(): string {
  return process.env.SIGNED_LINK_SECRET || process.env.SESSION_SECRET || "dev-emergency-lock-secret";
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
