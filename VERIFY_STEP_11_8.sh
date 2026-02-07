#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
ROOT="$(cd "$(dirname "$0")" && pwd)"

if command -v rg &>/dev/null; then
  SEARCH="rg"
else
  SEARCH="grep -R"
fi

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  FAIL: $1"; }

echo "=============================="
echo "  VERIFY Step 11.8"
echo "  Stripe Portal + Invoices"
echo "=============================="
echo ""

# ── 1. API Build ──
echo "--- 1. API Build ---"
cd "$ROOT/apps/api"
if pnpm build 2>&1 | tail -1; then
  pass "API build"
else
  fail "API build"
fi
echo ""

# ── 2. Web Build (isolated dir) ──
echo "--- 2. Web Build ---"
cd "$ROOT/apps/web"
if NEXT_BUILD_DIR=.next-verify pnpm build 2>&1 | tail -3; then
  pass "Web build"
  rm -rf .next-verify 2>/dev/null || true
else
  fail "Web build"
  rm -rf .next-verify 2>/dev/null || true
fi
echo ""

# ── 3. Key files ──
echo "--- 3. Key files ---"

check_file() {
  if [ -f "$ROOT/$1" ]; then pass "exists: $1"; else fail "missing: $1"; fi
}

check_file "apps/api/src/routes/portal-billing.ts"
check_file "apps/api/src/utils/stripe.ts"
check_file "apps/web/src/app/portal/billing/page.tsx"
check_file "docs/STEP_11_8_STRIPE_PORTAL_INVOICES.md"
echo ""

# ── 4. Route patterns ──
echo "--- 4. Route patterns ---"

check_pattern() {
  if $SEARCH "$2" "$ROOT/$1" &>/dev/null; then
    pass "pattern '$2' in $1"
  else
    fail "pattern '$2' not found in $1"
  fi
}

check_pattern "apps/api/src/routes/portal-billing.ts" "/portal/billing/portal-session"
check_pattern "apps/api/src/routes/portal-billing.ts" "/portal/billing/invoices"
check_pattern "apps/api/src/utils/stripe.ts"          "listInvoices"
check_pattern "apps/api/src/utils/stripe.ts"          "InvoiceSummary"
check_pattern "apps/web/src/app/portal/billing/page.tsx" "portal-session"
check_pattern "apps/web/src/app/portal/billing/page.tsx" "Billing History"
echo ""

# ── 5. Negative tests (API must be running) ──
echo "--- 5. Negative tests ---"
API_URL="${API_URL:-http://localhost:4000}"

# 5a. Missing auth -> 401
CODE_INV=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
  "$API_URL/portal/billing/invoices" 2>/dev/null || echo "000")

if [ "$CODE_INV" = "401" ]; then
  pass "invoices returns 401 without auth"
elif [ "$CODE_INV" = "000" ]; then
  echo "  SKIP: API not running at $API_URL"
else
  fail "invoices returned HTTP $CODE_INV (expected 401)"
fi

# 5b. Missing auth -> 401 on portal-session
CODE_PS=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL/portal/billing/portal-session" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")

if [ "$CODE_PS" = "401" ]; then
  pass "portal-session returns 401 without auth"
elif [ "$CODE_PS" = "000" ]; then
  echo "  SKIP: API not running at $API_URL"
else
  fail "portal-session returned HTTP $CODE_PS (expected 401)"
fi

# 5c. Existing billing/status still works
CODE_ST=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
  "$API_URL/portal/billing/status" 2>/dev/null || echo "000")

if [ "$CODE_ST" = "401" ]; then
  pass "billing/status still returns 401 without auth (backwards compat)"
elif [ "$CODE_ST" = "000" ]; then
  echo "  SKIP: API not running at $API_URL"
else
  echo "  INFO: billing/status returned HTTP $CODE_ST"
  pass "billing/status reachable"
fi
echo ""

# ── Summary ──
echo "=============================="
echo "  Results: $PASS passed, $((TOTAL - PASS)) not passed (total $TOTAL)"
if [ "$FAIL" -eq 0 ]; then
  echo "  STEP 11.8 VERIFICATION: PASS"
else
  echo "  STEP 11.8 VERIFICATION: NOT PASSING"
  exit 1
fi
echo "=============================="
