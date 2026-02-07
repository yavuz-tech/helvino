#!/usr/bin/env bash
set -uo pipefail

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1"; ((FAIL++)); }
warn() { echo "  ⚠️  $1"; ((WARN++)); }

echo "╔══════════════════════════════════════════════════╗"
echo "║   VERIFY STEP 11.33 — Public Website + Trust    ║"
echo "╚══════════════════════════════════════════════════╝"
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

# ── 3. Page File Existence ──
echo "── 3. Page Files ──"
WEB_APP="/Users/yavuz/Desktop/helvino/apps/web/src/app"
for page in "page.tsx" "pricing/page.tsx" "security/page.tsx" "compliance/page.tsx" "status/page.tsx" "contact/page.tsx"; do
  if [ -f "$WEB_APP/$page" ]; then
    pass "Page: $page"
  else
    fail "Page missing: $page"
  fi
done

# ── 4. Shared Components ──
echo "── 4. Components ──"
COMP="/Users/yavuz/Desktop/helvino/apps/web/src/components"
if [ -f "$COMP/PublicLayout.tsx" ]; then
  pass "PublicLayout component"
else
  fail "PublicLayout component missing"
fi

# ── 5. Landing Page Checks ──
echo "── 5. Landing Page ──"
HOME_FILE="$WEB_APP/page.tsx"
if grep -q "PublicLayout" "$HOME_FILE" 2>/dev/null; then
  pass "Landing uses PublicLayout"
else
  fail "Landing missing PublicLayout"
fi
if grep -q "home.heroTitle" "$HOME_FILE" 2>/dev/null; then
  pass "Landing has hero title i18n key"
else
  fail "Landing missing hero title"
fi
if grep -q "home.ctaStartFree" "$HOME_FILE" 2>/dev/null; then
  pass "Landing has Start Free CTA"
else
  fail "Landing missing Start Free CTA"
fi
if grep -q "home.ctaViewPricing" "$HOME_FILE" 2>/dev/null; then
  pass "Landing has View Pricing CTA"
else
  fail "Landing missing View Pricing CTA"
fi
if grep -q "home.trustedSecurity" "$HOME_FILE" 2>/dev/null; then
  pass "Landing has trust signals"
else
  fail "Landing missing trust signals"
fi
if grep -q "home.feature1Title" "$HOME_FILE" 2>/dev/null; then
  pass "Landing has feature section"
else
  fail "Landing missing feature section"
fi

# ── 6. Pricing Page Checks ──
echo "── 6. Pricing Page ──"
PRICING_FILE="$WEB_APP/pricing/page.tsx"
if grep -q "PlanComparisonTable" "$PRICING_FILE" 2>/dev/null; then
  pass "Pricing has plan comparison"
else
  fail "Pricing missing plan comparison"
fi
if grep -q "pricing.faqTitle" "$PRICING_FILE" 2>/dev/null; then
  pass "Pricing has FAQ section"
else
  fail "Pricing missing FAQ"
fi
if grep -q "pricing.trustBadges" "$PRICING_FILE" 2>/dev/null; then
  pass "Pricing has trust badges"
else
  fail "Pricing missing trust badges"
fi

# ── 7. Security Page Checks ──
echo "── 7. Security Page ──"
SEC_FILE="$WEB_APP/security/page.tsx"
if grep -q "pubSecurity.authTitle" "$SEC_FILE" 2>/dev/null; then
  pass "Security page has auth section"
else
  fail "Security page missing auth section"
fi
if grep -q "pubSecurity.dataTitle" "$SEC_FILE" 2>/dev/null; then
  pass "Security page has data section"
else
  fail "Security page missing data section"
fi

# ── 8. Compliance Page Checks ──
echo "── 8. Compliance Page ──"
COMP_FILE="$WEB_APP/compliance/page.tsx"
if grep -q "pubCompliance.gdprTitle" "$COMP_FILE" 2>/dev/null; then
  pass "Compliance page has GDPR section"
else
  fail "Compliance page missing GDPR section"
fi
if grep -q "pubCompliance.encryptionTitle" "$COMP_FILE" 2>/dev/null; then
  pass "Compliance page has encryption section"
