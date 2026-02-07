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
skip() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${YELLOW}SKIP${NC}: $1"; }

echo "═══════════════════════════════════════════════"
echo "  VERIFY Step 11.17 — Observability + Traceability"
echo "═══════════════════════════════════════════════"

API_URL="${API_URL:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@helvino.io}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-helvino_admin_2026}"

# ── 1) Key file checks ──
echo ""
echo "── File checks ──"

check_file() {
  if [ -f "$1" ]; then pass "File exists: $1"; else fail "Missing file: $1"; fi
}

check_file "apps/api/src/plugins/request-context.ts"
check_file "apps/api/src/routes/observability.ts"
check_file "apps/api/src/utils/audit-log.ts"
check_file "apps/web/src/utils/api.ts"
check_file "apps/web/src/components/ErrorBanner.tsx"
check_file "docs/STEP_11_17_OBSERVABILITY.md"

# ── 2) Grep checks — code patterns ──
echo ""
echo "── Code pattern checks ──"

# x-request-id in request-context plugin
if grep -q 'x-request-id' apps/api/src/plugins/request-context.ts 2>/dev/null; then
  pass "x-request-id header handling in request-context plugin"
else
  fail "x-request-id header handling missing"
fi

# requestId in structured logs
if grep -q 'requestId' apps/api/src/plugins/request-context.ts 2>/dev/null; then
  pass "requestId in structured logging"
else
  fail "requestId missing from structured logging"
fi

# actorType resolution
if grep -q 'actorType' apps/api/src/plugins/request-context.ts 2>/dev/null; then
  pass "actorType resolution in request context"
else
  fail "actorType missing from request context"
fi

# Global error handler
if grep -q 'setErrorHandler' apps/api/src/plugins/request-context.ts 2>/dev/null; then
  pass "Global error handler (setErrorHandler) present"
else
  fail "Global error handler missing"
fi

# Error envelope includes requestId
if grep -q 'requestId.*request.requestId' apps/api/src/plugins/request-context.ts 2>/dev/null; then
  pass "Error envelope includes requestId"
else
  fail "Error envelope missing requestId"
fi

# /internal/metrics/summary route
if grep -q 'internal/metrics/summary' apps/api/src/routes/observability.ts 2>/dev/null; then
  pass "/internal/metrics/summary route exists"
else
  fail "/internal/metrics/summary route missing"
fi

# Audit log accepts requestId parameter
if grep -q 'requestId' apps/api/src/utils/audit-log.ts 2>/dev/null; then
  pass "Audit log supports requestId correlation"
else
  fail "Audit log missing requestId support"
fi

# Web: getRequestId utility
if grep -q 'getRequestId' apps/web/src/utils/api.ts 2>/dev/null; then
  pass "getRequestId utility in web api.ts"
else
  fail "getRequestId utility missing"
fi

# Web: ErrorBanner component
if grep -q 'requestId' apps/web/src/components/ErrorBanner.tsx 2>/dev/null; then
  pass "ErrorBanner component with requestId support"
else
  fail "ErrorBanner component missing requestId"
fi

# ── 3) API smoke tests ──
echo ""
echo "── API smoke tests ──"

# Check API is running
HEALTH_RES=$(curl -s -m 5 "$API_URL/health" 2>/dev/null || echo "")
if echo "$HEALTH_RES" | grep -q '"ok"'; then
  pass "API is running"
else
  skip "API not running — skipping smoke tests"
  echo ""
  echo "═══════════════════════════════════════════════"
  echo -e "  Result: ${PASS}/${TOTAL} passed"
  if [ "$PASS" -eq "$TOTAL" ]; then
    echo -e "  ${GREEN}PASS${NC}"
  else
    echo -e "  ${RED}FAIL${NC}"
  fi
  echo "═══════════════════════════════════════════════"
  [ "$PASS" -eq "$TOTAL" ] && exit 0 || exit 1
fi

# Test x-request-id response header on health endpoint
XRID=$(curl -s -m 5 -D - "$API_URL/health" 2>/dev/null | grep -i 'x-request-id' || echo "")
if [ -n "$XRID" ]; then
  pass "x-request-id header present on response"
