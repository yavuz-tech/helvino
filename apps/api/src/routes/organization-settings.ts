import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser } from "../middleware/require-portal-user";
import { requireAdmin } from "../middleware/require-admin";

async function resolveOrgIdFromHeader(orgKey: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { key: orgKey },
    select: { id: true },
  });
  return org?.id || null;
}

export async function organizationSettingsRoutes(fastify: FastifyInstance) {
  // Customer portal: read-only access for showing/hiding promo input in checkout.
  fastify.get(
    "/api/organization/settings",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const settings = await prisma.organizationSettings.upsert({
        where: { organizationId: user.orgId },
        update: {},
        create: { organizationId: user.orgId },
      });

      return {
        campaignsEnabled: settings.campaignsEnabled,
      };
    }
  );

  // Admin dashboard: org-scoped read/write via x-org-key header.
  fastify.get(
    "/internal/organization/settings",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const orgKey = request.headers["x-org-key"];
      const normalizedOrgKey = typeof orgKey === "string" ? orgKey.trim() : "";
      if (!normalizedOrgKey) {
        reply.code(400);
        return { error: "x-org-key header is required" };
      }
      const orgId = await resolveOrgIdFromHeader(normalizedOrgKey);
      if (!orgId) {
        reply.code(404);
        return { error: "Organization not found" };
      }

      const settings = await prisma.organizationSettings.upsert({
        where: { organizationId: orgId },
        update: {},
        create: { organizationId: orgId },
      });

      return { campaignsEnabled: settings.campaignsEnabled };
    }
  );

  fastify.patch(
    "/internal/organization/settings",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const orgKey = request.headers["x-org-key"];
      const normalizedOrgKey = typeof orgKey === "string" ? orgKey.trim() : "";
      if (!normalizedOrgKey) {
        reply.code(400);
        return { error: "x-org-key header is required" };
      }
      const orgId = await resolveOrgIdFromHeader(normalizedOrgKey);
      if (!orgId) {
        reply.code(404);
        return { error: "Organization not found" };
      }
      const body = (request.body || {}) as { campaignsEnabled?: boolean };

      if (typeof body.campaignsEnabled !== "boolean") {
        reply.code(400);
        return { error: "campaignsEnabled must be boolean" };
      }

      const settings = await prisma.organizationSettings.upsert({
        where: { organizationId: orgId },
        update: { campaignsEnabled: body.campaignsEnabled },
        create: {
          organizationId: orgId,
          campaignsEnabled: body.campaignsEnabled,
        },
      });

      return {
        ok: true,
        campaignsEnabled: settings.campaignsEnabled,
      };
    }
  );
}
