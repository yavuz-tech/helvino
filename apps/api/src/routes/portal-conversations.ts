/**
 * Portal Conversation Management Routes — Step 11.47 + 11.48
 *
 * GET   /portal/conversations                  — list with filters/search/pagination
 * GET   /portal/conversations/unread-count     — inbox unread count (bell badge)
 * POST  /portal/conversations/:id/read         — mark conversation as read (clear badge)
 * POST  /portal/conversations/bulk             — bulk assign/unassign/open/close
 * PATCH /portal/conversations/:id              — update status/assignment
 * POST  /portal/conversations/:id/messages      — send agent reply (assistant message)
 * GET   /portal/conversations/:id/notes         — list notes
 * POST  /portal/conversations/:id/notes        — create note
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { store } from "../store";
import { requirePortalUser, requirePortalRole } from "../middleware/require-portal-user";
import { requireStepUp } from "../middleware/require-step-up";
import { writeAuditLog } from "../utils/audit-log";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import { checkMessageEntitlement, checkM2Entitlement, recordMessageUsage, recordM2Usage } from "../utils/entitlements";
import { validateJsonContentType } from "../middleware/validation";

export async function portalConversationRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // GET /portal/conversations — Enhanced list with filters + search + pagination
  // ═══════════════════════════════════════════════════════════════
  fastify.get<{
    Querystring: {
      status?: string;
      assigned?: string;
      q?: string;
      limit?: string;
      cursor?: string;
      unreadOnly?: string;
    };
  }>(
    "/portal/conversations",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      // Parse query params
      const statusFilter = (request.query.status || "OPEN").toUpperCase();
      const assignedFilter = request.query.assigned || "any";
      const searchQuery = request.query.q?.trim() || "";
      const unreadOnly = request.query.unreadOnly === "1" || request.query.unreadOnly === "true";
      const limit = Math.min(Math.max(parseInt(request.query.limit || "20", 10) || 20, 10), 50);
      const cursor = request.query.cursor || undefined;

      // Build where clause
      const where: Record<string, unknown> = { orgId: actor.orgId };

      if (unreadOnly) {
        where.hasUnreadFromUser = true;
      }

      // Status filter
      if (statusFilter === "OPEN" || statusFilter === "CLOSED") {
        where.status = statusFilter;
      }
      // "ALL" => no status filter

      // Assignment filter
      if (assignedFilter === "me") {
        where.assignedToOrgUserId = actor.id;
      } else if (assignedFilter === "unassigned") {
        where.assignedToOrgUserId = null;
      } else if (assignedFilter !== "any" && assignedFilter.length > 5) {
        // Specific user ID
        where.assignedToOrgUserId = assignedFilter;
      }

      // Search filter (search in conversation id)
      if (searchQuery) {
        where.id = { contains: searchQuery, mode: "insensitive" };
      }

      // Cursor-based pagination
      const findArgs: Record<string, unknown> = {
        where,
        orderBy: [
          { hasUnreadFromUser: "desc" as const },
          { updatedAt: "desc" as const },
        ],
        take: limit + 1,
        include: {
          assignedTo: { select: { id: true, email: true, role: true } },
          messages: {
            orderBy: { timestamp: "desc" as const },
            take: 1,
            select: { content: true, role: true, timestamp: true },
          },
          _count: { select: { notes: true } },
        },
      };

      if (cursor) {
        findArgs.cursor = { id: cursor };
        findArgs.skip = 1;
      }

      const entries = await prisma.conversation.findMany(findArgs as any);

      const hasMore = entries.length > limit;
      const slice = hasMore ? entries.slice(0, limit) : entries;
      const nextCursor = hasMore ? slice[slice.length - 1]?.id || null : null;

      const items = slice.map((conv: any) => {
        const lastMsg = conv.messages?.[0] || null;
        return {
          id: conv.id,
          status: conv.status,
          assignedToOrgUserId: conv.assignedToOrgUserId || null,
          assignedTo: conv.assignedTo || null,
          closedAt: conv.closedAt?.toISOString() || null,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString(),
          messageCount: conv.messageCount,
          lastMessageAt: lastMsg?.timestamp?.toISOString() || conv.updatedAt.toISOString(),
          noteCount: conv._count?.notes || 0,
          hasUnreadMessages: !!conv.hasUnreadFromUser,
          preview: lastMsg
            ? {
                text: lastMsg.content.length > 100 ? lastMsg.content.slice(0, 100) + "..." : lastMsg.content,
                from: lastMsg.role,
              }
            : null,
        };
      });

      return { items, nextCursor, requestId };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // GET /portal/conversations/unread-count — Inbox unread count (for bell badge)
  // ═══════════════════════════════════════════════════════════════
  fastify.get(
    "/portal/conversations/unread-count",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const count = await prisma.conversation.count({
        where: { orgId: actor.orgId, hasUnreadFromUser: true },
      });
      return { unreadCount: count };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // POST /portal/conversations/:id/read — Mark conversation as read (clear badge)
  // ═══════════════════════════════════════════════════════════════
  fastify.post<{ Params: { id: string } }>(
    "/portal/conversations/:id/read",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 120, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const actor = request.portalUser!;

      const conv = await prisma.conversation.findFirst({
        where: { id, orgId: actor.orgId },
        select: { id: true, hasUnreadFromUser: true },
      });
      if (!conv) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      if (conv.hasUnreadFromUser) {
        await prisma.conversation.update({
          where: { id },
          data: { hasUnreadFromUser: false },
        });
      }
      return { ok: true };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // POST /portal/conversations/read-all — Mark all conversations as read (badge takılı kalırsa)
  // ═══════════════════════════════════════════════════════════════
  fastify.post(
    "/portal/conversations/read-all",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
        validateJsonContentType,
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const result = await prisma.conversation.updateMany({
        where: { orgId: actor.orgId, hasUnreadFromUser: true },
        data: { hasUnreadFromUser: false },
      });
      return { ok: true, marked: result.count };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // GET /portal/conversations/counts — Unassigned / My open / Solved (Tidio-style sidebar)
  // ═══════════════════════════════════════════════════════════════
  fastify.get(
    "/portal/conversations/counts",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 60, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const base = { orgId: actor.orgId };
      const [unassigned, myOpen, solved] = await Promise.all([
        prisma.conversation.count({ where: { ...base, status: "OPEN", assignedToOrgUserId: null } }),
        prisma.conversation.count({ where: { ...base, status: "OPEN", assignedToOrgUserId: actor.id } }),
        prisma.conversation.count({ where: { ...base, status: "CLOSED" } }),
      ]);
      return { unassigned, myOpen, solved };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // POST /portal/conversations/bulk — Bulk actions
  // ═══════════════════════════════════════════════════════════════
  fastify.post<{
    Body: {
      ids: string[];
      action: "ASSIGN" | "UNASSIGN" | "OPEN" | "CLOSE";
      assignedToOrgUserId?: string;
    };
  }>(
    "/portal/conversations/bulk",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        requireStepUp("portal"),
        createRateLimitMiddleware({ limit: 10, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { ids, action, assignedToOrgUserId } = request.body;
      const actor = request.portalUser!;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      // Validate ids
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({
          error: { code: "INVALID_INPUT", message: "ids must be a non-empty array", requestId },
        });
      }
      if (ids.length > 50) {
        return reply.status(400).send({
          error: { code: "INVALID_INPUT", message: "Maximum 50 conversations per bulk action", requestId },
        });
      }

      // Validate action
      const validActions = ["ASSIGN", "UNASSIGN", "OPEN", "CLOSE"];
      if (!validActions.includes(action)) {
        return reply.status(400).send({
          error: { code: "INVALID_INPUT", message: "Invalid action", requestId },
        });
      }

      // Validate assignee for ASSIGN
      if (action === "ASSIGN") {
        if (!assignedToOrgUserId) {
          return reply.status(400).send({
            error: { code: "INVALID_INPUT", message: "assignedToOrgUserId required for ASSIGN", requestId },
          });
        }
        const assignee = await prisma.orgUser.findFirst({
          where: { id: assignedToOrgUserId, orgId: actor.orgId, isActive: true },
          select: { id: true },
        });
        if (!assignee) {
          return reply.status(400).send({
            error: { code: "INVALID_ASSIGNEE", message: "User not found or inactive", requestId },
          });
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (action === "ASSIGN") {
        updateData.assignedToOrgUserId = assignedToOrgUserId;
      } else if (action === "UNASSIGN") {
        updateData.assignedToOrgUserId = null;
      } else if (action === "CLOSE") {
        updateData.status = "CLOSED";
        updateData.closedAt = new Date();
      } else if (action === "OPEN") {
        updateData.status = "OPEN";
        updateData.closedAt = null;
      }

      // Execute bulk update (org-scoped)
      const result = await prisma.conversation.updateMany({
        where: { id: { in: ids }, orgId: actor.orgId },
        data: updateData,
      });

      // Audit log (best-effort)
      writeAuditLog(
        actor.orgId,
        actor.email,
        "inbox.bulk",
        { action, count: result.count, ids: ids.slice(0, 10), assignedToOrgUserId, requestId },
        requestId
      ).catch(() => {});

      return { updated: result.count, action, requestId };
    }
  );
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
  // POST /portal/conversations/:id/messages
  // Send agent reply (assistant message) — visible in conversation thread and widget
  // ═══════════════════════════════════════════════════════════════
  fastify.post<{
    Params: { id: string };
    Body: { content: string };
  }>(
    "/portal/conversations/:id/messages",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 120, windowMs: 60000 }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { content } = request.body;
      const actor = request.portalUser!;
      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return reply.status(400).send({
          error: { code: "INVALID_INPUT", message: "Message content is required", requestId },
        });
      }
      if (content.length > 10000) {
        return reply.status(400).send({
          error: { code: "INVALID_INPUT", message: "Message too long (max 10000)", requestId },
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

      const entitlement = await checkMessageEntitlement(actor.orgId);
      if (!entitlement.allowed) {
        return reply.status(402).send({
          error: { code: entitlement.code || "QUOTA_EXCEEDED", message: entitlement.error || "Plan limit exceeded", requestId },
        });
      }
      const m2Entitlement = await checkM2Entitlement(actor.orgId);
      if (!m2Entitlement.allowed) {
        return reply.status(402).send({
          error: {
            code: "QUOTA_M2_EXCEEDED",
            message: m2Entitlement.error || "M2 quota exceeded",
            resetAt: m2Entitlement.resetAt || null,
            requestId,
          },
        });
      }

      const message = await store.addMessage(id, actor.orgId, "assistant", content.trim());
      if (!message) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Conversation not found", requestId },
        });
      }

      (fastify as any).io?.to(`org:${actor.orgId}`).emit("message:new", {
        conversationId: id,
        message,
      });

      await recordMessageUsage(actor.orgId);
      recordM2Usage(actor.orgId).catch(() => {});

      writeAuditLog(
        actor.orgId,
        actor.email,
        "conversation.message_sent",
        { conversationId: id, messageId: message.id },
        requestId
      ).catch(() => {});

      return reply.status(201).send({ ...message, requestId });
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
