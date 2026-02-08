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


SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  FAIL: $1"; }
section() { echo ""; echo "=== $1 ==="; }

echo "================================================================"
echo "STEP 11.52 VERIFICATION: Widget Appearance Studio"
echo "================================================================"

section "1. Prisma Schema"

# Check WidgetSettings model exists
if grep -q "model WidgetSettings" apps/api/prisma/schema.prisma 2>/dev/null; then
  pass "WidgetSettings model exists"
else
  fail "WidgetSettings model missing"
fi

# Check required fields
for field in orgId primaryColor position launcher welcomeTitle welcomeMessage; do
  if grep -q "model WidgetSettings" apps/api/prisma/schema.prisma && \
     grep -A 20 "model WidgetSettings" apps/api/prisma/schema.prisma | grep -q "$field"; then
    pass "WidgetSettings has field: $field"
  else
    fail "WidgetSettings missing field: $field"
  fi
done

section "2. Migration"

if [ -d "apps/api/prisma/migrations/20260207030000_v11_52_widget_appearance_settings" ]; then
  pass "Migration folder exists"
else
  fail "Migration folder missing"
fi

if [ -f "apps/api/prisma/migrations/20260207030000_v11_52_widget_appearance_settings/migration.sql" ]; then
  pass "Migration SQL file exists"
  if grep -q "CREATE TABLE.*widget_settings" "apps/api/prisma/migrations/20260207030000_v11_52_widget_appearance_settings/migration.sql"; then
    pass "Migration creates widget_settings table"
  else
    fail "Migration does not create widget_settings table"
  fi
else
  fail "Migration SQL file missing"
fi

section "3. API Routes"

if [ -f "apps/api/src/routes/portal-widget-settings.ts" ]; then
  pass "portal-widget-settings.ts exists"
  
  # Check GET endpoint
  if grep -q "GET.*portal/widget/settings" apps/api/src/routes/portal-widget-settings.ts || \
     grep -q 'fastify.get.*"/portal/widget/settings"' apps/api/src/routes/portal-widget-settings.ts; then
    pass "GET /portal/widget/settings endpoint defined"
  else
    fail "GET endpoint missing"
  fi
  
  # Check PUT endpoint
  if grep -q "PUT.*portal/widget/settings" apps/api/src/routes/portal-widget-settings.ts || \
     grep -q 'fastify.put.*"/portal/widget/settings"' apps/api/src/routes/portal-widget-settings.ts; then
    pass "PUT /portal/widget/settings endpoint defined"
  else
    fail "PUT endpoint missing"
  fi
  
  # Check validations
  if grep -q "isValidHexColor\|hex.*color\|#[0-9A-F]" apps/api/src/routes/portal-widget-settings.ts; then
    pass "Color validation present"
  else
    fail "Color validation missing"
  fi
  
  # Check audit log
  if grep -q "writeAuditLog\|audit" apps/api/src/routes/portal-widget-settings.ts; then
    pass "Audit log integration present"
  else
    fail "Audit log integration missing"
  fi
else
  fail "portal-widget-settings.ts missing"
fi

# Check routes registered in index.ts
if grep -q "portalWidgetSettingsRoutes" apps/api/src/index.ts; then
  pass "Routes registered in index.ts"
else
  fail "Routes not registered in index.ts"
fi

section "4. Bootloader Integration"

if grep -q "widgetSettings\|WidgetSettings" apps/api/src/routes/bootloader.ts; then
  pass "Bootloader includes widgetSettings"
else
  fail "Bootloader does not include widgetSettings"
fi

# Check that bootloader fetches from DB
if grep -q "prisma.widgetSettings\|widgetSettings.findUnique" apps/api/src/routes/bootloader.ts; then
  pass "Bootloader fetches widgetSettings from DB"
else
  fail "Bootloader does not fetch widgetSettings from DB"
fi

section "5. Portal UI"

if [ -f "apps/web/src/app/portal/widget-appearance/page.tsx" ]; then
  pass "Portal widget-appearance page exists"
  
  # Check for form controls
  if grep -q "primaryColor\|welcomeTitle\|welcomeMessage" apps/web/src/app/portal/widget-appearance/page.tsx; then
    pass "Form controls present"
  else
    fail "Form controls missing"
  fi
  
  # Check for preview
  if grep -q "preview\|Preview" apps/web/src/app/portal/widget-appearance/page.tsx; then
    pass "Live preview component present"
  else
    fail "Live preview missing"
  fi
  
  # Check for save functionality
  if grep -q "handleSave\|PUT.*widget/settings" apps/web/src/app/portal/widget-appearance/page.tsx; then
    pass "Save functionality present"
  else
    fail "Save functionality missing"
  fi
else
  fail "Portal widget-appearance page missing"
fi

section "6. Navigation"

if grep -q "widget-appearance\|widgetAppearance" apps/web/src/components/PortalLayout.tsx; then
  pass "Widget appearance link in PortalLayout nav"
else
  fail "Widget appearance link not in PortalLayout nav"
fi

section "7. i18n Keys"

I18N_FILE="$_I18N_COMPAT"

# Check EN keys
for key in "widgetAppearance.title" "widgetAppearance.primaryColor" "widgetAppearance.position" \
           "widgetAppearance.welcomeTitle" "widgetAppearance.welcomeMessage" \
           "widgetAppearance.save" "widgetAppearance.preview" "common.invalidColor" "common.saveFailed"; do
  if grep -q "\"$key\"" "$I18N_FILE"; then
    pass "i18n key exists: $key"
  else
    fail "i18n key missing: $key"
  fi
done

# Check TR/ES parity (basic count check)
EN_COUNT=$(grep -c "widgetAppearance\." "$I18N_FILE" | head -1 || echo "0")
if [ "$EN_COUNT" -gt 10 ]; then
  pass "i18n keys present (EN: $EN_COUNT)"
else
  fail "Insufficient i18n keys (EN: $EN_COUNT)"
fi

section "8. Documentation"

if [ -f "docs/STEP_11_52_WIDGET_APPEARANCE_STUDIO.md" ]; then
  pass "Step documentation exists"
  if grep -q "WidgetSettings\|Widget Appearance" docs/STEP_11_52_WIDGET_APPEARANCE_STUDIO.md; then
    pass "Documentation covers widget appearance"
  else
    fail "Documentation incomplete"
  fi
else
  fail "Step documentation missing"
fi

section "9. Builds"

echo "  Building API..."
if (cd apps/api && npx pnpm build > /dev/null 2>&1); then
  pass "API build successful"
else
  fail "API build failed"
fi

echo "  Building Web..."
if (cd apps/web && NEXT_BUILD_DIR=.next-verify npx pnpm build > /dev/null 2>&1); then
  pass "Web build successful"
  rm -rf apps/web/.next-verify 2>/dev/null || true
else
  fail "Web build failed"
fi

section "Summary"

echo ""
echo "────────────────────────────────────────"
echo "  Total: $TOTAL | PASS: $PASS | FAIL: $FAIL"
echo "────────────────────────────────────────"

if [ "$FAIL" -eq 0 ]; then
  echo "  VERIFY_STEP_11_52: PASS"
  exit 0
else
  echo "  VERIFY_STEP_11_52: FAIL ($FAIL failures)"
  exit 1
fi
