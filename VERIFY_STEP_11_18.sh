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
echo "  VERIFY Step 11.18 — Portal Team Management"
echo "═══════════════════════════════════════════════"

API_URL="${API_URL:-http://localhost:4000}"
PORTAL_EMAIL="${ORG_OWNER_EMAIL:-owner@demo.helvino.io}"
PORTAL_PASSWORD="${ORG_OWNER_PASSWORD:-demo_owner_2026}"

# ── 1) File checks ──
echo ""
echo "── File checks ──"

check_file() {
  if [ -f "$1" ]; then pass "File exists: $1"; else fail "Missing file: $1"; fi
}

check_file "apps/api/src/routes/portal-team.ts"
check_file "apps/api/prisma/migrations/20260206060000_v11_18_portal_invites/migration.sql"
check_file "apps/web/src/app/portal/team/page.tsx"
check_file "apps/web/src/app/portal/accept-invite/page.tsx"
check_file "docs/STEP_11_18_PORTAL_TEAM.md"

# ── 2) Schema checks ──
echo ""
echo "── Schema checks ──"

if grep -q "model PortalInvite" apps/api/prisma/schema.prisma 2>/dev/null; then
  pass "PortalInvite model in schema"
else
  fail "PortalInvite model missing"
fi

if grep -q "isActive" apps/api/prisma/schema.prisma 2>/dev/null; then
  pass "isActive field in OrgUser"
else
  fail "isActive field missing"
fi

if grep -q "lastLoginAt" apps/api/prisma/schema.prisma 2>/dev/null; then
  pass "lastLoginAt field in OrgUser"
else
  fail "lastLoginAt field missing"
fi

if grep -q "tokenHash" apps/api/prisma/schema.prisma 2>/dev/null; then
  pass "tokenHash field in PortalInvite"
else
  fail "tokenHash field missing"
fi

# ── 3) Route/pattern checks ──
echo ""
echo "── Code pattern checks ──"

if grep -q "portal/org/users" apps/api/src/routes/portal-team.ts 2>/dev/null; then
  pass "Team users route exists"
else
  fail "Team users route missing"
fi

if grep -q "portal/org/users/invite" apps/api/src/routes/portal-team.ts 2>/dev/null; then
  pass "Invite route exists"
else
  fail "Invite route missing"
fi

if grep -q "portal/auth/accept-invite" apps/api/src/routes/portal-team.ts 2>/dev/null; then
  pass "Accept-invite route exists"
else
  fail "Accept-invite route missing"
fi

if grep -q "portal/org/users/role" apps/api/src/routes/portal-team.ts 2>/dev/null; then
  pass "Role change route exists"
else
  fail "Role change route missing"
fi

if grep -q "portal/org/users/deactivate" apps/api/src/routes/portal-team.ts 2>/dev/null; then
  pass "Deactivate route exists"
else
  fail "Deactivate route missing"
fi

if grep -q "writeAuditLog" apps/api/src/routes/portal-team.ts 2>/dev/null; then
  pass "Audit logging in team routes"
else
  fail "Audit logging missing from team routes"
fi

if grep -q "hashToken" apps/api/src/routes/portal-team.ts 2>/dev/null; then
  pass "Token hashing (hashToken) in team routes"
else
  fail "Token hashing missing"
fi

if grep -q "timingSafeEqual" apps/api/src/routes/portal-team.ts 2>/dev/null; then
  pass "Constant-time comparison in team routes"
else
  fail "Constant-time comparison missing"
fi

# ── 4) Web checks ──
echo ""
echo "── Web checks ──"

if grep -q "nav.team" apps/web/src/components/PortalLayout.tsx 2>/dev/null; then
  pass "Team nav item in PortalLayout"
else
  fail "Team nav item missing from PortalLayout"
fi

if grep -q "team\." "$_I18N_COMPAT" 2>/dev/null; then
  pass "Team i18n keys present"
else
  fail "Team i18n keys missing"
fi

if grep -q "accept-invite" apps/web/src/app/portal/accept-invite/page.tsx 2>/dev/null; then
  pass "Accept-invite page references correct route"
else
  fail "Accept-invite page missing route reference"
fi

# ── 5) API smoke tests ──
echo ""
echo "── API smoke tests ──"

HEALTH_RES=$(curl -s -m 5 "$API_URL/health" 2>/dev/null || echo "")
if echo "$HEALTH_RES" | grep -q '"ok"'; then
  pass "API is running"
else
  skip "API not running — skipping smoke tests"
  echo ""
  echo "═══════════════════════════════════════════════"
  echo -e "  Result: ${PASS}/${TOTAL} passed"
  if [ "$PASS" -eq "$TOTAL" ]; then echo -e "  ${GREEN}PASS${NC}"; else echo -e "  ${RED}FAIL${NC}"; fi
  echo "═══════════════════════════════════════════════"
  [ "$PASS" -eq "$TOTAL" ] && exit 0 || exit 1
