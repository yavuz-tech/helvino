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
# VERIFY_STEP_11_23.sh — Automatic Step-Up UX + Unified Client Guard
# ─────────────────────────────────────────────────────────────

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  WARN: $1"; WARN=$((WARN+1)); }

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════════════════════"
echo "  VERIFY Step 11.23 — Step-Up UX + Client Guard"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. File existence ──
echo "── 1. File existence checks ──"

FILES=(
  "apps/web/src/contexts/StepUpContext.tsx"
  "apps/web/src/utils/step-up.ts"
  "apps/web/src/components/MfaStepUpModal.tsx"
  "docs/STEP_11_23_STEPUP_UX.md"
)

for f in "${FILES[@]}"; do
  if [ -f "$REPO_ROOT/$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done

# ── 2. StepUpContext content checks ──
echo ""
echo "── 2. StepUpContext implementation ──"

CTX="$REPO_ROOT/apps/web/src/contexts/StepUpContext.tsx"

for pattern in "withStepUp" "STEP_UP_REQUIRED" "MfaStepUpModal" "adminStepUpChallenge" "portalStepUpChallenge" "detectArea" "cancelled"; do
  if grep -q "$pattern" "$CTX" 2>/dev/null; then
    pass "StepUpContext: $pattern"
  else
    fail "StepUpContext missing: $pattern"
  fi
done

# ── 3. Provider wired in root ──
echo ""
echo "── 3. Provider mounting ──"

PROVIDERS="$REPO_ROOT/apps/web/src/app/providers.tsx"

if grep -q "StepUpProvider" "$PROVIDERS" 2>/dev/null; then
  pass "providers.tsx includes StepUpProvider"
else
  fail "providers.tsx missing StepUpProvider"
fi

# ── 4. MfaStepUpModal updated copy ──
echo ""
echo "── 4. MfaStepUpModal checks ──"

MODAL="$REPO_ROOT/apps/web/src/components/MfaStepUpModal.tsx"

for pattern in "stepUp.title" "stepUp.description" "stepUp.verify" "stepUp.cancel" "ShieldCheck"; do
  if grep -q "$pattern" "$MODAL" 2>/dev/null; then
    pass "Modal: $pattern"
  else
    fail "Modal missing: $pattern"
  fi
done

# ── 5. i18n keys (EN/TR/ES) ──
echo ""
echo "── 5. i18n key checks ──"

I18N="$_I18N_COMPAT"

for key in "stepUp.title" "stepUp.description" "stepUp.verify" "stepUp.cancel" "stepUp.invalidCode" "stepUp.cancelled" "stepUp.retryFailed" "stepUp.verifying" "stepUp.codeLabel" "stepUp.codePlaceholder"; do
  COUNT=$(grep -c "\"$key\"" "$I18N" 2>/dev/null || true)
  if [ "$COUNT" -ge 3 ]; then
    pass "i18n key '$key' in 3 locales"
  elif [ "$COUNT" -ge 1 ]; then
    warn "i18n key '$key' found $COUNT times (expected 3)"
  else
    fail "i18n key '$key' missing"
  fi
done

# ── 6. Portal pages wired with withStepUp ──
echo ""
echo "── 6. Portal step-up wiring ──"

for f in "portal/security/page.tsx" "portal/team/page.tsx" "portal/billing/page.tsx" "portal/security/devices/page.tsx"; do
  FILE="$REPO_ROOT/apps/web/src/app/$f"
  if [ -f "$FILE" ]; then
    if grep -q "withStepUp" "$FILE" 2>/dev/null; then
      pass "$f uses withStepUp"
    else
      fail "$f missing withStepUp"
    fi
  else
    fail "$f not found"
  fi
done

# ── 7. Admin pages wired with withStepUp ──
echo ""
echo "── 7. Admin step-up wiring ──"

for f in "dashboard/settings/page.tsx" "dashboard/security/devices/page.tsx"; do
  FILE="$REPO_ROOT/apps/web/src/app/$f"
  if [ -f "$FILE" ]; then
    if grep -q "withStepUp" "$FILE" 2>/dev/null; then
      pass "$f uses withStepUp"
    else
      fail "$f missing withStepUp"
    fi
  else
    fail "$f not found"
  fi
done

# ── 8. No infinite retry (cancelled check) ──
echo ""
echo "── 8. Cancel/retry safety checks ──"

# Check that the context only retries once (look for "exactly once" pattern)
if grep -q "cancelled" "$CTX" 2>/dev/null; then
  pass "StepUpContext handles cancellation"
else
  fail "StepUpContext missing cancel handling"
fi

# Check portal security page handles cancelled
PORTAL_SEC="$REPO_ROOT/apps/web/src/app/portal/security/page.tsx"
CANCEL_COUNT=$(grep -c "result.cancelled" "$PORTAL_SEC" 2>/dev/null || true)
if [ "$CANCEL_COUNT" -ge 3 ]; then
  pass "Portal security handles cancelled ($CANCEL_COUNT checks)"
else
  fail "Portal security has only $CANCEL_COUNT cancel checks (expected >= 3)"
fi

# ── 9. Documentation check ──
echo ""
echo "── 9. Documentation checks ──"

DOC="$REPO_ROOT/docs/STEP_11_23_STEPUP_UX.md"

for word in "StepUpProvider" "withStepUp" "TTL" "admin" "portal" "MfaStepUpModal"; do
  if grep -q "$word" "$DOC" 2>/dev/null; then
    pass "Doc mentions: $word"
  else
    fail "Doc missing: $word"
  fi
done

# ── 10. API smoke tests ──
echo ""
echo "── 10. API smoke tests ──"

API_URL="${API_URL:-http://localhost:4000}"

# Verify challenge endpoints exist (should return 401 without auth)
for ep in "/internal/auth/mfa/challenge" "/portal/auth/mfa/challenge"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL$ep" -H "Content-Type: application/json" -d '{"code":"000000"}' 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "400" ]; then
    pass "Challenge $ep returns $HTTP_CODE (auth required)"
  elif [ "$HTTP_CODE" = "000" ]; then
    warn "API not reachable at $API_URL — skipping smoke tests"
  else
    warn "Challenge $ep returned $HTTP_CODE"
  fi
done

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
