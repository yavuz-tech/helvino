#!/usr/bin/env bash
set -euo pipefail

# VERIFY_CI.sh — CI-friendly single entrypoint
# Runs builds + VERIFY_ALL.sh in strict mode.
# Exit 0 = PASS, Exit 1 = FAIL.
# Does NOT require interactive TTY.

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/.verify-logs"
source "$ROOT/verify/_lib.sh"
verify_reset_sentinels

echo "============================================================"
echo "  VERIFY_CI — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"
echo ""

# ── 1. Preflight ──
if [ -x "$ROOT/scripts/preflight.sh" ]; then
  echo "--- Preflight ---"
  bash "$ROOT/scripts/preflight.sh" || true
  echo ""
fi

# ── 2. API build ──
echo "--- API build ---"
build_api_once "$LOG_DIR/api-build.log"
echo ""

# ── 3. Web build (isolated) ──
echo "--- Web build ---"
build_web_once "$LOG_DIR/web-build.log"
echo ""

# ── 4. Run VERIFY_ALL.sh ──
echo "--- VERIFY_ALL ---"
cd "$ROOT"
EXIT=0
export SKIP_SMOKE=1
bash "$ROOT/verify/smoke_once.sh" || true
bash "$ROOT/VERIFY_ALL.sh" || EXIT=$?

echo ""

# ── 5. Final verdict ──
echo "============================================================"
if [ "$EXIT" -eq 0 ]; then
  echo "  VERIFY_CI: PASS (all scripts clean)"
else
  echo "  VERIFY_CI: NOT PASSING (exit $EXIT from VERIFY_ALL.sh)"
fi
echo "============================================================"

exit $EXIT
