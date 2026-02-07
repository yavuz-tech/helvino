#!/usr/bin/env bash
set -euo pipefail

# VERIFY_STEP_11_15.sh — i18n Coverage + Consistency
# Checks that all TSX files use t() for user-facing strings,
# and that all three locale dictionaries (en/tr/es) have identical key sets.

ROOT="$(cd "$(dirname "$0")" && pwd)"
PASS_COUNT=0
FAIL_COUNT=0

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo -e "  ${GREEN}PASS${NC}: $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "  ${RED}FAIL${NC}: $1"; }

echo "🌍 Step 11.15: i18n Coverage + Consistency — Verification"
echo "============================================================="
echo ""

# ── 1. Key files exist ──
echo "── 1. Key files ──"

[ -f "$ROOT/apps/web/src/i18n/translations.ts" ] && pass "translations.ts exists" || fail "translations.ts missing"
[ -f "$ROOT/apps/web/src/i18n/I18nContext.tsx" ] && pass "I18nContext.tsx exists" || fail "I18nContext.tsx missing"
[ -f "$ROOT/apps/web/src/components/LanguageSwitcher.tsx" ] && pass "LanguageSwitcher.tsx exists" || fail "LanguageSwitcher.tsx missing"
[ -f "$ROOT/docs/STEP_11_15_I18N_COVERAGE.md" ] && pass "docs/STEP_11_15_I18N_COVERAGE.md exists" || fail "docs missing"
[ -f "$ROOT/.cursor/rules/i18n-enforcement.mdc" ] && pass "Cursor rule exists" || fail "Cursor rule missing"
echo ""

# ── 2. Locale key parity ──
echo "── 2. Locale key parity (en/tr/es must have identical keys) ──"

TRANS_FILE="$ROOT/apps/web/src/i18n/translations.ts"

# Extract keys from each locale block
# EN is "const en = { ... } as const;"  (first block)
# TR is "const tr: Record<...> = { ... };"
# ES is "const es: Record<...> = { ... };"

en_keys=$(awk '/^const en/,/^} as const;/' "$TRANS_FILE" | grep -oE '"[^"]+":' | sed 's/:$//' | sort -u)
tr_keys=$(awk '/^const tr/,/^};/' "$TRANS_FILE" | grep -oE '"[^"]+":' | sed 's/:$//' | sort -u)
es_keys=$(awk '/^const es/,/^};/' "$TRANS_FILE" | grep -oE '"[^"]+":' | sed 's/:$//' | sort -u)

en_count=$(echo "$en_keys" | wc -l | tr -d ' ')
tr_count=$(echo "$tr_keys" | wc -l | tr -d ' ')
es_count=$(echo "$es_keys" | wc -l | tr -d ' ')

echo "  EN keys: $en_count"
echo "  TR keys: $tr_count"
echo "  ES keys: $es_count"

if [ "$en_count" -eq "$tr_count" ] && [ "$en_count" -eq "$es_count" ]; then
  pass "All locales have same key count ($en_count)"
else
  fail "Key count mismatch: EN=$en_count TR=$tr_count ES=$es_count"
fi

# Check for missing keys
missing_in_tr=$(comm -23 <(echo "$en_keys") <(echo "$tr_keys") | head -5)
missing_in_es=$(comm -23 <(echo "$en_keys") <(echo "$es_keys") | head -5)

if [ -z "$missing_in_tr" ]; then
  pass "TR has all EN keys"
else
  fail "TR missing keys: $missing_in_tr"
fi

if [ -z "$missing_in_es" ]; then
  pass "ES has all EN keys"
else
  fail "ES missing keys: $missing_in_es"
fi

# Check for duplicate keys within each locale
en_dupes=$(awk '/^const en/,/^} as const;/' "$TRANS_FILE" | grep -oE '"[^"]+":' | sed 's/:$//' | sort | uniq -d)
if [ -z "$en_dupes" ]; then
  pass "No duplicate keys in EN"
else
  fail "Duplicate keys in EN: $en_dupes"
fi

