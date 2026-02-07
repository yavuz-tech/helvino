/**
 * Portal Conversation Management Routes — Step 11.47
 *
 * PATCH /portal/conversations/:id           — update status/assignment
 * GET   /portal/conversations/:id/notes     — list notes
 * POST  /portal/conversations/:id/notes     — create note
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser, requirePortalRole } from "../middleware/require-portal-user";
import { writeAuditLog } from "../utils/audit-log";
import { createRateLimitMiddleware } from "../middleware/rate-limit";

export async function portalConversationRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // PATCH /portal/conversations/:id
  // Update conversation status and/or assignment
  // ═══════════════════════════════════════════════════════════════
  fastify.patch<{
    Params: { id: string };
    Body: {
      status?: "OPEN" | "CLOSED";
      assignedToUserId?: string | null;
    };
  }>(
    "/portal/conversations/:id",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status, assignedToUserId } = request.body;
      const actor = request.portalUser!;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (!status && assignedToUserId === undefined) {
        return reply.status(400).send({
          error: { code: "INVALID_INPUT", message: "No updates provided", requestId },
        });
      }

      // Verify conversation belongs to org
      const conversation = await prisma.conversation.findFirst({
        where: { id, orgId: actor.orgId },
        select: { id: true, status: true, assignedToOrgUserId: true },
      });

      if (!conversation) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Conversation not found", requestId },
        });
      }

      // Validate assignee if provided
      if (assignedToUserId !== undefined && assignedToUserId !== null) {
        const assignee = await prisma.orgUser.findFirst({
          where: { id: assignedToUserId, orgId: actor.orgId, isActive: true },
          select: { id: true, email: true },
        });

        if (!assignee) {
          return reply.status(400).send({
            error: {
              code: "INVALID_ASSIGNEE",
              message: "User not found or inactive in this organization",
              requestId,
            },
          });
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (status) {
        updateData.status = status;
        if (status === "CLOSED" && conversation.status !== "CLOSED") {
          updateData.closedAt = new Date();
        } else if (status === "OPEN" && conversation.status === "CLOSED") {
          updateData.closedAt = null;
        }
      }
      if (assignedToUserId !== undefined) {
        updateData.assignedToOrgUserId = assignedToUserId;
      }

      // Update conversation
      const updated = await prisma.conversation.update({
        where: { id },
        data: updateData,
        include: {
          assignedTo: { select: { id: true, email: true, role: true } },
        },
      });

      // Audit logs (best-effort)
      if (status && status !== conversation.status) {
        const action = status === "CLOSED" ? "conversation.closed" : "conversation.reopened";
        writeAuditLog(actor.orgId, actor.email, action, { conversationId: id }, requestId).catch(
          () => {}
        );
      }

      if (assignedToUserId !== undefined && assignedToUserId !== conversation.assignedToOrgUserId) {
        const action =
          assignedToUserId === null ? "conversation.unassigned" : "conversation.assigned";
        writeAuditLog(
          actor.orgId,
          actor.email,
          action,
          { conversationId: id, assignedToUserId },
          requestId
        ).catch(() => {});
      }

      return {
        conversation: {
          id: updated.id,
          status: updated.status,
          assignedTo: updated.assignedTo || null,
          closedAt: updated.closedAt?.toISOString() || null,
        },
        requestId,
      };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // GET /portal/conversations/:id/notes
  // List notes for a conversation
  // ═══════════════════════════════════════════════════════════════
  fastify.get<{ Params: { id: string } }>(
    "/portal/conversations/:id/notes",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const actor = request.portalUser!;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      // Verify conversation belongs to org
      const conversation = await prisma.conversation.findFirst({
        where: { id, orgId: actor.orgId },
        select: { id: true },
      });

      if (!conversation) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Conversation not found", requestId },
        });
      }

      // Fetch notes
      const notes = await prisma.conversationNote.findMany({
        where: { conversationId: id, orgId: actor.orgId },
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, email: true, role: true } },
        },
      });

      return {
        notes: notes.map((n) => ({
          id: n.id,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
          author: n.author,
        })),
        requestId,
      };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // POST /portal/conversations/:id/notes
  // Create a note for a conversation
  // ═══════════════════════════════════════════════════════════════
  fastify.post<{
    Params: { id: string };
    Body: { body: string };
  }>(
    "/portal/conversations/:id/notes",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { body } = request.body;
      const actor = request.portalUser!;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      // Validate body
      if (!body || body.trim().length === 0) {
        return reply.status(400).send({
          error: { code: "INVALID_INPUT", message: "Note body is required", requestId },
        });
      }

      if (body.length > 2000) {
        return reply.status(400).send({
          error: { code: "INVALID_INPUT", message: "Note body too long (max 2000)", requestId },
        });
      }

      // Verify conversation belongs to org
      const conversation = await prisma.conversation.findFirst({
        where: { id, orgId: actor.orgId },
        select: { id: true },
      });

      if (!conversation) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Conversation not found", requestId },
        });
      }

      // Create note
      const note = await prisma.conversationNote.create({
        data: {
          orgId: actor.orgId,
          conversationId: id,
          authorOrgUserId: actor.id,
          body: body.trim(),
        },
        include: {
          author: { select: { id: true, email: true, role: true } },
        },
      });

      // Audit log (best-effort)
      writeAuditLog(
        actor.orgId,
        actor.email,
        "conversation.note_created",
        { conversationId: id, noteId: note.id },
        requestId
      ).catch(() => {});

      return {
        note: {
          id: note.id,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
          author: note.author,
        },
        requestId,
      };
    }
  );
}
