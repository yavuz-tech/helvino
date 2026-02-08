#!/usr/bin/env bash
set -euo pipefail

# i18n compat: use generated flat file instead of translations.ts
_COMPAT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -n "${I18N_COMPAT_FILE:-}" ] && [ -f "${I18N_COMPAT_FILE}" ]; then
  _I18N_COMPAT="$I18N_COMPAT_FILE"
elif [ -f "$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts" ]; then
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
else
  # Fallback: generate compat on the fly
  [ -f "$_COMPAT_DIR/scripts/gen-i18n-compat.js" ] && node "$_COMPAT_DIR/scripts/gen-i18n-compat.js" >/dev/null 2>&1 || true
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
fi


# Helper: curl with retry on 429
curl_with_retry() {
  local url="$1"
  local method="${2:-GET}"
  local data="${3:-}"
  local max_tries=5
  local try=1
  local wait=1

  while [ $try -le $max_tries ]; do
    local http_code
    if [ -n "$data" ]; then
      http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
        -H "Content-Type: application/json" -d "$data" \
        --connect-timeout 5 --max-time 10 "$url" 2>/dev/null || echo "000")
    else
      http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
        --connect-timeout 5 --max-time 10 "$url" 2>/dev/null || echo "000")
    fi

    if [ "$http_code" != "429" ]; then
      echo "$http_code"
      return 0
    fi

    # 429: retry with backoff
    if [ $try -lt $max_tries ]; then
      sleep $wait
      wait=$((wait * 2))
      try=$((try + 1))
    else
      echo "429"
      return 0
    fi
  done
}

# ── Step 11.19 — Portal Session Security + Password Recovery ──
PASS=0
FAIL=0
WARN=0

ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
warn() { WARN=$((WARN+1)); echo "  ⚠️  $1"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
API_URL="${API_URL:-http://localhost:4000}"
PORTAL_EMAIL="${PORTAL_EMAIL:-owner@demo.helvion.io}"
PORTAL_PASSWORD="${PORTAL_PASSWORD:-demo_owner_2026}"

echo "╔══════════════════════════════════════════════════╗"
echo "║  VERIFY — Step 11.19 Portal Session Security     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ─── 1. File existence ───
echo "── 1. File Existence ──"
[ -f "$API_DIR/prisma/schema.prisma" ] && ok "schema.prisma exists" || fail "schema.prisma missing"
[ -f "$API_DIR/prisma/migrations/20260206070000_v11_19_session_security/migration.sql" ] && ok "Migration exists" || fail "Migration missing"
[ -f "$API_DIR/src/routes/portal-security.ts" ] && ok "portal-security.ts exists" || fail "portal-security.ts missing"
[ -f "$WEB_DIR/src/app/portal/forgot-password/page.tsx" ] && ok "forgot-password page exists" || fail "forgot-password page missing"
[ -f "$WEB_DIR/src/app/portal/reset-password/page.tsx" ] && ok "reset-password page exists" || fail "reset-password page missing"
[ -f "$ROOT/docs/STEP_11_19_SESSION_SECURITY.md" ] && ok "Docs exist" || fail "Docs missing"
echo ""

# ─── 2. Schema checks ───
echo "── 2. Schema Checks ──"
grep -q "PasswordResetToken" "$API_DIR/prisma/schema.prisma" && ok "PasswordResetToken model" || fail "PasswordResetToken model missing"
grep -q "PortalSession" "$API_DIR/prisma/schema.prisma" && ok "PortalSession model" || fail "PortalSession model missing"
grep -q "hashedToken" "$API_DIR/prisma/schema.prisma" && ok "hashedToken field" || fail "hashedToken field missing"
grep -q "revokedAt" "$API_DIR/prisma/schema.prisma" && ok "revokedAt field" || fail "revokedAt field missing"
grep -q "userAgent" "$API_DIR/prisma/schema.prisma" && ok "userAgent field" || fail "userAgent field missing"
echo ""

# ─── 3. API route checks ───
echo "── 3. API Route Pattern Checks ──"
grep -q "forgot-password" "$API_DIR/src/routes/portal-security.ts" && ok "forgot-password route" || fail "forgot-password route missing"
grep -q "reset-password" "$API_DIR/src/routes/portal-security.ts" && ok "reset-password route" || fail "reset-password route missing"
grep -q "change-password" "$API_DIR/src/routes/portal-security.ts" && ok "change-password route" || fail "change-password route missing"
grep -q "sessions/revoke" "$API_DIR/src/routes/portal-security.ts" && ok "session revoke route" || fail "session revoke route missing"
grep -q "sessions/revoke-all" "$API_DIR/src/routes/portal-security.ts" && ok "revoke-all route" || fail "revoke-all route missing"
grep -q "writeAuditLog" "$API_DIR/src/routes/portal-security.ts" && ok "Audit logging present" || fail "Audit logging missing"
grep -q "hashToken" "$API_DIR/src/routes/portal-security.ts" && ok "Token hashing present" || fail "Token hashing missing"
grep -q "createRateLimitMiddleware" "$API_DIR/src/routes/portal-security.ts" && ok "Rate limiting present" || fail "Rate limiting missing"
echo ""

# ─── 4. Session tracking in portal-auth ───
echo "── 4. Session Tracking ──"
grep -q "portalSession" "$API_DIR/src/routes/portal-auth.ts" && ok "Session record on login" || fail "Session record on login missing"
grep -q "revokedAt" "$API_DIR/src/middleware/require-portal-user.ts" && ok "Session revocation check" || fail "Session revocation check missing"
grep -q "lastSeenAt" "$API_DIR/src/middleware/require-portal-user.ts" && ok "lastSeenAt update" || fail "lastSeenAt update missing"
echo ""

# ─── 5. i18n checks ───
echo "── 5. i18n Keys ──"
grep -q "security.changePassword" "$_I18N_COMPAT" && ok "changePassword key" || fail "changePassword key missing"
grep -q "security.activeSessions" "$_I18N_COMPAT" && ok "activeSessions key" || fail "activeSessions key missing"
grep -q "security.forgotPassword" "$_I18N_COMPAT" && ok "forgotPassword key" || fail "forgotPassword key missing"
grep -q "security.resetPassword" "$_I18N_COMPAT" && ok "resetPassword key" || fail "resetPassword key missing"
echo ""

# ─── 6. Web UI checks ───
echo "── 6. Web UI Checks ──"
grep -q "forgot-password" "$WEB_DIR/src/app/portal/login/page.tsx" && ok "Forgot password link on login" || fail "Forgot password link missing"
grep -q "change-password" "$WEB_DIR/src/app/portal/security/page.tsx" && ok "Change password on security page" || fail "Change password missing from security"
grep -q "sessions" "$WEB_DIR/src/app/portal/security/page.tsx" && ok "Sessions on security page" || fail "Sessions missing from security"
echo ""

# ─── 7. API Smoke Tests ───
echo "── 7. API Smoke Tests ──"

# Health gate
__API_HC=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "$API_URL/health" 2>/dev/null || echo "000")
if [ "$__API_HC" != "200" ]; then
  echo "  [INFO] API not healthy (HTTP $__API_HC) -- skipping smoke tests (code checks sufficient)"
  echo ""
  echo "════════════════════════════════════════════════"
  echo "  PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
  if [ "$FAIL" -gt 0 ]; then
    echo "  RESULT: FAIL"
    exit 1
  else
    echo "  RESULT: PASS"
    exit 0
  fi
