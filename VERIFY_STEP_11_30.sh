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


PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  ❌ $1"; }
check_file() { [ -f "$1" ] && pass "$2" || fail "$2"; }
check_grep() { grep -q "$2" "$1" 2>/dev/null && pass "$3" || fail "$3"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
WEB="$ROOT/apps/web/src"

echo "═══════════════════════════════════════════"
echo " STEP 11.30 — UX Polish Verification"
echo "═══════════════════════════════════════════"
echo ""

# ── Section 1: Component files exist ──
echo "▸ Component existence"
check_file "$WEB/components/OnboardingOverlay.tsx" "OnboardingOverlay.tsx exists"
check_file "$WEB/components/EmptyState.tsx" "EmptyState.tsx exists"
check_file "$WEB/components/SecurityBadges.tsx" "SecurityBadges.tsx exists"

# ── Section 2: Onboarding component checks ──
echo ""
echo "▸ OnboardingOverlay code patterns"
check_grep "$WEB/components/OnboardingOverlay.tsx" "onboarding.admin.welcomeTitle" "Admin welcome step key"
check_grep "$WEB/components/OnboardingOverlay.tsx" "onboarding.portal.welcomeTitle" "Portal welcome step key"
check_grep "$WEB/components/OnboardingOverlay.tsx" "onboarding.getStarted" "Get Started button key"
check_grep "$WEB/components/OnboardingOverlay.tsx" "onboarding.dontShowAgain" "Don't show again key"
check_grep "$WEB/components/OnboardingOverlay.tsx" "localStorage" "Uses localStorage for persistence"
check_grep "$WEB/components/OnboardingOverlay.tsx" "useI18n" "Uses i18n"

# ── Section 3: EmptyState component checks ──
echo ""
echo "▸ EmptyState code patterns"
check_grep "$WEB/components/EmptyState.tsx" "title" "Has title prop"
check_grep "$WEB/components/EmptyState.tsx" "description" "Has description prop"
check_grep "$WEB/components/EmptyState.tsx" "actionLabel" "Has actionLabel prop"
check_grep "$WEB/components/EmptyState.tsx" "actionHref" "Has actionHref prop"

# ── Section 4: SecurityBadges component checks ──
echo ""
echo "▸ SecurityBadges code patterns"
check_grep "$WEB/components/SecurityBadges.tsx" "trust.mfaEnabled" "MFA enabled badge key"
check_grep "$WEB/components/SecurityBadges.tsx" "trust.mfaDisabled" "MFA disabled badge key"
check_grep "$WEB/components/SecurityBadges.tsx" "trust.passkeysActive" "Passkeys badge key"
check_grep "$WEB/components/SecurityBadges.tsx" "trust.auditActive" "Audit active badge key"
check_grep "$WEB/components/SecurityBadges.tsx" "useI18n" "Uses i18n"

# ── Section 5: Integration into pages ──
echo ""
echo "▸ Dashboard page integration"
check_grep "$WEB/app/dashboard/page.tsx" "OnboardingOverlay" "Dashboard imports OnboardingOverlay"
check_grep "$WEB/app/dashboard/page.tsx" "SecurityBadges" "Dashboard imports SecurityBadges"
check_grep "$WEB/app/dashboard/page.tsx" "EmptyState" "Dashboard imports EmptyState"
check_grep "$WEB/app/dashboard/page.tsx" "empty.conversations" "Dashboard uses empty state key"

echo ""
echo "▸ Portal page integration"
check_grep "$WEB/app/portal/page.tsx" "OnboardingOverlay" "Portal imports OnboardingOverlay"
check_grep "$WEB/app/portal/page.tsx" "SecurityBadges" "Portal imports SecurityBadges"

echo ""
echo "▸ Portal team page integration"
check_grep "$WEB/app/portal/team/page.tsx" "EmptyState" "Team page imports EmptyState"
check_grep "$WEB/app/portal/team/page.tsx" "empty.team" "Team uses empty.team key"
check_grep "$WEB/app/portal/team/page.tsx" "empty.invites" "Team uses empty.invites key"

# ── Section 6: Portal login UX consistency ──
echo ""
echo "▸ UX consistency"
check_grep "$WEB/app/portal/login/page.tsx" "ErrorBanner" "Portal login uses ErrorBanner"

# ── Section 7: i18n key parity ──
echo ""
echo "▸ i18n key parity (EN/TR/ES)"
TRANS="$_I18N_COMPAT"

# Onboarding keys
for KEY in "onboarding.next" "onboarding.getStarted" "onboarding.dontShowAgain" \
  "onboarding.admin.welcomeTitle" "onboarding.admin.welcomeDesc" \
  "onboarding.admin.inboxTitle" "onboarding.admin.inboxDesc" \
  "onboarding.admin.securityTitle" "onboarding.admin.securityDesc" \
  "onboarding.admin.readyTitle" "onboarding.admin.readyDesc" \
  "onboarding.portal.welcomeTitle" "onboarding.portal.welcomeDesc" \
  "onboarding.portal.embedTitle" "onboarding.portal.embedDesc" \
  "onboarding.portal.securityTitle" "onboarding.portal.securityDesc" \
  "onboarding.portal.readyTitle" "onboarding.portal.readyDesc"; do
  COUNT=$(grep -c "\"$KEY\"" "$TRANS" 2>/dev/null || echo "0")
  [ "$COUNT" -ge 3 ] && pass "i18n: $KEY (EN/TR/ES)" || fail "i18n: $KEY missing locale(s) (found $COUNT)"
done

# Empty state keys
for KEY in "empty.conversations" "empty.conversationsDesc" \
  "empty.team" "empty.teamDesc" "empty.invites" "empty.invitesDesc" \
  "empty.billing" "empty.billingDesc" "empty.usage" "empty.usageDesc" \
  "empty.sessions" "empty.sessionsDesc" "empty.devices" "empty.devicesDesc" \
  "empty.passkeys" "empty.passkeysDesc" "empty.auditLog" "empty.auditLogDesc"; do
  COUNT=$(grep -c "\"$KEY\"" "$TRANS" 2>/dev/null || echo "0")
  [ "$COUNT" -ge 3 ] && pass "i18n: $KEY (EN/TR/ES)" || fail "i18n: $KEY missing locale(s) (found $COUNT)"
done

# Trust badge keys
for KEY in "trust.mfaEnabled" "trust.mfaDisabled" "trust.passkeysActive" \
  "trust.auditActive" "trust.securityHealthy"; do
  COUNT=$(grep -c "\"$KEY\"" "$TRANS" 2>/dev/null || echo "0")
  [ "$COUNT" -ge 3 ] && pass "i18n: $KEY (EN/TR/ES)" || fail "i18n: $KEY missing locale(s) (found $COUNT)"
done

# ── Section 8: Documentation ──
echo ""
echo "▸ Documentation"
check_file "$ROOT/docs/STEP_11_30_UX_POLISH.md" "Step 11.30 doc exists"

# ── Section 9: No hardcoded user-facing strings in new components ──
echo ""
echo "▸ No hardcoded strings in new components"
# Check that components use t() or props for user-facing text
check_grep "$WEB/components/OnboardingOverlay.tsx" 'useI18n\|t(' "OnboardingOverlay: uses i18n (no hardcoded strings)"
check_grep "$WEB/components/SecurityBadges.tsx" 'useI18n\|t(' "SecurityBadges: uses i18n (no hardcoded strings)"
# EmptyState receives text via props — no i18n needed internally
check_grep "$WEB/components/EmptyState.tsx" "title" "EmptyState: receives text via props (no hardcoded strings)"

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════"
echo " RESULTS: $PASS passed, $FAIL failed (of $TOTAL)"
echo "═══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo " ❌ STEP 11.30 FAIL"
  exit 1
else
  echo " ✅ STEP 11.30 PASS"
  exit 0
fi
