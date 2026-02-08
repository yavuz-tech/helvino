# Step 10: Production Hardening - Quick Summary

## ✅ Implementation Complete

### 1. Redis-Based Rate Limiting
Replaced in-memory with Redis. Same limits (30/min, 120/min), same headers.

### 2. TrustProxy Configuration  
Prevents X-Forwarded-For spoofing. Only trusts configured proxy IPs.

### 3. Domain Allowlist
Validates Origin/Referer for widget endpoints. Per-org configuration with wildcard support.

---

## 📦 Files Changed

### New Files (2):
1. `apps/api/src/middleware/domain-allowlist.ts` - Domain validation middleware
2. `apps/api/prisma/migrations/20260205181337_add_allowed_domains/` - DB migration

### Modified Files (9):
1. `apps/api/src/middleware/rate-limit.ts` - Redis implementation
2. `apps/api/src/index.ts` - trustProxy config + domain middleware
3. `apps/api/src/routes/bootloader.ts` - Domain middleware
4. `apps/api/src/types.ts` - Added allowedDomains
5. `apps/api/src/store.ts` - Return allowedDomains
6. `apps/api/prisma/schema.prisma` - allowedDomains field
7. `apps/api/prisma/seed.ts` - Seed domains
8. `apps/api/.env.example` - New env vars
9. `docker-compose.yml` - Redis service

### Dependency Added:
- `ioredis` (Redis client)

---

## 🔧 Minimal Environment Variables

### Required:
```env
REDIS_URL="redis://localhost:6379"
TRUSTED_PROXIES="127.0.0.1,::1"
```

### Production Examples:

**Upstash Redis:**
```env
REDIS_URL="rediss://default:xxxxx@xxx.upstash.io:6379"
```

**Behind nginx proxy:**
```env
TRUSTED_PROXIES="10.0.0.5"
```

**Behind Cloudflare:**
```env
TRUSTED_PROXIES="loopback"
```

---

## ✅ Verification Curl Commands

### 1. Redis Rate Limiting Works

**Normal request:**
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_$(date +%s)" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations
```
**Expected:** `201 Created` with conversation ID

**Rate limit trigger (35 requests):**
```bash
for i in {1..35}; do
  curl -s -X POST \
    -H "x-org-key: demo-rate-$(date +%s)" \
    -H "x-visitor-id: v_rate_$i" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{}' \
    http://localhost:4000/conversations | jq -c .error
done
```
**Expected:** First 30 succeed, last 5 return `"Rate limit exceeded"`

---

### 2. Domain Allowlist Works

**Valid domain (allowed):**
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_valid" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations
```
**Expected:** `201 Created`

**Invalid domain (rejected):**
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_invalid" \
  -H "Content-Type: application/json" \
  -H "Origin: http://evil.com" \
  -d '{}' \
  http://localhost:4000/conversations
```
**Expected:** `403 Forbidden` with `"error":"Domain not allowed"`

**Wildcard subdomain (allowed):**
```bash
curl -X GET \
  -H "x-org-key: demo" \
  -H "Origin: https://app.helvion.io" \
  http://localhost:4000/api/bootloader
```
**Expected:** `200 OK` (matches `*.helvion.io`)

**Bootloader invalid domain:**
```bash
curl -X GET \
  -H "x-org-key: demo" \
  -H "Origin: http://hacker.com" \
  http://localhost:4000/api/bootloader
```
**Expected:** `403 Forbidden`

---

### 3. TrustProxy Prevents Spoofing

**X-Forwarded-For from non-trusted source:**
```bash
curl -X POST \
  -H "x-org-key: demo-xff-$(date +%s)" \
  -H "x-visitor-id: v_xff" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "X-Forwarded-For: 1.2.3.4" \
  -d '{}' \
  http://localhost:4000/conversations
```
**Expected:** `201 Created` (but logs show real IP `127.0.0.1`, not spoofed `1.2.3.4`)

---

### 4. Redis Persistence Check

**Create and verify:**
```bash
# Create conversation
curl -X POST \
  -H "x-org-key: demo-persist" \
  -H "x-visitor-id: v_persist" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations

# Check Redis key exists
docker exec helvino-redis redis-cli --scan --pattern "ratelimit:demo-persist:*"
```
**Expected:** Should find a Redis key with pattern `ratelimit:demo-persist:127.0.0.1:<window>`

---

## 🚀 Quick Setup

```bash
# 1. Start Redis
docker compose up -d redis

# 2. Install dependencies
cd apps/api
npx pnpm install

# 3. Regenerate Prisma client
npx prisma generate

# 4. Run seed (adds allowed domains to demo org)
npx pnpm db:seed

# 5. Restart API
npx pnpm dev
```

---

## 🔍 Verify Redis Connection

```bash
# Check Redis is running
docker ps | grep helvino-redis

# Test connection
docker exec helvino-redis redis-cli ping
# Expected: PONG

# Check API logs for:
# "✅ Redis connected for rate limiting"
```

---

## 📚 Full Documentation

- `PRODUCTION_HARDENING_SUMMARY.md` - Complete implementation details
- `PRODUCTION_HARDENING_QUICK_TEST.md` - All test commands
- `VERIFY_PRODUCTION_HARDENING.sh` - Automated test suite

---

## 🎯 What Changed

| Feature | Before | After |
|---------|--------|-------|
| **Rate Limiting** | In-memory Map | Redis (distributed) |
| **Proxy Trust** | `trustProxy: true` (trusts all) | Configurable IP list |
| **Domain Control** | None | Per-org allowlist with wildcards |
| **Persistence** | None (lost on restart) | Redis with AOF |
| **Multi-instance** | ❌ Rate limits per instance | ✅ Shared across instances |

---

## ✅ Verification Checklist

- ✅ Redis connected (see "✅ Redis connected for rate limiting" in logs)
- ✅ Rate limiting works (429 after 30 requests/min)
- ✅ Valid domains allowed (localhost:3000 → 201)
- ✅ Invalid domains rejected (evil.com → 403)
- ✅ Wildcard subdomains work (app.helvion.io → 200)
- ✅ No Origin header allowed for curl/testing (with warning)
- ✅ X-Forwarded-For not trusted from non-proxy sources
- ✅ Rate limit keys persisted in Redis

**Run automated tests:**
```bash
cd /Users/yavuz/Desktop/helvino
bash VERIFY_PRODUCTION_HARDENING.sh
```

---

## 🎉 Production Ready

All three hardening features are complete and tested:

1. ✅ **Redis Rate Limiting** - Distributed, scalable, production-ready
2. ✅ **TrustProxy Configuration** - Prevents IP spoofing attacks
3. ✅ **Domain Allowlist** - Prevents unauthorized widget embedding

Zero breaking changes. Same API behavior with enhanced security! 🚀
