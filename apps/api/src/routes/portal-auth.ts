/**
 * Portal Authentication Routes (Customer Portal)
 *
 * Separate cookie + auth flow from internal admin.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "crypto";
import geoip from "geoip-lite";
import { prisma } from "../prisma";
import { verifyPassword } from "../utils/password";
import { validateJsonContentType } from "../middleware/validation";
import { requirePortalUser } from "../middleware/require-portal-user";
import { rateLimit } from "../middleware/rate-limiter";
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  createPortalTokenPair,
  createPortalSessionWithLimit,
  verifyPortalSessionToken,
  getPortalCookiePolicy,
  PORTAL_SESSION_TTL_MS,
  PORTAL_REFRESH_TOKEN_TTL_MS,
} from "../utils/portal-session";
import { upsertDevice } from "../utils/device";
import {
  getAccountUnlockEmail,
  extractLocaleCookie,
  normalizeRequestLocale,
  getLoginNotificationEmailTemplate,
  getNewDeviceDetectedEmail,
  getLocationChangeAlertEmailTemplate,
  getSessionRevokedEmailTemplate,
} from "../utils/email-templates";
import { getDefaultFromAddress, sendEmailAsync } from "../utils/mailer";
import { writeAuditLog } from "../utils/audit-log";
import { verifyTurnstileToken, isCaptchaConfigured } from "../utils/verify-captcha";
import { isKnownDeviceFingerprint } from "../utils/check-device-trust";
import { createEmergencyLockToken, verifyEmergencyLockToken } from "../utils/emergency-lock-token";
import { getRealIP } from "../utils/get-real-ip";
import { validateBody } from "../utils/validate";
import { loginSchema } from "../utils/schemas";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface LoginRequest {
  email: string;
  password: string;
  locale?: string;
  captchaToken?: string;
  fingerprint?: string;
  deviceId?: string;
  deviceName?: string;
}

interface UnlockRequest {
  token: string;
}

interface RefreshRequest {
  refreshToken: string;
}

interface EmergencyLockRequest {
  token: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const UNLOCK_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MFA_SETUP_COOKIE = "helvino_portal_mfa_setup";

function generateUnlockToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function logLoginAttempt(params: {
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failReason?: string;
}) {
  await prisma.loginAttempt.create({
    data: {
      email: params.email,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success,
      failReason: params.failReason || null,
    },
  });
}

export async function portalAuthRoutes(fastify: FastifyInstance) {
  const portalLoginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: "Too many login attempts",
  });

  /**
   * POST /portal/auth/login
   */
  fastify.post<{ Body: LoginRequest }>(
    "/portal/auth/login",
    {
      preHandler: [
        portalLoginRateLimit,
        validateJsonContentType,
      ],
      config: {
        skipGlobalRateLimit: true,
      },
    },
    async (request, reply) => {
      const parsedBody = validateBody(loginSchema, request.body, reply);
      if (!parsedBody) return;

      const { email, password, locale, captchaToken } = parsedBody;
      const deviceFingerprint = parsedBody.fingerprint?.trim();
      const requestedDeviceId = parsedBody.deviceId?.trim();
      const requestedDeviceName = parsedBody.deviceName?.trim();
      const normalizedEmail = (email || "").toLowerCase().trim();
      const requestIp = getRealIP(request);
      const requestUa = ((request.headers["user-agent"] as string) || "unknown").substring(0, 256);
      const cookieLang = extractLocaleCookie(request.headers.cookie as string);
      const preferredLocale = normalizeRequestLocale(
        locale,
        cookieLang,
        request.headers["accept-language"] as string,
        undefined
      );
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      const orgUser = await prisma.orgUser.findUnique({
        where: { email: normalizedEmail },
        include: {
          organization: {
            select: { id: true, key: true, name: true, language: true },
          },
        },
      });

      if (!orgUser) {
        await logLoginAttempt({
          email: normalizedEmail,
          ipAddress: requestIp,
          userAgent: requestUa,
          success: false,
          failReason: "invalid_credentials",
        }).catch(() => {/* ignore */});
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      if (orgUser.isLocked) {
        await logLoginAttempt({
          email: normalizedEmail,
          ipAddress: requestIp,
          userAgent: requestUa,
          success: false,
          failReason: "account_locked",
        }).catch(() => {/* ignore */});
        // Return generic error to prevent user enumeration.
        // The user has already received an unlock email when the account was locked.
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      const captchaRequired = isCaptchaConfigured() && orgUser.loginAttempts >= 3;
      let captchaErrorCode: "CAPTCHA_REQUIRED" | "INVALID_CAPTCHA" | null = null;
      if (captchaRequired) {
        if (!captchaToken?.trim()) {
          captchaErrorCode = "CAPTCHA_REQUIRED";
        } else {
          const captchaValid = await verifyTurnstileToken(captchaToken.trim(), requestIp);
          if (!captchaValid) {
            captchaErrorCode = "INVALID_CAPTCHA";
          }
        }
      }

      const isValid = await verifyPassword(orgUser.passwordHash, password);
      if (!isValid) {
        const nextAttempts = orgUser.loginAttempts + 1;
        const shouldLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;
        const lockTime = new Date();

        await prisma.orgUser.update({
          where: { id: orgUser.id },
          data: {
            loginAttempts: nextAttempts,
            lastFailedLoginAt: lockTime,
            ...(shouldLock ? { isLocked: true, lockedAt: lockTime } : {}),
          },
        });

        await logLoginAttempt({
          email: normalizedEmail,
          ipAddress: requestIp,
          userAgent: requestUa,
          success: false,
          failReason: shouldLock
            ? "account_locked"
            : captchaErrorCode === "CAPTCHA_REQUIRED"
              ? "captcha_required"
              : captchaErrorCode === "INVALID_CAPTCHA"
                ? "invalid_captcha"
                : "invalid_credentials",
        }).catch(() => {/* ignore */});

        if (shouldLock) {
          const rawUnlockToken = generateUnlockToken();
          const unlockTokenHash = hashToken(rawUnlockToken);
          const unlockExpiresAt = new Date(Date.now() + UNLOCK_TOKEN_TTL_MS);

          await prisma.accountUnlockToken.create({
            data: {
              orgUserId: orgUser.id,
              hashedToken: unlockTokenHash,
              expiresAt: unlockExpiresAt,
            },
          });

          const requestedLocale = normalizeRequestLocale(
            preferredLocale,
            cookieLang,
            request.headers["accept-language"] as string,
            orgUser.organization.language || undefined
          );
          const unlockEmail = getAccountUnlockEmail(requestedLocale, rawUnlockToken);

          sendEmailAsync({
            to: orgUser.email,
            from: getDefaultFromAddress(),
            subject: unlockEmail.subject,
            html: unlockEmail.html,
            text: unlockEmail.text,
            tags: ["security", "account-lockout"],
          });

          writeAuditLog(
            orgUser.orgId,
            orgUser.email,
            "security.account_locked",
            { reason: "max_failed_login_attempts", requestIp, requestUa },
            requestId
          ).catch(() => {/* ignore */});

          reply.code(423);
          return {
            error: {
              code: "ACCOUNT_LOCKED",
              message: "Account locked due to too many failed attempts.",
              loginAttempts: nextAttempts,
            },
          };
        }

        if (captchaErrorCode) {
          reply.code(400);
          return {
            error: {
              code: captchaErrorCode,
              message:
                captchaErrorCode === "CAPTCHA_REQUIRED"
                  ? "CAPTCHA verification is required"
                  : "CAPTCHA verification failed",
              loginAttempts: nextAttempts,
            },
          };
        }

        reply.code(401);
        return {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
            loginAttempts: nextAttempts,
          },
        };
      }

      // Check if user is active — return generic error to prevent user enumeration
      if (orgUser.isActive === false) {
        await logLoginAttempt({
          email: normalizedEmail,
          ipAddress: requestIp,
          userAgent: requestUa,
          success: false,
          failReason: "account_deactivated",
        }).catch(() => {/* ignore */});
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Check email verification (Step 11.36)
      // Return error code for frontend UX, but keep message generic to limit enumeration.
      if (!orgUser.emailVerifiedAt) {
        await logLoginAttempt({
          email: normalizedEmail,
          ipAddress: requestIp,
          userAgent: requestUa,
          success: false,
          failReason: "email_verification_required",
        }).catch(() => {/* ignore */});
        reply.code(401);
        return {
          error: {
            code: "EMAIL_VERIFICATION_REQUIRED",
            message: "Invalid email or password",
            requestId,
          },
        };
      }

      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        reply.code(500);
        return { error: "Internal server configuration error" };
      }

      // Check if MFA is enabled
      if (orgUser.mfaEnabled && orgUser.mfaSecret) {
        await logLoginAttempt({
          email: normalizedEmail,
          ipAddress: requestIp,
          userAgent: requestUa,
          success: true,
        }).catch(() => {/* ignore */});
        // Issue a short-lived MFA token instead of full session
        const mfaToken = createPortalSessionToken(
          {
            userId: orgUser.id,
            orgId: orgUser.orgId,
            role: orgUser.role,
          },
          secret
        );

        return {
          ok: false,
          mfaRequired: true,
          mfaToken,
        };
      }

      if (captchaErrorCode) {
        reply.code(400);
        return {
          error: {
            code: captchaErrorCode,
            message:
              captchaErrorCode === "CAPTCHA_REQUIRED"
                ? "CAPTCHA verification is required"
                : "CAPTCHA verification failed",
            loginAttempts: orgUser.loginAttempts,
          },
        };
      }

      const geo = requestIp !== "unknown" ? geoip.lookup(requestIp) : null;
      const loginCountry = geo?.country || null;
      const loginCity = geo?.city || null;
      const previousCountry = orgUser.lastLoginCountry || null;
      const locationLabel = [loginCity, loginCountry].filter(Boolean).join(", ") || "Unknown";
      const lockToken = createEmergencyLockToken(orgUser.id);
      const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
      const lockUrl = `${appUrl}/portal/login?emergencyLockToken=${encodeURIComponent(lockToken)}`;
      const deviceName = requestedDeviceName || requestUa;
      const deviceId = requestedDeviceId || (deviceFingerprint ? `fp:${deviceFingerprint.slice(0, 16)}` : null);
      const seenBefore = deviceFingerprint
        ? await isKnownDeviceFingerprint(orgUser.id, deviceFingerprint)
        : true;
      const previousSession = await prisma.portalSession.findFirst({
        where: { orgUserId: orgUser.id },
        orderBy: { lastSeenAt: "desc" },
        select: {
          ip: true,
          deviceFingerprint: true,
          deviceId: true,
          userAgent: true,
        },
      });
      const fingerprintMatch =
        Boolean(deviceFingerprint) &&
        Boolean(previousSession?.deviceFingerprint) &&
        previousSession?.deviceFingerprint === deviceFingerprint;
      const deviceIdMatch =
        Boolean(deviceId) &&
        Boolean(previousSession?.deviceId) &&
        previousSession?.deviceId === deviceId;
      const userAgentMatch =
        Boolean(requestUa) &&
        Boolean(previousSession?.userAgent) &&
        previousSession?.userAgent === requestUa;
      const sameDevice = fingerprintMatch || deviceIdMatch || (!deviceFingerprint && !deviceId && userAgentMatch);
      const sameIp =
        Boolean(previousSession?.ip) &&
        requestIp !== "unknown" &&
        previousSession?.ip === requestIp;
      // Avoid spamming "new login" emails when only IP changes (mobile/WiFi/VPN).
      // Only notify when the device is actually different.
      const shouldSendLoginNotification = !sameDevice;

      // Update lastLoginAt
      await prisma.orgUser.update({
        where: { id: orgUser.id },
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

      await logLoginAttempt({
        email: normalizedEmail,
        ipAddress: requestIp,
        userAgent: requestUa,
        success: true,
      }).catch(() => {/* ignore */});

      let tokens = createPortalTokenPair(
        {
          userId: orgUser.id,
          orgId: orgUser.orgId,
          role: orgUser.role,
        },
        secret
      );

      let sessionResult;
      try {
        sessionResult = await createPortalSessionWithLimit({
          orgUserId: orgUser.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessExpiresAt: tokens.accessExpiresAt,
          refreshExpiresAt: tokens.refreshExpiresAt,
          ip: requestIp !== "unknown" ? requestIp : null,
          userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
          deviceFingerprint: deviceFingerprint || null,
          deviceId,
          deviceName,
          loginCountry,
          loginCity,
        });
      } catch (error) {
        // Rare race: regenerate tokens and retry once.
        if (isUniqueConstraintError(error)) {
          tokens = createPortalTokenPair(
            {
              userId: orgUser.id,
              orgId: orgUser.orgId,
              role: orgUser.role,
            },
            secret
          );
          sessionResult = await createPortalSessionWithLimit({
            orgUserId: orgUser.id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessExpiresAt: tokens.accessExpiresAt,
            refreshExpiresAt: tokens.refreshExpiresAt,
            ip: requestIp !== "unknown" ? requestIp : null,
            userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
            deviceFingerprint: deviceFingerprint || null,
            deviceId,
            deviceName,
            loginCountry,
            loginCity,
          });
        } else {
          request.log.error({ err: error }, "Failed to create portal session");
          reply.code(500);
          return {
            error: {
              code: "SESSION_CREATE_FAILED",
              message: "Unable to create session. Please try again.",
            },
          };
        }
      }

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
        orgUser.id,
        "portal",
        request.headers["user-agent"] as string | undefined,
        requestIp
      );

      // Security emails should not block login.
      const nowIso = new Date().toISOString();
      const securityLocale = normalizeRequestLocale(
        preferredLocale,
        cookieLang,
        request.headers["accept-language"] as string,
        orgUser.organization.language || undefined
      );
      if (shouldSendLoginNotification) {
        const loginNotification = getLoginNotificationEmailTemplate(securityLocale, {
          time: nowIso,
          ip: requestIp,
          device: deviceName,
          location: locationLabel,
          securityUrl: lockUrl,
        });
        const loginEmailHtml = loginNotification.html;
        sendEmailAsync({
          to: orgUser.email,
          from: getDefaultFromAddress(),
          subject: loginNotification.subject,
          html: loginEmailHtml,
          text: loginNotification.text,
          tags: ["security", "login-notification"],
        });
      }

      if (!seenBefore && deviceFingerprint) {
        const newDevice = getNewDeviceDetectedEmail(securityLocale, {
          time: nowIso,
          ip: requestIp,
          device: deviceName,
          location: locationLabel,
          securityUrl: lockUrl,
        });
        sendEmailAsync({
          to: orgUser.email,
          from: getDefaultFromAddress(),
          subject: newDevice.subject,
          html: newDevice.html,
          text: newDevice.text,
          tags: ["security", "new-device"],
        });
      }

      if (previousCountry && loginCountry && previousCountry !== loginCountry) {
        const locationAlert = getLocationChangeAlertEmailTemplate(securityLocale, {
          previousLocation: previousCountry,
          newLocation: locationLabel,
          securityUrl: lockUrl,
        });
        sendEmailAsync({
          to: orgUser.email,
          from: getDefaultFromAddress(),
          subject: locationAlert.subject,
          html: locationAlert.html,
          text: locationAlert.text,
          tags: ["security", "location-change"],
        });
      }

      if (sessionResult.revokedSession) {
        const revokedEmail = getSessionRevokedEmailTemplate(securityLocale, {
          deviceName: sessionResult.revokedSession.deviceName || "Unknown device",
          sessionsUrl: `${appUrl}/portal/settings/sessions`,
        });
        sendEmailAsync({
          to: orgUser.email,
          from: getDefaultFromAddress(),
          subject: revokedEmail.subject,
          html: revokedEmail.html,
          text: revokedEmail.text,
          tags: ["security", "session-limit"],
        });
      }

      return {
        ok: true,
        refreshToken: tokens.refreshToken,
        refreshExpiresInSec: Math.floor(PORTAL_REFRESH_TOKEN_TTL_MS / 1000),
        showSecurityOnboarding: !orgUser.mfaEnabled && !orgUser.securityOnboardingDismissedAt,
        user: {
          id: orgUser.id,
          email: orgUser.email,
          role: orgUser.role,
          orgId: orgUser.orgId,
          orgKey: orgUser.organization.key,
          orgName: orgUser.organization.name,
        },
      };
    }
  );

  /**
   * POST /api/portal/security-onboarding/dismiss
   * POST /portal/security-onboarding/dismiss
   */
  type OnboardingActorResolution = {
    actor: { id: string; orgId: string; email: string; role: string };
    source: "request_user" | "portal_session" | "mfa_setup_token";
  };

  const resolveOnboardingActor = async (
    request: FastifyRequest,
    setupToken?: string
  ): Promise<OnboardingActorResolution | null> => {
    if (request.portalUser) {
      return { actor: request.portalUser, source: "request_user" };
    }
    const sessionSecret = process.env.SESSION_SECRET;

    // 1) Try regular portal session cookie
    const portalSessionToken = request.cookies[PORTAL_SESSION_COOKIE];
    if (portalSessionToken && sessionSecret) {
      const sessionPayload = verifyPortalSessionToken(portalSessionToken, sessionSecret);
      if (sessionPayload) {
        const sessionUser = await prisma.orgUser.findUnique({
          where: { id: sessionPayload.userId },
          select: { id: true, orgId: true, email: true, role: true },
        });
        if (sessionUser) {
          return { actor: sessionUser, source: "portal_session" };
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
    if (!user) return null;
    return { actor: user, source: "mfa_setup_token" };
  };

  const ensurePortalSessionFromOnboardingActor = async (
    request: FastifyRequest,
    reply: FastifyReply,
    actor: { id: string; orgId: string; email: string; role: string }
  ) => {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      reply.code(500);
      return { error: "Internal server configuration error" };
    }

    const orgUser = await prisma.orgUser.findUnique({
      where: { id: actor.id },
      include: {
        organization: { select: { key: true, name: true } },
      },
    });
    if (!orgUser) {
      reply.code(404);
      return { error: "User not found" };
    }

    const tokens = createPortalTokenPair(
      { userId: orgUser.id, orgId: orgUser.orgId, role: orgUser.role },
      secret
    );

    await createPortalSessionWithLimit({
      orgUserId: orgUser.id,
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
      maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
    });
    reply.clearCookie(MFA_SETUP_COOKIE, { path: "/" });

    return {
      ok: true,
      refreshToken: tokens.refreshToken,
      refreshExpiresInSec: Math.floor(PORTAL_REFRESH_TOKEN_TTL_MS / 1000),
      user: {
        id: orgUser.id,
        email: orgUser.email,
        role: orgUser.role,
        orgId: orgUser.orgId,
        orgKey: orgUser.organization.key,
        orgName: orgUser.organization.name,
      },
    };
  };

  const dismissSecurityOnboardingHandler = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const body = (request.body || {}) as { setupToken?: string };
    const resolved = await resolveOnboardingActor(request, body.setupToken);
    if (!resolved) {
      reply.code(401);
      return { error: "Authentication required" };
    }
    const { actor, source } = resolved;
    await prisma.orgUser.update({
      where: { id: actor.id },
      data: {
        securityOnboardingShown: true,
        securityOnboardingDismissedAt: new Date(),
      },
    });

    // If this is an MFA-setup-token flow (no active portal session yet),
    // create a regular portal session so "Skip for now" lands in portal.
    if (source === "mfa_setup_token") {
      return ensurePortalSessionFromOnboardingActor(request, reply, actor);
    }

    return { ok: true };
  };

  const continueSecurityOnboardingHandler = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const body = (request.body || {}) as { setupToken?: string };
    const resolved = await resolveOnboardingActor(request, body.setupToken);
    if (!resolved) {
      reply.code(401);
      return { error: "Authentication required" };
    }
    const { actor, source } = resolved;

    // Do not change onboarding flags; just ensure user can continue.
    if (source === "mfa_setup_token") {
      return ensurePortalSessionFromOnboardingActor(request, reply, actor);
    }

    return { ok: true };
  };

  fastify.post(
    "/api/portal/security-onboarding/dismiss",
    { preHandler: [validateJsonContentType] },
    dismissSecurityOnboardingHandler
  );
  fastify.post(
    "/portal/security-onboarding/dismiss",
    { preHandler: [validateJsonContentType] },
    dismissSecurityOnboardingHandler
  );
  fastify.post(
    "/api/portal/security-onboarding/continue",
    { preHandler: [validateJsonContentType] },
    continueSecurityOnboardingHandler
  );
  fastify.post(
    "/portal/security-onboarding/continue",
    { preHandler: [validateJsonContentType] },
    continueSecurityOnboardingHandler
  );

  /**
   * POST /portal/auth/refresh
   */
  fastify.post<{ Body: RefreshRequest }>(
    "/portal/auth/refresh",
    { preHandler: [validateJsonContentType] },
    async (request, reply) => {
      const refreshToken = (request.body?.refreshToken || "").trim();
      if (!refreshToken) {
        reply.code(400);
        return { error: { code: "REFRESH_TOKEN_REQUIRED", message: "refreshToken is required" } };
      }

      const session = await prisma.portalSession.findUnique({
        where: { refreshToken },
        include: {
          orgUser: {
            include: {
              organization: { select: { key: true, name: true } },
            },
          },
        },
      });

      if (!session || session.revokedAt) {
        reply.code(401);
        return { error: { code: "INVALID_REFRESH_TOKEN", message: "Invalid refresh token" } };
      }

      if (session.refreshExpiresAt <= new Date()) {
        await prisma.portalSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        }).catch(() => {/* ignore */});
        reply.code(401);
        return { error: { code: "REFRESH_TOKEN_EXPIRED", message: "Refresh token has expired" } };
      }

      if (!session.orgUser.isActive) {
        reply.code(403);
        return { error: "Account is deactivated" };
      }

      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        reply.code(500);
        return { error: "Internal server configuration error" };
      }

      const now = Date.now();
      const shouldRotateRefresh = session.refreshExpiresAt.getTime() - now < 24 * 60 * 60 * 1000;
      const tokens = createPortalTokenPair(
        { userId: session.orgUser.id, orgId: session.orgUser.orgId, role: session.orgUser.role },
        secret
      );

      await prisma.portalSession.update({
        where: { id: session.id },
        data: {
          tokenHash: hashToken(tokens.accessToken),
          accessExpiresAt: tokens.accessExpiresAt,
          refreshToken: shouldRotateRefresh ? tokens.refreshToken : session.refreshToken,
          refreshExpiresAt: shouldRotateRefresh ? tokens.refreshExpiresAt : session.refreshExpiresAt,
          lastSeenAt: new Date(),
          ip: getRealIP(request) !== "unknown" ? getRealIP(request) : session.ip,
          userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || session.userAgent,
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

      return {
        ok: true,
        refreshToken: shouldRotateRefresh ? tokens.refreshToken : session.refreshToken,
        refreshExpiresInSec: shouldRotateRefresh ? Math.floor(PORTAL_REFRESH_TOKEN_TTL_MS / 1000) : undefined,
        showSecurityOnboarding:
          !session.orgUser.mfaEnabled && !session.orgUser.securityOnboardingDismissedAt,
        user: {
          id: session.orgUser.id,
          email: session.orgUser.email,
          role: session.orgUser.role,
          orgId: session.orgUser.orgId,
          orgKey: session.orgUser.organization.key,
          orgName: session.orgUser.organization.name,
          mfaEnabled: session.orgUser.mfaEnabled || false,
        },
      };
    }
  );

  /**
   * POST /portal/auth/emergency-lock
   */
  fastify.post<{ Body: EmergencyLockRequest }>(
    "/portal/auth/emergency-lock",
    { preHandler: [validateJsonContentType] },
    async (request, reply) => {
      const token = (request.body?.token || "").trim();
      if (!token) {
        reply.code(400);
        return { error: "Emergency lock token is required" };
      }

      const parsed = verifyEmergencyLockToken(token);
      if (!parsed) {
        reply.code(400);
        return { error: "Invalid or expired emergency lock token" };
      }

      const user = await prisma.orgUser.findUnique({
        where: { id: parsed.userId },
      });
      if (!user) {
        reply.code(404);
        return { error: "User not found" };
      }

      await prisma.$transaction([
        prisma.orgUser.update({
          where: { id: user.id },
          data: {
            isLocked: true,
            lockedAt: new Date(),
          },
        }),
        prisma.portalSession.updateMany({
          where: {
            orgUserId: user.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        }),
      ]);

      writeAuditLog(
        user.orgId,
        user.email,
        "security.emergency_lock",
        { ip: getRealIP(request) },
        request.requestId
      ).catch(() => {/* ignore */});

      return { ok: true, message: "Account locked and sessions revoked" };
    }
  );

  /**
   * POST /portal/auth/unlock
   */
  fastify.post<{ Body: UnlockRequest }>(
    "/portal/auth/unlock",
    { preHandler: [validateJsonContentType] },
    async (request, reply) => {
      const token = (request.body?.token || "").trim();
      if (!token) {
        reply.code(400);
        return {
          error: {
            code: "TOKEN_REQUIRED",
            message: "Unlock token is required",
          },
        };
      }

      const tokenHash = hashToken(token);
      const unlockRecord = await prisma.accountUnlockToken.findUnique({
        where: { hashedToken: tokenHash },
        include: {
          orgUser: {
            select: { id: true, orgId: true, email: true },
          },
        },
      });

      if (!unlockRecord) {
        reply.code(400);
        return {
          error: {
            code: "UNLOCK_TOKEN_INVALID",
            message: "Invalid unlock token",
          },
        };
      }

      if (unlockRecord.usedAt) {
        reply.code(400);
        return {
          error: {
            code: "UNLOCK_TOKEN_USED",
            message: "Unlock token has already been used",
          },
        };
      }

      if (unlockRecord.expiresAt <= new Date()) {
        reply.code(400);
        return {
          error: {
            code: "UNLOCK_TOKEN_EXPIRED",
            message: "Unlock token has expired",
          },
        };
      }

      await prisma.$transaction([
        prisma.orgUser.update({
          where: { id: unlockRecord.orgUser.id },
          data: {
            isLocked: false,
            lockedAt: null,
            loginAttempts: 0,
            lastFailedLoginAt: null,
          },
        }),
        prisma.accountUnlockToken.update({
          where: { id: unlockRecord.id },
          data: { usedAt: new Date() },
        }),
      ]);

      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;
      writeAuditLog(
        unlockRecord.orgUser.orgId,
        unlockRecord.orgUser.email,
        "security.account_unlocked",
        { method: "token" },
        requestId
      ).catch(() => {/* ignore */});

      return { ok: true, message: "Account unlocked successfully" };
    }
  );

  /**
   * POST /portal/auth/logout
   */
  fastify.post("/portal/auth/logout", async (request, reply) => {
    // Revoke session record
    const token = request.cookies[PORTAL_SESSION_COOKIE];
    if (token) {
      const tokenHash = hashToken(token);
      await prisma.portalSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }).catch(() => {/* ignore */});
    }
    reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  /**
   * GET /portal/auth/me
   */
  fastify.get("/portal/auth/me", async (request, reply) => {
    const token = request.cookies[PORTAL_SESSION_COOKIE];
    if (!token) {
      reply.code(401);
      return { error: "Not authenticated" };
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      reply.code(500);
      return { error: "Internal server configuration error" };
    }

    const parsed = verifyPortalSessionToken(token, secret, { ignoreExpiration: true });
    if (!parsed) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
      reply.code(401);
      return { error: "Invalid session" };
    }
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp && now > parsed.exp) {
      reply.code(401);
      return { error: { code: "TOKEN_EXPIRED", message: "token_expired" } };
    }

    const tokenHash = hashToken(token);
    const sessionRecord = await prisma.portalSession.findUnique({
      where: { tokenHash },
      select: { id: true, orgUserId: true, revokedAt: true, accessExpiresAt: true },
    });
    if (!sessionRecord || sessionRecord.revokedAt || sessionRecord.orgUserId !== parsed.userId) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
      reply.code(401);
      return { error: "Invalid session" };
    }
    if (sessionRecord.accessExpiresAt <= new Date()) {
      reply.code(401);
      return { error: { code: "TOKEN_EXPIRED", message: "token_expired" } };
    }

    const orgUser = await prisma.orgUser.findUnique({
      where: { id: parsed.userId },
      include: {
        organization: {
          select: { id: true, key: true, name: true },
        },
      },
    });

    if (!orgUser) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
      reply.code(401);
      return { error: "User not found" };
    }

    if (orgUser.isActive === false) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
      reply.code(403);
      return { error: "Account is deactivated" };
    }

    prisma.portalSession.update({
      where: { id: sessionRecord.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => {/* ignore */});

    return {
      ok: true,
      showSecurityOnboarding: !orgUser.mfaEnabled && !orgUser.securityOnboardingDismissedAt,
      user: {
        id: orgUser.id,
        email: orgUser.email,
        role: orgUser.role,
        orgId: orgUser.orgId,
        orgKey: orgUser.organization.key,
        orgName: orgUser.organization.name,
        mfaEnabled: orgUser.mfaEnabled || false,
      },
    };
  });
}
