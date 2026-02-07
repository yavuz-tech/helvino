#!/usr/bin/env bash
# VERIFY_STEP_11_26.sh — WebAuthn Production Hardening (DB Challenge Store + Lifecycle)
# ≥ 40 checks

set -uo pipefail

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

ROOT="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_grep() {
  local label="$1" pattern="$2" file="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then pass "$label"; else fail "$label"; fi
}
check_grep_not() {
  local label="$1" pattern="$2" file="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then fail "$label"; else pass "$label"; fi
}

echo "╔══════════════════════════════════════════════════╗"
echo "║  VERIFY STEP 11.26 — WebAuthn Hardening          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ════════════════════════════════════════════════
# SECTION 1: Schema / Migration
# ════════════════════════════════════════════════
echo "── 1. Schema & Migration ──"

SCHEMA="$ROOT/apps/api/prisma/schema.prisma"
MIG_DIR="$ROOT/apps/api/prisma/migrations/20260206140000_v11_26_webauthn_challenge"

# 1
check_grep "1.1 WebAuthnChallenge model in schema" "model WebAuthnChallenge" "$SCHEMA"
# 2
check_grep "1.2 challenge field (unique)" "challenge.*String.*@unique" "$SCHEMA"
# 3
check_grep "1.3 expiresAt field" "expiresAt.*DateTime" "$SCHEMA"
# 4
check_grep "1.4 usedAt field (nullable)" "usedAt.*DateTime" "$SCHEMA"
# 5
check_grep "1.5 userId field (optional)" "userId.*String" "$SCHEMA"
# 6
check_grep "1.6 userType field" "userType.*String" "$SCHEMA"
# 7
check_grep "1.7 ip field" "ip.*String" "$SCHEMA"
# 8
check_grep "1.8 userAgent field in challenge model" "userAgent.*String" "$SCHEMA"
# 9
check_grep "1.9 @@map webauthn_challenges" 'webauthn_challenges' "$SCHEMA"
# 10
if [ -d "$MIG_DIR" ]; then pass "1.10 Migration directory exists"; else fail "1.10 Migration directory exists"; fi
# 11
check_grep "1.11 Migration SQL creates table" "CREATE TABLE.*webauthn_challenges" "$MIG_DIR/migration.sql"
# 12
check_grep "1.12 Migration SQL unique index on challenge" "UNIQUE INDEX.*challenge" "$MIG_DIR/migration.sql"

echo ""

# ════════════════════════════════════════════════
# SECTION 2: WebAuthn Utility (DB challenge store)
# ════════════════════════════════════════════════
echo "── 2. WebAuthn Utility (DB challenge store) ──"

WEBAUTHN_UTIL="$ROOT/apps/api/src/utils/webauthn.ts"

# 13
check_grep "2.1 Import prisma" 'import.*prisma.*from.*prisma' "$WEBAUTHN_UTIL"
# 14
check_grep "2.2 createChallengeDB function exists" "export async function createChallengeDB" "$WEBAUTHN_UTIL"
# 15
check_grep "2.3 consumeChallengeDB function exists" "export async function consumeChallengeDB" "$WEBAUTHN_UTIL"
# 16
check_grep "2.4 Single-use enforcement (usedAt)" "usedAt.*null|usedAt.*new Date" "$WEBAUTHN_UTIL"
# 17
check_grep "2.5 Expiry enforcement (expiresAt)" "expiresAt" "$WEBAUTHN_UTIL"
# 18
check_grep "2.6 Lazy cleanup of expired challenges" "deleteMany" "$WEBAUTHN_UTIL"
# 19
check_grep "2.7 IP capture in challenge" "ip.*substring" "$WEBAUTHN_UTIL"
# 20
check_grep "2.8 UserAgent capture in challenge" "userAgent.*substring" "$WEBAUTHN_UTIL"
# 21
check_grep "2.9 Challenge TTL defined" "CHALLENGE_TTL_MS" "$WEBAUTHN_UTIL"
# 22
check_grep "2.10 webAuthnChallenge.create" "webAuthnChallenge.create" "$WEBAUTHN_UTIL"
# 23
check_grep "2.11 webAuthnChallenge.findFirst" "webAuthnChallenge.findFirst" "$WEBAUTHN_UTIL"
# 24
check_grep "2.12 Mark challenge as used (update)" "webAuthnChallenge.update" "$WEBAUTHN_UTIL"

