/**
 * Organization Admin Routes
 * 
 * Internal-only endpoints for managing organization settings.
 * Requires admin authentication via session cookie.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/require-admin";
import { validateWidgetBranding } from "../middleware/validation";

interface UpdateOrgSettingsBody {
  widgetEnabled?: boolean;
  writeEnabled?: boolean;
  aiEnabled?: boolean;
  primaryColor?: string;
  widgetName?: string;
  widgetSubtitle?: string;
  language?: string;
  messageRetentionDays?: number;
  hardDeleteOnRetention?: boolean;
}

export async function orgAdminRoutes(fastify: FastifyInstance) {
  /**
   * PATCH /org/:key/settings
   * 
   * Update organization settings (kill switches, config, and retention).
   * Requires x-internal-key header for authentication.
   * 
   * Body:
   *   {
   *     widgetEnabled?: boolean,
   *     writeEnabled?: boolean,
   *     aiEnabled?: boolean,
   *     primaryColor?: string,
   *     messageRetentionDays?: number,
   *     hardDeleteOnRetention?: boolean
   *   }
   * 
   * Response (200):
   *   {
   *     ok: true,
   *     org: { id, key, name },
   *     settings: { 
   *       widgetEnabled, writeEnabled, aiEnabled, primaryColor,
   *       messageRetentionDays, hardDeleteOnRetention, lastRetentionRunAt
   *     }
   *   }
   * 
   * Error responses:
   *   - 401: Missing or invalid internal API key
   *   - 404: Organization not found
   */
  fastify.patch<{
    Params: { key: string };
    Body: UpdateOrgSettingsBody;
  }>("/org/:key/settings", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { key } = request.params;
    const updates = request.body;

    // Validate branding fields if present
    const validation = validateWidgetBranding(updates);
    if (!validation.valid) {
      reply.code(400);
      return { error: validation.error };
    }

    // Find organization
    const org = await prisma.organization.findUnique({
      where: { key },
    });

    if (!org) {
      reply.code(404);
      return { error: "Organization not found" };
    }

    // Build update data (only include provided fields)
    const updateData: any = {};
    if (updates.widgetEnabled !== undefined) updateData.widgetEnabled = updates.widgetEnabled;
    if (updates.writeEnabled !== undefined) updateData.writeEnabled = updates.writeEnabled;
    if (updates.aiEnabled !== undefined) updateData.aiEnabled = updates.aiEnabled;
    if (updates.primaryColor !== undefined) updateData.primaryColor = updates.primaryColor;
    if (updates.widgetName !== undefined) updateData.widgetName = updates.widgetName;
    if (updates.widgetSubtitle !== undefined) updateData.widgetSubtitle = updates.widgetSubtitle;
    if (updates.language !== undefined) updateData.language = updates.language;
    if (updates.messageRetentionDays !== undefined) updateData.messageRetentionDays = updates.messageRetentionDays;
    if (updates.hardDeleteOnRetention !== undefined) updateData.hardDeleteOnRetention = updates.hardDeleteOnRetention;

    // Update organization
    const updatedOrg = await prisma.organization.update({
      where: { key },
      data: updateData,
      select: {
        id: true,
        key: true,
        name: true,
        widgetEnabled: true,
        writeEnabled: true,
        aiEnabled: true,
        primaryColor: true,
        widgetName: true,
        widgetSubtitle: true,
        language: true,
        messageRetentionDays: true,
        hardDeleteOnRetention: true,
        lastRetentionRunAt: true,
      },
    });

    request.log.info(
      { orgKey: key, updates: Object.keys(updateData) },
      "Organization settings updated"
    );

    return {
      ok: true,
      org: {
        id: updatedOrg.id,
        key: updatedOrg.key,
        name: updatedOrg.name,
      },
      settings: {
        widgetEnabled: updatedOrg.widgetEnabled,
        writeEnabled: updatedOrg.writeEnabled,
        aiEnabled: updatedOrg.aiEnabled,
        primaryColor: updatedOrg.primaryColor,
        widgetName: updatedOrg.widgetName,
        widgetSubtitle: updatedOrg.widgetSubtitle,
        language: updatedOrg.language,
        messageRetentionDays: updatedOrg.messageRetentionDays,
        hardDeleteOnRetention: updatedOrg.hardDeleteOnRetention,
        lastRetentionRunAt: updatedOrg.lastRetentionRunAt?.toISOString() || null,
      },
    };
  });

  /**
   * GET /org/:key/settings
   * 
   * Get organization settings.
   * Requires x-internal-key header for authentication.
   */
  fastify.get<{
    Params: { key: string };
  }>("/org/:key/settings", {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { key } = request.params;

    const org = await prisma.organization.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        name: true,
        widgetEnabled: true,
        writeEnabled: true,
        aiEnabled: true,
        primaryColor: true,
        widgetName: true,
        widgetSubtitle: true,
        language: true,
        messageRetentionDays: true,
        hardDeleteOnRetention: true,
        lastRetentionRunAt: true,
      },
    });

    if (!org) {
      reply.code(404);
      return { error: "Organization not found" };
    }

    return {
      ok: true,
      org: {
        id: org.id,
        key: org.key,
        name: org.name,
      },
      settings: {
        widgetEnabled: org.widgetEnabled,
        writeEnabled: org.writeEnabled,
        aiEnabled: org.aiEnabled,
        primaryColor: org.primaryColor,
        widgetName: org.widgetName,
        widgetSubtitle: org.widgetSubtitle,
        language: org.language,
        messageRetentionDays: org.messageRetentionDays,
        hardDeleteOnRetention: org.hardDeleteOnRetention,
        lastRetentionRunAt: org.lastRetentionRunAt?.toISOString() || null,
      },
    };
  });
}