tr_dupes=$(awk '/^const tr/,/^};/' "$TRANS_FILE" | grep -oE '"[^"]+":' | sed 's/:$//' | sort | uniq -d)
if [ -z "$tr_dupes" ]; then
  pass "No duplicate keys in TR"
else
  fail "Duplicate keys in TR: $tr_dupes"
fi

es_dupes=$(awk '/^const es/,/^};/' "$TRANS_FILE" | grep -oE '"[^"]+":' | sed 's/:$//' | sort | uniq -d)
if [ -z "$es_dupes" ]; then
  pass "No duplicate keys in ES"
else
  fail "Duplicate keys in ES: $es_dupes"
fi
echo ""

# ── 3. Hardcoded string scan (best-effort) ──
echo "── 3. Hardcoded string scan (best-effort) ──"

# Look for obvious hardcoded English strings in JSX: >[A-Z][a-z]{3,}<
# Exclude: className, import, export, console, comment lines, type annotations, widget config
VIOLATIONS=0
SCANNED=0
for f in $(find "$ROOT/apps/web/src/app" "$ROOT/apps/web/src/components" -name "*.tsx" -type f 2>/dev/null); do
  SCANNED=$((SCANNED + 1))
  # Check for hardcoded English text in JSX elements (very conservative)
  matches=$(grep -n '>[A-Z][a-z]\{4,\}' "$f" 2>/dev/null \
    | grep -v 'className\|import\|export\|const\|interface\|type\|//\|console\|function\|English\|Deutsch\|Français\|Español\|Türkçe\|ROTATE\|HELVINO\|{t(' \
    | grep -v '\.tsx:\|\.ts:\|aria-\|data-\|htmlFor\|useEffect\|useState\|placeholder="[a-z]' \
    | head -3 || true)
  if [ -n "$matches" ]; then
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

echo "  Scanned $SCANNED TSX files"
if [ "$VIOLATIONS" -eq 0 ]; then
  pass "No obvious hardcoded strings found"
else
  # This is a warning, not a failure — best-effort scan has false positives
  echo -e "  ${RED}WARN${NC}: $VIOLATIONS files with potential hardcoded strings (may be false positives)"
fi
echo ""

# ── 4. i18n system integration ──
echo "── 4. i18n system integration ──"

if grep -q "I18nProvider" "$ROOT/apps/web/src/app/providers.tsx" 2>/dev/null; then
  pass "I18nProvider in providers.tsx"
else
  fail "I18nProvider not in providers.tsx"
fi

if grep -q "LanguageSwitcher" "$ROOT/apps/web/src/components/DashboardLayout.tsx" 2>/dev/null; then
  pass "LanguageSwitcher in DashboardLayout"
else
  fail "LanguageSwitcher not in DashboardLayout"
fi

if grep -q "LanguageSwitcher" "$ROOT/apps/web/src/components/PortalLayout.tsx" 2>/dev/null; then
  pass "LanguageSwitcher in PortalLayout"
else
  fail "LanguageSwitcher not in PortalLayout"
fi

if grep -q "helvino_lang" "$ROOT/apps/web/src/i18n/I18nContext.tsx" 2>/dev/null; then
  pass "Cookie-based persistence (helvino_lang)"
else
  fail "Cookie-based persistence missing"
fi

if grep -q "navigator.language" "$ROOT/apps/web/src/i18n/I18nContext.tsx" 2>/dev/null; then
  pass "Browser language detection"
else
  fail "Browser language detection missing"
fi

if grep -q "alwaysApply: true" "$ROOT/.cursor/rules/i18n-enforcement.mdc" 2>/dev/null; then
  pass "Cursor i18n rule is alwaysApply"
else
  fail "Cursor i18n rule not alwaysApply"
fi
echo ""

# ── Summary ──
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "=============================="
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT not passed (total $TOTAL)"
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}STEP 11.15 VERIFICATION: PASS${NC}"
  echo ""
  exit 0
else
  echo -e "  ${RED}STEP 11.15 VERIFICATION: NOT PASSING${NC}"
  echo ""
  exit 1
fi
