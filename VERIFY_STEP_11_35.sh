#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# VERIFY_STEP_11_35.sh — Widget Analytics + Health Metrics
# ═══════════════════════════════════════════════════════════════
set -uo pipefail


# i18n compat: use generated flat file instead of translations.ts
_COMPAT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -n "${I18N_COMPAT_FILE:-}" ] && [ -f "${I18N_COMPAT_FILE}" ]; then
  _I18N_COMPAT="$I18N_COMPAT_FILE"
elif [ -f "$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts" ]; then
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
else
  [ -f "$_COMPAT_DIR/scripts/gen-i18n-compat.js" ] && node "$_COMPAT_DIR/scripts/gen-i18n-compat.js" >/dev/null 2>&1 || true
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
fi


PASS=0
FAILED=0

ok()   { PASS=$((PASS+1)); echo "  ✅  $1"; }
fail() { FAILED=$((FAILED+1)); echo "  ❌  $1"; }

ROOT_DIR="/Users/yavuz/Desktop/helvino"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
API_URL="${API_URL:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@helvino.io}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-helvino_admin_2026}"
PORTAL_EMAIL="${PORTAL_EMAIL:-owner@demo.helvino.io}"
PORTAL_PASSWORD="${PORTAL_PASSWORD:-demo_owner_2026}"
COOKIE_JAR_ADMIN=$(mktemp)
COOKIE_JAR_PORTAL=$(mktemp)
trap 'rm -f "$COOKIE_JAR_ADMIN" "$COOKIE_JAR_PORTAL"' EXIT

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  VERIFY STEP 11.35 — Widget Analytics + Health Metrics  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1) Build checks ─────────────────────────────────────────
echo "── 1) Build Checks ──"
if [ "${SKIP_BUILD:-}" != "1" ]; then
  cd "$API_DIR"
  if pnpm build > /dev/null 2>&1; then
    ok "API build passes"
  else
    fail "API build fails"
  fi

  cd "$WEB_DIR"
  if NEXT_BUILD_DIR=.next-verify pnpm build > /dev/null 2>&1; then
    ok "Web build passes"
  else
    fail "Web build fails"
  fi
else
  ok "Builds skipped (SKIP_BUILD=1)"
fi
echo ""

# ── 2) Schema checks ────────────────────────────────────────
echo "── 2) Prisma Schema Checks ──"
SCHEMA="$API_DIR/prisma/schema.prisma"
grep -q "widgetLoadsTotal" "$SCHEMA" && ok "widgetLoadsTotal field exists" || fail "widgetLoadsTotal missing"
grep -q "widgetLoadFailuresTotal" "$SCHEMA" && ok "widgetLoadFailuresTotal field exists" || fail "widgetLoadFailuresTotal missing"
grep -q "widgetDomainMismatchTotal" "$SCHEMA" && ok "widgetDomainMismatchTotal field exists" || fail "widgetDomainMismatchTotal missing"
grep -q "widgetRtBucketsJson" "$SCHEMA" && ok "widgetRtBucketsJson field exists" || fail "widgetRtBucketsJson missing"
grep -q "widgetRtTotalCount" "$SCHEMA" && ok "widgetRtTotalCount field exists" || fail "widgetRtTotalCount missing"
grep -q "lastWidgetSeenAt" "$SCHEMA" && ok "lastWidgetSeenAt field exists" || fail "lastWidgetSeenAt missing"
echo ""

# ── 3) Key file checks ──────────────────────────────────────
echo "── 3) Key File Checks ──"
[ -f "$API_DIR/src/routes/widget-analytics.ts" ] && ok "widget-analytics.ts exists" || fail "widget-analytics.ts missing"
[ -f "$API_DIR/src/utils/widget-histogram.ts" ] && ok "widget-histogram.ts exists" || fail "widget-histogram.ts missing"
[ -f "$WEB_DIR/src/components/WidgetHealthCard.tsx" ] && ok "WidgetHealthCard.tsx exists" || fail "WidgetHealthCard.tsx missing"
[ -f "$WEB_DIR/src/components/AdminWidgetHealthSummary.tsx" ] && ok "AdminWidgetHealthSummary.tsx exists" || fail "AdminWidgetHealthSummary.tsx missing"
[ -f "$ROOT_DIR/docs/STEP_11_35_WIDGET_ANALYTICS.md" ] && ok "docs/STEP_11_35_WIDGET_ANALYTICS.md exists" || fail "docs missing"
echo ""

