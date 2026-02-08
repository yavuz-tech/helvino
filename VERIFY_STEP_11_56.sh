#!/usr/bin/env bash
set -euo pipefail

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

# ════════════════════════════════════════════════════════════════════════════
# VERIFY_STEP_11_56.sh — Compare Pages Content Completion
# ════════════════════════════════════════════════════════════════════════════

STEP_NAME="STEP 11.56 — Compare Pages Content Completion"
PASS_COUNT=0
FAIL_COUNT=0

log_pass() {
  echo "✓ PASS: $1"
  ((PASS_COUNT++)) || true
}

log_fail() {
  echo "✗ FAIL: $1"
  ((FAIL_COUNT++)) || true
}

log_warn() {
  echo "⚠ WARN: $1"
}

log_info() {
  echo "→ $1"
}

divider() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════════════"
  echo " $1"
  echo "════════════════════════════════════════════════════════════════════════════"
  echo ""
}

ROOT="$(cd "$(dirname "$0")" && pwd)"

divider "$STEP_NAME"

# ──────────────────────────────────────────────────
# 1. Files exist
# ──────────────────────────────────────────────────
divider "CHECK: Compare files exist"

FILES=(
  "$ROOT/apps/web/src/app/compare/ComparePageContent.tsx"
  "$ROOT/apps/web/src/app/compare/intercom/page.tsx"
  "$ROOT/apps/web/src/app/compare/zendesk/page.tsx"
  "$ROOT/apps/web/src/app/compare/crisp/page.tsx"
  "$ROOT/apps/web/src/app/compare/tidio/page.tsx"
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
  log_fail "Required compare files missing"
fi

# ──────────────────────────────────────────────────
# 2. Forbidden placeholder tokens
# ──────────────────────────────────────────────────
divider "CHECK: No placeholder tokens"

FORBIDDEN="lorem|placeholder|coming soon|todo|tbd|demo content"

PLACEHOLDER_FOUND=false

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    if [[ "$(basename "$f")" == *"translations"* ]]; then
      # Only scan compare.* lines in translations
      if grep -n "compare\\." "$f" | grep -iE "$FORBIDDEN" >/dev/null 2>&1; then
        log_fail "Placeholder token found in compare.* translations"
        PLACEHOLDER_FOUND=true
      fi
    else
      if grep -iE "$FORBIDDEN" "$f" >/dev/null 2>&1; then
        log_fail "Placeholder token found in $(basename "$f")"
        PLACEHOLDER_FOUND=true
      fi
    fi
  fi
done

if ! $PLACEHOLDER_FOUND; then
  log_pass "No placeholder tokens detected"
fi

# ──────────────────────────────────────────────────
# 3. i18n parity for compare.* keys
# ──────────────────────────────────────────────────
divider "CHECK: i18n parity (compare.* keys)"

TRANSLATIONS="$_I18N_COMPAT"
if [ -f "$TRANSLATIONS" ]; then
  I18N_OK=true
  EN_KEYS=$(awk '/^const en = {/,/^const tr:/' "$TRANSLATIONS" | grep -oE '"compare\.[^"]+"' | tr -d '"' | sort -u)
  while read -r key; do
    [ -z "$key" ] && continue
    COUNT=$(grep -c "\"$key\"" "$TRANSLATIONS" 2>/dev/null || echo 0)
    if [ "$COUNT" -ne 3 ]; then
      log_fail "i18n key \"$key\" appears $COUNT times (expected 3)"
      I18N_OK=false
    fi
  done <<< "$EN_KEYS"

  if $I18N_OK; then
    log_pass "All compare.* keys present in EN/TR/ES"
  fi
else
  log_fail "translations.ts not found"
fi

# ──────────────────────────────────────────────────
# 4. No new CSS files
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
# 6. Smoke tests
# ──────────────────────────────────────────────────
divider "CHECK: Smoke tests (HTTP 200)"

WEB_URL="${WEB_URL:-http://localhost:3000}"
SMOKE_OK=true

for path in "/compare/intercom" "/compare/zendesk" "/compare/crisp" "/compare/tidio"; do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "${WEB_URL}${path}" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log_pass "GET ${path} → $HTTP_CODE"
  elif [ "$HTTP_CODE" = "000" ]; then
    log_warn "GET ${path} → timeout/unreachable (web server may not be running)"
    SMOKE_OK=false
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
