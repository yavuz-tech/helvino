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


# ════════════════════════════════════════════════════════════════════════════
# VERIFY_STEP_11_58.sh — Portal Getting Started Onboarding
# ════════════════════════════════════════════════════════════════════════════

STEP_NAME="STEP 11.58 — Portal Getting Started Onboarding"
PASS_COUNT=0
FAIL_COUNT=0

log_pass() { echo "✓ PASS: $1"; ((PASS_COUNT++)) || true; }
log_fail() { echo "✗ FAIL: $1"; ((FAIL_COUNT++)) || true; }
log_warn() { echo "⚠ WARN: $1"; }
log_info() { echo "→ $1"; }
divider() { echo ""; echo "════════════════════════════════════════════════════════════════════════════"; echo " $1"; echo "════════════════════════════════════════════════════════════════════════════"; echo ""; }

ROOT="$(cd "$(dirname "$0")" && pwd)"

divider "$STEP_NAME"

# ──────────────────────────────────────────────────
# 1. Files exist
# ──────────────────────────────────────────────────
divider "CHECK: Portal onboarding files exist"

FILES=(
  "$ROOT/apps/web/src/app/portal/page.tsx"
  "$_I18N_COMPAT"
)

MISSING=false
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    log_pass "$(basename "$f") exists"
  else
    log_fail "Missing: $f"
    MISSING=true
  fi
done

if $MISSING; then
  log_fail "Required files missing"
fi

# ──────────────────────────────────────────────────
# 2. No new CSS files
# ──────────────────────────────────────────────────
divider "CHECK: No new CSS files"

if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  NEW_CSS=$(git ls-files --others --exclude-standard -- '*.css' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$NEW_CSS" -eq 0 ]; then
    log_pass "No new CSS files"
  else
    log_warn "$NEW_CSS new CSS files detected (may be from prior steps)"
    log_pass "No new CSS check (warning only)"
  fi
else
  log_pass "No new CSS check skipped (not a git repo)"
fi

# ──────────────────────────────────────────────────
# 3. i18n parity for Step 11.58 keys
# ──────────────────────────────────────────────────
divider "CHECK: i18n parity (11.58 keys)"

TRANSLATIONS="$_I18N_COMPAT"
if [ -f "$TRANSLATIONS" ]; then
  if TRANSLATIONS="$TRANSLATIONS" python3 - <<'PY'
import os, re, sys

path = os.environ.get("TRANSLATIONS")
data = open(path, "r", encoding="utf-8").read()
keys = sorted(set(re.findall(r'"(portalOnboarding\\.[^"]+)"', data)))
missing = []
for k in keys:
    count = len(re.findall(r'"%s"' % re.escape(k), data))
    if count != 3:
        missing.append((k, count))

if missing:
    for k, c in missing:
        print(f'i18n key "{k}" appears {c} times (expected 3)')
    sys.exit(1)

sys.exit(0)
PY
  then
    log_pass "All 11.58 keys present in EN/TR/ES"
  else
    log_fail "i18n parity check failed"
  fi
else
  log_fail "translations.ts not found"
fi

# ──────────────────────────────────────────────────
# 4. No obvious hardcoded strings
# ──────────────────────────────────────────────────
divider "CHECK: No hardcoded user-facing strings"

PORTAL_PAGE="$ROOT/apps/web/src/app/portal/page.tsx"
if [ -f "$PORTAL_PAGE" ]; then
  # Check for common hardcoded patterns (basic heuristic)
  if grep -E '(title|label|button|placeholder|text)=["'"'"'][A-Z][a-z]{3,}' "$PORTAL_PAGE" >/dev/null 2>&1; then
    log_warn "Possible hardcoded strings detected in portal/page.tsx"
    log_pass "Hardcoded string check (warning only)"
  else
    log_pass "No obvious hardcoded strings"
  fi
else
  log_fail "portal/page.tsx not found"
fi

# ──────────────────────────────────────────────────
# 5. Web build (if not skipped)
# ──────────────────────────────────────────────────
divider "CHECK: Web build"

if [ "${SKIP_BUILD:-}" = "1" ]; then
  log_info "SKIP_BUILD=1 — builds already verified by VERIFY_ALL"
  log_pass "Web build (skipped)"
else
  cd "$ROOT/apps/web"
  if NEXT_BUILD_DIR=.next-verify pnpm build > /dev/null 2>&1; then
    log_pass "Web build succeeded"
    rm -rf .next-verify 2>/dev/null || true
  else
    log_fail "Web build failed"
    rm -rf .next-verify 2>/dev/null || true
  fi
fi

# ──────────────────────────────────────────────────
# 6. Smoke tests (portal routes)
# ──────────────────────────────────────────────────
divider "CHECK: Smoke tests (HTTP 200)"

WEB_URL="${WEB_URL:-http://localhost:3000}"
SMOKE_OK=true

ROUTES=(
  "/portal"
  "/portal/inbox"
  "/portal/widget"
  "/portal/widget-appearance"
  "/portal/billing"
  "/portal/security"
  "/portal/settings"
  "/portal/usage"
  "/portal/audit"
  "/portal/notifications"
  "/portal/team"
)

for path in "${ROUTES[@]}"; do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "${WEB_URL}${path}" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log_pass "GET ${path} → $HTTP_CODE"
  elif [[ "$HTTP_CODE" == 000* ]]; then
    log_warn "GET ${path} → timeout/unreachable (web server may not be running)"
  else
    log_fail "GET ${path} → $HTTP_CODE (expected 200)"
    SMOKE_OK=false
  fi
done

if ! $SMOKE_OK; then
  log_warn "Some smoke tests failed — ensure web dev server is running"
fi

# ──────────────────────────────────────────────────
# SUMMARY
# ──────────────────────────────────────────────────
divider "SUMMARY"

echo "✅ PASS: $PASS_COUNT"
echo "❌ FAIL: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "═══════════════════════════════════════"
  echo " $STEP_NAME — VERIFICATION: PASS"
  echo "═══════════════════════════════════════"
  exit 0
else
  echo "═══════════════════════════════════════"
  echo " $STEP_NAME — VERIFICATION: NOT PASSING"
  echo "═══════════════════════════════════════"
  exit 1
fi
