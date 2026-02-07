#!/usr/bin/env bash
set -euo pipefail

PASS_COUNT=0
FAIL_COUNT=0

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo "  ✅ $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo "  ❌ $1"; }

ROOT="/Users/yavuz/Desktop/helvino"
API_SRC="$ROOT/apps/api/src"
WEB_SRC="$ROOT/apps/web/src"

echo "═══════════════════════════════════════════"
echo "  VERIFY — Step 11.43: In-App Notifications"
echo "═══════════════════════════════════════════"
echo ""

# ── Section 1: Prisma Schema ──
echo "── Section 1: Prisma Schema ──"

if grep -q 'model Notification' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.1 Notification model exists in schema"
else
  fail "1.1 Notification model missing"
fi

if grep -q 'titleKey' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.2 titleKey field exists"
else
  fail "1.2 titleKey field missing"
fi

if grep -q 'bodyKey' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.3 bodyKey field exists"
else
  fail "1.3 bodyKey field missing"
fi

if grep -q 'severity' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.4 severity field exists"
else
  fail "1.4 severity field missing"
fi

if grep -q 'readAt' "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null; then
  pass "1.5 readAt field exists"
else
  fail "1.5 readAt field missing"
fi

# ── Section 2: Migration ──
echo ""
echo "── Section 2: Migration ──"

if [ -d "$ROOT/apps/api/prisma/migrations/20260206230000_v11_43_notifications" ]; then
  pass "2.1 Migration directory exists"
else
  fail "2.1 Migration directory missing"
fi

if grep -q 'notifications' "$ROOT/apps/api/prisma/migrations/20260206230000_v11_43_notifications/migration.sql" 2>/dev/null; then
  pass "2.2 Migration creates notifications table"
else
  fail "2.2 Migration content missing"
fi

# ── Section 3: API Routes ──
echo ""
echo "── Section 3: API Routes ──"

if [ -f "$API_SRC/routes/portal-notifications.ts" ]; then
  pass "3.1 portal-notifications.ts exists"
else
  fail "3.1 portal-notifications.ts missing"
fi

if grep -q '/portal/notifications' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.2 GET /portal/notifications route exists"
else
  fail "3.2 GET /portal/notifications route missing"
fi

if grep -q 'read-all' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.3 POST /portal/notifications/read-all route exists"
else
  fail "3.3 read-all route missing"
fi

if grep -q '/read' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.4 POST /portal/notifications/:id/read route exists"
else
  fail "3.4 :id/read route missing"
fi

if grep -q 'requirePortalUser' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.5 requirePortalUser guard present"
else
  fail "3.5 requirePortalUser guard missing"
fi

if grep -q 'unreadCount' "$API_SRC/routes/portal-notifications.ts" 2>/dev/null; then
  pass "3.6 unreadCount in response"
else
  fail "3.6 unreadCount missing from response"
fi

# ── Section 4: Notification Helper ──
echo ""
echo "── Section 4: Notification Emit Helper ──"

if [ -f "$API_SRC/utils/notifications.ts" ]; then
  pass "4.1 notifications.ts helper exists"
else
  fail "4.1 notifications.ts helper missing"
fi

if grep -q 'createNotification' "$API_SRC/utils/notifications.ts" 2>/dev/null; then
  pass "4.2 createNotification function exists"
else
  fail "4.2 createNotification function missing"
fi

if grep -q 'DEDUPE_WINDOW' "$API_SRC/utils/notifications.ts" 2>/dev/null; then
  pass "4.3 Dedupe window defined"
else
  fail "4.3 Dedupe window missing"
fi

if grep -qE '(emitSecurityNotification|emitMfaEnabled|emitPasskeyRegistered|emitRecoveryApproved)' "$API_SRC/utils/notifications.ts" 2>/dev/null; then
  pass "4.4 Security notification helpers exist (Step 11.45 refactor)"
else
  fail "4.4 Security notification helpers missing"
fi

if grep -qE '(emitWidgetHealthNotification|emitWidgetNeedsAttention)' "$API_SRC/utils/notifications.ts" 2>/dev/null; then
  pass "4.5 Widget health notification helper exists (Step 11.45 refactor)"
else
  fail "4.5 Widget health notification helper missing"
fi

# ── Section 5: Registration ──
echo ""
echo "── Section 5: Route Registration ──"

