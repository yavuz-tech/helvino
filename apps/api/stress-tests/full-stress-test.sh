#!/bin/bash
set +e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

# ── Helpers ──────────────────────────────────────────────────
check_api() { curl -sf http://localhost:4000/health > /dev/null 2>&1; }

# Pure bash stress test — zero extra memory
# Usage: stress_test LABEL URL CONCURRENCY DURATION_SEC
stress_test() {
  local label="$1" url="$2" conns="$3" dur="$4"
  local outfile="$RESULTS_DIR/${label}.json"
  local tmpdir
  tmpdir=$(mktemp -d)

  echo "  ▶ $label — ${conns}c × ${dur}s → $url"

  if ! check_api; then
    echo "    API down, yeniden başlatılıyor..."
    lsof -ti:4000 | xargs kill -9 2>/dev/null; sleep 2
    cd "$API_DIR"
    NODE_OPTIONS='--max-old-space-size=2048' npx tsx src/index.ts > "$RESULTS_DIR/_api.log" 2>&1 &
    for _r in $(seq 1 10); do sleep 2; check_api && break; done
    cd "$SCRIPT_DIR"
    if ! check_api; then
      echo "  ❌ API geri gelmedi, test atlanıyor"
      echo '{"label":"'"$label"'","error":"api_down"}' > "$outfile"
      rm -rf "$tmpdir"
      return
    fi
    echo "    ✅ API geri geldi"
    sleep 2
  fi

  local start_epoch
  start_epoch=$(date +%s)
  local end_epoch=$((start_epoch + dur))
  local total=0 ok=0 non2xx=0 errs=0

  # Worker function: sends requests in a loop until time is up
  worker() {
    local wid=$1
    while [ "$(date +%s)" -lt "$end_epoch" ]; do
      local t_start t_end status lat_ms
      t_start=$(perl -MTime::HiRes=time -e 'printf "%.3f", time')
      status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo "000")
      t_end=$(perl -MTime::HiRes=time -e 'printf "%.3f", time')
      lat_ms=$(perl -e "printf '%.1f', ($t_end - $t_start) * 1000")
      echo "$status $lat_ms" >> "$tmpdir/w${wid}.log"
    done
  }

  # Launch concurrent workers
  for i in $(seq 1 "$conns"); do
    worker "$i" &
  done

  # Wait for all workers to finish
  wait

  local actual_end
  actual_end=$(date +%s)
  local elapsed=$((actual_end - start_epoch))

  # Aggregate results
  local all_lat=""
  if ls "$tmpdir"/w*.log 1>/dev/null 2>&1; then
    while IFS=' ' read -r code lat; do
      total=$((total + 1))
      if [ "$code" = "000" ]; then
        errs=$((errs + 1))
      elif [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
        ok=$((ok + 1))
      else
        non2xx=$((non2xx + 1))
      fi
      all_lat="$all_lat $lat"
    done < <(cat "$tmpdir"/w*.log)
  fi

  # Calculate percentiles
  local avg=0 p50=0 p95=0 p99=0 maxlat=0
  if [ "$total" -gt 0 ]; then
    # Sort latencies, compute stats with awk
    local sorted
    sorted=$(echo "$all_lat" | tr ' ' '\n' | sort -n | awk 'NF > 0')
    local count
    count=$(echo "$sorted" | wc -l | tr -d ' ')

    avg=$(echo "$sorted" | awk '{s+=$1} END {printf "%.1f", s/NR}')
    p50=$(echo "$sorted" | awk -v p="$count" 'NR==int(p*0.50)+1 {print $1; exit}')
    p95=$(echo "$sorted" | awk -v p="$count" 'NR==int(p*0.95)+1 {print $1; exit}')
    p99=$(echo "$sorted" | awk -v p="$count" 'NR==int(p*0.99)+1 {print $1; exit}')
    maxlat=$(echo "$sorted" | tail -1)
  fi

  local rps=0 errpct=0
  [ "$elapsed" -gt 0 ] && rps=$((total / elapsed))
  [ "$total" -gt 0 ] && errpct=$(awk "BEGIN {printf \"%.1f\", ($errs + $non2xx) / $total * 100}")

  local status_icon="✅"
  if awk "BEGIN {exit !($errpct > 50)}"; then status_icon="❌"; 
  elif awk "BEGIN {exit !($p95 > 500 || $errpct > 10)}"; then status_icon="⚠️"; fi

  echo "    $status_icon ${total} reqs | ${rps} rps | avg=${avg}ms p95=${p95}ms | err=${errpct}%"

  # Write JSON result
  cat > "$outfile" << ENDJSON
{
  "label": "$label",
  "url": "$url",
  "connections": $conns,
  "duration": $elapsed,
  "requests": { "total": $total, "perSecond": $rps },
  "latency": { "average": $avg, "p50": ${p50:-0}, "p95": ${p95:-0}, "p99": ${p99:-0}, "max": ${maxlat:-0} },
  "ok": $ok,
  "non2xx": $non2xx,
  "errors": $errs,
  "errorRate": $errpct
}
ENDJSON

  rm -rf "$tmpdir"
  sleep 2
}

# ═══════════════════════════════════════════════════════════════
echo "🔥 Helvion Full Stress Test (bash+curl)"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════"

# ─── ADIM 0: ESKİ SONUÇLARI TEMİZLE ───
echo ""
echo "🗑️  Eski sonuçlar temizleniyor..."
rm -f "$RESULTS_DIR"/A*.json "$RESULTS_DIR"/B*.json "$RESULTS_DIR"/C*.json "$RESULTS_DIR"/D*.json "$RESULTS_DIR"/REPORT.md "$RESULTS_DIR"/_*.log 2>/dev/null

# ─── ADIM 1: ORTAM TEMİZLİĞİ ───
echo ""
echo "🧹 ADIM 1: Ortam temizliği..."
pkill -f "next-server" 2>/dev/null && echo "  next-server'lar kapatıldı" || echo "  next-server bulunamadı"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "  Port 3000 temizlendi" || echo "  Port 3000 zaten boş"
sleep 2

# ─── ADIM 2: API KONTROLÜ ───
echo ""
echo "🚀 ADIM 2: API kontrolü..."
if check_api; then
  echo "  ✅ API ayakta"
else
  echo "  API down, başlatılıyor..."
  lsof -ti:4000 | xargs kill -9 2>/dev/null; sleep 2
  cd "$SCRIPT_DIR/../../" 
  NODE_OPTIONS='--max-old-space-size=2048' npx tsx src/index.ts > "$RESULTS_DIR/_api.log" 2>&1 &
  for i in $(seq 1 15); do sleep 2; check_api && break; echo "  bekliyor... ($i/15)"; done
  check_api && echo "  ✅ API hazır" || { echo "  ❌ API başlatılamadı!"; exit 1; }
fi

# ─── ADIM 3: TESTLER ───
echo ""
echo "🏋️ ADIM 3: Testler başlıyor..."

echo ""
echo "═ Test A: Health Endpoint (kademeli artış) ═"
stress_test "A1-health-10c"   "http://localhost:4000/health"  10  10
stress_test "A2-health-30c"   "http://localhost:4000/health"  30  10
stress_test "A3-health-50c"   "http://localhost:4000/health"  50  10

echo ""
echo "═ Test B: Public API Endpoints ═"
stress_test "B1-founding-30c"  "http://localhost:4000/api/founding-member-status"       30  10
stress_test "B2-currency-30c"  "http://localhost:4000/api/currency"                     30  10
stress_test "B3-discount-30c"  "http://localhost:4000/api/active-discount?orgKey=demo"  30  10

echo ""
echo "═ Test C: Yoğun Yük ═"
stress_test "C1-health-100c"  "http://localhost:4000/health"  100  15
stress_test "C2-health-200c"  "http://localhost:4000/health"  200  15
stress_test "C3-health-500c"  "http://localhost:4000/health"  500  10

# ─── ADIM 4: RACE CONDITION ───
echo ""
echo "🏁 ADIM 4: Race condition testi..."
if check_api; then
  cd "$SCRIPT_DIR"
  NODE_OPTIONS='--max-old-space-size=64' OUT_PATH="$RESULTS_DIR/D-race-condition.json" node race-condition-test.js 2>&1
else
  echo "  ⚠️ API down, atlanıyor"
fi

# ─── ADIM 5: RAPOR ───
echo ""
echo "📊 ADIM 5: Rapor oluşturuluyor..."

REPORT="$RESULTS_DIR/REPORT.md"
{
echo "# Helvion Stress Test Report"
echo ""
echo "**Date:** $(date '+%Y-%m-%d %H:%M:%S')"
echo "**Machine:** $(uname -m), $(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.0f GB", $1/1073741824}') RAM"
echo "**Method:** bash + curl (zero memory overhead)"
echo ""
echo "## Results"
echo ""
echo "| Test | Conns | Dur | Total | Req/s | Avg(ms) | p50 | p95 | p99 | Max | Err% | Status |"
echo "|------|-------|-----|-------|-------|---------|-----|-----|-----|-----|------|--------|"
} > "$REPORT"

