# Quick Test Guide: Production Hardening

## Prerequisites

- API server running on `http://localhost:4000`
- PostgreSQL running with seeded "demo" organization
- Redis running on `localhost:6379`

## Verification Curl Commands

### 1. Redis Rate Limiting

#### Test: Normal request (should work)
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_$(date +%s)" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 201 Created with conversation ID
```

#### Test: Rate limiting (send 35 requests rapidly)
```bash
for i in {1..35}; do
  curl -s -X POST \
    -H "x-org-key: demo-rate-$(date +%s)" \
    -H "x-visitor-id: v_rate_$i" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{}' \
    http://localhost:4000/conversations | jq -c '{id, error}' | head -c 80
  echo ""
done

# Expected: First 30 succeed (201), last 5 fail (429)
# Response on 429: {"error":"Rate limit exceeded","message":"Too many requests..."}
```

#### Test: Check rate limit headers
```bash
curl -i -X POST \
  -H "x-org-key: demo-headers-$(date +%s)" \
  -H "x-visitor-id: v_headers" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations | grep -i "x-ratelimit"

# Expected headers:
# x-ratelimit-limit: 30
# x-ratelimit-remaining: 29
# x-ratelimit-reset: <timestamp>
```

---

### 2. Domain Allowlist

#### Test: Valid domain (localhost:3000) - POST /conversations
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_valid_domain" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 201 Created
# {"id":"...","createdAt":"..."}
```

#### Test: Invalid domain (evil.com) - POST /conversations
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_invalid_domain" \
  -H "Content-Type: application/json" \
  -H "Origin: http://evil.com" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 403 Forbidden
# {
#   "error":"Domain not allowed",
#   "message":"The domain 'evil.com' is not authorized to use this organization's API",
#   "hint":"Contact your administrator to add this domain to the allowlist"
# }
```

#### Test: Wildcard subdomain (app.helvino.io) - GET /bootloader
```bash
curl -X GET \
  -H "x-org-key: demo" \
  -H "Origin: https://app.helvino.io" \
  http://localhost:4000/api/bootloader

# Expected: 200 OK (matches *.helvino.io)
# {"ok":true,"org":{...},"config":{...}}
```

#### Test: Invalid domain - GET /bootloader
```bash
curl -X GET \
  -H "x-org-key: demo" \
  -H "Origin: http://malicious-site.com" \
  http://localhost:4000/api/bootloader

# Expected: 403 Forbidden
# {"error":"Domain not allowed","message":"..."}
```

#### Test: No Origin header (curl/testing) - should allow with warning
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_no_origin" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 201 Created (allowed for testing)
# Note: Check API logs for warning:
# "No Origin/Referer header present, allowing request (likely curl/testing)"
```

---

### 3. TrustProxy Configuration

#### Test: X-Forwarded-For header (should not trust from non-proxy)
```bash
curl -X POST \
  -H "x-org-key: demo-xff-$(date +%s)" \
  -H "x-visitor-id: v_xff_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "X-Forwarded-For: 1.2.3.4" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 201 Created
# Note: Check API logs for the actual IP used in rate limiting
# Should be 127.0.0.1 (not 1.2.3.4) because request came from localhost
```

---

### 4. Redis Persistence Check

#### Test: Create conversation and verify Redis key
```bash
# Create a conversation
curl -X POST \
  -H "x-org-key: demo-persist" \
  -H "x-visitor-id: v_persist_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations

# Check Redis for the rate limit key
docker exec helvino-redis redis-cli --scan --pattern "ratelimit:demo-persist:*"

# Get the value (request count)
docker exec helvino-redis redis-cli get <key-from-above>

# Expected: Should return "1" (one request made)
```

---

### 5. Combined Test: Messages Endpoint

#### Create conversation first
```bash
CONV_ID=$(curl -s -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_msg_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations | jq -r .id)

echo "Conversation ID: $CONV_ID"
```

#### Test: Valid domain - POST /messages
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_msg_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"role":"user","content":"Hello from valid domain"}' \
  http://localhost:4000/conversations/$CONV_ID/messages

# Expected: 201 Created
```

#### Test: Invalid domain - POST /messages
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_msg_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://hacker-site.com" \
  -d '{"role":"user","content":"Hello from invalid domain"}' \
  http://localhost:4000/conversations/$CONV_ID/messages

# Expected: 403 Forbidden
```

---

## Automated Test Suite

Run the comprehensive automated verification:

```bash
cd /Users/yavuz/Desktop/helvino
bash VERIFY_PRODUCTION_HARDENING.sh
```

**Important**: Wait 60-65 seconds between test runs to allow rate limits to reset.

---

## Checking Logs

### API Logs (structured logging)
```bash
# If running in terminal, check the terminal output
# Look for:
# - "Redis connected for rate limiting"
# - "Domain allowlist check passed"
# - "Domain not in allowlist, rejecting request"
# - requestId, orgKey, visitorId in all logs
```

### Redis Commands
```bash
# List all rate limit keys
docker exec helvino-redis redis-cli --scan --pattern "ratelimit:*"

# Get current count for a specific key
docker exec helvino-redis redis-cli get "ratelimit:demo:127.0.0.1:<window>"

# Monitor Redis commands in real-time
docker exec helvino-redis redis-cli monitor

# Check Redis memory usage
docker exec helvino-redis redis-cli info memory
```

---

## Troubleshooting

### Redis not connected
```bash
# Check if Redis is running
docker ps | grep helvino-redis

# Start Redis if needed
docker compose up -d redis

# Check Redis logs
docker logs helvino-redis
```

### Domain always rejected (even valid domains)
```bash
# Check demo org's allowed domains
docker exec helvino-postgres psql -U helvino -d helvino_dev -c \
  "SELECT key, name, \"allowedDomains\" FROM organizations WHERE key='demo';"

# Re-run seed if needed
cd apps/api
npx pnpm db:seed
```

### Rate limits not working
```bash
# Verify Redis connection in API logs
# Should see: "✅ Redis connected for rate limiting"

# Check REDIS_URL in .env
cat apps/api/.env | grep REDIS_URL

# Test Redis connection
redis-cli -u redis://localhost:6379 ping
# or
docker exec helvino-redis redis-cli ping
# Expected: PONG
```

---

## Summary Checklist

- ✅ Redis-based rate limiting (30/min conversations, 120/min messages)
- ✅ Rate limit headers present (`X-RateLimit-*`)
- ✅ Domain allowlist enforced (valid domains allowed, invalid rejected)
- ✅ Wildcard subdomains working (`*.helvino.io`)
- ✅ No Origin header allowed for curl/testing (with warning)
- ✅ trustProxy configuration prevents IP spoofing
- ✅ Redis persistence verified

All features working! 🎉