echo ""

# ════════════════════════════════════════════════
# SECTION 3: Routes (DB challenge integration)
# ════════════════════════════════════════════════
echo "── 3. Routes (DB challenge integration) ──"

ROUTES="$ROOT/apps/api/src/routes/webauthn-routes.ts"

# 25
check_grep "3.1 Import createChallengeDB" "createChallengeDB" "$ROUTES"
# 26
check_grep "3.2 Import consumeChallengeDB" "consumeChallengeDB" "$ROUTES"
# 27
check_grep "3.3 Portal register options uses createChallengeDB" "createChallengeDB" "$ROUTES"
# 28
check_grep "3.4 Portal register verify uses consumeChallengeDB" "consumeChallengeDB" "$ROUTES"
# 29
check_grep "3.5 Portal revoke-all route exists" "/portal/webauthn/credentials/revoke-all" "$ROUTES"
# 30
check_grep "3.6 Portal sessions revoke-all route exists" "/portal/webauthn/sessions/revoke-all" "$ROUTES"
# 31
check_grep "3.7 Admin revoke-all route exists" "/admin/webauthn/credentials/revoke-all" "$ROUTES"
# 32
check_grep "3.8 Admin sessions revoke-all route exists" "/admin/webauthn/sessions/revoke-all" "$ROUTES"
# 33
check_grep "3.9 Revoke-all audit log" "webauthn.revoked_all" "$ROUTES"
# 34
check_grep "3.10 Sessions revoke-all audit log" "webauthn.sessions_revoked_all" "$ROUTES"
# 35
check_grep "3.11 Revoke-all uses step-up guard" "requireStepUp" "$ROUTES"

echo ""

# ════════════════════════════════════════════════
# SECTION 4: Preflight Env Validation
# ════════════════════════════════════════════════
echo "── 4. Preflight env validation ──"

PREFLIGHT="$ROOT/scripts/preflight.sh"

# 36
check_grep "4.1 WEBAUTHN_RP_ID in preflight" "WEBAUTHN_RP_ID" "$PREFLIGHT"
# 37
check_grep "4.2 WEBAUTHN_ORIGIN in preflight" "WEBAUTHN_ORIGIN" "$PREFLIGHT"
# 38
check_grep "4.3 WEBAUTHN_RP_NAME in preflight" "WEBAUTHN_RP_NAME" "$PREFLIGHT"
# 39
check_grep "4.4 Production enforcement (MISSING)" "REQUIRED in production" "$PREFLIGHT"

echo ""

# ════════════════════════════════════════════════
# SECTION 5: UI (PasskeySection lifecycle)
# ════════════════════════════════════════════════
echo "── 5. UI (PasskeySection lifecycle) ──"

PASSKEY_SEC="$ROOT/apps/web/src/components/PasskeySection.tsx"

# 40
check_grep "5.1 Revoke all passkeys handler" "handleRevokeAll" "$PASSKEY_SEC"
# 41
check_grep "5.2 Revoke all sessions handler" "handleRevokeAllSessions" "$PASSKEY_SEC"
# 42
check_grep "5.3 Uses i18n revokeAll key" "passkeys.revokeAll" "$PASSKEY_SEC"
# 43
check_grep "5.4 Uses i18n revokeAllSessions key" "passkeys.revokeAllSessions" "$PASSKEY_SEC"
# 44
check_grep "5.5 Confirmation dialog" 'confirm\(' "$PASSKEY_SEC"

echo ""

# ════════════════════════════════════════════════
# SECTION 6: i18n (EN/TR/ES parity)
# ════════════════════════════════════════════════
echo "── 6. i18n (EN/TR/ES parity) ──"