for f in "$RESULTS_DIR"/A*.json "$RESULTS_DIR"/B*.json "$RESULTS_DIR"/C*.json; do
  [ -f "$f" ] || continue
  node -e "
    const d=JSON.parse(require('fs').readFileSync('$f','utf8'));
    if(d.error){console.log('| '+d.label+' | - | - | - | - | - | - | - | - | - | - | ❌ '+d.error+' |');process.exit();}
    let s='✅ GEÇTI';
    if(d.errorRate>50)s='❌ PATLADI';
    else if(d.latency.p95>500||d.errorRate>10)s='⚠️ YAVAŞ';
    console.log('| '+d.label+' | '+d.connections+' | '+d.duration+'s | '+d.requests.total+' | '+d.requests.perSecond+' | '+d.latency.average+' | '+d.latency.p50+' | '+d.latency.p95+' | '+d.latency.p99+' | '+d.latency.max+' | '+d.errorRate+'% | '+s+' |');
  " >> "$REPORT" 2>/dev/null
done

# Race condition row
{
echo ""
echo "## Race Condition Test (D)"
echo ""
} >> "$REPORT"

if [ -s "$RESULTS_DIR/D-race-condition.json" ]; then
  node -e "
    const d=JSON.parse(require('fs').readFileSync('$RESULTS_DIR/D-race-condition.json','utf8'));
    console.log('- **Concurrent requests:** '+d.total);
    console.log('- **Duration:** '+d.durationMs+'ms');
    console.log('- **Success (2xx):** '+d.success);
    console.log('- **Client errors (4xx):** '+d.fail4xx);
    console.log('- **Server errors (5xx):** '+d.fail5xx);
    console.log('- **Network errors:** '+d.errors);
    console.log('- **Founding member count:** '+d.foundingMemberCount+' / '+d.foundingMemberLimit);
    console.log('- **Race condition:** '+(d.raceCondition?'❌ DETECTED':'✅ Yok'));
  " >> "$REPORT" 2>/dev/null
else
  echo "- Test çalıştırılamadı" >> "$REPORT"
fi

echo "" >> "$REPORT"
echo "---" >> "$REPORT"
echo "*Generated by full-stress-test.sh (bash+curl method)*" >> "$REPORT"

echo "  ✅ REPORT.md oluşturuldu"
echo ""
echo "✅ TÜM TESTLER TAMAMLANDI"
