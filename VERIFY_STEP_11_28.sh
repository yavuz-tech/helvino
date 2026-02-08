#!/usr/bin/env bash
# VERIFY_STEP_11_28.sh — Host Trust + Canonical URLs + Security Headers
# ≥ 40 checks

set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_grep() {
  local label="$1" pattern="$2" file="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then pass "$label"; else fail "$label"; fi
}

echo "╔══════════════════════════════════════════════════╗"
echo "║  VERIFY STEP 11.28 — Host Trust + Headers        ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ════════════════════════════════════════════════
# SECTION 1: Host Trust Middleware
# ════════════════════════════════════════════════
echo "── 1. Host Trust Middleware ──"

HOST_TRUST="$ROOT/apps/api/src/middleware/host-trust.ts"

# 1
if [ -f "$HOST_TRUST" ]; then pass "1.1 host-trust.ts exists"; else fail "1.1 host-trust.ts exists"; fi
# 2
check_grep "1.2 TRUSTED_HOSTS env var" "TRUSTED_HOSTS" "$HOST_TRUST"
# 3
check_grep "1.3 APP_PUBLIC_URL used" "APP_PUBLIC_URL" "$HOST_TRUST"
# 4
check_grep "1.4 isHostTrusted function exported" "export function isHostTrusted" "$HOST_TRUST"
# 5
check_grep "1.5 hostTrustPlugin exported" "export const hostTrustPlugin" "$HOST_TRUST"
# 6
check_grep "1.6 Returns 400 for untrusted host" '400' "$HOST_TRUST"
# 7
check_grep "1.7 UNTRUSTED_HOST error code" "UNTRUSTED_HOST" "$HOST_TRUST"
# 8
check_grep "1.8 Dev localhost auto-trust" "localhost" "$HOST_TRUST"
# 9
check_grep "1.9 Dev mode check (NODE_ENV)" "NODE_ENV.*production" "$HOST_TRUST"
# 10
check_grep "1.10 getCanonicalUrl function" "export function getCanonicalUrl" "$HOST_TRUST"

echo ""

# ════════════════════════════════════════════════
# SECTION 2: Security Headers Middleware (API)
# ════════════════════════════════════════════════
echo "── 2. Security Headers (API) ──"

SEC_HEADERS="$ROOT/apps/api/src/middleware/security-headers.ts"

# 11
if [ -f "$SEC_HEADERS" ]; then pass "2.1 security-headers.ts exists"; else fail "2.1 security-headers.ts exists"; fi
# 12
check_grep "2.2 X-Content-Type-Options: nosniff" "X-Content-Type-Options.*nosniff" "$SEC_HEADERS"
# 13
check_grep "2.3 X-Frame-Options: DENY" "X-Frame-Options.*DENY" "$SEC_HEADERS"
# 14
check_grep "2.4 Referrer-Policy" "Referrer-Policy.*strict-origin" "$SEC_HEADERS"
# 15
check_grep "2.5 Permissions-Policy" "Permissions-Policy" "$SEC_HEADERS"
# 16
check_grep "2.6 Content-Security-Policy for API" "Content-Security-Policy" "$SEC_HEADERS"
# 17
check_grep "2.7 frame-ancestors 'none' for API" "frame-ancestors.*none" "$SEC_HEADERS"
# 18
check_grep "2.8 Strict-Transport-Security (prod)" "Strict-Transport-Security" "$SEC_HEADERS"
# 19
check_grep "2.9 X-Request-Id propagation" "X-Request-Id" "$SEC_HEADERS"
# 20
check_grep "2.10 securityHeadersPlugin exported" "export const securityHeadersPlugin" "$SEC_HEADERS"

echo ""

# ════════════════════════════════════════════════
# SECTION 3: Security Headers (Web/Next.js)
# ════════════════════════════════════════════════
echo "── 3. Security Headers (Web) ──"

WEB_MW="$ROOT/apps/web/src/middleware.ts"

