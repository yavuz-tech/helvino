import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { generateSiteId } from "../src/utils/site-id";

const prisma = new PrismaClient({});

async function main() {
  console.log("🌱 Seeding database...");

  // Create default organization with allowed domains for local development
  const demoOrg = await prisma.organization.upsert({
    where: { key: "demo" },
    update: {
      allowedDomains: [
        "localhost",
        "127.0.0.1",
        "*.localhost",
        "localhost:3000",
        "localhost:3006",
        "localhost:5173",
        "helvion.io",
        "*.helvion.io",
      ],
      widgetEnabled: true,
      writeEnabled: true,
      aiEnabled: true,
      primaryColor: "#0F5C5C",
      widgetName: "Helvino",
      widgetSubtitle: "Smart AI Chat",
      language: "en",
      messageRetentionDays: 365,
      hardDeleteOnRetention: false,
      planKey: "free",
      planStatus: "active",
      billingStatus: "none",
      billingEnforced: false,
      billingGraceDays: 7,
    },
    create: {
      key: "demo",
      siteId: generateSiteId(), // Generate public site ID for widget embedding
      name: "Demo Org",
      allowedDomains: [
        "localhost",
        "127.0.0.1",
        "*.localhost",
        "localhost:3000",
        "localhost:3006",
        "localhost:5173",
        "helvion.io",
        "*.helvion.io",
      ],
      allowLocalhost: true, // Allow localhost for development
      widgetEnabled: true,
      writeEnabled: true,
      aiEnabled: true,
      primaryColor: "#0F5C5C",
      widgetName: "Helvino",
      widgetSubtitle: "Smart AI Chat",
      language: "en",
      messageRetentionDays: 365,
      hardDeleteOnRetention: false,
      planKey: "free",
      planStatus: "active",
      billingStatus: "none",
      billingEnforced: false,
      billingGraceDays: 7,
    },
  });

  console.log(`✅ Created/verified organization: ${demoOrg.key} (${demoOrg.id})`);
  console.log(`   Site ID: ${demoOrg.siteId}`);
  console.log(`   Allowed domains: ${demoOrg.allowedDomains.join(", ")}`);
  console.log(`   Allow localhost: ${demoOrg.allowLocalhost}`);
  console.log(`   Widget enabled: ${demoOrg.widgetEnabled}`);
  console.log(`   Write enabled: ${demoOrg.writeEnabled}`);
  console.log(`   AI enabled: ${demoOrg.aiEnabled}`);

  // Seed plans (free/pro/business)
  // Stripe Price IDs are read from env vars; null in dev is fine
  const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || null;
  const STRIPE_PRICE_BUSINESS = process.env.STRIPE_PRICE_BUSINESS || null;

  await prisma.plan.upsert({
    where: { key: "free" },
    update: { stripePriceId: null, maxAgents: 3 },
    create: {
      key: "free",
      name: "Free",
      stripePriceId: null,
      monthlyPriceUsd: 0,
      maxConversationsPerMonth: 200,
      maxMessagesPerMonth: 2000,
      maxAgents: 3,
    },
  });

  await prisma.plan.upsert({
    where: { key: "pro" },
    update: { stripePriceId: STRIPE_PRICE_PRO },
    create: {
      key: "pro",
      name: "Pro",
      stripePriceId: STRIPE_PRICE_PRO,
      monthlyPriceUsd: 49,
      maxConversationsPerMonth: 2000,
      maxMessagesPerMonth: 20000,
      maxAgents: 10,
    },
  });

  await prisma.plan.upsert({
    where: { key: "business" },
    update: { stripePriceId: STRIPE_PRICE_BUSINESS },
    create: {
      key: "business",
      name: "Business",
      stripePriceId: STRIPE_PRICE_BUSINESS,
      monthlyPriceUsd: 199,
      maxConversationsPerMonth: 10000,
      maxMessagesPerMonth: 100000,
      maxAgents: 50,
    },
  });

  console.log("✅ Seeded plans: free, pro, business");

  // Create default admin user from environment variables
  const adminEmail = process.env.ADMIN_EMAIL || "admin@helvion.io";
  const adminPassword = process.env.ADMIN_PASSWORD || "helvino_admin_2026";

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.warn("⚠️  ADMIN_EMAIL and/or ADMIN_PASSWORD not set in .env");
    console.warn(`   Using defaults: ${adminEmail} / ${adminPassword}`);
    console.warn("   🔒 CHANGE THESE IN PRODUCTION!");
  }

  const passwordHash = await hashPassword(adminPassword);

  const adminUser = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      // Only update password if explicitly needed (not on every seed)
      // In production, you might want to remove this update logic
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: "owner",
    },
  });

  console.log(`✅ Created/verified admin user: ${adminUser.email} (role: ${adminUser.role})`);

  // Create default org user (customer portal login) from environment variables
  const orgOwnerEmail = process.env.ORG_OWNER_EMAIL || "owner@demo.helvion.io";
  const orgOwnerPassword = process.env.ORG_OWNER_PASSWORD || "demo_owner_2026";

  if (!process.env.ORG_OWNER_EMAIL || !process.env.ORG_OWNER_PASSWORD) {
    console.warn("⚠️  ORG_OWNER_EMAIL and/or ORG_OWNER_PASSWORD not set in .env");
    console.warn(`   Using defaults: ${orgOwnerEmail} / ${orgOwnerPassword}`);
    console.warn("   🔒 CHANGE THESE IN PRODUCTION!");
  }

  const orgOwnerPasswordHash = await hashPassword(orgOwnerPassword);

  const orgOwner = await prisma.orgUser.upsert({
    where: { email: orgOwnerEmail },
    update: {
      // Mark email as verified so demo user can log in without verification flow
      emailVerifiedAt: new Date(),
    },
    create: {
      email: orgOwnerEmail,
      passwordHash: orgOwnerPasswordHash,
      role: "owner",
      orgId: demoOrg.id,
      emailVerifiedAt: new Date(), // Demo user: skip verification, allow login
    },
  });

  console.log(`✅ Created/verified org user: ${orgOwner.email} (role: ${orgOwner.role}, org: ${demoOrg.key})`);
  console.log("🌱 Seeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
