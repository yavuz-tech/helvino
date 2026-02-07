#!/usr/bin/env bash
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
pass() { ((PASS++)); ((TOTAL++)); echo "  ✅ $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  ❌ $1"; }
section() { echo ""; echo "── $1 ──"; }

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$BASE_DIR/apps/web"
I18N_FILE="$WEB_DIR/src/i18n/translations.ts"

# ═══════════════════════════════════════════
section "1. Component file checks"
# ═══════════════════════════════════════════

# 1.1 PasswordStrength.tsx exists
if [ -f "$WEB_DIR/src/components/PasswordStrength.tsx" ]; then
  pass "File: PasswordStrength.tsx exists"
else
  fail "File: PasswordStrength.tsx missing"
fi

# 1.2 Component accepts password prop
if grep -q 'password: string' "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null; then
  pass "Component: password prop present"
else
  fail "Component: password prop missing"
fi

# 1.3 Component accepts minLength prop
if grep -q 'minLength' "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null; then
  pass "Component: minLength prop present"
else
  fail "Component: minLength prop missing"
fi

# 1.4 Uses i18n (no hardcoded strings)
if grep -q 'useI18n\|t(' "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null; then
  pass "Component: uses i18n"
else
  fail "Component: does not use i18n"
fi

# 1.5 Strength levels: weak, ok, strong
for level in "weak" "ok" "strong"; do
  if grep -q "\"$level\"" "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null; then
    pass "Component: strength level '$level' defined"
  else
    fail "Component: strength level '$level' missing"
  fi
done

# 1.6 Requirements: letter and digit checks
if grep -q 'a-zA-Z' "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null; then
  pass "Component: letter regex present"
else
  fail "Component: letter regex missing"
fi

if grep -qE '\\d' "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null; then
  pass "Component: digit regex present"
else
  fail "Component: digit regex missing"
fi

# 1.7 Uses Check/X icons for checklist
if grep -q 'Check' "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null && \
   grep -q 'X' "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null; then
  pass "Component: Check/X icons used for checklist"
else
  fail "Component: Check/X icons missing"
fi

# ═══════════════════════════════════════════
section "2. Page integrations"
# ═══════════════════════════════════════════

# 2.1 Signup page imports PasswordStrength
if grep -q 'PasswordStrength' "$WEB_DIR/src/app/signup/page.tsx" 2>/dev/null; then
  pass "Integration: signup page uses PasswordStrength"
else
  fail "Integration: signup page missing PasswordStrength"
fi

# 2.2 Reset-password page imports PasswordStrength
if grep -q 'PasswordStrength' "$WEB_DIR/src/app/portal/reset-password/page.tsx" 2>/dev/null; then
  pass "Integration: reset-password page uses PasswordStrength"
else
  fail "Integration: reset-password page missing PasswordStrength"
fi

# 2.3 Security (change-password) page imports PasswordStrength
if grep -q 'PasswordStrength' "$WEB_DIR/src/app/portal/security/page.tsx" 2>/dev/null; then
  pass "Integration: security page uses PasswordStrength"
else
  fail "Integration: security page missing PasswordStrength"
fi

# 2.4 All pages pass password prop
for page in "signup/page.tsx" "portal/reset-password/page.tsx" "portal/security/page.tsx"; do
  if grep -q 'password=' "$WEB_DIR/src/app/$page" 2>/dev/null; then
    pass "Integration: $page passes password prop"
  else
    fail "Integration: $page missing password prop"
  fi
done

# ═══════════════════════════════════════════
section "3. i18n parity checks"
# ═══════════════════════════════════════════

for key in "passwordStrength.title" "passwordStrength.weak" "passwordStrength.ok" "passwordStrength.strong" "passwordReq.minLength" "passwordReq.letter" "passwordReq.number"; do
  COUNT=$(grep -c "\"$key\"" "$I18N_FILE" 2>/dev/null || echo 0)
  if [ "$COUNT" -ge 3 ]; then
    pass "i18n: $key present in 3 locales"
  else
    fail "i18n: $key only in $COUNT locales (need 3)"
  fi
done

# ═══════════════════════════════════════════
section "4. No hardcoded strength strings in component"
# ═══════════════════════════════════════════

# Check that the component doesn't have hardcoded user-facing labels
HC_COUNT=0
for word in '"Weak"' '"OK"' '"Strong"' '"At least"' '"Contains"'; do
  if grep -q "$word" "$WEB_DIR/src/components/PasswordStrength.tsx" 2>/dev/null; then
    ((HC_COUNT++))
  fi
done

if [ "$HC_COUNT" -eq 0 ]; then
  pass "No hardcoded strength/requirement strings in component"
else
  fail "Found $HC_COUNT hardcoded strings in PasswordStrength.tsx"
fi

# ═══════════════════════════════════════════
section "5. Documentation"
# ═══════════════════════════════════════════

if [ -f "$BASE_DIR/docs/STEP_11_41_PASSWORD_STRENGTH_UI.md" ]; then
  pass "Docs: STEP_11_41_PASSWORD_STRENGTH_UI.md exists"
else
  fail "Docs: STEP_11_41_PASSWORD_STRENGTH_UI.md missing"
fi

# ═══════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
echo "  VERIFY_STEP_11_41 RESULTS: $PASS passed, $FAIL failed (total $TOTAL)"
echo "═══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "  RESULT: ❌ FAIL"
  exit 1
fi

echo "  RESULT: ✅ PASS"
exit 0
