#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

echo "🔥 Helvion Stress Test Suite"
echo "=========================="
echo ""
echo "🧹 Ön temizlik yapılıyor..."
"$SCRIPT_DIR/cleanup-before-test.sh"
echo ""
echo "⏳ API'nin ayağa kalkması bekleniyor..."
sleep 10

# API health check
for i in {1..10}; do
  curl -s http://localhost:4000/health > /dev/null && break
  echo "  API henüz hazır değil... ($i/10)"
  sleep 2
done

curl -s http://localhost:4000/health > /dev/null && echo "✅ API hazır!" || { echo "❌ API başlatılamadı!"; exit 1; }
echo ""

echo "⏱ Test 1/4: Health Endpoints..."
k6 run "$SCRIPT_DIR/01-health-endpoints.js" --summary-export="$RESULTS_DIR/01-health.json"
echo ""
echo "⏱ Test 2/4: Auth Endpoints..."
k6 run "$SCRIPT_DIR/02-auth-endpoints.js" --summary-export="$RESULTS_DIR/02-auth.json"
echo ""
echo "⏱ Test 3/4: Founding Race Condition..."
k6 run "$SCRIPT_DIR/03-founding-race-condition.js" --summary-export="$RESULTS_DIR/03-race.json"
echo ""
echo "⏱ Test 4/4: WebSocket Flood..."
k6 run "$SCRIPT_DIR/04-websocket-flood.js" --summary-export="$RESULTS_DIR/04-ws.json"
echo ""
echo "✅ Tüm testler tamamlandı! Sonuçlar: $RESULTS_DIR"
