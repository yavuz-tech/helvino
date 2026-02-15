import "dotenv/config";
/**
 * Prisma Client Singleton
 * Ensures only one instance is created globally
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Warn if SSL is not configured in production
if (process.env.NODE_ENV === "production") {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl && !dbUrl.includes("sslmode=") && !dbUrl.includes("ssl=")) {
    console.warn(
      "[DB] WARNING: DATABASE_URL does not include sslmode=require. " +
      "Connections may be unencrypted. Railway enforces SSL by default, " +
      "but other environments may not."
    );
  }
}
