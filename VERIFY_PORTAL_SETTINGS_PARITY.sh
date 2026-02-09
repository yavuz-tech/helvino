#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
COOKIE_FILE="${COOKIE_FILE:-/tmp/helvino-portal-cookie.txt}"

echo "== Portal Settings Parity Smoke Test =="
echo "API_URL: ${API_URL}"

check_endpoint() {
  local path="$1"
  local code
  code=$(curl -s -o /tmp/helvino_settings_out.json -w "%{http_code}" \
    -b "$COOKIE_FILE" \
    "${API_URL}${path}")
  if [[ "$code" != "200" ]]; then
    echo "FAIL ${path} -> HTTP ${code}"
    return 1
  fi
  echo "OK   ${path}"
}

check_endpoint "/portal/settings/operating-hours"
check_endpoint "/portal/settings/channels"
check_endpoint "/portal/settings/macros"
check_endpoint "/portal/settings/workflows"
check_endpoint "/portal/settings/sla"
check_endpoint "/portal/settings/chat-page"
check_endpoint "/portal/settings/translations?locale=en"
check_endpoint "/portal/settings/consistency"

echo "All settings endpoints are reachable."