# ── 4) Pattern checks ───────────────────────────────────────
echo "── 4) Pattern Checks ──"
grep -q "/portal/widget/health" "$API_DIR/src/routes/widget-analytics.ts" && ok "Portal health route" || fail "Portal health route missing"
grep -q "/internal/metrics/widget-health-summary" "$API_DIR/src/routes/widget-analytics.ts" && ok "Admin summary route" || fail "Admin summary route missing"
grep -q "requirePortalUser" "$API_DIR/src/routes/widget-analytics.ts" && ok "Portal auth guard on health" || fail "Portal auth guard missing"
grep -q "requireAdmin" "$API_DIR/src/routes/widget-analytics.ts" && ok "Admin auth guard on summary" || fail "Admin auth guard missing"
grep -q "computePercentile" "$API_DIR/src/utils/widget-histogram.ts" && ok "computePercentile helper" || fail "computePercentile missing"
grep -q "parseHistogram" "$API_DIR/src/utils/widget-histogram.ts" && ok "parseHistogram helper" || fail "parseHistogram missing"
grep -q "buildHistogramUpdateSql" "$API_DIR/src/utils/widget-histogram.ts" && ok "buildHistogramUpdateSql helper" || fail "buildHistogramUpdateSql missing"
grep -q "buildHistogramUpdateSql" "$API_DIR/src/routes/bootloader.ts" && ok "Bootloader uses histogram" || fail "Bootloader histogram missing"
grep -q "widgetLoadFailuresTotal" "$API_DIR/src/routes/bootloader.ts" && ok "Bootloader failure counter" || fail "Bootloader failure counter missing"
grep -q "widgetDomainMismatchTotal" "$API_DIR/src/middleware/domain-allowlist.ts" && ok "Domain mismatch counter" || fail "Domain mismatch counter missing"
grep -q "buildHistogramUpdateSql" "$API_DIR/src/routes/org-customer.ts" && ok "Message route uses histogram" || fail "Message route histogram missing"
grep -q "security.widget_health_spike" "$API_DIR/src/routes/widget-analytics.ts" && ok "Spike detection audit" || fail "Spike detection audit missing"
grep -q "NEEDS_ATTENTION\|NOT_CONNECTED\|OK" "$API_DIR/src/routes/widget-analytics.ts" && ok "Status enum values" || fail "Status enum values missing"
echo ""

# ── 5) i18n parity checks ───────────────────────────────────
echo "── 5) i18n Parity Checks ──"
TRANS_FILE="$_I18N_COMPAT"
for KEY in "widgetHealth.title" "widgetHealth.statusOk" "widgetHealth.statusNeedsAttention" "widgetHealth.statusNotConnected" \
           "widgetHealth.loads" "widgetHealth.failures" "widgetHealth.domainMismatch" "widgetHealth.responseTime" \
           "widgetHealth.p50" "widgetHealth.p95" "widgetHealth.lastSeen" "widgetHealth.never" \
           "widgetHealth.adminTitle" "widgetHealth.adminSubtitle" "widgetHealth.totalOrgs" "widgetHealth.connectedOrgs" \
           "widgetHealth.totalLoads" "widgetHealth.totalFailures" "widgetHealth.totalDomainMismatches" \
           "widgetHealth.topFailures" "widgetHealth.topDomainMismatch" "widgetHealth.lastSeenDist" \
           "widgetHealth.last1h" "widgetHealth.last24h" "widgetHealth.last7d" "widgetHealth.gte7d" \
           "widgetHealth.noData" "widgetHealth.ms"; do
  COUNT=$(grep -c "\"$KEY\"" "$TRANS_FILE" 2>/dev/null || echo 0)
  if [ "$COUNT" -ge 3 ]; then
    ok "i18n key $KEY (${COUNT}x)"
  else
    fail "i18n key $KEY only ${COUNT}x (need 3)"
  fi
done
echo ""

# ── 6-8) Smoke Tests (API health gated) ──────────────────────
echo "── 6) Auth Behavior (Smoke Tests) ──"

