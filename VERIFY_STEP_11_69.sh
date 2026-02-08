#!/usr/bin/env bash
# VERIFY_STEP_11_69.sh — Quota enforcement + alerts + widget unauthorized UX
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✅  $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌  $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "── VERIFY STEP 11.69 — Quota Enforcement + Alerts + Widget Unauthorized UX ──"

# Ensure API is reachable (fail fast so we don't get confusing errors)
if ! curl -s -m 5 http://localhost:4000/health >/dev/null 2>&1; then
  echo "  ❌  API reachable"
  echo ""
  echo "  Start the API first: pnpm --filter api dev (or npm run dev in apps/api)"
  exit 1
fi
check "API reachable" curl -s -m 5 http://localhost:4000/health

# Seed deterministic orgs + usage + portal users
node - <<'NODE'
const path = require("path");
const prismaPath = require.resolve("@prisma/client", { paths: [path.join(process.cwd(), "apps/api")] });
const argon2Path = require.resolve("argon2", { paths: [path.join(process.cwd(), "apps/api")] });
const { PrismaClient } = require(prismaPath);
const argon2 = require(argon2Path);

const prisma = new PrismaClient();
const now = new Date();
const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

async function upsertOrg({ key, siteId, name, planKey, billingStatus }) {
  return prisma.organization.upsert({
    where: { key },
    update: {
      name,
      siteId,
      planKey,
      billingStatus,
      widgetEnabled: true,
      writeEnabled: true,
      aiEnabled: true,
      allowLocalhost: true,
      allowedDomains: [],
    },
    create: {
      key,
      siteId,
      name,
      planKey,
      billingStatus,
      widgetEnabled: true,
      writeEnabled: true,
      aiEnabled: true,
      allowLocalhost: true,
      allowedDomains: [],
      createdAt: now,
    },
  });
}

async function upsertUsage(orgId, counts) {
  return prisma.usage.upsert({
    where: { orgId_monthKey: { orgId, monthKey } },
    update: counts,
    create: { orgId, monthKey, ...counts },
  });
}

async function upsertOrgUser(orgId, email, password, role) {
  const hash = await argon2.hash(password);
  return prisma.orgUser.upsert({
    where: { email },
    update: {
      orgId,
      role,
      passwordHash: hash,
      isActive: true,
      emailVerifiedAt: now,
    },
    create: {
      orgId,
      email,
      role,
      passwordHash: hash,
      isActive: true,
      emailVerifiedAt: now,
    },
  });
}

(async () => {
  const freeOrg = await upsertOrg({
    key: "verify-free-1169",
    siteId: "site_verify_1169_free",
    name: "Verify 1169 Free",
    planKey: "free",
    billingStatus: "none",
  });
  const proOrg = await upsertOrg({
    key: "verify-pro-1169",
    siteId: "site_verify_1169_pro",
    name: "Verify 1169 Pro",
    planKey: "pro",
    billingStatus: "active",
  });

  await upsertUsage(freeOrg.id, { m1Count: 50, m2Count: 0, m3Count: 0, conversationsCreated: 0, messagesSent: 0 });
  await upsertUsage(proOrg.id, { m1Count: 500, m2Count: 250, m3Count: 2000, conversationsCreated: 0, messagesSent: 0 });

  await upsertOrgUser(freeOrg.id, "verify-free-1169@helvion.dev", "VerifyPass123!", "owner");
  await upsertOrgUser(proOrg.id, "verify-pro-1169@helvion.dev", "VerifyPass123!", "owner");

  await prisma.$disconnect();
})();
NODE

# Helper: get org token from bootloader
get_token() {
  local org_key="$1"
  curl -s -H "x-org-key: ${org_key}" http://localhost:4000/api/bootloader \
    | node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));console.log(data.orgToken || '')"
}

# M1 limit (free org) — portal agent message should be blocked with QUOTA_M1_EXCEEDED
FREE_TOKEN="$(get_token verify-free-1169)"
FREE_CONV="$(curl -s -X POST http://localhost:4000/conversations \
  -H "x-org-key: verify-free-1169" \
  -H "x-org-token: ${FREE_TOKEN}" \
  -H "x-visitor-id: v_verify_1169_free" \
  -H "Content-Type: application/json" \
  | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));console.log(d.id || '')")"

curl -s -c /tmp/verify_1169_free.org.cookie -X POST http://localhost:4000/org/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-free-1169@helvion.dev","password":"VerifyPass123!"}' >/dev/null

check "M1 free org limit returns QUOTA_M1_EXCEEDED" bash -c \
  "curl -s -b /tmp/verify_1169_free.org.cookie -X POST http://localhost:4000/org/conversations/${FREE_CONV}/messages \
    -H 'Content-Type: application/json' \
    -d '{\"role\":\"assistant\",\"content\":\"test\"}' \
    | grep -q 'QUOTA_M1_EXCEEDED'"

# M1 limit (paid org) — portal agent message should be blocked with QUOTA_M1_EXCEEDED
PRO_TOKEN="$(get_token verify-pro-1169)"
PRO_CONV_M1="$(curl -s -X POST http://localhost:4000/conversations \
  -H "x-org-key: verify-pro-1169" \
  -H "x-org-token: ${PRO_TOKEN}" \
  -H "x-visitor-id: v_verify_1169_pro_m1" \
  -H "Content-Type: application/json" \
  | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));console.log(d.id || '')")"