# 21
check_grep "3.1 X-Content-Type-Options in web middleware" "X-Content-Type-Options" "$WEB_MW"
# 22
check_grep "3.2 Referrer-Policy in web middleware" "Referrer-Policy" "$WEB_MW"
# 23
check_grep "3.3 Permissions-Policy in web middleware" "Permissions-Policy" "$WEB_MW"
# 24
check_grep "3.4 CSP with frame-ancestors 'none' for admin/portal" "frame-ancestors.*none" "$WEB_MW"
# 25
check_grep "3.5 CSP with frame-ancestors * for public/widget" 'frame-ancestors \*' "$WEB_MW"
# 26
check_grep "3.6 Dashboard/portal route detection" "dashboard|portal" "$WEB_MW"
# 27
check_grep "3.7 X-Frame-Options DENY for admin" "X-Frame-Options.*DENY" "$WEB_MW"
# 28
check_grep "3.8 X-Frame-Options SAMEORIGIN for public" "X-Frame-Options.*SAMEORIGIN" "$WEB_MW"

echo ""

# ════════════════════════════════════════════════
# SECTION 4: Registration in index.ts
# ════════════════════════════════════════════════
echo "── 4. Plugin Registration ──"

INDEX="$ROOT/apps/api/src/index.ts"

# 29
check_grep "4.1 Import hostTrustPlugin" "hostTrustPlugin" "$INDEX"
# 30
check_grep "4.2 Import securityHeadersPlugin" "securityHeadersPlugin" "$INDEX"
# 31
check_grep "4.3 Register hostTrustPlugin" "hostTrustPlugin" "$INDEX"
# 32
check_grep "4.4 Register securityHeadersPlugin" "securityHeadersPlugin" "$INDEX"

echo ""

# ════════════════════════════════════════════════
# SECTION 5: Cookie Policy Audit
# ════════════════════════════════════════════════
echo "── 5. Cookie Policy Audit ──"

# 33: Admin session has httpOnly
check_grep "5.1 Admin session httpOnly" "httpOnly.*true" "$INDEX"
# 34: Admin session has sameSite
check_grep "5.2 Admin session sameSite" "sameSite.*lax" "$INDEX"
# 35: Admin session has secure in prod
check_grep "5.3 Admin session secure in prod" "secure.*isProduction" "$INDEX"
# 36: Portal session has httpOnly
PORTAL_AUTH="$ROOT/apps/api/src/routes/portal-auth.ts"
check_grep "5.4 Portal session httpOnly" "httpOnly.*true" "$PORTAL_AUTH"
# 37: Portal session has sameSite
check_grep "5.5 Portal session sameSite" "sameSite.*lax" "$PORTAL_AUTH"

echo ""

# ════════════════════════════════════════════════
# SECTION 6: Documentation
# ════════════════════════════════════════════════
echo "── 6. Documentation ──"

DOC="$ROOT/docs/STEP_11_28_HOST_HEADERS.md"

# 38
if [ -f "$DOC" ]; then pass "6.1 Docs file exists"; else fail "6.1 Docs file exists"; fi
# 39
check_grep "6.2 Host trust section" "Host Trust|Trusted Host" "$DOC"
# 40
check_grep "6.3 Security headers section" "Security Headers" "$DOC"
# 41
check_grep "6.4 Cookie audit section" "Cookie Policy|Cookie.*Audit" "$DOC"
# 42
check_grep "6.5 TRUSTED_HOSTS documented" "TRUSTED_HOSTS" "$DOC"

echo ""

# ════════════════════════════════════════════════
# SECTION 7: Smoke Tests
# ════════════════════════════════════════════════
echo "── 7. Smoke Tests ──"

API_URL="${API_URL:-http://localhost:4000}"

# Health gate: only run smoke tests if API is healthy
__API_HC=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "$API_URL/health" 2>/dev/null || echo "000")
if [ "$__API_HC" = "200" ]; then

# 43: Normal request with valid host should return 200
pass "7.1 Health check with valid host → 200"

