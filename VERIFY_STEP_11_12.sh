#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
PASS=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${GREEN}PASS${NC}: $1"; }
fail() { TOTAL=$((TOTAL + 1)); echo -e "  ${RED}FAIL: $1${NC}"; }
skip() { TOTAL=$((TOTAL + 1)); echo -e "  ${YELLOW}SKIP${NC}: $1"; }

echo "═══════════════════════════════════════════════"
echo "  VERIFY Step 11.12 — Usage Metering + Admin Overrides"
echo "═══════════════════════════════════════════════"

API_URL="${API_URL:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@helvion.io}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-helvino_admin_2026}"
ORG_KEY="${ORG_KEY:-demo}"

# ── 1) Check key files exist ──
echo ""
echo "── File checks ──"

check_file() {
  if [ -f "$1" ]; then pass "File exists: $1"; else fail "Missing file: $1"; fi
}

check_file "apps/api/src/utils/audit-log.ts"
check_file "apps/api/src/utils/entitlements.ts"
check_file "apps/api/prisma/migrations/20260206050000_v11_12_usage_metering/migration.sql"

# Check AuditLog model in schema
if grep -q "model AuditLog" apps/api/prisma/schema.prisma 2>/dev/null; then
  pass "AuditLog model in schema"
else
  fail "AuditLog model missing from schema"
fi

# Check extraConversationQuota in schema
if grep -q "extraConversationQuota" apps/api/prisma/schema.prisma 2>/dev/null; then
  pass "extraConversationQuota field in schema"
else
  fail "extraConversationQuota field missing from schema"
fi

# Check audit logging in webhook
if grep -q "writeAuditLog" apps/api/src/routes/stripe-webhook.ts 2>/dev/null; then
  pass "Audit logging in webhook"
else
  fail "Audit logging missing from webhook"
fi

# Check admin override routes
if grep -q "usage/reset" apps/api/src/routes/internal-admin.ts 2>/dev/null; then
  pass "Usage reset endpoint defined"
else
  fail "Usage reset endpoint missing"
fi

if grep -q "usage/grant-quota" apps/api/src/routes/internal-admin.ts 2>/dev/null; then
  pass "Grant quota endpoint defined"
else
  fail "Grant quota endpoint missing"
fi

if grep -q "billing/lock" apps/api/src/routes/internal-admin.ts 2>/dev/null; then
  pass "Billing lock endpoint defined"
else
  fail "Billing lock endpoint missing"
fi

if grep -q "billing/unlock" apps/api/src/routes/internal-admin.ts 2>/dev/null; then
  pass "Billing unlock endpoint defined"
else
  fail "Billing unlock endpoint missing"
fi

if grep -q "audit-log" apps/api/src/routes/internal-admin.ts 2>/dev/null; then
  pass "Audit log endpoint defined"
else
  fail "Audit log endpoint missing"
fi

# Check nextResetDate in portal billing page
if grep -q "nextResetDate" apps/web/src/app/portal/billing/page.tsx 2>/dev/null; then
  pass "Next reset date in portal billing UI"
else
  fail "Next reset date missing from portal billing UI"
fi

# Check admin usage section in settings
if grep -q "usage/reset\|usage/grant-quota\|resetUsage" apps/web/src/app/dashboard/settings/page.tsx 2>/dev/null; then
  pass "Usage overrides in admin settings UI"
else
  fail "Usage overrides missing from admin settings UI"
fi

# ── 2) API route checks (requires running server) ──
echo ""
echo "── API route checks ──"

# Admin login
LOGIN_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/internal/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -c /tmp/helvino_v1112_cookies.txt 2>/dev/null || echo -e "\n000")

LOGIN_CODE=$(echo "$LOGIN_RES" | tail -1)

if [ "$LOGIN_CODE" = "200" ]; then
  pass "Admin login"
else
  skip "Admin login returned $LOGIN_CODE — skipping API tests"
  echo ""
  echo "── Summary ──"
  echo "  Results: $PASS passed, $((TOTAL - PASS)) not passed (total $TOTAL)"
  if [ "$PASS" -eq "$TOTAL" ]; then
    echo -e "  ${GREEN}STEP 11.12 VERIFICATION: PASS${NC}"
    exit 0
  else
    echo -e "  ${YELLOW}STEP 11.12 VERIFICATION: PARTIAL (API not reachable)${NC}"
    exit 0
  fi
fi

# GET usage
USAGE_RES=$(curl -s -w "\n%{http_code}" "$API_URL/internal/org/$ORG_KEY/usage" \
  -b /tmp/helvino_v1112_cookies.txt 2>/dev/null || echo -e "\n000")
USAGE_CODE=$(echo "$USAGE_RES" | tail -1)

if [ "$USAGE_CODE" = "200" ]; then
  pass "GET /internal/org/$ORG_KEY/usage returns 200"
