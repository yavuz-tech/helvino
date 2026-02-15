/**
 * requireAdmin Middleware
 * 
 * Ensures the request has a valid admin session.
 * Replaces x-internal-key authentication with cookie-based sessions.
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";

/**
 * Middleware to require admin authentication via session cookie
 * 
 * Checks:
 * 1. Session contains adminUserId
 * 2. Admin user exists in database
 * 3. Admin role is valid
 * 
 * On success: Attaches adminUser to request object
 * On failure: Returns 401 Unauthorized
 */
/**
 * Admin idle timeout in milliseconds.
 * Admin sessions expire after 30 minutes of inactivity (server-side enforcement).
 * The session cookie may live longer, but this guard rejects stale admin access.
 */
const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.session.adminUserId;
  const role = request.session.adminRole;

  if (!userId || !role) {
    return reply.status(401).send({
      error: "Authentication required",
      hint: "Please login at /internal/auth/login",
    });
  }

  // ── Admin idle timeout enforcement ──
  const lastActivity = request.session.adminLastActivityAt;
  const now = Date.now();
  if (lastActivity && now - lastActivity > ADMIN_IDLE_TIMEOUT_MS) {
    // Idle too long — force re-login
    delete request.session.adminUserId;
    delete request.session.adminRole;
    delete request.session.adminEmail;
    delete request.session.adminLastActivityAt;
    delete request.session.adminStepUpUntil;
    return reply.status(401).send({
      error: "Admin session expired due to inactivity",
      code: "ADMIN_SESSION_EXPIRED",
    });
  }
  // Refresh activity timestamp
  request.session.adminLastActivityAt = now;

  // Verify user still exists and is active
  const adminUser = await prisma.adminUser.findUnique({
    where: { id: userId },
  });

  if (!adminUser) {
    // User was deleted, clear invalid session
    delete request.session.adminUserId;
    delete request.session.adminRole;
    delete request.session.adminEmail;
    delete request.session.adminLastActivityAt;
    return reply.status(401).send({
      error: "User no longer exists",
    });
  }

  // Attach admin user to request for downstream handlers
  (request as any).adminUser = {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  };

  // Log admin action
  request.log.info(
    {
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      adminRole: adminUser.role,
      method: request.method,
      url: request.url,
    },
    "Admin authenticated request"
  );
}

/**
 * Middleware to require specific admin role(s)
 * 
 * Usage:
 *   requireRole(['owner', 'admin'])
 * 
 * Note: Must be used AFTER requireAdmin middleware
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const adminUser = (request as any).adminUser;

    if (!adminUser) {
      return reply.status(401).send({
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(adminUser.role)) {
      request.log.warn(
        {
          adminUserId: adminUser.id,
          adminRole: adminUser.role,
          allowedRoles,
        },
        "Admin role check failed"
      );

      return reply.status(403).send({
        error: "Insufficient permissions",
        required: allowedRoles,
        current: adminUser.role,
      });
    }
  };
}
