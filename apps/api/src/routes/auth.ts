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
import { createRateLimitMiddleware } from "../middleware/rate-limit";

interface LoginBody {
  email: string;
  password: string;
}

export async function authRoutes(fastify: FastifyInstance) {
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
      createRateLimitMiddleware({ limit: 10, windowMs: 60000 }), // 10 attempts per minute per IP
    ],
  }, async (request, reply) => {
    const { email, password } = request.body;

    // CSRF Protection: Validate Origin header
    const origin = request.headers.origin as string | undefined;
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3006",
      "https://helvino.io",
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
      return reply.status(400).send({
        error: "Email and password required",
      });
    }

    // Find admin user
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!adminUser) {
      request.log.warn({ email }, "Login attempt: user not found");
      // Use generic error message to prevent user enumeration
      return reply.status(401).send({
        error: "Invalid credentials",
      });
    }

    // Verify password
    const isValid = await verifyPassword(adminUser.passwordHash, password);

    if (!isValid) {
      request.log.warn({ email, userId: adminUser.id }, "Login attempt: invalid password");
      return reply.status(401).send({
        error: "Invalid credentials",
      });
    }

    // Set session
    request.session.adminUserId = adminUser.id;
    request.session.adminRole = adminUser.role;
    request.session.adminEmail = adminUser.email;

    request.log.info(
      { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
      "Admin login successful"
    );

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

    if (!userId || !email || !role) {
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
      },
      timestamp: new Date().toISOString(),
    });
  });
}
