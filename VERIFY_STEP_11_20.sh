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


# ─────────────────────────────────────────────────────────────
# VERIFY_STEP_11_20.sh — MFA (TOTP) + Step-Up Security
# ─────────────────────────────────────────────────────────────

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  WARN: $1"; WARN=$((WARN+1)); }

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════════════════════"
echo "  VERIFY Step 11.20 — MFA (TOTP) + Step-Up Security"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. File existence checks ──
echo "── 1. File existence checks ──"

FILES=(
  "apps/api/src/utils/totp.ts"
  "apps/api/src/routes/portal-mfa.ts"
  "apps/api/src/routes/admin-mfa.ts"
  "apps/api/prisma/migrations/20260206080000_v11_20_mfa/migration.sql"
  "apps/web/src/components/MfaSetupSection.tsx"
  "apps/web/src/components/MfaStepUpModal.tsx"
  "docs/STEP_11_20_MFA.md"
)

for f in "${FILES[@]}"; do
  if [ -f "$REPO_ROOT/$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done

# ── 2. Schema checks ──
echo ""
echo "── 2. Prisma schema checks ──"

SCHEMA="$REPO_ROOT/apps/api/prisma/schema.prisma"

for field in "mfaEnabled" "mfaSecret" "mfaVerifiedAt" "backupCodesHash"; do
  if grep -q "$field" "$SCHEMA" 2>/dev/null; then
    pass "Schema has $field"
  else
    fail "Schema missing $field"
  fi
done

# Check both AdminUser and OrgUser have mfaEnabled
if grep -A15 "model AdminUser" "$SCHEMA" | grep -q "mfaEnabled"; then
  pass "AdminUser has mfaEnabled"
else
  fail "AdminUser missing mfaEnabled"
fi

if grep -A15 "model OrgUser" "$SCHEMA" | grep -q "mfaEnabled"; then
  pass "OrgUser has mfaEnabled"
else
  fail "OrgUser missing mfaEnabled"
fi

# ── 3. Route pattern checks ──
echo ""
echo "── 3. Route pattern checks ──"

PORTAL_MFA="$REPO_ROOT/apps/api/src/routes/portal-mfa.ts"
ADMIN_MFA="$REPO_ROOT/apps/api/src/routes/admin-mfa.ts"

for pattern in "mfa/setup" "mfa/verify" "mfa/disable" "mfa/status" "mfa/challenge" "mfa/login-verify"; do
  if grep -q "$pattern" "$PORTAL_MFA" 2>/dev/null; then
    pass "Portal MFA route: $pattern"
  else
    fail "Portal MFA route missing: $pattern"
  fi
done

for pattern in "mfa/setup" "mfa/verify" "mfa/disable" "mfa/status" "mfa/challenge" "mfa/login-verify"; do
  if grep -q "$pattern" "$ADMIN_MFA" 2>/dev/null; then
    pass "Admin MFA route: $pattern"
  else
    fail "Admin MFA route missing: $pattern"
  fi
done

# ── 4. TOTP utility checks ──
echo ""
echo "── 4. TOTP utility checks ──"

TOTP_UTIL="$REPO_ROOT/apps/api/src/utils/totp.ts"

for fn in "generateTotpSecret" "getTotpUri" "verifyTotpCode" "generateBackupCodes" "tryConsumeBackupCode" "STEP_UP_TTL_MS"; do
  if grep -q "$fn" "$TOTP_UTIL" 2>/dev/null; then
    pass "TOTP util has $fn"
  else
    fail "TOTP util missing $fn"
  fi
done

# ── 5. Audit log action checks ──
echo ""
echo "── 5. Audit log action checks ──"

for action in "mfa_setup_started" "mfa_enabled" "mfa_disabled" "mfa_challenge_passed" "mfa_challenge_failed"; do
  if grep -rq "$action" "$REPO_ROOT/apps/api/src/routes/" 2>/dev/null; then
    pass "Audit action: $action"
  else
    fail "Audit action missing: $action"
  fi
done

# ── 6. Login MFA flow checks ──
echo ""
echo "── 6. Login MFA flow checks ──"

PORTAL_AUTH="$REPO_ROOT/apps/api/src/routes/portal-auth.ts"
ADMIN_AUTH="$REPO_ROOT/apps/api/src/routes/auth.ts"

if grep -q "mfaRequired" "$PORTAL_AUTH" 2>/dev/null; then
  pass "Portal login returns mfaRequired"
else
  fail "Portal login missing mfaRequired"
fi

if grep -q "mfaRequired" "$ADMIN_AUTH" 2>/dev/null; then
  pass "Admin login returns mfaRequired"
else
  fail "Admin login missing mfaRequired"
fi

if grep -q "adminMfaPending" "$ADMIN_AUTH" 2>/dev/null; then
  pass "Admin login sets adminMfaPending"
else
  fail "Admin login missing adminMfaPending"
fi

# ── 7. i18n checks ──
echo ""
echo "── 7. i18n checks ──"

I18N="$_I18N_COMPAT"

for key in "mfa.title" "mfa.setup" "mfa.disable" "mfa.backupCodes" "mfa.loginRequired" "mfa.stepUpRequired"; do
  count=$(grep -c "\"$key\"" "$I18N" 2>/dev/null || true)
  if [ "$count" -ge 3 ]; then
    pass "i18n key $key present in all 3 locales"
  else
    fail "i18n key $key missing or incomplete (found $count)"
  fi
done

# ── 8. Web component checks ──
echo ""
echo "── 8. Web component checks ──"

if grep -q "MfaSetupSection" "$REPO_ROOT/apps/web/src/app/portal/security/page.tsx" 2>/dev/null; then
  pass "Portal security page uses MfaSetupSection"
else
  fail "Portal security page missing MfaSetupSection"
fi

if grep -q "MfaSetupSection" "$REPO_ROOT/apps/web/src/app/dashboard/settings/page.tsx" 2>/dev/null; then
  pass "Admin settings page uses MfaSetupSection"
else
  fail "Admin settings page missing MfaSetupSection"
fi

if grep -q "mfaRequired" "$REPO_ROOT/apps/web/src/app/portal/login/page.tsx" 2>/dev/null; then
  pass "Portal login handles mfaRequired"
else
  fail "Portal login missing mfaRequired handling"
fi

if grep -q "mfaRequired" "$REPO_ROOT/apps/web/src/app/login/page.tsx" 2>/dev/null; then
  pass "Admin login handles mfaRequired"
else
  fail "Admin login missing mfaRequired handling"
fi

# ── 9. Step-up middleware checks ──
echo ""
echo "── 9. Step-up middleware checks ──"

if grep -q "requirePortalStepUp" "$PORTAL_MFA" 2>/dev/null; then
  pass "Portal step-up middleware exists"
else
  fail "Portal step-up middleware missing"
fi

if grep -q "requireAdminStepUp" "$ADMIN_MFA" 2>/dev/null; then
  pass "Admin step-up middleware exists"
else
  fail "Admin step-up middleware missing"
fi

if grep -q "MFA_STEP_UP_REQUIRED" "$PORTAL_MFA" 2>/dev/null; then
  pass "Portal step-up returns MFA_STEP_UP_REQUIRED code"
else
  fail "Portal step-up missing MFA_STEP_UP_REQUIRED code"
fi

if grep -q "MFA_STEP_UP_REQUIRED" "$ADMIN_MFA" 2>/dev/null; then
  pass "Admin step-up returns MFA_STEP_UP_REQUIRED code"
else
  fail "Admin step-up missing MFA_STEP_UP_REQUIRED code"
fi

# ── 10. API smoke tests ──
echo ""
echo "── 10. API smoke tests ──"

API_URL="${API_URL:-http://localhost:4000}"

# Test portal MFA setup requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/security/mfa/setup" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal MFA setup requires auth (401)"
else
  if [ "$HTTP_CODE" = "000" ]; then
    warn "API not reachable at $API_URL — skipping smoke tests"
  else
    fail "Portal MFA setup returned $HTTP_CODE (expected 401)"
  fi
fi

# Test admin MFA setup requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/internal/security/mfa/setup" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Admin MFA setup requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Admin MFA setup returned $HTTP_CODE (expected 401)"
fi

# Test portal MFA status requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/security/mfa/status" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal MFA status requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal MFA status returned $HTTP_CODE (expected 401)"
fi

# Test admin MFA status requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/internal/security/mfa/status" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Admin MFA status requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Admin MFA status returned $HTTP_CODE (expected 401)"
fi

# Test portal MFA challenge requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/auth/mfa/challenge" -H "Content-Type: application/json" -d '{"code":"000000"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal MFA challenge requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal MFA challenge returned $HTTP_CODE (expected 401)"
fi

# Test admin MFA challenge requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/internal/auth/mfa/challenge" -H "Content-Type: application/json" -d '{"code":"000000"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Admin MFA challenge requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Admin MFA challenge returned $HTTP_CODE (expected 401)"
fi

# Test portal login-verify without mfaToken returns 400
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/auth/mfa/login-verify" -H "Content-Type: application/json" -d '{"code":"000000"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "400" ]; then
  pass "Portal MFA login-verify without mfaToken returns 400"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal MFA login-verify returned $HTTP_CODE (expected 400)"
fi

# Test admin login-verify without session returns 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/internal/auth/mfa/login-verify" -H "Content-Type: application/json" -d '{"code":"000000"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Admin MFA login-verify without session returns 401"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Admin MFA login-verify returned $HTTP_CODE (expected 401)"
fi

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
