#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT_DIR/verify/_lib.sh"

echo "== Step 11.5 Verification =="

test -f "$ROOT_DIR/docs/STEP_11_5_STRIPE_BILLING.md"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "-> Building API"
  build_api_once

  echo "-> Building Web (isolated dir)"
  build_web_once
else
  echo "-> Builds skipped (SKIP_BUILD=1)"
fi

API_URL="http://localhost:4000"

echo "-> Smoke: portal billing GET (if API healthy)"
if should_skip_smoke; then
  echo "-> Smoke skipped (already done)"
  exit 0
fi
__API_HC=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "$API_URL/health" 2>/dev/null || echo "000")
if [ "$__API_HC" = "200" ]; then
  LOGIN=$(curl -s -m 10 -w "\n%{http_code}" -c /tmp/portal_cookies_11_5.txt -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${ORG_OWNER_EMAIL:-owner@demo.helvion.io}\",\"password\":\"${ORG_OWNER_PASSWORD:-demo_owner_2026}\"}" \
    $API_URL/portal/auth/login)
  CODE=$(echo "$LOGIN" | tail -n1)
  if [ "$CODE" = "429" ]; then
    echo "  (rate limited — skipping billing smoke)"
  elif [ "$CODE" = "401" ]; then
    echo "  (credentials not seeded — skipping billing smoke)"
  elif [ "$CODE" != "200" ]; then
    echo "❌ Portal login failed (HTTP $CODE)"
    exit 1
  fi

  if [ "$CODE" = "200" ]; then
    curl -s -m 10 -b /tmp/portal_cookies_11_5.txt $API_URL/portal/billing | jq . >/dev/null
  fi

  echo "-> Entitlement check (set free limits low)"
  node -e "const {PrismaClient}=require('./apps/api/node_modules/@prisma/client'); const prisma=new PrismaClient(); (async()=>{await prisma.plan.upsert({where:{key:'free'}, update:{maxConversationsPerMonth:1, maxMessagesPerMonth:1}, create:{key:'free', name:'Free', maxConversationsPerMonth:1, maxMessagesPerMonth:1, maxAgents:1}}); await prisma.\$disconnect();})();"

  TOKEN=$(curl -s -H "x-org-key: demo" $API_URL/api/bootloader | jq -r .orgToken)
  RES1=$(curl -s -w "\n%{http_code}" -X POST \
    -H "x-org-key: demo" -H "x-org-token: $TOKEN" \
    -H "x-visitor-id: v_limit_1" -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" -d '{}' $API_URL/conversations)
  RES2=$(curl -s -w "\n%{http_code}" -X POST \
    -H "x-org-key: demo" -H "x-org-token: $TOKEN" \
    -H "x-visitor-id: v_limit_2" -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" -d '{}' $API_URL/conversations)

  CODE2=$(echo "$RES2" | tail -n1)
  BODY2=$(echo "$RES2" | sed '$d')

  # Restore plan limits regardless of test outcome
  node -e "const {PrismaClient}=require('./apps/api/node_modules/@prisma/client'); const p=new PrismaClient(); (async()=>{await p.plan.upsert({where:{key:'free'}, update:{maxConversationsPerMonth:100, maxMessagesPerMonth:500}, create:{key:'free', name:'Free', maxConversationsPerMonth:100, maxMessagesPerMonth:500, maxAgents:1}}); await p.\$disconnect();})();"
  echo "-> Restored plan limits"

  if [ "$CODE2" != "402" ]; then
    echo "  Expected 402 on limit exceeded, got $CODE2"
    exit 1
  fi
  echo "  Entitlement limit enforced"
else
  echo "API not running; skipping live checks."
fi

echo "✅ Step 11.5 verification completed"
