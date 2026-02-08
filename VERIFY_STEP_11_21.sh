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
# VERIFY_STEP_11_21.sh — MFA Policy + Devices + Step-Up
# ─────────────────────────────────────────────────────────────

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  WARN: $1"; WARN=$((WARN+1)); }

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════════════════════"
echo "  VERIFY Step 11.21 — MFA Policy + Devices"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. File existence ──
echo "── 1. File existence checks ──"

FILES=(
  "apps/api/src/utils/device.ts"
  "apps/api/src/routes/device-routes.ts"
  "apps/api/prisma/migrations/20260206090000_v11_21_devices/migration.sql"
  "apps/web/src/components/DeviceList.tsx"
  "apps/web/src/components/MfaPolicyBanner.tsx"
  "apps/web/src/app/dashboard/security/devices/page.tsx"
  "apps/web/src/app/portal/security/devices/page.tsx"
  "docs/STEP_11_21_MFA_POLICY_DEVICES.md"
)

for f in "${FILES[@]}"; do
  if [ -f "$REPO_ROOT/$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done

# ── 2. Prisma schema checks ──
echo ""
echo "── 2. Prisma schema checks ──"

SCHEMA="$REPO_ROOT/apps/api/prisma/schema.prisma"

for field in "TrustedDevice" "userAgentHash" "trusted" "userAgentRaw" "userType"; do
  if grep -q "$field" "$SCHEMA" 2>/dev/null; then
    pass "Schema has $field"
  else
    fail "Schema missing $field"
  fi
done

# ── 3. Route pattern checks ──
echo ""
echo "── 3. Route pattern checks ──"

DEVICE_ROUTES="$REPO_ROOT/apps/api/src/routes/device-routes.ts"

for pattern in "/internal/security/devices" "/portal/security/devices" "trust" "label" "mfa-policy"; do
  if grep -q "$pattern" "$DEVICE_ROUTES" 2>/dev/null; then
    pass "Device route: $pattern"
  else
    fail "Device route missing: $pattern"
  fi
done

# ── 4. Device utility checks ──
echo ""
echo "── 4. Device utility checks ──"

DEVICE_UTIL="$REPO_ROOT/apps/api/src/utils/device.ts"

for fn in "hashUserAgent" "upsertDevice" "isAdminMfaRequired" "isPortalMfaRecommended"; do
  if grep -q "$fn" "$DEVICE_UTIL" 2>/dev/null; then
    pass "Device util: $fn"
  else
    fail "Device util missing: $fn"
  fi
done

# ── 5. Audit log action checks ──
echo ""
echo "── 5. Audit log action checks ──"

for action in "device_trusted" "device_untrusted" "device_renamed" "device_removed"; do
  if grep -rq "$action" "$REPO_ROOT/apps/api/src/routes/" 2>/dev/null; then
    pass "Audit action: $action"
  else
    fail "Audit action missing: $action"
  fi
done

# ── 6. i18n checks ──
echo ""
echo "── 6. i18n checks ──"

I18N="$_I18N_COMPAT"

for key in "mfaPolicy.adminRequired" "mfaPolicy.portalRecommended" "devices.title" "devices.trust" "devices.remove"; do
  count=$(grep -c "\"$key\"" "$I18N" 2>/dev/null || true)
  if [ "$count" -ge 3 ]; then
    pass "i18n key $key present in all 3 locales"
  else
    fail "i18n key $key missing or incomplete (found $count)"
  fi
done

# ── 7. Web component checks ──
echo ""
echo "── 7. Web component checks ──"

if grep -q "MfaPolicyBanner" "$REPO_ROOT/apps/web/src/app/dashboard/page.tsx" 2>/dev/null; then
  pass "Admin dashboard uses MfaPolicyBanner"
else
  fail "Admin dashboard missing MfaPolicyBanner"
fi

if grep -q "MfaPolicyBanner" "$REPO_ROOT/apps/web/src/app/portal/page.tsx" 2>/dev/null; then
  pass "Portal overview uses MfaPolicyBanner"
else
  fail "Portal overview missing MfaPolicyBanner"
fi

if grep -q "DeviceList" "$REPO_ROOT/apps/web/src/app/dashboard/security/devices/page.tsx" 2>/dev/null; then
  pass "Admin devices page uses DeviceList"
else
  fail "Admin devices page missing DeviceList"
fi

if grep -q "DeviceList" "$REPO_ROOT/apps/web/src/app/portal/security/devices/page.tsx" 2>/dev/null; then
  pass "Portal devices page uses DeviceList"
else
  fail "Portal devices page missing DeviceList"
fi

# ── 8. Login device upsert checks ──
echo ""
echo "── 8. Login device upsert checks ──"

if grep -q "upsertDevice" "$REPO_ROOT/apps/api/src/routes/portal-auth.ts" 2>/dev/null; then
  pass "Portal login upserts device"
else
  fail "Portal login missing device upsert"
fi

if grep -q "upsertDevice" "$REPO_ROOT/apps/api/src/routes/auth.ts" 2>/dev/null; then
  pass "Admin login upserts device"
else
  fail "Admin login missing device upsert"
fi

if grep -q "upsertDevice" "$REPO_ROOT/apps/api/src/routes/portal-mfa.ts" 2>/dev/null; then
  pass "Portal MFA login-verify upserts device"
else
  fail "Portal MFA login-verify missing device upsert"
fi

if grep -q "upsertDevice" "$REPO_ROOT/apps/api/src/routes/admin-mfa.ts" 2>/dev/null; then
  pass "Admin MFA login-verify upserts device"
else
  fail "Admin MFA login-verify missing device upsert"
fi

# ── 9. API smoke tests ──
echo ""
echo "── 9. API smoke tests ──"

API_URL="${API_URL:-http://localhost:4000}"

# Admin devices requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/internal/security/devices" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Admin devices requires auth (401)"
elif [ "$HTTP_CODE" = "000" ]; then
  warn "API not reachable at $API_URL — skipping smoke tests"
else
  fail "Admin devices returned $HTTP_CODE (expected 401)"
fi

# Portal devices requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/security/devices" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal devices requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal devices returned $HTTP_CODE (expected 401)"
fi

# Admin MFA policy requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/internal/security/mfa-policy" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Admin MFA policy requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Admin MFA policy returned $HTTP_CODE (expected 401)"
fi

# Portal MFA policy requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/security/mfa-policy" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal MFA policy requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal MFA policy returned $HTTP_CODE (expected 401)"
fi

# Admin device trust requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$API_URL/internal/security/devices/test/trust" -H "Content-Type: application/json" -d '{"trusted":true}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Admin device trust requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Admin device trust returned $HTTP_CODE (expected 401)"
fi

# Portal device remove requires auth (401)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_URL/portal/security/devices/test" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then
  pass "Portal device remove requires auth (401)"
elif [ "$HTTP_CODE" != "000" ]; then
  fail "Portal device remove returned $HTTP_CODE (expected 401)"
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
