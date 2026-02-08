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
TRANS="$_I18N_COMPAT"

echo "═══════════════════════════════════════════"
echo " STEP 11.31 — Pricing & Plan Comparison"
echo "═══════════════════════════════════════════"
echo ""

# ── Section 1: Component & page files ──
echo "▸ File existence"
check_file "$WEB/components/PlanComparisonTable.tsx" "PlanComparisonTable.tsx exists"
check_file "$WEB/app/pricing/page.tsx" "Public pricing page exists"
check_file "$ROOT/docs/STEP_11_31_PRICING_UX.md" "Step 11.31 doc exists"

# ── Section 2: PlanComparisonTable patterns ──
echo ""
echo "▸ PlanComparisonTable code patterns"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.monthly" "Monthly toggle key"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.yearly" "Yearly toggle key"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.yearlyDiscount" "Yearly discount label"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.mostPopular" "Most Popular badge"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.currentPlan" "Current Plan badge"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.features" "Features heading"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.startFree" "Start Free CTA"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.upgrade" "Upgrade CTA"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.feature.mfa" "MFA feature check"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.feature.passkeys" "Passkeys feature check"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.feature.auditLog" "Audit log feature check"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.feature.prioritySupport" "Priority support feature"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.feature.sla" "SLA feature"
check_grep "$WEB/components/PlanComparisonTable.tsx" "SecurityBadges" "Trust badges imported"
check_grep "$WEB/components/PlanComparisonTable.tsx" "pricing.trustBadges" "Trust badges footer"
check_grep "$WEB/components/PlanComparisonTable.tsx" "useI18n" "Uses i18n"

# ── Section 3: Public pricing page ──
echo ""
echo "▸ Public pricing page"
check_grep "$WEB/app/pricing/page.tsx" "PlanComparisonTable" "Uses PlanComparisonTable"
check_grep "$WEB/app/pricing/page.tsx" "pricing.title" "Pricing title key"
check_grep "$WEB/app/pricing/page.tsx" "pricing.subtitle" "Pricing subtitle key"
check_grep "$WEB/components/PublicLayout.tsx" "LanguageSwitcher" "Has language switcher (in PublicLayout)"
check_grep "$WEB/components/PublicLayout.tsx" "/portal/login" "CTA links to portal login (in PublicLayout)"

# ── Section 4: Portal billing integration ──
echo ""
echo "▸ Portal billing integration"
check_grep "$WEB/app/portal/billing/page.tsx" "PlanComparisonTable" "Billing imports PlanComparisonTable"
check_grep "$WEB/app/portal/billing/page.tsx" "handleCheckout" "Checkout handler preserved"
check_grep "$WEB/app/portal/billing/page.tsx" "withStepUp" "Step-up security preserved"

# ── Section 5: Landing page enhancement ──
echo ""
echo "▸ Landing page"
check_grep "$WEB/app/page.tsx" "/pricing" "Landing links to pricing"
check_grep "$WEB/app/page.tsx" "ctaStartFree\|pricing.startFree" "Start Free CTA on landing"

# ── Section 6: i18n key parity ──
echo ""
echo "▸ i18n key parity (EN/TR/ES)"
for KEY in "pricing.title" "pricing.subtitle" "pricing.monthly" "pricing.yearly" \
  "pricing.yearlyDiscount" "pricing.startFree" "pricing.upgrade" "pricing.currentPlan" \
  "pricing.contactSales" "pricing.perMonth" "pricing.perYear" "pricing.features" \
  "pricing.feature.conversations" "pricing.feature.messages" "pricing.feature.agents" \
  "pricing.feature.mfa" "pricing.feature.passkeys" "pricing.feature.auditLog" \
  "pricing.feature.customDomains" "pricing.feature.prioritySupport" "pricing.feature.sla" \
  "pricing.feature.teamManagement" "pricing.feature.widgetCustomization" \
  "pricing.feature.apiAccess" "pricing.included" "pricing.notIncluded" \
  "pricing.unlimited" "pricing.mostPopular" "pricing.trustedBy" "pricing.trustBadges"; do
  COUNT=$(grep -c "\"$KEY\"" "$TRANS" 2>/dev/null || echo "0")
  [ "$COUNT" -ge 3 ] && pass "i18n: $KEY (3 locales)" || fail "i18n: $KEY missing (found $COUNT)"
done

# ── Section 7: Smoke test — pricing page accessible ──
echo ""
echo "▸ Smoke tests"
if curl -s -m 5 http://localhost:3000 >/dev/null 2>&1; then
  PRICING_HTTP=$(curl -s -m 10 -o /dev/null -w "%{http_code}" http://localhost:3000/pricing)
  [ "$PRICING_HTTP" = "200" ] && pass "GET /pricing → 200" || fail "GET /pricing → $PRICING_HTTP"

  BILLING_HTTP=$(curl -s -m 10 -o /dev/null -w "%{http_code}" http://localhost:3000/portal/billing)
  [ "$BILLING_HTTP" = "200" ] && pass "GET /portal/billing → 200" || fail "GET /portal/billing → $BILLING_HTTP"
else
  echo "  ⚠️  Web server not running; skipping smoke tests"
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════"
echo " RESULTS: $PASS passed, $FAIL failed (of $TOTAL)"
echo "═══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo " ❌ STEP 11.31 FAIL"
  exit 1
else
  echo " ✅ STEP 11.31 PASS"
  exit 0
fi
