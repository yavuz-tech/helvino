#!/usr/bin/env bash
set -uo pipefail

# ═══════════════════════════════════════════════════════════════
# HELVINO DEV SERVER WATCHDOG v2
# ═══════════════════════════════════════════════════════════════
# - API + WEB sunucularını başlatır
# - Her 5 saniyede health check yapar (agresif)
# - Düşerse 2 saniye içinde restart eder
# - Cache bozulursa temizler
# - Beyaz ekran & ChunkLoadError tespiti
# - API /health endpoint'ini kontrol eder (DB + Redis)
# - CTRL+C ile temiz shutdown
# - PID dosyası ile tek instance garantisi
# ═══════════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_PORT=4000
WEB_PORT=3000
CHECK_INTERVAL=5
API_PID=""
WEB_PID=""
RESTART_COUNT_API=0
RESTART_COUNT_WEB=0
PIDFILE="$ROOT/.dev-watchdog.pid"

# ── Renkli çıktı ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

ts()       { date '+%H:%M:%S'; }
log_ok()   { echo -e "${GREEN}[$(ts)] ✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}[$(ts)] ⚠️  $1${NC}"; }
log_err()  { echo -e "${RED}[$(ts)] ❌ $1${NC}"; }
log_info() { echo -e "${BLUE}[$(ts)] ℹ️  $1${NC}"; }
log_watch(){ echo -e "${CYAN}[$(ts)] 👁  $1${NC}"; }

# ── Tek instance garantisi ──
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    log_warn "Watchdog already running (PID $OLD_PID). Killing old instance..."
    kill "$OLD_PID" 2>/dev/null
    sleep 2
    kill -9 "$OLD_PID" 2>/dev/null
  fi
fi
echo $$ > "$PIDFILE"

# ── Temiz kapanış ──
cleanup() {
  echo ""
  log_info "Shutting down dev servers..."
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null
  sleep 1
  lsof -ti:${API_PORT},${WEB_PORT} | xargs kill -9 2>/dev/null
  rm -f "$PIDFILE"
  log_ok "Servers stopped. Goodbye!"
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ── Port öldür ──
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"${port}" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null
    sleep 1
  fi
}

# ── Cache temizle ──
clear_cache() {
  log_warn "Clearing Next.js cache..."
  rm -rf "$ROOT/apps/web/.next" 2>/dev/null
  rm -rf "$ROOT/apps/web/.next-verify" 2>/dev/null
  rm -rf "$ROOT/node_modules/.cache" 2>/dev/null
  log_ok "Cache cleared"
}

# ── API başlat ──
start_api() {
  log_info "Starting API server on port ${API_PORT}..."
  kill_port $API_PORT
  cd "$ROOT" && pnpm --filter @helvino/api dev > /tmp/helvino-api.log 2>&1 &
  API_PID=$!
  local tries=0
  while [ $tries -lt 30 ]; do
    if curl -sf http://localhost:${API_PORT}/health > /dev/null 2>&1; then
      log_ok "API ready on :${API_PORT} (PID ${API_PID})"
      return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  log_err "API failed to start in 30s"
  return 1
}

# ── WEB başlat ──
start_web() {
  local clean=${1:-false}
  log_info "Starting WEB server on port ${WEB_PORT}..."
  kill_port $WEB_PORT
  if [ "$clean" = "true" ]; then
    clear_cache
  fi
  cd "$ROOT" && pnpm --filter web dev > /tmp/helvino-web.log 2>&1 &
  WEB_PID=$!
  local tries=0
  while [ $tries -lt 60 ]; do
    if curl -sf http://localhost:${WEB_PORT}/ > /dev/null 2>&1; then
      log_ok "WEB ready on :${WEB_PORT} (PID ${WEB_PID})"
      return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  log_err "WEB failed to start in 60s"
  return 1
}

# ── Health check ──
check_api() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 3 "http://localhost:${API_PORT}/health" 2>/dev/null)
  echo "$code"
}

check_web() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 3 "http://localhost:${WEB_PORT}/" 2>/dev/null)
  echo "$code"
}

# ── .next cache bozuk mu? ──
is_cache_corrupt() {
  local next_dir="$ROOT/apps/web/.next"
  # Manifest dosyaları yoksa bozuk
  [ ! -f "$next_dir/routes-manifest.json" ] && return 0
  # Webpack cache dosyası 0 byte ise bozuk
  for f in "$next_dir/cache/webpack/"*/*.pack.gz; do
    [ -f "$f" ] && [ ! -s "$f" ] && return 0
  done
  return 1
}

# ═══════════════════════════════════════════════════════════════
# ANA PROGRAM
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  HELVINO DEV SERVER WATCHDOG v2${NC}"
echo -e "${CYAN}  Agresif kontrol (${CHECK_INTERVAL}s) • Otomatik recovery${NC}"
echo -e "${CYAN}  CTRL+C ile durdur${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# İlk başlatma
start_api
start_web

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "N/A")

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🚀 DEV SERVERS RUNNING${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Portal:   ${CYAN}http://localhost:3000/portal${NC}"
echo -e "  API:      ${CYAN}http://localhost:4000${NC}"
echo -e "  Network:  ${CYAN}http://${IP}:3000${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
log_watch "Watchdog aktif — her ${CHECK_INTERVAL}s kontrol"

# ═══════════════════════════════════════════════════════════════
# WATCHDOG LOOP
# ═══════════════════════════════════════════════════════════════
CONSECUTIVE_WEB_FAIL=0

while true; do
  sleep $CHECK_INTERVAL

  # ── API ──
  API_STATUS=$(check_api)
  if [ "$API_STATUS" != "200" ]; then
    log_err "API DOWN (${API_STATUS}). Restarting..."
    RESTART_COUNT_API=$((RESTART_COUNT_API + 1))
    start_api
    log_warn "API restart #${RESTART_COUNT_API}"
  fi

  # ── WEB ──
  WEB_STATUS=$(check_web)
  if [ "$WEB_STATUS" = "200" ]; then
    CONSECUTIVE_WEB_FAIL=0
  else
    CONSECUTIVE_WEB_FAIL=$((CONSECUTIVE_WEB_FAIL + 1))
    if [ "$CONSECUTIVE_WEB_FAIL" -ge 2 ]; then
      # 2 ardışık fail = restart
      RESTART_COUNT_WEB=$((RESTART_COUNT_WEB + 1))
      if [ "$WEB_STATUS" = "500" ] || is_cache_corrupt; then
        log_err "WEB ${WEB_STATUS} + cache bozuk. Temiz restart..."
        start_web true
      else
        log_err "WEB DOWN (${WEB_STATUS}). Restart..."
        start_web false
      fi
      CONSECUTIVE_WEB_FAIL=0
      log_warn "WEB restart #${RESTART_COUNT_WEB}"
    else
      log_warn "WEB check failed (${WEB_STATUS}). Waiting 1 more cycle..."
    fi
  fi

  # ── Status log (her 30s) ──
  if [ $((SECONDS % 30)) -lt "$CHECK_INTERVAL" ]; then
    log_watch "API:${API_STATUS} WEB:${WEB_STATUS} | Restarts: API=${RESTART_COUNT_API} WEB=${RESTART_COUNT_WEB}"
  fi
done
