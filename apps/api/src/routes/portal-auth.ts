/**
 * Portal Authentication Routes (Customer Portal)
 *
 * Separate cookie + auth flow from internal admin.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { verifyPassword } from "../utils/password";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  verifyPortalSessionToken,
  PORTAL_SESSION_TTL_MS,
} from "../utils/portal-session";

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

      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        reply.code(500);
        return { error: "SESSION_SECRET not configured" };
      }

      const token = createPortalSessionToken(
        {
          userId: orgUser.id,
          orgId: orgUser.orgId,
          role: orgUser.role,
        },
        secret
      );

      const isProduction = process.env.NODE_ENV === "production";
      reply.setCookie(PORTAL_SESSION_COOKIE, token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
      });

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
      },
    };
  });
}
