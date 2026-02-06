/**
 * Org Token Authentication Middleware
 * 
 * Protects write operations by requiring a valid signed org token.
 * 
 * Flow:
 * 1. Check for x-internal-key header (bypass for internal/dashboard usage)
 * 2. Otherwise require x-org-token header
 * 3. Verify token signature and expiration
 * 4. Load organization from database
 * 5. Attach org to request context for downstream handlers
 * 
 * Returns 403 if token is missing, invalid, expired, or org not found.
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { verifyOrgToken } from "../utils/org-token";
import { store } from "../store";
import { Organization } from "../types";

// Extend FastifyRequest to include org
declare module "fastify" {
  interface FastifyRequest {
    org?: Organization;
  }
}

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const INTERNAL_OVERRIDE_WRITES = process.env.INTERNAL_OVERRIDE_WRITES === "true";

/**
 * Middleware to require valid org token on protected routes
 * 
 * Protected routes: POST /conversations, POST /conversations/:id/messages
 * 
 * Bypass mechanisms:
 * 1. Admin session cookie (for dashboard)
 * 2. x-internal-key header (for automated/dev tools)
 */
export async function requireOrgToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Check for admin session (ADMIN BYPASS #1 - cookie-based auth for dashboard)
  const adminUserId = request.session.adminUserId;
  
  if (adminUserId) {
    // Admin session detected: allow POST operations from dashboard
    const orgKey = request.headers["x-org-key"] as string;
    
    if (!orgKey) {
      reply.code(401);
      return reply.send({ error: "Missing x-org-key header" });
    }

    const org = await store.getOrganizationByKey(orgKey);
    if (!org) {
      reply.code(401);
      return reply.send({ error: "Invalid organization key" });
    }

    // Attach org to request
    request.org = org;
    
    request.log.info(
      { orgKey, orgId: org.id, adminBypass: true, adminUserId },
      "Admin session bypass: allowing write operation"
    );
    
    // Admin bypass respects writeEnabled flag (unless INTERNAL_OVERRIDE_WRITES=true)
    if (!org.writeEnabled && !INTERNAL_OVERRIDE_WRITES) {
      request.log.warn(
        { orgKey, orgId: org.id, writeEnabled: false, adminBypass: true },
        "Write operations disabled for organization (admin bypass respects writeEnabled)"
      );
      reply.code(403);
      return reply.send({
        error: "Writes disabled",
        message: "Write operations are temporarily disabled for this organization.",
      });
    }
    
    return; // Allow request to proceed
  }

  // Check for internal bypass key (ADMIN BYPASS #2 - x-internal-key for automated tools)
  const internalKey = request.headers["x-internal-key"] as string | undefined;
  
  if (INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY) {
    // Internal bypass: use x-org-key directly (for dashboard/dev)
    const orgKey = request.headers["x-org-key"] as string;
    
    if (!orgKey) {
      reply.code(401);
      return reply.send({ error: "Missing x-org-key header" });
    }

    const org = await store.getOrganizationByKey(orgKey);
    if (!org) {
      reply.code(401);
      return reply.send({ error: "Invalid organization key" });
    }

    // Attach org to request
    request.org = org;
    
    request.log.info(
      { orgKey, orgId: org.id, bypassUsed: true },
      "Internal API key bypass used"
    );
    
    // Check writeEnabled even with internal bypass (unless INTERNAL_OVERRIDE_WRITES=true)
    if (!org.writeEnabled && !INTERNAL_OVERRIDE_WRITES) {
      request.log.warn(
        { orgKey, orgId: org.id, writeEnabled: false, bypassUsed: true },
        "Write operations disabled for organization (internal bypass still respects writeEnabled)"
      );
      reply.code(403);
      return reply.send({
        error: "Writes disabled",
        message: "Write operations are temporarily disabled for this organization.",
      });
    }
    
    return; // Allow request to proceed
  }

  // Normal flow: require org token
  const orgToken = request.headers["x-org-token"] as string | undefined;

  if (!orgToken) {
    reply.code(403);
    return reply.send({
      error: "Missing org token",
      message: "This endpoint requires a valid org token. Call GET /api/bootloader first to obtain a token.",
    });
  }

  // Verify token
  const payload = verifyOrgToken(orgToken);

  if (!payload) {
    reply.code(403);
    return reply.send({
      error: "Invalid or expired org token",
      message: "Your org token is invalid or has expired. Call GET /api/bootloader to obtain a new token.",
    });
  }

  // Load organization from database
  const org = await store.getOrganizationByKey(payload.orgKey);

  if (!org) {
    reply.code(403);
    return reply.send({
      error: "Organization not found",
      message: "The organization associated with this token no longer exists.",
    });
  }

  // Verify orgId matches (extra security check)
  if (org.id !== payload.orgId) {
    request.log.error(
      { tokenOrgId: payload.orgId, dbOrgId: org.id, orgKey: payload.orgKey },
      "Org ID mismatch in token"
    );
    reply.code(403);
    return reply.send({
      error: "Invalid org token",
      message: "Token validation failed.",
    });
  }

  // Attach org to request for downstream handlers
  request.org = org;

  request.log.info(
    { orgKey: org.key, orgId: org.id, tokenExp: payload.exp },
    "Org token verified successfully"
  );

  // Check if writes are enabled for this organization
  if (!org.writeEnabled && !INTERNAL_OVERRIDE_WRITES) {
    request.log.warn(
      { orgKey: org.key, orgId: org.id, writeEnabled: false },
      "Write operations disabled for organization"
    );
    reply.code(403);
    return reply.send({
      error: "Writes disabled",
      message: "Write operations are temporarily disabled for this organization.",
    });
  }
}
