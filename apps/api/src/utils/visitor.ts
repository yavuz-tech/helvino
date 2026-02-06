/**
 * Visitor Session Management
 * 
 * Handles visitor identification and persistence
 */

import { prisma } from "../prisma";

export interface VisitorInfo {
  id: string;
  visitorKey: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/**
 * Upsert visitor record
 * Creates new visitor or updates lastSeenAt for existing visitor
 */
export async function upsertVisitor(
  orgId: string,
  visitorKey: string,
  userAgent?: string
): Promise<VisitorInfo> {
  const visitor = await prisma.visitor.upsert({
    where: {
      orgId_visitorKey: {
        orgId,
        visitorKey,
      },
    },
    update: {
      lastSeenAt: new Date(),
      userAgent: userAgent || undefined,
    },
    create: {
      orgId,
      visitorKey,
      userAgent: userAgent || undefined,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    },
    select: {
      id: true,
      visitorKey: true,
      firstSeenAt: true,
      lastSeenAt: true,
    },
  });

  return visitor;
}

/**
 * Get visitor by key
 */
export async function getVisitorByKey(
  orgId: string,
  visitorKey: string
): Promise<VisitorInfo | null> {
  const visitor = await prisma.visitor.findUnique({
    where: {
      orgId_visitorKey: {
        orgId,
        visitorKey,
      },
    },
    select: {
      id: true,
      visitorKey: true,
      firstSeenAt: true,
      lastSeenAt: true,
    },
  });

  return visitor;
}
