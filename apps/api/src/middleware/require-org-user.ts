/**
 * requireOrgUser Middleware
 * 
 * Ensures the request has a valid org user session (customer portal).
 * Separate from admin session to avoid conflicts.
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";

// Extend FastifyRequest to include orgUser
declare module "fastify" {
  interface FastifyRequest {
    orgUser?: {
      id: string;
      orgId: string;
      email: string;
      role: string;
    };
  }
}

/**
 * Middleware to require org user authentication via session cookie
 * 
 * Checks:
 * 1. Session contains orgUserId
 * 2. Org user exists in database
 * 3. Org user role is valid
 * 
 * On success: Attaches orgUser to request object
 * On failure: Returns 401 Unauthorized
 */
export async function requireOrgUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.session.orgUserId;
  const orgId = request.session.orgId;
  const role = request.session.orgRole;

  if (!userId || !orgId || !role) {
    return reply.status(401).send({
      error: "Authentication required",
      hint: "Please login at /org/auth/login",
    });
  }

  // Verify user still exists and is active
  const orgUser = await prisma.orgUser.findUnique({
    where: { id: userId },
  });

  if (!orgUser) {
    // User was deleted, clear invalid session
    delete request.session.orgUserId;
    delete request.session.orgId;
    delete request.session.orgRole;
    return reply.status(401).send({
      error: "User no longer exists",
    });
  }

  // Verify orgId matches (prevent session tampering)
  if (orgUser.orgId !== orgId) {
    request.log.error(
      { sessionOrgId: orgId, dbOrgId: orgUser.orgId, userId },
      "Org ID mismatch in session"
    );
    delete request.session.orgUserId;
    delete request.session.orgId;
    delete request.session.orgRole;
    return reply.status(401).send({
      error: "Invalid session",
    });
  }

  // Attach org user to request for downstream handlers
  request.orgUser = {
    id: orgUser.id,
    orgId: orgUser.orgId,
    email: orgUser.email,
    role: orgUser.role,
  };

  // Log org user action
  request.log.info(
    {
      orgUserId: orgUser.id,
      orgId: orgUser.orgId,
      orgEmail: orgUser.email,
      orgRole: orgUser.role,
      method: request.method,
      url: request.url,
    },
    "Org user authenticated request"
  );
}

/**
 * Middleware to require specific org user role(s)
 * 
 * Usage:
 *   requireOrgRole(['owner', 'admin'])
 * 
 * Note: Must be used AFTER requireOrgUser middleware
 */
export function requireOrgRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const orgUser = request.orgUser;

    if (!orgUser) {
      return reply.status(401).send({
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(orgUser.role)) {
      request.log.warn(
        {
          orgUserId: orgUser.id,
          orgRole: orgUser.role,
          allowedRoles,
        },
        "Org user role check failed"
      );

      return reply.status(403).send({
        error: "Insufficient permissions",
        required: allowedRoles,
        current: orgUser.role,
      });
    }
  };
}
