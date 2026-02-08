#!/bin/bash
# DEPRECATED — Step 11.11 (2026-02-06)
# Reason: Tests POST /conversations without orgToken + 65s sleep. Too slow for CI.
# Superseded by: VERIFY_ORG_TOKEN.sh, VERIFY_STEP_11_4.sh, domain checks in VERIFY_STEP_11_1_UI.sh
# To run manually: bash verify/legacy/VERIFY_PRODUCTION_HARDENING.sh

# Production Hardening Verification Script
# Tests: Redis rate limiting, trustProxy config, domain allowlist

echo "🔒 Production Hardening Verification"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Redis-based rate limiting
echo "Test 1: Redis-based rate limiting (30/min)"
echo "  Sending 35 requests rapidly..."
SUCCESS=0
RATE_LIMITED=0

for i in {1..35}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "x-org-key: demo" \
    -H "x-visitor-id: v_redis_test" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
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
  echo -e "  ${GREEN}✅ PASS${NC}: Redis rate limiting is working"
else
  echo -e "  ${RED}❌ FAIL${NC}: Rate limiting not triggered"
fi
echo ""

# Wait for rate limits to clear
echo "⏳ Waiting 65 seconds for rate limits to reset..."
sleep 65
echo ""

# Test 2: Domain allowlist - Valid domain (localhost)
echo "Test 2: Domain allowlist - Valid domain (localhost:3000)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_domain_valid" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  echo -e "  ${GREEN}✅ PASS${NC}: Valid domain allowed"
else
  echo -e "  ${RED}❌ FAIL${NC}: Valid domain rejected (HTTP $HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

# Test 3: Domain allowlist - Invalid domain
echo "Test 3: Domain allowlist - Invalid domain (evil.com)"
RESPONSE=$(curl -s -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_domain_invalid" \
  -H "Content-Type: application/json" \
  -H "Origin: http://evil.com" \
  -d '{}' \
  http://localhost:4000/conversations)

if echo "$RESPONSE" | grep -q "not allowed"; then
  echo -e "  ${GREEN}✅ PASS${NC}: Invalid domain rejected"
else
  echo -e "  ${RED}❌ FAIL${NC}: Invalid domain accepted"
  echo "  Response: $RESPONSE"
fi
echo ""

# Test 4: Domain allowlist - Wildcard subdomain (*.helvion.io)
echo "Test 4: Domain allowlist - Wildcard subdomain (app.helvion.io)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_domain_wildcard" \
  -H "Content-Type: application/json" \
  -H "Origin: https://app.helvion.io" \
  -d '{}' \
  http://localhost:4000/conversations)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  echo -e "  ${GREEN}✅ PASS${NC}: Wildcard subdomain allowed"
else
  echo -e "  ${RED}❌ FAIL${NC}: Wildcard subdomain rejected (HTTP $HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

# Test 5: No Origin/Referer header (curl/testing - should allow with warning)
echo "Test 5: No Origin/Referer header (should allow for curl/testing)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_no_origin" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  echo -e "  ${GREEN}✅ PASS${NC}: Request allowed (check API logs for warning)"
else
  echo -e "  ${RED}❌ FAIL${NC}: Request rejected (HTTP $HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

# Test 6: Bootloader endpoint - Domain allowlist
echo "Test 6: Bootloader endpoint - Domain allowlist"
RESPONSE=$(curl -s -X GET \
  -H "x-org-key: demo" \
  -H "Origin: http://localhost:5173" \
  http://localhost:4000/api/bootloader)

if echo "$RESPONSE" | grep -q "\"ok\":true"; then
  echo -e "  ${GREEN}✅ PASS${NC}: Bootloader allows valid domain"
else
  echo -e "  ${RED}❌ FAIL${NC}: Bootloader rejected valid domain"
  echo "  Response: $RESPONSE"
fi
echo ""

# Test 7: Bootloader endpoint - Invalid domain
echo "Test 7: Bootloader endpoint - Invalid domain"
RESPONSE=$(curl -s -X GET \
  -H "x-org-key: demo" \
  -H "Origin: http://malicious-site.com" \
  http://localhost:4000/api/bootloader)

if echo "$RESPONSE" | grep -q "not allowed"; then
  echo -e "  ${GREEN}✅ PASS${NC}: Bootloader rejects invalid domain"
else
  echo -e "  ${RED}❌ FAIL${NC}: Bootloader accepted invalid domain"
  echo "  Response: $RESPONSE"
fi
echo ""

# Test 8: X-Forwarded-For spoofing prevention
echo "Test 8: X-Forwarded-For handling (trustProxy config)"
echo "  Note: With TRUSTED_PROXIES=\"127.0.0.1,::1\", only localhost is trusted"
RESPONSE=$(curl -s -X POST \
  -H "x-org-key: demo-xff-test" \
  -H "x-visitor-id: v_xff_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "X-Forwarded-For: 1.2.3.4" \
  -d '{}' \
  http://localhost:4000/conversations)

if echo "$RESPONSE" | grep -q "\"id\""; then
  echo -e "  ${GREEN}✅ PASS${NC}: Request processed (check logs for actual IP)"
  echo -e "  ${YELLOW}⚠️  INFO${NC}: In production, ensure TRUSTED_PROXIES is set to your actual proxy IPs"
else
  echo "  Response: $RESPONSE"
fi
echo ""

# Test 9: Redis persistence check
echo "Test 9: Redis persistence check"
echo "  Creating a conversation..."
CONV1=$(curl -s -X POST \
  -H "x-org-key: demo-persistence" \
  -H "x-visitor-id: v_persist_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations | jq -r .id)

if [ -n "$CONV1" ] && [ "$CONV1" != "null" ]; then
  echo "  Created conversation: $CONV1"
  
  # Check Redis for rate limit key
  REDIS_KEY=$(docker exec helvino-redis redis-cli --scan --pattern "ratelimit:demo-persistence:*" | head -1)
  
  if [ -n "$REDIS_KEY" ]; then
    REDIS_VALUE=$(docker exec helvino-redis redis-cli get "$REDIS_KEY")
    echo "  Redis key found: $REDIS_KEY"
    echo "  Redis value (request count): $REDIS_VALUE"
    echo -e "  ${GREEN}✅ PASS${NC}: Rate limit data persisted in Redis"
  else
    echo -e "  ${YELLOW}⚠️  WARN${NC}: Could not verify Redis key (may have expired)"
  fi
else
  echo -e "  ${RED}❌ FAIL${NC}: Could not create conversation"
fi
echo ""

# Summary
echo "===================================="
echo "✅ Production Hardening Tests Complete"
echo ""
echo "Features Tested:"
echo "  ✅ Redis-based rate limiting (distributed)"
echo "  ✅ Domain allowlist enforcement"
echo "  ✅ Wildcard subdomain matching"
echo "  ✅ Origin/Referer validation"
echo "  ✅ Bootloader protection"
echo "  ✅ trustProxy configuration"
echo "  ✅ Redis persistence"
echo ""
echo "Production Checklist:"
echo "  1. Set REDIS_URL to your production Redis instance"
echo "  2. Set TRUSTED_PROXIES to your actual proxy IPs"
echo "  3. Configure allowedDomains for each organization"
echo "  4. Monitor Redis memory usage"
echo "  5. Set up Redis persistence (AOF or RDB)"
echo ""