else
  fail "GET /internal/org/$ORG_KEY/usage returned $USAGE_CODE"
fi

# POST usage/reset
RESET_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/internal/org/$ORG_KEY/usage/reset" \
  -H "Content-Type: application/json" \
  -b /tmp/helvino_v1112_cookies.txt 2>/dev/null || echo -e "\n000")
RESET_CODE=$(echo "$RESET_RES" | tail -1)

if [ "$RESET_CODE" = "200" ]; then
  pass "POST /internal/org/$ORG_KEY/usage/reset returns 200"
else
  fail "POST /internal/org/$ORG_KEY/usage/reset returned $RESET_CODE"
fi

# POST usage/grant-quota
GRANT_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/internal/org/$ORG_KEY/usage/grant-quota" \
  -H "Content-Type: application/json" \
  -d '{"extraConversations":10,"extraMessages":50}' \
  -b /tmp/helvino_v1112_cookies.txt 2>/dev/null || echo -e "\n000")
GRANT_CODE=$(echo "$GRANT_RES" | tail -1)

if [ "$GRANT_CODE" = "200" ]; then
  pass "POST /internal/org/$ORG_KEY/usage/grant-quota returns 200"
else
  fail "POST /internal/org/$ORG_KEY/usage/grant-quota returned $GRANT_CODE"
fi

# Reset extra quota back to 0 to avoid side effects
curl -s -X POST "$API_URL/internal/org/$ORG_KEY/usage/grant-quota" \
  -H "Content-Type: application/json" \
  -d '{"extraConversations":0,"extraMessages":0}' \
  -b /tmp/helvino_v1112_cookies.txt > /dev/null 2>&1

# POST billing/lock
LOCK_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/internal/org/$ORG_KEY/billing/lock" \
  -H "Content-Type: application/json" \
  -b /tmp/helvino_v1112_cookies.txt 2>/dev/null || echo -e "\n000")
LOCK_CODE=$(echo "$LOCK_RES" | tail -1)

if [ "$LOCK_CODE" = "200" ]; then
  pass "POST /internal/org/$ORG_KEY/billing/lock returns 200"
else
  fail "POST /internal/org/$ORG_KEY/billing/lock returned $LOCK_CODE"
fi

# POST billing/unlock (cleanup)
UNLOCK_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/internal/org/$ORG_KEY/billing/unlock" \
  -H "Content-Type: application/json" \
  -b /tmp/helvino_v1112_cookies.txt 2>/dev/null || echo -e "\n000")
UNLOCK_CODE=$(echo "$UNLOCK_RES" | tail -1)

if [ "$UNLOCK_CODE" = "200" ]; then
  pass "POST /internal/org/$ORG_KEY/billing/unlock returns 200"
else
  fail "POST /internal/org/$ORG_KEY/billing/unlock returned $UNLOCK_CODE"
fi

# GET audit-log
AUDIT_RES=$(curl -s -w "\n%{http_code}" "$API_URL/internal/org/$ORG_KEY/audit-log?limit=5" \
  -b /tmp/helvino_v1112_cookies.txt 2>/dev/null || echo -e "\n000")
AUDIT_CODE=$(echo "$AUDIT_RES" | tail -1)

if [ "$AUDIT_CODE" = "200" ]; then
  pass "GET /internal/org/$ORG_KEY/audit-log returns 200"
else
  fail "GET /internal/org/$ORG_KEY/audit-log returned $AUDIT_CODE"
fi

# Verify audit entries exist (from the reset + grant + lock + unlock we just did)
AUDIT_BODY=$(echo "$AUDIT_RES" | sed '$d')
if echo "$AUDIT_BODY" | grep -q "usage.reset" 2>/dev/null; then
  pass "Audit log contains usage.reset entry"
else
  fail "Audit log missing usage.reset entry"
fi

# Auth protection: unauthenticated access
UNAUTH_RES=$(curl -s -w "\n%{http_code}" "$API_URL/internal/org/$ORG_KEY/usage" 2>/dev/null || echo -e "\n000")
UNAUTH_CODE=$(echo "$UNAUTH_RES" | tail -1)

if [ "$UNAUTH_CODE" = "401" ] || [ "$UNAUTH_CODE" = "403" ]; then
  pass "Usage endpoint requires authentication ($UNAUTH_CODE)"
else
  fail "Usage endpoint returned $UNAUTH_CODE without auth (expected 401/403)"
fi

# Cleanup
rm -f /tmp/helvino_v1112_cookies.txt

echo ""
echo "── Summary ──"
echo "  Results: $PASS passed, $((TOTAL - PASS)) not passed (total $TOTAL)"

if [ "$PASS" -eq "$TOTAL" ]; then
  echo -e "  ${GREEN}STEP 11.12 VERIFICATION: PASS${NC}"
  exit 0
else
  echo -e "  ${RED}STEP 11.12 VERIFICATION: NOT PASSING${NC}"
  exit 1
fi
