# Helvino API - Observability Guide

## Overview

Helvino API includes production-grade observability endpoints for health monitoring and performance metrics tracking.

---

## Health Check

### GET /health

**Purpose:** Verify API and dependencies are operational

**Authentication:** None (public endpoint)

**Response (200 - Healthy):**
```json
{
  "ok": true,
  "db": "ok",
  "redis": "ok",
  "uptimeSec": 3600,
  "timestamp": "2026-02-05T19:00:00.000Z"
}
```

**Response (503 - Unhealthy):**
```json
{
  "ok": false,
  "db": "down",
  "redis": "ok",
  "uptimeSec": 3600,
  "timestamp": "2026-02-05T19:00:00.000Z"
}
```

### Health Check Details

**Database Check:**
- Executes `SELECT 1` via Prisma
- Status: `"ok"` if query succeeds, `"down"` if fails
- Verifies PostgreSQL connectivity

**Redis Check:**
- Executes `PING` command
- Status: `"ok"` if returns `"PONG"`, `"down"` if fails
- Verifies Redis connectivity for rate limiting

**Uptime:**
- `uptimeSec`: Seconds since API server started
- Useful for tracking restarts

### Usage Examples

```bash
# Check API health
curl http://localhost:4000/health | jq

# Production health check (for load balancer)
curl -f http://api.helvion.io/health || echo "Health check failed"

# Monitor continuously
watch -n 5 "curl -s http://localhost:4000/health | jq '.ok, .db, .redis'"
```

---

## Metrics

### GET /metrics

**Purpose:** Get real-time performance metrics (rolling 60-second window)

**Authentication:** Requires `x-internal-key` header

**Response (200):**
```json
{
  "req_total": 150,
  "req_2xx": 140,
  "req_4xx": 8,
  "req_5xx": 2,
  "rate_limited_429": 5,
  "avg_latency_ms": 45.23,
  "p95_latency_ms": 120.45,
  "bootloader_calls": 30,
  "conversations_posts": 25,
  "messages_posts": 85,
  "window_seconds": 60,
  "timestamp": "2026-02-05T19:00:00.000Z"
}
```

### Metrics Explanation

#### Request Counters (Last 60s)

**`req_total`**
- Total requests in the last 60 seconds
- Excludes `/health` and `/metrics` endpoints (to avoid noise)

**`req_2xx`**
- Successful requests (status codes 200-299)
- Includes: 200 OK, 201 Created

**`req_4xx`**
- Client errors (status codes 400-499)
- Includes: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests

**`req_5xx`**
- Server errors (status codes 500-599)
- Includes: 500 Internal Server Error, 503 Service Unavailable

**`rate_limited_429`**
- Number of requests rejected due to rate limiting
- Subset of `req_4xx`

#### Latency Statistics (Last 60s)

**`avg_latency_ms`**
- Average request latency in milliseconds
- Includes all requests (2xx, 4xx, 5xx)

**`p95_latency_ms`**
- 95th percentile latency in milliseconds
- 95% of requests complete faster than this value
- More reliable than average for detecting slowness

#### Endpoint-Specific Counters (Last 60s)

**`bootloader_calls`**
- Number of successful bootloader calls
- Endpoint: `GET /api/bootloader`
- Indicates widget load activity

**`conversations_posts`**
- Number of successful conversation creations
- Endpoint: `POST /conversations`
- Indicates user engagement (new conversations)

**`messages_posts`**
- Number of successful message creations
- Endpoint: `POST /conversations/:id/messages`
- Indicates user engagement (messages sent)

### Usage Examples

```bash
# Get current metrics
curl -H "x-internal-key: YOUR_KEY" http://localhost:4000/metrics | jq

# Monitor 5xx errors
watch -n 5 "curl -s -H 'x-internal-key: KEY' http://localhost:4000/metrics | jq '.req_5xx'"

# Check P95 latency
curl -s -H "x-internal-key: KEY" http://localhost:4000/metrics | jq '.p95_latency_ms'

# Monitor rate limiting
curl -s -H "x-internal-key: KEY" http://localhost:4000/metrics | jq '.rate_limited_429'
```

---

## Incident Thresholds

Use these thresholds to detect production incidents:

### Critical Issues 🚨

**5xx Error Rate > 1%**
```bash
# Calculate 5xx rate
curl -s -H "x-internal-key: KEY" http://localhost:4000/metrics | \
  jq '(.req_5xx / .req_total * 100)'

# Alert if > 1%
```

**Symptom:** Server errors, crashes, database issues  
**Action:** Check logs, database connectivity, restart API if needed

---

**P95 Latency > 500ms**
```bash
curl -s -H "x-internal-key: KEY" http://localhost:4000/metrics | \
  jq '.p95_latency_ms'

# Alert if > 500
```

**Symptom:** Slow responses, database queries timing out  
**Action:** Check database performance, Redis latency, CPU usage

---

**Health Check Fails (ok: false)**
```bash
curl -s http://localhost:4000/health | jq '.ok'

# Alert if false
```

**Symptom:** Database or Redis connectivity issues  
**Action:** Check PostgreSQL and Redis status, network connectivity

