/**
 * Security Management Routes
 * 
 * Endpoints for managing organization security settings:
 * - Site ID management
 * - Domain allowlist configuration
 * - Localhost access control
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/require-admin";
import { generateSiteId, isValidSiteId } from "../utils/site-id";

interface SecuritySettings {
  siteId: string;
  allowedDomains: string[];
  allowLocalhost: boolean;
}

interface UpdateSecurityBody {
  allowedDomains?: string[];
  allowLocalhost?: boolean;
}

interface RotateSiteIdBody {
  confirm?: boolean; // Must be true to actually rotate
}

export async function securityRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/org/:key/security
   * 
   * Get organization security settings.
   * Requires admin authentication via session cookie.
   * 
   * Response (200):
   *   {
   *     ok: true,
   *     org: { id, key, name },
   *     security: {
   *       siteId: string,
   *       allowedDomains: string[],
   *       allowLocalhost: boolean
   *     }
   *   }
   * 
   * Error responses:
   *   - 401: Not authenticated
   *   - 404: Organization not found
   */
  fastify.get<{
    Params: { key: string };
  }>("/org/:key/security", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { key } = request.params;

    const org = await prisma.organization.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        name: true,
        siteId: true,
        allowedDomains: true,
        allowLocalhost: true,
      },
    });

    if (!org) {
      return reply.status(404).send({
        error: "Organization not found",
      });
    }

    return {
      ok: true,
      org: {
        id: org.id,
        key: org.key,
        name: org.name,
      },
      security: {
        siteId: org.siteId,
        allowedDomains: org.allowedDomains,
        allowLocalhost: org.allowLocalhost,
      },
    };
  });

  /**
   * PATCH /api/org/:key/security
   * 
   * Update organization security settings.
   * Requires admin authentication via session cookie.
   * 
   * Body:
   *   {
   *     allowedDomains?: string[],
   *     allowLocalhost?: boolean
   *   }
   * 
   * Response (200):
   *   {
   *     ok: true,
   *     org: { id, key, name },
   *     security: {
   *       siteId: string,
   *       allowedDomains: string[],
   *       allowLocalhost: boolean
   *     }
   *   }
   * 
   * Error responses:
   *   - 401: Not authenticated
   *   - 404: Organization not found
   */
  fastify.patch<{
    Params: { key: string };
    Body: UpdateSecurityBody;
  }>("/org/:key/security", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { key } = request.params;
    const updates = request.body;

    // Verify organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { key },
    });

    if (!existingOrg) {
      return reply.status(404).send({
        error: "Organization not found",
      });
    }

    // Build update data (only include provided fields)
    const updateData: any = {};
    if (updates.allowedDomains !== undefined) {
      updateData.allowedDomains = updates.allowedDomains;
    }
    if (updates.allowLocalhost !== undefined) {
      updateData.allowLocalhost = updates.allowLocalhost;
    }

    // Update organization
    const org = await prisma.organization.update({
      where: { key },
      data: updateData,
      select: {
        id: true,
        key: true,
        name: true,
        siteId: true,
        allowedDomains: true,
        allowLocalhost: true,
      },
    });

    request.log.info(
      {
        adminUser: (request as any).adminUser,
        orgId: org.id,
        updates: Object.keys(updateData),
      },
      "Security settings updated"
    );

    return {
      ok: true,
      org: {
        id: org.id,
        key: org.key,
        name: org.name,
      },
      security: {
        siteId: org.siteId,
        allowedDomains: org.allowedDomains,
        allowLocalhost: org.allowLocalhost,
      },
    };
  });

  /**
   * POST /api/org/:key/security/rotate-site-id
   * 
   * Rotate (regenerate) the site ID for an organization.
   * This will invalidate the old site ID and generate a new one.
   * 
   * Requires admin authentication via session cookie.
   * Requires explicit confirmation in request body.
   * 
   * Body:
   *   {
   *     confirm: true  // Must be exactly true
   *   }
   * 
   * Response (200):
   *   {
   *     ok: true,
   *     org: { id, key, name },
   *     security: {
   *       siteId: string,  // New site ID
   *       oldSiteId: string,  // Old site ID (for reference)
   *       allowedDomains: string[],
   *       allowLocalhost: boolean
   *     },
   *     warning: string
   *   }
   * 
   * Error responses:
   *   - 400: Missing or invalid confirmation
   *   - 401: Not authenticated
   *   - 404: Organization not found
   */
  fastify.post<{
    Params: { key: string };
    Body: RotateSiteIdBody;
  }>("/org/:key/security/rotate-site-id", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { key } = request.params;
    const { confirm } = request.body;

    // Require explicit confirmation
    if (confirm !== true) {
      return reply.status(400).send({
        error: "Confirmation required",
        message: "You must set confirm=true to rotate the site ID",
        hint: "This action will invalidate the current site ID and require updating your widget embed code",
      });
    }

    // Get current organization
    const existingOrg = await prisma.organization.findUnique({
      where: { key },
      select: {
        id: true,
        siteId: true,
      },
    });

    if (!existingOrg) {
      return reply.status(404).send({
        error: "Organization not found",
      });
    }

    const oldSiteId = existingOrg.siteId;

    // Generate new site ID
    const newSiteId = generateSiteId();

    // Update organization with new site ID
    const org = await prisma.organization.update({
      where: { key },
      data: { siteId: newSiteId },
      select: {
        id: true,
        key: true,
        name: true,
        siteId: true,
        allowedDomains: true,
        allowLocalhost: true,
      },
    });

    request.log.warn(
      {
        adminUser: (request as any).adminUser,
        orgId: org.id,
        oldSiteId,
        newSiteId,
      },
      "Site ID rotated"
    );

    return {
      ok: true,
      org: {
        id: org.id,
        key: org.key,
        name: org.name,
      },
      security: {
        siteId: org.siteId,
        oldSiteId,
        allowedDomains: org.allowedDomains,
        allowLocalhost: org.allowLocalhost,
      },
      warning: "The old site ID is now invalid. Update your widget embed code with the new site ID.",
    };
  });
}
