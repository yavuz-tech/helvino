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
      widgetName: "Helvion",
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
      widgetName: "Helvion",
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

  // Seed plans (free/starter/pro/business) — key-based upsert
  const plans = [
    {
      key: "free",
      name: "Free",
      stripePriceMonthlyUsd: null,
      stripePriceYearlyUsd: null,
      stripePriceMonthlyTry: null,
      stripePriceYearlyTry: null,
      monthlyPriceUsd: 0,
      yearlyPriceUsd: 0,
      monthlyPriceTry: 0,
      yearlyPriceTry: 0,
      // Team rule: total 3 users (1 owner + 2 members)
      // maxAgents counts "additional members besides the owner".
      maxAgents: 2,
      // Product rule: Free plan manual chat is unlimited
      maxConversationsPerMonth: -1,
      maxMessagesPerMonth: -1,
      maxAiMessagesPerMonth: 200,
      sortOrder: 0,
    },
    {
      key: "starter",
      name: "Starter",
      stripePriceMonthlyUsd: process.env.STRIPE_PRICE_STARTER_MONTHLY_USD || null,
      stripePriceYearlyUsd: process.env.STRIPE_PRICE_STARTER_YEARLY_USD || null,
      stripePriceMonthlyTry: process.env.STRIPE_PRICE_STARTER_MONTHLY_TRY || null,
      stripePriceYearlyTry: process.env.STRIPE_PRICE_STARTER_YEARLY_TRY || null,
      monthlyPriceUsd: 1500,
      yearlyPriceUsd: 1200,
      monthlyPriceTry: 27900,
      yearlyPriceTry: 21900,
      maxAgents: 5,
      // Product rule: manual chat is unlimited on ALL plans
      maxConversationsPerMonth: -1,
      maxMessagesPerMonth: -1,
      maxAiMessagesPerMonth: 500,
      sortOrder: 1,
    },
    {
      key: "pro",
      name: "Pro",
      stripePriceMonthlyUsd: process.env.STRIPE_PRICE_PRO_MONTHLY_USD || null,
      stripePriceYearlyUsd: process.env.STRIPE_PRICE_PRO_YEARLY_USD || null,
      stripePriceMonthlyTry: process.env.STRIPE_PRICE_PRO_MONTHLY_TRY || null,
      stripePriceYearlyTry: process.env.STRIPE_PRICE_PRO_YEARLY_TRY || null,
      monthlyPriceUsd: 3900,
      yearlyPriceUsd: 2900,
      monthlyPriceTry: 69900,
      yearlyPriceTry: 52900,
      maxAgents: 15,
      // Product rule: manual chat is unlimited on ALL plans
      maxConversationsPerMonth: -1,
      maxMessagesPerMonth: -1,
      maxAiMessagesPerMonth: 2000,
      sortOrder: 2,
    },
    {
      key: "business",
      name: "Business",
      stripePriceMonthlyUsd: process.env.STRIPE_PRICE_BUSINESS_MONTHLY_USD || null,
      stripePriceYearlyUsd: process.env.STRIPE_PRICE_BUSINESS_YEARLY_USD || null,
      stripePriceMonthlyTry: process.env.STRIPE_PRICE_BUSINESS_MONTHLY_TRY || null,
      stripePriceYearlyTry: process.env.STRIPE_PRICE_BUSINESS_YEARLY_TRY || null,
      monthlyPriceUsd: 11900,
      yearlyPriceUsd: 8900,
      monthlyPriceTry: 214900,
      yearlyPriceTry: 159900,
      maxAgents: 50,
      maxConversationsPerMonth: -1,
      maxMessagesPerMonth: -1,
      maxAiMessagesPerMonth: -1,
      sortOrder: 3,
    },
  ] as const;

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        stripePriceMonthlyUsd: plan.stripePriceMonthlyUsd,
        stripePriceYearlyUsd: plan.stripePriceYearlyUsd,
        stripePriceMonthlyTry: plan.stripePriceMonthlyTry,
        stripePriceYearlyTry: plan.stripePriceYearlyTry,
        monthlyPriceUsd: plan.monthlyPriceUsd,
        yearlyPriceUsd: plan.yearlyPriceUsd,
        monthlyPriceTry: plan.monthlyPriceTry,
        yearlyPriceTry: plan.yearlyPriceTry,
        maxAgents: plan.maxAgents,
        maxConversationsPerMonth: plan.maxConversationsPerMonth,
        maxMessagesPerMonth: plan.maxMessagesPerMonth,
        maxAiMessagesPerMonth: plan.maxAiMessagesPerMonth,
        sortOrder: plan.sortOrder,
      },
      create: { ...plan },
    });
  }

  console.log("✅ Seeded plans: free, starter, pro, business");

  // Create default admin user from environment variables
  const adminEmail = process.env.ADMIN_EMAIL || "admin@helvion.io";
  const adminPassword = process.env.ADMIN_PASSWORD || "helvion_admin_2026";

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
