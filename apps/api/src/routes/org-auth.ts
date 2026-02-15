/**
 * Org User Authentication Routes (Customer Portal) — LEGACY
 *
 * @deprecated Use /portal/auth/* routes instead (portal-auth.ts).
 * This legacy route is kept for backward compatibility with org-app pages.
 * It has been hardened with: stricter rate limiting, account lockout check,
 * active status check, generic error messages, and deprecation logging.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { verifyPasswordWithDummy } from "../utils/password";
import { createRateLimitMiddleware } from "../middleware/rate-limit";

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  ok: true;
  user: {
    id: string;
    email: string;
    role: string;
    orgId: string;
    orgKey: string;
    orgName: string;
  };
}

async function regenerateSessionIfSupported(request: any): Promise<void> {
  const sessionAny = request.session as any;
  if (!sessionAny || typeof sessionAny.regenerate !== "function") return;
  await new Promise<void>((resolve, reject) => {
    sessionAny.regenerate((err: unknown) => (err ? reject(err) : resolve()));
  });
}

export async function orgAuthRoutes(fastify: FastifyInstance) {
  /**
   * POST /org/auth/login
   *
   * @deprecated Use POST /portal/auth/login instead.
   * Legacy org user authentication with security hardening.
   */
  fastify.post<{ Body: LoginRequest; Reply: LoginResponse | { error: string } }>(
    "/org/auth/login",
    {
      preHandler: [
        // Stricter rate limit: 5 per 15 minutes per IP (matching portal-auth)
        createRateLimitMiddleware({ limit: 5, windowMs: 15 * 60 * 1000 }),
      ],
    },
    async (request, reply) => {
      request.log.warn("DEPRECATED: /org/auth/login called — migrate to /portal/auth/login");

      const { email, password } = request.body;

      // Validate input
      if (!email || !password) {
        reply.code(400);
        return { error: "Email and password are required" };
      }

      // Find org user by email
      const orgUser = await prisma.orgUser.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
          organization: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      });

      // Generic error for user-not-found (prevent enumeration)
      if (!orgUser) {
        await verifyPasswordWithDummy(null, password);
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Account lockout check (missing in original)
      if (orgUser.isLocked) {
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Active status check (missing in original)
      if (orgUser.isActive === false) {
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Verify password
      const isValid = await verifyPasswordWithDummy(orgUser.passwordHash, password);

      if (!isValid) {
        // Increment login attempts for lockout tracking
        const nextAttempts = orgUser.loginAttempts + 1;
        await prisma.orgUser.update({
          where: { id: orgUser.id },
          data: {
            loginAttempts: nextAttempts,
            lastFailedLoginAt: new Date(),
            ...(nextAttempts >= 5 ? { isLocked: true, lockedAt: new Date() } : {}),
          },
        }).catch(() => {/* best-effort */});

        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Reset login attempts on success
      if (orgUser.loginAttempts > 0) {
        await prisma.orgUser.update({
          where: { id: orgUser.id },
          data: { loginAttempts: 0, lastFailedLoginAt: null },
        }).catch(() => {/* best-effort */});
      }

      // Set session
      await regenerateSessionIfSupported(request).catch(() => {});
      request.session.orgUserId = orgUser.id;
      request.session.orgId = orgUser.orgId;
      request.session.orgRole = orgUser.role;

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
   * POST /org/auth/logout
   * 
   * Clear org user session (customer portal)
   */
  fastify.post("/org/auth/logout", async (request, reply) => {
    delete request.session.orgUserId;
    delete request.session.orgId;
    delete request.session.orgRole;

    request.log.info("Org user logged out");

    return { ok: true };
  });

  /**
   * GET /org/auth/me
   * 
   * Get current org user session info (customer portal)
   * 
   * Returns user details if authenticated, 401 if not
   */
  fastify.get("/org/auth/me", async (request, reply) => {
    const userId = request.session.orgUserId;
    const orgId = request.session.orgId;
    const role = request.session.orgRole;

    if (!userId || !orgId || !role) {
      reply.code(401);
      return { error: "Not authenticated" };
    }

    // Verify user still exists
    const orgUser = await prisma.orgUser.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    if (!orgUser) {
      delete request.session.orgUserId;
      delete request.session.orgId;
      delete request.session.orgRole;
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
      },
    };
  });
}