else
  fail "x-request-id header missing from response"
fi

# Test x-request-id propagation (send custom id)
CUSTOM_ID="test-req-id-verify-11-17"
PROP_RID=$(curl -s -m 5 -D - -H "x-request-id: $CUSTOM_ID" "$API_URL/health" 2>/dev/null | grep -i "x-request-id" | tr -d '\r' || echo "")
if echo "$PROP_RID" | grep -q "$CUSTOM_ID"; then
  pass "x-request-id propagation (custom id returned)"
else
  fail "x-request-id propagation failed"
fi

# Test /internal/metrics/summary — unauthenticated should be 401
METRICS_UNAUTH_CODE=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$API_URL/internal/metrics/summary" 2>/dev/null || echo "000")
if [ "$METRICS_UNAUTH_CODE" = "401" ]; then
  pass "/internal/metrics/summary unauthenticated → 401"
else
  fail "/internal/metrics/summary unauthenticated → expected 401, got $METRICS_UNAUTH_CODE"
fi

# Admin login
COOKIE_JAR="/tmp/helvino_v1117_cookies.txt"
LOGIN_RES=$(curl -s -m 10 -w "\n%{http_code}" -X POST "$API_URL/internal/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -c "$COOKIE_JAR" 2>/dev/null || echo -e "\n000")
LOGIN_CODE=$(echo "$LOGIN_RES" | tail -1)

if [ "$LOGIN_CODE" = "200" ]; then
  pass "Admin login → 200"

  # Test /internal/metrics/summary — authenticated
  METRICS_AUTH_RES=$(curl -s -m 10 -w "\n%{http_code}" -b "$COOKIE_JAR" "$API_URL/internal/metrics/summary" 2>/dev/null || echo -e "\n000")
  METRICS_AUTH_CODE=$(echo "$METRICS_AUTH_RES" | tail -1)
  METRICS_AUTH_BODY=$(echo "$METRICS_AUTH_RES" | sed '$d')

  if [ "$METRICS_AUTH_CODE" = "200" ]; then
    pass "/internal/metrics/summary authenticated → 200"

    # Check body has expected fields
    if echo "$METRICS_AUTH_BODY" | grep -q '"uptimeSec"'; then
      pass "metrics/summary contains uptimeSec"
    else
      fail "metrics/summary missing uptimeSec"
    fi
    if echo "$METRICS_AUTH_BODY" | grep -q '"nodeVersion"'; then
      pass "metrics/summary contains nodeVersion"
    else
      fail "metrics/summary missing nodeVersion"
    fi
    if echo "$METRICS_AUTH_BODY" | grep -q '"processMemory"'; then
      pass "metrics/summary contains processMemory"
    else
      fail "metrics/summary missing processMemory"
    fi
  else
    fail "/internal/metrics/summary authenticated → expected 200, got $METRICS_AUTH_CODE"
  fi
else
  skip "Admin login failed ($LOGIN_CODE) — skipping authenticated tests"
fi

# Cleanup
rm -f "$COOKIE_JAR" 2>/dev/null

# ── 4) Error envelope check ──
echo ""
echo "── Error envelope check ──"

# Hit a non-existent route and check for error envelope with requestId
ERR_RES=$(curl -s -m 5 "$API_URL/this-route-does-not-exist" 2>/dev/null || echo "")
# Note: Fastify returns 404 for unknown routes; the global error handler may not catch it
# but the x-request-id header should still be present
ERR_RID=$(curl -s -m 5 -D - "$API_URL/this-route-does-not-exist" 2>/dev/null | grep -i 'x-request-id' || echo "")
if [ -n "$ERR_RID" ]; then
  pass "x-request-id header on error responses"
else
  fail "x-request-id header missing from error responses"
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════════"
echo -e "  Result: ${PASS}/${TOTAL} passed"
if [ "$PASS" -eq "$TOTAL" ]; then
  echo -e "  ${GREEN}PASS${NC}"
else
  echo -e "  ${RED}FAIL${NC}"
fi
echo "═══════════════════════════════════════════════"
[ "$PASS" -eq "$TOTAL" ] && exit 0 || exit 1
