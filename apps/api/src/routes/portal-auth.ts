/**
 * Portal Authentication Routes (Customer Portal)
 *
 * Separate cookie + auth flow from internal admin.
 */

import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma } from "../prisma";
import { verifyPassword } from "../utils/password";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { validateJsonContentType } from "../middleware/validation";
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  verifyPortalSessionToken,
  PORTAL_SESSION_TTL_MS,
} from "../utils/portal-session";
import { upsertDevice } from "../utils/device";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface LoginRequest {
  email: string;
  password: string;
}

export async function portalAuthRoutes(fastify: FastifyInstance) {
  /**
   * POST /portal/auth/login
   */
  fastify.post<{ Body: LoginRequest }>(
    "/portal/auth/login",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }), // 10/min
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const { email, password } = request.body;

      if (!email || !password) {
        reply.code(400);
        return { error: "Email and password are required" };
      }

      const orgUser = await prisma.orgUser.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
          organization: {
            select: { id: true, key: true, name: true },
          },
        },
      });

      if (!orgUser) {
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      const isValid = await verifyPassword(orgUser.passwordHash, password);
      if (!isValid) {
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Check if user is active
      if (orgUser.isActive === false) {
        reply.code(403);
        return { error: "Account is deactivated" };
      }

      // Check email verification (Step 11.36)
      if (!orgUser.emailVerifiedAt) {
        const requestId =
          (request as any).requestId ||
          (request.headers["x-request-id"] as string) ||
          undefined;
        reply.code(403);
        return {
          error: {
            code: "EMAIL_VERIFICATION_REQUIRED",
            message: "Please verify your email address before logging in.",
            requestId,
          },
        };
      }

      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        reply.code(500);
        return { error: "SESSION_SECRET not configured" };
      }

      // Check if MFA is enabled
      if (orgUser.mfaEnabled && orgUser.mfaSecret) {
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

      // Update lastLoginAt
      await prisma.orgUser.update({
        where: { id: orgUser.id },
        data: { lastLoginAt: new Date() },
      });

      const token = createPortalSessionToken(
        {
          userId: orgUser.id,
          orgId: orgUser.orgId,
          role: orgUser.role,
        },
        secret
      );

      // Create session record
      const tokenHash = hashToken(token);
      await prisma.portalSession.create({
        data: {
          orgUserId: orgUser.id,
          tokenHash,
          ip: request.ip || null,
          userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
        },
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
        orgUser.id,
        "portal",
        request.headers["user-agent"] as string | undefined,
        request.ip
      );

      return {
        ok: true,
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
      return { error: "SESSION_SECRET not configured" };
    }

    const parsed = verifyPortalSessionToken(token, secret);
    if (!parsed) {
      reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
      reply.code(401);
      return { error: "Invalid session" };
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

    return {
      ok: true,
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
