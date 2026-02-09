#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/verify/_lib.sh"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"

smoke_once "core" "curl -s -o /dev/null -w '%{http_code}' -m 5 \"$API_URL/health\" >/dev/null 2>&1"
smoke_once "web-home" "curl -s -o /dev/null -w '%{http_code}' -m 5 \"$WEB_URL\" >/dev/null 2>&1"
