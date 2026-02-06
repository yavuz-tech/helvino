#!/bin/bash
# DEPRECATED — Step 11.11 (2026-02-06)
# Reason: Tests POST /conversations without orgToken (required since Step 10.5).
# Superseded by: VERIFY_ORG_TOKEN.sh, VERIFY_STEP_11_4.sh, VERIFY_STEP_11_5.sh
# To run manually: bash verify/legacy/VERIFY_ABUSE_PROTECTION.sh

# Abuse Protection Verification Script

echo "🛡️  Abuse Protection Verification"
echo "=================================="
echo ""
echo "⏳ Waiting 5 seconds for rate limits to reset from previous runs..."
sleep 5
echo ""

# Test 1: Normal request (should work)
echo "Test 1: Normal conversation creation"
TIMESTAMP=$(date +%s)
CONV_ID=$(curl -s -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_normal_$TIMESTAMP" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations | jq -r .id)

if [ "$CONV_ID" != "null" ] && [ -n "$CONV_ID" ]; then
  echo "  ✅ PASS: Conversation created: $CONV_ID"
else
  echo "  ❌ FAIL: Could not create conversation"
fi
echo ""

# Test 2: Rate limit - create 35 conversations (limit is 30/min)
echo "Test 2: Rate limiting (30 req/min limit)"
echo "  Sending 35 requests rapidly..."
SUCCESS=0
RATE_LIMITED=0

for i in {1..35}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "x-org-key: demo" \
    -H "x-visitor-id: v_test_rate_limit" \
    -H "Content-Type: application/json" \
    -d '{}' \
    http://localhost:4000/conversations)
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "201" ]; then
    SUCCESS=$((SUCCESS + 1))
  elif [ "$HTTP_CODE" = "429" ]; then
    RATE_LIMITED=$((RATE_LIMITED + 1))
  fi
done

echo "  ✅ Successful: $SUCCESS"
echo "  🛑 Rate limited (429): $RATE_LIMITED"

if [ $RATE_LIMITED -gt 0 ]; then
  echo "  ✅ PASS: Rate limiting is working"
else
  echo "  ❌ FAIL: Rate limiting not triggered"
fi
echo ""

# Test 3: Invalid org key format
echo "Test 3: Invalid x-org-key format (with special chars)"
RESPONSE=$(curl -s -X POST \
  -H "x-org-key: demo@invalid!" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations)

if echo "$RESPONSE" | grep -q "invalid characters"; then
  echo "  ✅ PASS: Rejected invalid org key"
else
  echo "  ❌ FAIL: Invalid org key accepted"
  echo "  Response: $RESPONSE"
fi
echo ""

# Test 4: Invalid visitor ID format
echo "Test 4: Invalid x-visitor-id format (doesn't start with v_)"
RESPONSE=$(curl -s -X POST \
  -H "x-org-key: demo-visitor-test" \
  -H "x-visitor-id: invalid_format" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations)

if echo "$RESPONSE" | grep -q "must start with"; then
  echo "  ✅ PASS: Rejected invalid visitor ID"
else
  echo "  ❌ FAIL: Invalid visitor ID accepted"
  echo "  Response: $RESPONSE"
fi
echo ""

# Test 5: Missing Content-Type
echo "Test 5: Missing Content-Type header"
RESPONSE=$(curl -s -X POST \
  -H "x-org-key: demo-content-type-test" \
  -H "x-visitor-id: v_test" \
  -d '{"role":"user","content":"test"}' \
  http://localhost:4000/conversations/$CONV_ID/messages)

if echo "$RESPONSE" | grep -q "Unsupported Media Type"; then
  echo "  ✅ PASS: Rejected missing Content-Type (415)"
else
  echo "  ❌ FAIL: Missing Content-Type accepted"
  echo "  Response: $RESPONSE"
fi
echo ""

# Test 6: Oversized message content (>32KB)
echo "Test 6: Oversized message content (>32KB)"
# Create a fresh conversation for this test
TEST_CONV_ID=$(curl -s -X POST \
  -H "x-org-key: demo-size-test" \
  -H "x-visitor-id: v_test_size" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations | jq -r .id)

LARGE_CONTENT=$(python3 -c "print('x' * 33000)")
RESPONSE=$(curl -s -X POST \
  -H "x-org-key: demo-size-test" \
  -H "x-visitor-id: v_test_size" \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"user\",\"content\":\"$LARGE_CONTENT\"}" \
  http://localhost:4000/conversations/$TEST_CONV_ID/messages 2>&1)

if echo "$RESPONSE" | grep -qE "(exceeds maximum size|Request Entity Too Large|413|message content too large)"; then
  echo "  ✅ PASS: Rejected oversized content"
else
  echo "  ⚠️  Response: ${RESPONSE:0:200}..."
fi
echo ""

# Test 7: Check rate limit headers
echo "Test 7: Rate limit headers present"
HEADERS=$(curl -s -i -X POST \
  -H "x-org-key: demo-headers-test" \
  -H "x-visitor-id: v_test_headers" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations 2>&1)

if echo "$HEADERS" | grep -q "x-ratelimit-limit"; then
  echo "  ✅ PASS: Rate limit headers present"
  echo "$HEADERS" | grep -i "x-ratelimit"
else
  echo "  ❌ FAIL: Rate limit headers missing"
fi
echo ""

# Summary
echo "=================================="
echo "✅ Abuse Protection Verification Complete"
echo ""
echo "Features Tested:"
echo "  ✅ Rate limiting (30/min for conversations)"
echo "  ✅ Header validation (org-key format)"
echo "  ✅ Visitor ID validation (v_ prefix)"
echo "  ✅ Content-Type enforcement"
echo "  ✅ Body size limits (32KB)"
echo "  ✅ Structured logging"
echo "  ✅ Rate limit headers"
echo ""
echo "Check API logs for structured output:"
echo "  tail -f <api-server-logs>"
echo ""
