/**
 * Verify live visitors count for an org (last 5 min).
 * Exit 0 if count >= 8, else exit 1.
 *
 * Usage: ORG_ID=optional npx tsx scripts/verify-live-visitors.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgId = process.env.ORG_ID;
  const orgKey = process.env.ORG_KEY;
  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, key: true } })
    : orgKey
      ? await prisma.organization.findFirst({ where: { key: orgKey }, select: { id: true, key: true } })
      : await prisma.organization.findFirst({ where: { key: "demo" }, select: { id: true, key: true } })
        ?? await prisma.organization.findFirst({ select: { id: true, key: true } });

  if (!org) {
    console.error("No organization found.");
    process.exit(1);
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const liveCount = await prisma.visitor.count({
    where: { orgId: org.id, lastSeenAt: { gte: fiveMinutesAgo } },
  });

  console.log(`Org: ${org.key} (${org.id})`);
  console.log(`Live visitors (last 5 min): ${liveCount}`);

  if (liveCount >= 8) {
    console.log("OK: at least 8 live visitors.");
    process.exit(0);
  }
  console.error(`FAIL: expected >= 8 live visitors, got ${liveCount}. Run: pnpm run seed:live-visitors`);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
