#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# helvino-start.sh — Sunucuları başlat & watchdog'u aktif et
# ═══════════════════════════════════════════════════════════
# Kullanım: ./helvino-start.sh
#   - Eski watchdog/sunucu varsa durdurur
#   - API + WEB + Watchdog'u başlatır
#   - Çökerse otomatik yeniden başlatır (her 5s kontrol)
# ═══════════════════════════════════════════════════════════

set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     HELVINO — Starting Dev Servers        ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"

# ── Eski watchdog'u temizle ──
if [ -f "$ROOT/.dev-watchdog.pid" ]; then
  OLD=$(cat "$ROOT/.dev-watchdog.pid" 2>/dev/null)
  if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then
    echo -e "Stopping old watchdog (PID $OLD)..."
    kill "$OLD" 2>/dev/null
    sleep 2
    kill -9 "$OLD" 2>/dev/null
  fi
  rm -f "$ROOT/.dev-watchdog.pid"
fi

# ── Portları temizle ──
lsof -ti:3000,4000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# ── Watchdog'u arka planda başlat ──
# NOT: PID dosyasını dev-server.sh kendisi yönetiyor, biz yazmıyoruz
nohup bash "$ROOT/dev-server.sh" > /tmp/helvino-watchdog.log 2>&1 &
WATCHDOG_PID=$!
disown "$WATCHDOG_PID" 2>/dev/null

echo ""
echo -e "${GREEN}✅ Watchdog started (PID $WATCHDOG_PID)${NC}"
echo -e "${GREEN}   Servers starting...${NC}"
echo ""

# ── Sunucuların hazır olmasını bekle ──
echo -n "Waiting for servers"
for i in $(seq 1 40); do
  API=$(curl -sf http://localhost:4000/health > /dev/null 2>&1 && echo "1" || echo "0")
  WEB=$(curl -sf http://localhost:3000/ > /dev/null 2>&1 && echo "1" || echo "0")
  if [ "$API" = "1" ] && [ "$WEB" = "1" ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ API:  http://localhost:4000  — OK${NC}"
    echo -e "${GREEN}  ✅ WEB:  http://localhost:3000  — OK${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Watchdog log: ${CYAN}tail -f /tmp/helvino-watchdog.log${NC}"
    echo -e "  Durdurmak:    ${CYAN}./helvino-stop.sh${NC}"
    echo -e "  Durum:        ${CYAN}./helvino-status.sh${NC}"
    echo ""
    exit 0
  fi
  echo -n "."
  sleep 2
done

echo ""
echo -e "${RED}⚠️  Servers didn't start in 80s. Check logs:${NC}"
echo -e "  API: /tmp/helvino-api.log"
echo -e "  WEB: /tmp/helvino-web.log"
echo -e "  Watchdog: /tmp/helvino-watchdog.log"
exit 1
