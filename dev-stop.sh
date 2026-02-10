#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HELVINO DEV — Tüm servisleri durdur
# ═══════════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping Helvino development servers..."

# launchd servisini durdur
launchctl bootout gui/$(id -u)/com.helvino.devserver 2>/dev/null || true

# Watchdog PID dosyasını kontrol et
if [ -f "$ROOT/.dev-watchdog.pid" ]; then
    PID=$(cat "$ROOT/.dev-watchdog.pid")
    kill "$PID" 2>/dev/null
    rm -f "$ROOT/.dev-watchdog.pid"
fi

# Port'lardaki süreçleri öldür
lsof -ti:3000,4000 2>/dev/null | xargs kill -9 2>/dev/null

echo "✅ All servers stopped"
