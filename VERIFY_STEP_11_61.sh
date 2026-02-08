#!/usr/bin/env bash
set -e

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

STEP="11.61"
echo "=============================================="
echo "STEP ${STEP} — Portal Inbox Redesign (3-pane chat dashboard)"
echo "=============================================="
echo ""

FAIL_COUNT=0
PASS_COUNT=0

pass() { echo "  ✅ PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ❌ FAIL: $1${2:+ — $2}"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# 1) JSON locale files exist and are valid
echo "📋 Checking JSON locale files..."
for locale in en tr es; do
  file="apps/web/src/i18n/locales/${locale}.json"
  if [ -f "$file" ]; then
    if node -e "JSON.parse(require('fs').readFileSync('$file','utf8'))" 2>/dev/null; then
      pass "Valid JSON: $locale.json"
    else
      fail "Valid JSON: $locale.json" "parse error"
    fi
  else
    fail "Locale file exists: $locale.json"
  fi
done

echo ""

# 2) i18n parity
echo "📋 Checking i18n parity..."
PARITY=$(node -e "
const fs = require('fs');
const en = JSON.parse(fs.readFileSync('apps/web/src/i18n/locales/en.json','utf8'));
const tr = JSON.parse(fs.readFileSync('apps/web/src/i18n/locales/tr.json','utf8'));
const es = JSON.parse(fs.readFileSync('apps/web/src/i18n/locales/es.json','utf8'));
const enK = Object.keys(en).sort();
const trK = Object.keys(tr).sort();
const esK = Object.keys(es).sort();
if (enK.length !== trK.length || enK.length !== esK.length) {
  console.log('FAIL:count:EN='+enK.length+',TR='+trK.length+',ES='+esK.length);
  process.exit(0);
}
const trM = enK.filter(k => !(k in tr));
const esM = enK.filter(k => !(k in es));
if (trM.length > 0) { console.log('FAIL:TR missing:'+trM.slice(0,3).join(',')); process.exit(0); }
if (esM.length > 0) { console.log('FAIL:ES missing:'+esM.slice(0,3).join(',')); process.exit(0); }
console.log('PASS:'+enK.length+' keys in parity');
" 2>&1)

if echo "$PARITY" | grep -q "^PASS:"; then
  pass "i18n parity — $PARITY"
else
  fail "i18n parity" "$PARITY"
fi

echo ""

# 3) Critical new i18n keys exist
echo "📋 Checking critical inbox i18n keys..."
CRITICAL_KEYS=(
  "inbox.sidebar.search"
  "inbox.sidebar.inbox"
  "inbox.sidebar.agents"
  "inbox.chat.send"
  "inbox.chat.typeMessage"
  "inbox.customer.title"
  "inbox.notes.title"
  "inbox.empty.title"
  "inbox.mobileBack"
)

for key in "${CRITICAL_KEYS[@]}"; do
  EN_HAS=$(grep -c "\"$key\"" apps/web/src/i18n/locales/en.json 2>/dev/null || echo 0)
  TR_HAS=$(grep -c "\"$key\"" apps/web/src/i18n/locales/tr.json 2>/dev/null || echo 0)
  ES_HAS=$(grep -c "\"$key\"" apps/web/src/i18n/locales/es.json 2>/dev/null || echo 0)
  TOTAL=$((EN_HAS + TR_HAS + ES_HAS))
  if [ "$TOTAL" -ge 3 ]; then
    pass "Key present in all locales: $key"
  else
    fail "Key present in all locales: $key" "found in $TOTAL/3 locales"
  fi
done

echo ""

# 4) Inbox component exists and uses i18n
echo "📋 Checking inbox component..."
INBOX_FILE="apps/web/src/app/portal/inbox/PortalInboxContent.tsx"
if [ -f "$INBOX_FILE" ]; then
  pass "PortalInboxContent.tsx exists"
  
  if grep -q "useI18n" "$INBOX_FILE"; then
    pass "Uses useI18n hook"
  else
    fail "Uses useI18n hook"
  fi

  if grep -q "inbox.sidebar" "$INBOX_FILE"; then
    pass "Uses new sidebar i18n keys"
  else
    fail "Uses new sidebar i18n keys"
  fi

  if grep -q "inbox.chat" "$INBOX_FILE"; then
    pass "Uses new chat i18n keys"
  else
    fail "Uses new chat i18n keys"
  fi

  if grep -q "inbox.customer" "$INBOX_FILE"; then
    pass "Uses customer detail i18n keys"
  else
    fail "Uses customer detail i18n keys"
  fi

  if grep -q "inbox.notes" "$INBOX_FILE"; then
    pass "Uses notes i18n keys"
  else
    fail "Uses notes i18n keys"
  fi
else
  fail "PortalInboxContent.tsx exists"
fi

echo ""

# 5) Component structure
echo "📋 Checking component structure..."
if grep -q "PANE.*SIDEBAR\|PANE.*CONVERSATION\|PANE.*CHAT\|PANE.*CUSTOMER\|PANE.*Detail" "$INBOX_FILE"; then
  pass "Multi-pane layout present"
else
  fail "Multi-pane layout present"
fi

if grep -q "InfoRow\|DetailRow\|SidebarItem\|SidebarRow" "$INBOX_FILE"; then
  pass "Sub-components defined"
else
  fail "Sub-components defined"
fi

if grep -q "mobileView" "$INBOX_FILE"; then
  pass "Mobile responsive view state"
else
  fail "Mobile responsive view state"
fi

echo ""
echo "=============================================="
echo "STEP ${STEP} VERIFICATION SUMMARY"
echo "=============================================="
echo "  ✅ PASS: $PASS_COUNT"
echo "  ❌ FAIL: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "✅ STEP ${STEP} — Portal Inbox Redesign — VERIFICATION PASSED"
  exit 0
else
  echo "❌ STEP ${STEP} — Portal Inbox Redesign — VERIFICATION FAILED"
  exit 1
fi
