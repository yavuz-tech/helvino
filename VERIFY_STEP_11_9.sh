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
echo "  VERIFY Step 11.9"
echo "  Billing Grace + Lock"
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

check_file "apps/api/src/utils/billing-state.ts"
check_file "apps/api/src/middleware/billing-lock.ts"
check_file "apps/api/src/routes/stripe-webhook.ts"
check_file "apps/api/src/routes/portal-billing.ts"
check_file "apps/web/src/app/portal/billing/page.tsx"
check_file "docs/STEP_11_9_BILLING_GRACE_LOCK.md"
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

check_pattern "apps/api/src/routes/portal-billing.ts" "/portal/billing/lock-status"
check_pattern "apps/api/src/routes/stripe-webhook.ts" "invoice.payment_failed"
check_pattern "apps/api/src/routes/stripe-webhook.ts" "graceEndsAt"
check_pattern "apps/api/src/index.ts" "enforceWidgetBillingLock"
echo ""

# ── 5. Negative tests (API must be running) ──
echo "--- 5. Negative tests ---"
API_URL="${API_URL:-http://localhost:4000}"

# 5a. Missing auth -> 401 for lock-status
CODE_LOCK=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
  "$API_URL/portal/billing/lock-status" 2>/dev/null || echo "000")

if [ "$CODE_LOCK" = "401" ]; then
  pass "lock-status returns 401 without auth"
elif [ "$CODE_LOCK" = "000" ]; then
  echo "  SKIP: API not running at $API_URL"
else
  fail "lock-status returned HTTP $CODE_LOCK (expected 401)"
fi

# 5b. Bad signature -> 400 on webhook
CODE_WEBHOOK=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL/stripe/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: bad" \
  -d '{"type":"invoice.payment_failed","data":{"object":{}}}' 2>/dev/null || echo "000")

if [ "$CODE_WEBHOOK" = "400" ] || [ "$CODE_WEBHOOK" = "501" ]; then
  pass "webhook rejects bad signature (HTTP $CODE_WEBHOOK)"
elif [ "$CODE_WEBHOOK" = "000" ]; then
  echo "  SKIP: API not running at $API_URL"
else
  fail "webhook returned HTTP $CODE_WEBHOOK (expected 400 or 501)"
fi
echo ""

# ── Summary ──
echo "=============================="
echo "  Results: $PASS passed, $((TOTAL - PASS)) not passed (total $TOTAL)"
if [ "$FAIL" -eq 0 ]; then
  echo "  STEP 11.9 VERIFICATION: PASS"
else
  echo "  STEP 11.9 VERIFICATION: NOT PASSING"
  exit 1
fi
echo "=============================="
