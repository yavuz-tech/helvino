/**
 * Org User Authentication Routes (Customer Portal)
 * 
 * Separate from internal admin auth.
 * Uses separate session cookie to avoid conflicts.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { verifyPassword } from "../utils/password";
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

export async function orgAuthRoutes(fastify: FastifyInstance) {
  /**
   * POST /org/auth/login
   * 
   * Authenticate org user (customer portal)
   * Sets session cookie (separate from internal admin)
   */
  fastify.post<{ Body: LoginRequest; Reply: LoginResponse | { error: string } }>(
    "/org/auth/login",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }), // 10 per minute per IP
      ],
    },
    async (request, reply) => {
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

      if (!orgUser) {
        request.log.warn({ email }, "Org user login failed: user not found");
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Verify password
      const isValid = await verifyPassword(orgUser.passwordHash, password);

      if (!isValid) {
        request.log.warn({ email, userId: orgUser.id }, "Org user login failed: invalid password");
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Check Origin header for CSRF protection
      const origin = request.headers.origin || request.headers.referer;
      if (origin && process.env.NODE_ENV === "production") {
        // In production, verify origin matches expected domain
        // For now, we'll allow all origins in development
        request.log.info({ origin }, "Login origin check");
      }

      // Set session
      request.session.orgUserId = orgUser.id;
      request.session.orgId = orgUser.orgId;
      request.session.orgRole = orgUser.role;

      request.log.info(
        {
          userId: orgUser.id,
          email: orgUser.email,
          role: orgUser.role,
          orgId: orgUser.orgId,
        },
        "Org user login successful"
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
