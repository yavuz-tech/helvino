#!/bin/bash

# Step 11.1 Verification Script
# Verifies Crisp-style embed security UI implementation

echo "🔒 Step 11.1: Crisp-style Embed Security UI - Verification"
echo "============================================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

# Helper function for test results
pass() {
  echo -e "  ${GREEN}✅ PASS${NC}: $1"
  ((PASS_COUNT++))
}

fail() {
  echo -e "  ${RED}❌ FAIL${NC}: $1"
  ((FAIL_COUNT++))
}

warn() {
  echo -e "  ${YELLOW}⚠️  WARN${NC}: $1"
}

# Test 1: Verify security page exists
echo "Test 1: Verify security page file exists"
echo "========================================="

if [ -f "apps/web/src/app/dashboard/settings/security/page.tsx" ]; then
  LINES=$(wc -l < apps/web/src/app/dashboard/settings/security/page.tsx)
  pass "Security page file exists ($LINES lines)"
else
  fail "Security page file not found"
  exit 1
fi

echo ""

# Test 2: Verify key UI elements in security page
echo "Test 2: Verify security page contains required UI elements"
echo "=========================================================="

SECURITY_PAGE="apps/web/src/app/dashboard/settings/security/page.tsx"

if grep -q "Site ID" "$SECURITY_PAGE"; then
  pass "Contains 'Site ID' heading"
else
  fail "Missing 'Site ID' heading"
fi

if grep -q "ROTATE" "$SECURITY_PAGE"; then
  pass "Contains 'ROTATE' confirmation logic"
else
  fail "Missing 'ROTATE' confirmation"
fi

if grep -q "allowedDomains" "$SECURITY_PAGE"; then
  pass "Contains 'allowedDomains' editor"
else
  fail "Missing allowed domains editor"
fi

if grep -q "handleCopy" "$SECURITY_PAGE"; then
  pass "Contains copy button functionality"
else
  fail "Missing copy button"
fi

if grep -q "rotate-site-id" "$SECURITY_PAGE"; then
  pass "Contains rotate endpoint call"
else
  fail "Missing rotate endpoint call"
fi

if grep -q "allowLocalhost" "$SECURITY_PAGE"; then
  pass "Contains allowLocalhost toggle"
else
  fail "Missing allowLocalhost toggle"
fi

echo ""

# Test 3: Verify navigation added to main settings
echo "Test 3: Verify settings page navigation"
echo "========================================"

SETTINGS_PAGE="apps/web/src/app/dashboard/settings/page.tsx"

if grep -q "Security" "$SETTINGS_PAGE"; then
  pass "Settings page links to Security"
else
  fail "Settings page missing Security link"
fi

if grep -q "/dashboard/settings/security" "$SETTINGS_PAGE"; then
  pass "Correct route path used"
else
  fail "Security route path not found"
fi

echo ""

# Test 4: Verify API security endpoints exist
echo "Test 4: Verify API security route file"
echo "======================================="

if [ -f "apps/api/src/routes/security.ts" ]; then
  LINES=$(wc -l < apps/api/src/routes/security.ts)
  pass "Security routes file exists ($LINES lines)"
else
  fail "Security routes file not found"
  exit 1
fi

if grep -q "GET.*org/:key/security" "apps/api/src/routes/security.ts"; then
  pass "Contains GET /api/org/:key/security endpoint"
else
  fail "Missing GET security endpoint"
fi

if grep -q "PATCH.*org/:key/security" "apps/api/src/routes/security.ts"; then
  pass "Contains PATCH /api/org/:key/security endpoint"
else
  fail "Missing PATCH security endpoint"
fi

if grep -q "rotate-site-id" "apps/api/src/routes/security.ts"; then
  pass "Contains rotate-site-id endpoint"
else
  fail "Missing rotate endpoint"
fi

if grep -q "requireAdmin" "apps/api/src/routes/security.ts"; then
  pass "Security endpoints protected by requireAdmin"
else
  fail "Security endpoints not protected"
fi

echo ""

# Test 5: Verify site ID utilities exist
echo "Test 5: Verify site ID generation utilities"
echo "============================================"

if [ -f "apps/api/src/utils/site-id.ts" ]; then
  pass "Site ID utilities file exists"
else
  fail "Site ID utilities file not found"
fi

if grep -q "generateSiteId" "apps/api/src/utils/site-id.ts"; then
  pass "Contains generateSiteId function"
else
  fail "Missing generateSiteId function"
fi

if grep -q "site_" "apps/api/src/utils/site-id.ts"; then
  pass "Uses correct site_ prefix"
else
  fail "Missing site_ prefix"
fi

echo ""

# Test 6: Verify domain validation utilities
echo "Test 6: Verify domain validation utilities"
echo "==========================================="

if [ -f "apps/api/src/utils/domain-validation.ts" ]; then
  pass "Domain validation utilities file exists"
