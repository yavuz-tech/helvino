#!/usr/bin/env node
/**
 * Direct API test for AI reply functionality
 * 
 * Flow:
 * 1. Get bootloader config for demo org
 * 2. Create a new conversation
 * 3. Send a visitor message
 * 4. Wait for AI response
 * 5. Verify AI message appears in conversation
 */

const API_URL = 'http://localhost:4000';
const ORG_KEY = 'demo';
const TEST_MESSAGE = 'AI debug live test message';
const TIMEOUT = 60000; // 60 seconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Direct API AI Reply Test\n');
  
  try {
    // Step 1: Load bootloader
    console.log('📄 Step 1: Loading bootloader config...');
    const bootloaderRes = await fetch(`${API_URL}/api/bootloader`, {
      headers: {
        'x-org-key': ORG_KEY
      }
    });
    
    if (!bootloaderRes.ok) {
      throw new Error(`Bootloader failed: ${bootloaderRes.status} ${await bootloaderRes.text()}`);
    }
    
    const bootloader = await bootloaderRes.json();
    console.log(`✅ Bootloader loaded for org: ${bootloader.org.name}`);
    console.log(`   AI Enabled: ${bootloader.config.aiEnabled}`);
    console.log(`   Org Token: ${bootloader.orgToken.substring(0, 20)}...`);
    
    if (!bootloader.config.aiEnabled) {
      console.log('⚠️  AI is disabled for this org');
    }
    
    const orgToken = bootloader.orgToken;
    
    // Step 2: Create conversation
    console.log('\n💬 Step 2: Creating conversation...');
    const visitorId = `v_test_${Date.now()}`;
    const createConvRes = await fetch(`${API_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-key': ORG_KEY,
        'x-org-token': orgToken,
        'x-visitor-id': visitorId
      }
    });
    
    if (!createConvRes.ok) {
      throw new Error(`Create conversation failed: ${createConvRes.status} ${await createConvRes.text()}`);
    }
    
    const conversation = await createConvRes.json();
    console.log(`✅ Conversation created: ${conversation.id}`);
    
    const conversationId = conversation.id;
    
    // Step 3: Send visitor message
    console.log('\n📝 Step 3: Sending visitor message...');
    const sendMsgRes = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-key': ORG_KEY,
        'x-org-token': orgToken,
        'x-visitor-id': visitorId
      },
      body: JSON.stringify({
        role: 'user',
        content: TEST_MESSAGE
      })
    });
    
    if (!sendMsgRes.ok) {
      throw new Error(`Send message failed: ${sendMsgRes.status} ${await sendMsgRes.text()}`);
    }
    
    const message = await sendMsgRes.json();
    console.log(`✅ Message sent: "${TEST_MESSAGE}"`);
    console.log(`   Message ID: ${message.id}`);
    
    // Step 4: Wait for AI response
    console.log('\n🤖 Step 4: Waiting for AI response...');
    console.log(`   Timeout: ${TIMEOUT / 1000}s`);
    console.log('   Checking every 2 seconds...\n');
    
    let aiResponseFound = false;
    let aiMessage = null;
    let attempts = 0;
    const maxAttempts = TIMEOUT / 2000;
    
    while (attempts < maxAttempts && !aiResponseFound) {
      attempts++;
      
      // Fetch conversation messages
      const messagesRes = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
        headers: {
          'x-org-key': ORG_KEY,
          'x-org-token': orgToken,
          'x-visitor-id': visitorId
        }
      });
      
      if (messagesRes.ok) {
        const messages = await messagesRes.json();
        
        // Look for assistant message
        const assistantMsg = messages.find(m => m.role === 'assistant');
        
        if (assistantMsg) {
          aiResponseFound = true;
          aiMessage = assistantMsg;
          console.log(`   ✅ AI response found after ${attempts * 2}s!`);
          break;
        }
        
        process.stdout.write(`   Attempt ${attempts}/${maxAttempts}: ${messages.length} messages (no AI yet)...\r`);
      } else {
        console.log(`   ⚠️  Failed to fetch messages: ${messagesRes.status}`);
      }
      
      await sleep(2000);
    }
    
    console.log('\n');
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      testMessage: TEST_MESSAGE,
      conversationId,
      orgKey: ORG_KEY,
      aiEnabled: bootloader.config.aiEnabled,
      visitorMessageSent: true,
      aiResponseFound,
      attempts,
      maxAttempts,
      success: aiResponseFound,
      aiMessage: aiMessage ? {
        id: aiMessage.id,
        content: aiMessage.content.substring(0, 200) + (aiMessage.content.length > 200 ? '...' : ''),
        createdAt: aiMessage.createdAt
      } : null
    };
    
    console.log('='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`✓ Conversation ID: ${conversationId}`);
    console.log(`✓ Visitor message sent: YES`);
    console.log(`✓ AI response found: ${aiResponseFound ? 'YES ✅' : 'NO ❌'}`);
    
    if (aiMessage) {
      console.log(`✓ AI message preview: "${aiMessage.content.substring(0, 100)}..."`);
    }
    
    console.log(`✓ Overall success: ${report.success ? 'YES ✅' : 'NO ❌'}`);
    console.log('='.repeat(60) + '\n');
    
    // Save report
    const fs = await import('fs');
    fs.writeFileSync(
      'test-results/ai-api-direct-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('Report saved: test-results/ai-api-direct-report.json\n');
    
    if (!report.success) {
      console.log('❌ Test failed: AI response not detected within timeout');
      console.log('   Possible reasons:');
      console.log('   - AI is disabled for the org');
      console.log('   - AI service is not configured');
      console.log('   - No AI provider API keys set');
      console.log('   - AI processing is taking longer than expected\n');
    }
    
    return report.success ? 0 : 1;
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error(error.stack);
    return 1;
  }
}

main()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
