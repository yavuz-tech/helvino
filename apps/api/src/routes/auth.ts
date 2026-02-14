/**
 * Admin Authentication Routes
 * 
 * POST /internal/auth/login - Admin login with email/password
 * POST /internal/auth/logout - Admin logout (clear session)
 * GET  /internal/auth/me - Get current admin user info
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import { verifyPassword } from "../utils/password";
import { writeAuditLog } from "../utils/audit-log";
import { validateJsonContentType } from "../middleware/validation";
import { verifyTurnstileToken, isCaptchaConfigured } from "../utils/verify-captcha";
import { getRealIP } from "../utils/get-real-ip";
import { rateLimit } from "../middleware/rate-limiter";
import { isAdminMfaRequired } from "../utils/device";
import { upsertDevice } from "../utils/device";
import {
  adminRateLimitMiddleware,
  clearFailedAdminLogin,
  getAdminAccountLockState,
  isAdminCaptchaRequired,
  recordFailedAdminLogin,
} from "../middleware/admin-rate-limit";

interface LoginBody {
  email: string;
  password: string;
  captchaToken?: string;
  fingerprint?: string;
  deviceId?: string;
  deviceName?: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  const adminLoginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 3,
    message: "Too many admin login attempts",
  });

  /**
   * POST /internal/auth/login
   * 
   * Admin login with email and password.
   * Sets HttpOnly session cookie on success.
   * 
   * Body:
   *   { email, password }
   * 
   * Response (200):
   *   {
   *     ok: true,
   *     user: { id, email, role },
   *     timestamp: ISO string
   *   }
   * 
   * Error responses:
   *   - 400: Missing email or password
   *   - 401: Invalid credentials
   *   - 429: Rate limited
   */
  fastify.post<{
    Body: LoginBody;
  }>("/internal/auth/login", {
    preHandler: [
      adminLoginRateLimit,
      adminRateLimitMiddleware,
      validateJsonContentType,
    ],
    config: {
      skipGlobalRateLimit: true,
    },
  }, async (request, reply) => {
    const { email, password, captchaToken, fingerprint, deviceId, deviceName } = request.body;
    const normalizedEmail = (email || "").toLowerCase().trim();
    const requestIp = getRealIP(request);
    const requestUa = ((request.headers["user-agent"] as string) || "unknown").substring(0, 256);

    // CSRF Protection: Validate Origin header
    const origin = request.headers.origin as string | undefined;
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3006",
      "https://helvion.io",
      process.env.NEXT_PUBLIC_WEB_URL,
    ].filter(Boolean);

    if (origin && !allowedOrigins.some(allowed => origin === allowed)) {
      request.log.warn({ origin }, "Login attempt from unauthorized origin");
      return reply.status(403).send({
        error: "Forbidden: Invalid origin",
      });
    }

    // Validate input
    if (!email || !password) {
      await writeAuditLog(
        "system",
        normalizedEmail || "unknown",
        "admin.login.failed",
        { reason: "validation_error", ip: requestIp },
        request.requestId
      ).catch(() => {});
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Email and password required" },
      });
    }

    const lockState = await getAdminAccountLockState(normalizedEmail);
    if (lockState.locked) {
      await writeAuditLog(
        "system",
        normalizedEmail,
        "admin.login.blocked",
        { reason: "account_locked", ip: requestIp, retryAfterSec: lockState.retryAfterSec },
        request.requestId
      ).catch(() => {});
      reply.header("Retry-After", lockState.retryAfterSec);
      return reply.status(423).send({
        error: {
          code: "ACCOUNT_LOCKED",
          message: "Account is temporarily locked due to failed attempts",
          retryAfterSec: lockState.retryAfterSec,
        },
      });
    }

    const captchaRequired = isCaptchaConfigured() && await isAdminCaptchaRequired(normalizedEmail);
    if (captchaRequired) {
      if (!captchaToken?.trim()) {
        return reply.status(400).send({
          error: {
            code: "CAPTCHA_REQUIRED",
            message: "CAPTCHA verification is required",
          },
        });
      }
      const captchaOk = await verifyTurnstileToken(captchaToken.trim(), requestIp);
      if (!captchaOk) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CAPTCHA",
            message: "CAPTCHA verification failed",
          },
        });
      }
    }

    // Find admin user
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!adminUser) {
      const failed = await recordFailedAdminLogin(normalizedEmail);
      request.log.warn({ email: normalizedEmail }, "Login attempt: user not found");
      await writeAuditLog(
        "system",
        normalizedEmail,
        "admin.login.failed",
        { reason: "invalid_credentials", ip: requestIp, attempts: failed.failedAttempts },
        request.requestId
      ).catch(() => {});
      if (failed.locked) {
        reply.header("Retry-After", failed.retryAfterSec);
        return reply.status(423).send({
          error: {
            code: "ACCOUNT_LOCKED",
            message: "Account is temporarily locked due to failed attempts",
            retryAfterSec: failed.retryAfterSec,
          },
        });
      }
      // Use generic error message to prevent user enumeration
      return reply.status(401).send({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid credentials",
          loginAttempts: failed.failedAttempts,
        },
      });
    }

    // Verify password
    const isValid = await verifyPassword(adminUser.passwordHash, password);

    if (!isValid) {
      const failed = await recordFailedAdminLogin(adminUser.email);
      request.log.warn({ email: normalizedEmail, userId: adminUser.id }, "Login attempt: invalid password");
      await writeAuditLog(
        "system",
        adminUser.email,
        "admin.login.failed",
        { reason: "invalid_credentials", ip: requestIp, attempts: failed.failedAttempts },
        request.requestId
      ).catch(() => {});
      if (failed.locked) {
        reply.header("Retry-After", failed.retryAfterSec);
        return reply.status(423).send({
          error: {
            code: "ACCOUNT_LOCKED",
            message: "Account is temporarily locked due to failed attempts",
            retryAfterSec: failed.retryAfterSec,
          },
        });
      }
      return reply.status(401).send({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid credentials",
          loginAttempts: failed.failedAttempts,
        },
      });
    }

    const hasMfaConfigured = Boolean(adminUser.mfaEnabled && adminUser.mfaSecret);

    // In production, admins must have MFA configured before login.
    if (isAdminMfaRequired() && !hasMfaConfigured) {
      await writeAuditLog(
        "system",
        adminUser.email,
        "admin.login.blocked",
        { reason: "mfa_not_enabled", ip: requestIp },
        request.requestId
      ).catch(() => {});
      return reply.status(403).send({
        error: {
          code: "MFA_REQUIRED_ADMIN",
          message: "MFA is required for all admin users",
        },
      });
    }

    await clearFailedAdminLogin(adminUser.email);

    if (hasMfaConfigured) {
      // Set partial session with MFA pending flag.
      request.session.adminUserId = adminUser.id;
      request.session.adminMfaPending = true;
      delete request.session.adminRole;
      delete request.session.adminEmail;

      request.log.info(
        { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
        "Admin password verified, awaiting MFA"
      );
      await writeAuditLog(
        "system",
        adminUser.email,
        "admin.login.mfa_pending",
        {
          ip: requestIp,
          userAgent: requestUa,
          fingerprint: fingerprint || null,
          deviceId: deviceId || null,
          deviceName: deviceName || null,
        },
        request.requestId
      ).catch(() => {});

      return reply.send({
        ok: false,
        mfaRequired: true,
      });
    }

    // Dev/local fallback: allow login without MFA setup.
    request.session.adminUserId = adminUser.id;
    request.session.adminRole = adminUser.role;
    request.session.adminEmail = adminUser.email;
    delete request.session.adminMfaPending;

    await upsertDevice(
      adminUser.id,
      "admin",
      request.headers["user-agent"] as string | undefined,
      requestIp
    );

    await writeAuditLog(
      "system",
      adminUser.email,
      "admin.login.success",
      { ip: requestIp, mfaConfigured: false },
      request.requestId
    ).catch(() => {});

    return reply.send({
      ok: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /internal/auth/logout
   * 
   * Clear admin session and logout.
   * 
   * Response (200):
   *   { ok: true, timestamp: ISO string }
   */
  fastify.post("/internal/auth/logout", async (request, reply) => {
    const userId = request.session.adminUserId;

    if (userId) {
      request.log.info({ userId }, "Admin logout");
    }

    // Destroy session
    delete request.session.adminUserId;
    delete request.session.adminRole;
    delete request.session.adminEmail;

    return reply.send({
      ok: true,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /internal/auth/me
   * 
   * Get current admin user info from session.
   * 
   * Response (200):
   *   {
   *     ok: true,
   *     user: { id, email, role },
   *     timestamp: ISO string
   *   }
   * 
   * Error responses:
   *   - 401: Not authenticated
   */
  fastify.get("/internal/auth/me", async (request, reply) => {
    const userId = request.session.adminUserId;
    const email = request.session.adminEmail;
    const role = request.session.adminRole;

    if (!userId) {
      return reply.status(401).send({
        error: "Not authenticated",
      });
    }

    // If MFA pending, they haven't completed login
    if (request.session.adminMfaPending) {
      return reply.status(401).send({
        error: "MFA verification pending",
        mfaRequired: true,
      });
    }

    if (!email || !role) {
      return reply.status(401).send({
        error: "Not authenticated",
      });
    }

    // Verify user still exists in database
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!adminUser) {
      // User was deleted, clear invalid session
      delete request.session.adminUserId;
      delete request.session.adminRole;
      delete request.session.adminEmail;
      return reply.status(401).send({
        error: "User no longer exists",
      });
    }

    return reply.send({
      ok: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        mfaEnabled: adminUser.mfaEnabled,
      },
      timestamp: new Date().toISOString(),
    });
  });
}
