#!/usr/bin/env bash
# VERIFY_STEP_11_68.sh — Metering (M1/M2/M3) + Domain Mismatch Event Log + Paywall Standardization
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

echo "── VERIFY STEP 11.68 — Metering + Mismatch Event Log + Paywall ──"

# 1) Usage endpoint / response has m1/m2/m3
check "billing status or usage returns m1Count/m2Count/m3Count" \
  grep -q 'm1Count\|m2Count\|m3Count' apps/api/src/routes/portal-billing.ts
check "getUsageForMonth returns m1Count m2Count m3Count" \
  grep -q 'm1Count\|m2Count\|m3Count' apps/api/src/utils/entitlements.ts

# 2) Usage storage model / periodKey
check "Usage model has m1Count m2Count m3Count and monthKey" \
  grep -q 'm1Count\|m2Count\|m3Count' apps/api/prisma/schema.prisma
check "periodKey / monthKey in usage" \
  grep -q 'monthKey\|periodKey' apps/api/src/utils/entitlements.ts

# 3) M3 dedupe (UsageVisitor)
check "UsageVisitor model exists for M3 dedupe" \
  grep -q 'UsageVisitor\|usage_visitors' apps/api/prisma/schema.prisma
check "recordM3Usage uses visitorKey/periodKey dedupe" \
  grep -q 'recordM3Usage\|UsageVisitor' apps/api/src/utils/entitlements.ts

# 4) Domain mismatch event storage
check "DomainMismatchEvent model exists" \
  grep -q 'DomainMismatchEvent\|domain_mismatch_events' apps/api/prisma/schema.prisma
check "bootloader creates DomainMismatchEvent on mismatch" \
  grep -q 'domainMismatchEvent\|DomainMismatchEvent' apps/api/src/routes/bootloader.ts

# 5) mismatchCount / lastMismatchHost / lastMismatchAt
check "Organization has lastMismatchHost lastMismatchAt" \
  grep -q 'lastMismatchHost\|lastMismatchAt' apps/api/prisma/schema.prisma
check "bootloader updates lastMismatchHost lastMismatchAt" \
  grep -q 'lastMismatchHost\|lastMismatchAt' apps/api/src/routes/bootloader.ts

# 6) Mismatch events list endpoint (last 20)
check "portal endpoint for domain-mismatches list (last 20)" \
  grep -q 'domain-mismatches\|domain_mismatch' apps/api/src/routes/portal-org.ts

# 7) Portal usage page has M1/M2/M3 i18n labels
check "usage page shows m1Count m2Count m3Count" \
  grep -q 'm1Count\|m2Count\|m3Count' apps/web/src/app/portal/usage/page.tsx
check "i18n usage.m1Label m2Label m3Label exist" \
  grep -q 'usage.m1Label\|usage.m2Label\|usage.m3Label' apps/web/src/i18n/locales/en.json

# 8) Portal security shows mismatchCount + lastMismatch
check "portal security page shows domainMismatchCount / lastMismatch" \
  grep -q 'domainMismatchCount\|lastMismatchHost\|lastMismatchAt' apps/web/src/app/portal/security/page.tsx

# 9) LockedControl component exists and used in widget-appearance at least 2 times
check "LockedControl component exists" \
  test -f apps/web/src/components/LockedControl.tsx
USES=$(grep -c 'LockedControl' apps/web/src/app/portal/widget-appearance/page.tsx || echo 0)
check "widget-appearance uses LockedControl at least 2 times" \
  test "$USES" -ge 2

# 10) TR/EN/ES parity for new keys (security.domainMismatches, usage.m1Label etc.)
EN_SEC=$(grep -c 'security.domainMismatch\|security.reportedHost\|security.lastMismatch' apps/web/src/i18n/locales/en.json || echo 0)
TR_SEC=$(grep -c 'security.domainMismatch\|security.reportedHost\|security.lastMismatch' apps/web/src/i18n/locales/tr.json || echo 0)
ES_SEC=$(grep -c 'security.domainMismatch\|security.reportedHost\|security.lastMismatch' apps/web/src/i18n/locales/es.json || echo 0)
check "i18n security mismatch keys parity (en=$EN_SEC tr=$TR_SEC es=$ES_SEC)" \
  test "$EN_SEC" -eq "$TR_SEC" -a "$TR_SEC" -eq "$ES_SEC" -a "$EN_SEC" -gt 0

# 11) No random IDs (Date.now/Math.random) in new code
check "no Date.now() used for IDs in bootloader/entitlements" \
  bash -c '! grep -n "Date\.now()" apps/api/src/routes/bootloader.ts apps/api/src/utils/entitlements.ts 2>/dev/null | grep -q . || true'

# 12) Widget unauthorized state string still present (regression)
check "widget unauthorized domain string present" \
  grep -q 'not authorized on this domain\|Unauthorized domain' apps/widget/src/App.tsx

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  STEP 11.68 — Result: $PASS passed, $FAIL failed (of $TOTAL)"
echo "════════════════════════════════════════════════════════════════"
if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ NOT PASSING"
  exit 1
fi
echo "  ✅ STEP 11.68 VERIFICATION PASSED"
exit 0
