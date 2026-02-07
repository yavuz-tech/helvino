#!/usr/bin/env bash
#
# VERIFY_STEP_11_45.sh
# Step 11.45 — In-App Notifications: Event Wiring + Severity + Preference Enforcement
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PASS=0
FAIL=0

check() {
  local msg="$1"
  shift
  printf "%-70s" "$msg"
  if "$@" > /dev/null 2>&1; then
    echo "✅ PASS"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL"
    FAIL=$((FAIL + 1))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " STEP 11.45 — Notification Event Wiring + Severity + Category"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ────────────────────────────────────────────────────────────────
# 1. Prisma Schema
# ────────────────────────────────────────────────────────────────
echo
echo "1️⃣  Prisma Schema Checks"

check "1.1) Notification has sourceAction field" \
  grep -q 'sourceAction.*String' apps/api/prisma/schema.prisma

check "1.2) Migration for sourceAction exists" \
  test -f apps/api/prisma/migrations/20260206250000_v11_45_notification_source_action/migration.sql

check "1.3) Migration adds sourceAction column" \
  grep -q 'ADD COLUMN.*sourceAction' apps/api/prisma/migrations/20260206250000_v11_45_notification_source_action/migration.sql

# ────────────────────────────────────────────────────────────────
# 2. Notification Utilities (apps/api/src/utils/notifications.ts)
# ────────────────────────────────────────────────────────────────
echo
echo "2️⃣  Notification Utility Helpers"

check "2.1) createNotificationForOrgUsers exists" \
  grep -q 'export.*function createNotificationForOrgUsers' apps/api/src/utils/notifications.ts

check "2.2) Preference enforcement logic present (categoryToPrefField)" \
  grep -q 'categoryToPrefField' apps/api/src/utils/notifications.ts

check "2.3) Dedupe logic present (DEDUPE_WINDOW_MS)" \
  grep -q 'DEDUPE_WINDOW_MS' apps/api/src/utils/notifications.ts

check "2.4) Audit log on emit (notifications.emitted)" \
  grep -q 'notifications.emitted' apps/api/src/utils/notifications.ts

check "2.5) emitMfaEnabled helper exists" \
  grep -q 'export.*function emitMfaEnabled' apps/api/src/utils/notifications.ts

check "2.6) emitMfaDisabled helper exists" \
  grep -q 'export.*function emitMfaDisabled' apps/api/src/utils/notifications.ts

check "2.7) emitPasskeyRegistered helper exists" \
  grep -q 'export.*function emitPasskeyRegistered' apps/api/src/utils/notifications.ts

check "2.8) emitPasskeyRevoked helper exists" \
  grep -q 'export.*function emitPasskeyRevoked' apps/api/src/utils/notifications.ts

check "2.9) emitRecoveryApproved helper exists" \
  grep -q 'export.*function emitRecoveryApproved' apps/api/src/utils/notifications.ts

check "2.10) emitRecoveryRejected helper exists" \
  grep -q 'export.*function emitRecoveryRejected' apps/api/src/utils/notifications.ts

check "2.11) emitEmergencyTokenUsed helper exists" \
  grep -q 'export.*function emitEmergencyTokenUsed' apps/api/src/utils/notifications.ts

check "2.12) emitBillingLocked helper exists" \
  grep -q 'export.*function emitBillingLocked' apps/api/src/utils/notifications.ts

check "2.13) emitBillingUnlocked helper exists" \
  grep -q 'export.*function emitBillingUnlocked' apps/api/src/utils/notifications.ts

check "2.14) emitWidgetNeedsAttention helper exists" \
  grep -q 'export.*function emitWidgetNeedsAttention' apps/api/src/utils/notifications.ts

# ────────────────────────────────────────────────────────────────
# 3. Event Wiring in Route Files
# ────────────────────────────────────────────────────────────────
echo
echo "3️⃣  Event Wiring Checks"

check "3.1) MFA enabled notification wired (portal-mfa)" \
  grep -q 'emitMfaEnabled' apps/api/src/routes/portal-mfa.ts

check "3.2) MFA disabled notification wired (portal-mfa)" \
  grep -q 'emitMfaDisabled' apps/api/src/routes/portal-mfa.ts

check "3.3) Passkey registered notification wired (webauthn-routes)" \
  grep -q 'emitPasskeyRegistered' apps/api/src/routes/webauthn-routes.ts

check "3.4) Passkey revoked notification wired (webauthn-routes)" \
  grep -q 'emitPasskeyRevoked' apps/api/src/routes/webauthn-routes.ts

check "3.5) Recovery approved notification wired (recovery-routes)" \
  grep -q 'emitRecoveryApproved' apps/api/src/routes/recovery-routes.ts

check "3.6) Recovery rejected notification wired (recovery-routes)" \
  grep -q 'emitRecoveryRejected' apps/api/src/routes/recovery-routes.ts

check "3.7) Emergency token used notification wired (recovery-routes)" \
  grep -q 'emitEmergencyTokenUsed' apps/api/src/routes/recovery-routes.ts

check "3.8) Billing locked notification wired (internal-admin)" \
  grep -q 'emitBillingLocked' apps/api/src/routes/internal-admin.ts

check "3.9) Billing unlocked notification wired (internal-admin)" \
  grep -q 'emitBillingUnlocked' apps/api/src/routes/internal-admin.ts

check "3.10) Widget domain mismatch notification wired (domain-allowlist)" \
  grep -q 'emitWidgetNeedsAttention' apps/api/src/middleware/domain-allowlist.ts

# ────────────────────────────────────────────────────────────────
# 4. Portal Notifications API Routes (category/severity/sourceAction)
# ────────────────────────────────────────────────────────────────
echo
echo "4️⃣  Portal Notifications API Route Updates"

check "4.1) Portal notifications route accepts category param" \
  grep -q 'category.*string' apps/api/src/routes/portal-notifications.ts

check "4.2) Response includes sourceAction field" \
  grep -q 'sourceAction' apps/api/src/routes/portal-notifications.ts

check "4.3) Response includes category field" \
  grep -q 'category.*e.type' apps/api/src/routes/portal-notifications.ts

# ────────────────────────────────────────────────────────────────
# 5. Web UI (Notifications Page)
# ────────────────────────────────────────────────────────────────
echo
echo "5️⃣  Web UI — Notifications Page"

check "5.1) Notifications page exists" \
  test -f apps/web/src/app/portal/notifications/page.tsx

check "5.2) Category filter state present (categoryFilter)" \
  grep -q 'categoryFilter' apps/web/src/app/portal/notifications/page.tsx

check "5.3) Category filter passed to API call" \
  grep -q 'categoryFilter.*params.set' apps/web/src/app/portal/notifications/page.tsx

check "5.4) Category dropdown UI present (select)" \
  grep -q 'notifications.filter.category' apps/web/src/app/portal/notifications/page.tsx

check "5.5) Severity badge displayed" \
  grep -q 'sev.pill' apps/web/src/app/portal/notifications/page.tsx

check "5.6) Category badge displayed" \
  grep -q 'notifications.category' apps/web/src/app/portal/notifications/page.tsx

# ────────────────────────────────────────────────────────────────
# 6. i18n Parity (EN/TR/ES)
# ────────────────────────────────────────────────────────────────
echo
echo "6️⃣  i18n Key Parity"

check "6.1) EN: notifications.filter.category exists" \
  grep -q '"notifications.filter.category":' apps/web/src/i18n/translations.ts

check "6.2) EN: notifications.category.security exists" \
  grep -q '"notifications.category.security":' apps/web/src/i18n/translations.ts

check "6.3) EN: notif.security.mfaEnabled.title exists" \
  grep -q '"notif.security.mfaEnabled.title":' apps/web/src/i18n/translations.ts

check "6.4) EN: notif.billing.locked.title exists" \
  grep -q '"notif.billing.locked.title":' apps/web/src/i18n/translations.ts

check "6.5) TR: notifications.filter.category exists" \
  sh -c 'grep -A2000 "const tr.*=" apps/web/src/i18n/translations.ts | grep -q "\"notifications.filter.category\":"'

check "6.6) TR: notif.security.mfaEnabled.title exists" \
  sh -c 'grep -A2000 "const tr.*=" apps/web/src/i18n/translations.ts | grep -q "\"notif.security.mfaEnabled.title\":"'

check "6.7) ES: notifications.filter.category exists" \
  sh -c 'grep -A2000 "const es.*=" apps/web/src/i18n/translations.ts | grep -q "\"notifications.filter.category\":"'

check "6.8) ES: notif.security.mfaEnabled.title exists" \
  sh -c 'grep -A2000 "const es.*=" apps/web/src/i18n/translations.ts | grep -q "\"notif.security.mfaEnabled.title\":"'

# ────────────────────────────────────────────────────────────────
# 7. Documentation
# ────────────────────────────────────────────────────────────────
echo
echo "7️⃣  Documentation"

check "7.1) STEP_11_45 docs exist" \
  test -f docs/STEP_11_45_NOTIFICATIONS_EVENTS.md

check "7.2) Docs mention sourceAction" \
  grep -q 'sourceAction' docs/STEP_11_45_NOTIFICATIONS_EVENTS.md

check "7.3) Docs mention dedupe" \
  grep -q 'dedupe' docs/STEP_11_45_NOTIFICATIONS_EVENTS.md

# ────────────────────────────────────────────────────────────────
# 8. API Smoke Tests
# ────────────────────────────────────────────────────────────────
echo
echo "8️⃣  API Smoke Tests"

API_URL="${API_URL:-http://localhost:4000}"

# Test auth
echo "   Testing portal notifications list endpoint..."

# Unauth check
UNAUTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/portal/notifications" || echo "0")
check "8.1) GET /portal/notifications unauth returns 401" \
  test "$UNAUTH_STATUS" = "401"

# Auth check (requires user login — skip shape validation if API not running)
if [ "$UNAUTH_STATUS" = "401" ]; then
  echo "   ℹ️  (Auth smoke tests require running API + valid portal user)"
  echo "   ℹ️  Shape checks: category/severity/sourceAction field presence"
  echo "   ℹ️  (Skipping authenticated shape validation in CI)"
fi

# ────────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────────
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PASS: $PASS"
echo "❌ FAIL: $FAIL"
echo

if [ $FAIL -eq 0 ]; then
  echo "🎉 All checks passed!"
  exit 0
else
  echo "❌ Some checks failed."
  exit 1
fi
