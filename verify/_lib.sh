#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.verify-logs}"

verify_init() {
  mkdir -p "$LOG_DIR"
}

verify_reset_sentinels() {
  mkdir -p "$LOG_DIR"
  rm -f "$LOG_DIR/.web_build_done" "$LOG_DIR/.api_build_done" "$LOG_DIR/.smoke_done"
}

_log_skip() {
  echo "SKIP: $1"
}

build_api_once() {
  local log_file="${1:-}"
  verify_init
  if [ "${VERIFY_FAST:-0}" = "1" ]; then
    _log_skip "api build skipped (FAST mode)"
    return 0
  fi
  if [ -f "$LOG_DIR/.api_build_done" ]; then
    _log_skip "api build already done"
    return 0
  fi
  local cmd="cd \"$ROOT_DIR/apps/api\" && pnpm build"
  if [ -n "$log_file" ]; then
    bash -lc "$cmd" 2>&1 | tee "$log_file" | tail -5
  else
    bash -lc "$cmd"
  fi
  touch "$LOG_DIR/.api_build_done"
}

build_web_once() {
  local log_file="${1:-}"
  verify_init
  if [ "${VERIFY_FAST:-0}" = "1" ]; then
    _log_skip "web build skipped (FAST mode)"
    return 0
  fi
  if [ -f "$LOG_DIR/.web_build_done" ]; then
    _log_skip "web build already done"
    return 0
  fi
  local cmd="cd \"$ROOT_DIR/apps/web\" && NEXT_BUILD_DIR=.next-verify pnpm build"
  if [ -n "$log_file" ]; then
    bash -lc "$cmd" 2>&1 | tee "$log_file" | tail -5
  else
    bash -lc "$cmd"
  fi
  touch "$LOG_DIR/.web_build_done"
}

smoke_once() {
  local name="$1"; shift
  local cmd="$*"
  verify_init
  if [ "${VERIFY_FAST:-0}" = "1" ]; then
    _log_skip "smoke skipped (FAST mode)"
    return 0
  fi
  if [ -f "$LOG_DIR/.smoke_done" ]; then
    _log_skip "smoke already done"
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: curl is required for smoke tests (missing on PATH)"
    return 1
  fi
  echo "RUN: smoke ($name)"
  bash -lc "$cmd"
  touch "$LOG_DIR/.smoke_done"
}

should_skip_smoke() {
  verify_init
  if [ "${VERIFY_FAST:-0}" = "1" ]; then
    _log_skip "smoke skipped (FAST mode)"
    return 0
  fi
  if [ "${SKIP_SMOKE:-}" = "1" ] || [ -f "$LOG_DIR/.smoke_done" ]; then
    _log_skip "smoke already done"
    return 0
  fi
  return 1
}
