#!/usr/bin/env node
/**
 * Manual AI reply test - opens browser and waits for manual interaction
 * 
 * Steps:
 * 1. Opens /demo-chat in browser
 * 2. Waits for you to manually send a message via widget
 * 3. Opens /portal/inbox
 * 4. Waits for you to verify AI response
 * 5. Takes screenshots at each step
 */

import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

async function main() {
  console.log('🚀 Manual AI Reply Test\n');
  console.log('This will open a browser for manual testing.');
  console.log('Follow the prompts in the console.\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Step 1: Open demo-chat
    console.log('📄 Step 1: Opening /demo-chat...');
    await page.goto('http://localhost:3000/demo-chat', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'test-results/manual-01-demo-chat.png',
      fullPage: true 
    });
    
    console.log('✅ Demo chat page loaded');
    console.log('\n📝 ACTION REQUIRED:');
    console.log('   1. Click the chat widget bubble (bottom right)');
    console.log('   2. Type message: "AI debug live test message"');
    console.log('   3. Click Send');
    console.log('   4. Press ENTER in this terminal when done\n');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    await page.screenshot({ 
      path: 'test-results/manual-02-message-sent.png',
      fullPage: true 
    });
    
    console.log('✅ Message sent (screenshot captured)\n');
    
    // Step 2: Open portal inbox
    console.log('📥 Step 2: Opening /portal/inbox...');
    await page.goto('http://localhost:3000/portal/inbox', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'test-results/manual-03-inbox-loaded.png',
      fullPage: true 
    });
    
    console.log('✅ Inbox loaded');
    console.log('\n📝 ACTION REQUIRED:');
    console.log('   1. Find the conversation with your test message');
    console.log('   2. Click to open it');
    console.log('   3. Wait for AI response (up to 60 seconds)');
    console.log('   4. Press ENTER when AI response appears\n');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    await page.screenshot({ 
      path: 'test-results/manual-04-ai-response.png',
      fullPage: true 
    });
    
    console.log('✅ AI response captured\n');
    
    // Final screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'test-results/manual-05-final.png',
      fullPage: true 
    });
    
    const report = {
      timestamp: new Date().toISOString(),
      testType: 'manual',
      screenshots: [
        'test-results/manual-01-demo-chat.png',
        'test-results/manual-02-message-sent.png',
        'test-results/manual-03-inbox-loaded.png',
        'test-results/manual-04-ai-response.png',
        'test-results/manual-05-final.png'
      ]
    };
    
    writeFileSync(
      'test-results/manual-ai-test-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('Screenshots saved:');
    report.screenshots.forEach(s => console.log(`  - ${s}`));
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    await page.screenshot({ 
      path: 'test-results/manual-error.png',
      fullPage: true 
    });
  } finally {
    console.log('Press ENTER to close browser and exit...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    await browser.close();
    console.log('🏁 Browser closed.\n');
  }
}

main().catch(console.error);