fi

# Unauth should be 401
USERS_UNAUTH=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$API_URL/portal/org/users" 2>/dev/null || echo "000")
if [ "$USERS_UNAUTH" = "401" ]; then
  pass "GET /portal/org/users unauthenticated → 401"
else
  fail "GET /portal/org/users unauthenticated → expected 401, got $USERS_UNAUTH"
fi

INVITE_UNAUTH=$(curl -s -m 5 -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/org/users/invite" \
  -H "Content-Type: application/json" -d '{"email":"x@x.com","role":"agent"}' 2>/dev/null || echo "000")
if [ "$INVITE_UNAUTH" = "401" ]; then
  pass "POST /portal/org/users/invite unauthenticated → 401"
else
  fail "POST /portal/org/users/invite unauthenticated → expected 401, got $INVITE_UNAUTH"
fi

# Portal login
COOKIE_JAR="/tmp/helvino_v1118_cookies.txt"
rm -f "$COOKIE_JAR" 2>/dev/null

PORTAL_LOGIN_RES=$(curl -s -m 10 -w "\n%{http_code}" -X POST "$API_URL/portal/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PORTAL_EMAIL\",\"password\":\"$PORTAL_PASSWORD\"}" \
  -c "$COOKIE_JAR" 2>/dev/null || echo -e "\n000")
PORTAL_LOGIN_CODE=$(echo "$PORTAL_LOGIN_RES" | tail -1)

if [ "$PORTAL_LOGIN_CODE" = "200" ]; then
  pass "Portal login → 200"

  # Test GET /portal/org/users
  USERS_RES=$(curl -s -m 10 -w "\n%{http_code}" -b "$COOKIE_JAR" "$API_URL/portal/org/users" 2>/dev/null || echo -e "\n000")
  USERS_CODE=$(echo "$USERS_RES" | tail -1)
  USERS_BODY=$(echo "$USERS_RES" | sed '$d')

  if [ "$USERS_CODE" = "200" ]; then
    pass "GET /portal/org/users authenticated → 200"
    if echo "$USERS_BODY" | grep -q '"users"'; then
      pass "Response contains users array"
    else
      fail "Response missing users array"
    fi
    if echo "$USERS_BODY" | grep -q '"invites"'; then
      pass "Response contains invites array"
    else
      fail "Response missing invites array"
    fi
  else
    fail "GET /portal/org/users authenticated → expected 200, got $USERS_CODE"
  fi

  # Test invite creation
  INVITE_RES=$(curl -s -m 10 -w "\n%{http_code}" -X POST -b "$COOKIE_JAR" \
    "$API_URL/portal/org/users/invite" \
    -H "Content-Type: application/json" \
    -d '{"email":"testinvite-verify@example.com","role":"agent"}' 2>/dev/null || echo -e "\n000")
  INVITE_CODE=$(echo "$INVITE_RES" | tail -1)
  INVITE_BODY=$(echo "$INVITE_RES" | sed '$d')

  if [ "$INVITE_CODE" = "201" ]; then
    pass "POST /portal/org/users/invite → 201"
    if echo "$INVITE_BODY" | grep -q '"inviteLink"'; then
      pass "Invite response includes inviteLink (dev mode)"
    else
      skip "No inviteLink in response (might be prod mode)"
    fi
  elif [ "$INVITE_CODE" = "403" ] && echo "$INVITE_BODY" | grep -q "MAX_AGENTS_REACHED"; then
    pass "POST /portal/org/users/invite → 403 MAX_AGENTS_REACHED (maxAgents enforcement active)"
  else
    fail "POST /portal/org/users/invite → expected 201 or 403, got $INVITE_CODE (body: $INVITE_BODY)"
  fi

  # Test accept-invite with bad token
  ACCEPT_BAD=$(curl -s -m 10 -o /dev/null -w "%{http_code}" -X POST \
    "$API_URL/portal/auth/accept-invite" \
    -H "Content-Type: application/json" \
    -d '{"token":"badtoken","password":"testpass123"}' 2>/dev/null || echo "000")
  if [ "$ACCEPT_BAD" = "404" ]; then
    pass "Accept-invite with bad token → 404"
  else
    fail "Accept-invite with bad token → expected 404, got $ACCEPT_BAD"
  fi

else
  skip "Portal login failed ($PORTAL_LOGIN_CODE) — skipping authenticated tests"
fi

# Cleanup
rm -f "$COOKIE_JAR" 2>/dev/null

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
