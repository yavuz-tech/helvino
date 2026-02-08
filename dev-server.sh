#!/usr/bin/env bash
set -uo pipefail

# ═══════════════════════════════════════════════════════════════
# HELVINO DEV SERVER WATCHDOG
# ═══════════════════════════════════════════════════════════════
# - Sunucuları başlatır (API + WEB)
# - Her 10 saniyede health check yapar
# - Düşerse otomatik restart eder
# - Cache bozulursa temizler
# - Beyaz ekran tespiti yapar (HTML boş body kontrolü)
# - CTRL+C ile temiz shutdown
# ═══════════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_PORT=4000
WEB_PORT=3000
CHECK_INTERVAL=10
API_PID=""
WEB_PID=""
RESTART_COUNT_API=0
RESTART_COUNT_WEB=0

# Renkli çıktı
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

timestamp() {
  date '+%H:%M:%S'
}

log_ok() {
  echo -e "${GREEN}[$(timestamp)] ✅ $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}[$(timestamp)] ⚠️  $1${NC}"
}

log_err() {
  echo -e "${RED}[$(timestamp)] ❌ $1${NC}"
}

log_info() {
  echo -e "${BLUE}[$(timestamp)] ℹ️  $1${NC}"
}

log_watch() {
  echo -e "${CYAN}[$(timestamp)] 👁  $1${NC}"
}

# Temiz kapanış
cleanup() {
  echo ""
  log_info "Shutting down dev servers..."
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null
  sleep 1
  lsof -ti:${API_PORT},${WEB_PORT} | xargs kill -9 2>/dev/null
  log_ok "Servers stopped. Goodbye!"
  exit 0
}
trap cleanup SIGINT SIGTERM

# Port'u öldür
kill_port() {
  local port=$1
  lsof -ti:${port} | xargs kill -9 2>/dev/null
  sleep 1
}

# Cache temizle
clear_cache() {
  log_warn "Clearing Next.js cache..."
  rm -rf "$ROOT/apps/web/.next" 2>/dev/null
  rm -rf "$ROOT/apps/web/.next-verify" 2>/dev/null
  rm -rf "$ROOT/node_modules/.cache" 2>/dev/null
  log_ok "Cache cleared"
}

# API server başlat
start_api() {
  log_info "Starting API server on port ${API_PORT}..."
  kill_port $API_PORT
  cd "$ROOT" && pnpm --filter api dev > /tmp/helvino-api.log 2>&1 &
  API_PID=$!
  
  # API'nin ayağa kalkmasını bekle
  local tries=0
  while [ $tries -lt 30 ]; do
    if curl -s -o /dev/null -w '' http://localhost:${API_PORT}/health 2>/dev/null; then
      log_ok "API server ready on port ${API_PORT} (PID: ${API_PID})"
      return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  log_err "API server failed to start in 30s"
  return 1
}

# Web server başlat
start_web() {
  log_info "Starting WEB server on port ${WEB_PORT}..."
  kill_port $WEB_PORT
  cd "$ROOT" && pnpm --filter web dev > /tmp/helvino-web.log 2>&1 &
  WEB_PID=$!
  
  # Web'in ayağa kalkmasını bekle
  local tries=0
  while [ $tries -lt 60 ]; do
    if curl -s -o /dev/null -w '' http://localhost:${WEB_PORT}/ 2>/dev/null; then
      log_ok "WEB server ready on port ${WEB_PORT} (PID: ${WEB_PID})"
      return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  log_err "WEB server failed to start in 60s"
  return 1
}

# Health check: port açık mı?
check_port() {
  local port=$1
  curl -s -o /dev/null -w '%{http_code}' -m 5 "http://localhost:${port}/" 2>/dev/null
}

# Beyaz ekran kontrolü: HTML body boş mu?
check_white_screen() {
  local url=$1
  local body_size
  body_size=$(curl -s -m 5 "$url" 2>/dev/null | wc -c | tr -d ' ')
  if [ "$body_size" -lt 200 ] 2>/dev/null; then
    return 1  # Muhtemelen beyaz ekran
  fi
  return 0
}

# ═══════════════════════════════════════════════════════════════
# ANA PROGRAM
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  HELVINO DEV SERVER WATCHDOG${NC}"
echo -e "${CYAN}  Auto-restart • Cache recovery • White screen prevention${NC}"
echo -e "${CYAN}  Press CTRL+C to stop${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# İlk başlatma: cache temizle
clear_cache

# Sunucuları başlat
start_api
start_web

# IP bilgisi
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "N/A")

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🚀 DEV SERVERS RUNNING${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Local:    ${CYAN}http://localhost:3000/portal/widget${NC}"
echo -e "  Local:    ${CYAN}http://localhost:3000/portal/widget-appearance${NC}"
echo -e "  Local:    ${CYAN}http://localhost:3000/portal/inbox${NC}"
echo -e "  Network:  ${CYAN}http://${IP}:3000/portal/widget${NC}"
echo -e "  API:      ${CYAN}http://localhost:4000${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
log_watch "Watchdog active — checking every ${CHECK_INTERVAL}s"
echo ""

# ═══════════════════════════════════════════════════════════════
# WATCHDOG LOOP
# ═══════════════════════════════════════════════════════════════
while true; do
  sleep $CHECK_INTERVAL

  # --- API Check ---
  API_STATUS=$(check_port $API_PORT)
  if [ "$API_STATUS" != "200" ] && [ "$API_STATUS" != "401" ] && [ "$API_STATUS" != "404" ]; then
    log_err "API DOWN (status: ${API_STATUS}). Restarting..."
    RESTART_COUNT_API=$((RESTART_COUNT_API + 1))
    start_api
    log_warn "API restart #${RESTART_COUNT_API} complete"
  fi

  # --- WEB Check ---
  WEB_STATUS=$(check_port $WEB_PORT)
  if [ "$WEB_STATUS" = "000" ] || [ -z "$WEB_STATUS" ]; then
    log_err "WEB DOWN (status: ${WEB_STATUS}). Clearing cache & restarting..."
    RESTART_COUNT_WEB=$((RESTART_COUNT_WEB + 1))
    clear_cache
    start_web
    log_warn "WEB restart #${RESTART_COUNT_WEB} complete"
  elif [ "$WEB_STATUS" = "500" ]; then
    log_err "WEB 500 ERROR. Clearing cache & restarting..."
    RESTART_COUNT_WEB=$((RESTART_COUNT_WEB + 1))
    clear_cache
    start_web
    log_warn "WEB restart #${RESTART_COUNT_WEB} complete"
  fi

  # --- White Screen Check (portal sayfa) ---
  if [ "$WEB_STATUS" = "200" ]; then
    if ! check_white_screen "http://localhost:${WEB_PORT}/portal/widget"; then
      log_err "WHITE SCREEN detected on /portal/widget! Cache clear + restart..."
      RESTART_COUNT_WEB=$((RESTART_COUNT_WEB + 1))
      clear_cache
      kill_port $WEB_PORT
      start_web
      log_warn "WEB restart #${RESTART_COUNT_WEB} after white screen recovery"
    fi
  fi

  # --- Sessiz OK log (her 60 saniyede) ---
  SECONDS_MOD=$((SECONDS % 60))
  if [ "$SECONDS_MOD" -lt "$CHECK_INTERVAL" ]; then
    log_watch "API:${API_STATUS} WEB:${WEB_STATUS} | Restarts: API=${RESTART_COUNT_API} WEB=${RESTART_COUNT_WEB}"
  fi
done
