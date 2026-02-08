#!/usr/bin/env bash
# VERIFY_STEP_11_67.sh — Plan Enforcement: Branding + MaxAgents + Domain Allowlist
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✅  $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌  $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "── VERIFY STEP 11.67 — Plan Enforcement ──"

# 1) brandingRequired is plan-derived, not hardcoded true
check "bootloader brandingRequired is plan-derived (not hardcoded)" \
  grep -q 'brandingRequired.*planKey.*free\|planKey.*===.*free.*brandingRequired' apps/api/src/routes/bootloader.ts

# 2) maxAgents field in bootloader response
check "bootloader returns maxAgents" \
  grep -q 'maxAgents' apps/api/src/routes/bootloader.ts

# 3) unauthorizedDomain field in bootloader response
check "bootloader returns unauthorizedDomain" \
  grep -q 'unauthorizedDomain' apps/api/src/routes/bootloader.ts

# 4) Widget handles unauthorizedDomain
check "widget handles unauthorizedDomain state" \
  grep -q 'unauthorizedDomain' apps/widget/src/App.tsx

# 5) Widget unauthorized string exists
check "widget unauthorized domain string present" \
  grep -q 'not authorized on this domain\|Unauthorized domain' apps/widget/src/App.tsx

# 6) maxAgents enforcement in portal-team invite creation
check "portal-team.ts enforces maxAgents on invite" \
  grep -q 'MAX_AGENTS_REACHED\|maxAgents' apps/api/src/routes/portal-team.ts

# 7) embed.tsx sets HELVINO_PARENT_HOST
check "embed.tsx sets parentHost" \
  grep -q 'HELVINO_PARENT_HOST\|parentHost' apps/widget/src/embed.tsx

# 8) Widget API sends parentHost to bootloader
check "widget api.ts sends parentHost" \
  grep -q 'parentHost' apps/widget/src/api.ts

# 9) i18n EN/TR/ES parity for new keys
EN_BRAND=$(grep -c 'widgetConfig.branding' apps/web/src/i18n/locales/en.json || echo 0)
TR_BRAND=$(grep -c 'widgetConfig.branding' apps/web/src/i18n/locales/tr.json || echo 0)
ES_BRAND=$(grep -c 'widgetConfig.branding' apps/web/src/i18n/locales/es.json || echo 0)
check "i18n branding keys parity (en=$EN_BRAND tr=$TR_BRAND es=$ES_BRAND)" \
  test "$EN_BRAND" -eq "$TR_BRAND" -a "$TR_BRAND" -eq "$ES_BRAND" -a "$EN_BRAND" -gt 0

EN_DOMAIN=$(grep -c 'widgetConfig.domainMismatch' apps/web/src/i18n/locales/en.json || echo 0)
TR_DOMAIN=$(grep -c 'widgetConfig.domainMismatch' apps/web/src/i18n/locales/tr.json || echo 0)
ES_DOMAIN=$(grep -c 'widgetConfig.domainMismatch' apps/web/src/i18n/locales/es.json || echo 0)
check "i18n domain-mismatch keys parity (en=$EN_DOMAIN tr=$TR_DOMAIN es=$ES_DOMAIN)" \
  test "$EN_DOMAIN" -eq "$TR_DOMAIN" -a "$TR_DOMAIN" -eq "$ES_DOMAIN" -a "$EN_DOMAIN" -gt 0

# 11) Portal widget-appearance page shows branding toggle
check "widget-appearance page has branding toggle" \
  grep -q 'brandingToggle\|brandingFreeLocked' apps/web/src/app/portal/widget-appearance/page.tsx

# 12) No random IDs (Date.now/Math.random) in modified files
check "no Date.now() ID generation in bootloader" \
  bash -c '! grep -n "Date\.now()" apps/api/src/routes/bootloader.ts | grep -qi "id"'

# 13) widget-appearance main layout classes preserved
check "widget-appearance preset-card class preserved" \
  grep -q 'preset-card' apps/web/src/app/portal/widget-appearance/page.tsx

check "widget-appearance customize-btn-animated class preserved" \
  grep -q 'customize-btn-animated' apps/web/src/app/portal/widget-appearance/page.tsx

# 14) brandingRequired not hardcoded true
check "brandingRequired is NOT hardcoded to true" \
  bash -c '! grep -q "brandingRequired: true," apps/api/src/routes/bootloader.ts'

# 15) portal-widget-settings returns planKey and maxAgents
check "portal-widget-settings returns planKey" \
  grep -q 'planKey' apps/api/src/routes/portal-widget-settings.ts

check "portal-widget-settings returns maxAgents" \
  grep -q 'maxAgents' apps/api/src/routes/portal-widget-settings.ts

echo ""
echo "── RESULT: $PASS/$TOTAL passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ] || exit 1
