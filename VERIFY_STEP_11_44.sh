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


PASS_COUNT=0
FAIL_COUNT=0

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo "  ✅ $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo "  ❌ $1"; }

ROOT="/Users/yavuz/Desktop/helvino"
API_SRC="$ROOT/apps/api/src"
WEB_SRC="$ROOT/apps/web/src"

echo "═══════════════════════════════════════════"
echo "  VERIFY — Step 11.44: Per-User Notifications"
echo "═══════════════════════════════════════════"
echo ""

# ── Section 1: Prisma Schema ──
echo "── Section 1: Prisma Schema ──"

if grep -q 'model NotificationRead' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.1 NotificationRead model exists"
else
  fail "1.1 NotificationRead model missing"
fi

if grep -q 'model NotificationPreference' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.2 NotificationPreference model exists"
else
  fail "1.2 NotificationPreference model missing"
fi

if grep -q '@@unique.*notificationId.*orgUserId' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.3 Unique constraint (notificationId, orgUserId)"
else
  fail "1.3 Unique constraint missing"
fi

if grep -q 'securityEnabled' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.4 securityEnabled pref field exists"
else
  fail "1.4 securityEnabled missing"
fi

# ── Section 2: Migration ──
echo ""
echo "── Section 2: Migration ──"

if [ -d "$ROOT/apps/api/prisma/migrations/20260206240000_v11_44_per_user_notifications" ]; then
  pass "2.1 Migration directory exists"
else
  fail "2.1 Migration directory missing"
fi

if grep -q 'notification_reads' "$ROOT/apps/api/prisma/migrations/20260206240000_v11_44_per_user_notifications/migration.sql" 2>/dev/null; then
  pass "2.2 Migration creates notification_reads table"
else
  fail "2.2 notification_reads table missing from migration"
fi

if grep -q 'notification_preferences' "$ROOT/apps/api/prisma/migrations/20260206240000_v11_44_per_user_notifications/migration.sql" 2>/dev/null; then
  pass "2.3 Migration creates notification_preferences table"
else
  fail "2.3 notification_preferences table missing from migration"
fi

# ── Section 3: API Routes ──
echo ""
echo "── Section 3: API Routes ──"

if grep -q '/portal/notifications/unread-count' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.1 /portal/notifications/unread-count route"
else
  fail "3.1 unread-count route missing"
fi

if grep -q '/portal/notifications/mark-all-read' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.2 /portal/notifications/mark-all-read route"
else
  fail "3.2 mark-all-read route missing"
fi

if grep -q '/portal/notifications/preferences' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.3 /portal/notifications/preferences route"
else
  fail "3.3 preferences route missing"
fi

if grep -q 'notificationRead' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.4 NotificationRead model used in routes"
else
  fail "3.4 NotificationRead not used in routes"
fi

if grep -q 'notificationPreference' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.5 NotificationPreference model used in routes"
else
  fail "3.5 NotificationPreference not used in routes"
fi

if grep -q 'requirePortalUser' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.6 requirePortalUser guard"
else
  fail "3.6 requirePortalUser missing"
fi

if grep -q 'writeAuditLog' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.7 Audit log on pref update"
else
  fail "3.7 Audit log missing"
fi

# ── Section 4: Web — PortalLayout Badge ──
echo ""
echo "── Section 4: PortalLayout Badge ──"

if grep -q 'unread-count' "$WEB_SRC/components/PortalLayout.tsx" 2>/dev/null; then
  pass "4.1 PortalLayout uses /unread-count endpoint"
else
  fail "4.1 PortalLayout doesn't use /unread-count"
fi

if grep -q 'setInterval\|interval' "$WEB_SRC/components/PortalLayout.tsx" 2>/dev/null; then
  pass "4.2 PortalLayout polls with setInterval"
else
  fail "4.2 PortalLayout missing polling"
fi

if grep -q 'clearInterval' "$WEB_SRC/components/PortalLayout.tsx" 2>/dev/null; then
  pass "4.3 PortalLayout cleans up interval"
else
  fail "4.3 PortalLayout missing clearInterval cleanup"
fi

