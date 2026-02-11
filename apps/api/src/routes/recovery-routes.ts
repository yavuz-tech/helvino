/**
 * Account Recovery + Emergency Access Routes — Step 11.24
 *
 * Portal: POST /portal/recovery/request
 * Admin:  POST /admin/recovery/request
 * Internal: GET  /internal/recovery/requests
 *           POST /internal/recovery/:id/approve
 *           POST /internal/recovery/:id/reject
 *
 * Emergency (portal owner only):
 *   POST /portal/emergency/generate
 *   POST /portal/emergency/use
 *
 * MFA lockout detection:
 *   POST /portal/auth/mfa-lockout-check
 *   POST /internal/auth/mfa-lockout-check
 */

import crypto from "crypto";
import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/require-admin";
import { requirePortalUser } from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { writeAuditLog } from "../utils/audit-log";
import { sendEmailAsync, getDefaultFromAddress } from "../utils/mailer";
import { getRecoveryApprovedEmail, getRecoveryRejectedEmail, getEmergencyTokenEmail, normalizeRequestLocale, extractLocaleCookie } from "../utils/email-templates";

const RECOVERY_EXPIRY_HOURS = 48;
const RECOVERY_RATE_LIMIT_PER_DAY = 3;
const EMERGENCY_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const EMERGENCY_COOLDOWN_DAYS = 30;
const RECOVERY_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Check MFA lockout: MFA enabled + no backup codes + no trusted devices
 */
async function isMfaLockedOut(
  userId: string,
  userType: "admin" | "portal"
): Promise<boolean> {
  let mfaEnabled = false;
  let backupCodesHash: string | null = null;

  if (userType === "portal") {
    const user = await prisma.orgUser.findUnique({ where: { id: userId } });
    if (!user) return false;
    mfaEnabled = user.mfaEnabled;
    backupCodesHash = user.backupCodesHash;
  } else {
    const user = await prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) return false;
    mfaEnabled = user.mfaEnabled;
    backupCodesHash = user.backupCodesHash;
  }

  if (!mfaEnabled) return false;

  // Check if backup codes exist
  let hasBackupCodes = false;
  if (backupCodesHash) {
    try {
      const codes = JSON.parse(backupCodesHash);
      hasBackupCodes = Array.isArray(codes) && codes.length > 0;
    } catch {
      hasBackupCodes = false;
    }
  }

  if (hasBackupCodes) return false; // Has backup codes, not locked out

  // Check for trusted devices
  const trustedDevices = await prisma.trustedDevice.count({
    where: { userId, userType, trusted: true },
  });

  return trustedDevices === 0; // Locked out if no trusted devices AND no backup codes
}

