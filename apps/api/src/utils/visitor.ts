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

export interface VisitorMeta {
  userAgent?: string;
  ip?: string;
  country?: string;
  city?: string;
  currentPage?: string;
  referrer?: string;
}

/**
 * Upsert visitor record
 * Creates new visitor or updates lastSeenAt for existing visitor
 */
export async function upsertVisitor(
  orgId: string,
  visitorKey: string,
  meta?: VisitorMeta
): Promise<VisitorInfo> {
  const updateData: Record<string, unknown> = { lastSeenAt: new Date() };
  const createData: Record<string, unknown> = {
    orgId,
    visitorKey,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  };

  if (meta?.userAgent) { updateData.userAgent = meta.userAgent; createData.userAgent = meta.userAgent; }
  if (meta?.ip) { updateData.ip = meta.ip; createData.ip = meta.ip; }
  if (meta?.country) { updateData.country = meta.country; createData.country = meta.country; }
  if (meta?.city) { updateData.city = meta.city; createData.city = meta.city; }
  if (meta?.currentPage) { updateData.currentPage = meta.currentPage; createData.currentPage = meta.currentPage; }
  if (meta?.referrer) { updateData.referrer = meta.referrer; createData.referrer = meta.referrer; }

  const visitor = await prisma.visitor.upsert({
    where: {
      orgId_visitorKey: {
        orgId,
        visitorKey,
      },
    },
    update: updateData,
    create: createData as any,
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
