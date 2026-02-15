/**
 * Admin MFA Routes — Step 11.20
 *
 * TOTP setup, verify, disable + step-up challenge for admin users.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import geoip from "geoip-lite";
import { prisma } from "../prisma";
import { writeAuditLog } from "../utils/audit-log";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { requireAdmin } from "../middleware/require-admin";
import { hashUserAgent, upsertDevice } from "../utils/device";
import {
  generateTotpSecret,
  getTotpUri,
  verifyTotpCode,
  generateBackupCodes,
  tryConsumeBackupCode,
  encryptMfaSecret,
  decryptMfaSecret,
  STEP_UP_TTL_MS,
} from "../utils/totp";
import { getDefaultFromAddress, sendEmailAsync } from "../utils/mailer";
import {
  extractLocaleCookie,
  getLoginNotificationEmailTemplate,
  normalizeRequestLocale,
} from "../utils/email-templates";
import { getRealIP } from "../utils/get-real-ip";

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
          mfaSecret: encryptMfaSecret(secret),
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

      let totpSecret: string;
      try {
        totpSecret = decryptMfaSecret(user.mfaSecret);
      } catch {
        reply.code(500);
        return { error: "MFA secret decryption failed" };
      }

      const valid = verifyTotpCode(totpSecret, body.code);
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

      let totpSecret: string;
      try {
        totpSecret = decryptMfaSecret(user.mfaSecret);
      } catch {
        reply.code(500);
        return { error: "MFA secret decryption failed" };
      }

      let valid = verifyTotpCode(totpSecret, body.code);

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

      let totpSecret: string;
      try {
        totpSecret = decryptMfaSecret(user.mfaSecret);
      } catch {
        reply.code(500);
        return { error: "MFA secret decryption failed" };
      }

      let valid = verifyTotpCode(totpSecret, body.code);

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

      let totpSecret: string;
      try {
        totpSecret = decryptMfaSecret(user.mfaSecret);
      } catch {
        reply.code(500);
        return { error: "MFA secret decryption failed" };
      }

      let valid = verifyTotpCode(totpSecret, body.code);

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

      const requestIp = getRealIP(request);
      const requestUa = ((request.headers["user-agent"] as string) || "unknown").substring(0, 256);
      const uaHash = hashUserAgent(requestUa);
      const existingDevice = await prisma.trustedDevice.findUnique({
        where: {
          userId_userType_userAgentHash: {
            userId: user.id,
            userType: "admin",
            userAgentHash: uaHash,
          },
        },
        select: { id: true, lastIp: true },
      });
      const knownDeviceCount = await prisma.trustedDevice.count({
        where: { userId: user.id, userType: "admin" },
      });

      // Strict admin policy: allow at most 2 devices.
      if (!existingDevice && knownDeviceCount >= 2) {
        await writeAuditLog(
          "system",
          user.email,
          "admin.login.blocked",
          { reason: "device_limit_reached", ip: requestIp, maxDevices: 2 },
          request.requestId
        );
        reply.code(403);
        return {
          error: {
            code: "DEVICE_LIMIT_REACHED",
            message: "Maximum 2 admin devices are allowed",
          },
        };
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
        requestIp
      );

      // Avoid spamming when admin IP changes (office/home/VPN).
      // Only notify when we haven't seen this device before.
      const shouldSendLoginNotification = !existingDevice;
      const geo = requestIp !== "unknown" ? geoip.lookup(requestIp) : null;
      const loginCountry = geo?.country || null;
      const loginCity = geo?.city || null;
      const locationLabel = [loginCity, loginCountry].filter(Boolean).join(", ") || "Unknown";
      if (shouldSendLoginNotification) {
        const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
        const cookieLang = extractLocaleCookie(request.headers.cookie as string);
        const securityLocale = normalizeRequestLocale(
          undefined,
          cookieLang,
          request.headers["accept-language"] as string
        );
        const loginNotification = getLoginNotificationEmailTemplate(securityLocale, {
          time: new Date().toISOString(),
          ip: requestIp,
          device: requestUa.substring(0, 120),
          location: locationLabel,
          securityUrl: `${appUrl}/dashboard/settings/security`,
        });
        sendEmailAsync({
          to: user.email,
          from: getDefaultFromAddress(),
          subject: loginNotification.subject,
          html: loginNotification.html,
          text: loginNotification.text,
          tags: ["security", "login-notification", "admin"],
        });
      }

      await writeAuditLog(
        "system",
        user.email,
        "mfa_challenge_passed",
        { userType: "admin", context: "login", ip: requestIp, location: locationLabel },
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
