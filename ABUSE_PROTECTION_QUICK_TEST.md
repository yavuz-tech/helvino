# Quick Test Guide: Abuse Protection

## Prerequisites

1. API server running on `http://localhost:4000`
2. PostgreSQL running with seeded "demo" organization

## Quick Manual Tests

### 1. Normal Flow (Should Work)

```bash
# Create conversation
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_user_001" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# Save the returned ID, then add a message
CONV_ID="<paste-id-here>"
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test_user_001" \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Hello!"}' \
  http://localhost:4000/conversations/$CONV_ID/messages
```

### 2. Rate Limiting (Should Get 429 After 30 Requests)

```bash
# Run 35 times rapidly - last 5 should get 429
for i in {1..35}; do
  curl -s -X POST \
    -H "x-org-key: demo-rate-test" \
    -H "x-visitor-id: v_rate_test" \
    -H "Content-Type: application/json" \
    -d '{}' \
    http://localhost:4000/conversations | jq -c '{id, error}'
done
```

### 3. Invalid Org Key (Should Get 400)

```bash
curl -X POST \
  -H "x-org-key: invalid@key!" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: {"error":"x-org-key contains invalid characters"}
```

### 4. Invalid Visitor ID (Should Get 400)

```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: bad_format" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: {"error":"x-visitor-id must start with 'v_'"}
```

### 5. Missing Content-Type (Should Get 415)

```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test" \
  -d '{"role":"user","content":"test"}' \
  http://localhost:4000/conversations/some-id/messages

# Expected: {"error":"Unsupported Media Type"}
```

### 6. Check Rate Limit Headers

```bash
curl -i -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_headers_test" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# Look for:
# x-ratelimit-limit: 30
# x-ratelimit-remaining: 29
# x-ratelimit-reset: <timestamp>
```

## Automated Test Suite

```bash
cd /Users/yavuz/Desktop/helvino

# Wait for rate limits to clear (if you've been testing)
echo "Waiting 65 seconds for rate limits to reset..."
sleep 65

# Run the automated verification
bash VERIFY_ABUSE_PROTECTION.sh
```

## Expected Results

All 7 tests should pass:
- ✅ Normal conversation creation
- ✅ Rate limiting (30/min working)
- ✅ Invalid org-key rejected
- ✅ Invalid visitor-id rejected
- ✅ Content-Type enforcement
- ✅ Oversized content rejected
- ✅ Rate limit headers present

## Viewing Structured Logs

The API logs detailed request metadata. To see it in real-time:

```bash
# If running in terminal, view the logs directly
# Check /Users/yavuz/.cursor/projects/.../terminals/*.txt files
# or run the API with visible output

cd /Users/yavuz/Desktop/helvino/apps/api
npx pnpm dev

# Make a request and observe the structured log output
```

## Troubleshooting

### "Rate limit exceeded" on first request

The "demo" org key's rate limit is exhausted. Wait 60 seconds or use a different org key.

### "Invalid organization key"

The org key doesn't exist in the database. Use "demo" or create a new organization via Prisma:

```bash
cd apps/api
npx prisma studio
# Add a new Organization with a custom key
```

### Port 4000 already in use

Kill the existing process:

```bash
lsof -ti:4000 | xargs kill -9
```