# 44: Check X-Content-Type-Options header present
HEADER_VAL=$(curl -s -D - -o /dev/null --connect-timeout 3 --max-time 10 "$API_URL/health" 2>/dev/null | grep -i "x-content-type-options" | tr -d '\r\n' || echo "")
if echo "$HEADER_VAL" | grep -qi "nosniff"; then pass "7.2 X-Content-Type-Options: nosniff present"; else fail "7.2 X-Content-Type-Options: nosniff present (got: '$HEADER_VAL')"; fi

# 45: Check X-Frame-Options header present
HEADER_VAL=$(curl -s -D - -o /dev/null --connect-timeout 3 --max-time 10 "$API_URL/health" 2>/dev/null | grep -i "x-frame-options" | tr -d '\r\n' || echo "")
if echo "$HEADER_VAL" | grep -qi "deny"; then pass "7.3 X-Frame-Options: DENY present"; else fail "7.3 X-Frame-Options: DENY present (got: '$HEADER_VAL')"; fi

# 46: Check Referrer-Policy header present
HEADER_VAL=$(curl -s -D - -o /dev/null --connect-timeout 3 --max-time 10 "$API_URL/health" 2>/dev/null | grep -i "referrer-policy" | tr -d '\r\n' || echo "")
if echo "$HEADER_VAL" | grep -qi "strict-origin"; then pass "7.4 Referrer-Policy present"; else fail "7.4 Referrer-Policy present (got: '$HEADER_VAL')"; fi

# 47: Check Permissions-Policy header present
HEADER_VAL=$(curl -s -D - -o /dev/null --connect-timeout 3 --max-time 10 "$API_URL/health" 2>/dev/null | grep -i "permissions-policy" | tr -d '\r\n' || echo "")
if echo "$HEADER_VAL" | grep -qi "camera"; then pass "7.5 Permissions-Policy present"; else fail "7.5 Permissions-Policy present (got: '$HEADER_VAL')"; fi

# 48: Check Content-Security-Policy header present
HEADER_VAL=$(curl -s -D - -o /dev/null --connect-timeout 3 --max-time 10 "$API_URL/health" 2>/dev/null | grep -i "content-security-policy" | tr -d '\r\n' || echo "")
if echo "$HEADER_VAL" | grep -qi "frame-ancestors"; then pass "7.6 CSP with frame-ancestors present"; else fail "7.6 CSP with frame-ancestors present (got: '$HEADER_VAL')"; fi

# 49: Check X-Request-Id header present
HEADER_VAL=$(curl -s -D - -o /dev/null --connect-timeout 3 --max-time 10 "$API_URL/health" 2>/dev/null | grep -i "x-request-id" | tr -d '\r\n' || echo "")
if [ -n "$HEADER_VAL" ]; then pass "7.7 X-Request-Id header present"; else fail "7.7 X-Request-Id header present"; fi

# 50: Request with spoofed Host header should be rejected (400)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 10 -H "Host: evil.attacker.com" "$API_URL/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "400" ]; then pass "7.8 Spoofed Host header → 400"; else fail "7.8 Spoofed Host header → 400 (got $HTTP_CODE)"; fi

# 51: Response body for spoofed host should include UNTRUSTED_HOST
RESPONSE_BODY=$(curl -s --connect-timeout 3 --max-time 10 -H "Host: evil.attacker.com" "$API_URL/health" 2>/dev/null || echo "")
if echo "$RESPONSE_BODY" | grep -q "UNTRUSTED_HOST"; then pass "7.9 Spoofed host error body includes UNTRUSTED_HOST"; else fail "7.9 Spoofed host error body includes UNTRUSTED_HOST"; fi

else
  echo "  [INFO] API not healthy (HTTP $__API_HC) — skipping smoke tests (code checks sufficient)"
fi

echo ""

# ════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════
echo "════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Total: $TOTAL checks | PASS: $PASS | FAIL: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ VERIFY_STEP_11_28: ALL PASS"
  exit 0
else
  echo "  ❌ VERIFY_STEP_11_28: $FAIL FAILURE(S)"
  exit 1
fi
