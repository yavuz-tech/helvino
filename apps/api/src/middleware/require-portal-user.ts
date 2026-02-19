/**
 * Portal auth middleware
 *
 * Ensures the request has a valid portal session (customer portal).
 * Checks session revocation and updates lastSeenAt.
 */

import crypto from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  getPortalCookiePolicy,
  verifyPortalSessionToken,
  PORTAL_SESSION_TTL_MS,
} from "../utils/portal-session";

declare module "fastify" {
  interface FastifyRequest {
    portalUser?: {
      id: string;
      orgId: string;
      email: string;
      role: string;
    };
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requirePortalUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return reply.status(500).send({ error: "SESSION_SECRET not configured" });
  }

  const authHeader = request.headers.authorization;
  const bearer =
    typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice("bearer ".length).trim()
      : null;

  const cookieToken = request.cookies[PORTAL_SESSION_COOKIE] || null;
  if (!bearer && !cookieToken) {
    return reply.status(401).send({ error: "Authentication required" });
  }

  // Prefer bearer when present, but fall back to cookie if bearer is stale/invalid.
  // This prevents transient "works after refresh" bugs when a stale in-memory token
  // overrides a still-valid cookie session.
  const now = Math.floor(Date.now() / 1000);
  const candidates = [bearer, cookieToken].filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  let selectedToken: string | null = null;
  let selectedPayload: any | null = null;
  let anyTokenExpired = false;
  for (const candidate of candidates) {
    const payload = verifyPortalSessionToken(candidate, secret, { ignoreExpiration: true });
    if (!payload) continue;
    if (payload.exp && now > payload.exp) {
      anyTokenExpired = true;
      continue;
    }
    selectedToken = candidate;
    selectedPayload = payload;
    break;
  }
  if (!selectedToken || !selectedPayload) {
    // Only clear cookie when the cookie-backed session is actually invalid/expired.
    // If the bearer was invalid but the cookie is still valid, we should not log the user out.
    if (cookieToken) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    }
    if (anyTokenExpired) {
      return reply.status(401).send({ error: { code: "TOKEN_EXPIRED", message: "token_expired" } });
    }
    return reply.status(401).send({ error: "Invalid session" });
  }

  // Check session revocation in DB
  const tokenHash = hashToken(selectedToken);
  const sessionRecord = await prisma.portalSession.findUnique({
    where: { tokenHash },
    select: { id: true, orgUserId: true, revokedAt: true, accessExpiresAt: true },
  });

  // Reject tokens that are not backed by a live DB session record.
  if (!sessionRecord || sessionRecord.revokedAt || sessionRecord.orgUserId !== selectedPayload.userId) {
    // Only clear cookie if we're actually using the cookie-backed token.
    if (selectedToken === cookieToken) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    }
    return reply.status(401).send({ error: "Invalid session" });
  }
  if (sessionRecord.accessExpiresAt <= new Date()) {
    return reply.status(401).send({ error: { code: "TOKEN_EXPIRED", message: "token_expired" } });
  }

  // Rolling access cookie refresh:
  // - prevents "Authentication required" while the user is actively using the portal
  // - only rotates when the cookie-based token is used (do NOT invalidate bearer tokens)
  try {
    const isUsingCookieToken = selectedToken === cookieToken;
    if (isUsingCookieToken) {
      const msLeft = sessionRecord.accessExpiresAt.getTime() - Date.now();
      const ROTATE_WHEN_LEFT_MS = 30 * 60 * 1000; // 30 minutes
      if (msLeft > 0 && msLeft < ROTATE_WHEN_LEFT_MS) {
        const newAccessToken = createPortalSessionToken(
          { userId: selectedPayload.userId, orgId: selectedPayload.orgId, role: selectedPayload.role },
          secret,
          PORTAL_SESSION_TTL_MS
        );
        const newHash = hashToken(newAccessToken);
        const newAccessExpiresAt = new Date(Date.now() + PORTAL_SESSION_TTL_MS);

        // Best-effort rotate: if it fails, keep the old session valid.
        await prisma.portalSession.update({
          where: { id: sessionRecord.id },
          data: {
            tokenHash: newHash,
            accessExpiresAt: newAccessExpiresAt,
            lastSeenAt: new Date(),
          },
        });

        const { sameSite, secure } = getPortalCookiePolicy({
          requestOrigin: (request.headers.origin as string | undefined) || null,
          requestHost: (request.headers.host as string | undefined) || null,
        });
        reply.setCookie(PORTAL_SESSION_COOKIE, newAccessToken, {
          path: "/",
          httpOnly: true,
          sameSite,
          secure,
          maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
        });
      }
    }
  } catch {
    // non-fatal — never block API requests because rotation failed
  }

  // Update lastSeenAt (best-effort, don't block)
  prisma.portalSession.update({
    where: { id: sessionRecord.id },
    data: { lastSeenAt: new Date() },
  }).catch(() => {/* ignore */});

  const orgUser = await prisma.orgUser.findUnique({
    where: { id: selectedPayload.userId },
  });

  if (!orgUser) {
    if (selectedToken === cookieToken) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    }
    return reply.status(401).send({ error: "User not found" });
  }

  if (orgUser.isActive === false) {
    if (selectedToken === cookieToken) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    }
    return reply.status(403).send({ error: "Account is deactivated" });
  }

  if (orgUser.orgId !== selectedPayload.orgId) {
    if (selectedToken === cookieToken) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    }
    return reply.status(401).send({ error: "Invalid session" });
  }

  // ── Check organization is active (admin deactivation enforcement) ──
  const org = await prisma.organization.findUnique({
    where: { id: orgUser.orgId },
    select: { isActive: true },
  });
  if (!org || org.isActive === false) {
    reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    return reply.status(403).send({
      error: "Organization is deactivated",
      code: "ORG_DEACTIVATED",
    });
  }

  request.portalUser = {
    id: orgUser.id,
    orgId: orgUser.orgId,
    email: orgUser.email,
    role: orgUser.role,
  };
}

export function requirePortalRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.portalUser;
    if (!user) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        error: "Insufficient permissions",
        required: allowedRoles,
        current: user.role,
      });
    }
  };
}