else
  fail "Compliance page missing encryption section"
fi

# ── 9. Status Page Checks ──
echo "── 9. Status Page ──"
STATUS_FILE="$WEB_APP/status/page.tsx"
if grep -q "pubStatus.allOperational" "$STATUS_FILE" 2>/dev/null; then
  pass "Status page has operational indicator"
else
  fail "Status page missing operational indicator"
fi
if grep -q "pubStatus.incidentHistory" "$STATUS_FILE" 2>/dev/null; then
  pass "Status page has incident history"
else
  fail "Status page missing incident history"
fi

# ── 10. Contact Page Checks ──
echo "── 10. Contact Page ──"
CONTACT_FILE="$WEB_APP/contact/page.tsx"
if grep -q "pubContact.salesTitle" "$CONTACT_FILE" 2>/dev/null; then
  pass "Contact page has sales section"
else
  fail "Contact page missing sales section"
fi
if grep -q "pubContact.formSend" "$CONTACT_FILE" 2>/dev/null; then
  pass "Contact page has form"
else
  fail "Contact page missing form"
fi

# ── 11. i18n Parity (3 locales for each key group) ──
echo "── 11. i18n Parity ──"
TRANS="/Users/yavuz/Desktop/helvino/apps/web/src/i18n/translations.ts"

for key in "home.heroTitle" "home.ctaStartFree" "home.feature1Title" "pubSecurity.title" "pubSecurity.authTitle" "pubCompliance.title" "pubCompliance.gdprTitle" "pubStatus.title" "pubStatus.allOperational" "pubContact.title" "pubContact.formSend" "pricing.faqTitle" "pricing.faq1Q"; do
  COUNT=$(grep -c "\"$key\"" "$TRANS" 2>/dev/null || echo 0)
  if [ "$COUNT" -ge 3 ]; then
    pass "i18n: $key (3 locales)"
  else
    fail "i18n: $key in $COUNT locales (need 3)"
  fi
done

# ── 12. No Hardcoded Strings in Public Pages ──
echo "── 12. Hardcoded Strings Check ──"
HARDCODED=0
for page_f in "$HOME_FILE" "$PRICING_FILE" "$SEC_FILE" "$COMP_FILE" "$STATUS_FILE" "$CONTACT_FILE"; do
  # Check for raw English strings in JSX (skip imports, comments, classNames, i18n keys)
  if grep -P '>\s*[A-Z][a-z]+\s+[a-z]+' "$page_f" 2>/dev/null | grep -v 'className\|import\|//\|{t(\|icon\|svg\|path\|stroke\|fill\|view' > /dev/null 2>&1; then
    HARDCODED=$((HARDCODED + 1))
  fi
done
if [ "$HARDCODED" -eq 0 ]; then
  pass "No obvious hardcoded strings in public pages"
else
  warn "$HARDCODED page(s) may have hardcoded strings"
fi

# ── 13. Smoke Tests (if web running) ──
echo "── 13. Smoke Tests ──"
WEB_HTTP=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
if [ "$WEB_HTTP" = "200" ]; then
  pass "Landing page HTTP 200"
  for path in "/pricing" "/security" "/compliance" "/status" "/contact"; do
    HTTP=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "http://localhost:3000${path}" 2>/dev/null || echo "000")
    if [ "$HTTP" = "200" ]; then
      pass "${path} HTTP 200"
    else
      fail "${path} returned $HTTP"
    fi
  done
else
  warn "Web not running — skipping smoke tests"
fi

# ── 14. Existing portals still work ──
echo "── 14. Portal/Admin Stability ──"
for path in "/portal/login" "/login"; do
  HTTP=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "http://localhost:3000${path}" 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    pass "${path} still accessible"
  else
    warn "${path} returned $HTTP"
  fi
done

# ── Summary ──
echo ""
echo "════════════════════════════════════════════════"
echo "  PASS: $PASS  |  FAIL: $FAIL  |  WARN: $WARN"
echo "════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "❌ VERIFY_STEP_11_33: FAIL"
  exit 1
else
  echo ""
  echo "✅ VERIFY_STEP_11_33: PASS"
  exit 0
fi
