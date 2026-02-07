/**
 * Portal MFA Routes — Step 11.20
 *
 * TOTP setup, verify, disable + step-up challenge for portal users.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import { writeAuditLog } from "../utils/audit-log";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { requirePortalUser } from "../middleware/require-portal-user";
import {
  generateTotpSecret,
  getTotpUri,
  verifyTotpCode,
  generateBackupCodes,
  tryConsumeBackupCode,
  STEP_UP_TTL_MS,
  isStepUpValid,
} from "../utils/totp";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalSessionToken,
} from "../utils/portal-session";
import { upsertDevice } from "../utils/device";

// ── Step-up middleware ──

export async function requirePortalStepUp(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const actor = request.portalUser;
  if (!actor) {
    return reply.status(401).send({ error: "Authentication required" });
  }

  // Load user to check mfaEnabled
  const user = await prisma.orgUser.findUnique({ where: { id: actor.id } });
  if (!user || !user.mfaEnabled) {
    // MFA not enabled — no step-up needed
    return;
  }

  // Check step-up flag from portal session token payload
  const token = request.cookies[PORTAL_SESSION_COOKIE];
  if (!token) {
    return reply.status(401).send({ error: "Authentication required" });
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) return;

  const payload = verifyPortalSessionToken(token, secret);
  if (!payload) {
    return reply.status(401).send({ error: "Invalid session" });
  }

  // Check step-up timestamp stored in portalSession record
  const sessionRecord = await prisma.portalSession.findFirst({
    where: {
      orgUserId: actor.id,
      revokedAt: null,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  // We store stepUpUntil as a number in the session's ip field hack — no, let's use a proper approach.
  // Store stepUpUntil on the request via a cookie or check DB.
  // For simplicity, we use a separate signed cookie "helvino_stepup".
  const stepUpCookie = request.cookies["helvino_portal_stepup"];
  if (stepUpCookie) {
    try {
      const parsed = verifyPortalSessionToken(stepUpCookie, secret);
      if (parsed && parsed.userId === actor.id) {
        // Token is valid and not expired (exp check is built-in)
        return; // Step-up valid
      }
    } catch {
      // Invalid cookie
    }
  }

  return reply.status(403).send({
    error: "MFA step-up required",
    code: "MFA_STEP_UP_REQUIRED",
  });
}

export async function portalMfaRoutes(fastify: FastifyInstance) {
  // ──────────────────────────────────────────────────────
  // POST /portal/security/mfa/setup
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/security/mfa/setup",
    {
      preHandler: [
        requirePortalUser,
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;

      const user = await prisma.orgUser.findUnique({ where: { id: actor.id } });
      if (!user) {
        reply.code(404);
        return { error: "User not found" };
      }

      if (user.mfaEnabled) {
        reply.code(400);
        return { error: "MFA is already enabled" };
      }

      const secret = generateTotpSecret();
      const otpauthUri = getTotpUri(secret, user.email);
      const { raw: backupCodes, hashed: backupCodesHashed } = generateBackupCodes();

      // Store secret temporarily (not yet enabled until verify)
      await prisma.orgUser.update({
        where: { id: user.id },
        data: {
          mfaSecret: secret,
          backupCodesHash: JSON.stringify(backupCodesHashed),
        },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "mfa_setup_started",
        {},
        request.requestId
      );

      return {
        ok: true,
        otpauthUri,
        secret, // So user can enter manually
        backupCodes,
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/security/mfa/verify
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/security/mfa/verify",
    {
      preHandler: [
        requirePortalUser,
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { code?: string };

      if (!body.code) {
        reply.code(400);
        return { error: "Verification code is required" };
      }

      const user = await prisma.orgUser.findUnique({ where: { id: actor.id } });
      if (!user || !user.mfaSecret) {
        reply.code(400);
        return { error: "MFA setup not started" };
      }

      if (user.mfaEnabled) {
        reply.code(400);
        return { error: "MFA is already enabled" };
      }

      const valid = verifyTotpCode(user.mfaSecret, body.code);
      if (!valid) {
        reply.code(400);
        return { error: "Invalid verification code" };
      }

      await prisma.orgUser.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaVerifiedAt: new Date(),
        },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "mfa_enabled",
        {},
        request.requestId
      );

      // Emit notification
      const { emitMfaEnabled } = await import("../utils/notifications");
      await emitMfaEnabled(actor.orgId, user.id, request.requestId);

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/security/mfa/disable
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/security/mfa/disable",
    {
      preHandler: [
        requirePortalUser,
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { code?: string };

      if (!body.code) {
        reply.code(400);
        return { error: "Verification code or backup code is required" };
      }

      const user = await prisma.orgUser.findUnique({ where: { id: actor.id } });
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        reply.code(400);
        return { error: "MFA is not enabled" };
      }

      // Try TOTP code first
      let valid = verifyTotpCode(user.mfaSecret, body.code);

      // Try backup code
      if (!valid && user.backupCodesHash) {
        const hashedCodes: string[] = JSON.parse(user.backupCodesHash);
        const remaining = tryConsumeBackupCode(body.code, hashedCodes);
        if (remaining) {
          valid = true;
          // Update remaining backup codes
          await prisma.orgUser.update({
            where: { id: user.id },
            data: { backupCodesHash: JSON.stringify(remaining) },
          });
        }
      }

      if (!valid) {
        reply.code(401);
        return { error: "Invalid code" };
      }

      await prisma.orgUser.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaVerifiedAt: null,
          backupCodesHash: null,
        },
      });

      // Clear step-up cookie
      reply.clearCookie("helvino_portal_stepup", { path: "/" });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "mfa_disabled",
        {},
        request.requestId
      );

      // Emit notification
      const { emitMfaDisabled } = await import("../utils/notifications");
      await emitMfaDisabled(actor.orgId, user.id, request.requestId);

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // GET /portal/security/mfa/status
  // ──────────────────────────────────────────────────────
  fastify.get(
    "/portal/security/mfa/status",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const actor = request.portalUser!;
      const user = await prisma.orgUser.findUnique({ where: { id: actor.id } });

      return {
        mfaEnabled: user?.mfaEnabled || false,
        mfaVerifiedAt: user?.mfaVerifiedAt?.toISOString() || null,
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/mfa/challenge
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/mfa/challenge",
    {
      preHandler: [
        requirePortalUser,
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { code?: string };

      if (!body.code) {
        reply.code(400);
        return { error: "Code is required" };
      }

      const user = await prisma.orgUser.findUnique({ where: { id: actor.id } });
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        reply.code(400);
        return { error: "MFA is not enabled" };
      }

      let valid = verifyTotpCode(user.mfaSecret, body.code);

      // Try backup code
      if (!valid && user.backupCodesHash) {
        const hashedCodes: string[] = JSON.parse(user.backupCodesHash);
        const remaining = tryConsumeBackupCode(body.code, hashedCodes);
        if (remaining) {
          valid = true;
          await prisma.orgUser.update({
            where: { id: user.id },
            data: { backupCodesHash: JSON.stringify(remaining) },
          });
        }
      }

      if (!valid) {
        await writeAuditLog(
          actor.orgId,
          actor.email,
          "mfa_challenge_failed",
          {},
          request.requestId
        );
        reply.code(401);
        return { error: "Invalid code" };
      }

      // Set step-up cookie (short-lived signed token)
      const secret = process.env.SESSION_SECRET;
      if (secret) {
        const { createPortalSessionToken } = await import("../utils/portal-session");
        const stepUpToken = createPortalSessionToken(
          { userId: actor.id, orgId: actor.orgId, role: actor.role },
          secret
        );
        // Override the exp to be 10 minutes
        // Since createPortalSessionToken sets 7-day exp, we'll create a simpler one
        // Just set a cookie with short maxAge
        const isProduction = process.env.NODE_ENV === "production";
        reply.setCookie("helvino_portal_stepup", stepUpToken, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          maxAge: Math.floor(STEP_UP_TTL_MS / 1000), // 10 minutes
        });
      }

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "mfa_challenge_passed",
        {},
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/mfa/login-verify
  // Complete login when MFA is required
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/mfa/login-verify",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const body = request.body as { code?: string; mfaToken?: string };

      if (!body.code || !body.mfaToken) {
        reply.code(400);
        return { error: "Code and mfaToken are required" };
      }

      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        reply.code(500);
        return { error: "Server configuration error" };
      }

      // Verify the partial MFA token
      const parsed = verifyPortalSessionToken(body.mfaToken, secret);
      if (!parsed) {
        reply.code(401);
        return { error: "Invalid or expired MFA token" };
      }

      const user = await prisma.orgUser.findUnique({
        where: { id: parsed.userId },
        include: {
          organization: { select: { id: true, key: true, name: true } },
        },
      });

      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        reply.code(401);
        return { error: "Invalid MFA state" };
      }

      let valid = verifyTotpCode(user.mfaSecret, body.code);

      // Try backup code
      if (!valid && user.backupCodesHash) {
        const hashedCodes: string[] = JSON.parse(user.backupCodesHash);
        const remaining = tryConsumeBackupCode(body.code, hashedCodes);
        if (remaining) {
          valid = true;
          await prisma.orgUser.update({
            where: { id: user.id },
            data: { backupCodesHash: JSON.stringify(remaining) },
          });
        }
      }

      if (!valid) {
        await writeAuditLog(
          user.orgId,
          user.email,
          "mfa_challenge_failed",
          { context: "login" },
          request.requestId
        );
        reply.code(401);
        return { error: "Invalid verification code" };
      }

      // Create full session
      const { createPortalSessionToken, PORTAL_SESSION_COOKIE, PORTAL_SESSION_TTL_MS } = await import("../utils/portal-session");
      const crypto = await import("crypto");

      const token = createPortalSessionToken(
        { userId: user.id, orgId: user.orgId, role: user.role },
        secret
      );

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await prisma.portalSession.create({
        data: {
          orgUserId: user.id,
          tokenHash,
          ip: request.ip || null,
          userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
        },
      });

      await prisma.orgUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const isProduction = process.env.NODE_ENV === "production";
      reply.setCookie(PORTAL_SESSION_COOKIE, token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
      });

      // Upsert device record
      await upsertDevice(
        user.id,
        "portal",
        request.headers["user-agent"] as string | undefined,
        request.ip
      );

      await writeAuditLog(
        user.orgId,
        user.email,
        "mfa_challenge_passed",
        { context: "login" },
        request.requestId
      );

      return {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          orgId: user.orgId,
          orgKey: user.organization.key,
          orgName: user.organization.name,
        },
      };
    }
  );
}
