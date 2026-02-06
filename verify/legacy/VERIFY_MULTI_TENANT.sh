#!/bin/bash
# DEPRECATED — Step 11.11 (2026-02-06)
# Reason: Tests POST /conversations without orgToken. Uses ❌ in test descriptions unconditionally.
# Superseded by: VERIFY_ORG_TOKEN.sh (orgToken + tenant isolation), VERIFY_STEP_11_4.sh (portal org isolation)
# To run manually: bash verify/legacy/VERIFY_MULTI_TENANT.sh

# Multi-Tenant Verification Script
# This script demonstrates tenant isolation

echo "🔒 Multi-Tenant Isolation Verification"
echo "========================================"
echo ""

# Test 1: Valid orgKey
echo "✅ Test 1: Create conversation with valid orgKey (demo)"
CONV_ID=$(curl -s -X POST -H "x-org-key: demo" http://localhost:4000/conversations | jq -r .id)
echo "   Created conversation: $CONV_ID"
echo ""

# Test 2: Invalid orgKey
echo "❌ Test 2: Try with invalid orgKey"
curl -s -X POST -H "x-org-key: invalid" http://localhost:4000/conversations | jq .
echo ""

# Test 3: Missing orgKey
echo "❌ Test 3: Try without orgKey"
curl -s -X POST http://localhost:4000/conversations | jq .
echo ""

# Test 4: List conversations with valid orgKey
echo "✅ Test 4: List conversations with valid orgKey (demo)"
curl -s -H "x-org-key: demo" http://localhost:4000/conversations | jq .
echo ""

# Test 5: Send message with valid orgKey
echo "✅ Test 5: Send message to conversation with valid orgKey"
curl -s -X POST \
  -H "x-org-key: demo" \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Test message from demo org"}' \
  http://localhost:4000/conversations/$CONV_ID/messages | jq .
echo ""

# Test 6: Try to access with different orgKey
echo "❌ Test 6: Try to access same conversation with invalid orgKey"
curl -s \
  -H "x-org-key: invalid" \
  http://localhost:4000/conversations/$CONV_ID | jq .
echo ""

# Test 7: Verify isolation
echo "✅ Test 7: Verify orgId is present in response"
curl -s -H "x-org-key: demo" http://localhost:4000/conversations | jq '.[0].orgId'
echo ""

echo "========================================"
echo "✅ All tests completed!"
echo ""
echo "Expected results:"
echo "  - Test 1: Returns conversation ID"
echo "  - Test 2: Returns 'Invalid organization key'"
echo "  - Test 3: Returns 'Missing x-org-key header'"
echo "  - Test 4: Returns array with orgId='org_1'"
echo "  - Test 5: Returns message with timestamp"
echo "  - Test 6: Returns 'Invalid organization key' or 'Conversation not found'"
echo "  - Test 7: Returns 'org_1'"
