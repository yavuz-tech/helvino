#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== Step 11.4 Verification =="

echo "-> Checking files"
test -f "$ROOT_DIR/apps/api/src/routes/portal-auth.ts"
test -f "$ROOT_DIR/apps/api/src/routes/portal-org.ts"
test -f "$ROOT_DIR/apps/api/src/middleware/require-portal-user.ts"
test -f "$ROOT_DIR/apps/api/src/utils/portal-session.ts"
test -f "$ROOT_DIR/apps/web/src/app/portal/login/page.tsx"
test -f "$ROOT_DIR/apps/web/src/app/portal/page.tsx"
test -f "$ROOT_DIR/apps/web/src/app/portal/inbox/page.tsx"
test -f "$ROOT_DIR/apps/web/src/app/portal/settings/page.tsx"
test -f "$ROOT_DIR/apps/web/src/app/portal/security/page.tsx"
test -f "$ROOT_DIR/apps/web/src/components/PortalLayout.tsx"
test -f "$ROOT_DIR/docs/STEP_11_4_CUSTOMER_PORTAL.md"

echo "-> Building API"
(cd "$ROOT_DIR/apps/api" && npx pnpm build)

echo "-> Building Web (isolated dir)"
(cd "$ROOT_DIR/apps/web" && NEXT_BUILD_DIR=.next-verify npx pnpm build && rm -rf .next-verify 2>/dev/null || true)

echo "-> Checking portal auth endpoints (if API running)"
if curl -s http://localhost:4000/health >/dev/null 2>&1; then
  EMAIL="${ORG_OWNER_EMAIL:-owner@demo.helvino.io}"
  PASS="${ORG_OWNER_PASSWORD:-demo_owner_2026}"

  echo "-> Login should succeed"
  curl -s -c /tmp/portal_cookies.txt \
    -X POST http://localhost:4000/portal/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | grep -q "\"ok\":true"

  echo "-> Auth required for /portal/org/me"
  curl -s -o /dev/null -w "%{http_code}" \
    http://localhost:4000/portal/org/me | grep -q "401"

  echo "-> Authenticated /portal/org/me"
  curl -s -b /tmp/portal_cookies.txt \
    http://localhost:4000/portal/org/me | grep -q "\"org\""
else
  echo "API not running; skipping live endpoint checks."
fi

echo "✅ Step 11.4 verification completed"
