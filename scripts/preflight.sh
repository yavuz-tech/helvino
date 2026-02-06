#!/usr/bin/env bash
# preflight.sh — Validate required environment before builds/tests
# Prints which keys are missing. Never prints secret values.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=0

check_env() {
  local label="$1" file="$2"
  shift 2
  local keys=("$@")
  echo "  [$label]"
  for key in "${keys[@]}"; do
    # Check if key is set in the file or in current env
    if [ -f "$file" ] && grep -q "^${key}=" "$file" 2>/dev/null; then
      echo "    $key: set"
    elif [ -n "${!key:-}" ]; then
      echo "    $key: set (env)"
    else
      echo "    $key: MISSING"
      MISSING=$((MISSING + 1))
    fi
  done
}

check_env_optional() {
  local label="$1" file="$2"
  shift 2
  local keys=("$@")
  echo "  [$label] (optional — ok to be missing in dev)"
  for key in "${keys[@]}"; do
    if [ -f "$file" ] && grep -q "^${key}=" "$file" 2>/dev/null; then
      echo "    $key: set"
    elif [ -n "${!key:-}" ]; then
      echo "    $key: set (env)"
    else
      echo "    $key: not configured"
    fi
  done
}

echo "== Preflight Environment Check =="
echo ""

# API required
check_env "API (required)" "$ROOT/apps/api/.env" \
  DATABASE_URL SESSION_SECRET

echo ""

# API optional (admin seed)
check_env_optional "API admin seed" "$ROOT/apps/api/.env" \
  ADMIN_EMAIL ADMIN_PASSWORD

echo ""

# Stripe (optional in dev)
check_env_optional "Stripe" "$ROOT/apps/api/.env" \
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET

echo ""

# Redis
check_env_optional "Redis" "$ROOT/apps/api/.env" \
  REDIS_URL

echo ""

# Web
check_env_optional "Web" "$ROOT/apps/web/.env.local" \
  NEXT_PUBLIC_API_URL

echo ""

if [ "$MISSING" -gt 0 ]; then
  echo "  WARNING: $MISSING required env var(s) missing"
  echo "  Copy .env.example to .env and fill in values."
  exit 1
else
  echo "  All required env vars present."
fi
