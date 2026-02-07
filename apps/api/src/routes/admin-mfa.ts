/**
 * Admin MFA Routes — Step 11.20
 *
 * TOTP setup, verify, disable + step-up challenge for admin users.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import { writeAuditLog } from "../utils/audit-log";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { requireAdmin } from "../middleware/require-admin";
import { upsertDevice } from "../utils/device";
import {
  generateTotpSecret,
  getTotpUri,
  verifyTotpCode,
  generateBackupCodes,
  tryConsumeBackupCode,
  STEP_UP_TTL_MS,
} from "../utils/totp";

// ── Admin Step-up middleware ──

export async function requireAdminStepUp(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const adminUser = (request as any).adminUser;
  if (!adminUser) {
    return reply.status(401).send({ error: "Authentication required" });
  }

  const user = await prisma.adminUser.findUnique({ where: { id: adminUser.id } });
  if (!user || !user.mfaEnabled) {
    return; // No MFA, no step-up needed
  }

  // Check step-up timestamp in session
  const stepUpUntil = request.session.adminStepUpUntil;
  if (stepUpUntil && Date.now() < stepUpUntil) {
    return; // Step-up valid
  }

  return reply.status(403).send({
    error: "MFA step-up required",
    code: "MFA_STEP_UP_REQUIRED",
  });
}

export async function adminMfaRoutes(fastify: FastifyInstance) {
  // ──────────────────────────────────────────────────────
  // POST /internal/security/mfa/setup
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/internal/security/mfa/setup",
    {
      preHandler: [
        requireAdmin,
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;

      const user = await prisma.adminUser.findUnique({ where: { id: adminUser.id } });
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

      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          mfaSecret: secret,
          backupCodesHash: JSON.stringify(backupCodesHashed),
        },
      });

      // Use a generic org for audit (admin is cross-org)
      await writeAuditLog(
        "system",
        user.email,
        "mfa_setup_started",
        { userType: "admin" },
        request.requestId
      );

      return {
        ok: true,
        otpauthUri,
        secret,
        backupCodes,
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /internal/security/mfa/verify
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/internal/security/mfa/verify",
    {
      preHandler: [
        requireAdmin,
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const body = request.body as { code?: string };

      if (!body.code) {
        reply.code(400);
        return { error: "Verification code is required" };
      }

      const user = await prisma.adminUser.findUnique({ where: { id: adminUser.id } });
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

      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaVerifiedAt: new Date(),
        },
      });

      await writeAuditLog(
        "system",
        user.email,
        "mfa_enabled",
        { userType: "admin" },
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /internal/security/mfa/disable
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/internal/security/mfa/disable",
    {
      preHandler: [
        requireAdmin,
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const body = request.body as { code?: string };

      if (!body.code) {
        reply.code(400);
        return { error: "Code is required" };
      }

      const user = await prisma.adminUser.findUnique({ where: { id: adminUser.id } });
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        reply.code(400);
        return { error: "MFA is not enabled" };
      }

      let valid = verifyTotpCode(user.mfaSecret, body.code);

      if (!valid && user.backupCodesHash) {
        const hashedCodes: string[] = JSON.parse(user.backupCodesHash);
        const remaining = tryConsumeBackupCode(body.code, hashedCodes);
        if (remaining) {
          valid = true;
          await prisma.adminUser.update({
            where: { id: user.id },
            data: { backupCodesHash: JSON.stringify(remaining) },
          });
        }
      }

      if (!valid) {
        reply.code(401);
        return { error: "Invalid code" };
      }

      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaVerifiedAt: null,
          backupCodesHash: null,
        },
      });

      await writeAuditLog(
        "system",
        user.email,
        "mfa_disabled",
        { userType: "admin" },
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // GET /internal/security/mfa/status
  // ──────────────────────────────────────────────────────
  fastify.get(
    "/internal/security/mfa/status",
    { preHandler: [requireAdmin] },
    async (request) => {
      const adminUser = (request as any).adminUser;
      const user = await prisma.adminUser.findUnique({ where: { id: adminUser.id } });

      return {
        mfaEnabled: user?.mfaEnabled || false,
        mfaVerifiedAt: user?.mfaVerifiedAt?.toISOString() || null,
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /internal/auth/mfa/challenge
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/internal/auth/mfa/challenge",
    {
      preHandler: [
        requireAdmin,
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const body = request.body as { code?: string };

      if (!body.code) {
        reply.code(400);
        return { error: "Code is required" };
      }

      const user = await prisma.adminUser.findUnique({ where: { id: adminUser.id } });
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        reply.code(400);
        return { error: "MFA is not enabled" };
      }

      let valid = verifyTotpCode(user.mfaSecret, body.code);

      if (!valid && user.backupCodesHash) {
        const hashedCodes: string[] = JSON.parse(user.backupCodesHash);
        const remaining = tryConsumeBackupCode(body.code, hashedCodes);
        if (remaining) {
          valid = true;
          await prisma.adminUser.update({
            where: { id: user.id },
            data: { backupCodesHash: JSON.stringify(remaining) },
          });
        }
      }

      if (!valid) {
        await writeAuditLog(
          "system",
          user.email,
          "mfa_challenge_failed",
          { userType: "admin" },
          request.requestId
        );
        reply.code(401);
        return { error: "Invalid code" };
      }

      // Set step-up in session
      request.session.adminStepUpUntil = Date.now() + STEP_UP_TTL_MS;

      await writeAuditLog(
        "system",
        user.email,
        "mfa_challenge_passed",
        { userType: "admin" },
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /internal/auth/mfa/login-verify
  // Complete admin login when MFA is required
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/internal/auth/mfa/login-verify",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const body = request.body as { code?: string };

      if (!body.code) {
        reply.code(400);
        return { error: "Code is required" };
      }

      // The partial session should have adminUserId but mfaPending flag
      const userId = request.session.adminUserId;
      const mfaPending = request.session.adminMfaPending;

      if (!userId || !mfaPending) {
        reply.code(401);
        return { error: "No pending MFA login" };
      }

      const user = await prisma.adminUser.findUnique({ where: { id: userId } });
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        reply.code(401);
        return { error: "Invalid MFA state" };
      }

      let valid = verifyTotpCode(user.mfaSecret, body.code);

      if (!valid && user.backupCodesHash) {
        const hashedCodes: string[] = JSON.parse(user.backupCodesHash);
        const remaining = tryConsumeBackupCode(body.code, hashedCodes);
        if (remaining) {
          valid = true;
          await prisma.adminUser.update({
            where: { id: user.id },
            data: { backupCodesHash: JSON.stringify(remaining) },
          });
        }
      }

      if (!valid) {
        await writeAuditLog(
          "system",
          user.email,
          "mfa_challenge_failed",
          { userType: "admin", context: "login" },
          request.requestId
        );
        reply.code(401);
        return { error: "Invalid verification code" };
      }

      // Clear MFA pending flag, complete login
      delete request.session.adminMfaPending;
      request.session.adminRole = user.role;
      request.session.adminEmail = user.email;

      // Upsert device record
      await upsertDevice(
        user.id,
        "admin",
        request.headers["user-agent"] as string | undefined,
        request.ip
      );

      await writeAuditLog(
        "system",
        user.email,
        "mfa_challenge_passed",
        { userType: "admin", context: "login" },
        request.requestId
      );

      return {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    }
  );
}
