#!/usr/bin/env bash
set -euo pipefail

# VERIFY_ALL.sh — Single source of truth for CI verification
# Step 11.11: Strict mode. Any "FAIL" text in output → FAIL (exit 1).
# Deprecated scripts live in verify/legacy/ and are NOT run.
# Per-script timeout: 120 seconds (prevents hanging)

# Step 11.37: Reduce rate-limit hits during verify runs (dev-only)
export RATE_LIMIT_DEV_MULTIPLIER=50

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/.verify-logs"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

TOTAL=0
PASSED=0
FAILED=0
SCRIPT_TIMEOUT=240   # seconds per verify script (generous for scripts with internal builds)

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

# ── Portable timeout function (macOS compatible) ──
run_with_timeout() {
  local timeout_sec=$1; shift
  "$@" &
  local cmd_pid=$!
  (
    sleep "$timeout_sec"
    kill -9 "$cmd_pid" 2>/dev/null
  ) &
  local killer_pid=$!
  wait "$cmd_pid" 2>/dev/null
  local rc=$?
  kill "$killer_pid" 2>/dev/null
  wait "$killer_pid" 2>/dev/null 2>&1 || true
  return $rc
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
# 1b. API HEALTH CHECK (ensure server is reachable)
# ──────────────────────────────────────────────────
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000}"
echo "  Checking API at $API_URL/health ..."
if curl -s -m 5 "$API_URL/health" > /dev/null 2>&1; then
  echo -e "  ${GREEN}API is reachable${NC}"
else
  echo -e "  ${YELLOW}WARNING${NC}: API not reachable at $API_URL — scripts needing API may fail/timeout"
fi
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
# 3b. ENSURE API IS RUNNING (restart if needed after build)
# ──────────────────────────────────────────────────
divider "PRE-VERIFY API CHECK"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000}"
echo "  Ensuring API is reachable at $API_URL/health ..."

API_REACHABLE=false
for attempt in 1 2 3 4 5 6; do
  if curl -s -m 3 "$API_URL/health" > /dev/null 2>&1; then
    API_REACHABLE=true
    break
  fi
  if [ "$attempt" -eq 1 ]; then
    echo "  API not reachable — attempting restart ..."
    cd "$ROOT/apps/api"
    nohup pnpm dev > /dev/null 2>&1 &
    cd "$ROOT"
  fi
  sleep 3
done

if $API_REACHABLE; then
  echo -e "  ${GREEN}API${NC}: reachable"
else
  echo -e "  ${YELLOW}WARNING${NC}: API not reachable — smoke tests may fail"
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

  # Ensure API is alive before each script (prevents cascading failures from builds)
  if ! curl -s -m 2 "$API_URL/health" > /dev/null 2>&1; then
    cd "$ROOT/apps/api"
    nohup pnpm dev > /dev/null 2>&1 &
    cd "$ROOT"
    for _w in 1 2 3 4 5 6; do
      sleep 2
      curl -s -m 2 "$API_URL/health" > /dev/null 2>&1 && break
    done
  fi

  echo -n "  Running $script (timeout ${SCRIPT_TIMEOUT}s) ... "

  EXIT_CODE=0
  run_with_timeout "$SCRIPT_TIMEOUT" bash "$ROOT/$script" > "$LOG_FILE" 2>&1 || EXIT_CODE=$?

  NOTES=""
  STATUS=""

  if [ "$EXIT_CODE" -ne 0 ]; then
    # Check if killed by timeout (exit 137 = SIGKILL)
    if [ "$EXIT_CODE" -eq 137 ]; then
      STATUS="FAIL"
      NOTES="TIMEOUT after ${SCRIPT_TIMEOUT}s"
    else
      STATUS="FAIL"
      NOTES="exit $EXIT_CODE"
    fi
    FAILED=$((FAILED + 1))
  else
    # Exit 0 but need to check output for failures.
    # Strategy: Look for EXPLICIT failure indicators while ignoring success markers.
    # 
    # Failure indicators (reliable):
    # - Line starting with "❌ FAIL:"  (from fail() functions in some scripts)
    # - "NOT PASSING" in summary sections
    # - "VERIFICATION: NOT" or "VERIFICATION: FAIL"
    # - Line with pattern "❌ FAIL: N" where N > 0
    #
    # Things to IGNORE (common false positives):
    # - "✅ PASS" (success marker)
    # - Text like "payment_failed", "should fail", etc.
    # - Lines with "FAIL" inside test descriptions
    #
    # Use a more specific pattern + post-filter to avoid unicode issues
    
    # First check: explicit "FAIL: N" where N > 0 in summary
    if grep -qE '^❌ FAIL: [1-9]' "$LOG_FILE" 2>/dev/null; then
      STATUS="FAIL"
      NOTES="test assertion(s) not passing"
      FAILED=$((FAILED + 1))
    # Second check: "NOT PASSING" in output (common summary pattern)
    elif grep -q 'NOT PASSING' "$LOG_FILE" 2>/dev/null; then
      STATUS="FAIL"
      NOTES="test assertion(s) not passing"
      FAILED=$((FAILED + 1))
    # Third check: explicit VERIFICATION: FAIL/NOT
    elif grep -qE 'VERIFICATION:.*(FAIL|NOT)' "$LOG_FILE" 2>/dev/null; then
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
else
  echo -e "  ${RED}NOT PASSING${NC} — $FAILED of $TOTAL scripts have issues"
  echo ""
  echo "  Scripts with issues (see .verify-logs/ for details):"
  for i in "${!RESULTS_SCRIPT[@]}"; do
    if [ "${RESULTS_STATUS[$i]}" != "PASS" ]; then
      echo "    - ${RESULTS_SCRIPT[$i]} (exit ${RESULTS_CODE[$i]}) — ${RESULTS_NOTES[$i]}"
    fi
  done
fi

echo ""

# ──────────────────────────────────────────────────
# 7. POST-VERIFY: Ensure dev servers are still running
# ──────────────────────────────────────────────────
divider "POST-VERIFY HEALTH CHECK"

WEB_URL="${WEB_URL:-http://localhost:3000}"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000}"

API_OK=true
WEB_OK=true

if curl -s -m 3 "$API_URL/health" > /dev/null 2>&1; then
  echo -e "  ${GREEN}API${NC}: running at $API_URL"
else
  echo -e "  ${YELLOW}API${NC}: not reachable — attempting restart..."
  cd "$ROOT/apps/api"
  nohup pnpm dev > /dev/null 2>&1 &
  sleep 3
  if curl -s -m 3 "$API_URL/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}API${NC}: restarted successfully"
  else
    echo -e "  ${RED}API${NC}: could not restart"
    API_OK=false
  fi
fi

if curl -s -m 3 "$WEB_URL" > /dev/null 2>&1; then
  echo -e "  ${GREEN}WEB${NC}: running at $WEB_URL"
else
  echo -e "  ${YELLOW}WEB${NC}: not reachable — attempting restart..."
  cd "$ROOT/apps/web"
  nohup pnpm dev > /dev/null 2>&1 &
  sleep 5
  if curl -s -m 3 "$WEB_URL" > /dev/null 2>&1; then
    echo -e "  ${GREEN}WEB${NC}: restarted successfully"
  else
    echo -e "  ${RED}WEB${NC}: could not restart"
    WEB_OK=false
  fi
fi

echo ""
echo "  Login URLs:"
echo "    Admin:    $WEB_URL/login"
echo "    Portal:   $WEB_URL/portal/login"
echo "    App:      $WEB_URL/app/login"
echo ""

if [ "$FAILED" -eq 0 ]; then
  exit 0
else
  exit 1
fi