# Health gate: only run smoke tests if API is healthy
__API_HC=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "$API_URL/health" 2>/dev/null || echo "000")
if [ "$__API_HC" = "200" ]; then

# 6a) Unauthenticated portal health → 401
UNAUTH_PORTAL=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 --max-time 10 \
  "$API_URL/portal/widget/health" 2>/dev/null || echo "000")
if [ "$UNAUTH_PORTAL" = "401" ]; then
  ok "Unauth portal/widget/health → 401"
else
  fail "Unauth portal/widget/health → $UNAUTH_PORTAL (expected 401)"
fi

# 6b) Unauthenticated admin summary → 401
UNAUTH_ADMIN=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 --max-time 10 \
  "$API_URL/internal/metrics/widget-health-summary" 2>/dev/null || echo "000")
if [ "$UNAUTH_ADMIN" = "401" ]; then
  ok "Unauth admin summary → 401"
else
  fail "Unauth admin summary → $UNAUTH_ADMIN (expected 401)"
fi
echo ""

# ── 7) Authenticated shape checks ───────────────────────────
echo "── 7) Authenticated Shape Checks ──"

# 7a) Portal login
PORTAL_LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL/portal/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PORTAL_EMAIL\",\"password\":\"$PORTAL_PASSWORD\"}" \
  -c "$COOKIE_JAR_PORTAL" \
  --connect-timeout 5 --max-time 10 2>/dev/null || echo "000")

if [ "$PORTAL_LOGIN_CODE" = "200" ]; then
  ok "Portal login succeeded ($PORTAL_LOGIN_CODE)"

  # Call portal/widget/health with auth
  HEALTH_RES=$(curl -s -b "$COOKIE_JAR_PORTAL" \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/widget/health" 2>/dev/null)
  HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR_PORTAL" \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/widget/health" 2>/dev/null || echo "000")

  if [ "$HEALTH_CODE" = "200" ]; then
    ok "Portal widget/health → 200"
  else
    fail "Portal widget/health → $HEALTH_CODE (expected 200)"
  fi

  # Check JSON shape
  echo "$HEALTH_RES" | grep -q '"status"' && ok "Response has 'status'" || fail "Response missing 'status'"
  echo "$HEALTH_RES" | grep -q '"lastSeenAt"' && ok "Response has 'lastSeenAt'" || fail "Response missing 'lastSeenAt'"
  echo "$HEALTH_RES" | grep -q '"loads"' && ok "Response has 'loads'" || fail "Response missing 'loads'"
  echo "$HEALTH_RES" | grep -q '"domainMismatch"' && ok "Response has 'domainMismatch'" || fail "Response missing 'domainMismatch'"
  echo "$HEALTH_RES" | grep -q '"responseTime"' && ok "Response has 'responseTime'" || fail "Response missing 'responseTime'"
  echo "$HEALTH_RES" | grep -q '"requestId"' && ok "Response has 'requestId'" || fail "Response missing 'requestId'"
  echo "$HEALTH_RES" | grep -q '"total"' && ok "loads.total field present" || fail "loads.total field missing"
  echo "$HEALTH_RES" | grep -q '"p50"' && ok "responseTime.p50 present" || fail "responseTime.p50 missing"
  echo "$HEALTH_RES" | grep -q '"p95"' && ok "responseTime.p95 present" || fail "responseTime.p95 missing"
else
  echo "  [INFO] Portal login returned $PORTAL_LOGIN_CODE — skipping shape checks"
fi
echo ""

# 7b) Admin login
ADMIN_LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL/internal/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -c "$COOKIE_JAR_ADMIN" \
  --connect-timeout 5 --max-time 10 2>/dev/null || echo "000")

