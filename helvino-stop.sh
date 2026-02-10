#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# helvino-stop.sh — Tüm sunucuları ve watchdog'u durdur
# ═══════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")" && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

echo -e "${RED}Stopping Helvino dev servers...${NC}"

# Watchdog'u durdur
if [ -f "$ROOT/.dev-watchdog.pid" ]; then
  PID=$(cat "$ROOT/.dev-watchdog.pid" 2>/dev/null)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    sleep 1
    kill -9 "$PID" 2>/dev/null
  fi
  rm -f "$ROOT/.dev-watchdog.pid"
fi

# Portları temizle
lsof -ti:3000,4000 2>/dev/null | xargs kill -9 2>/dev/null

echo -e "${GREEN}✅ All servers stopped.${NC}"