---

### Warning Issues ⚠️

**429 Rate Limit Spikes > 50 in 60s**
```bash
curl -s -H "x-internal-key: KEY" http://localhost:4000/metrics | \
  jq '.rate_limited_429'

# Warn if > 50
```

**Symptom:** Potential abuse, single user/org hitting limits  
**Action:** Check logs for abusive org/IP, consider kill switch

---

**4xx Error Rate > 10%**
```bash
curl -s -H "x-internal-key: KEY" http://localhost:4000/metrics | \
  jq '(.req_4xx / .req_total * 100)'

# Warn if > 10%
```

**Symptom:** Client errors, invalid requests, auth issues  
**Action:** Check logs for error patterns, verify widget configuration

---

**Average Latency > 200ms**
```bash
curl -s -H "x-internal-key: KEY" http://localhost:4000/metrics | \
  jq '.avg_latency_ms'

# Warn if > 200
```

**Symptom:** General slowness, database or Redis latency  
**Action:** Monitor performance, check database load

---

## Monitoring Setup

### 1. Health Check Monitoring (Uptime Robot, Pingdom, etc.)

**Endpoint:** `GET /health`  
**Interval:** Every 1-5 minutes  
**Alert on:** HTTP status != 200 or `ok: false`

**Example (curl + cron):**
```bash
# Add to crontab (every 5 minutes)
*/5 * * * * curl -f http://api.helvion.io/health || mail -s "API Down" ops@helvion.io
```

---

### 2. Metrics Monitoring (Custom Script)

**Endpoint:** `GET /metrics`  
**Interval:** Every 30-60 seconds  
**Alert on:** Thresholds exceeded

**Example Script:**
```bash
#!/bin/bash
# monitor_metrics.sh

API_URL="http://localhost:4000"
INTERNAL_KEY="your-key"

while true; do
  METRICS=$(curl -s -H "x-internal-key: $INTERNAL_KEY" $API_URL/metrics)
  
  # Extract values
  REQ_TOTAL=$(echo "$METRICS" | jq '.req_total')
  REQ_5XX=$(echo "$METRICS" | jq '.req_5xx')
  P95=$(echo "$METRICS" | jq '.p95_latency_ms')
  RATE_LIMITED=$(echo "$METRICS" | jq '.rate_limited_429')
  
  # Calculate 5xx rate
  if [ "$REQ_TOTAL" -gt 0 ]; then
    ERROR_RATE=$(echo "scale=2; $REQ_5XX / $REQ_TOTAL * 100" | bc)
  else
    ERROR_RATE=0
  fi
  
  # Check thresholds
  if (( $(echo "$ERROR_RATE > 1" | bc -l) )); then
    echo "🚨 ALERT: 5xx error rate: $ERROR_RATE%"
  fi
  
  if (( $(echo "$P95 > 500" | bc -l) )); then
    echo "🚨 ALERT: P95 latency: ${P95}ms"
  fi
  
  if [ "$RATE_LIMITED" -gt 50 ]; then
    echo "⚠️  WARNING: Rate limited: $RATE_LIMITED requests"
  fi
  
  sleep 60
done
```

---

### 3. Log Aggregation (Recommended)

**Tools:** Datadog, New Relic, CloudWatch, ELK Stack, Grafana Loki

**What to track:**
- Structured logs (JSON format via pino)
- Request IDs for tracing
- Error logs (level: error)
- Performance logs (latencyMs)

**Key queries:**
```
# Find slow requests
latencyMs > 500

# Find 5xx errors
statusCode >= 500

# Find rate limited requests
statusCode == 429

# Find kill switch triggers
error == "Writes disabled"
```

---

## Dashboard Integration

### Fetch Health Status

```typescript
// apps/web/src/utils/api.ts

export async function fetchHealth(): Promise<{
  ok: boolean;
  db: string;
  redis: string;
  uptimeSec: number;
}> {
  const response = await fetch('http://localhost:4000/health');
  return response.json();
}
```

### Fetch Metrics

```typescript
// apps/web/src/utils/api.ts

export async function fetchMetrics(): Promise<{
  req_total: number;
  req_5xx: number;
  p95_latency_ms: number;
  rate_limited_429: number;
}> {
  const response = await fetch('http://localhost:4000/metrics', {
    headers: {
      'x-internal-key': process.env.NEXT_PUBLIC_INTERNAL_KEY!,
    },
  });
  return response.json();
}
```

### Display in Dashboard

```tsx
// apps/web/src/components/SystemStatus.tsx

export function SystemStatus() {
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [h, m] = await Promise.all([
        fetchHealth(),
        fetchMetrics(),
      ]);
      setHealth(h);
      setMetrics(m);
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="system-status">
      <h3>System Status</h3>
      
      {/* Health */}
      <div className={`status ${health?.ok ? 'ok' : 'down'}`}>
        {health?.ok ? '✅' : '❌'} API: {health?.ok ? 'Healthy' : 'Down'}
      </div>
      
      <div className={`status ${health?.db === 'ok' ? 'ok' : 'down'}`}>
        {health?.db === 'ok' ? '✅' : '❌'} Database: {health?.db}
      </div>
      
      <div className={`status ${health?.redis === 'ok' ? 'ok' : 'down'}`}>
        {health?.redis === 'ok' ? '✅' : '❌'} Redis: {health?.redis}
      </div>
      
      {/* Metrics */}
      <div className="metrics">
        <div>Requests (60s): {metrics?.req_total}</div>
        <div>5xx Errors: {metrics?.req_5xx}</div>
        <div>P95 Latency: {metrics?.p95_latency_ms}ms</div>
        <div>Rate Limited: {metrics?.rate_limited_429}</div>
      </div>
    </div>
  );
}
```