curl -s -c /tmp/verify_1169_pro.org.cookie -X POST http://localhost:4000/org/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-pro-1169@helvion.dev","password":"VerifyPass123!"}' >/dev/null

check "M1 paid org limit returns QUOTA_M1_EXCEEDED" bash -c \
  "curl -s -b /tmp/verify_1169_pro.org.cookie -X POST http://localhost:4000/org/conversations/${PRO_CONV_M1}/messages \
    -H 'Content-Type: application/json' \
    -d '{\"role\":\"assistant\",\"content\":\"test\"}' \
    | grep -q 'QUOTA_M1_EXCEEDED'"

# M2 limit — widget assistant message blocked
PRO_CONV_M2="$(curl -s -X POST http://localhost:4000/conversations \
  -H "x-org-key: verify-pro-1169" \
  -H "x-org-token: ${PRO_TOKEN}" \
  -H "x-visitor-id: v_verify_1169_pro_m2" \
  -H "Content-Type: application/json" \
  | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));console.log(d.id || '')")"

check "M2 limit returns QUOTA_M2_EXCEEDED" bash -c \
  "curl -s -X POST http://localhost:4000/conversations/${PRO_CONV_M2}/messages \
    -H 'x-org-key: verify-pro-1169' \
    -H 'x-org-token: ${PRO_TOKEN}' \
    -H 'x-visitor-id: v_verify_1169_pro_m2' \
    -H 'Content-Type: application/json' \
    -d '{\"role\":\"assistant\",\"content\":\"ai\"}' \
    | grep -q 'QUOTA_M2_EXCEEDED'"

# M3 limit — conversation create returns limited flag
check "M3 limit returns m3Limited flag" bash -c \
  "curl -s -X POST http://localhost:4000/conversations \
    -H 'x-org-key: verify-pro-1169' \
    -H 'x-org-token: ${PRO_TOKEN}' \
    -H 'x-visitor-id: v_verify_1169_pro_m3' \
    -H 'Content-Type: application/json' \
    | grep -q 'm3Limited'"

# Portal login for alerts endpoint
curl -s -c /tmp/verify_1169_pro.portal.cookie -X POST http://localhost:4000/portal/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-pro-1169@helvion.dev","password":"VerifyPass123!"}' >/dev/null

# Portal Usage UI has current/limit/reset text
check "usage page shows limit/reset labels" \
  grep -E -q 'usage.limit|usage.resetDate|usage.meteringTitle' apps/web/src/app/portal/usage/page.tsx

# Portal Security UI shows Alerts row
check "security page shows alerts row" \
  grep -q 'security.alerts' apps/web/src/app/portal/security/page.tsx

# Alerts endpoint returns fields
check "alerts endpoint has required fields" bash -c \
  "curl -s -b /tmp/verify_1169_pro.portal.cookie http://localhost:4000/portal/org/me/alerts \
    | grep -E -q 'domainMismatchCountPeriod|usageNearLimit|writeEnabled|widgetEnabled'"

# Unauthorized domain widget string exists
check "widget unauthorized domain copy present" \
  grep -E -q 'Unauthorized domain|Yetkisiz alan adı|Dominio no autorizado' apps/widget/src/App.tsx

# i18n parity for new keys
EN_NEW=$(grep -cE '"usage.meteringTitle"|"usage.limit"|"usage.unlimited"|"usage.securityNotice"|"security.alerts"' apps/web/src/i18n/locales/en.json || echo 0)
TR_NEW=$(grep -cE '"usage.meteringTitle"|"usage.limit"|"usage.unlimited"|"usage.securityNotice"|"security.alerts"' apps/web/src/i18n/locales/tr.json || echo 0)
ES_NEW=$(grep -cE '"usage.meteringTitle"|"usage.limit"|"usage.unlimited"|"usage.securityNotice"|"security.alerts"' apps/web/src/i18n/locales/es.json || echo 0)
check "i18n parity for new keys (en=$EN_NEW tr=$TR_NEW es=$ES_NEW)" \
  test "$EN_NEW" -eq "$TR_NEW" -a "$TR_NEW" -eq "$ES_NEW" -a "$EN_NEW" -gt 0

# No random IDs introduced
check "no Date.now()/Math.random in new code" \
  bash -c '! grep -n "Date\\.now()\\|Math\\.random" apps/api/src/utils/entitlements.ts apps/api/src/routes/portal-org.ts apps/web/src/app/portal/usage/page.tsx apps/web/src/app/portal/security/page.tsx apps/widget/src/App.tsx | grep -q .'

# Plan-based limits defined
check "plan-based M1/M2/M3 limits configured" \
  grep -q 'PLAN_METERING_LIMITS' apps/api/src/utils/entitlements.ts

# Backward-compat widget config schema unchanged
check "widgetConfig schema file still present" \
  test -f apps/web/src/lib/widgetConfig.ts

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  STEP 11.69 — Result: $PASS passed, $FAIL failed (of $TOTAL)"
echo "════════════════════════════════════════════════════════════════"
if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ NOT PASSING"
  exit 1
fi
echo "  ✅ STEP 11.69 VERIFICATION PASSED"
exit 0
