/**
 * Portal auth middleware
 *
 * Ensures the request has a valid portal session (customer portal).
 */

import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalSessionToken,
} from "../utils/portal-session";

declare module "fastify" {
  interface FastifyRequest {
    portalUser?: {
      id: string;
      orgId: string;
      email: string;
      role: string;
    };
  }
}

export async function requirePortalUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return reply.status(500).send({ error: "SESSION_SECRET not configured" });
  }

  const token = request.cookies[PORTAL_SESSION_COOKIE];
  if (!token) {
    return reply.status(401).send({ error: "Authentication required" });
  }

  const payload = verifyPortalSessionToken(token, secret);
  if (!payload) {
    reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    return reply.status(401).send({ error: "Invalid session" });
  }

  const orgUser = await prisma.orgUser.findUnique({
    where: { id: payload.userId },
  });

  if (!orgUser) {
    reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    return reply.status(401).send({ error: "User not found" });
  }

  if (orgUser.orgId !== payload.orgId) {
    reply.clearCookie(PORTAL_SESSION_COOKIE, { path: "/" });
    return reply.status(401).send({ error: "Invalid session" });
  }

  request.portalUser = {
    id: orgUser.id,
    orgId: orgUser.orgId,
    email: orgUser.email,
    role: orgUser.role,
  };
}

export function requirePortalRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.portalUser;
    if (!user) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        error: "Insufficient permissions",
        required: allowedRoles,
        current: user.role,
      });
    }
  };
}
