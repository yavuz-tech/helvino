#!/usr/bin/env node

/**
 * Database Smoke Test
 * Verifies that Prisma + Postgres integration works correctly
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧪 Starting database smoke test...\n");

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Check demo org exists
    console.log("Test 1: Verify demo organization exists");
    const demoOrg = await prisma.organization.findUnique({
      where: { key: "demo" },
    });

    if (!demoOrg) {
      console.log("  ❌ FAIL: Demo organization not found");
      failed++;
    } else {
      console.log(`  ✅ PASS: Found demo org (${demoOrg.id})`);
      passed++;
    }

    // Test 2: Create conversation
    console.log("\nTest 2: Create conversation");
    const now = new Date().toISOString();
    const testConvId = `test-conv-${Date.now()}`;
    
    const conversation = await prisma.conversation.create({
      data: {
        id: testConvId,
        orgId: demoOrg.id,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      },
    });

    if (!conversation) {
      console.log("  ❌ FAIL: Could not create conversation");
      failed++;
    } else {
      console.log(`  ✅ PASS: Created conversation (${conversation.id})`);
      passed++;
    }

    // Test 3: Add message
    console.log("\nTest 3: Add message to conversation");
    const testMsgId = `test-msg-${Date.now()}`;
    
    const message = await prisma.message.create({
      data: {
        id: testMsgId,
        conversationId: testConvId,
        orgId: demoOrg.id,
        role: "user",
        content: "Test message from smoke test",
        timestamp: now,
      },
    });

    if (!message) {
      console.log("  ❌ FAIL: Could not create message");
      failed++;
    } else {
      console.log(`  ✅ PASS: Created message (${message.id})`);
      passed++;
    }

    // Test 4: Update conversation messageCount
    console.log("\nTest 4: Update conversation messageCount");
    await prisma.conversation.update({
      where: { id: testConvId },
      data: {
        messageCount: { increment: 1 },
        updatedAt: new Date().toISOString(),
      },
    });

    const updatedConv = await prisma.conversation.findUnique({
      where: { id: testConvId },
    });

    if (updatedConv?.messageCount !== 1) {
      console.log(`  ❌ FAIL: messageCount is ${updatedConv?.messageCount}, expected 1`);
      failed++;
    } else {
      console.log("  ✅ PASS: messageCount incremented correctly");
      passed++;
    }

    // Test 5: Read conversation with messages
    console.log("\nTest 5: Read conversation with messages");
    const convWithMessages = await prisma.conversation.findFirst({
      where: {
        id: testConvId,
        orgId: demoOrg.id,
      },
      include: {
        messages: true,
      },
    });

    if (!convWithMessages || convWithMessages.messages.length !== 1) {
      console.log("  ❌ FAIL: Could not read conversation with messages");
      failed++;
    } else {
      console.log(`  ✅ PASS: Read conversation with ${convWithMessages.messages.length} message(s)`);
      passed++;
    }

    // Test 6: Org isolation - verify filtering
    console.log("\nTest 6: Verify org isolation (list only demo org conversations)");
    const demoConversations = await prisma.conversation.findMany({
      where: { orgId: demoOrg.id },
    });

    const hasTestConv = demoConversations.some((c) => c.id === testConvId);
    if (!hasTestConv) {
      console.log("  ❌ FAIL: Test conversation not found in org's conversations");
      failed++;
    } else {
      console.log(`  ✅ PASS: Found test conversation in org list (${demoConversations.length} total)`);
      passed++;
    }

    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await prisma.message.deleteMany({
      where: { conversationId: testConvId },
    });
    await prisma.conversation.delete({
      where: { id: testConvId },
    });
    console.log("  ✅ Cleanup complete");

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log("=".repeat(50));

    if (failed === 0) {
      console.log("\n🎉 All tests passed! Database is working correctly.\n");
      process.exit(0);
    } else {
      console.log("\n❌ Some tests failed. Check the output above.\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 Smoke test crashed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
