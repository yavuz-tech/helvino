#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# helvino-status.sh — Sunucu durumunu göster
# ═══════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         HELVINO — Server Status           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Watchdog
if [ -f "$ROOT/.dev-watchdog.pid" ]; then
  WD_PID=$(cat "$ROOT/.dev-watchdog.pid" 2>/dev/null)
  if [ -n "$WD_PID" ] && kill -0 "$WD_PID" 2>/dev/null; then
    echo -e "  Watchdog:  ${GREEN}RUNNING${NC} (PID $WD_PID)"
  else
    echo -e "  Watchdog:  ${RED}STOPPED${NC}"
  fi
else
  echo -e "  Watchdog:  ${YELLOW}NOT CONFIGURED${NC}"
fi

# API
API_RESP=$(curl -sf -m 3 http://localhost:4000/health 2>/dev/null)
if [ $? -eq 0 ]; then
  echo -e "  API :4000: ${GREEN}HEALTHY${NC} — $API_RESP"
else
  echo -e "  API :4000: ${RED}DOWN${NC}"
fi

# WEB
WEB_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 3 http://localhost:3000/ 2>/dev/null)
if [ "$WEB_CODE" = "200" ]; then
  echo -e "  WEB :3000: ${GREEN}OK (200)${NC}"
elif [ "$WEB_CODE" = "500" ]; then
  echo -e "  WEB :3000: ${RED}ERROR (500)${NC} — cache temizlenmeli"
else
  echo -e "  WEB :3000: ${RED}DOWN ($WEB_CODE)${NC}"
fi

echo ""
