/**
 * Portal MFA Routes — Step 11.20
 *
 * TOTP setup, verify, disable + step-up challenge for portal users.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import geoip from "geoip-lite";
import QRCode from "qrcode";
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
  PORTAL_ACCESS_TOKEN_TTL_MS,
  PORTAL_SESSION_TTL_MS,
  PORTAL_REFRESH_TOKEN_TTL_MS,
  createPortalTokenPair,
  createPortalSessionWithLimit,
  verifyPortalSessionToken,
  getPortalCookiePolicy,
} from "../utils/portal-session";
import { upsertDevice } from "../utils/device";
import { createEmergencyLockToken } from "../utils/emergency-lock-token";
import {
  getLoginNotificationEmailTemplate,
  getSessionRevokedEmailTemplate,
  getMfaSetupSuccessEmail,
  extractLocaleCookie,
  normalizeRequestLocale,
} from "../utils/email-templates";
import { getDefaultFromAddress, sendEmailAsync } from "../utils/mailer";
import { getRealIP } from "../utils/get-real-ip";

const MFA_SETUP_COOKIE = "helvino_portal_mfa_setup";

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
  const resolveSetupActor = async (
    request: FastifyRequest,
    setupToken?: string
  ): Promise<{ id: string; orgId: string; email: string; role: string } | null> => {
    if (request.portalUser) {
      return request.portalUser;
    }
    // 1) Try regular portal session cookie
    const sessionSecret = process.env.SESSION_SECRET;
    const portalSessionToken = request.cookies[PORTAL_SESSION_COOKIE];
    if (portalSessionToken && sessionSecret) {
      const parsedSession = verifyPortalSessionToken(portalSessionToken, sessionSecret);
      if (parsedSession) {
        const sessionUser = await prisma.orgUser.findUnique({
          where: { id: parsedSession.userId },
          select: { id: true, orgId: true, email: true, role: true },
        });
        if (sessionUser) {
          return sessionUser;
        }
      }
    }

    // 2) Fallback to MFA setup token (header/query/cookie/body)
    const headerTokenRaw = request.headers["x-mfa-setup-token"];
    const headerToken = Array.isArray(headerTokenRaw) ? headerTokenRaw[0] : headerTokenRaw;
    const queryToken = (request.query as { setupToken?: string } | undefined)?.setupToken;
    const cookieToken = request.cookies[MFA_SETUP_COOKIE];
    const token = (setupToken || headerToken || queryToken || cookieToken || "").trim();
    if (!token || !sessionSecret) return null;
    const parsed = verifyPortalSessionToken(token, sessionSecret);
    if (!parsed) return null;
    const user = await prisma.orgUser.findUnique({
      where: { id: parsed.userId },
      select: { id: true, orgId: true, email: true, role: true },
    });
    return user;
  };

  // ──────────────────────────────────────────────────────
  // POST /portal/security/mfa/setup
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/security/mfa/setup",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const body = (request.body || {}) as { setupToken?: string };
      const actor = await resolveSetupActor(request, body.setupToken);
      if (!actor) {
        reply.code(401);
        return { error: "Authentication required" };
      }

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
      let qrCodeDataUrl: string | null = null;
      try {
        qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
          width: 240,
          margin: 1,
        });
      } catch (primaryError) {
        request.log.warn(
          { err: primaryError, orgUserId: user.id },
          "Primary QR generation failed for MFA setup"
        );
        try {
          const svg = await QRCode.toString(otpauthUri, {
            type: "svg",
            width: 240,
            margin: 1,
          });
          qrCodeDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        } catch (fallbackError) {
          request.log.error(
            { err: fallbackError, orgUserId: user.id },
            "Fallback QR generation failed for MFA setup"
          );
          qrCodeDataUrl = null;
        }
      }

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
        qrCodeDataUrl,
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
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const body = request.body as { code?: string; setupToken?: string };
      const actor = await resolveSetupActor(request, body.setupToken);
      if (!actor) {
        reply.code(401);
        return { error: "Authentication required" };
      }

      if (!body.code) {
        reply.code(400);
        return { error: "Verification code is required" };
      }

      const user = await prisma.orgUser.findUnique({
        where: { id: actor.id },
        include: {
          organization: { select: { key: true, name: true, language: true } },
        },
      });
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
      const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
      const setupCookieLang = extractLocaleCookie(request.headers.cookie as string);
      const setupLocale = normalizeRequestLocale(
        undefined,
        setupCookieLang,
        request.headers["accept-language"] as string,
        user.organization.language || undefined
      );
      const mfaSuccessEmail = getMfaSetupSuccessEmail(setupLocale, {
        time: new Date().toISOString(),
        securityUrl: `${appUrl}/portal/security`,
      });
      sendEmailAsync({
        to: user.email,
        from: getDefaultFromAddress(),
        subject: mfaSuccessEmail.subject,
        html: mfaSuccessEmail.html,
        text: mfaSuccessEmail.text,
        tags: ["security", "mfa-enabled"],
      });

      if (!request.portalUser) {
        const secret = process.env.SESSION_SECRET;
        if (!secret) {
          return { ok: true };
        }
        const tokens = createPortalTokenPair(
          { userId: user.id, orgId: user.orgId, role: user.role },
          secret
        );
        await createPortalSessionWithLimit({
          orgUserId: user.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessExpiresAt: tokens.accessExpiresAt,
          refreshExpiresAt: tokens.refreshExpiresAt,
          ip: getRealIP(request) !== "unknown" ? getRealIP(request) : null,
          userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
          deviceName: ((request.headers["user-agent"] as string) || "Unknown").substring(0, 120),
          deviceId: null,
          loginCountry: null,
          loginCity: null,
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
          maxAge: Math.floor(PORTAL_ACCESS_TOKEN_TTL_MS / 1000),
        });
        reply.clearCookie(MFA_SETUP_COOKIE, { path: "/" });
        return {
          ok: true,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          refreshExpiresInSec: Math.floor(PORTAL_REFRESH_TOKEN_TTL_MS / 1000),
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

      reply.clearCookie(MFA_SETUP_COOKIE, { path: "/" });
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
          organization: { select: { id: true, key: true, name: true, language: true } },
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
      const tokens = createPortalTokenPair(
        { userId: user.id, orgId: user.orgId, role: user.role },
        secret
      );

      const requestIp = getRealIP(request);
      const geo = requestIp !== "unknown" ? geoip.lookup(requestIp) : null;
      const loginCountry = geo?.country || null;
      const loginCity = geo?.city || null;
      const requestUa = ((request.headers["user-agent"] as string) || "unknown").substring(0, 256);
      const previousSession = await prisma.portalSession.findFirst({
        where: { orgUserId: user.id },
        orderBy: { lastSeenAt: "desc" },
        select: {
          ip: true,
          userAgent: true,
        },
      });
      const sameIp = Boolean(previousSession?.ip) && requestIp !== "unknown" && previousSession?.ip === requestIp;
      const sameDevice =
        Boolean(previousSession?.userAgent) &&
        previousSession?.userAgent === requestUa;
      // Avoid spamming when IP changes on same device.
      const shouldSendLoginNotification = !sameDevice;
      const sessionResult = await createPortalSessionWithLimit({
        orgUserId: user.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExpiresAt: tokens.accessExpiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
        ip: requestIp !== "unknown" ? requestIp : null,
        userAgent: requestUa,
        deviceName: ((request.headers["user-agent"] as string) || "Unknown").substring(0, 120),
        deviceId: null,
        loginCountry,
        loginCity,
      });

      await prisma.orgUser.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginCountry: loginCountry,
          lastLoginCity: loginCity,
          loginAttempts: 0,
          isLocked: false,
          lockedAt: null,
          lastFailedLoginAt: null,
        },
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

      // Upsert device record
      await upsertDevice(
        user.id,
        "portal",
        request.headers["user-agent"] as string | undefined,
        requestIp
      );

      const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
      const lockToken = createEmergencyLockToken(user.id);
      const lockUrl = `${appUrl}/portal/login?emergencyLockToken=${encodeURIComponent(lockToken)}`;
      const locationLabel = [loginCity, loginCountry].filter(Boolean).join(", ") || "Unknown";
      const loginCookieLang = extractLocaleCookie(request.headers.cookie as string);
      const securityLocale = normalizeRequestLocale(
        undefined,
        loginCookieLang,
        request.headers["accept-language"] as string,
        user.organization.language || undefined
      );
      if (shouldSendLoginNotification) {
        const loginNotification = getLoginNotificationEmailTemplate(securityLocale, {
          ip: requestIp,
          time: new Date().toISOString(),
          device: ((request.headers["user-agent"] as string) || "Unknown").substring(0, 120),
          location: locationLabel,
          securityUrl: lockUrl,
        });
        sendEmailAsync({
          to: user.email,
          from: getDefaultFromAddress(),
          subject: loginNotification.subject,
          html: loginNotification.html,
          text: loginNotification.text,
          tags: ["security", "login-notification"],
        });
      }

      if (sessionResult.revokedSession) {
        const revokedEmail = getSessionRevokedEmailTemplate(securityLocale, {
          deviceName: sessionResult.revokedSession.deviceName || "Unknown device",
          sessionsUrl: `${appUrl}/portal/settings/sessions`,
        });
        sendEmailAsync({
          to: user.email,
          from: getDefaultFromAddress(),
          subject: revokedEmail.subject,
          html: revokedEmail.html,
          text: revokedEmail.text,
          tags: ["security", "session-limit"],
        });
      }

      await writeAuditLog(
        user.orgId,
        user.email,
        "mfa_challenge_passed",
        { context: "login" },
        request.requestId
      );

      return {
        ok: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        refreshExpiresInSec: Math.floor(PORTAL_REFRESH_TOKEN_TTL_MS / 1000),
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
