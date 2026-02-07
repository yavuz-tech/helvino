#!/usr/bin/env bash
# preflight.sh — Validate required environment before builds/tests
# Prints which keys are missing. Never prints secret values.
# Exit 1 if any REQUIRED var is missing.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=0
WARN=0

check_required() {
  local label="$1" file="$2"
  shift 2
  echo "  [$label] (required)"
  for key in "$@"; do
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

check_optional() {
  local label="$1" file="$2"
  shift 2
  echo "  [$label] (optional — ok to be missing in dev)"
  for key in "$@"; do
    if [ -f "$file" ] && grep -q "^${key}=" "$file" 2>/dev/null; then
      echo "    $key: set"
    elif [ -n "${!key:-}" ]; then
      echo "    $key: set (env)"
    else
      echo "    $key: not configured"
      WARN=$((WARN + 1))
    fi
  done
}

echo "== Preflight Environment Check =="
echo ""

# ── API: required ──
check_required "API core" "$ROOT/apps/api/.env" \
  DATABASE_URL SESSION_SECRET

echo ""

# ── API: admin seed (required for admin login) ──
check_optional "API admin seed" "$ROOT/apps/api/.env" \
  ADMIN_EMAIL ADMIN_PASSWORD

echo ""

# ── API: portal seed (required for portal login) ──
check_optional "Portal user seed" "$ROOT/apps/api/.env" \
  ORG_OWNER_EMAIL ORG_OWNER_PASSWORD

echo ""

# ── Stripe ──
check_optional "Stripe" "$ROOT/apps/api/.env" \
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET

echo ""

# ── Redis ──
check_optional "Redis" "$ROOT/apps/api/.env" \
  REDIS_URL

echo ""

# ── Web ──
check_optional "Web" "$ROOT/apps/web/.env.local" \
  NEXT_PUBLIC_API_URL

echo ""

# ── WebAuthn / Passkeys ──
API_ENV="$ROOT/apps/api/.env"

# ── Rate Limiting ──
echo "  [Rate Limiting]"
RL_MULTI=""
if [ -f "$API_ENV" ] && grep -q "^RATE_LIMIT_DEV_MULTIPLIER=" "$API_ENV" 2>/dev/null; then
  RL_MULTI=$(grep "^RATE_LIMIT_DEV_MULTIPLIER=" "$API_ENV" | head -1 | cut -d= -f2- | tr -d '"')
  echo "    RATE_LIMIT_DEV_MULTIPLIER: $RL_MULTI"
elif [ -n "${RATE_LIMIT_DEV_MULTIPLIER:-}" ]; then
  echo "    RATE_LIMIT_DEV_MULTIPLIER: $RATE_LIMIT_DEV_MULTIPLIER (env)"
else
  echo "    RATE_LIMIT_DEV_MULTIPLIER: not set (default: 3 in dev)"
fi
echo "    Rate limit backend: Redis (via REDIS_URL)"

echo ""

echo "  [WebAuthn / Passkeys]"

HAS_WEBAUTHN_RPID=""
HAS_WEBAUTHN_ORIGIN=""
HAS_WEBAUTHN_RPNAME=""

for key in WEBAUTHN_RP_ID WEBAUTHN_ORIGIN WEBAUTHN_RP_NAME; do
  if [ -f "$API_ENV" ] && grep -q "^${key}=" "$API_ENV" 2>/dev/null; then
    echo "    $key: set"
    case "$key" in
      WEBAUTHN_RP_ID) HAS_WEBAUTHN_RPID="yes" ;;
      WEBAUTHN_ORIGIN) HAS_WEBAUTHN_ORIGIN="yes" ;;
      WEBAUTHN_RP_NAME) HAS_WEBAUTHN_RPNAME="yes" ;;
    esac
  elif [ -n "${!key:-}" ]; then
    echo "    $key: set (env)"
    case "$key" in
      WEBAUTHN_RP_ID) HAS_WEBAUTHN_RPID="yes" ;;
      WEBAUTHN_ORIGIN) HAS_WEBAUTHN_ORIGIN="yes" ;;
      WEBAUTHN_RP_NAME) HAS_WEBAUTHN_RPNAME="yes" ;;
    esac
  else
    echo "    $key: not configured (defaults will be used in dev)"
  fi
