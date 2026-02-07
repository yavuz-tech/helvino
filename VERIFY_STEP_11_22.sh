#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# VERIFY_STEP_11_22.sh — Step-Up Enforcement + Unified Guard
# ─────────────────────────────────────────────────────────────

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  WARN: $1"; WARN=$((WARN+1)); }

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════════════════════"
echo "  VERIFY Step 11.22 — Step-Up Enforcement"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. File existence ──
echo "── 1. File existence checks ──"

FILES=(
  "apps/api/src/middleware/require-step-up.ts"
  "apps/web/src/utils/step-up.ts"
  "docs/STEP_11_22_STEP_UP_ENFORCEMENT.md"
)

for f in "${FILES[@]}"; do
  if [ -f "$REPO_ROOT/$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done

# ── 2. Guard code checks ──
echo ""
echo "── 2. Unified guard checks ──"

GUARD="$REPO_ROOT/apps/api/src/middleware/require-step-up.ts"

for pattern in "requireStepUp" "STEP_UP_REQUIRED" "adminStepUpUntil" "helvino_portal_stepup" "requestId"; do
  if grep -q "$pattern" "$GUARD" 2>/dev/null; then
    pass "Guard has: $pattern"
  else
    fail "Guard missing: $pattern"
  fi
done

# ── 3. Guard applied to admin routes ──
echo ""
echo "── 3. Admin step-up enforcement ──"

ADMIN_ROUTES="$REPO_ROOT/apps/api/src/routes/internal-admin.ts"

if grep -q 'requireStepUp("admin")' "$ADMIN_ROUTES" 2>/dev/null; then
  pass "internal-admin.ts uses requireStepUp"
else
  fail "internal-admin.ts missing requireStepUp"
fi

# Count how many times it's applied
ADMIN_COUNT=$(grep -c 'requireStepUp("admin")' "$ADMIN_ROUTES" 2>/dev/null || true)
if [ "$ADMIN_COUNT" -ge 5 ]; then
  pass "Admin: $ADMIN_COUNT sensitive endpoints guarded (>= 5)"
else
  fail "Admin: only $ADMIN_COUNT sensitive endpoints guarded (expected >= 5)"
fi

# ── 4. Guard applied to portal routes ──
echo ""
echo "── 4. Portal step-up enforcement ──"

PORTAL_COUNT=0
for f in portal-org.ts portal-team.ts portal-security.ts portal-billing.ts device-routes.ts; do
  FILE="$REPO_ROOT/apps/api/src/routes/$f"
  if [ -f "$FILE" ]; then
    C=$(grep -c 'requireStepUp("portal")' "$FILE" 2>/dev/null || true)
    PORTAL_COUNT=$((PORTAL_COUNT + C))
  fi
done

if [ "$PORTAL_COUNT" -ge 8 ]; then
  pass "Portal: $PORTAL_COUNT sensitive endpoints guarded (>= 8)"
else
  fail "Portal: only $PORTAL_COUNT sensitive endpoints guarded (expected >= 8)"
fi

for f in portal-org.ts portal-team.ts portal-security.ts portal-billing.ts; do
  FILE="$REPO_ROOT/apps/api/src/routes/$f"
  if grep -q 'requireStepUp' "$FILE" 2>/dev/null; then
    pass "$f uses requireStepUp"
  else
    fail "$f missing requireStepUp"
  fi
done

# ── 5. Web utility checks ──
echo ""
echo "── 5. Web utility checks ──"

WEB_UTIL="$REPO_ROOT/apps/web/src/utils/step-up.ts"

for fn in "isStepUpRequired" "adminStepUpChallenge" "portalStepUpChallenge" "STEP_UP_REQUIRED"; do
  if grep -q "$fn" "$WEB_UTIL" 2>/dev/null; then
    pass "Web util: $fn"
  else
    fail "Web util missing: $fn"
  fi
done

# ── 6. STEP_UP_REQUIRED code consistency ──
echo ""
echo "── 6. Code consistency checks ──"

# The code string should be used in both guard and web
if grep -q "STEP_UP_REQUIRED" "$GUARD" 2>/dev/null; then
  pass "Guard uses STEP_UP_REQUIRED code"
else
  fail "Guard missing STEP_UP_REQUIRED code"
fi

if grep -q "STEP_UP_REQUIRED" "$WEB_UTIL" 2>/dev/null; then
  pass "Web util detects STEP_UP_REQUIRED code"
else
  fail "Web util missing STEP_UP_REQUIRED detection"
fi

# ── 7. API smoke tests ──
echo ""
echo "── 7. API smoke tests ──"

API_URL="${API_URL:-http://localhost:4000}"

# Test a sensitive admin endpoint without auth -> should get 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/internal/org/demo/billing/lock" -H "Content-Type: application/json" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Admin billing/lock requires auth (401)"
elif [ "$HTTP_CODE" = "000" ]; then
  warn "API not reachable at $API_URL — skipping smoke tests"
else
  fail "Admin billing/lock returned $HTTP_CODE (expected 401)"
fi

# Test a sensitive portal endpoint without auth -> should get 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/org/users/invite" -H "Content-Type: application/json" -d '{"email":"test@test.com","role":"admin"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal invite requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal invite returned $HTTP_CODE (expected 401)"
fi

# Test portal change-password without auth -> 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/auth/change-password" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal change-password requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal change-password returned $HTTP_CODE (expected 401)"
fi

# Test portal rotate-site-id without auth -> 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/org/me/rotate-site-id" -H "Content-Type: application/json" -d '{"confirm":"ROTATE"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal rotate-site-id requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal rotate-site-id returned $HTTP_CODE (expected 401)"
fi

# Test portal billing checkout without auth -> 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/billing/checkout" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal billing checkout requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal billing checkout returned $HTTP_CODE (expected 401)"
fi

# Test portal session revoke without auth -> 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/auth/sessions/revoke" -H "Content-Type: application/json" -d '{"sessionId":"test"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal sessions/revoke requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal sessions/revoke returned $HTTP_CODE (expected 401)"
fi

# ── 8. Documentation check ──
echo ""
echo "── 8. Documentation checks ──"

DOC="$REPO_ROOT/docs/STEP_11_22_STEP_UP_ENFORCEMENT.md"

for word in "requireStepUp" "STEP_UP_REQUIRED" "admin" "portal" "sensitive"; do
  if grep -q "$word" "$DOC" 2>/dev/null; then
    pass "Doc mentions: $word"
  else
    fail "Doc missing: $word"
  fi
done

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  SUMMARY: PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
echo "═══════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ RESULT: FAIL"
  exit 1
else
  echo "  ✅ RESULT: PASS"
  exit 0
fi
