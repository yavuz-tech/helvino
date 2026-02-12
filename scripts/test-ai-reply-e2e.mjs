#!/usr/bin/env node
/**
 * End-to-end test: Widget message → AI reply in Portal Inbox
 * 
 * Flow:
 * 1. Open /demo-chat page
 * 2. Send visitor message via widget
 * 3. Open /portal/inbox
 * 4. Find conversation with visitor message
 * 5. Verify AI assistant reply appears
 * 6. Capture screenshots as proof
 */

import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
import { join } from 'path';

const TIMEOUT = 60000; // 60s for AI to respond
const TEST_MESSAGE = "AI debug live test message";

async function main() {
  console.log('🚀 Starting AI reply E2E test...\n');
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser for debugging
    slowMo: 300 // Slow down for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  page.setDefaultTimeout(30000); // 30s default timeout
  
  // Capture console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || text.includes('Helvion') || text.includes('widget') || text.includes('Visitor')) {
      console.log(`   [Browser ${type}]:`, text);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log('   [Page Error]:', error.message);
  });
  
  // Capture network failures
  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (status >= 400) {
      console.log(`   [Network ${status}]:`, url);
    }
  });
  
  try {
    // Step 1: Open demo-chat page
    console.log('📄 Step 1: Opening /demo-chat page...');
    await page.goto('http://localhost:3000/demo-chat', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    console.log('   Page loaded, waiting for widget script...');
    await page.waitForTimeout(5000); // Wait longer for widget to load
    
    await page.screenshot({ 
      path: 'test-results/ai-e2e-01-demo-chat-loaded.png',
      fullPage: true 
    });
    console.log('✅ Demo chat page loaded\n');
    
    // Step 2: Open widget and send message
    console.log('💬 Step 2: Opening widget and sending message...');
    
    // Wait for widget bubble to appear
    const widgetBubble = page.locator('.widget-launcher-button').first();
    await widgetBubble.waitFor({ state: 'visible', timeout: 15000 });
    console.log('   Widget bubble found');
    
    // Click to open widget
    await widgetBubble.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'test-results/ai-e2e-02-widget-opened.png',
      fullPage: true 
    });
    console.log('   Widget opened');
    
    // Find message input and send message
    const messageInput = page.locator('input[type="text"][placeholder*="message"], input[type="text"]').first();
    await messageInput.waitFor({ state: 'visible', timeout: 10000 });
    await messageInput.fill(TEST_MESSAGE);
    console.log(`   Message typed: "${TEST_MESSAGE}"`);
    
    await page.waitForTimeout(500);
    
    // Find and click send button (looks for button with "Send" text)
    const sendButton = page.locator('button:has-text("Send"), button:has-text("Gönder"), button:has-text("Enviar")').first();
    await sendButton.click();
    console.log('   Message sent');
    
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'test-results/ai-e2e-03-message-sent.png',
      fullPage: true 
    });
    console.log('✅ Visitor message sent via widget\n');
    
    // Step 3: Navigate to portal inbox
    console.log('📥 Step 3: Opening /portal/inbox...');
    await page.goto('http://localhost:3000/portal/inbox', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'test-results/ai-e2e-04-inbox-loaded.png',
      fullPage: true 
    });
    console.log('✅ Portal inbox loaded\n');
    
    // Step 4: Find conversation with our test message
    console.log('🔍 Step 4: Finding conversation with test message...');
    
    // Look for conversation list items
    const conversations = page.locator('[data-conversation-item], .conversation-item, [role="listitem"]');
    const conversationCount = await conversations.count();
    console.log(`   Found ${conversationCount} conversations`);
    
    // Click the first conversation (most recent)
    if (conversationCount > 0) {
      await conversations.first().click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'test-results/ai-e2e-05-conversation-opened.png',
        fullPage: true 
      });
      console.log('   Conversation opened');
    } else {
      console.log('⚠️  No conversations found in inbox');
    }
    
    // Step 5: Wait for and verify AI response
    console.log('🤖 Step 5: Waiting for AI response...');
    console.log(`   Timeout: ${TIMEOUT / 1000}s`);
    
    // Look for message timeline/thread
    const messageTimeline = page.locator('[data-message-timeline], .message-thread, .conversation-messages').first();
    
    let aiResponseFound = false;
    let visitorMessageFound = false;
    let attempts = 0;
    const maxAttempts = TIMEOUT / 2000; // Check every 2s
    
    while (attempts < maxAttempts && !aiResponseFound) {
      attempts++;
      
      // Check for visitor message
      const visitorMsg = page.locator(`text="${TEST_MESSAGE}"`).first();
      if (await visitorMsg.isVisible().catch(() => false)) {
        visitorMessageFound = true;
        console.log(`   ✓ Visitor message found (attempt ${attempts})`);
      }
      
      // Check for AI/assistant response (look for role indicators)
      const assistantMessages = page.locator('[data-role="assistant"], [data-sender="assistant"], .assistant-message, .ai-message');
      const assistantCount = await assistantMessages.count();
      
      if (assistantCount > 0) {
        aiResponseFound = true;
        console.log(`   ✓ AI response found! (${assistantCount} assistant messages)`);
        break;
      }
      
      console.log(`   Waiting... (attempt ${attempts}/${maxAttempts})`);
      await page.waitForTimeout(2000);
      
      // Refresh view to get latest messages
      await page.reload({ 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      await page.waitForTimeout(1000);
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: 'test-results/ai-e2e-06-final-state.png',
      fullPage: true 
    });
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      testMessage: TEST_MESSAGE,
      visitorMessageFound,
      aiResponseFound,
      attempts,
      maxAttempts,
      success: visitorMessageFound && aiResponseFound,
      screenshots: [
        'test-results/ai-e2e-01-demo-chat-loaded.png',
        'test-results/ai-e2e-02-widget-opened.png',
        'test-results/ai-e2e-03-message-sent.png',
        'test-results/ai-e2e-04-inbox-loaded.png',
        'test-results/ai-e2e-05-conversation-opened.png',
        'test-results/ai-e2e-06-final-state.png'
      ]
    };
    
    writeFileSync(
      'test-results/ai-e2e-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`✓ Visitor message found: ${visitorMessageFound ? 'YES' : 'NO'}`);
    console.log(`✓ AI response found: ${aiResponseFound ? 'YES' : 'NO'}`);
    console.log(`✓ Overall success: ${report.success ? 'YES ✅' : 'NO ❌'}`);
    console.log(`✓ Screenshots saved: ${report.screenshots.length}`);
    console.log('='.repeat(60) + '\n');
    
    if (!report.success) {
      console.log('❌ Test failed. Check screenshots for details.');
      if (!visitorMessageFound) {
        console.log('   - Visitor message not found in conversation');
      }
      if (!aiResponseFound) {
        console.log('   - AI response not detected within timeout');
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    
    await page.screenshot({ 
      path: 'test-results/ai-e2e-error.png',
      fullPage: true 
    });
    
    writeFileSync(
      'test-results/ai-e2e-error.txt',
      `Error: ${error.message}\n\nStack:\n${error.stack}`
    );
  } finally {
    await browser.close();
    console.log('🏁 Test complete. Browser closed.\n');
  }
}

main().catch(console.error);