else
  fail "Domain validation utilities file not found"
fi

if grep -q "matchesDomainPattern" "apps/api/src/utils/domain-validation.ts"; then
  pass "Contains matchesDomainPattern function"
else
  fail "Missing domain pattern matching"
fi

if grep -q "isLocalhost" "apps/api/src/utils/domain-validation.ts"; then
  pass "Contains isLocalhost function"
else
  fail "Missing localhost detection"
fi

if grep -q "wildcard\|\\*\\." "apps/api/src/utils/domain-validation.ts"; then
  pass "Contains wildcard pattern support"
else
  fail "Missing wildcard support"
fi

echo ""

# Test 7: Verify Prisma schema updated
echo "Test 7: Verify Prisma schema updates"
echo "====================================="

SCHEMA_FILE="apps/api/prisma/schema.prisma"

if grep -q "siteId.*String.*@unique" "$SCHEMA_FILE"; then
  pass "Schema contains siteId field"
else
  fail "Schema missing siteId"
fi

if grep -q "allowLocalhost.*Boolean" "$SCHEMA_FILE"; then
  pass "Schema contains allowLocalhost field"
else
  fail "Schema missing allowLocalhost"
fi

if grep -q "updatedAt.*DateTime.*@updatedAt" "$SCHEMA_FILE"; then
  pass "Schema contains updatedAt field"
else
  fail "Schema missing updatedAt"
fi

echo ""

# Test 8: Verify migration exists
echo "Test 8: Verify migration created"
echo "================================="

if [ -f "apps/api/prisma/migrations/20260206001500_add_site_id_and_security/migration.sql" ]; then
  pass "Migration file exists"
else
  fail "Migration file not found"
fi

if grep -q "siteId" "apps/api/prisma/migrations/20260206001500_add_site_id_and_security/migration.sql"; then
  pass "Migration includes siteId column"
else
  fail "Migration missing siteId"
fi

echo ""

# Test 9: Verify widget supports HELVINO_SITE_ID
echo "Test 9: Verify widget site ID support"
echo "======================================"

WIDGET_API="apps/widget/src/api.ts"

if grep -q "HELVINO_SITE_ID" "$WIDGET_API"; then
  pass "Widget checks for HELVINO_SITE_ID"
else
  fail "Widget missing HELVINO_SITE_ID check"
fi

if grep -q "x-site-id" "$WIDGET_API"; then
  pass "Widget sends x-site-id header"
else
  fail "Widget missing x-site-id header"
fi

if grep -q "HELVINO_ORG_KEY" "$WIDGET_API"; then
  pass "Widget still supports legacy HELVINO_ORG_KEY"
else
  fail "Widget missing legacy support"
fi

echo ""

# Test 10: Verify embed demo updated
echo "Test 10: Verify embed demo documentation"
echo "========================================="

EMBED_DEMO="apps/widget/public/embed-demo.html"

if [ -f "$EMBED_DEMO" ]; then
  pass "Embed demo file exists"
  
  if grep -q "HELVINO_SITE_ID" "$EMBED_DEMO"; then
    pass "Demo includes HELVINO_SITE_ID instructions"
  else
    warn "Demo missing HELVINO_SITE_ID docs"
  fi
  
  if grep -q "HELVINO_ORG_KEY" "$EMBED_DEMO"; then
    pass "Demo includes legacy HELVINO_ORG_KEY note"
  else
    warn "Demo missing legacy note"
  fi
else
  fail "Embed demo file not found"
fi

echo ""

# Test 11: Verify bootloader accepts both methods
echo "Test 11: Verify bootloader dual support"
echo "========================================"

BOOTLOADER="apps/api/src/routes/bootloader.ts"

if grep -q "x-site-id" "$BOOTLOADER"; then
  pass "Bootloader accepts x-site-id header"
else
  fail "Bootloader missing x-site-id support"
fi

if grep -q "x-org-key" "$BOOTLOADER"; then
  pass "Bootloader still accepts x-org-key (legacy)"
else
  fail "Bootloader missing legacy support"
fi

echo ""

# Test 12: Build skipped (handled by VERIFY_ALL.sh)
echo "Test 12: Build check"
echo "=============================="
echo "  SKIP: Build verified by VERIFY_ALL.sh (no redundant build here)"
echo ""

# Summary
echo "============================================================="
echo "Step 11.1 Verification Summary"
echo ""
echo "Results:"
echo -e "  ${GREEN}PASSED${NC}: $PASS_COUNT"
if [ $FAIL_COUNT -gt 0 ]; then
  echo "  NOT PASSED: $FAIL_COUNT"
  echo "Status: CHECK ERRORS ABOVE"
  exit 1
fi
echo ""
echo "  STEP 11.1 VERIFICATION: PASS"
echo ""
