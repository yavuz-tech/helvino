/**
 * Data store using Prisma ORM
 * Replaces in-memory storage with PostgreSQL
 */

import { Conversation, Message, ConversationDetail, Organization } from "./types";
import { generateId } from "@helvino/shared";
import { prisma } from "./prisma";

class PrismaStore {
  // Organizations
  async getOrganizationByKey(key: string): Promise<Organization | null> {
    const org = await prisma.organization.findUnique({
      where: { key },
    });

    if (!org) return null;

    return {
      id: org.id,
      key: org.key,
      name: org.name,
      allowedDomains: org.allowedDomains,
      widgetEnabled: org.widgetEnabled,
      writeEnabled: org.writeEnabled,
      aiEnabled: org.aiEnabled,
      primaryColor: org.primaryColor || undefined,
      messageRetentionDays: org.messageRetentionDays,
      hardDeleteOnRetention: org.hardDeleteOnRetention,
      lastRetentionRunAt: org.lastRetentionRunAt?.toISOString() || null,
      stripeCustomerId: org.stripeCustomerId,
      stripeSubscriptionId: org.stripeSubscriptionId,
      stripePriceId: org.stripePriceId,
      billingStatus: org.billingStatus,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: org.cancelAtPeriodEnd,
      billingEnforced: org.billingEnforced,
      billingGraceDays: org.billingGraceDays,
      lastStripeEventAt: org.lastStripeEventAt?.toISOString() || null,
      lastStripeEventId: org.lastStripeEventId || null,
      graceEndsAt: org.graceEndsAt?.toISOString() || null,
      billingLockedAt: org.billingLockedAt?.toISOString() || null,
      lastPaymentFailureAt: org.lastPaymentFailureAt?.toISOString() || null,
      lastBillingReconcileAt: org.lastBillingReconcileAt?.toISOString() || null,
      lastBillingReconcileResult: org.lastBillingReconcileResult || null,
      trialEndsAt: org.trialEndsAt?.toISOString() || null,
    };
  }

  // Conversations
  async createConversation(orgId: string, visitorId?: string): Promise<Conversation> {
    const now = new Date().toISOString();
    const id = generateId();

    const conversation = await prisma.conversation.create({
      data: {
        id,
        orgId,
        visitorId: visitorId || null,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      },
    });

    return {
      id: conversation.id,
      orgId: conversation.orgId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation.messageCount,
    };
  }

  async getConversation(id: string, orgId: string): Promise<Conversation | null> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        orgId,
      },
    });

    if (!conversation) return null;

    return {
      id: conversation.id,
      orgId: conversation.orgId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation.messageCount,
    };
  }

  async getConversationWithMessages(id: string, orgId: string): Promise<ConversationDetail | null> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        orgId,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: "asc",
          },
        },
      },
    });

    if (!conversation) return null;

    return {
      id: conversation.id,
      orgId: conversation.orgId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation.messageCount,
      messages: conversation.messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      })),
    };
  }

  async listConversations(orgId: string): Promise<Conversation[]> {
    const conversations = await prisma.conversation.findMany({
      where: {
        orgId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      orgId: conv.orgId,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messageCount: conv.messageCount,
    }));
  }

  // Messages
  async addMessage(
    conversationId: string,
    orgId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<Message | null> {
    // Verify conversation exists and belongs to org
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        orgId,
      },
    });

    if (!conversation) return null;

    const now = new Date().toISOString();
    const id = generateId();

    // Create message and update conversation in a transaction
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          id,
          conversationId,
          orgId,
          role,
          content,
          timestamp: now,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: now,
          messageCount: {
            increment: 1,
          },
        },
      }),
    ]);

    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role as "user" | "assistant",
      content: message.content,
      timestamp: message.timestamp.toISOString(),
    };
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    return messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    }));
  }

  // Utility
  async clear(): Promise<void> {
    await prisma.$transaction([
      prisma.message.deleteMany(),
      prisma.conversation.deleteMany(),
    ]);
  }
}

export const store = new PrismaStore();