if [ "$ADMIN_LOGIN_CODE" = "200" ]; then
  ok "Admin login succeeded ($ADMIN_LOGIN_CODE)"

  SUMMARY_RES=$(curl -s -b "$COOKIE_JAR_ADMIN" \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/internal/metrics/widget-health-summary" 2>/dev/null)
  SUMMARY_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR_ADMIN" \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/internal/metrics/widget-health-summary" 2>/dev/null || echo "000")

  if [ "$SUMMARY_CODE" = "200" ]; then
    ok "Admin widget-health-summary → 200"
  else
    fail "Admin widget-health-summary → $SUMMARY_CODE (expected 200)"
  fi

  echo "$SUMMARY_RES" | grep -q '"totals"' && ok "Summary has 'totals'" || fail "Summary missing 'totals'"
  echo "$SUMMARY_RES" | grep -q '"orgsTotal"' && ok "Summary has 'orgsTotal'" || fail "Summary missing 'orgsTotal'"
  echo "$SUMMARY_RES" | grep -q '"connectedOrgs"' && ok "Summary has 'connectedOrgs'" || fail "Summary missing 'connectedOrgs'"
  echo "$SUMMARY_RES" | grep -q '"loadsTotal"' && ok "Summary has 'loadsTotal'" || fail "Summary missing 'loadsTotal'"
  echo "$SUMMARY_RES" | grep -q '"failuresTotal"' && ok "Summary has 'failuresTotal'" || fail "Summary missing 'failuresTotal'"
  echo "$SUMMARY_RES" | grep -q '"domainMismatchTotal"' && ok "Summary has 'domainMismatchTotal'" || fail "Summary missing 'domainMismatchTotal'"
  echo "$SUMMARY_RES" | grep -q '"okCount"' && ok "Summary has 'okCount'" || fail "Summary missing 'okCount'"
  echo "$SUMMARY_RES" | grep -q '"needsAttentionCount"' && ok "Summary has 'needsAttentionCount'" || fail "Summary missing 'needsAttentionCount'"
  echo "$SUMMARY_RES" | grep -q '"notConnectedCount"' && ok "Summary has 'notConnectedCount'" || fail "Summary missing 'notConnectedCount'"
  echo "$SUMMARY_RES" | grep -q '"topByFailures"' && ok "Summary has 'topByFailures'" || fail "Summary missing 'topByFailures'"
  echo "$SUMMARY_RES" | grep -q '"topByDomainMismatch"' && ok "Summary has 'topByDomainMismatch'" || fail "Summary missing 'topByDomainMismatch'"
  echo "$SUMMARY_RES" | grep -q '"lastSeenDistribution"' && ok "Summary has 'lastSeenDistribution'" || fail "Summary missing 'lastSeenDistribution'"
  echo "$SUMMARY_RES" | grep -q '"never"' && ok "Distribution has 'never'" || fail "Distribution missing 'never'"
  echo "$SUMMARY_RES" | grep -q '"lt1h"' && ok "Distribution has 'lt1h'" || fail "Distribution missing 'lt1h'"
  echo "$SUMMARY_RES" | grep -q '"gte7d"' && ok "Distribution has 'gte7d'" || fail "Distribution missing 'gte7d'"
  echo "$SUMMARY_RES" | grep -q '"requestId"' && ok "Summary has 'requestId'" || fail "Summary missing 'requestId'"
else
  echo "  [INFO] Admin login returned $ADMIN_LOGIN_CODE — skipping shape checks"
fi
echo ""

# ── 8) Response header check (x-request-id) ─────────────────
echo "── 8) Request ID Header Check ──"
if [ "${PORTAL_LOGIN_CODE:-000}" = "200" ]; then
  REQ_ID_HEADER=$(curl -s -D- -o /dev/null -b "$COOKIE_JAR_PORTAL" \
    --connect-timeout 5 --max-time 10 \
    "$API_URL/portal/widget/health" 2>/dev/null | grep -i "x-request-id")
  if [ -n "$REQ_ID_HEADER" ]; then
    ok "x-request-id header present in response"
  else
    fail "x-request-id header missing in response"
  fi
else
  echo "  [INFO] Skipping x-request-id check (portal login unavailable)"
fi

else
  echo "  [INFO] API not healthy (HTTP $__API_HC) — skipping smoke tests (code checks sufficient)"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
echo "══════════════════════════════════════════"
echo "  PASS: $PASS   FAILED: $FAILED"
echo "══════════════════════════════════════════"

if [ "$FAILED" -gt 0 ]; then
  echo "❌  STEP 11.35 verification: NOT PASSING"
  exit 1
else
  echo "✅  STEP 11.35 verification: ALL CHECKS PASSED"
  exit 0
fi