---

## Performance Optimization Tips

### Database (Prisma + PostgreSQL)

**If P95 > 500ms:**
1. Check slow query logs in PostgreSQL
2. Add database indexes on frequently queried fields
3. Use connection pooling (Prisma default)
4. Consider read replicas for high traffic

### Redis

**If health check fails:**
1. Verify Redis is running: `docker ps | grep redis`
2. Check Redis memory: `redis-cli info memory`
3. Increase Redis memory limit if needed
4. Monitor Redis latency: `redis-cli --latency`

### Rate Limiting

**If 429 rate is high:**
1. Review rate limit thresholds in code
2. Check if legitimate traffic is being blocked
3. Consider increasing limits for specific orgs
4. Use kill switch (`writeEnabled=false`) for abusive orgs

---

## Troubleshooting

### Health Check Always Returns 503

**Check 1:** Database connectivity
```bash
docker exec helvino-postgres psql -U helvino -d helvino_dev -c "SELECT 1;"
```

**Check 2:** Redis connectivity
```bash
docker exec helvino-redis redis-cli PING
```

**Check 3:** API logs
```bash
tail -f apps/api/logs/api.log | grep "health check failed"
```

---

### Metrics Endpoint Returns 401

**Cause:** Missing or invalid `x-internal-key`

**Fix:**
```bash
# Verify env var is set
cat apps/api/.env | grep INTERNAL_API_KEY

# Use correct header
curl -H "x-internal-key: YOUR_KEY" http://localhost:4000/metrics
```

---

### Metrics Show Zero Requests

**Cause:** No traffic or metrics tracker not recording

**Check:**
1. Send test request: `curl http://localhost:4000/api/bootloader -H "x-org-key: demo"`
2. Wait 5 seconds
3. Fetch metrics: `curl -H "x-internal-key: KEY" http://localhost:4000/metrics`
4. Verify `req_total > 0`

---

### P95 Latency Very High

**Common causes:**
1. **Database slow queries** - Check PostgreSQL logs
2. **Redis latency** - Check Redis performance
3. **Network latency** - Check network between API and dependencies
4. **CPU saturation** - Check API server CPU usage

**Debug:**
```bash
# Check API logs for slow requests
grep "latencyMs" apps/api/logs/api.log | grep -E "latencyMs\":[5-9][0-9]{2}|latencyMs\":[0-9]{4,}"

# Check database queries
docker exec helvino-postgres psql -U helvino -d helvino_dev -c \
  "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

---

## Production Checklist

### Before Deploy

- [ ] Verify `/health` endpoint returns 200
- [ ] Verify `/metrics` endpoint requires auth
- [ ] Test health check with database down (expect 503)
- [ ] Test health check with Redis down (expect 503)
- [ ] Set up monitoring alerts for critical thresholds
- [ ] Document on-call procedures for incidents

### Monitoring Setup

- [ ] Health check monitoring (Uptime Robot, Pingdom, etc.)
- [ ] Metrics monitoring (custom script or APM tool)
- [ ] Log aggregation (Datadog, New Relic, CloudWatch, etc.)
- [ ] Dashboard integration (admin panel)
- [ ] Alert notification (PagerDuty, Slack, email)

### Incident Response

- [ ] Define SLOs (Service Level Objectives)
  - Example: 99.9% uptime, P95 < 500ms, 5xx < 0.1%
- [ ] Document runbook for common issues
- [ ] Set up on-call rotation
- [ ] Test incident response procedures

---

## Summary

### Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | None | Dependency health check |
| `GET /metrics` | `x-internal-key` | Performance metrics |

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `ok` | Overall health | Alert if `false` |
| `db` | Database status | Alert if `"down"` |
| `redis` | Redis status | Alert if `"down"` |
| `req_5xx` | Server errors | Alert if > 1% of total |
| `p95_latency_ms` | P95 latency | Alert if > 500ms |
| `rate_limited_429` | Rate limited | Warn if > 50/min |

### Quick Commands

```bash
# Health check
curl http://localhost:4000/health | jq

# Metrics
curl -H "x-internal-key: KEY" http://localhost:4000/metrics | jq

# Monitor health
watch -n 5 "curl -s http://localhost:4000/health | jq '.ok, .db, .redis'"

# Monitor 5xx errors
watch -n 5 "curl -s -H 'x-internal-key: KEY' http://localhost:4000/metrics | jq '.req_5xx'"
```

---

## 🎯 Status: Production Ready

Observability system is complete and ready for production monitoring! ✅
