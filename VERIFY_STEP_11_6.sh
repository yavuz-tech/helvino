#!/usr/bin/env bash
set -euo pipefail
trap 'echo "❌ Step 11.6 verification failed"' ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== Step 11.6 Verification =="

echo "-> Prisma generate"
cd "$ROOT_DIR/apps/api"
npx prisma generate

echo "-> Build API"
pnpm build

echo "-> Build Web (isolated dir)"
cd "$ROOT_DIR/apps/web"
NEXT_BUILD_DIR=.next-verify pnpm build
rm -rf .next-verify 2>/dev/null || true

echo "-> Checking key files/routes"
cd "$ROOT_DIR"
if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD="rg -q"
else
  SEARCH_CMD="grep -R -q"
fi

${SEARCH_CMD} "/stripe/webhook" apps/api/src/routes/stripe-webhook.ts
${SEARCH_CMD} "/internal/org/:key/billing" apps/api/src/routes/internal-admin.ts
${SEARCH_CMD} "/portal/org/billing" apps/api/src/routes/portal-billing.ts
${SEARCH_CMD} "/portal/billing" apps/web/src/app/portal/billing/page.tsx

echo "-> Webhook negative test (missing signature)"
if ! curl -s -m 10 "http://localhost:4000/health" >/dev/null; then
  echo "API not running on http://localhost:4000 (required for webhook test)"
  exit 1
fi

STATUS_CODE="$(
  curl -s -m 10 -o /tmp/stripe_webhook_resp.txt -w "%{http_code}" \
    -X POST "http://localhost:4000/stripe/webhook" \
    -H "Content-Type: application/json" \
    -d "{}"
)"

if [ "$STATUS_CODE" != "400" ]; then
  echo "Expected 400 for missing signature, got $STATUS_CODE"
  cat /tmp/stripe_webhook_resp.txt
  exit 1
fi

echo "✅ Step 11.6 verification completed"
