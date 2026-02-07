/**
 * Unified Step-Up Guard — Step 11.22
 *
 * Single reusable middleware to enforce recent MFA verification
 * before sensitive actions. Works for both admin and portal actors.
 *
 * Usage in route preHandler:
 *   requireStepUp("admin")   — checks admin session step-up timestamp
 *   requireStepUp("portal")  — checks portal step-up cookie
 *
 * If the actor has MFA disabled, the guard passes silently (no MFA = no step-up).
 * If the actor has MFA enabled but no recent step-up, returns:
 *   403 { code: "STEP_UP_REQUIRED", message, requestId }
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalSessionToken,
} from "../utils/portal-session";

const DEFAULT_TTL_MINUTES = 10;

export function requireStepUp(
  actor: "admin" | "portal",
  ttlMinutes: number = DEFAULT_TTL_MINUTES
) {
  return async function stepUpGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const requestId = request.requestId || undefined;

    if (actor === "admin") {
      return adminStepUpCheck(request, reply, ttlMinutes, requestId);
    }

    return portalStepUpCheck(request, reply, requestId);
  };
}

// ── Admin step-up ──

async function adminStepUpCheck(
  request: FastifyRequest,
  reply: FastifyReply,
  _ttlMinutes: number,
  requestId?: string
) {
  const adminUser = (request as any).adminUser;
  if (!adminUser) {
    return reply.status(401).send({
      code: "STEP_UP_REQUIRED",
      error: "Authentication required",
      message: "Authentication required",
      requestId,
    });
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: adminUser.id },
  });
  if (!user || !user.mfaEnabled) {
    return; // MFA not enabled — no step-up needed
  }

  const stepUpUntil = request.session.adminStepUpUntil;
  if (stepUpUntil && Date.now() < stepUpUntil) {
    return; // Step-up valid
  }

  return reply.status(403).send({
    code: "STEP_UP_REQUIRED",
    error: "MFA step-up verification required for this action",
    message: "MFA step-up verification required for this action",
    requestId,
  });
}

// ── Portal step-up ──

async function portalStepUpCheck(
  request: FastifyRequest,
  reply: FastifyReply,
  requestId?: string
) {
  const actor = request.portalUser;
  if (!actor) {
    return reply.status(401).send({
      code: "STEP_UP_REQUIRED",
      error: "Authentication required",
      message: "Authentication required",
      requestId,
    });
  }

  const user = await prisma.orgUser.findUnique({
    where: { id: actor.id },
  });
  if (!user || !user.mfaEnabled) {
    return; // MFA not enabled — no step-up needed
  }

  // Check portal step-up cookie
  const secret = process.env.SESSION_SECRET;
  if (!secret) return;

  const stepUpCookie = request.cookies["helvino_portal_stepup"];
  if (stepUpCookie) {
    try {
      const parsed = verifyPortalSessionToken(stepUpCookie, secret);
      if (parsed && parsed.userId === actor.id) {
        return; // Step-up valid
      }
    } catch {
      // Invalid cookie — fall through
    }
  }

  return reply.status(403).send({
    code: "STEP_UP_REQUIRED",
    error: "MFA step-up verification required for this action",
    message: "MFA step-up verification required for this action",
    requestId,
  });
}
