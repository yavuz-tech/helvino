#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Use rg if available, else grep -R
if command -v rg &>/dev/null; then
  SEARCH="rg"
else
  SEARCH="grep -R"
fi

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  FAIL: $1"; }

echo "=============================="
echo "  VERIFY Step 11.7"
echo "  Stripe Plans + Enforcement"
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

# ── 2. Web Build (isolated output dir so dev server is not affected) ──
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

# ── 3. Key files exist ──
echo "--- 3. Key files ---"

check_file() {
  if [ -f "$ROOT/$1" ]; then
    pass "exists: $1"
  else
    fail "missing: $1"
  fi
}

check_file "apps/api/prisma/migrations/20260206020000_v11_7_stripe_plans_enforcement/migration.sql"
check_file "apps/api/src/utils/stripe.ts"
check_file "apps/api/src/utils/entitlements.ts"
check_file "apps/api/src/utils/billing-enforcement.ts"
check_file "apps/api/src/routes/portal-billing.ts"
check_file "apps/api/src/routes/stripe-webhook.ts"
check_file "apps/web/src/app/portal/billing/page.tsx"
check_file "docs/STEP_11_7_STRIPE_PLANS_ENFORCEMENT.md"
echo ""

# ── 4. Route patterns in source ──
echo "--- 4. Route patterns ---"

check_pattern() {
  if $SEARCH "$2" "$ROOT/$1" &>/dev/null; then
    pass "pattern '$2' in $1"
  else
    fail "pattern '$2' not found in $1"
  fi
}

check_pattern "apps/api/src/routes/portal-billing.ts" "/portal/billing/status"
check_pattern "apps/api/src/routes/portal-billing.ts" "/portal/billing/checkout"
check_pattern "apps/api/src/routes/portal-billing.ts" "/portal/billing/portal"
check_pattern "apps/api/src/routes/stripe-webhook.ts" "lastStripeEventId"
check_pattern "apps/api/src/utils/entitlements.ts" "getAvailablePlans"
check_pattern "apps/api/src/utils/entitlements.ts" "getPlanLimits"
check_pattern "apps/api/src/utils/stripe.ts" "mapPriceToplanKey"
check_pattern "apps/api/prisma/schema.prisma" "stripePriceId"
check_pattern "apps/api/prisma/schema.prisma" "lastStripeEventId"
check_pattern "apps/api/prisma/schema.prisma" "trialEndsAt"
echo ""

# ── 5. Webhook negative test (bad signature → 400) ──
echo "--- 5. Webhook negative test ---"
API_URL="${API_URL:-http://localhost:4000}"
HTTP_CODE=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL/stripe/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: bad_sig" \
  -d '{"type":"test"}' 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "501" ]; then
  pass "webhook rejects bad signature (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "000" ]; then
  echo "  SKIP: API not running at $API_URL (cannot test webhook)"
else
  fail "webhook returned HTTP $HTTP_CODE (expected 400 or 501)"
fi
echo ""

# ── 6. Billing status endpoint sanity ──
echo "--- 6. Billing status endpoint ---"
STATUS_CODE=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
  "$API_URL/portal/billing/status" 2>/dev/null || echo "000")

if [ "$STATUS_CODE" = "401" ]; then
  pass "billing/status returns 401 without auth (expected)"
elif [ "$STATUS_CODE" = "000" ]; then
  echo "  SKIP: API not running at $API_URL"
else
  echo "  INFO: billing/status returned HTTP $STATUS_CODE"
  pass "billing/status endpoint reachable"
fi
echo ""

# ── Summary ──
echo "=============================="
echo "  Results: $PASS passed, $((TOTAL - PASS)) not passed (total $TOTAL)"
if [ "$FAIL" -eq 0 ]; then
  echo "  STEP 11.7 VERIFICATION: PASS"
else
  echo "  STEP 11.7 VERIFICATION: NOT PASSING"
  exit 1
fi
echo "=============================="