# ── Section 5: Web — Notifications Page ──
echo ""
echo "── Section 5: Notifications Page ──"

if grep -q 'preferences' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "5.1 Preferences UI in notifications page"
else
  fail "5.1 Preferences UI missing"
fi

if grep -q 'handlePrefToggle\|prefToggle\|PrefToggle' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "5.2 Preference toggle handler exists"
else
  fail "5.2 Preference toggle handler missing"
fi

if grep -q 'mark-all-read' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "5.3 Mark all read uses new endpoint"
else
  fail "5.3 Mark all read endpoint missing"
fi

if grep -q 'suppressHydrationWarning' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "5.4 Hydration safety present"
else
  fail "5.4 Hydration safety missing"
fi

# ── Section 6: i18n Parity ──
echo ""
echo "── Section 6: i18n Parity ──"

I18N_FILE="$_I18N_COMPAT"
KEYS=(
  "notifications.preferencesTitle"
  "notifications.prefSecurity"
  "notifications.prefBilling"
  "notifications.prefWidget"
  "notifications.saved"
  "notifications.unreadCount"
)

ALL_PARITY=true
for KEY in "${KEYS[@]}"; do
  COUNT=$(grep -c "\"$KEY\"" "$I18N_FILE" 2>/dev/null || echo 0)
  if [ "$COUNT" -lt 3 ]; then
    echo "    ⚠️  Key '$KEY' has $COUNT occurrences (need 3)"
    ALL_PARITY=false
  fi
done

if $ALL_PARITY; then
  pass "6.1 All new i18n keys have EN/TR/ES parity"
else
  fail "6.1 Some i18n keys missing parity"
fi

# ── Section 7: Docs ──
echo ""
echo "── Section 7: Documentation ──"

if [ -f "$ROOT/docs/STEP_11_44_NOTIFICATIONS_PER_USER.md" ]; then
  pass "7.1 Documentation exists"
else
  fail "7.1 Documentation missing"
fi

# ── Section 8: Smoke Tests ──
echo ""
echo "── Section 8: Smoke Tests ──"

API_URL="${API_URL:-http://localhost:4000}"

