#!/usr/bin/env bash
set -uo pipefail


# i18n compat: use generated flat file instead of translations.ts
_COMPAT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -n "${I18N_COMPAT_FILE:-}" ] && [ -f "${I18N_COMPAT_FILE}" ]; then
  _I18N_COMPAT="$I18N_COMPAT_FILE"
elif [ -f "$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts" ]; then
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
else
  [ -f "$_COMPAT_DIR/scripts/gen-i18n-compat.js" ] && node "$_COMPAT_DIR/scripts/gen-i18n-compat.js" >/dev/null 2>&1 || true
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
fi


PASS=0
FAIL=0
WARN=0

check_grep() {
  local label="$1"
  local pattern="$2"
  local file="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

check_file() {
  local label="$1"
  local file="$2"
  if [ -f "$file" ]; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

ROOT="$(cd "$(dirname "$0")" && pwd)"
API="$ROOT/apps/api"
WEB="$ROOT/apps/web"
API_URL="${API_URL:-http://localhost:4000}"

echo "========================================="
echo "  VERIFY Step 11.25 — Passkeys (WebAuthn)"
echo "========================================="
echo ""

# ── 1. Schema ──
echo "── Schema ──"
check_file "Prisma schema exists" "$API/prisma/schema.prisma"
check_grep "WebAuthnCredential model" "model WebAuthnCredential" "$API/prisma/schema.prisma"
check_grep "credentialId unique" "credentialId.*@unique" "$API/prisma/schema.prisma"
check_grep "publicKey field" "publicKey.*Text" "$API/prisma/schema.prisma"
check_grep "counter field" "counter.*Int" "$API/prisma/schema.prisma"
check_grep "userType field in WebAuthn" 'userType.*admin.*portal' "$API/prisma/schema.prisma"
check_grep "nickname field" "nickname.*String" "$API/prisma/schema.prisma"
check_grep "lastUsedAt field" "lastUsedAt" "$API/prisma/schema.prisma"

# ── 2. Migration ──
echo ""
echo "── Migration ──"
check_file "v11.25 migration SQL" "$API/prisma/migrations/20260206120000_v11_25_webauthn/migration.sql"
check_grep "Migration creates webauthn_credentials" "webauthn_credentials" "$API/prisma/migrations/20260206120000_v11_25_webauthn/migration.sql"
check_grep "Migration unique index on credentialId" "webauthn_credentials_credentialId_key" "$API/prisma/migrations/20260206120000_v11_25_webauthn/migration.sql"

# ── 3. WebAuthn Utility ──
echo ""
echo "── WebAuthn Utility ──"
check_file "webauthn.ts utility" "$API/src/utils/webauthn.ts"
check_grep "generateRegistrationOptions function" "generateRegistrationOptions" "$API/src/utils/webauthn.ts"
check_grep "generateLoginOptions function" "generateLoginOptions" "$API/src/utils/webauthn.ts"
check_grep "verifyRegistration function" "verifyRegistration" "$API/src/utils/webauthn.ts"
check_grep "verifyAssertion function" "verifyAssertion" "$API/src/utils/webauthn.ts"
check_grep "Challenge management" "createChallenge" "$API/src/utils/webauthn.ts"
check_grep "consumeChallenge function" "consumeChallenge" "$API/src/utils/webauthn.ts"
check_grep "ES256 support" "ES256|alg.*-7" "$API/src/utils/webauthn.ts"
check_grep "RS256 support" "RS256|alg.*-257" "$API/src/utils/webauthn.ts"
check_grep "rpIdHash verification" "rpIdHash" "$API/src/utils/webauthn.ts"
check_grep "Counter anti-replay check" "counter.*increase|cloned" "$API/src/utils/webauthn.ts"

# ── 4. API Routes ──
echo ""
echo "── API Routes ──"
check_file "webauthn-routes.ts" "$API/src/routes/webauthn-routes.ts"
check_grep "Portal register options" "/portal/webauthn/register/options" "$API/src/routes/webauthn-routes.ts"
check_grep "Portal register verify" "/portal/webauthn/register/verify" "$API/src/routes/webauthn-routes.ts"
check_grep "Portal login options" "/portal/webauthn/login/options" "$API/src/routes/webauthn-routes.ts"
check_grep "Portal login verify" "/portal/webauthn/login/verify" "$API/src/routes/webauthn-routes.ts"
check_grep "Portal credentials list" "/portal/webauthn/credentials" "$API/src/routes/webauthn-routes.ts"
check_grep "Portal credentials revoke" "/portal/webauthn/credentials/:id/revoke" "$API/src/routes/webauthn-routes.ts"
check_grep "Admin register options" "/admin/webauthn/register/options" "$API/src/routes/webauthn-routes.ts"
check_grep "Admin register verify" "/admin/webauthn/register/verify" "$API/src/routes/webauthn-routes.ts"
check_grep "Admin login options" "/admin/webauthn/login/options" "$API/src/routes/webauthn-routes.ts"
check_grep "Admin login verify" "/admin/webauthn/login/verify" "$API/src/routes/webauthn-routes.ts"
check_grep "Admin credentials list" "/admin/webauthn/credentials" "$API/src/routes/webauthn-routes.ts"
check_grep "Admin credentials revoke" "/admin/webauthn/credentials/:id/revoke" "$API/src/routes/webauthn-routes.ts"

# ── 5. Security Patterns ──
echo ""
echo "── Security ──"
check_grep "requireStepUp on registration" "requireStepUp" "$API/src/routes/webauthn-routes.ts"
check_grep "requirePortalUser" "requirePortalUser" "$API/src/routes/webauthn-routes.ts"
check_grep "requireAdmin" "requireAdmin" "$API/src/routes/webauthn-routes.ts"
check_grep "Rate limiting" "createRateLimitMiddleware" "$API/src/routes/webauthn-routes.ts"
check_grep "Audit logging" "writeAuditLog" "$API/src/routes/webauthn-routes.ts"
check_grep "No MFA pending for passkey login" "mfaPending|skip TOTP|strong auth" "$API/src/routes/webauthn-routes.ts"
check_grep "User enumeration prevention" "dummy|dummyChallenge" "$API/src/routes/webauthn-routes.ts"

# ── 6. Route Registration ──
echo ""
echo "── Registration ──"
check_grep "webauthnRoutes imported" "webauthnRoutes" "$API/src/index.ts"
check_grep "webauthnRoutes registered" "fastify.register.*webauthnRoutes" "$API/src/index.ts"

# ── 7. UI Components ──
echo ""
echo "── UI Components ──"
check_file "PasskeySection component" "$WEB/src/components/PasskeySection.tsx"
check_file "PasskeyLoginButton component" "$WEB/src/components/PasskeyLoginButton.tsx"
check_grep "PasskeySection uses i18n" 'passkeys\.' "$WEB/src/components/PasskeySection.tsx"
check_grep "PasskeyLoginButton uses i18n" 'passkeys\.' "$WEB/src/components/PasskeyLoginButton.tsx"
check_grep "Portal security has PasskeySection" "PasskeySection" "$WEB/src/app/portal/security/page.tsx"
check_grep "Admin settings has PasskeySection" "PasskeySection" "$WEB/src/app/dashboard/settings/page.tsx"
check_grep "Portal login has PasskeyLoginButton" "PasskeyLoginButton" "$WEB/src/app/portal/login/page.tsx"
check_grep "Admin login has PasskeyLoginButton" "PasskeyLoginButton" "$WEB/src/app/login/page.tsx"

# ── 8. i18n Keys ──
echo ""
echo "── i18n Keys ──"
check_grep "EN passkeys.title" '"passkeys.title"' "$_I18N_COMPAT"
check_grep "EN passkeys.loginButton" '"passkeys.loginButton"' "$_I18N_COMPAT"
check_grep "TR passkeys.title" '"passkeys.title":.*Geçiş' "$_I18N_COMPAT"
check_grep "ES passkeys.title" '"passkeys.title":.*Claves' "$_I18N_COMPAT"
check_grep "EN passkeys.add" '"passkeys.add"' "$_I18N_COMPAT"

# ── 9. Documentation ──
echo ""
echo "── Documentation ──"
check_file "Step 11.25 docs" "$ROOT/docs/STEP_11_25_PASSKEYS.md"
check_grep "Docs mention WebAuthn" "WebAuthn" "$ROOT/docs/STEP_11_25_PASSKEYS.md"
check_grep "Docs mention Passkeys" "Passkey" "$ROOT/docs/STEP_11_25_PASSKEYS.md"

# ── 10. Smoke Tests ──
echo ""
echo "── Smoke Tests ──"

if curl -sf "$API_URL/health" > /dev/null 2>&1; then
  # Portal register options without auth -> 401
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/webauthn/register/options")
  if [ "$STATUS" = "401" ]; then
    echo "  [PASS] Portal register options -> 401 (no auth)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Portal register options -> expected 401, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Admin register options without auth -> 401
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/admin/webauthn/register/options")
  if [ "$STATUS" = "401" ]; then
    echo "  [PASS] Admin register options -> 401 (no auth)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Admin register options -> expected 401, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Portal login options without email -> 400
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/webauthn/login/options" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "400" ]; then
    echo "  [PASS] Portal login options no email -> 400"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Portal login options no email -> expected 400, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Admin login options without email -> 400
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/admin/webauthn/login/options" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "400" ]; then
    echo "  [PASS] Admin login options no email -> 400"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Admin login options no email -> expected 400, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Portal login verify with invalid data -> 400
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/webauthn/login/verify" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "400" ]; then
    echo "  [PASS] Portal login verify invalid -> 400"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Portal login verify invalid -> expected 400, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Admin login verify with invalid data -> 400
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/admin/webauthn/login/verify" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "400" ]; then
    echo "  [PASS] Admin login verify invalid -> 400"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Admin login verify invalid -> expected 400, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Portal credentials without auth -> 401
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/webauthn/credentials")
  if [ "$STATUS" = "401" ]; then
    echo "  [PASS] Portal credentials -> 401 (no auth)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Portal credentials -> expected 401, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Admin credentials without auth -> 401
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/admin/webauthn/credentials")
  if [ "$STATUS" = "401" ]; then
    echo "  [PASS] Admin credentials -> 401 (no auth)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Admin credentials -> expected 401, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

else
  echo "  [WARN] API not running at $API_URL — skipping smoke tests"
  WARN=$((WARN + 8))
fi

echo ""
echo "========================================="
echo "  Results: PASS=$PASS FAIL=$FAIL WARN=$WARN"
echo "========================================="

if [ "$FAIL" -gt 0 ]; then
  echo "  STEP 11.25 VERIFICATION: FAIL"
  exit 1
else
  echo "  STEP 11.25 VERIFICATION: PASS"
  exit 0
fi