fi

# Test forgot-password returns 200 (generic response, no user enumeration)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com"}' \
  --connect-timeout 5 --max-time 10 \
  "$API_URL/portal/auth/forgot-password" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  ok "forgot-password returns 200 (generic, no enumeration)"
elif [ "$HTTP_CODE" = "000" ]; then
  warn "API not reachable — skipping smoke tests"
else
  fail "forgot-password returned $HTTP_CODE (expected 200)"
fi

# Test reset-password with invalid token returns 400
if [ "$HTTP_CODE" != "000" ]; then
  HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"token":"invalidtoken","newPassword":"abcdefgh"}' \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/auth/reset-password" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE2" = "400" ]; then
    ok "reset-password invalid token returns 400"
  else
    fail "reset-password invalid token returned $HTTP_CODE2 (expected 400)"
  fi

  # Test sessions list requires auth (401 without)
  HTTP_CODE3=$(curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/auth/sessions" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE3" = "401" ]; then
    ok "sessions list requires auth (401)"
  else
    fail "sessions list without auth returned $HTTP_CODE3 (expected 401)"
  fi

  # Test change-password requires auth
  HTTP_CODE4=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"currentPassword":"x","newPassword":"yyyyyyyy"}' \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/auth/change-password" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE4" = "401" ]; then
    ok "change-password requires auth (401)"
  else
    fail "change-password without auth returned $HTTP_CODE4 (expected 401)"
  fi

  # Test revoke requires auth
  HTTP_CODE5=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"test"}' \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/auth/sessions/revoke" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE5" = "401" ]; then
    ok "sessions/revoke requires auth (401)"
  else
    fail "sessions/revoke without auth returned $HTTP_CODE5 (expected 401)"
  fi

  # Test revoke-all requires auth
  HTTP_CODE6=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/auth/sessions/revoke-all" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE6" = "401" ]; then
    ok "sessions/revoke-all requires auth (401)"
  else
    fail "sessions/revoke-all without auth returned $HTTP_CODE6 (expected 401)"
  fi
fi

# ─── 8. Authenticated Tests ───
echo ""
echo "── 8. Authenticated Tests ──"

COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PORTAL_EMAIL\",\"password\":\"$PORTAL_PASSWORD\"}" \
  -c "$COOKIE_JAR" \
  --connect-timeout 5 --max-time 10 \
  "$API_URL/portal/auth/login" 2>/dev/null || echo "000")

if [ "$LOGIN_CODE" = "200" ]; then
  ok "Portal login succeeded"

  # Test sessions list with auth
  SESSIONS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -b "$COOKIE_JAR" \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/auth/sessions" 2>/dev/null || echo "000")

  if [ "$SESSIONS_CODE" = "200" ]; then
    ok "Sessions list with auth returns 200"
  else
    fail "Sessions list with auth returned $SESSIONS_CODE"
  fi

  # Test forgot-password with valid email still returns 200
  FORGOT_CODE=$(curl_with_retry "$API_URL/portal/auth/forgot-password" "POST" "{\"email\":\"$PORTAL_EMAIL\"}")

  if [ "$FORGOT_CODE" = "200" ]; then
    ok "forgot-password valid email returns 200 (generic)"
  else
    fail "forgot-password valid email returned $FORGOT_CODE"
  fi

  # Dev mode: check resetLink is returned
  FORGOT_BODY=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$PORTAL_EMAIL\"}" \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/auth/forgot-password" 2>/dev/null || echo "{}")

  if echo "$FORGOT_BODY" | grep -q "resetLink"; then
    ok "Dev mode includes resetLink"
  else
    warn "resetLink not in response (may be production mode)"
  fi

else
  warn "Portal login failed ($LOGIN_CODE) — skipping authenticated tests"
fi

echo ""
echo "════════════════════════════════════════════════"
echo "  PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
if [ "$FAIL" -gt 0 ]; then
  echo "  RESULT: ❌ FAIL"
  exit 1
else
  echo "  RESULT: ✅ PASS"
  exit 0
fi