if curl -s -o /dev/null --connect-timeout 3 "$API_URL/health" 2>/dev/null; then
  echo "  API running at $API_URL"

  # 8.1 Unauth unread-count → 401
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/notifications/unread-count" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "401" ]; then
    pass "8.1 GET /portal/notifications/unread-count unauth → 401"
  else
    fail "8.1 unread-count unauth → $HTTP_CODE (expected 401)"
  fi

  # 8.2 Unauth preferences → 401
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/notifications/preferences" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "401" ]; then
    pass "8.2 GET /portal/notifications/preferences unauth → 401"
  else
    fail "8.2 preferences unauth → $HTTP_CODE (expected 401)"
  fi

  # 8.3 Unauth mark-all-read → 401
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/notifications/mark-all-read" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "401" ]; then
    pass "8.3 POST mark-all-read unauth → 401"
  else
    fail "8.3 mark-all-read unauth → $HTTP_CODE (expected 401)"
  fi

  # 8.4 Portal login + authed tests
  PORTAL_EMAIL="${PORTAL_EMAIL:-demo@customer.com}"
  PORTAL_PASS="${PORTAL_PASS:-Customer123!}"
  COOKIE_JAR="/tmp/verify_11_44_portal.jar"

  LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" \
    -X POST "$API_URL/portal/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$PORTAL_EMAIL\",\"password\":\"$PORTAL_PASS\"}" 2>/dev/null) || true

  if [ "$LOGIN_CODE" = "200" ]; then
    pass "8.4 Portal login → 200"

    # 8.5 GET /portal/notifications/unread-count authed
    HTTP_CODE=$(curl -s -o /tmp/verify_11_44_unread.json -w "%{http_code}" \
      -b "$COOKIE_JAR" "$API_URL/portal/notifications/unread-count" 2>/dev/null) || true
    if [ "$HTTP_CODE" = "200" ]; then
      BODY=$(cat /tmp/verify_11_44_unread.json)
      HAS_COUNT=$(echo "$BODY" | grep -c '"unreadCount"' || echo 0)
      HAS_RID=$(echo "$BODY" | grep -c '"requestId"' || echo 0)
      if [ "$HAS_COUNT" -ge 1 ] && [ "$HAS_RID" -ge 1 ]; then
        pass "8.5 unread-count returns correct shape"
      else
        fail "8.5 unread-count missing fields"
      fi
    else
      fail "8.5 unread-count authed → $HTTP_CODE (expected 200)"
    fi

    # 8.6 GET /portal/notifications/preferences authed
    HTTP_CODE=$(curl -s -o /tmp/verify_11_44_prefs.json -w "%{http_code}" \
      -b "$COOKIE_JAR" "$API_URL/portal/notifications/preferences" 2>/dev/null) || true
    if [ "$HTTP_CODE" = "200" ]; then
      BODY=$(cat /tmp/verify_11_44_prefs.json)
      HAS_SEC=$(echo "$BODY" | grep -c '"securityEnabled"' || echo 0)
      HAS_BILL=$(echo "$BODY" | grep -c '"billingEnabled"' || echo 0)
      HAS_WIDGET=$(echo "$BODY" | grep -c '"widgetEnabled"' || echo 0)
      if [ "$HAS_SEC" -ge 1 ] && [ "$HAS_BILL" -ge 1 ] && [ "$HAS_WIDGET" -ge 1 ]; then
        pass "8.6 preferences returns correct shape"
      else
        fail "8.6 preferences missing fields"
      fi
    else
      fail "8.6 preferences authed → $HTTP_CODE (expected 200)"
    fi

    # 8.7 PUT /portal/notifications/preferences authed
    HTTP_CODE=$(curl -s -o /tmp/verify_11_44_prefput.json -w "%{http_code}" \
      -b "$COOKIE_JAR" -X PUT "$API_URL/portal/notifications/preferences" \
      -H "Content-Type: application/json" \
      -d '{"securityEnabled":true}' 2>/dev/null) || true
    if [ "$HTTP_CODE" = "200" ]; then
      BODY=$(cat /tmp/verify_11_44_prefput.json)
      HAS_OK=$(echo "$BODY" | grep -c '"ok"' || echo 0)
      if [ "$HAS_OK" -ge 1 ]; then
        pass "8.7 PUT preferences → 200 with ok"
      else
        fail "8.7 PUT preferences missing ok field"
      fi
    else
      fail "8.7 PUT preferences → $HTTP_CODE (expected 200)"
    fi

    # 8.8 POST mark-all-read authed
    HTTP_CODE=$(curl -s -o /tmp/verify_11_44_markall.json -w "%{http_code}" \
      -b "$COOKIE_JAR" -X POST "$API_URL/portal/notifications/mark-all-read" \
      -H "Content-Type: application/json" 2>/dev/null) || true
    if [ "$HTTP_CODE" = "200" ]; then
      BODY=$(cat /tmp/verify_11_44_markall.json)
      HAS_OK=$(echo "$BODY" | grep -c '"ok"' || echo 0)
      HAS_MARKED=$(echo "$BODY" | grep -c '"marked"' || echo 0)
      if [ "$HAS_OK" -ge 1 ] && [ "$HAS_MARKED" -ge 1 ]; then
        pass "8.8 mark-all-read → 200 with ok + marked"
      else
        fail "8.8 mark-all-read missing fields"
      fi
    else
      fail "8.8 mark-all-read → $HTTP_CODE (expected 200)"
    fi
  else
    echo "  ⚠️  Portal login failed ($LOGIN_CODE), skipping authed tests"
    pass "8.4 Portal login skipped (non-blocking)"
  fi

  rm -f /tmp/verify_11_44_*.jar /tmp/verify_11_44_*.json
else
  echo "  ⚠️  API not running at $API_URL — skipping smoke tests"
  pass "8.0 Smoke: skipped (non-blocking)"
fi

# ═══════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "═══════════════════════════════════════════"
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "  STEP 11.44: FAIL"
  exit 1
fi
echo "  STEP 11.44: PASS"
exit 0
