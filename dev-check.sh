#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HELVINO DEV — Sunucu durumunu kontrol et, düşükse başlat
# Bu script Cursor agent'lar tarafından da çağrılabilir
# ═══════════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")" && pwd)"
ALL_OK=true

# API Check
API=$(curl -sf -m 3 http://localhost:4000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ API: OK (port 4000)"
else
    echo "❌ API: DOWN — starting..."
    ALL_OK=false
    lsof -ti:4000 | xargs kill -9 2>/dev/null
    cd "$ROOT" && pnpm --filter @helvino/api dev > /tmp/helvino-api.log 2>&1 &
    # Wait for API to come up
    for i in $(seq 1 20); do
        sleep 1
        if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
            echo "✅ API: Recovered (port 4000)"
            break
        fi
    done
fi

# WEB Check
WEB=$(curl -sf -m 3 http://localhost:3000/ 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ WEB: OK (port 3000)"
else
    echo "❌ WEB: DOWN — starting..."
    ALL_OK=false
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    cd "$ROOT" && pnpm --filter web dev > /tmp/helvino-web.log 2>&1 &
    for i in $(seq 1 30); do
        sleep 1
        if curl -sf http://localhost:3000/ > /dev/null 2>&1; then
            echo "✅ WEB: Recovered (port 3000)"
            break
        fi
    done
fi

if [ "$ALL_OK" = true ]; then
    echo "🟢 Both servers running"
    exit 0
else
    echo "🔄 Recovery attempted"
    exit 1
fi
