#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HELVINO DEV — Tek komut ile başlat
# Kullanım: ./dev-start.sh
# ═══════════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Helvino development servers..."

# Eğer launchd servisi yüklüyse onu başlat
if launchctl list | grep -q com.helvino.devserver 2>/dev/null; then
    launchctl kickstart gui/$(id -u)/com.helvino.devserver 2>/dev/null || true
    echo "✅ Watchdog started via launchd"
else
    # Yoksa watchdog'u doğrudan başlat
    "$ROOT/dev-server.sh" &
    echo "✅ Watchdog started (PID $!)"
fi

echo ""
echo "Portal:  http://localhost:3000/portal"
echo "API:     http://localhost:4000"
echo ""
echo "Log:     tail -f /tmp/helvino-watchdog.log"
echo "Stop:    ./dev-stop.sh"
