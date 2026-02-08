#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
#  VERIFY_STEP_11_63.sh  —  Widget Theme Presets + Persist
# ═══════════════════════════════════════════════════════════════
PASS=0; FAIL=0
pass() { ((PASS++)); echo "  ✅ $1"; }
fail() { ((FAIL++)); echo "  ❌ $1"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
WEB="$ROOT/apps/web"

echo "═══ VERIFY_STEP_11_63: Widget Theme Presets ═══"

# 1. Preset UI component exists (widgetThemePresets.ts)
echo ""
echo "── 1. Theme preset model ──"
if [ -f "$WEB/src/lib/widgetThemePresets.ts" ]; then
  pass "widgetThemePresets.ts exists"
else
  fail "widgetThemePresets.ts missing"
fi

# Check that at least 6 presets are defined
PRESET_COUNT=$(grep -c 'presetId:' "$WEB/src/lib/widgetThemePresets.ts" 2>/dev/null || echo "0")
if [ "$PRESET_COUNT" -ge 6 ]; then
  pass "At least 6 presets defined ($PRESET_COUNT found)"
else
  fail "Expected >=6 presets, found $PRESET_COUNT"
fi

# 2. Preset UI is imported in widget-appearance page
echo ""
echo "── 2. Preset UI integration ──"
if grep -q 'WIDGET_THEME_PRESETS' "$WEB/src/app/portal/widget-appearance/page.tsx" 2>/dev/null; then
  pass "widget-appearance imports WIDGET_THEME_PRESETS"
else
  fail "widget-appearance does not import WIDGET_THEME_PRESETS"
fi

if grep -q 'data-preset-id' "$WEB/src/app/portal/widget-appearance/page.tsx" 2>/dev/null; then
  pass "Preset swatch buttons have data-preset-id attribute"
else
  fail "Preset swatch buttons missing data-preset-id"
fi

# 3. Debug gate in both widget pages
echo ""
echo "── 3. Debug gate ──"
for PAGE in "portal/widget/page.tsx" "portal/widget-appearance/page.tsx"; do
  FILE="$WEB/src/app/$PAGE"
  if grep -q 'NODE_ENV' "$FILE" 2>/dev/null && grep -q 'debug' "$FILE" 2>/dev/null; then
    pass "$PAGE has debug gate (NODE_ENV + debug param)"
  else
    fail "$PAGE missing debug gate"
  fi
done

# 4. Persist functions exist
echo ""
echo "── 4. Persist (save/load) ──"
if grep -q 'portalApiFetch.*widget/settings' "$WEB/src/app/portal/widget-appearance/page.tsx" 2>/dev/null; then
  pass "API persist (portalApiFetch /widget/settings) present"
else
  fail "API persist missing"
fi

if grep -q 'localStorage' "$WEB/src/app/portal/widget-appearance/page.tsx" 2>/dev/null; then
  pass "localStorage persist for theme overrides present"
else
  fail "localStorage persist missing"
fi

# 5. Embed copy button on widget page
echo ""
echo "── 5. Embed copy button ──"
if grep -q 'copySnippet\|clipboard' "$WEB/src/app/portal/widget/page.tsx" 2>/dev/null; then
  pass "Embed copy button present in widget page"
else
  fail "Embed copy button missing"
fi

# 6. No random/non-deterministic IDs
echo ""
echo "── 6. No random/Date.now usage ──"
HAS_RANDOM=0
for F in "$WEB/src/lib/widgetThemePresets.ts" \
         "$WEB/src/app/portal/widget-appearance/page.tsx" \
         "$WEB/src/components/widget/WidgetPreviewRenderer.tsx"; do
  if grep -q 'Math\.random\|Date\.now\|crypto\.randomUUID' "$F" 2>/dev/null; then
    fail "Random ID found in $(basename "$F")"
    HAS_RANDOM=1
  fi
done
if [ "$HAS_RANDOM" -eq 0 ]; then
  pass "No Math.random / Date.now / crypto.randomUUID found"
fi

# 7. i18n parity (widgetTheme keys)
echo ""
echo "── 7. i18n parity (widgetTheme.*) ──"
EN_COUNT=$(grep -c '"widgetTheme\.' "$WEB/src/i18n/locales/en.json" 2>/dev/null || echo "0")
TR_COUNT=$(grep -c '"widgetTheme\.' "$WEB/src/i18n/locales/tr.json" 2>/dev/null || echo "0")
ES_COUNT=$(grep -c '"widgetTheme\.' "$WEB/src/i18n/locales/es.json" 2>/dev/null || echo "0")

if [ "$EN_COUNT" -gt 0 ] && [ "$EN_COUNT" -eq "$TR_COUNT" ] && [ "$EN_COUNT" -eq "$ES_COUNT" ]; then
  pass "widgetTheme keys: EN=$EN_COUNT TR=$TR_COUNT ES=$ES_COUNT (parity OK)"
else
  fail "widgetTheme key parity issue: EN=$EN_COUNT TR=$TR_COUNT ES=$ES_COUNT"
fi

# 8. No new CSS files added
echo ""
echo "── 8. No new CSS files ──"
NEW_CSS=$(find "$WEB/src" -name '*.css' -newer "$WEB/src/app/globals.css" 2>/dev/null | head -5)
if [ -z "$NEW_CSS" ]; then
  pass "No new CSS files detected"
else
  fail "New CSS files: $NEW_CSS"
fi

# 9. WidgetPreviewRenderer accepts theme prop
echo ""
echo "── 9. WidgetPreviewRenderer theme prop ──"
if grep -q 'theme.*ThemeOverrides\|theme?:' "$WEB/src/components/widget/WidgetPreviewRenderer.tsx" 2>/dev/null; then
  pass "WidgetPreviewRenderer accepts theme prop"
else
  fail "WidgetPreviewRenderer missing theme prop"
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════════"
echo "  PASS: $PASS   FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ VERIFY_STEP_11_63: ALL PASSED"
else
  echo "  ❌ VERIFY_STEP_11_63: $FAIL FAILURES"
fi
echo "═══════════════════════════════════════"
exit "$FAIL"
