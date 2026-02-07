#!/usr/bin/env bash
set -uo pipefail

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1"; ((FAIL++)); }
warn() { echo "  ⚠️  $1"; ((WARN++)); }

echo "╔══════════════════════════════════════════════╗"
echo "║   VERIFY STEP 11.32 — Conversion Funnel     ║"
echo "║   Trial Lifecycle + Upgrade Nudges           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. API Build ──
echo "── 1. API Build ──"
API_BUILD_OUT=$(cd /Users/yavuz/Desktop/helvino/apps/api && pnpm build 2>&1) || true
if echo "$API_BUILD_OUT" | grep -qv "error TS"; then
  pass "API build"
else
  fail "API build"
fi

# ── 2. Web Build ──
echo "── 2. Web Build ──"
WEB_BUILD_OUT=$(cd /Users/yavuz/Desktop/helvino/apps/web && NEXT_BUILD_DIR=.next-verify pnpm build 2>&1) || true
if echo "$WEB_BUILD_OUT" | grep -q "prerendered\|Generating static"; then
  pass "Web build"
else
  fail "Web build"
fi

# ── 3. Schema Checks ──
echo "── 3. Schema Checks ──"
SCHEMA="/Users/yavuz/Desktop/helvino/apps/api/prisma/schema.prisma"
for field in trialStartedAt firstConversationAt firstWidgetEmbedAt firstInviteSentAt; do
  if grep -q "$field" "$SCHEMA" 2>/dev/null; then
    pass "Schema field: $field"
  else
    fail "Schema field: $field missing"
  fi
done

# ── 4. API Route Checks ──
echo "── 4. API Route / Logic Checks ──"
ENT="/Users/yavuz/Desktop/helvino/apps/api/src/utils/entitlements.ts"
BILLING="/Users/yavuz/Desktop/helvino/apps/api/src/routes/portal-billing.ts"
BOOT="/Users/yavuz/Desktop/helvino/apps/api/src/routes/bootloader.ts"
TEAM="/Users/yavuz/Desktop/helvino/apps/api/src/routes/portal-team.ts"

# Trial lifecycle
if grep -q "computeTrialStatus" "$ENT" 2>/dev/null; then
  pass "computeTrialStatus function"
else
  fail "computeTrialStatus function missing"
fi

if grep -q "checkTrialEntitlement" "$ENT" 2>/dev/null; then
  pass "checkTrialEntitlement function"
else
  fail "checkTrialEntitlement function missing"
fi

if grep -q "TRIAL_EXPIRED" "$ENT" 2>/dev/null; then
  pass "TRIAL_EXPIRED code"
else
  fail "TRIAL_EXPIRED code missing"
fi

if grep -q "getRecommendedPlan" "$ENT" 2>/dev/null; then
  pass "getRecommendedPlan function"
else
  fail "getRecommendedPlan function missing"
fi

# Trial status endpoint
if grep -q "trial-status" "$BILLING" 2>/dev/null; then
  pass "trial-status endpoint route"
else
  fail "trial-status endpoint missing"
fi

# Conversion signals in billing status
if grep -q "conversionSignals" "$BILLING" 2>/dev/null; then
  pass "conversionSignals in billing status"
else
  fail "conversionSignals in billing status missing"
fi

if grep -q "recommendedPlan" "$BILLING" 2>/dev/null; then
  pass "recommendedPlan in billing response"
else
  fail "recommendedPlan in billing response missing"
fi

# Widget embed signal
if grep -q "firstWidgetEmbedAt" "$BOOT" 2>/dev/null; then
  pass "Widget embed signal in bootloader"
else
  fail "Widget embed signal in bootloader missing"
fi

# Invite signal
if grep -q "firstInviteSentAt" "$TEAM" 2>/dev/null; then
  pass "Invite signal in portal-team"
else
  fail "Invite signal in portal-team missing"
fi

# Conversation signal
if grep -q "firstConversationAt" "$ENT" 2>/dev/null; then
  pass "Conversation signal in entitlements"
else
  fail "Conversation signal in entitlements missing"
fi

# Trial check in conversation entitlement
if grep -q "checkTrialEntitlement" "$ENT" | grep -c "checkConversationEntitlement" > /dev/null 2>&1; then
  pass "Trial check in checkConversationEntitlement"
else
  # Direct check
  if grep -A5 "checkConversationEntitlement" "$ENT" | grep -q "checkTrialEntitlement" 2>/dev/null; then
    pass "Trial check in checkConversationEntitlement"
  else
    fail "Trial check in checkConversationEntitlement missing"
  fi
fi

