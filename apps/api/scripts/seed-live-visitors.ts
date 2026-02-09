/**
 * Seed 8 live visitors for a given org (for testing Recent Visitors / Live on portal dashboard).
 * Live = lastSeenAt within last 5 minutes.
 *
 * Usage:
 *   pnpm run seed:live-visitors          → uses org key "demo" (default seed user's org)
 *   ORG_KEY=demo pnpm run seed:live-visitors
 *   ORG_ID=<id> pnpm run seed:live-visitors
 *
 * Then: log in to portal as owner@demo.helvion.io / demo_owner_2026 and open dashboard to see 8 live visitors.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_VISITORS = [
  { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0", country: "TR", city: "Istanbul", page: "/" },
  { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1", country: "US", city: "New York", page: "/products" },
  { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148", country: "DE", city: "Berlin", page: "/pricing" },
  { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0", country: "GB", city: "London", page: "/about" },
  { userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0", country: "ES", city: "Madrid", page: "/contact" },
  { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0", country: "FR", city: "Paris", page: "/blog" },
  { userAgent: "Mozilla/5.0 (Android 14; Mobile) Chrome/120.0", country: "NL", city: "Amsterdam", page: "/faq" },
  { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0", country: "IT", city: "Rome", page: "/docs" },
];

async function main() {
  const orgId = process.env.ORG_ID;
  const orgKey = process.env.ORG_KEY; // e.g. "demo" for default seed user
  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, key: true } })
    : orgKey
      ? await prisma.organization.findFirst({ where: { key: orgKey }, select: { id: true, key: true } })
      : await prisma.organization.findFirst({ where: { key: "demo" }, select: { id: true, key: true } })
        ?? await prisma.organization.findFirst({ select: { id: true, key: true } });

  if (!org) {
    console.error("No organization found. Set ORG_ID or ensure DB has at least one org.");
    process.exit(1);
  }

  const count = Math.min(Math.max(1, parseInt(process.env.COUNT || "8", 10) || 8), SAMPLE_VISITORS.length);
  const now = new Date();
  console.log(`Seeding ${count} live visitors for org ${org.key} (${org.id})...`);

  for (let i = 0; i < count; i++) {
    const sample = SAMPLE_VISITORS[i]!;
    const visitorKey = `v_seed_live_${i + 1}_${Date.now()}`;
    await prisma.visitor.upsert({
      where: {
        orgId_visitorKey: { orgId: org.id, visitorKey },
      },
      update: {
        lastSeenAt: now,
        userAgent: sample.userAgent,
        country: sample.country,
        city: sample.city,
        currentPage: sample.page,
      },
      create: {
        orgId: org.id,
        visitorKey,
        firstSeenAt: now,
        lastSeenAt: now,
        userAgent: sample.userAgent,
        country: sample.country,
        city: sample.city,
        currentPage: sample.page,
      },
    });
  }

  const liveCount = await prisma.visitor.count({
    where: { orgId: org.id, lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
  });
  console.log(`Done. Org now has ${liveCount} live visitor(s) (last 5 min). Refresh portal dashboard to see them.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
