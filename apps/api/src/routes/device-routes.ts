/**
 * Device Management Routes — Step 11.21
 *
 * Trusted device CRUD for both admin and portal users.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { writeAuditLog } from "../utils/audit-log";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { requireAdmin } from "../middleware/require-admin";
import { requirePortalUser } from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import { isAdminMfaRequired, isPortalMfaRecommended } from "../utils/device";

export async function deviceRoutes(fastify: FastifyInstance) {
  // ══════════════════════════════════════════════════════
  //  ADMIN DEVICE ROUTES
  // ══════════════════════════════════════════════════════

  // GET /internal/security/devices
  fastify.get(
    "/internal/security/devices",
    { preHandler: [requireAdmin] },
    async (request) => {
      const admin = (request as any).adminUser;
      const devices = await prisma.trustedDevice.findMany({
        where: { userId: admin.id, userType: "admin" },
        orderBy: { lastSeenAt: "desc" },
      });
      return { devices };
    }
  );

  // PATCH /internal/security/devices/:id/trust
  fastify.patch(
    "/internal/security/devices/:id/trust",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const admin = (request as any).adminUser;
      const { id } = request.params as { id: string };
      const body = request.body as { trusted?: boolean };

      const device = await prisma.trustedDevice.findFirst({
        where: { id, userId: admin.id, userType: "admin" },
      });

      if (!device) {
        reply.code(404);
        return { error: "Device not found" };
      }

      await prisma.trustedDevice.update({
        where: { id },
        data: { trusted: body.trusted ?? true },
      });

      await writeAuditLog(
        "system",
        admin.email,
        body.trusted ? "device_trusted" : "device_untrusted",
        { deviceId: id, userType: "admin" },
        request.requestId
      );

      return { ok: true };
    }
  );

  // PATCH /internal/security/devices/:id/label
  fastify.patch(
    "/internal/security/devices/:id/label",
    {
      preHandler: [
        requireAdmin,
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const admin = (request as any).adminUser;
      const { id } = request.params as { id: string };
      const body = request.body as { label?: string };

      const device = await prisma.trustedDevice.findFirst({
        where: { id, userId: admin.id, userType: "admin" },
      });

      if (!device) {
        reply.code(404);
        return { error: "Device not found" };
      }

      await prisma.trustedDevice.update({
        where: { id },
        data: { label: body.label?.substring(0, 100) || null },
      });

      await writeAuditLog(
        "system",
        admin.email,
        "device_renamed",
        { deviceId: id, label: body.label },
        request.requestId
      );

      return { ok: true };
    }
  );

  // DELETE /internal/security/devices/:id
  fastify.delete(
    "/internal/security/devices/:id",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const admin = (request as any).adminUser;
      const { id } = request.params as { id: string };

      const device = await prisma.trustedDevice.findFirst({
        where: { id, userId: admin.id, userType: "admin" },
      });

      if (!device) {
        reply.code(404);
        return { error: "Device not found" };
      }

      await prisma.trustedDevice.delete({ where: { id } });

      await writeAuditLog(
        "system",
        admin.email,
        "device_removed",
        { deviceId: id },
        request.requestId
      );

      return { ok: true };
    }
  );

  // GET /internal/security/mfa-policy
  fastify.get(
    "/internal/security/mfa-policy",
    { preHandler: [requireAdmin] },
    async () => {
      return {
        adminMfaRequired: isAdminMfaRequired(),
        portalMfaRecommended: isPortalMfaRecommended(),
      };
    }
  );

  // ══════════════════════════════════════════════════════
  //  PORTAL DEVICE ROUTES
  // ══════════════════════════════════════════════════════

  // GET /portal/security/devices
  fastify.get(
    "/portal/security/devices",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const actor = request.portalUser!;
      const devices = await prisma.trustedDevice.findMany({
        where: { userId: actor.id, userType: "portal" },
        orderBy: { lastSeenAt: "desc" },
      });
      return { devices };
    }
  );

  // PATCH /portal/security/devices/:id/trust
  fastify.patch(
    "/portal/security/devices/:id/trust",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { id } = request.params as { id: string };
      const body = request.body as { trusted?: boolean };

      const device = await prisma.trustedDevice.findFirst({
        where: { id, userId: actor.id, userType: "portal" },
      });

      if (!device) {
        reply.code(404);
        return { error: "Device not found" };
      }

      await prisma.trustedDevice.update({
        where: { id },
        data: { trusted: body.trusted ?? true },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        body.trusted ? "device_trusted" : "device_untrusted",
        { deviceId: id },
        request.requestId
      );

      return { ok: true };
    }
  );

  // PATCH /portal/security/devices/:id/label
  fastify.patch(
    "/portal/security/devices/:id/label",
    {
      preHandler: [
        requirePortalUser,
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { id } = request.params as { id: string };
      const body = request.body as { label?: string };

      const device = await prisma.trustedDevice.findFirst({
        where: { id, userId: actor.id, userType: "portal" },
      });

      if (!device) {
        reply.code(404);
        return { error: "Device not found" };
      }

      await prisma.trustedDevice.update({
        where: { id },
        data: { label: body.label?.substring(0, 100) || null },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "device_renamed",
        { deviceId: id, label: body.label },
        request.requestId
      );

      return { ok: true };
    }
  );

  // DELETE /portal/security/devices/:id
  fastify.delete(
    "/portal/security/devices/:id",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const { id } = request.params as { id: string };

      const device = await prisma.trustedDevice.findFirst({
        where: { id, userId: actor.id, userType: "portal" },
      });

      if (!device) {
        reply.code(404);
        return { error: "Device not found" };
      }

      // Also revoke any sessions associated with this device's UA
      await prisma.portalSession.updateMany({
        where: {
          orgUserId: actor.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await prisma.trustedDevice.delete({ where: { id } });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "device_removed",
        { deviceId: id },
        request.requestId
      );

      return { ok: true };
    }
  );

  // GET /portal/security/mfa-policy
  fastify.get(
    "/portal/security/mfa-policy",
    { preHandler: [requirePortalUser] },
    async () => {
      return {
        portalMfaRecommended: isPortalMfaRecommended(),
      };
    }
  );
}