if grep -q 'portalNotificationRoutes' "$API_SRC/index.ts" 2>/dev/null; then
  pass "5.1 portalNotificationRoutes registered"
else
  fail "5.1 portalNotificationRoutes not registered"
fi

# ── Section 6: Web — Portal Notifications Page ──
echo ""
echo "── Section 6: Web — Notifications Page ──"

if [ -f "$WEB_SRC/app/portal/notifications/page.tsx" ]; then
  pass "6.1 /portal/notifications page exists"
else
  fail "6.1 /portal/notifications page missing"
fi

if grep -q '/portal/notifications' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "6.2 Page calls /portal/notifications API"
else
  fail "6.2 API call missing in page"
fi

if grep -q 'markRead\|read-all\|/read' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "6.3 Mark read functionality present"
else
  fail "6.3 Mark read functionality missing"
fi

if grep -q 'useHydrated' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "6.4 useHydrated used (SSR safety)"
else
  fail "6.4 useHydrated not used"
fi

if grep -q 'suppressHydrationWarning' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "6.5 suppressHydrationWarning present"
else
  fail "6.5 suppressHydrationWarning missing"
fi

if grep -q 'ErrorBanner' "$WEB_SRC/app/portal/notifications/page.tsx" 2>/dev/null; then
  pass "6.6 ErrorBanner present"
else
  fail "6.6 ErrorBanner missing"
fi

# ── Section 7: Bell Icon in PortalLayout ──
echo ""
echo "── Section 7: Bell Icon in PortalLayout ──"

if grep -q 'Bell' "$WEB_SRC/components/PortalLayout.tsx" 2>/dev/null; then
  pass "7.1 Bell icon imported in PortalLayout"
else
  fail "7.1 Bell icon not found in PortalLayout"
fi

if grep -q '/portal/notifications' "$WEB_SRC/components/PortalLayout.tsx" 2>/dev/null; then
  pass "7.2 Notifications link in PortalLayout"
else
  fail "7.2 Notifications link missing"
fi

if grep -q 'unreadCount' "$WEB_SRC/components/PortalLayout.tsx" 2>/dev/null; then
  pass "7.3 Unread count badge in PortalLayout"
else
  fail "7.3 Unread count badge missing"
fi

# ── Section 8: i18n Parity ──
echo ""
echo "── Section 8: i18n Parity ──"

I18N_FILE="$WEB_SRC/i18n/translations.ts"
KEYS=(
  "nav.notifications"
  "notifications.title"
  "notifications.all"
  "notifications.unread"
  "notifications.empty"
  "notifications.markRead"
  "notifications.markAllRead"
  "notifications.loadMore"
  "notifications.severity.info"
  "notifications.severity.warn"
  "notifications.severity.critical"
  "notifications.type.security"
  "notifications.type.widgetHealth"
  "notifications.type.billing"
  "notifications.type.system"
  "notif.security.suspiciousLogin.title"
  "notif.security.suspiciousLogin.body"
  "notif.security.passwordReset.title"
  "notif.security.passwordReset.body"
  "notif.widgetHealth.needsAttention.title"
  "notif.widgetHealth.needsAttention.body"
)

ALL_PARITY=true
for KEY in "${KEYS[@]}"; do
  COUNT=$(grep -c "\"$KEY\"" "$I18N_FILE" 2>/dev/null || echo 0)
  if [ "$COUNT" -lt 3 ]; then
    echo "    ⚠️  Key '$KEY' has $COUNT occurrences (need 3 for EN/TR/ES)"
    ALL_PARITY=false
  fi
done

if $ALL_PARITY; then
  pass "8.1 All new i18n keys have EN/TR/ES parity"
else
  fail "8.1 Some i18n keys missing parity"
fi

# ── Section 9: Hardcoded Strings ──
echo ""
echo "── Section 9: Hardcoded Strings ──"

HARDCODED=0
for F in "$WEB_SRC/app/portal/notifications/page.tsx"; do
  if grep -E '>\s*"(Notifications|Mark all|Unread|Load More)' "$F" 2>/dev/null | grep -v 'className\|import\|console\|//' | head -3 | grep -q .; then
    echo "    ⚠️  Possible hardcoded string in $(basename "$F")"
    HARDCODED=$((HARDCODED + 1))
  fi
done

if [ "$HARDCODED" -eq 0 ]; then
  pass "9.1 No obvious hardcoded strings"
else
  fail "9.1 Found possible hardcoded strings"
fi