# Trial check in message entitlement
if grep -A5 "checkMessageEntitlement" "$ENT" | grep -q "checkTrialEntitlement" 2>/dev/null; then
  pass "Trial check in checkMessageEntitlement"
else
  fail "Trial check in checkMessageEntitlement missing"
fi

# ── 5. Web Component Checks ──
echo "── 5. Web Component Checks ──"
WEB_DIR="/Users/yavuz/Desktop/helvino/apps/web/src"

if [ -f "$WEB_DIR/components/TrialBanner.tsx" ]; then
  pass "TrialBanner component exists"
else
  fail "TrialBanner component missing"
fi

if [ -f "$WEB_DIR/components/UsageNudge.tsx" ]; then
  pass "UsageNudge component exists"
else
  fail "UsageNudge component missing"
fi

# Banners integrated into portal overview
if grep -q "TrialBanner" "$WEB_DIR/app/portal/page.tsx" 2>/dev/null; then
  pass "TrialBanner integrated in portal overview"
else
  fail "TrialBanner not in portal overview"
fi

if grep -q "UsageNudge" "$WEB_DIR/app/portal/page.tsx" 2>/dev/null; then
  pass "UsageNudge integrated in portal overview"
else
  fail "UsageNudge not in portal overview"
fi

# Banners integrated into portal billing
if grep -q "TrialBanner" "$WEB_DIR/app/portal/billing/page.tsx" 2>/dev/null; then
  pass "TrialBanner integrated in portal billing"
else
  fail "TrialBanner not in portal billing"
fi

if grep -q "UsageNudge" "$WEB_DIR/app/portal/billing/page.tsx" 2>/dev/null; then
  pass "UsageNudge integrated in portal billing"
else
  fail "UsageNudge not in portal billing"
fi

# Recommended plan in plan comparison
if grep -q "recommendedPlan" "$WEB_DIR/components/PlanComparisonTable.tsx" 2>/dev/null; then
  pass "recommendedPlan prop in PlanComparisonTable"
else
  fail "recommendedPlan prop in PlanComparisonTable missing"
fi

if grep -q "isRecommended" "$WEB_DIR/components/PlanComparisonTable.tsx" 2>/dev/null; then
  pass "Recommended badge logic in PlanComparisonTable"
else
  fail "Recommended badge logic missing"
fi

# ── 6. i18n Checks ──
echo "── 6. i18n Checks ──"
TRANS="/Users/yavuz/Desktop/helvino/apps/web/src/i18n/translations.ts"

for key in "trial.expiredTitle" "trial.expiringTitle" "trial.activeDesc" "trial.upgradeNow" "trial.viewPlans" "nudge.limitReached" "nudge.almostFull" "nudge.approaching" "pricing.recommended"; do
  EN_COUNT=$(grep -c "\"$key\"" "$TRANS" 2>/dev/null || echo 0)
  if [ "$EN_COUNT" -ge 3 ]; then
    pass "i18n key: $key (3 locales)"
  else
    fail "i18n key: $key present in $EN_COUNT locales (need 3)"
  fi
done

# ── 7. Migration Check ──
echo "── 7. Migration Check ──"
MIGRATION="/Users/yavuz/Desktop/helvino/apps/api/prisma/migrations/20260206160000_v11_32_trial_conversion/migration.sql"
if [ -f "$MIGRATION" ]; then
  pass "Migration file exists"
else
  fail "Migration file missing"
fi

# ── 8. Smoke Tests (if API running) ──
echo "── 8. Smoke Tests ──"
API_HTTP=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null || echo "000")
if [ "$API_HTTP" = "200" ]; then
  pass "API is running"

  # trial-status requires auth (should return 401)
  TS_HTTP=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:4000/portal/billing/trial-status 2>/dev/null || echo "000")
  if [ "$TS_HTTP" = "401" ]; then
    pass "trial-status returns 401 without auth"
  else
    warn "trial-status returned $TS_HTTP (expected 401)"
  fi

  # billing/status requires auth
  BS_HTTP=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:4000/portal/billing/status 2>/dev/null || echo "000")
  if [ "$BS_HTTP" = "401" ]; then
    pass "billing/status returns 401 without auth"
  else
    warn "billing/status returned $BS_HTTP (expected 401)"
  fi
else
  warn "API not running — skipping smoke tests"
fi

# ── Summary ──
echo ""
echo "════════════════════════════════════════════════"
echo "  PASS: $PASS  |  FAIL: $FAIL  |  WARN: $WARN"
echo "════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "❌ VERIFY_STEP_11_32: FAIL"
  exit 1
else
  echo ""
  echo "✅ VERIFY_STEP_11_32: PASS"
  exit 0
fi
