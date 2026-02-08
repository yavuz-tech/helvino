#!/usr/bin/env bash
# VERIFY_STEP_11_60.sh
# Gate: Portal i18n moved to JSON with EN/TR/ES parity

set -e

STEP="11.60"
STEP_DESC="Portal i18n JSON migration + parity verification"

echo "=============================================="
echo "STEP ${STEP} — ${STEP_DESC}"
echo "=============================================="
echo ""

FAIL_COUNT=0
PASS_COUNT=0

function log_check() {
  local label="$1"
  local status="$2"
  local detail="${3:-}"
  
  if [ "$status" = "PASS" ]; then
    echo "✅ PASS: $label"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ FAIL: $label"
    [ -n "$detail" ] && echo "   ↳ $detail"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "📋 Checking JSON locale files..."
echo ""

# 1) Check if JSON files exist
for locale in en tr es; do
  file="apps/web/src/i18n/locales/${locale}.json"
  if [ -f "$file" ]; then
    log_check "Locale file exists: $locale.json" "PASS"
  else
    log_check "Locale file exists: $locale.json" "FAIL" "File not found: $file"
  fi
done

echo ""
echo "📋 Checking JSON validity..."
echo ""

# 2) Check if JSON files are valid
for locale in en tr es; do
  file="apps/web/src/i18n/locales/${locale}.json"
  if [ -f "$file" ]; then
    if node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" 2>/dev/null; then
      log_check "Valid JSON: $locale.json" "PASS"
    else
      log_check "Valid JSON: $locale.json" "FAIL" "JSON parse error"
    fi
  fi
done

echo ""
echo "📋 Checking i18n parity (EN/TR/ES key sets)..."
echo ""

# 3) Check parity using Node.js
PARITY_CHECK=$(node -e "
const fs = require('fs');
const en = JSON.parse(fs.readFileSync('apps/web/src/i18n/locales/en.json', 'utf8'));
const tr = JSON.parse(fs.readFileSync('apps/web/src/i18n/locales/tr.json', 'utf8'));
const es = JSON.parse(fs.readFileSync('apps/web/src/i18n/locales/es.json', 'utf8'));

const enKeys = Object.keys(en).sort();
const trKeys = Object.keys(tr).sort();
const esKeys = Object.keys(es).sort();

if (enKeys.length !== trKeys.length || enKeys.length !== esKeys.length) {
  console.log('FAIL: Key count mismatch: EN=' + enKeys.length + ', TR=' + trKeys.length + ', ES=' + esKeys.length);
  process.exit(1);
}

const enSet = new Set(enKeys);
const trMissing = enKeys.filter(k => !(k in tr));
const esMissing = enKeys.filter(k => !(k in es));

if (trMissing.length > 0) {
  console.log('FAIL: TR missing ' + trMissing.length + ' keys: ' + trMissing.slice(0, 5).join(', '));
  process.exit(1);
}

if (esMissing.length > 0) {
  console.log('FAIL: ES missing ' + esMissing.length + ' keys: ' + esMissing.slice(0, 5).join(', '));
  process.exit(1);
}

const trExtra = trKeys.filter(k => !enSet.has(k));
const esExtra = esKeys.filter(k => !enSet.has(k));

if (trExtra.length > 0) {
  console.log('FAIL: TR has ' + trExtra.length + ' extra keys: ' + trExtra.slice(0, 5).join(', '));
  process.exit(1);
}

if (esExtra.length > 0) {
  console.log('FAIL: ES has ' + esExtra.length + ' extra keys: ' + esExtra.slice(0, 5).join(', '));
  process.exit(1);
}

console.log('PASS: EN/TR/ES all have ' + enKeys.length + ' keys (100% parity)');
" 2>&1)

if echo "$PARITY_CHECK" | grep -q "^PASS:"; then
  log_check "i18n parity (EN/TR/ES)" "PASS" "$PARITY_CHECK"
else
  log_check "i18n parity (EN/TR/ES)" "FAIL" "$PARITY_CHECK"
fi

echo ""
echo "📋 Checking translations.ts imports JSON..."
echo ""

# 4) Check if translations.ts imports from ./locales/*.json
TRANSLATIONS_FILE="apps/web/src/i18n/translations.ts"
if [ -f "$TRANSLATIONS_FILE" ]; then
  if grep -q 'from.*["'\'']\.\/locales\/en\.json["'\'']' "$TRANSLATIONS_FILE" && \
     grep -q 'from.*["'\'']\.\/locales\/tr\.json["'\'']' "$TRANSLATIONS_FILE" && \
     grep -q 'from.*["'\'']\.\/locales\/es\.json["'\'']' "$TRANSLATIONS_FILE"; then
    log_check "translations.ts imports JSON locales" "PASS"
  else
    log_check "translations.ts imports JSON locales" "FAIL" "Missing JSON imports in $TRANSLATIONS_FILE"
  fi
else
  log_check "translations.ts exists" "FAIL" "File not found: $TRANSLATIONS_FILE"
fi

echo ""
echo "=============================================="
echo "STEP ${STEP} VERIFICATION SUMMARY"
echo "=============================================="
echo "✅ PASS: $PASS_COUNT"
echo "❌ FAIL: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "✅ STEP ${STEP} — ${STEP_DESC} — VERIFICATION PASSED"
  exit 0
else
  echo "❌ STEP ${STEP} — ${STEP_DESC} — VERIFICATION FAILED"
  exit 1
fi