done

echo ""

# ── Cookie / Security flags ──
echo "  [Cookie & Security flags]"
NODE_ENV_VAL=""
if [ -f "$API_ENV" ] && grep -q "^NODE_ENV=" "$API_ENV" 2>/dev/null; then
  NODE_ENV_VAL=$(grep "^NODE_ENV=" "$API_ENV" | head -1 | cut -d= -f2- | tr -d '"')
fi
NODE_ENV_VAL="${NODE_ENV_VAL:-${NODE_ENV:-development}}"
echo "    NODE_ENV: $NODE_ENV_VAL"

if [ "$NODE_ENV_VAL" = "production" ]; then
  # In production, SESSION_SECRET must be strong (>= 32 chars)
  if [ -f "$API_ENV" ]; then
    SECRET_LEN=$(grep "^SESSION_SECRET=" "$API_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | wc -c | tr -d ' ')
    if [ "${SECRET_LEN:-0}" -lt 32 ]; then
      echo "    SESSION_SECRET length: ${SECRET_LEN:-0} chars (WARN: should be >=32 in production)"
      WARN=$((WARN + 1))
    else
      echo "    SESSION_SECRET length: OK (>= 32 chars)"
    fi
  fi

  # Stripe should be configured in production
  HAS_STRIPE_KEY=""
  if [ -f "$API_ENV" ] && grep -q "^STRIPE_SECRET_KEY=" "$API_ENV" 2>/dev/null; then
    HAS_STRIPE_KEY="yes"
  elif [ -n "${STRIPE_SECRET_KEY:-}" ]; then
    HAS_STRIPE_KEY="yes"
  fi

  if [ -z "$HAS_STRIPE_KEY" ]; then
    echo "    Stripe mode: NOT CONFIGURED (billing endpoints will return 501)"
    WARN=$((WARN + 1))
  else
    echo "    Stripe mode: configured"
    # Webhook secret should also be set
    HAS_WH_SECRET=""
    if [ -f "$API_ENV" ] && grep -q "^STRIPE_WEBHOOK_SECRET=" "$API_ENV" 2>/dev/null; then
      HAS_WH_SECRET="yes"
    elif [ -n "${STRIPE_WEBHOOK_SECRET:-}" ]; then
      HAS_WH_SECRET="yes"
    fi
    if [ -z "$HAS_WH_SECRET" ]; then
      echo "    STRIPE_WEBHOOK_SECRET: MISSING (webhooks will return 501)"
      WARN=$((WARN + 1))
    else
      echo "    STRIPE_WEBHOOK_SECRET: set"
    fi
  fi
  # WebAuthn should be explicitly configured in production
  if [ -z "$HAS_WEBAUTHN_RPID" ]; then
    echo "    WEBAUTHN_RP_ID: MISSING (REQUIRED in production — passkey rpId must match domain)"
    MISSING=$((MISSING + 1))
  fi
  if [ -z "$HAS_WEBAUTHN_ORIGIN" ]; then
    echo "    WEBAUTHN_ORIGIN: MISSING (REQUIRED in production — passkey origin must match)"
    MISSING=$((MISSING + 1))
  fi
  if [ -z "$HAS_WEBAUTHN_RPNAME" ]; then
    echo "    WEBAUTHN_RP_NAME: not set (will default to 'Helvino')"
    WARN=$((WARN + 1))
  fi
else
  echo "    (production checks skipped — NODE_ENV=$NODE_ENV_VAL)"
fi

echo ""

# ── Summary ──
if [ "$MISSING" -gt 0 ]; then
  echo "  RESULT: $MISSING required env var(s) MISSING"
  echo "  Copy .env.example to .env and fill in values."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "  RESULT: All required vars present. $WARN optional/warning item(s)."
  exit 0
else
  echo "  RESULT: All required env vars present. No warnings."
  exit 0
fi
