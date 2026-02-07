/**
 * WebAuthn (Passkey) Routes — Step 11.25
 *
 * Portal:
 *   GET  /portal/webauthn/register/options
 *   POST /portal/webauthn/register/verify
 *   GET  /portal/webauthn/login/options
 *   POST /portal/webauthn/login/verify
 *   GET  /portal/webauthn/credentials
 *   POST /portal/webauthn/credentials/:id/revoke
 *
 * Admin:
 *   GET  /admin/webauthn/register/options
 *   POST /admin/webauthn/register/verify
 *   GET  /admin/webauthn/login/options
 *   POST /admin/webauthn/login/verify
 *   GET  /admin/webauthn/credentials
 *   POST /admin/webauthn/credentials/:id/revoke
 */

import crypto from "crypto";
import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireAdmin } from "../middleware/require-admin";
import { requirePortalUser } from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { writeAuditLog } from "../utils/audit-log";
import { upsertDevice } from "../utils/device";
import {
  generateRegistrationOptions,
  generateLoginOptions,
  verifyRegistration,
  verifyAssertion,
  consumeChallengeDB,
  createChallengeDB,
  createChallenge,
  type RegistrationResponse,
  type AssertionResponse,
} from "../utils/webauthn";
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  PORTAL_SESSION_TTL_MS,
} from "../utils/portal-session";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function webauthnRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════
  // PORTAL: Registration
  // ═══════════════════════════════════════════════

  // GET /portal/webauthn/register/options
  fastify.get(
    "/portal/webauthn/register/options",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const user = request.portalUser!;
      const requestId = request.requestId || undefined;

      const existing = await prisma.webAuthnCredential.findMany({
        where: { userId: user.id, userType: "portal" },
        select: { credentialId: true },
      });

      const challenge = await createChallengeDB(
        user.id,
        "portal",
        request.ip,
        request.headers["user-agent"] as string | undefined
      );

      const options = generateRegistrationOptions(
        {
          userId: user.id,
          userEmail: user.email,
          userName: user.email,
          existingCredentialIds: existing.map((c) => c.credentialId),
        },
        "portal",
        challenge
      );

      return { options, requestId };
    }
  );

  // POST /portal/webauthn/register/verify
  fastify.post(
    "/portal/webauthn/register/verify",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const user = request.portalUser!;
      const requestId = request.requestId || undefined;
      const { credential, nickname } = request.body as {
        credential: RegistrationResponse;
        nickname?: string;
      };

      if (!credential) {
        return reply.status(400).send({ error: "Missing credential", requestId });
      }

      const expectedChallenge = await consumeChallengeDB(user.id, "portal");
      if (!expectedChallenge) {
        return reply.status(400).send({ error: "Challenge expired or not found", requestId });
      }

      try {
        const result = verifyRegistration(credential, expectedChallenge);

        await prisma.webAuthnCredential.create({
          data: {
            userType: "portal",
            userId: user.id,
            credentialId: result.credentialId,
            publicKey: result.publicKey,
            counter: result.counter,
            transports: JSON.stringify(result.transports),
            aaguid: result.aaguid,
            nickname: nickname || null,
          },
        });

        await writeAuditLog(
          user.orgId,
          user.email,
          "webauthn.registered",
          { credentialId: result.credentialId.substring(0, 16) + "..." },
          requestId
        );

        // Emit notification
        const { emitPasskeyRegistered } = await import("../utils/notifications");
        await emitPasskeyRegistered(user.orgId, user.id, requestId);

        return {
          ok: true,
          credentialId: result.credentialId,
          requestId,
        };
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : "Registration verification failed",
          requestId,
        });
      }
    }
  );

  // GET /portal/webauthn/login/options
  fastify.post(
    "/portal/webauthn/login/options",
    {
      preHandler: [createRateLimitMiddleware({ limit: 20, windowMs: 60000 })],
    },
    async (request, reply) => {
      const { email } = request.body as { email?: string };
      const requestId = request.requestId || undefined;

      if (!email) {
        return reply.status(400).send({ error: "Email is required", requestId });
      }

      const orgUser = await prisma.orgUser.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!orgUser) {
        // Return empty options with dummy challenge (no user enumeration, no DB write)
        const dummyChallenge = createChallenge("dummy", "portal");
        return {
          options: {
            rpId: "localhost",
            challenge: dummyChallenge,
            timeout: 300000,
            userVerification: "preferred",
            allowCredentials: [],
          },
          requestId,
        };
      }

      const credentials = await prisma.webAuthnCredential.findMany({
        where: { userId: orgUser.id, userType: "portal" },
        select: { credentialId: true },
      });

      if (credentials.length === 0) {
        return reply.status(400).send({
          error: "No passkeys registered for this account",
          requestId,
        });
      }

      const challenge = await createChallengeDB(
        orgUser.id,
        "portal",
        request.ip,
        request.headers["user-agent"] as string | undefined
      );

      const options = generateLoginOptions(
        orgUser.id,
        "portal",
        credentials.map((c) => c.credentialId),
        challenge
      );

      return { options, requestId };
    }
  );

  // POST /portal/webauthn/login/verify
  fastify.post(
    "/portal/webauthn/login/verify",
    {
      preHandler: [createRateLimitMiddleware({ limit: 10, windowMs: 60000 })],
    },
    async (request, reply) => {
      const { credential, email } = request.body as {
        credential: AssertionResponse;
        email?: string;
      };
      const requestId = request.requestId || undefined;

      if (!credential || !email) {
        return reply.status(400).send({ error: "Missing credential or email", requestId });
      }

      // Find the credential
      const stored = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: credential.id },
      });

      if (!stored || stored.userType !== "portal") {
        return reply.status(401).send({ error: "Invalid passkey", requestId });
      }

      // Find the user
      const orgUser = await prisma.orgUser.findUnique({
        where: { id: stored.userId },
        include: { organization: { select: { id: true, key: true, name: true } } },
      });

      if (!orgUser || !orgUser.isActive) {
        return reply.status(401).send({ error: "Invalid passkey", requestId });
      }

      // Consume challenge from DB (single-use enforcement)
      const expectedChallenge = await consumeChallengeDB(orgUser.id, "portal");
      if (!expectedChallenge) {
        return reply.status(400).send({ error: "Challenge expired or not found", requestId });
      }

      try {
        const { newCounter } = verifyAssertion(
          credential,
          expectedChallenge,
          stored.publicKey,
          stored.counter
        );

        // Update counter + lastUsedAt
        await prisma.webAuthnCredential.update({
          where: { id: stored.id },
          data: { counter: newCounter, lastUsedAt: new Date() },
        });

        // Update lastLoginAt
        await prisma.orgUser.update({
          where: { id: orgUser.id },
          data: { lastLoginAt: new Date() },
        });

        // Create session (passkey login = strong auth, skip TOTP)
        const secret = process.env.SESSION_SECRET;
        if (!secret) {
          return reply.status(500).send({ error: "SESSION_SECRET not configured", requestId });
        }

        const token = createPortalSessionToken(
          { userId: orgUser.id, orgId: orgUser.orgId, role: orgUser.role },
          secret
        );

        const tokenHash = hashToken(token);
        await prisma.portalSession.create({
          data: {
            orgUserId: orgUser.id,
            tokenHash,
            ip: request.ip || null,
            userAgent: (request.headers["user-agent"] as string)?.substring(0, 256) || null,
          },
        });

        const isProduction = process.env.NODE_ENV === "production";
        reply.setCookie(PORTAL_SESSION_COOKIE, token, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
        });

        // Upsert device
        await upsertDevice(
          orgUser.id,
          "portal",
          request.headers["user-agent"] as string | undefined,
          request.ip
        );

        await writeAuditLog(
          orgUser.orgId,
          orgUser.email,
          "webauthn.login",
          { credentialId: credential.id.substring(0, 16) + "..." },
          requestId
        );

        return {
          ok: true,
          user: {
            id: orgUser.id,
            email: orgUser.email,
            role: orgUser.role,
            orgId: orgUser.orgId,
            orgKey: orgUser.organization.key,
            orgName: orgUser.organization.name,
          },
          requestId,
        };
      } catch (err) {
        return reply.status(401).send({
          error: err instanceof Error ? err.message : "Passkey verification failed",
          requestId,
        });
      }
    }
  );

  // GET /portal/webauthn/credentials
  fastify.get(
    "/portal/webauthn/credentials",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = request.portalUser!;
      const requestId = request.requestId || undefined;

      const credentials = await prisma.webAuthnCredential.findMany({
        where: { userId: user.id, userType: "portal" },
        select: {
          id: true,
          credentialId: true,
          nickname: true,
          createdAt: true,
          lastUsedAt: true,
          aaguid: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return { credentials, requestId };
    }
  );

  // POST /portal/webauthn/credentials/:id/revoke
  fastify.post<{ Params: { id: string } }>(
    "/portal/webauthn/credentials/:id/revoke",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const user = request.portalUser!;
      const { id } = request.params;
      const requestId = request.requestId || undefined;

      const cred = await prisma.webAuthnCredential.findFirst({
        where: { id, userId: user.id, userType: "portal" },
      });

      if (!cred) {
        return reply.status(404).send({ error: "Credential not found", requestId });
      }

      await prisma.webAuthnCredential.delete({ where: { id } });

      await writeAuditLog(
        user.orgId,
        user.email,
        "webauthn.revoked",
        { credentialId: cred.credentialId.substring(0, 16) + "..." },
        requestId
      );

      // Emit notification
      const { emitPasskeyRevoked } = await import("../utils/notifications");
      await emitPasskeyRevoked(user.orgId, user.id, requestId);

      return { ok: true, requestId };
    }
  );

  // POST /portal/webauthn/credentials/revoke-all
  fastify.post(
    "/portal/webauthn/credentials/revoke-all",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const user = request.portalUser!;
      const requestId = request.requestId || undefined;

      const { count } = await prisma.webAuthnCredential.deleteMany({
        where: { userId: user.id, userType: "portal" },
      });

      await writeAuditLog(
        user.orgId,
        user.email,
        "webauthn.revoked_all",
        { count },
        requestId
      );

      return { ok: true, count, requestId };
    }
  );

  // POST /portal/webauthn/sessions/revoke-all
  fastify.post(
    "/portal/webauthn/sessions/revoke-all",
    {
      preHandler: [
        requirePortalUser,
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const user = request.portalUser!;
      const requestId = request.requestId || undefined;

      // Revoke all portal sessions except current
      const currentTokenHash = (request as any)._portalTokenHash; // eslint-disable-line @typescript-eslint/no-explicit-any
      const where: Record<string, unknown> = {
        orgUserId: user.id,
        revokedAt: null,
      };
      if (currentTokenHash) {
        where.tokenHash = { not: currentTokenHash };
      }

      const { count } = await prisma.portalSession.updateMany({
        where,
        data: { revokedAt: new Date() },
      });

      await writeAuditLog(
        user.orgId,
        user.email,
        "webauthn.sessions_revoked_all",
        { count },
        requestId
      );

      return { ok: true, count, requestId };
    }
  );

  // ═══════════════════════════════════════════════
  // ADMIN: Registration
  // ═══════════════════════════════════════════════

  // GET /admin/webauthn/register/options
  fastify.get(
    "/admin/webauthn/register/options",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const admin = (request as any).adminUser; // eslint-disable-line @typescript-eslint/no-explicit-any
      const requestId = request.requestId || undefined;

      const existing = await prisma.webAuthnCredential.findMany({
        where: { userId: admin.id, userType: "admin" },
        select: { credentialId: true },
      });

      const challenge = await createChallengeDB(
        admin.id,
        "admin",
        request.ip,
        request.headers["user-agent"] as string | undefined
      );

      const options = generateRegistrationOptions(
        {
          userId: admin.id,
          userEmail: admin.email,
          userName: admin.email,
          existingCredentialIds: existing.map((c: { credentialId: string }) => c.credentialId),
        },
        "admin",
        challenge
      );

      return { options, requestId };
    }
  );

  // POST /admin/webauthn/register/verify
  fastify.post(
    "/admin/webauthn/register/verify",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const admin = (request as any).adminUser; // eslint-disable-line @typescript-eslint/no-explicit-any
      const requestId = request.requestId || undefined;
      const { credential, nickname } = request.body as {
        credential: RegistrationResponse;
        nickname?: string;
      };

      if (!credential) {
        return reply.status(400).send({ error: "Missing credential", requestId });
      }

      const expectedChallenge = await consumeChallengeDB(admin.id, "admin");
      if (!expectedChallenge) {
        return reply.status(400).send({ error: "Challenge expired or not found", requestId });
      }

      try {
        const result = verifyRegistration(credential, expectedChallenge);

        await prisma.webAuthnCredential.create({
          data: {
            userType: "admin",
            userId: admin.id,
            credentialId: result.credentialId,
            publicKey: result.publicKey,
            counter: result.counter,
            transports: JSON.stringify(result.transports),
            aaguid: result.aaguid,
            nickname: nickname || null,
          },
        });

        await writeAuditLog(
          "system",
          admin.email,
          "webauthn.registered",
          { credentialId: result.credentialId.substring(0, 16) + "..." },
          requestId
        );

        return { ok: true, credentialId: result.credentialId, requestId };
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : "Registration verification failed",
          requestId,
        });
      }
    }
  );

  // POST /admin/webauthn/login/options
  fastify.post(
    "/admin/webauthn/login/options",
    {
      preHandler: [createRateLimitMiddleware({ limit: 20, windowMs: 60000 })],
    },
    async (request, reply) => {
      const { email } = request.body as { email?: string };
      const requestId = request.requestId || undefined;

      if (!email) {
        return reply.status(400).send({ error: "Email is required", requestId });
      }

      const adminUser = await prisma.adminUser.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!adminUser) {
        // Dummy challenge (no DB write) to prevent user enumeration
        const dummyChallenge = createChallenge("dummy", "admin");
        return {
          options: {
            rpId: "localhost",
            challenge: dummyChallenge,
            timeout: 300000,
            userVerification: "preferred",
            allowCredentials: [],
          },
          requestId,
        };
      }

      const credentials = await prisma.webAuthnCredential.findMany({
        where: { userId: adminUser.id, userType: "admin" },
        select: { credentialId: true },
      });

      if (credentials.length === 0) {
        return reply.status(400).send({
          error: "No passkeys registered for this account",
          requestId,
        });
      }

      const challenge = await createChallengeDB(
        adminUser.id,
        "admin",
        request.ip,
        request.headers["user-agent"] as string | undefined
      );

      const options = generateLoginOptions(
        adminUser.id,
        "admin",
        credentials.map((c) => c.credentialId),
        challenge
      );

      return { options, requestId };
    }
  );

  // POST /admin/webauthn/login/verify
  fastify.post(
    "/admin/webauthn/login/verify",
    {
      preHandler: [createRateLimitMiddleware({ limit: 10, windowMs: 60000 })],
    },
    async (request, reply) => {
      const { credential, email } = request.body as {
        credential: AssertionResponse;
        email?: string;
      };
      const requestId = request.requestId || undefined;

      if (!credential || !email) {
        return reply.status(400).send({ error: "Missing credential or email", requestId });
      }

      const stored = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: credential.id },
      });

      if (!stored || stored.userType !== "admin") {
        return reply.status(401).send({ error: "Invalid passkey", requestId });
      }

      const adminUser = await prisma.adminUser.findUnique({
        where: { id: stored.userId },
      });

      if (!adminUser) {
        return reply.status(401).send({ error: "Invalid passkey", requestId });
      }

      // Consume challenge from DB (single-use enforcement)
      const expectedChallenge = await consumeChallengeDB(adminUser.id, "admin");
      if (!expectedChallenge) {
        return reply.status(400).send({ error: "Challenge expired or not found", requestId });
      }

      try {
        const { newCounter } = verifyAssertion(
          credential,
          expectedChallenge,
          stored.publicKey,
          stored.counter
        );

        // Update counter + lastUsedAt
        await prisma.webAuthnCredential.update({
          where: { id: stored.id },
          data: { counter: newCounter, lastUsedAt: new Date() },
        });

        // Create admin session (passkey = strong auth, skip TOTP)
        request.session.adminUserId = adminUser.id;
        request.session.adminRole = adminUser.role;
        request.session.adminEmail = adminUser.email;
        // No mfaPending — passkey is sufficient

        // Upsert device
        await upsertDevice(
          adminUser.id,
          "admin",
          request.headers["user-agent"] as string | undefined,
          request.ip
        );

        await writeAuditLog(
          "system",
          adminUser.email,
          "webauthn.login",
          { credentialId: credential.id.substring(0, 16) + "..." },
          requestId
        );

        return {
          ok: true,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            role: adminUser.role,
          },
          requestId,
        };
      } catch (err) {
        return reply.status(401).send({
          error: err instanceof Error ? err.message : "Passkey verification failed",
          requestId,
        });
      }
    }
  );

  // GET /admin/webauthn/credentials
  fastify.get(
    "/admin/webauthn/credentials",
    { preHandler: [requireAdmin] },
    async (request) => {
      const admin = (request as any).adminUser;
      const requestId = request.requestId || undefined;

      const credentials = await prisma.webAuthnCredential.findMany({
        where: { userId: admin.id, userType: "admin" },
        select: {
          id: true,
          credentialId: true,
          nickname: true,
          createdAt: true,
          lastUsedAt: true,
          aaguid: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return { credentials, requestId };
    }
  );

  // POST /admin/webauthn/credentials/:id/revoke
  fastify.post<{ Params: { id: string } }>(
    "/admin/webauthn/credentials/:id/revoke",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const admin = (request as any).adminUser;
      const { id } = request.params;
      const requestId = request.requestId || undefined;

      const cred = await prisma.webAuthnCredential.findFirst({
        where: { id, userId: admin.id, userType: "admin" },
      });

      if (!cred) {
        return reply.status(404).send({ error: "Credential not found", requestId });
      }

      await prisma.webAuthnCredential.delete({ where: { id } });

      await writeAuditLog(
        "system",
        admin.email,
        "webauthn.revoked",
        { credentialId: cred.credentialId.substring(0, 16) + "..." },
        requestId
      );

      return { ok: true, requestId };
    }
  );

  // POST /admin/webauthn/credentials/revoke-all
  fastify.post(
    "/admin/webauthn/credentials/revoke-all",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const admin = (request as any).adminUser; // eslint-disable-line @typescript-eslint/no-explicit-any
      const requestId = request.requestId || undefined;

      const { count } = await prisma.webAuthnCredential.deleteMany({
        where: { userId: admin.id, userType: "admin" },
      });

      await writeAuditLog(
        "system",
        admin.email,
        "webauthn.revoked_all",
        { count },
        requestId
      );

      return { ok: true, count, requestId };
    }
  );

  // POST /admin/webauthn/sessions/revoke-all
  fastify.post(
    "/admin/webauthn/sessions/revoke-all",
    {
      preHandler: [
        requireAdmin,
        requireStepUp("admin"),
        createRateLimitMiddleware({ limit: 5, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const admin = (request as any).adminUser; // eslint-disable-line @typescript-eslint/no-explicit-any
      const requestId = request.requestId || undefined;

      // Admin sessions are session-store based; destroy all WebAuthn challenges for this admin
      await prisma.webAuthnChallenge.deleteMany({
        where: { userId: admin.id, userType: "admin" },
      });

      await writeAuditLog(
        "system",
        admin.email,
        "webauthn.sessions_revoked_all",
        {},
        requestId
      );

      return { ok: true, requestId };
    }
  );
}
