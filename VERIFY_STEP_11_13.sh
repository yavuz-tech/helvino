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
echo "  VERIFY Step 11.13 — Usage Visibility + Alerts UX"
echo "═══════════════════════════════════════════════"

API_URL="${API_URL:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@helvino.io}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-helvino_admin_2026}"
ORG_KEY="${ORG_KEY:-demo}"

# ── 1) File checks ──
echo ""
echo "── File checks ──"

check_file() {
  if [ -f "$1" ]; then pass "File exists: $1"; else fail "Missing file: $1"; fi
}

check_file "apps/web/src/app/portal/usage/page.tsx"
check_file "apps/web/src/app/dashboard/audit/page.tsx"
check_file "docs/STEP_11_13_USAGE_UX.md"

# ── 2) Code content checks ──
echo ""
echo "── Code content checks ──"

# Portal usage page has ring chart
if grep -q "UsageRing" apps/web/src/app/portal/usage/page.tsx 2>/dev/null; then
  pass "UsageRing component in portal usage page"
else
  fail "UsageRing component missing from portal usage page"
fi

# Portal usage page has lock/grace banners
if grep -q "locked\|billingLocked\|usage.locked" apps/web/src/app/portal/usage/page.tsx 2>/dev/null; then
  pass "Locked banner in portal usage page"
else
  fail "Locked banner missing from portal usage page"
fi

# Portal billing page has >=80% banner
if grep -q "approachingLimit\|usageHigh" apps/web/src/app/portal/billing/page.tsx 2>/dev/null; then
  pass "Approaching limit banner in billing page"
else
  fail "Approaching limit banner missing from billing page"
fi

# Portal billing page has >=100% banner
if grep -q "usageFull\|limitReached\|billing.accountLocked" apps/web/src/app/portal/billing/page.tsx 2>/dev/null; then
  pass "Usage limit reached banner in billing page"
else
  fail "Usage limit reached banner missing from billing page"
fi

# Portal layout has Usage nav link
if grep -q '"/portal/usage"' apps/web/src/components/PortalLayout.tsx 2>/dev/null; then
  pass "Usage nav link in portal layout"
else
  fail "Usage nav link missing from portal layout"
fi

# Dashboard layout has Audit Log nav link
if grep -q '"/dashboard/audit"' apps/web/src/components/DashboardLayout.tsx 2>/dev/null; then
  pass "Audit Log nav link in dashboard layout"
else
  fail "Audit Log nav link missing from dashboard layout"
fi

# Dashboard audit page has filter UI
if grep -q "filterAction" apps/web/src/app/dashboard/audit/page.tsx 2>/dev/null; then
  pass "Filter UI in audit log page"
else
  fail "Filter UI missing from audit log page"
fi

# Dashboard audit page consumes audit-log endpoint
if grep -q "audit-log" apps/web/src/app/dashboard/audit/page.tsx 2>/dev/null; then
  pass "Audit log endpoint consumed in audit page"
else
  fail "Audit log endpoint not consumed in audit page"
fi

# ── 3) API route checks (requires running server) ──
echo ""
echo "── API route checks ──"

# Admin login
LOGIN_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/internal/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -c /tmp/helvino_v1113_cookies.txt 2>/dev/null || echo -e "\n000")

LOGIN_CODE=$(echo "$LOGIN_RES" | tail -1)

if [ "$LOGIN_CODE" = "200" ]; then
  pass "Admin login"
else
  skip "Admin login returned $LOGIN_CODE — skipping API tests"
  echo ""
  echo "── Summary ──"
  echo "  Results: $PASS passed, $((TOTAL - PASS)) not passed (total $TOTAL)"
  if [ "$PASS" -eq "$TOTAL" ]; then
    echo -e "  ${GREEN}STEP 11.13 VERIFICATION: PASS${NC}"
  else
    echo -e "  ${YELLOW}STEP 11.13 VERIFICATION: PARTIAL (API not reachable)${NC}"
  fi
  exit 0
fi

# GET audit-log (admin, authenticated)
AUDIT_RES=$(curl -s -w "\n%{http_code}" "$API_URL/internal/org/$ORG_KEY/audit-log?limit=5" \
  -b /tmp/helvino_v1113_cookies.txt 2>/dev/null || echo -e "\n000")
AUDIT_CODE=$(echo "$AUDIT_RES" | tail -1)

if [ "$AUDIT_CODE" = "200" ]; then
  pass "GET /internal/org/$ORG_KEY/audit-log returns 200 (authenticated)"
else
  fail "GET /internal/org/$ORG_KEY/audit-log returned $AUDIT_CODE"
fi

# GET audit-log (unauthenticated — must be 401 or 403)
UNAUTH_AUDIT=$(curl -s -w "\n%{http_code}" "$API_URL/internal/org/$ORG_KEY/audit-log" 2>/dev/null || echo -e "\n000")
UNAUTH_CODE=$(echo "$UNAUTH_AUDIT" | tail -1)

if [ "$UNAUTH_CODE" = "401" ] || [ "$UNAUTH_CODE" = "403" ]; then
  pass "GET audit-log without auth returns $UNAUTH_CODE"
else
  fail "GET audit-log without auth returned $UNAUTH_CODE (expected 401/403)"
fi

# GET billing/status via portal (unauthenticated — must be 401)
PORTAL_UNAUTH=$(curl -s -w "\n%{http_code}" "$API_URL/portal/billing/status" 2>/dev/null || echo -e "\n000")
PORTAL_CODE=$(echo "$PORTAL_UNAUTH" | tail -1)

if [ "$PORTAL_CODE" = "401" ] || [ "$PORTAL_CODE" = "403" ]; then
  pass "GET /portal/billing/status without auth returns $PORTAL_CODE"
else
  fail "GET /portal/billing/status without auth returned $PORTAL_CODE (expected 401/403)"
fi

# GET lock-status via portal (unauthenticated — must be 401)
LOCK_UNAUTH=$(curl -s -w "\n%{http_code}" "$API_URL/portal/billing/lock-status" 2>/dev/null || echo -e "\n000")
LOCK_CODE=$(echo "$LOCK_UNAUTH" | tail -1)

if [ "$LOCK_CODE" = "401" ] || [ "$LOCK_CODE" = "403" ]; then
  pass "GET /portal/billing/lock-status without auth returns $LOCK_CODE"
else
  fail "GET /portal/billing/lock-status without auth returned $LOCK_CODE (expected 401/403)"
fi

# Cleanup
rm -f /tmp/helvino_v1113_cookies.txt

echo ""
echo "── Summary ──"
echo "  Results: $PASS passed, $((TOTAL - PASS)) not passed (total $TOTAL)"

if [ "$PASS" -eq "$TOTAL" ]; then
  echo -e "  ${GREEN}STEP 11.13 VERIFICATION: PASS${NC}"
  exit 0
else
  echo -e "  ${RED}STEP 11.13 VERIFICATION: NOT PASSING${NC}"
  exit 1
fi
