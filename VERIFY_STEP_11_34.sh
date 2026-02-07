#!/usr/bin/env bash
# =============================================================
# VERIFY_STEP_11_34.sh — Widget UX & Embed Onboarding
# =============================================================
set -uo pipefail
PASS=0; FAIL=0; WARN=0
ROOT="$(cd "$(dirname "$0")" && pwd)"

pass() { PASS=$((PASS+1)); echo "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ FAIL: $1"; }
warn() { WARN=$((WARN+1)); echo "  ⚠️  WARN: $1"; }

echo "========================================"
echo "  VERIFY STEP 11.34 — Widget UX & Embed Onboarding"
echo "========================================"

# ── 1. API Build ──
echo ""
echo "── 1. API Build ──"
API_OUT=$(cd "$ROOT/apps/api" && pnpm build 2>&1) && pass "API build succeeded" || fail "API build failed"

# ── 2. Web Build ──
echo ""
echo "── 2. Web Build ──"
WEB_OUT=$(cd "$ROOT/apps/web" && NEXT_BUILD_DIR=.next-verify pnpm build 2>&1) && pass "Web build succeeded" || fail "Web build failed"

# ── 3. New Component Files Exist ──
echo ""
echo "── 3. Component File Checks ──"

[ -f "$ROOT/apps/web/src/components/WidgetStatusBanner.tsx" ] && pass "WidgetStatusBanner.tsx exists" || fail "WidgetStatusBanner.tsx missing"
[ -f "$ROOT/apps/web/src/components/EmbedChecklist.tsx" ] && pass "EmbedChecklist.tsx exists" || fail "EmbedChecklist.tsx missing"
[ -f "$ROOT/apps/web/src/components/WidgetEmptyState.tsx" ] && pass "WidgetEmptyState.tsx exists" || fail "WidgetEmptyState.tsx missing"
[ -f "$ROOT/apps/web/src/components/ConversationNudge.tsx" ] && pass "ConversationNudge.tsx exists" || fail "ConversationNudge.tsx missing"

# ── 4. Components Are Exported ──
echo ""
echo "── 4. Component Exports ──"

grep -q "export default function WidgetStatusBanner" "$ROOT/apps/web/src/components/WidgetStatusBanner.tsx" && pass "WidgetStatusBanner exported" || fail "WidgetStatusBanner not exported"
grep -q "export default function EmbedChecklist" "$ROOT/apps/web/src/components/EmbedChecklist.tsx" && pass "EmbedChecklist exported" || fail "EmbedChecklist not exported"
grep -q "export default function WidgetEmptyState" "$ROOT/apps/web/src/components/WidgetEmptyState.tsx" && pass "WidgetEmptyState exported" || fail "WidgetEmptyState not exported"
grep -q "export default function ConversationNudge" "$ROOT/apps/web/src/components/ConversationNudge.tsx" && pass "ConversationNudge exported" || fail "ConversationNudge not exported"

# ── 5. Portal Page Integration ──
echo ""
echo "── 5. Portal Page Integration ──"

PORTAL="$ROOT/apps/web/src/app/portal/page.tsx"
grep -q "EmbedChecklist" "$PORTAL" && pass "EmbedChecklist imported in portal page" || fail "EmbedChecklist NOT in portal page"
grep -q "WidgetStatusBanner" "$PORTAL" && pass "WidgetStatusBanner imported in portal page" || fail "WidgetStatusBanner NOT in portal page"
grep -q "ConversationNudge" "$PORTAL" && pass "ConversationNudge imported in portal page" || fail "ConversationNudge NOT in portal page"
grep -q "conversionSignals" "$PORTAL" && pass "conversionSignals state in portal page" || fail "conversionSignals NOT in portal page"

# ── 6. Widget Status States ──
echo ""
echo "── 6. Widget Status States ──"

WIDGET_BANNER="$ROOT/apps/web/src/components/WidgetStatusBanner.tsx"
grep -q '"loading"' "$WIDGET_BANNER" && pass "WidgetStatusBanner has loading state" || fail "WidgetStatusBanner missing loading state"
grep -q '"ready"' "$WIDGET_BANNER" && pass "WidgetStatusBanner has ready state" || fail "WidgetStatusBanner missing ready state"
grep -q '"error"' "$WIDGET_BANNER" && pass "WidgetStatusBanner has error state" || fail "WidgetStatusBanner missing error state"

# ── 7. Empty State Variants ──
echo ""
echo "── 7. Widget Empty State Variants ──"

