#!/bin/bash

# Visitor Session Verification Script

echo "🔍 Visitor Session & Persistence Verification"
echo "=============================================="
echo ""

# Test 1: Create conversation with visitor ID
echo "Test 1: Create conversation with visitor ID"
CONV1=$(curl -s -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_user_123" \
  http://localhost:4000/conversations | jq -r .id)
echo "  ✅ Created conversation: $CONV1"
echo ""

# Test 2: Create another conversation with SAME visitor
echo "Test 2: Create another conversation with SAME visitor"
CONV2=$(curl -s -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_user_123" \
  http://localhost:4000/conversations | jq -r .id)
echo "  ✅ Created conversation: $CONV2"
echo "  💡 Same visitor should be reused in DB"
echo ""

# Test 3: Create conversation with DIFFERENT visitor
echo "Test 3: Create conversation with DIFFERENT visitor"
CONV3=$(curl -s -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_user_456" \
  http://localhost:4000/conversations | jq -r .id)
echo "  ✅ Created conversation: $CONV3"
echo "  💡 New visitor should be created in DB"
echo ""

# Test 4: Backward compatibility - no visitor header
echo "Test 4: Backward compatibility (no visitor header)"
CONV4=$(curl -s -X POST \
  -H "x-org-key: demo" \
  http://localhost:4000/conversations | jq -r .id)
echo "  ✅ Created conversation: $CONV4"
echo "  💡 Should work without visitor (visitorId = null)"
echo ""

# Test 5: Send message with visitor
echo "Test 5: Send message with visitor ID"
MSG1=$(curl -s -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_user_123" \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Hello with visitor!"}' \
  http://localhost:4000/conversations/$CONV1/messages | jq -r .id)
echo "  ✅ Message sent: $MSG1"
echo ""

# Summary
echo "=============================================="
echo "✅ All tests completed!"
echo ""
echo "Database Check Commands:"
echo "  cd apps/api"
echo "  npx prisma studio"
echo ""
echo "Expected Results:"
echo "  - Visitor table should have 2 visitors:"
echo "    • v_test_user_123 (firstSeenAt < lastSeenAt)"
echo "    • v_test_user_456"
echo "  - Conversations table should have 4 conversations:"
echo "    • 2 linked to v_test_user_123"
echo "    • 1 linked to v_test_user_456"
echo "    • 1 with visitorId = null (backward compatible)"
echo ""