I18N="$ROOT/apps/web/src/i18n/translations.ts"

# 45
EN_REVOKE_ALL=$(grep -c '"passkeys.revokeAll"' "$I18N" 2>/dev/null || echo 0)
if [ "$EN_REVOKE_ALL" -ge 3 ]; then pass "6.1 passkeys.revokeAll in EN/TR/ES"; else fail "6.1 passkeys.revokeAll in EN/TR/ES (found $EN_REVOKE_ALL/3)"; fi
# 46
EN_REVOKE_ALL_CONFIRM=$(grep -c '"passkeys.revokeAllConfirm"' "$I18N" 2>/dev/null || echo 0)
if [ "$EN_REVOKE_ALL_CONFIRM" -ge 3 ]; then pass "6.2 passkeys.revokeAllConfirm in EN/TR/ES"; else fail "6.2 passkeys.revokeAllConfirm in EN/TR/ES (found $EN_REVOKE_ALL_CONFIRM/3)"; fi
# 47
EN_REVOKE_ALL_SUCCESS=$(grep -c '"passkeys.revokeAllSuccess"' "$I18N" 2>/dev/null || echo 0)
if [ "$EN_REVOKE_ALL_SUCCESS" -ge 3 ]; then pass "6.3 passkeys.revokeAllSuccess in EN/TR/ES"; else fail "6.3 passkeys.revokeAllSuccess in EN/TR/ES (found $EN_REVOKE_ALL_SUCCESS/3)"; fi
# 48
EN_REVOKE_SESSIONS=$(grep -c '"passkeys.revokeAllSessions"' "$I18N" 2>/dev/null || echo 0)
if [ "$EN_REVOKE_SESSIONS" -ge 3 ]; then pass "6.4 passkeys.revokeAllSessions in EN/TR/ES"; else fail "6.4 passkeys.revokeAllSessions in EN/TR/ES (found $EN_REVOKE_SESSIONS/3)"; fi
# 49
EN_REVOKE_SESSIONS_CONFIRM=$(grep -c '"passkeys.revokeAllSessionsConfirm"' "$I18N" 2>/dev/null || echo 0)
if [ "$EN_REVOKE_SESSIONS_CONFIRM" -ge 3 ]; then pass "6.5 passkeys.revokeAllSessionsConfirm in EN/TR/ES"; else fail "6.5 passkeys.revokeAllSessionsConfirm in EN/TR/ES (found $EN_REVOKE_SESSIONS_CONFIRM/3)"; fi
# 50
EN_REVOKE_SESSIONS_SUCCESS=$(grep -c '"passkeys.revokeAllSessionsSuccess"' "$I18N" 2>/dev/null || echo 0)
if [ "$EN_REVOKE_SESSIONS_SUCCESS" -ge 3 ]; then pass "6.6 passkeys.revokeAllSessionsSuccess in EN/TR/ES"; else fail "6.6 passkeys.revokeAllSessionsSuccess in EN/TR/ES (found $EN_REVOKE_SESSIONS_SUCCESS/3)"; fi

echo ""

# ════════════════════════════════════════════════
# SECTION 7: Documentation
# ════════════════════════════════════════════════
echo "── 7. Documentation ──"

DOC="$ROOT/docs/STEP_11_26_WEBAUTHN_HARDENING.md"

# 51
if [ -f "$DOC" ]; then pass "7.1 Docs file exists"; else fail "7.1 Docs file exists"; fi
# 52
check_grep "7.2 DB-backed challenge section" "DB-backed|challenge store" "$DOC"
# 53
check_grep "7.3 Preflight section" "preflight|WEBAUTHN_RP_ID" "$DOC"
# 54
check_grep "7.4 Lifecycle section" "Lifecycle|revoke all" "$DOC"
# 55
check_grep "7.5 Security notes" "single-use|Single-use" "$DOC"

echo ""

