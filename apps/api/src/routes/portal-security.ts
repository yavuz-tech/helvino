/**
 * Portal Security Routes — Step 11.19
 *
 * Password reset, session management, change-password for portal users.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "crypto";
import { prisma } from "../prisma";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  PASSWORD_STRENGTH_ERROR_MESSAGE,
} from "../utils/password";
import { writeAuditLog } from "../utils/audit-log";
import { sendEmailAsync, getDefaultFromAddress } from "../utils/mailer";
import { generateResetLink, verifySignedLink } from "../utils/signed-links";
import {
  getResetEmail,
  normalizeRequestLocale,
  extractLocaleCookie,
  getPasswordChangedEmail,
} from "../utils/email-templates";
import { t, getRequestLocale } from "../utils/api-i18n";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { rateLimit } from "../middleware/rate-limiter";
import { validateJsonContentType } from "../middleware/validation";
import {
  requirePortalUser,
} from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionWithLimit,
  createPortalTokenPair,
  getPortalCookiePolicy,
  PORTAL_SESSION_TTL_MS,
  PORTAL_REFRESH_TOKEN_TTL_MS,
} from "../utils/portal-session";
import { verifyTurnstileToken, isCaptchaConfigured } from "../utils/verify-captcha";
import { getRealIP } from "../utils/get-real-ip";
import { validateBody } from "../utils/validate";
import { forgotPasswordSchema, resetPasswordSchema } from "../utils/schemas";

// ── Helpers ──

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const FORGOT_PASSWORD_IP_LIMIT_PER_HOUR = 3;
const FORGOT_PASSWORD_EMAIL_LIMIT_PER_DAY = 5;
const CAPTCHA_REQUIRED_ATTEMPTS_PER_HOUR = 2;
const GENERIC_RESET_MIN_RESPONSE_MS = 650;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3006",
    process.env.APP_PUBLIC_URL,
    process.env.NEXT_PUBLIC_WEB_URL,
  ].filter(Boolean) as string[];
  return allowedOrigins.includes(origin);
}

export async function portalSecurityRoutes(fastify: FastifyInstance) {
  const forgotPasswordRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message: "Too many forgot-password attempts",
  });
  const resetPasswordRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: "Too many reset-password attempts",
  });

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/forgot-password
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/forgot-password",
    {
      preHandler: [
        forgotPasswordRateLimit,
        validateJsonContentType,
      ],
      config: {
        skipGlobalRateLimit: true,
      },
    },
    async (request, reply) => {
      const origin = request.headers.origin as string | undefined;
      if (!isAllowedOrigin(origin)) {
        reply.code(403);
        return { error: "Forbidden: Invalid origin" };
      }

      const startedAt = Date.now();
      const body = validateBody(forgotPasswordSchema, request.body, reply);
      if (!body) return;

      const email = body.email.toLowerCase().trim();
      const cookieLang = extractLocaleCookie(request.headers.cookie as string);
      const ipAddress = getRealIP(request);
      const userAgent = (request.headers["user-agent"] as string | undefined)?.substring(0, 256) ?? null;

      const genericMessage = "If an account with that email exists, a password reset link has been sent.";
      const genericResponse = { ok: true, message: genericMessage };

      const completeWithMinDelay = async (payload: Record<string, unknown>) => {
        const elapsed = Date.now() - startedAt;
        if (elapsed < GENERIC_RESET_MIN_RESPONSE_MS) {
          await sleep(GENERIC_RESET_MIN_RESPONSE_MS - elapsed);
        }
        return payload;
      };

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [ipHourlyAttempts, emailDailyAttempts] = await Promise.all([
        prisma.passwordResetAttempt.count({
          where: {
            ipAddress,
            createdAt: { gte: oneHourAgo },
          },
        }),
        prisma.passwordResetAttempt.count({
          where: {
            email,
            createdAt: { gte: oneDayAgo },
          },
        }),
      ]);

      if (ipHourlyAttempts >= FORGOT_PASSWORD_IP_LIMIT_PER_HOUR || emailDailyAttempts >= FORGOT_PASSWORD_EMAIL_LIMIT_PER_DAY) {
        await prisma.passwordResetAttempt.create({
          data: {
            email,
            ipAddress,
            userAgent,
            success: false,
          },
        });
        reply.code(429);
        return {
          error: {
            code: "TOO_MANY_RESET_REQUESTS",
            message: "Too many requests, try again later",
          },
        };
      }

      if (isCaptchaConfigured() && ipHourlyAttempts >= CAPTCHA_REQUIRED_ATTEMPTS_PER_HOUR) {
        if (!body.captchaToken) {
          await prisma.passwordResetAttempt.create({
            data: {
              email,
              ipAddress,
              userAgent,
              success: false,
            },
          });
          reply.code(400);
          return {
            error: {
              code: "CAPTCHA_REQUIRED",
              message: "Please complete CAPTCHA to continue.",
            },
          };
        }

        const captchaOk = await verifyTurnstileToken(body.captchaToken, ipAddress);
        if (!captchaOk) {
          await prisma.passwordResetAttempt.create({
            data: {
              email,
              ipAddress,
              userAgent,
              success: false,
            },
          });
          reply.code(400);
          return {
            error: {
              code: "INVALID_CAPTCHA",
              message: "CAPTCHA verification failed.",
            },
          };
        }
      }

      const orgUser = await prisma.orgUser.findUnique({
        where: { email },
        include: {
          organization: {
            select: { language: true },
          },
        },
      });

      if (!orgUser || !orgUser.isActive) {
        await prisma.passwordResetAttempt.create({
          data: {
            email,
            ipAddress,
            userAgent,
            success: false,
          },
        });
        return completeWithMinDelay(genericResponse);
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

      // Generate signed reset link + send email in org/site language
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      const resetLink = generateResetLink(rawToken, expiresAt);
      const effectiveLocale = normalizeRequestLocale(
        body.locale,
        cookieLang,
        request.headers["accept-language"] as string,
        orgUser.organization.language || undefined
      );

      const expiresInText = effectiveLocale === "tr" ? "60 dakika" : effectiveLocale === "es" ? "60 minutos" : "60 minutes";
      const emailContent = getResetEmail(effectiveLocale, resetLink, expiresInText);

      // Fire-and-forget: don't block API response for password reset email
      sendEmailAsync({
        to: orgUser.email,
        from: getDefaultFromAddress(),
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: ["password-reset"],
      });

      await prisma.passwordResetAttempt.create({
        data: {
          email,
          ipAddress,
          userAgent,
          success: true,
        },
      });

      // Dev: include reset link in JSON response
      const isProduction = process.env.NODE_ENV === "production";

      return completeWithMinDelay({
        ...genericResponse,
        ...(isProduction ? {} : { resetLink }),
      });
    }
  );

  // ──────────────────────────────────────────────────────
  // GET /portal/auth/reset-password/validate
  // ──────────────────────────────────────────────────────
  fastify.get(
    "/portal/auth/reset-password/validate",
    async (request, reply) => {
      const loc = getRequestLocale(request);
      const origin = request.headers.origin as string | undefined;
      if (!isAllowedOrigin(origin)) {
        reply.code(403);
        return { valid: false, error: t(loc, "auth.invalidOrigin") };
      }

      const query = request.query as { token?: string; expires?: string; sig?: string };
      const token = query.token?.trim();

      if (!token) {
        reply.code(400);
        return { valid: false, error: t(loc, "reset.invalidOrExpiredToken") };
      }

      if (query.expires && query.sig) {
        const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
        const fullUrl = `${appUrl}/portal/reset-password?token=${encodeURIComponent(token)}&expires=${encodeURIComponent(query.expires)}&sig=${encodeURIComponent(query.sig)}`;
        const linkCheck = verifySignedLink(fullUrl);
        if (!linkCheck.valid || linkCheck.type !== "reset") {
          reply.code(400);
          return { valid: false, error: linkCheck.expired ? t(loc, "reset.linkExpired") : t(loc, "reset.invalidLink") };
        }
      }

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { hashedToken: hashToken(token) },
        select: { id: true, expiresAt: true, usedAt: true },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        reply.code(400);
        return { valid: false, error: t(loc, "reset.invalidOrExpiredToken") };
      }

      return { valid: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/reset-password
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/reset-password",
    {
      preHandler: [
        resetPasswordRateLimit,
        validateJsonContentType,
      ],
      config: {
        skipGlobalRateLimit: true,
      },
    },
    async (request, reply) => {
      const loc = getRequestLocale(request);
      const origin = request.headers.origin as string | undefined;
      if (!isAllowedOrigin(origin)) {
        reply.code(403);
        return { error: t(loc, "auth.invalidOrigin") };
      }

      const body = validateBody(resetPasswordSchema, request.body, reply);
      if (!body) return;

      const pwCheck = validatePasswordStrength(body.newPassword);
      if (!pwCheck.valid) {
        reply.code(400);
        return { error: PASSWORD_STRENGTH_ERROR_MESSAGE };
      }

      // When expires + sig are provided, verify signed link (prevents tampered URLs)
      if (body.expires && body.sig) {
        const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
        const fullUrl = `${appUrl}/portal/reset-password?token=${encodeURIComponent(body.token)}&expires=${encodeURIComponent(body.expires)}&sig=${encodeURIComponent(body.sig)}`;
        const linkCheck = verifySignedLink(fullUrl);
        if (!linkCheck.valid || linkCheck.type !== "reset") {
          reply.code(400);
          return { error: linkCheck.expired ? t(loc, "reset.linkExpired") : t(loc, "reset.invalidLink") };
        }
      }

      const hashed = hashToken(body.token);

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { hashedToken: hashed },
        include: {
          orgUser: {
            include: { organization: { select: { id: true, key: true, name: true, language: true } } },
          },
        },
      });

      if (!resetToken) {
        reply.code(400);
        return { error: t(loc, "reset.invalidOrExpiredToken") };
      }

      if (resetToken.usedAt) {
        reply.code(400);
        return { error: t(loc, "reset.tokenAlreadyUsed") };
      }

      if (resetToken.expiresAt < new Date()) {
        reply.code(400);
        return { error: t(loc, "reset.tokenExpired") };
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

      const supportUrl = `${process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"}/portal/forgot-password`;
      const resetCookieLang = extractLocaleCookie(request.headers.cookie as string);
      const resetLocale = normalizeRequestLocale(
        undefined,
        resetCookieLang,
        request.headers["accept-language"] as string,
        resetToken.orgUser.organization.language || undefined
      );
      const passwordChangedEmail = getPasswordChangedEmail(resetLocale, {
        time: new Date().toISOString(),
        ip: getRealIP(request),
        device: ((request.headers["user-agent"] as string) || "Unknown device").substring(0, 160),
        supportUrl,
      });

      sendEmailAsync({
        to: resetToken.orgUser.email,
        from: getDefaultFromAddress(),
        subject: passwordChangedEmail.subject,
        html: passwordChangedEmail.html,
        text: passwordChangedEmail.text,
        tags: ["password-changed"],
      });

      // Create a fresh session and log user in
      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        return { ok: true, message: t(loc, "reset.successNoSession") };
      }

      const tokens = createPortalTokenPair(
        {
          userId: resetToken.orgUser.id,
          orgId: resetToken.orgUser.orgId,
          role: resetToken.orgUser.role,
        },
        secret
      );

      await createPortalSessionWithLimit({
        orgUserId: resetToken.orgUser.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExpiresAt: tokens.accessExpiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
        ip: getRealIP(request) !== "unknown" ? getRealIP(request) : null,
        userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
        deviceName: ((request.headers["user-agent"] as string) || "Unknown").substring(0, 120),
      });

      const { sameSite, secure } = getPortalCookiePolicy({
        requestOrigin: (request.headers.origin as string | undefined) || null,
        requestHost: (request.headers.host as string | undefined) || null,
      });
      reply.setCookie(PORTAL_SESSION_COOKIE, tokens.accessToken, {
        path: "/",
        httpOnly: true,
        sameSite,
        secure,
        maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
      });

      return {
        ok: true,
        message: t(loc, "reset.success"),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        refreshExpiresInSec: Math.floor(PORTAL_REFRESH_TOKEN_TTL_MS / 1000),
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
  // PATCH /portal/settings/password (alias)
  // ──────────────────────────────────────────────────────
  const passwordChangePreHandlers = [
    requirePortalUser,
    requireStepUp("portal"),
    createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
    validateJsonContentType,
  ];

  const handlePasswordChange = async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = request.portalUser!;
    const body = request.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      reply.code(400);
      return { error: "Current password and new password are required" };
    }

    const pwCheck = validatePasswordStrength(body.newPassword);
    if (!pwCheck.valid) {
      reply.code(400);
      return { error: PASSWORD_STRENGTH_ERROR_MESSAGE };
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
  };

  fastify.post("/portal/auth/change-password", { preHandler: passwordChangePreHandlers }, handlePasswordChange);
  fastify.patch("/portal/settings/password", { preHandler: passwordChangePreHandlers }, handlePasswordChange);

  // ──────────────────────────────────────────────────────
  // GET /portal/auth/sessions
  // GET /portal/sessions/active (alias)
  // ──────────────────────────────────────────────────────
  const listSessionsHandler = async (request: FastifyRequest) => {
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
          deviceId: true,
          deviceName: true,
          loginCountry: true,
          loginCity: true,
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
          deviceId: s.deviceId,
          deviceName: s.deviceName,
          loginCountry: s.loginCountry,
          loginCity: s.loginCity,
          isCurrent: s.tokenHash === currentTokenHash,
        })),
      };
    };

  fastify.get("/portal/auth/sessions", { preHandler: [requirePortalUser] }, listSessionsHandler);
  fastify.get("/portal/sessions/active", { preHandler: [requirePortalUser] }, listSessionsHandler);

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/sessions/revoke
  // DELETE /portal/sessions/:id (alias)
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

  fastify.delete<{ Params: { id: string } }>(
    "/portal/sessions/:id",
    { preHandler: [requirePortalUser, requireStepUp("portal")] },
    async (request, reply) => {
      const actor = request.portalUser!;
      const session = await prisma.portalSession.findFirst({
        where: { id: request.params.id, orgUserId: actor.id, revokedAt: null },
      });
      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }
      await prisma.portalSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
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