export async function recoveryRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════
  // PORTAL: Request recovery
  // ═══════════════════════════════════════════
  fastify.post(
    "/portal/recovery/request",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { email, reason } = request.body as {
        email?: string;
        reason?: string;
      };
      const requestId = request.requestId || undefined;

      if (!email || !reason) {
        return reply.status(400).send({
          error: "Email and reason are required",
          requestId,
        });
      }

      if (reason.length < 10 || reason.length > 1000) {
        return reply.status(400).send({
          error: "Reason must be between 10 and 1000 characters",
          requestId,
        });
      }

      // Find user
      const user = await prisma.orgUser.findUnique({ where: { email } });
      if (!user) {
        // Generic response to prevent enumeration
        return reply.status(200).send({
          message: "If an account exists with this email, a recovery request has been created.",
          requestId,
        });
      }

      if (!user.isActive) {
        return reply.status(200).send({
          message: "If an account exists with this email, a recovery request has been created.",
          requestId,
        });
      }

      // Rate limit: max 3 per day per user
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await prisma.accountRecoveryRequest.count({
        where: {
          userId: user.id,
          userType: "portal",
          requestedAt: { gte: oneDayAgo },
        },
      });

      if (recentCount >= RECOVERY_RATE_LIMIT_PER_DAY) {
        return reply.status(429).send({
          error: "Too many recovery requests. Try again later.",
          requestId,
        });
      }

      // Check if there's already a pending request
      const existing = await prisma.accountRecoveryRequest.findFirst({
        where: { userId: user.id, userType: "portal", status: "pending" },
      });

      if (existing) {
        return reply.status(409).send({
          error: "A recovery request is already pending",
          requestId,
        });
      }

      const recoveryRequest = await prisma.accountRecoveryRequest.create({
        data: {
          userType: "portal",
          userId: user.id,
          email: user.email,
          reason,
          expiresAt: new Date(Date.now() + RECOVERY_EXPIRY_HOURS * 60 * 60 * 1000),
          ip: request.ip?.substring(0, 45) || null,
          userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
        },
      });

      await writeAuditLog(
        user.orgId,
        user.email,
        "recovery.requested",
        {
          recoveryId: recoveryRequest.id,
          userType: "portal",
          ip: request.ip,
        },
        requestId
      );

      return reply.status(201).send({
        message: "Recovery request submitted successfully",
        recoveryId: recoveryRequest.id,
        status: "pending",
        expiresAt: recoveryRequest.expiresAt,
        requestId,
      });
    }
  );

  // ═══════════════════════════════════════════
  // PORTAL: Get my recovery status
  // ═══════════════════════════════════════════
  fastify.get(
    "/portal/recovery/status",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { email } = request.query as { email?: string };
      const requestId = request.requestId || undefined;

      if (!email) {
        return reply.status(400).send({ error: "Email is required", requestId });
      }

      const user = await prisma.orgUser.findUnique({ where: { email } });
      if (!user) {
        return reply.status(200).send({ requests: [], requestId });
      }

      const requests = await prisma.accountRecoveryRequest.findMany({
        where: { userId: user.id, userType: "portal" },
        orderBy: { requestedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          reason: true,
          requestedAt: true,
          expiresAt: true,
          resolvedAt: true,
        },
      });

      return { requests, requestId };
    }
  );

  // ═══════════════════════════════════════════
  // ADMIN: Request recovery
  // ═══════════════════════════════════════════
  fastify.post(
    "/admin/recovery/request",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { email, reason } = request.body as {
        email?: string;
        reason?: string;
      };
      const requestId = request.requestId || undefined;

      if (!email || !reason) {
        return reply.status(400).send({
          error: "Email and reason are required",
          requestId,
        });
      }

      if (reason.length < 10 || reason.length > 1000) {
        return reply.status(400).send({
          error: "Reason must be between 10 and 1000 characters",
          requestId,
        });
      }

      const user = await prisma.adminUser.findUnique({ where: { email } });
      if (!user) {
        return reply.status(200).send({
          message: "If an account exists with this email, a recovery request has been created.",
          requestId,
        });
      }

      // Rate limit
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await prisma.accountRecoveryRequest.count({
        where: {
          userId: user.id,
          userType: "admin",
          requestedAt: { gte: oneDayAgo },
        },
      });

      if (recentCount >= RECOVERY_RATE_LIMIT_PER_DAY) {
        return reply.status(429).send({
          error: "Too many recovery requests. Try again later.",
          requestId,
        });
      }

      const existing = await prisma.accountRecoveryRequest.findFirst({
        where: { userId: user.id, userType: "admin", status: "pending" },
      });

      if (existing) {
        return reply.status(409).send({
          error: "A recovery request is already pending",
          requestId,
        });
      }

      const recoveryRequest = await prisma.accountRecoveryRequest.create({
        data: {
          userType: "admin",
          userId: user.id,
          email: user.email,
          reason,
          expiresAt: new Date(Date.now() + RECOVERY_EXPIRY_HOURS * 60 * 60 * 1000),
          ip: request.ip?.substring(0, 45) || null,
          userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
        },
      });

      // No orgId for admin — use "system"
      await writeAuditLog(
        "system",
        user.email,
        "recovery.requested",
        {
          recoveryId: recoveryRequest.id,
          userType: "admin",
          ip: request.ip,
        },
        requestId
      );

      return reply.status(201).send({
        message: "Recovery request submitted successfully",
        recoveryId: recoveryRequest.id,
        status: "pending",
        expiresAt: recoveryRequest.expiresAt,
        requestId,
      });
    }
  );

  // ═══════════════════════════════════════════
  // INTERNAL: List all recovery requests (admin only)
  // ═══════════════════════════════════════════
  fastify.get(
    "/internal/recovery/requests",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { status, limit: limitStr } = request.query as {
        status?: string;
        limit?: string;
      };
      const requestId = request.requestId || undefined;
      const limit = Math.min(parseInt(limitStr || "50", 10), 200);

      // Expire old pending requests
      await prisma.accountRecoveryRequest.updateMany({
        where: {
          status: "pending",
          expiresAt: { lt: new Date() },
        },
        data: { status: "expired" },
      });

      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const requests = await prisma.accountRecoveryRequest.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: limit,
      });

      return { requests, total: requests.length, requestId };
    }
  );

  // ═══════════════════════════════════════════
  // INTERNAL: Approve recovery
  // ═══════════════════════════════════════════
  fastify.post<{ Params: { id: string } }>(
    "/internal/recovery/:id/approve",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const requestId = request.requestId || undefined;
      const admin = (request as any).adminUser;

      const req = await prisma.accountRecoveryRequest.findUnique({
        where: { id },
      });

      if (!req) {
        return reply.status(404).send({ error: "Recovery request not found", requestId });
      }

      if (req.status !== "pending") {
        return reply.status(409).send({
          error: `Request is already ${req.status}`,
          requestId,
        });
      }

      if (req.expiresAt < new Date()) {
        await prisma.accountRecoveryRequest.update({
          where: { id },
          data: { status: "expired" },
        });
        return reply.status(410).send({ error: "Recovery request has expired", requestId });
      }

      // Approve: update request
      await prisma.accountRecoveryRequest.update({
        where: { id },
        data: {
          status: "approved",
          resolvedAt: new Date(),
          resolvedBy: admin.email,
        },
      });

      // Reset MFA if locked out
      const lockedOut = await isMfaLockedOut(req.userId, req.userType as "admin" | "portal");
      if (lockedOut) {
        if (req.userType === "portal") {
          await prisma.orgUser.update({
            where: { id: req.userId },
            data: {
              mfaEnabled: false,
              mfaSecret: null,
              mfaVerifiedAt: null,
              backupCodesHash: null,
            },
          });
        } else {
          await prisma.adminUser.update({
            where: { id: req.userId },
            data: {
              mfaEnabled: false,
              mfaSecret: null,
              mfaVerifiedAt: null,
              backupCodesHash: null,
            },
          });
        }
      }

      // Audit log
      const orgId = req.userType === "portal"
        ? (await prisma.orgUser.findUnique({ where: { id: req.userId } }))?.orgId || "system"
        : "system";

      await writeAuditLog(
        orgId,
        admin.email,
        "recovery.approved",
        {
          recoveryId: id,
          userType: req.userType,
          userEmail: req.email,
          mfaReset: lockedOut,
        },
        requestId
      );

      // Emit in-app notification
      const { emitRecoveryApproved } = await import("../utils/notifications");
      if (req.userType === "portal") {
        await emitRecoveryApproved(orgId, req.userId, requestId);
      }

      // Requester's language: org language → Accept-Language → "en"
      let orgLang: string | undefined;
      if (req.userType === "portal") {
        const orgUser = await prisma.orgUser.findUnique({ where: { id: req.userId }, select: { orgId: true } });
        if (orgUser) {
          const org = await prisma.organization.findUnique({ where: { id: orgUser.orgId }, select: { language: true } });
          orgLang = org?.language ?? undefined;
        }
      }
      const approveCookieLang = extractLocaleCookie(request.headers.cookie as string);
      const approveLocale = normalizeRequestLocale(orgLang, approveCookieLang, request.headers["accept-language"] as string);

      const approvedMessageKey = lockedOut ? "mfa_reset" : "login_ok";
      const approvedEmail = getRecoveryApprovedEmail(approveLocale, approvedMessageKey);
      sendEmailAsync({
        to: req.email,
        from: getDefaultFromAddress(),
        subject: approvedEmail.subject,
        html: approvedEmail.html,
        tags: ["recovery", "approved"],
      });

      return {
        message: "Recovery request approved",
        recoveryId: id,
        mfaReset: lockedOut,
        requestId,
      };
    }
  );

  // ═══════════════════════════════════════════
  // INTERNAL: Reject recovery
  // ═══════════════════════════════════════════
  fastify.post<{ Params: { id: string } }>(
    "/internal/recovery/:id/reject",
    {
      preHandler: [requireAdmin, requireStepUp("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body as { reason?: string };
      const requestId = request.requestId || undefined;
      const admin = (request as any).adminUser;

      const req = await prisma.accountRecoveryRequest.findUnique({
        where: { id },
      });

      if (!req) {
        return reply.status(404).send({ error: "Recovery request not found", requestId });
      }

      if (req.status !== "pending") {
        return reply.status(409).send({
          error: `Request is already ${req.status}`,
          requestId,
        });
      }

      await prisma.accountRecoveryRequest.update({
        where: { id },
        data: {
          status: "rejected",
          resolvedAt: new Date(),
          resolvedBy: admin.email,
        },
      });

      const orgId = req.userType === "portal"
        ? (await prisma.orgUser.findUnique({ where: { id: req.userId } }))?.orgId || "system"
        : "system";

      await writeAuditLog(
        orgId,
        admin.email,
        "recovery.rejected",
        {
          recoveryId: id,
          userType: req.userType,
          userEmail: req.email,
          reason: reason || "No reason provided",
        },
        requestId
      );

      // Emit in-app notification
      const { emitRecoveryRejected } = await import("../utils/notifications");
      if (req.userType === "portal") {
        await emitRecoveryRejected(orgId, req.userId, requestId);
      }

      // Requester's language: org language → Accept-Language → "en"
      let rejectOrgLang: string | undefined;
      if (req.userType === "portal") {
        const orgUser = await prisma.orgUser.findUnique({ where: { id: req.userId }, select: { orgId: true } });
        if (orgUser) {
          const org = await prisma.organization.findUnique({ where: { id: orgUser.orgId }, select: { language: true } });
          rejectOrgLang = org?.language ?? undefined;
        }
      }
      const rejectCookieLang = extractLocaleCookie(request.headers.cookie as string);
      const rejectLocale = normalizeRequestLocale(rejectOrgLang, rejectCookieLang, request.headers["accept-language"] as string);

      const rejectedEmail = getRecoveryRejectedEmail(rejectLocale, reason || "");
      sendEmailAsync({
        to: req.email,
        from: getDefaultFromAddress(),
        subject: rejectedEmail.subject,
        html: rejectedEmail.html,
        tags: ["recovery", "rejected"],
      });

      return {
        message: "Recovery request rejected",
        recoveryId: id,
        requestId,
      };
    }
  );

  // ═══════════════════════════════════════════
  // MFA LOCKOUT CHECK (portal)
  // ═══════════════════════════════════════════
  fastify.post(
    "/portal/auth/mfa-lockout-check",
    {
      preHandler: [createRateLimitMiddleware({ limit: 10, windowMs: 60000 })],
    },
    async (request, reply) => {
      const { email } = request.body as { email?: string };
      const requestId = request.requestId || undefined;

      if (!email) {
        return reply.status(400).send({ error: "Email is required", requestId });
      }

      const user = await prisma.orgUser.findUnique({ where: { email } });
      if (!user) {
        // Generic response
        return { lockedOut: false, requestId };
      }

      const lockedOut = await isMfaLockedOut(user.id, "portal");
      return { lockedOut, requestId };
    }
  );

  // ═══════════════════════════════════════════
  // MFA LOCKOUT CHECK (admin)
  // ═══════════════════════════════════════════
  fastify.post(
    "/internal/auth/mfa-lockout-check",
    {
      preHandler: [createRateLimitMiddleware({ limit: 10, windowMs: 60000 })],
    },
    async (request, reply) => {
      const { email } = request.body as { email?: string };
      const requestId = request.requestId || undefined;

      if (!email) {
        return reply.status(400).send({ error: "Email is required", requestId });
      }

      const user = await prisma.adminUser.findUnique({ where: { email } });
      if (!user) {
        return { lockedOut: false, requestId };
      }

      const lockedOut = await isMfaLockedOut(user.id, "admin");
      return { lockedOut, requestId };
    }
  );

  // ═══════════════════════════════════════════
  // EMERGENCY ACCESS: Generate token (portal owner only)
  // ═══════════════════════════════════════════
  fastify.post(
    "/portal/emergency/generate",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 3, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const requestId = request.requestId || undefined;

      // Only owners can generate emergency tokens
      if (actor.role !== "owner") {
        return reply.status(403).send({
          error: "Only organization owners can generate emergency access tokens",
          requestId,
        });
      }

      // Check cooldown: no token generated in last 30 days
      const recentToken = await prisma.emergencyAccessToken.findFirst({
        where: {
          userId: actor.id,
          userType: "portal",
          cooldownUntil: { gt: new Date() },
        },
      });

      if (recentToken) {
        return reply.status(429).send({
          error: "Emergency token was recently generated. You must wait before generating another.",
          cooldownUntil: recentToken.cooldownUntil,
          requestId,
        });
      }

      // Generate token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const cooldownUntil = new Date(Date.now() + EMERGENCY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

      await prisma.emergencyAccessToken.create({
        data: {
          userId: actor.id,
          userType: "portal",
          tokenHash,
          expiresAt: new Date(Date.now() + EMERGENCY_TOKEN_EXPIRY_MS),
          cooldownUntil,
        },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "emergency.token_generated",
        { ip: request.ip },
        requestId
      );

      // User's org language → Accept-Language → "en"
      const org = await prisma.organization.findUnique({ where: { id: actor.orgId }, select: { language: true } });
      const emergencyCookieLang = extractLocaleCookie(request.headers.cookie as string);
      const emergencyLocale = normalizeRequestLocale(
        undefined,
        emergencyCookieLang,
        request.headers["accept-language"] as string,
        org?.language ?? undefined
      );

      const emergencyEmail = getEmergencyTokenEmail(emergencyLocale);
      sendEmailAsync({
        to: actor.email,
        from: getDefaultFromAddress(),
        subject: emergencyEmail.subject,
        html: emergencyEmail.html,
        tags: ["emergency", "security"],
      });

      // Return the raw token only ONCE
      return {
        token: rawToken,
        expiresAt: new Date(Date.now() + EMERGENCY_TOKEN_EXPIRY_MS),
        cooldownUntil,
        warning: "This token is shown only once. Store it securely.",
        requestId,
      };
    }
  );

  // ═══════════════════════════════════════════
  // EMERGENCY ACCESS: Use token
  // ═══════════════════════════════════════════
  fastify.post(
    "/portal/emergency/use",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { token } = request.body as { token?: string };
      const requestId = request.requestId || undefined;

      if (!token) {
        return reply.status(400).send({ error: "Token is required", requestId });
      }

      const tokenHash = hashToken(token);
      const record = await prisma.emergencyAccessToken.findUnique({
        where: { tokenHash },
      });

      if (!record) {
        return reply.status(401).send({ error: "Invalid emergency token", requestId });
      }

      if (record.usedAt) {
        return reply.status(410).send({ error: "Emergency token has already been used", requestId });
      }

      if (record.expiresAt < new Date()) {
        return reply.status(410).send({ error: "Emergency token has expired", requestId });
      }

      // Mark as used
      await prisma.emergencyAccessToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      // Emergency access allows: disable MFA, add trusted device, force password reset
      // The actual MFA reset / password reset happens via the portal security endpoints
      // We just return a signal that emergency access was used
      const user = await prisma.orgUser.findUnique({
        where: { id: record.userId },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found", requestId });
      }

      // Disable MFA
      await prisma.orgUser.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaVerifiedAt: null,
          backupCodesHash: null,
        },
      });

      await writeAuditLog(
        user.orgId,
        user.email,
        "emergency.token_used",
        {
          ip: request.ip,
          mfaDisabled: true,
          passwordResetRequired: true,
        },
        requestId
      );

      // Emit critical notification to owners
      const { emitEmergencyTokenUsed } = await import("../utils/notifications");
      await emitEmergencyTokenUsed(user.orgId, requestId);

      return {
        message: "Emergency access granted. MFA has been disabled. You must reset your password and re-enable MFA.",
        userId: user.id,
        email: user.email,
        mfaDisabled: true,
        passwordResetRequired: true,
        requestId,
      };
    }
  );
}