# ════════════════════════════════════════════════
# SECTION 8: Smoke tests (API)
# ════════════════════════════════════════════════
echo "── 8. Smoke tests ──"

API_URL="${API_URL:-http://localhost:4000}"

# 56: Portal revoke-all without auth should return 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/webauthn/credentials/revoke-all" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then pass "8.1 Portal revoke-all unauthenticated → 401"; else fail "8.1 Portal revoke-all unauthenticated → 401 (got $HTTP_CODE)"; fi

# 57: Admin revoke-all without auth should return 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/admin/webauthn/credentials/revoke-all" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then pass "8.2 Admin revoke-all unauthenticated → 401"; else fail "8.2 Admin revoke-all unauthenticated → 401 (got $HTTP_CODE)"; fi

# 58: Portal sessions revoke-all without auth should return 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/webauthn/sessions/revoke-all" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then pass "8.3 Portal sessions revoke-all unauthenticated → 401"; else fail "8.3 Portal sessions revoke-all unauthenticated → 401 (got $HTTP_CODE)"; fi

# 59: Admin sessions revoke-all without auth should return 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/admin/webauthn/sessions/revoke-all" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then pass "8.4 Admin sessions revoke-all unauthenticated → 401"; else fail "8.4 Admin sessions revoke-all unauthenticated → 401 (got $HTTP_CODE)"; fi

# 60: Portal register options without auth should return 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/webauthn/register/options" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then pass "8.5 Portal register options unauthenticated → 401"; else fail "8.5 Portal register options unauthenticated → 401 (got $HTTP_CODE)"; fi

# 61: Admin register options without auth should return 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/admin/webauthn/register/options" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then pass "8.6 Admin register options unauthenticated → 401"; else fail "8.6 Admin register options unauthenticated → 401 (got $HTTP_CODE)"; fi

# 62: Portal login options with invalid body should return 400
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/webauthn/login/options" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "400" ]; then pass "8.7 Portal login options missing email → 400"; else fail "8.7 Portal login options missing email → 400 (got $HTTP_CODE)"; fi

# 63: Admin login options with invalid body should return 400
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/admin/webauthn/login/options" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "400" ]; then pass "8.8 Admin login options missing email → 400"; else fail "8.8 Admin login options missing email → 400 (got $HTTP_CODE)"; fi

# 64: Portal login verify with invalid body should return 400
HTTP_CODE=$(curl_with_retry "$API_URL/portal/webauthn/login/verify" "POST" '{}')
if [ "$HTTP_CODE" = "400" ]; then pass "8.9 Portal login verify invalid → 400"; else fail "8.9 Portal login verify invalid → 400 (got $HTTP_CODE)"; fi

# 65: Admin login verify with invalid body should return 400
HTTP_CODE=$(curl_with_retry "$API_URL/admin/webauthn/login/verify" "POST" '{}')
if [ "$HTTP_CODE" = "400" ]; then pass "8.10 Admin login verify invalid → 400"; else fail "8.10 Admin login verify invalid → 400 (got $HTTP_CODE)"; fi

echo ""

# ════════════════════════════════════════════════
# SECTION 9: Code quality / safety
# ════════════════════════════════════════════════
echo "── 9. Code quality ──"

# 66: No in-memory challenge map (should be removed)
check_grep_not "9.1 No in-memory challenges Map remaining" "const challenges = new Map" "$WEBAUTHN_UTIL"
# 67: No setInterval for cleanup
check_grep_not "9.2 No setInterval for challenge cleanup" "setInterval.*cleanupChallenges" "$WEBAUTHN_UTIL"
# 68: requestId included in revoke audit
check_grep "9.3 requestId in revoke-all audit" "requestId" "$ROUTES"

echo ""

# ════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════
echo "════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Total: $TOTAL checks | PASS: $PASS | FAIL: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ VERIFY_STEP_11_26: ALL PASS"
  exit 0
else
  echo "  ❌ VERIFY_STEP_11_26: $FAIL FAILURE(S)"
  exit 1
fi