EMPTY="$ROOT/apps/web/src/components/WidgetEmptyState.tsx"
grep -q '"not-loaded"' "$EMPTY" && pass "WidgetEmptyState has not-loaded variant" || fail "WidgetEmptyState missing not-loaded"
grep -q '"error"' "$EMPTY" && pass "WidgetEmptyState has error variant" || fail "WidgetEmptyState missing error"
grep -q '"domain-not-authorized"' "$EMPTY" && pass "WidgetEmptyState has domain-not-authorized variant" || fail "WidgetEmptyState missing domain-not-authorized"

# ── 8. ConversationNudge Features ──
echo ""
echo "── 8. ConversationNudge Features ──"

NUDGE="$ROOT/apps/web/src/components/ConversationNudge.tsx"
grep -q "delayMs" "$NUDGE" && pass "ConversationNudge has delay prop" || fail "ConversationNudge missing delay"
grep -q "sessionStorage" "$NUDGE" && pass "ConversationNudge uses sessionStorage for dismiss" || fail "ConversationNudge missing sessionStorage"
grep -q "dismiss" "$NUDGE" && pass "ConversationNudge is dismissible" || fail "ConversationNudge not dismissible"

# ── 9. EmbedChecklist Features ──
echo ""
echo "── 9. EmbedChecklist Features ──"

CHECKLIST="$ROOT/apps/web/src/components/EmbedChecklist.tsx"
grep -q "siteId" "$CHECKLIST" && pass "EmbedChecklist uses siteId" || fail "EmbedChecklist missing siteId"
grep -q "snippetCopied" "$CHECKLIST" && pass "EmbedChecklist tracks snippet copy" || fail "EmbedChecklist missing snippet copy tracking"
grep -q "domainsConfigured" "$CHECKLIST" && pass "EmbedChecklist tracks domain config" || fail "EmbedChecklist missing domain config"
grep -q "widgetConnected" "$CHECKLIST" && pass "EmbedChecklist tracks widget connection" || fail "EmbedChecklist missing widget connection"
grep -q "HELVINO_SITE_ID" "$CHECKLIST" && pass "EmbedChecklist shows embed snippet" || fail "EmbedChecklist missing embed snippet"

# ── 10. i18n Keys ──
echo ""
echo "── 10. i18n Key Checks ──"

I18N="$ROOT/apps/web/src/i18n/translations.ts"

# Check EN keys exist
for key in "widget.connected" "widget.startConversation" "widget.loading" "widget.ready" "widget.error" "widget.errorRetry" "widget.notLoaded" "widget.notLoadedDesc" "widget.domainNotAuth" "widget.domainNotAuthDesc" "widget.testChat" "widget.testChatDesc" "widget.dismiss" "embed.checklistTitle" "embed.checklistSubtitle" "embed.step1Title" "embed.step2Title" "embed.step3Title" "embed.completed" "embed.pending" "embed.copySnippet" "embed.configureDomains" "embed.previewWidget" "embed.snippetTitle" "embed.snippetHint" "common.retry"; do
  COUNT=$(grep -c "\"$key\"" "$I18N")
  if [ "$COUNT" -ge 3 ]; then
    pass "i18n key '$key' present in all 3 locales"
  else
    fail "i18n key '$key' missing or not in all 3 locales (found $COUNT)"
  fi
done

# ── 11. No Hardcoded Strings ──
echo ""
echo "── 11. No Hardcoded Strings in New Components ──"

for comp in WidgetStatusBanner EmbedChecklist WidgetEmptyState ConversationNudge; do
  FILE="$ROOT/apps/web/src/components/${comp}.tsx"
  if grep -q 'useI18n' "$FILE"; then
    pass "$comp uses i18n"
  else
    fail "$comp does not use i18n"
  fi
done

# ── 12. Docs ──
echo ""
echo "── 12. Documentation ──"
[ -f "$ROOT/docs/STEP_11_34_WIDGET_ONBOARDING.md" ] && pass "Docs file exists" || fail "Docs file missing"

# ── 13. Components Use useI18n (no hardcoded visible text) ──
echo ""
echo "── 13. useI18n usage pattern ──"

for comp in WidgetStatusBanner EmbedChecklist WidgetEmptyState ConversationNudge; do
  FILE="$ROOT/apps/web/src/components/${comp}.tsx"
  if grep -q 't("' "$FILE"; then
    pass "$comp calls t() for translations"
  else
    fail "$comp does not call t()"
  fi
done

# ── SUMMARY ──
echo ""
echo "========================================"
echo "  SUMMARY"
echo "  PASSED:  $PASS"
echo "  FAILED:  $FAIL"
echo "  WARNED:  $WARN"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  echo "❌ VERIFY_STEP_11_34: FAIL"
  exit 1
else
  echo "✅ VERIFY_STEP_11_34: PASS"
  exit 0
fi
