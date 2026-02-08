/**
 * Portal Security Routes — Step 11.19
 *
 * Password reset, session management, change-password for portal users.
 */

import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma } from "../prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import { writeAuditLog } from "../utils/audit-log";
import { sendEmailAsync, getDefaultFromAddress } from "../utils/mailer";
import { generateResetLink, verifySignedLink } from "../utils/signed-links";
import { getResetEmail, normalizeRequestLocale, extractLocaleCookie } from "../utils/email-templates";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import {
  requirePortalUser,
} from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  verifyPortalSessionToken,
  PORTAL_SESSION_TTL_MS,
} from "../utils/portal-session";
import { validatePasswordPolicy } from "../utils/password-policy";

// ── Helpers ──

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function portalSecurityRoutes(fastify: FastifyInstance) {
  // ──────────────────────────────────────────────────────
  // POST /portal/auth/forgot-password
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/forgot-password",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const body = request.body as { email?: string; locale?: string };
      const email = body.email?.toLowerCase().trim();
      const cookieLang = extractLocaleCookie(request.headers.cookie as string);
      const requestedLocale = normalizeRequestLocale(body.locale, cookieLang, request.headers["accept-language"] as string);
      console.log(`[security:forgot] body.locale=${JSON.stringify(body.locale)} cookie=${cookieLang} → resolved=${requestedLocale}`);

      // Generic response to avoid user enumeration
      const genericResponse = {
        ok: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      };

      if (!email || !email.includes("@")) {
        return genericResponse;
      }

      const orgUser = await prisma.orgUser.findUnique({
        where: { email },
      });

      if (!orgUser || !orgUser.isActive) {
        return genericResponse;
      }

      // Invalidate existing unused tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: { orgUserId: orgUser.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Generate token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashed = hashToken(rawToken);

      await prisma.passwordResetToken.create({
        data: {
          orgUserId: orgUser.id,
          hashedToken: hashed,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      await writeAuditLog(
        orgUser.orgId,
        orgUser.email,
        "portal_password_reset_requested",
        { orgUserId: orgUser.id },
        request.requestId
      );

      // Generate signed reset link + send email (use UI locale from request so mail matches page language)
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      const resetLink = generateResetLink(rawToken, expiresAt);

      const expiresInText = requestedLocale === "tr" ? "30 dakika" : requestedLocale === "es" ? "30 minutos" : "30 minutes";
      const emailContent = getResetEmail(requestedLocale, resetLink, expiresInText);

      // Fire-and-forget: don't block API response for password reset email
      sendEmailAsync({
        to: orgUser.email,
        from: getDefaultFromAddress(),
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: ["password-reset"],
      });

      // Dev: include reset link in JSON response
      const isProduction = process.env.NODE_ENV === "production";

      return {
        ...genericResponse,
        ...(isProduction ? {} : { resetLink }),
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/reset-password
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/reset-password",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const body = request.body as { token?: string; newPassword?: string; expires?: string; sig?: string };

      if (!body.token || !body.newPassword) {
        reply.code(400);
        return { error: "Token and newPassword are required" };
      }

      const pwCheck = validatePasswordPolicy(body.newPassword);
      if (!pwCheck.valid) {
        reply.code(400);
        return { error: { code: pwCheck.code, message: pwCheck.message, requestId: request.requestId } };
      }

      // When expires + sig are provided, verify signed link (prevents tampered URLs)
      if (body.expires && body.sig) {
        const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
        const fullUrl = `${appUrl}/portal/reset-password?token=${encodeURIComponent(body.token)}&expires=${encodeURIComponent(body.expires)}&sig=${encodeURIComponent(body.sig)}`;
        const linkCheck = verifySignedLink(fullUrl);
        if (!linkCheck.valid || linkCheck.type !== "reset") {
          reply.code(400);
          return { error: linkCheck.expired ? "Reset link has expired" : "Invalid reset link" };
        }
      }

      const hashed = hashToken(body.token);

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { hashedToken: hashed },
        include: {
          orgUser: {
            include: { organization: { select: { id: true, key: true, name: true } } },
          },
        },
      });

      if (!resetToken) {
        reply.code(400);
        return { error: "Invalid or expired reset token" };
      }

      if (resetToken.usedAt) {
        reply.code(400);
        return { error: "This reset token has already been used" };
      }

      if (resetToken.expiresAt < new Date()) {
        reply.code(400);
        return { error: "Reset token has expired" };
      }

      // Hash new password
      const newPasswordHash = await hashPassword(body.newPassword);

      // Update password
      await prisma.orgUser.update({
        where: { id: resetToken.orgUserId },
        data: { passwordHash: newPasswordHash },
      });

      // Mark token as used
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      // Revoke ALL existing portal sessions for this user
      await prisma.portalSession.updateMany({
        where: { orgUserId: resetToken.orgUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await writeAuditLog(
        resetToken.orgUser.orgId,
        resetToken.orgUser.email,
        "portal_password_reset_completed",
        { orgUserId: resetToken.orgUserId },
        request.requestId
      );

      // Create a fresh session and log user in
      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        return { ok: true, message: "Password reset. Please log in." };
      }

      const sessionToken = createPortalSessionToken(
        {
          userId: resetToken.orgUser.id,
          orgId: resetToken.orgUser.orgId,
          role: resetToken.orgUser.role,
        },
        secret
      );

      // Create session record
      const sessionTokenHash = hashToken(sessionToken);
      await prisma.portalSession.create({
        data: {
          orgUserId: resetToken.orgUser.id,
          tokenHash: sessionTokenHash,
          ip: request.ip || null,
          userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
        },
      });

      const isProduction = process.env.NODE_ENV === "production";
      reply.setCookie(PORTAL_SESSION_COOKIE, sessionToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
      });

      return {
        ok: true,
        message: "Password reset successfully",
        user: {
          id: resetToken.orgUser.id,
          email: resetToken.orgUser.email,
          role: resetToken.orgUser.role,
          orgId: resetToken.orgUser.orgId,
          orgKey: resetToken.orgUser.organization.key,
          orgName: resetToken.orgUser.organization.name,
        },
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/change-password
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/change-password",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as {
        currentPassword?: string;
        newPassword?: string;
      };

      if (!body.currentPassword || !body.newPassword) {
        reply.code(400);
        return { error: "Current password and new password are required" };
      }

      const pwCheck = validatePasswordPolicy(body.newPassword);
      if (!pwCheck.valid) {
        reply.code(400);
        return { error: { code: pwCheck.code, message: pwCheck.message, requestId: request.requestId } };
      }

      const user = await prisma.orgUser.findUnique({
        where: { id: actor.id },
      });

      if (!user) {
        reply.code(404);
        return { error: "User not found" };
      }

      const isValid = await verifyPassword(user.passwordHash, body.currentPassword);
      if (!isValid) {
        reply.code(401);
        return { error: "Current password is incorrect" };
      }

      const newHash = await hashPassword(body.newPassword);
      await prisma.orgUser.update({
        where: { id: actor.id },
        data: { passwordHash: newHash },
      });

      // Revoke all OTHER sessions (keep current)
      const currentToken = request.cookies[PORTAL_SESSION_COOKIE];
      const currentTokenHash = currentToken ? hashToken(currentToken) : null;

      if (currentTokenHash) {
        await prisma.portalSession.updateMany({
          where: {
            orgUserId: actor.id,
            revokedAt: null,
            tokenHash: { not: currentTokenHash },
          },
          data: { revokedAt: new Date() },
        });
      }

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "portal_password_changed",
        {},
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // GET /portal/auth/sessions
  // ──────────────────────────────────────────────────────
  fastify.get(
    "/portal/auth/sessions",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const actor = request.portalUser!;
      const currentToken = request.cookies[PORTAL_SESSION_COOKIE];
      const currentTokenHash = currentToken ? hashToken(currentToken) : null;

      const sessions = await prisma.portalSession.findMany({
        where: { orgUserId: actor.id, revokedAt: null },
        select: {
          id: true,
          createdAt: true,
          lastSeenAt: true,
          ip: true,
          userAgent: true,
          tokenHash: true,
        },
        orderBy: { lastSeenAt: "desc" },
      });

      return {
        sessions: sessions.map((s) => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          lastSeenAt: s.lastSeenAt.toISOString(),
          ip: s.ip,
          userAgent: s.userAgent,
          isCurrent: s.tokenHash === currentTokenHash,
        })),
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/sessions/revoke
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/sessions/revoke",
    { preHandler: [requirePortalUser, requireStepUp("portal")] },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { sessionId?: string };

      if (!body.sessionId) {
        reply.code(400);
        return { error: "sessionId is required" };
      }

      const session = await prisma.portalSession.findFirst({
        where: { id: body.sessionId, orgUserId: actor.id, revokedAt: null },
      });

      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }

      await prisma.portalSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "portal_session_revoked",
        { sessionId: session.id },
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/sessions/revoke-all
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/sessions/revoke-all",
    { preHandler: [requirePortalUser, requireStepUp("portal")] },
    async (request) => {
      const actor = request.portalUser!;
      const currentToken = request.cookies[PORTAL_SESSION_COOKIE];
      const currentTokenHash = currentToken ? hashToken(currentToken) : null;

      const result = await prisma.portalSession.updateMany({
        where: {
          orgUserId: actor.id,
          revokedAt: null,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
        data: { revokedAt: new Date() },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "portal_sessions_revoked_all",
        { revokedCount: result.count },
        request.requestId
      );

      return { ok: true, revokedCount: result.count };
    }
  );
}
