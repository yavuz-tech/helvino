#!/usr/bin/env bash
set -uo pipefail

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

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
echo "  VERIFY Step 11.24 — Account Recovery"
echo "========================================="
echo ""

# ── 1. Schema Checks ──
echo "── Schema ──"
check_file "Prisma schema exists" "$API/prisma/schema.prisma"
check_grep "AccountRecoveryRequest model" "model AccountRecoveryRequest" "$API/prisma/schema.prisma"
check_grep "EmergencyAccessToken model" "model EmergencyAccessToken" "$API/prisma/schema.prisma"
check_grep "Recovery status field" 'pending.*approved.*rejected.*expired' "$API/prisma/schema.prisma"
check_grep "Emergency tokenHash field" "tokenHash.*@unique" "$API/prisma/schema.prisma"
check_grep "Emergency cooldownUntil field" "cooldownUntil" "$API/prisma/schema.prisma"

# ── 2. Migration ──
echo ""
echo "── Migration ──"
check_file "v11.24 migration SQL" "$API/prisma/migrations/20260206100000_v11_24_recovery/migration.sql"
check_grep "Migration creates account_recovery_requests" "account_recovery_requests" "$API/prisma/migrations/20260206100000_v11_24_recovery/migration.sql"
check_grep "Migration creates emergency_access_tokens" "emergency_access_tokens" "$API/prisma/migrations/20260206100000_v11_24_recovery/migration.sql"

# ── 3. API Route File ──
echo ""
echo "── API Routes ──"
check_file "recovery-routes.ts exists" "$API/src/routes/recovery-routes.ts"
check_grep "Portal recovery request route" "/portal/recovery/request" "$API/src/routes/recovery-routes.ts"
check_grep "Admin recovery request route" "/admin/recovery/request" "$API/src/routes/recovery-routes.ts"
check_grep "Internal recovery list route" "/internal/recovery/requests" "$API/src/routes/recovery-routes.ts"
check_grep "Internal approve route" "/internal/recovery/:id/approve" "$API/src/routes/recovery-routes.ts"
check_grep "Internal reject route" "/internal/recovery/:id/reject" "$API/src/routes/recovery-routes.ts"
check_grep "Emergency generate route" "/portal/emergency/generate" "$API/src/routes/recovery-routes.ts"
check_grep "Emergency use route" "/portal/emergency/use" "$API/src/routes/recovery-routes.ts"
check_grep "MFA lockout check portal" "/portal/auth/mfa-lockout-check" "$API/src/routes/recovery-routes.ts"
check_grep "MFA lockout check admin" "/internal/auth/mfa-lockout-check" "$API/src/routes/recovery-routes.ts"

# ── 4. Security Checks ──
echo ""
echo "── Security ──"
check_grep "Rate limiting on recovery" "createRateLimitMiddleware" "$API/src/routes/recovery-routes.ts"
check_grep "requireAdmin on internal routes" "requireAdmin" "$API/src/routes/recovery-routes.ts"
check_grep "requireStepUp on approve" "requireStepUp.*admin" "$API/src/routes/recovery-routes.ts"
check_grep "requirePortalUser on emergency generate" "requirePortalUser" "$API/src/routes/recovery-routes.ts"
check_grep "Token hashing" "createHash.*sha256" "$API/src/routes/recovery-routes.ts"
check_grep "IP logging" "request.ip" "$API/src/routes/recovery-routes.ts"
check_grep "Audit logging in recovery" "writeAuditLog" "$API/src/routes/recovery-routes.ts"
check_grep "Recovery rate limit 3/day" "RECOVERY_RATE_LIMIT_PER_DAY" "$API/src/routes/recovery-routes.ts"
check_grep "Emergency 10-minute expiry" "10.*60.*1000" "$API/src/routes/recovery-routes.ts"
check_grep "30-day cooldown" "COOLDOWN_DAYS = 30" "$API/src/routes/recovery-routes.ts"

# ── 5. MFA Lockout Detection ──
echo ""
echo "── MFA Lockout ──"
check_grep "isMfaLockedOut function" "isMfaLockedOut" "$API/src/routes/recovery-routes.ts"
check_grep "Checks mfaEnabled" "mfaEnabled" "$API/src/routes/recovery-routes.ts"
check_grep "Checks backup codes" "backupCodesHash" "$API/src/routes/recovery-routes.ts"
check_grep "Checks trusted devices" "trustedDevice" "$API/src/routes/recovery-routes.ts"

# ── 6. Route Registration ──
echo ""
echo "── Route Registration ──"
check_grep "recoveryRoutes imported" "recoveryRoutes" "$API/src/index.ts"
check_grep "recoveryRoutes registered" "fastify.register.*recoveryRoutes" "$API/src/index.ts"

