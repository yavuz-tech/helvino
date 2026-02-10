/**
 * Portal Login E2E Test
 * 
 * Run with: node test-portal-login.js
 * Requires: npm install playwright (or use npx playwright install)
 */

const { chromium } = require('playwright');

async function testPortalLogin() {
  console.log('=== PORTAL LOGIN E2E TEST ===\n');
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser window
    slowMo: 500 // Slow down actions for visibility
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  
  const timeline = [];
  const startTime = Date.now();
  
  function logEvent(event) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const entry = `[T+${elapsed}s] ${event}`;
    timeline.push(entry);
    console.log(entry);
  }
  
  try {
    // Step 1: Navigate to login page
    logEvent('Navigating to http://localhost:3000/portal/login');
    await page.goto('http://localhost:3000/portal/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/portal-login-1-initial.png' });
    logEvent(`Current URL: ${page.url()}`);
    
    // Step 2: Fill in credentials
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    logEvent('Filling email field');
    await page.fill('input[type="email"]', 'e2e.owner.1770736097717@helvino.local');
    
    logEvent('Filling password field');
    await page.fill('input[type="password"]', 'TestPass!123456');
    await page.screenshot({ path: '/tmp/portal-login-2-filled.png' });
    
    // Step 3: Submit login form
    logEvent('Clicking Sign In button');
    await page.click('button[type="submit"]');
    
    // Step 4: Wait for navigation and observe URL changes
    logEvent('Waiting for navigation...');
    await page.waitForTimeout(2000);
    logEvent(`Current URL after login: ${page.url()}`);
    await page.screenshot({ path: '/tmp/portal-login-3-after-submit.png' });
    
    // Check for error messages
    const errorBanner = await page.$('[class*="error"], [class*="Error"]');
    if (errorBanner) {
      const errorText = await errorBanner.textContent();
      logEvent(`ERROR VISIBLE: ${errorText}`);
    }
    
    // Step 5: Check if redirected back to login (FAIL scenario)
    if (page.url().includes('/portal/login')) {
      logEvent('⚠️  REDIRECTED BACK TO LOGIN - Checking for error messages');
      const pageText = await page.textContent('body');
      if (pageText.includes('Too many attempts') || pageText.includes('rate limit')) {
        logEvent('Rate limit error detected');
      }
      await page.screenshot({ path: '/tmp/portal-login-4-back-to-login.png' });
    }
    
    // Step 6: Check for security onboarding modal
    await page.waitForTimeout(1000);
    const skipButton = await page.$('button:has-text("Skip For Now"), button:has-text("Şimdilik Atla")');
    
    if (skipButton) {
      logEvent('Security onboarding modal detected');
      await page.screenshot({ path: '/tmp/portal-login-5-onboarding-modal.png' });
      
      // Test 1: Skip with checkbox UNCHECKED
      logEvent('TEST 1: Clicking Skip For Now (checkbox UNCHECKED)');
      const checkbox = await page.$('input[type="checkbox"]');
      if (checkbox) {
        const isChecked = await checkbox.isChecked();
        if (isChecked) {
          await checkbox.click(); // Uncheck if checked
          logEvent('Unchecked the checkbox');
        }
      }
      
      await skipButton.click();
      await page.waitForTimeout(2000);
      logEvent(`URL after skip (unchecked): ${page.url()}`);
      await page.screenshot({ path: '/tmp/portal-login-6-after-skip-unchecked.png' });
      
      // Check if still at /portal
      if (page.url().includes('/portal') && !page.url().includes('/portal/login')) {
        logEvent('✓ Stayed at /portal after skip');
      }
      
      // If modal still visible or we need to test checked version, go back to onboarding
      const skipButton2 = await page.$('button:has-text("Skip For Now"), button:has-text("Şimdilik Atla")');
      if (!skipButton2) {
        logEvent('Modal closed, attempting to trigger it again (if possible)');
        // For this test, we'd need to logout and login again or navigate to onboarding page
      }
    } else {
      logEvent('No security onboarding modal found');
    }
    
    // Step 7: Wait 10 seconds and verify session persists
    logEvent('Waiting 10 seconds to verify session persistence...');
    await page.waitForTimeout(10000);
    logEvent(`Current URL after 10s: ${page.url()}`);
    
    if (page.url().includes('/portal/login')) {
      logEvent('❌ FAIL: Redirected back to login (session expired)');
    } else if (page.url().includes('/portal')) {
      logEvent('✅ PASS: Still at /portal (session persists)');
    }
    
    await page.screenshot({ path: '/tmp/portal-login-7-final.png' });
    
    // Step 8: Verify user is logged in by checking for logout button or user menu
    const userMenu = await page.$('[class*="user"], [class*="profile"], button:has-text("Logout"), button:has-text("Çıkış")');
    if (userMenu) {
      logEvent('✓ User menu/logout button found - user is logged in');
    }
    
    console.log('\n=== TIMELINE ===');
    timeline.forEach(entry => console.log(entry));
    
    console.log('\n=== FINAL RESULT ===');
    console.log(`Final URL: ${page.url()}`);
    console.log(`Session persists: ${!page.url().includes('/portal/login')}`);
    console.log(`Screenshots saved to /tmp/portal-login-*.png`);
    
    // Keep browser open for 5 more seconds for manual inspection
    console.log('\nKeeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    logEvent(`ERROR: ${error.message}`);
    await page.screenshot({ path: '/tmp/portal-login-error.png' });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
testPortalLogin().catch(console.error);
