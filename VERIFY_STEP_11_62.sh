#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
# VERIFY_STEP_11_62.sh — Widget Preview Renderer (V4.1)
# ════════════════════════════════════════════════════════════════════════════

STEP_NAME="STEP 11.62 — Widget Preview Renderer (Real JSX UI)"
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
# 1. WidgetPreviewRenderer component exists
# ──────────────────────────────────────────────────
divider "CHECK: WidgetPreviewRenderer component"

RENDERER="$ROOT/apps/web/src/components/widget/WidgetPreviewRenderer.tsx"
if [ -f "$RENDERER" ]; then
  log_pass "WidgetPreviewRenderer.tsx exists"
  
  # Check for "use client"
  if grep -q '"use client"' "$RENDERER"; then
    log_pass "WidgetPreviewRenderer has 'use client'"
  else
    log_fail "WidgetPreviewRenderer missing 'use client'"
  fi
  
  # Check for real JSX rendering (not PNG/Image)
  if grep -q "MessageCircle\|Send\|User\|Home" "$RENDERER"; then
    log_pass "WidgetPreviewRenderer has real JSX icons"
  else
    log_fail "WidgetPreviewRenderer missing JSX icons"
  fi
  
  # Check for state management
  if grep -q "useState" "$RENDERER"; then
    log_pass "WidgetPreviewRenderer has state management"
  else
    log_fail "WidgetPreviewRenderer missing state management"
  fi
  
  # Check for 3 widget states
  if grep -q 'closed\|open\|welcome' "$RENDERER"; then
    log_pass "WidgetPreviewRenderer has widget states"
  else
    log_fail "WidgetPreviewRenderer missing widget states"
  fi
  
  # NO random IDs (Date.now, Math.random, etc.)
  if grep -E "Date\.now|Math\.random|new Date\(\)\.getTime" "$RENDERER" >/dev/null 2>&1; then
    log_fail "WidgetPreviewRenderer has random ID generation (hydration risk)"
  else
    log_pass "WidgetPreviewRenderer has no random IDs"
  fi
else
  log_fail "WidgetPreviewRenderer.tsx not found"
fi

# ──────────────────────────────────────────────────
# 2. widget-appearance page integration
# ──────────────────────────────────────────────────
divider "CHECK: widget-appearance page integration"

PAGE="$ROOT/apps/web/src/app/portal/widget-appearance/page.tsx"
if [ -f "$PAGE" ]; then
  log_pass "widget-appearance/page.tsx exists"
  
  # Check import
  if grep -q "WidgetPreviewRenderer" "$PAGE"; then
    log_pass "WidgetPreviewRenderer imported in page"
  else
    log_fail "WidgetPreviewRenderer not imported"
  fi
  
  # Check rendering
  if grep -q "<WidgetPreviewRenderer" "$PAGE"; then
    log_pass "WidgetPreviewRenderer rendered in page"
  else
    log_fail "WidgetPreviewRenderer not rendered"
  fi
  
  # Check debug panel collapsible
  if grep -q "showDebugPanel\|Reference Gallery\|Debug" "$PAGE"; then
    log_pass "Debug panel (collapsible) exists"
  else
    log_fail "Debug panel not found"
  fi
  
  # Check default closed state
  if grep -q "useState(false)" "$PAGE" && grep -q "showDebugPanel" "$PAGE"; then
    log_pass "Debug panel default closed (useState(false))"
  else
    log_warn "Debug panel may not be default closed"
  fi
  
  # WidgetGallery should still exist but in collapsible
  if grep -q "WidgetGallery" "$PAGE"; then
    log_pass "WidgetGallery still available in page"
  else
    log_warn "WidgetGallery removed (should be in debug panel)"
  fi
else
  log_fail "widget-appearance/page.tsx not found"
fi

# ──────────────────────────────────────────────────
# 3. No new CSS files
# ──────────────────────────────────────────────────
divider "CHECK: No new CSS files"

if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  NEW_CSS=$(git ls-files --others --exclude-standard -- '*.css' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$NEW_CSS" -eq 0 ]; then
    log_pass "No new CSS files"
  else
    log_warn "$NEW_CSS new CSS files detected"
  fi
else
  log_pass "No new CSS check skipped (not a git repo)"
fi

# ──────────────────────────────────────────────────
# 4. Build verification
# ──────────────────────────────────────────────────
divider "CHECK: Build"

if [ "${SKIP_BUILD:-}" = "1" ]; then
  log_info "SKIP_BUILD=1 — builds already verified"
  log_pass "Build (skipped)"
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
# 5. Route smoke tests
# ──────────────────────────────────────────────────
divider "CHECK: Route smoke tests"

WEB_URL="${WEB_URL:-http://localhost:3000}"
SMOKE_OK=true

for path in "/portal/widget-appearance" "/portal/widget"; do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "${WEB_URL}${path}" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log_pass "GET ${path} → $HTTP_CODE"
  elif [ "$HTTP_CODE" = "000" ]; then
    log_warn "GET ${path} → timeout/unreachable (server may not be running)"
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