# ── 7. UI Pages ──
echo ""
echo "── UI Pages ──"
check_file "Portal recovery page" "$WEB/src/app/portal/recovery/page.tsx"
check_file "Admin recovery page" "$WEB/src/app/dashboard/recovery/page.tsx"
check_grep "Portal recovery uses i18n" 'recovery\.title' "$WEB/src/app/portal/recovery/page.tsx"
check_grep "Admin recovery uses i18n" 'recovery\.admin' "$WEB/src/app/dashboard/recovery/page.tsx"
check_grep "Emergency token section in portal security" "EmergencyTokenSection" "$WEB/src/app/portal/security/page.tsx"
check_grep "Admin recovery nav link" "nav.recovery" "$WEB/src/components/DashboardLayout.tsx"

# ── 8. i18n Keys ──
echo ""
echo "── i18n Keys ──"
check_grep "EN recovery.title" '"recovery.title"' "$WEB/src/i18n/translations.ts"
check_grep "EN emergency.title" '"emergency.title"' "$WEB/src/i18n/translations.ts"
check_grep "TR recovery.title" '"recovery.title":.*Hesap Kurtarma' "$WEB/src/i18n/translations.ts"
check_grep "ES recovery.title" '"recovery.title":.*Recuperación' "$WEB/src/i18n/translations.ts"
check_grep "EN nav.recovery" '"nav.recovery"' "$WEB/src/i18n/translations.ts"

# ── 9. Documentation ──
echo ""
echo "── Documentation ──"
check_file "Step 11.24 docs" "$ROOT/docs/STEP_11_24_RECOVERY.md"
check_grep "Docs mention Account Recovery" "Account Recovery" "$ROOT/docs/STEP_11_24_RECOVERY.md"
check_grep "Docs mention Emergency Access" "Emergency Access" "$ROOT/docs/STEP_11_24_RECOVERY.md"
check_grep "Docs mention MFA Lockout" "MFA Lockout" "$ROOT/docs/STEP_11_24_RECOVERY.md"

# ── 10. Smoke Tests (if API running) ──
echo ""
echo "── Smoke Tests ──"

if curl -sf "$API_URL/health" > /dev/null 2>&1; then
  # Recovery request without body -> 400 (or 429 if rate limited)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/recovery/request" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "400" ] || [ "$STATUS" = "429" ]; then
    echo "  [PASS] Portal recovery without body -> $STATUS"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Portal recovery without body -> expected 400|429, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Admin recovery request without body -> 400 (or 429 if rate limited)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/admin/recovery/request" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "400" ] || [ "$STATUS" = "429" ]; then
    echo "  [PASS] Admin recovery without body -> $STATUS"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Admin recovery without body -> expected 400|429, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Internal recovery requests without auth -> 401
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/internal/recovery/requests")
  if [ "$STATUS" = "401" ]; then
    echo "  [PASS] Internal recovery list -> 401 (no auth)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Internal recovery list -> expected 401, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Emergency generate without auth -> 401
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/emergency/generate" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "401" ]; then
    echo "  [PASS] Emergency generate -> 401 (no auth)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Emergency generate -> expected 401, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Emergency use with invalid token -> 401 (or 429 if rate limited)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/emergency/use" -H "Content-Type: application/json" -d '{"token":"invalid-test-token"}')
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "429" ]; then
    echo "  [PASS] Emergency use invalid token -> $STATUS"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Emergency use invalid token -> expected 401|429, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # MFA lockout check -> 400 (no email)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/auth/mfa-lockout-check" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "400" ]; then
    echo "  [PASS] MFA lockout check no email -> 400"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] MFA lockout check no email -> expected 400, got $STATUS"
    FAIL=$((FAIL + 1))
  fi

  # Approve without auth -> 401
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/internal/recovery/test-id/approve" -H "Content-Type: application/json" -d '{}')
  if [ "$STATUS" = "401" ]; then
    echo "  [PASS] Recovery approve -> 401 (no auth)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Recovery approve -> expected 401, got $STATUS"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  [WARN] API not running at $API_URL — skipping smoke tests"
  WARN=$((WARN + 7))
fi

echo ""
echo "========================================="
echo "  Results: PASS=$PASS FAIL=$FAIL WARN=$WARN"
echo "========================================="

if [ "$FAIL" -gt 0 ]; then
  echo "  STEP 11.24 VERIFICATION: FAIL"
  exit 1
else
  echo "  STEP 11.24 VERIFICATION: PASS"
  exit 0
fi
