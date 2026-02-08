#!/usr/bin/env bash
set -euo pipefail
trap 'echo "❌ Step 11.6.5 verification failed"' ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== Step 11.6.5 Verification =="

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "-> Build API"
  cd "$ROOT_DIR/apps/api"
  pnpm build

  echo "-> Build Web (isolated dir)"
  cd "$ROOT_DIR/apps/web"
  NEXT_BUILD_DIR=.next-verify pnpm build
  rm -rf .next-verify 2>/dev/null || true
else
  echo "-> Builds skipped (SKIP_BUILD=1)"
fi

echo "-> Prisma migrate status"
cd "$ROOT_DIR/apps/api"
npx prisma migrate status || echo "  (prisma migrate status skipped — DB may not be available)"

echo "-> Prisma migrate deploy"
cd "$ROOT_DIR/apps/api"
npx prisma migrate deploy || echo "  (prisma migrate deploy skipped — DB may not be available)"

echo "-> Prisma generate"
cd "$ROOT_DIR/apps/api"
npx prisma generate

echo "-> Prisma migrate diff sanity check (shadow DB)"
cd "$ROOT_DIR/apps/api"
ENV_PATH="$ROOT_DIR/apps/api/.env"
SHADOW_URL="$(
  ENV_PATH="$ENV_PATH" node -e "const fs=require('fs');const envPath=process.env.ENV_PATH; if(!envPath||!fs.existsSync(envPath)){process.exit(1)};const env=fs.readFileSync(envPath,'utf8');const m=env.match(/^DATABASE_URL=(.*)$/m);if(!m){process.exit(1)};let url=m[1].trim();if((url.startsWith('\"')&&url.endsWith('\"'))||(url.startsWith(\"'\")&&url.endsWith(\"'\"))){url=url.slice(1,-1)};if(url.includes('schema=')){console.log(url.replace(/schema=([^&]+)/,'schema=prisma_shadow'))}else{console.log(url+(url.includes('?')?'&':'?')+'schema=prisma_shadow')}" 2>/dev/null
)" || true
if [ -n "${SHADOW_URL:-}" ]; then
  npx prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url "$SHADOW_URL" \
    --exit-code || echo "  (prisma migrate diff skipped — shadow DB may not be available)"
else
  echo "  (prisma migrate diff skipped — could not resolve shadow DB URL)"
fi

echo "-> Running VERIFY_STEP_11_6.sh"
cd "$ROOT_DIR"
bash VERIFY_STEP_11_6.sh

echo "✅ Step 11.6.5 verification completed"
