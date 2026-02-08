#!/usr/bin/env bash
# VERIFY_STEP_11_49.sh — Split Inbox View + Deep Link
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


STEP="11.49"
PASS_COUNT=0
FAIL_COUNT=0

log_pass() { echo "  PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
log_fail() { echo "  FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "================================================================"
echo "STEP ${STEP} VERIFICATION: Split Inbox View + Deep Link"
echo "================================================================"

# ══════════════════════════════════════════════════════════════════
# 1) WEB UI
# ══════════════════════════════════════════════════════════════════
echo
echo "1) Web UI Components"

INBOX_FILE="apps/web/src/app/portal/inbox/PortalInboxContent.tsx"

# 1.1 Inbox content component exists
if [ -f "$INBOX_FILE" ]; then
  log_pass "1.1 Portal inbox content component exists"
else
  log_fail "1.1 Portal inbox content component missing"
fi

# 1.2 URL state management (searchParams)
if grep -q 'useSearchParams' "$INBOX_FILE" && grep -q 'searchParams.get' "$INBOX_FILE"; then
  log_pass "1.2 URL state management (useSearchParams)"
else
  log_fail "1.2 URL state management missing"
fi

# 1.3 URL param 'c' read and set
if grep -q '"c"' "$INBOX_FILE" && grep -q 'params.set.*"c"' "$INBOX_FILE"; then
  log_pass "1.3 URL param 'c' read and set"
else
  log_fail "1.3 URL param 'c' handling missing"
fi

# 1.4 Auto-select on load from URL
if grep -q 'searchParams.get.*"c"' "$INBOX_FILE" && grep -q 'selectConversation' "$INBOX_FILE"; then
  log_pass "1.4 Auto-select from URL on load"
else
  log_fail "1.4 Auto-select from URL missing"
fi

# 1.5 Close panel functionality
if grep -q 'closePanel' "$INBOX_FILE" && grep -q 'params.delete.*"c"' "$INBOX_FILE"; then
  log_pass "1.5 Close panel removes URL param"
else
  log_fail "1.5 Close panel missing"
fi

# 1.6 Copy link functionality
if grep -q 'copyLink' "$INBOX_FILE" && grep -q 'clipboard.writeText' "$INBOX_FILE"; then
  log_pass "1.6 Copy link functionality"
else
  log_fail "1.6 Copy link missing"
fi

# 1.7 Detail panel tabs (notes/details)
if grep -q 'detailTab' "$INBOX_FILE" && grep -q 'notes.*details' "$INBOX_FILE"; then
  log_pass "1.7 Detail panel tabs (notes/details)"
else
  log_fail "1.7 Detail panel tabs missing"
fi

# 1.8 Split-view layout (multi-pane)
if grep -q 'w-\[' "$INBOX_FILE" && grep -q 'flex-1' "$INBOX_FILE"; then
  log_pass "1.8 Split-view layout (multi-pane)"
else
  log_fail "1.8 Split-view layout missing"
fi

# 1.9 Step 11.47 features preserved (notes)
if grep -q 'notePlaceholder' "$INBOX_FILE" && grep -q 'handleAddNote' "$INBOX_FILE"; then
  log_pass "1.9 Step 11.47 notes features preserved"
else
  log_fail "1.9 Step 11.47 features missing"
fi

# 1.10 Step 11.48 features preserved (filters, bulk)
if grep -q 'statusFilter' "$INBOX_FILE" && grep -q 'executeBulk' "$INBOX_FILE" && grep -q 'debouncedSearch' "$INBOX_FILE"; then
  log_pass "1.10 Step 11.48 filters + bulk preserved"
else
  log_fail "1.10 Step 11.48 features missing"
fi

# 1.11 useHydrated for date safety
if grep -q 'useHydrated' "$INBOX_FILE"; then
  log_pass "1.11 Hydration-safe date formatting"
else
  log_fail "1.11 useHydrated missing"
fi

# 1.12 ErrorBanner import
if grep -q 'ErrorBanner' "$INBOX_FILE"; then
  log_pass "1.12 ErrorBanner imported"
else
  log_fail "1.12 ErrorBanner missing"
fi

# ══════════════════════════════════════════════════════════════════
# 2) i18n PARITY
# ══════════════════════════════════════════════════════════════════
echo
echo "2) i18n Keys (EN/TR/ES Parity)"

I18N_FILE="$_I18N_COMPAT"

REQUIRED_KEYS=(
  "inbox.detail.noSelection"
  "inbox.detail.copyLink"
  "inbox.detail.linkCopied"
  "inbox.detail.details"
  "inbox.detail.notes"
  "inbox.detail.closePanel"
  "inbox.detail.open"
  "inbox.detail.close"
)

MISSING_KEYS=()
for key in "${REQUIRED_KEYS[@]}"; do
  count=$(grep -c "\"$key\"" "$I18N_FILE" 2>/dev/null || echo 0)
  if [ "$count" -lt 3 ]; then
    MISSING_KEYS+=("$key(found:$count)")
  fi
done

if [ ${#MISSING_KEYS[@]} -eq 0 ]; then
  log_pass "2.1 All new keys present in EN/TR/ES (${#REQUIRED_KEYS[@]} keys x 3)"
else
  log_fail "2.1 Missing keys: ${MISSING_KEYS[*]}"
fi

# 2.2 TR translations (spot check)
if grep -q '"inbox.detail.noSelection": "Detayları görmek için bir konuşma seçin"' "$I18N_FILE"; then
  log_pass "2.2 TR translations present"
else
  log_fail "2.2 TR translations missing"
fi

# 2.3 ES translations (spot check)
if grep -q '"inbox.detail.noSelection": "Seleccione una conversación para ver detalles"' "$I18N_FILE"; then
  log_pass "2.3 ES translations present"
else
  log_fail "2.3 ES translations missing"
fi

# ══════════════════════════════════════════════════════════════════
# 3) DOCS
# ══════════════════════════════════════════════════════════════════
echo
echo "3) Documentation"

if [ -f "docs/STEP_11_49_SPLIT_INBOX.md" ]; then
  log_pass "3.1 Documentation file exists"
else
  log_fail "3.1 Documentation file missing"
fi

if grep -qE '(split.*view|deep.*link|\?c=)' docs/STEP_11_49_SPLIT_INBOX.md 2>/dev/null; then
  log_pass "3.2 Doc covers key topics"
else
  log_fail "3.2 Doc missing key topics"
fi

# ══════════════════════════════════════════════════════════════════
# 4) NO HARDCODED STRINGS (Basic Check)
# ══════════════════════════════════════════════════════════════════
echo
echo "4) No Hardcoded Strings (Basic Grep)"

# 4.1 Check for common hardcoded strings (allowlist technical terms)
HARDCODED=$(grep -nE '(Copy Link|No selection|Close Panel)' "$INBOX_FILE" 2>/dev/null | grep -v 't(' | grep -v '//' || true)
if [ -z "$HARDCODED" ]; then
  log_pass "4.1 No obvious hardcoded strings found"
else
  log_fail "4.1 Possible hardcoded strings: $HARDCODED"
fi

# ══════════════════════════════════════════════════════════════════
# 5) FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════
echo
echo "================================================================"
echo "VERIFICATION SUMMARY - Step ${STEP}"
echo "================================================================"
echo "  PASS: ${PASS_COUNT}"
echo "  FAIL: ${FAIL_COUNT}"
echo

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "All checks passed!"
  exit 0
else
  echo "Some checks failed."
  exit 1
fi