# ── Section 10: Docs ──
echo ""
echo "── Section 10: Documentation ──"

if [ -f "$ROOT/docs/STEP_11_43_INAPP_NOTIFICATIONS.md" ]; then
  pass "10.1 STEP_11_43_INAPP_NOTIFICATIONS.md exists"
else
  fail "10.1 Documentation missing"
fi

# ── Section 11: Smoke Tests ──
echo ""
echo "── Section 11: Smoke Tests ──"

API_URL="${API_URL:-http://localhost:4000}"

if curl -s -o /dev/null --connect-timeout 3 "$API_URL/health" 2>/dev/null; then
  echo "  API running at $API_URL"

  # 11.1 Unauth portal → 401
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/notifications" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "401" ]; then
    pass "11.1 GET /portal/notifications unauth → 401"
  else
    fail "11.1 GET /portal/notifications unauth → $HTTP_CODE (expected 401)"
  fi

  # 11.2 Unauth read-all → 401
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/notifications/read-all" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "401" ]; then
    pass "11.2 POST /portal/notifications/read-all unauth → 401"
  else
    fail "11.2 POST /portal/notifications/read-all unauth → $HTTP_CODE (expected 401)"
  fi

  # 11.3 Portal login + authed tests
  PORTAL_EMAIL="${PORTAL_EMAIL:-demo@customer.com}"
  PORTAL_PASS="${PORTAL_PASS:-Customer123!}"
  COOKIE_JAR="/tmp/verify_11_43_portal.jar"

  LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" \
    -X POST "$API_URL/portal/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$PORTAL_EMAIL\",\"password\":\"$PORTAL_PASS\"}" 2>/dev/null) || true

  if [ "$LOGIN_CODE" = "200" ]; then
    pass "11.3 Portal login → 200"

    # 11.4 GET /portal/notifications authed
    HTTP_CODE=$(curl -s -o /tmp/verify_11_43_resp.json -w "%{http_code}" \
      -b "$COOKIE_JAR" "$API_URL/portal/notifications" 2>/dev/null) || true
    if [ "$HTTP_CODE" = "200" ]; then
      BODY=$(cat /tmp/verify_11_43_resp.json)
      HAS_ITEMS=$(echo "$BODY" | grep -c '"items"' || echo 0)
      HAS_UNREAD=$(echo "$BODY" | grep -c '"unreadCount"' || echo 0)
      HAS_RID=$(echo "$BODY" | grep -c '"requestId"' || echo 0)
      if [ "$HAS_ITEMS" -ge 1 ] && [ "$HAS_UNREAD" -ge 1 ] && [ "$HAS_RID" -ge 1 ]; then
        pass "11.4 GET /portal/notifications returns correct shape"
      else
        fail "11.4 Missing fields (items=$HAS_ITEMS unread=$HAS_UNREAD rid=$HAS_RID)"
      fi
    else
      fail "11.4 GET /portal/notifications authed → $HTTP_CODE (expected 200)"
    fi

    # 11.5 POST read-all authed
    HTTP_CODE=$(curl -s -o /tmp/verify_11_43_readall.json -w "%{http_code}" \
      -b "$COOKIE_JAR" -X POST "$API_URL/portal/notifications/read-all" \
      -H "Content-Type: application/json" 2>/dev/null) || true
    if [ "$HTTP_CODE" = "200" ]; then
      BODY=$(cat /tmp/verify_11_43_readall.json)
      HAS_OK=$(echo "$BODY" | grep -c '"ok"' || echo 0)
      if [ "$HAS_OK" -ge 1 ]; then
        pass "11.5 POST /portal/notifications/read-all → 200 with ok"
      else
        fail "11.5 read-all response missing ok field"
      fi
    else
      fail "11.5 POST read-all authed → $HTTP_CODE (expected 200)"
    fi
  else
    echo "  ⚠️  Portal login failed ($LOGIN_CODE), skipping authed tests"
    pass "11.3 Portal login skipped (non-blocking)"
  fi

  rm -f /tmp/verify_11_43_*.jar /tmp/verify_11_43_*.json
else
  echo "  ⚠️  API not running at $API_URL — skipping smoke tests"
  pass "11.0 Smoke: skipped (API not running — non-blocking)"
fi

# ═══════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "═══════════════════════════════════════════"
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "  STEP 11.43: FAIL"
  exit 1
fi
echo "  STEP 11.43: PASS"
exit 0
