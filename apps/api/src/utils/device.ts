/**
 * Device fingerprint + MFA policy utilities — Step 11.21
 */

import crypto from "crypto";
import { prisma } from "../prisma";

// ── User-Agent hashing ──

export function hashUserAgent(ua: string): string {
  return crypto.createHash("sha256").update(ua).digest("hex").substring(0, 32);
}

// ── Device upsert on login ──

export async function upsertDevice(
  userId: string,
  userType: "portal" | "admin",
  userAgent: string | undefined,
  ip: string | undefined
) {
  const ua = userAgent || "unknown";
  const uaHash = hashUserAgent(ua);

  try {
    const existing = await prisma.trustedDevice.findUnique({
      where: {
        userId_userType_userAgentHash: {
          userId,
          userType,
          userAgentHash: uaHash,
        },
      },
      select: { id: true },
    });

    const device = await prisma.trustedDevice.upsert({
      where: {
        userId_userType_userAgentHash: {
          userId,
          userType,
          userAgentHash: uaHash,
        },
      },
      update: {
        lastSeenAt: new Date(),
        lastIp: ip?.substring(0, 45) || null,
      },
      create: {
        userId,
        userType,
        userAgentHash: uaHash,
        lastIp: ip?.substring(0, 45) || null,
        userAgentRaw: ua.substring(0, 256),
        trusted: false,
      },
    });
    return { device, isNew: !existing };
  } catch (err) {
    console.error("Device upsert error:", err);
    return { device: null, isNew: false };
  }
}

// ── MFA policy ──

export function isAdminMfaRequired(): boolean {
  const env = process.env.ADMIN_MFA_REQUIRED;
  if (env !== undefined) return env === "true";
  return process.env.NODE_ENV === "production";
}

export function isPortalMfaRecommended(): boolean {
  const env = process.env.PORTAL_MFA_RECOMMENDED;
  if (env !== undefined) return env === "true";
  return true; // default true
}
