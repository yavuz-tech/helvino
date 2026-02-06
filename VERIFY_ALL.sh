#!/usr/bin/env bash
set -euo pipefail

# VERIFY_ALL.sh — Single source of truth for CI verification
# Step 11.11: Strict mode. Any "FAIL" text in output → FAIL (exit 1).
# Deprecated scripts live in verify/legacy/ and are NOT run.

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/.verify-logs"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

TOTAL=0
PASSED=0
FAILED=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

divider() {
  echo ""
  echo "============================================================"
  echo "  $1"
  echo "============================================================"
}

# ──────────────────────────────────────────────────
# 1. ENVIRONMENT
# ──────────────────────────────────────────────────
divider "ENVIRONMENT"
echo "  Date   : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "  Node   : $(node -v 2>/dev/null || echo 'not found')"
echo "  pnpm   : $(pnpm -v 2>/dev/null || echo 'not found')"
echo "  Prisma : $(cd "$ROOT/apps/api" && npx prisma -v 2>/dev/null | head -1 || echo 'not found')"
echo ""

# ──────────────────────────────────────────────────
# 2. API BUILD
# ──────────────────────────────────────────────────
divider "API BUILD"
cd "$ROOT/apps/api"
if pnpm build 2>&1 | tee "$LOG_DIR/api-build.log" | tail -5; then
  echo -e "  ${GREEN}PASS${NC}: API build"
else
  echo -e "  ${RED}STOP${NC}: API build broken"
  exit 1
fi
echo ""

# ──────────────────────────────────────────────────
# 3. WEB BUILD (isolated dir to protect dev server)
# ──────────────────────────────────────────────────
divider "WEB BUILD"
cd "$ROOT/apps/web"
if NEXT_BUILD_DIR=.next-verify pnpm build 2>&1 | tee "$LOG_DIR/web-build.log" | tail -5; then
  echo -e "  ${GREEN}PASS${NC}: Web build"
  rm -rf .next-verify 2>/dev/null || true
else
  echo -e "  ${RED}STOP${NC}: Web build broken"
  rm -rf .next-verify 2>/dev/null || true
  exit 1
fi
echo ""

# ──────────────────────────────────────────────────
# 4. DISCOVER VERIFY SCRIPTS
# ──────────────────────────────────────────────────
divider "VERIFY SCRIPTS"

cd "$ROOT"
SCRIPTS=()
for f in VERIFY_*.sh; do
  [ "$f" = "VERIFY_ALL.sh" ] && continue
  [ "$f" = "VERIFY_CI.sh" ] && continue
  [ ! -f "$f" ] && continue
  SCRIPTS+=("$f")
done

# Sort alphabetically
IFS=$'\n' SCRIPTS=($(printf '%s\n' "${SCRIPTS[@]}" | sort)); unset IFS

echo "  Found ${#SCRIPTS[@]} scripts (legacy scripts in verify/legacy/ excluded)"
echo ""

declare -a RESULTS_SCRIPT
declare -a RESULTS_CODE
declare -a RESULTS_STATUS
declare -a RESULTS_NOTES

for script in "${SCRIPTS[@]}"; do
  TOTAL=$((TOTAL + 1))
  LOG_FILE="$LOG_DIR/${script%.sh}.log"
  echo -n "  Running $script ... "

  EXIT_CODE=0
  bash "$ROOT/$script" > "$LOG_FILE" 2>&1 || EXIT_CODE=$?

  NOTES=""
  STATUS=""

  if [ "$EXIT_CODE" -ne 0 ]; then
    # Hard exit code failure
    STATUS="FAIL"
    NOTES="exit $EXIT_CODE"
    FAILED=$((FAILED + 1))
  else
    # Strict check: look for explicit failure markers only.
    # Markers: ❌ emoji, "  FAIL:" prefix (from fail() functions),
    # "NOT PASSING" (summary), "VERIFICATION: NOT" (summary).
    # This avoids false positives from text like "payment_failed" or "should fail".
    FAIL_MARKERS=$(grep -E "❌|^[[:space:]]*FAIL:|NOT PASSING" "$LOG_FILE" 2>/dev/null || true)
    if [ -n "$FAIL_MARKERS" ]; then
      STATUS="FAIL"
      NOTES="test assertion(s) not passing"
      FAILED=$((FAILED + 1))
    else
      STATUS="PASS"
      PASSED=$((PASSED + 1))
    fi
  fi

  if [ "$STATUS" = "PASS" ]; then
    echo -e "${GREEN}$STATUS${NC}"
  else
    echo -e "${RED}$STATUS${NC} ($NOTES)"
  fi

  RESULTS_SCRIPT+=("$script")
  RESULTS_CODE+=("$EXIT_CODE")
  RESULTS_STATUS+=("$STATUS")
  RESULTS_NOTES+=("$NOTES")
done

echo ""

# ──────────────────────────────────────────────────
# 5. SUMMARY TABLE
# ──────────────────────────────────────────────────
divider "SUMMARY"

printf "  %-45s | %-4s | %-6s | %s\n" "Script" "Exit" "Status" "Notes"
printf "  %-45s-+-%-4s-+-%-6s-+-%s\n" "---------------------------------------------" "----" "------" "----------------------------"
for i in "${!RESULTS_SCRIPT[@]}"; do
  S="${RESULTS_STATUS[$i]}"
  if [ "$S" = "PASS" ]; then C="$GREEN"; else C="$RED"; fi
  printf "  %-45s | %-4s | ${C}%-6s${NC} | %s\n" "${RESULTS_SCRIPT[$i]}" "${RESULTS_CODE[$i]}" "$S" "${RESULTS_NOTES[$i]}"
done

echo ""
echo "  Totals: $TOTAL scripts | $PASSED passed | $FAILED not passed"
echo ""

# ──────────────────────────────────────────────────
# 6. FINAL RESULT
# ──────────────────────────────────────────────────
divider "FINAL RESULT"

if [ "$FAILED" -eq 0 ]; then
  echo -e "  ${GREEN}PASS${NC} — all $TOTAL scripts clean"
  echo ""
  exit 0
else
  echo -e "  ${RED}NOT PASSING${NC} — $FAILED of $TOTAL scripts have issues"
  echo ""
  echo "  Scripts with issues (see .verify-logs/ for details):"
  for i in "${!RESULTS_SCRIPT[@]}"; do
    if [ "${RESULTS_STATUS[$i]}" != "PASS" ]; then
      echo "    - ${RESULTS_SCRIPT[$i]} (exit ${RESULTS_CODE[$i]}) — ${RESULTS_NOTES[$i]}"
    fi
  done
  echo ""
  exit 1
fi
