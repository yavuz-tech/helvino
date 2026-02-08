/**
 * Portal Team Routes — Step 11.18
 *
 * User/invite management for customer portal (org-scoped).
 * All endpoints require portal session cookie auth.
 */

import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma } from "../prisma";
import { hashPassword } from "../utils/password";
import { writeAuditLog } from "../utils/audit-log";
import { sendEmail } from "../utils/mailer";
import { generateInviteLink } from "../utils/signed-links";
import { getInviteEmail } from "../utils/email-templates";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import {
  requirePortalUser,
  requirePortalRole,
} from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  PORTAL_SESSION_TTL_MS,
} from "../utils/portal-session";

// ── Helpers ──

/** SHA-256 hash for invite tokens (store only hash, never raw) */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex strings */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

const VALID_ROLES = ["owner", "admin", "agent"] as const;
const INVITE_ROLES = ["admin", "agent"] as const;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;

export async function portalTeamRoutes(fastify: FastifyInstance) {
  // ──────────────────────────────────────────────────────
  // GET /portal/org/users — list org users
  // ──────────────────────────────────────────────────────
  fastify.get(
    "/portal/org/users",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const actor = request.portalUser!;

      const users = await prisma.orgUser.findMany({
        where: { orgId: actor.orgId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const invites = await prisma.portalInvite.findMany({
        where: {
          orgId: actor.orgId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return { users, invites };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/org/users/invite — create invite
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/org/users/invite",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { email?: string; role?: string };

      // Validate email
      const email = body.email?.toLowerCase().trim();
      if (!email || !email.includes("@") || email.length < 5) {
        reply.code(400);
        return { error: "Valid email is required" };
      }

      // Validate role
      const role = body.role as (typeof INVITE_ROLES)[number] | undefined;
      if (!role || !(INVITE_ROLES as readonly string[]).includes(role)) {
        reply.code(400);
        return { error: `Role must be one of: ${INVITE_ROLES.join(", ")}` };
      }

      // ── maxAgents enforcement (plan limit) ──
      const orgForPlan = await prisma.organization.findUnique({
        where: { id: actor.orgId },
        select: { planKey: true },
      });
      const planForLimit = orgForPlan
        ? await prisma.plan.findUnique({
            where: { key: orgForPlan.planKey },
            select: { maxAgents: true },
          })
        : null;
      const maxAgents = planForLimit?.maxAgents ?? 1;

      // Count active agents (non-owner users) + pending invites
      const [activeAgentCount, pendingInviteCount] = await Promise.all([
        prisma.orgUser.count({
          where: { orgId: actor.orgId, isActive: true, role: { not: "owner" } },
        }),
        prisma.portalInvite.count({
          where: { orgId: actor.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
        }),
      ]);

      if (activeAgentCount + pendingInviteCount >= maxAgents) {
        reply.code(403);
        return {
          error: "Agent limit reached",
          code: "MAX_AGENTS_REACHED",
          maxAgents,
          current: activeAgentCount + pendingInviteCount,
        };
      }

      // Check if user already exists in this org
      const existingUser = await prisma.orgUser.findFirst({
        where: { orgId: actor.orgId, email },
      });
      if (existingUser) {
        reply.code(409);
        return { error: "User with this email already exists in this organization" };
      }

      // Remove any existing pending invite for this email+org
      await prisma.portalInvite.deleteMany({
        where: { orgId: actor.orgId, email },
      });

      // Generate secure token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenH = hashToken(rawToken);

      const expiresAt = new Date(
        Date.now() + DEFAULT_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      );

      const invite = await prisma.portalInvite.create({
        data: {
          orgId: actor.orgId,
          email,
          role,
          tokenHash: tokenH,
          expiresAt,
          createdByPortalUserId: actor.id,
        },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "team.invite.create",
        { invitedEmail: email, role, inviteId: invite.id },
        request.requestId
      );

      // Track conversion signal: first invite (best-effort)
      prisma.organization
        .updateMany({
          where: { id: actor.orgId, firstInviteSentAt: null },
          data: { firstInviteSentAt: new Date() },
        })
        .catch(() => {});

      // Generate signed invite link + send email
      const inviteLink = generateInviteLink(rawToken, expiresAt);

      // Fetch org name for email template
      const org = await prisma.organization.findUnique({
        where: { id: actor.orgId },
        select: { name: true, language: true },
      });

      const emailContent = getInviteEmail(
        org?.language,
        org?.name || "Organization",
        role,
        inviteLink,
        `${DEFAULT_INVITE_EXPIRY_DAYS} days`
      );

      // Send invite email (best-effort; don't block response on failure)
      sendEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        tags: ["invite"],
      }).catch(() => {/* email send is best-effort */});

      reply.code(201);
      return { ok: true, invite, inviteLink };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/org/users/invite/resend — regenerate token
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/org/users/invite/resend",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { inviteId?: string };

      if (!body.inviteId) {
        reply.code(400);
        return { error: "inviteId is required" };
      }

      const invite = await prisma.portalInvite.findFirst({
        where: { id: body.inviteId, orgId: actor.orgId, acceptedAt: null },
      });

      if (!invite) {
        reply.code(404);
        return { error: "Invite not found" };
      }

      // Generate new token + extend expiry
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenH = hashToken(rawToken);

      const expiresAt = new Date(
        Date.now() + DEFAULT_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      );

      await prisma.portalInvite.update({
        where: { id: invite.id },
        data: { tokenHash: tokenH, expiresAt },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "team.invite.resend",
        { inviteId: invite.id, email: invite.email },
        request.requestId
      );

      // Generate signed invite link + resend email
      const inviteLink = generateInviteLink(rawToken, expiresAt);

      const org = await prisma.organization.findUnique({
        where: { id: actor.orgId },
        select: { name: true, language: true },
      });

      const emailContent = getInviteEmail(
        org?.language,
        org?.name || "Organization",
        invite.role,
        inviteLink,
        `${DEFAULT_INVITE_EXPIRY_DAYS} days`
      );

      sendEmail({
        to: invite.email,
        subject: emailContent.subject,
        html: emailContent.html,
        tags: ["invite", "resend"],
      }).catch(() => {/* best-effort */});

      return { ok: true, inviteLink };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/org/users/invite/revoke — revoke invite
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/org/users/invite/revoke",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requireStepUp("portal"),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { inviteId?: string };

      if (!body.inviteId) {
        reply.code(400);
        return { error: "inviteId is required" };
      }

      const invite = await prisma.portalInvite.findFirst({
        where: { id: body.inviteId, orgId: actor.orgId, acceptedAt: null },
      });

      if (!invite) {
        reply.code(404);
        return { error: "Invite not found" };
      }

      // Revoke = set expiresAt to now
      await prisma.portalInvite.update({
        where: { id: invite.id },
        data: { expiresAt: new Date() },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "team.invite.revoke",
        { inviteId: invite.id, email: invite.email },
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/org/users/role — change user role
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/org/users/role",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner"]),
        requireStepUp("portal"),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { userId?: string; role?: string };

      if (!body.userId || !body.role) {
        reply.code(400);
        return { error: "userId and role are required" };
      }

      if (!(VALID_ROLES as readonly string[]).includes(body.role)) {
        reply.code(400);
        return { error: `Role must be one of: ${VALID_ROLES.join(", ")}` };
      }

      const target = await prisma.orgUser.findFirst({
        where: { id: body.userId, orgId: actor.orgId },
      });

      if (!target) {
        reply.code(404);
        return { error: "User not found" };
      }

      // Cannot demote last owner
      if (target.role === "owner" && body.role !== "owner") {
        const ownerCount = await prisma.orgUser.count({
          where: { orgId: actor.orgId, role: "owner", isActive: true },
        });
        if (ownerCount <= 1) {
          reply.code(400);
          return { error: "Cannot demote the last owner" };
        }
      }

      await prisma.orgUser.update({
        where: { id: target.id },
        data: { role: body.role },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        "team.role.change",
        { targetUserId: target.id, targetEmail: target.email, oldRole: target.role, newRole: body.role },
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/org/users/deactivate — deactivate / reactivate user
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/org/users/deactivate",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin"]),
        requireStepUp("portal"),
      ],
    },
    async (request, reply) => {
      const actor = request.portalUser!;
      const body = request.body as { userId?: string; active?: boolean };

      if (!body.userId || typeof body.active !== "boolean") {
        reply.code(400);
        return { error: "userId and active (boolean) are required" };
      }

      const target = await prisma.orgUser.findFirst({
        where: { id: body.userId, orgId: actor.orgId },
      });

      if (!target) {
        reply.code(404);
        return { error: "User not found" };
      }

      // Cannot deactivate self
      if (target.id === actor.id) {
        reply.code(400);
        return { error: "Cannot deactivate yourself" };
      }

      // Cannot deactivate last owner
      if (target.role === "owner" && !body.active) {
        const ownerCount = await prisma.orgUser.count({
          where: { orgId: actor.orgId, role: "owner", isActive: true },
        });
        if (ownerCount <= 1) {
          reply.code(400);
          return { error: "Cannot deactivate the last owner" };
        }
      }

      // Admin cannot deactivate owner
      if (actor.role === "admin" && target.role === "owner") {
        reply.code(403);
        return { error: "Admin cannot deactivate an owner" };
      }

      await prisma.orgUser.update({
        where: { id: target.id },
        data: { isActive: body.active },
      });

      await writeAuditLog(
        actor.orgId,
        actor.email,
        body.active ? "team.user.reactivate" : "team.user.deactivate",
        { targetUserId: target.id, targetEmail: target.email },
        request.requestId
      );

      return { ok: true };
    }
  );

  // ──────────────────────────────────────────────────────
  // POST /portal/auth/accept-invite — accept invite (public, no session)
  // ──────────────────────────────────────────────────────
  fastify.post(
    "/portal/auth/accept-invite",
    {
      preHandler: [
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const body = request.body as {
        token?: string;
        password?: string;
      };

      if (!body.token || !body.password) {
        reply.code(400);
        return { error: "Token and password are required" };
      }

      if (body.password.length < 8) {
        reply.code(400);
        return { error: "Password must be at least 8 characters" };
      }

      const tokenH = hashToken(body.token);

      // Find invite by hash
      const invite = await prisma.portalInvite.findUnique({
        where: { tokenHash: tokenH },
      });

      if (!invite) {
        reply.code(404);
        return { error: "Invalid or expired invite" };
      }

      // Use timing-safe compare
      if (!timingSafeEqual(invite.tokenHash, tokenH)) {
        reply.code(404);
        return { error: "Invalid or expired invite" };
      }

      // Check expiry
      if (invite.expiresAt < new Date()) {
        reply.code(410);
        return { error: "Invite has expired" };
      }

      // Check not already accepted
      if (invite.acceptedAt) {
        reply.code(410);
        return { error: "Invite has already been accepted" };
      }

      // Check if user with this email already exists in this org
      const existingUser = await prisma.orgUser.findFirst({
        where: { orgId: invite.orgId, email: invite.email },
      });
      if (existingUser) {
        reply.code(409);
        return { error: "An account with this email already exists" };
      }

      // Create OrgUser
      const passwordHashed = await hashPassword(body.password);
      const orgUser = await prisma.orgUser.create({
        data: {
          orgId: invite.orgId,
          email: invite.email,
          passwordHash: passwordHashed,
          role: invite.role,
          isActive: true,
          lastLoginAt: new Date(),
        },
        include: {
          organization: { select: { id: true, key: true, name: true } },
        },
      });

      // Mark invite as accepted
      await prisma.portalInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await writeAuditLog(
        invite.orgId,
        invite.email,
        "team.invite.accept",
        { inviteId: invite.id },
        request.requestId
      );

      // Auto-login: set portal session cookie
      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        reply.code(500);
        return { error: "SESSION_SECRET not configured" };
      }

      const token = createPortalSessionToken(
        { userId: orgUser.id, orgId: orgUser.orgId, role: orgUser.role },
        secret
      );

      const isProduction = process.env.NODE_ENV === "production";
      reply.setCookie(PORTAL_SESSION_COOKIE, token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
      });

      reply.code(201);
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
      };
    }
  );
}
