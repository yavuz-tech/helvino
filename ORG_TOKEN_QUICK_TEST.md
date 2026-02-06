# Org Token Security - Quick Test Guide

## Prerequisites

- API server running on `http://localhost:4000`
- `ORG_TOKEN_SECRET` set in `apps/api/.env`
- `INTERNAL_API_KEY` set (optional, for bypass testing)

---

## Test 1: Bootloader Returns Token

```bash
curl -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq '{ok, orgToken: .orgToken[:50], org: .org.key}'
```

**Expected Output:**
```json
{
  "ok": true,
  "orgToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6Ik9yZ1Rva2VuIn0.eyJv...",
  "org": "demo"
}
```

---

## Test 2: POST Without Token (Should Fail)

```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations
```

**Expected Output (403):**
```json
{
  "error": "Missing org token",
  "message": "This endpoint requires a valid org token. Call GET /api/bootloader first to obtain a token."
}
```

---

## Test 3: POST With Valid Token (Should Succeed)

```bash
# Get token
TOKEN=$(curl -s -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq -r .orgToken)

# Create conversation with token
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "x-visitor-id: v_test_$(date +%s)" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations | jq
```

**Expected Output (201):**
```json
{
  "id": "1770316217708-v31bxtzbf",
  "createdAt": "2026-02-05T18:30:17.708Z"
}
```

---

## Test 4: Send Message With Token

```bash
# Get token
TOKEN=$(curl -s -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq -r .orgToken)

# Create conversation
CONV_ID=$(curl -s -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "x-visitor-id: v_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations | jq -r .id)

echo "Conversation ID: $CONV_ID"

# Send message
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "x-visitor-id: v_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"role":"user","content":"Hello with token!"}' \
  http://localhost:4000/conversations/$CONV_ID/messages | jq
```

**Expected Output (201):**
```json
{
  "id": "...",
  "conversationId": "...",
  "role": "user",
  "content": "Hello with token!",
  "timestamp": "..."
}
```

---

## Test 5: Internal Bypass (No Token Needed)

```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  -H "x-visitor-id: v_internal" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations | jq
```

**Expected Output (201):**
```json
{
  "id": "...",
  "createdAt": "..."
}
```

**Note:** Check API logs for "Internal API key bypass used"

---

## Test 6: Invalid Token (Should Fail)

```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: invalid.token.here" \
  -H "x-visitor-id: v_test" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations
```

**Expected Output (403):**
```json
{
  "error": "Invalid or expired org token",
  "message": "Your org token is invalid or has expired. Call GET /api/bootloader to obtain a new token."
}
```

---

## Test 7: Token Details (Inspect)

```bash
# Get token
TOKEN=$(curl -s -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq -r .orgToken)

# Decode payload (middle part)
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

**Expected Output:**
```json
{
  "orgId": "cml9pye7t0000d55ndyrk3ngi",
  "orgKey": "demo",
  "iat": 1738784400,
  "exp": 1738784700
}
```

**Note:** Token expires 5 minutes (300 seconds) after `iat`

---

## Test 8: Widget Integration (Manual)

### Setup
1. Ensure `window.HELVINO_ORG_KEY = "demo"` is set
2. Open widget in browser (http://localhost:5173 or embed page)

### Expected Behavior
1. Widget calls bootloader on load
2. Console shows: "Bootloader config loaded"
3. Console shows: "✅ Org token cached for API requests"
4. Opening widget creates conversation (no errors)
5. Sending message works (no errors)

### Console Logs to Look For
```
Bootloader config loaded Object { ok: true, org: {...}, config: {...}, orgToken: "...", ... }
✅ Org token cached for API requests
```

### If Errors Occur
- Check browser console for "Missing org token" or "Invalid org token"
- Verify `ORG_TOKEN_SECRET` is set in API `.env`
- Restart API server after changing `.env`

---

## Troubleshooting

### Error: "ORG_TOKEN_SECRET environment variable is not set"
**Fix:** Add to `apps/api/.env`:
```env
ORG_TOKEN_SECRET="5AhIFPMXBmyCyndrj8J6plt9R0A67jtT27p60v+9XNw="
```
Generate with: `openssl rand -base64 32`

### Error: "Missing org token"
- Ensure you're passing `x-org-token` header on POST requests
- Check that bootloader returned an `orgToken` in response
- Verify widget is calling `setOrgToken(config.orgToken)`

### Error: "Invalid or expired org token"
- Token expires after 5 minutes
- Call bootloader again to get a new token
- Check server time is correct (tokens use timestamps)

### Internal bypass not working
- Verify `INTERNAL_API_KEY` is set in `.env`
- Ensure header is `x-internal-key` (exact match)
- Check API logs for "Internal API key bypass used"

---

## Quick Verification Checklist

- ✅ Bootloader returns `orgToken` field
- ✅ POST without token → 403 "Missing org token"
- ✅ POST with valid token → 201 Created
- ✅ POST with invalid token → 403 "Invalid or expired org token"
- ✅ Internal bypass works with `x-internal-key`
- ✅ Widget loads and works without errors
- ✅ Widget console shows "Org token cached"

**All checks passed? Your org token security is working! 🎉**
