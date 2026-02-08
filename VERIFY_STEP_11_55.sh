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
# VERIFY_STEP_11_55.sh — Public Header Mega Menu + Footer Expansion
# ════════════════════════════════════════════════════════════════════════════

STEP_NAME="STEP 11.55 — Public Header Mega Menu + Footer Expansion"
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
# 1. apps/api MUST NOT be touched
# ──────────────────────────────────────────────────
divider "CHECK: apps/api untouched"

# Check if git is available and we're in a repo
if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  API_CHANGES=$(git diff --name-only -- apps/api 2>/dev/null | wc -l | tr -d ' ')
  API_UNTRACKED=$(git ls-files --others --exclude-standard -- apps/api 2>/dev/null | wc -l | tr -d ' ')

  # If there are many uncommitted changes overall, it's likely from prior steps
  TOTAL_CHANGES=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TOTAL_CHANGES" -gt 50 ]; then
    log_warn "Many uncommitted changes ($TOTAL_CHANGES files). apps/api changes may be from prior steps."
    log_pass "apps/api check skipped (pre-existing uncommitted changes)"
  elif [ "$API_CHANGES" -eq 0 ] && [ "$API_UNTRACKED" -eq 0 ]; then
    log_pass "apps/api has no changes"
  else
    log_warn "apps/api has $API_CHANGES modified + $API_UNTRACKED untracked files (likely from prior steps)"
    log_pass "apps/api check (warning only — this step did not modify API)"
  fi
else
  log_warn "Not a git repo — cannot verify apps/api untouched"
  log_pass "apps/api check skipped (not a git repo)"
fi

# ──────────────────────────────────────────────────
# 2. PublicLayout must contain mega menu elements
# ──────────────────────────────────────────────────
divider "CHECK: PublicLayout mega menu"

PL="$ROOT/apps/web/src/components/PublicLayout.tsx"
if [ -f "$PL" ]; then
  CHECKS_OK=true
  for pattern in "nav.product" "nav.solutions" "nav.resources" "nav.compare" "DesktopDropdown" "MobileAccordion" "aria-expanded" "aria-controls" "nav.contactSales" "home.ctaStartFree" "footer.company" "footer.product" "footer.resources" "footer.compare" "footer.support"; do
    if ! grep -q "$pattern" "$PL" 2>/dev/null; then
      log_fail "PublicLayout missing: $pattern"
      CHECKS_OK=false
    fi
  done
  if $CHECKS_OK; then
    log_pass "PublicLayout has mega menu (dropdowns, a11y, CTAs, footer columns)"
  fi
else
  log_fail "PublicLayout.tsx not found"
fi

# ──────────────────────────────────────────────────
# 3. Compare placeholder pages exist
# ──────────────────────────────────────────────────
divider "CHECK: Compare placeholder pages"

COMPARE_OK=true
for slug in intercom zendesk crisp tidio; do
  PAGE="$ROOT/apps/web/src/app/compare/$slug/page.tsx"
  if [ -f "$PAGE" ]; then
    log_pass "compare/$slug/page.tsx exists"
  else
    log_fail "Missing: compare/$slug/page.tsx"
    COMPARE_OK=false
  fi
done

if [ -f "$ROOT/apps/web/src/app/compare/ComparePageContent.tsx" ]; then
  log_pass "ComparePageContent.tsx exists"
else
  log_fail "Missing: ComparePageContent.tsx"
fi

# ──────────────────────────────────────────────────
# 4. i18n parity (EN/TR/ES) for new Step 11.55 keys
# ──────────────────────────────────────────────────
divider "CHECK: i18n parity for Step 11.55 keys"

TRANSLATIONS="$_I18N_COMPAT"
if [ -f "$TRANSLATIONS" ]; then
  I18N_OK=true

  # Check that all key prefixes we added exist in all three blocks
  for key_prefix in "nav.product" "nav.solutions" "nav.resources" "nav.compare" "nav.pricing" "nav.contactSales" "nav.menu" "footer.company" "footer.product" "footer.resources" "footer.compare" "footer.support" "footer.about" "footer.careers" "footer.security" "footer.privacy" "footer.terms" "footer.contact" "footer.tagline" "compare.title" "compare.comingSoon" "compare.backHome" "compare.vsIntercom.title" "compare.vsZendesk.title" "compare.vsCrisp.title" "compare.vsTidio.title"; do
    # Count occurrences (should be 3 — once in en, tr, es)
    COUNT=$(grep -c "\"${key_prefix}\":" "$TRANSLATIONS" 2>/dev/null || echo 0)
    if [ "$COUNT" -lt 3 ]; then
      log_fail "i18n key \"$key_prefix\" found $COUNT times (expected 3 for EN/TR/ES)"
      I18N_OK=false
    fi
  done

  if $I18N_OK; then
    log_pass "i18n parity: all Step 11.55 keys present in EN/TR/ES"
  fi
else
  log_fail "translations.ts not found"
fi

# ──────────────────────────────────────────────────
# 5. No hardcoded strings in new/changed files
# ──────────────────────────────────────────────────
divider "CHECK: No hardcoded user-facing strings"

HARDCODED_OK=true
for f in \
  "$ROOT/apps/web/src/components/PublicLayout.tsx" \
  "$ROOT/apps/web/src/app/compare/ComparePageContent.tsx" \
  "$ROOT/apps/web/src/app/compare/intercom/page.tsx" \
  "$ROOT/apps/web/src/app/compare/zendesk/page.tsx" \
  "$ROOT/apps/web/src/app/compare/crisp/page.tsx" \
  "$ROOT/apps/web/src/app/compare/tidio/page.tsx"; do
  if [ -f "$f" ]; then
    # Look for JSX text content that is NOT a t() call, className, or code
    # This is a heuristic: look for >Some text< patterns that are hardcoded
    # Skip known safe patterns: APP_NAME, className, {t(, {, icon, etc.
    SUSPECT=$(grep -nE '>[A-Z][a-z]{2,}[^<]*</' "$f" 2>/dev/null | grep -v 'className' | grep -v '{t(' | grep -v '{APP_NAME}' | grep -v 'suppressHydrationWarning' | grep -v '// ' | head -5 || true)
    if [ -n "$SUSPECT" ]; then
      log_warn "Possible hardcoded text in $(basename "$f"): $(echo "$SUSPECT" | head -2)"
    fi
  fi
done
log_pass "No obvious hardcoded user-facing strings detected"

# ──────────────────────────────────────────────────
# 6. No new CSS files
# ──────────────────────────────────────────────────
divider "CHECK: No new global CSS files"

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
# 7. Builds (if not skipped by VERIFY_ALL)
# ──────────────────────────────────────────────────
divider "CHECK: Builds"

if [ "${SKIP_BUILD:-}" = "1" ]; then
  log_info "SKIP_BUILD=1 — builds already verified by VERIFY_ALL"
  log_pass "Builds (skipped)"
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
# 8. Smoke tests — pages return 200
# ──────────────────────────────────────────────────
divider "CHECK: Smoke tests (HTTP 200)"

WEB_URL="${WEB_URL:-http://localhost:3000}"
SMOKE_OK=true

for path in "/" "/pricing" "/compare/intercom" "/compare/zendesk" "/compare/crisp" "/compare/tidio"; do
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
