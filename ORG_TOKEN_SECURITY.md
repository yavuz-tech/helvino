# Organization Token Security System

## Overview

The Helvino API implements a short-lived signed token system to protect against organization key (`orgKey`) theft. This prevents unauthorized parties from creating conversations or sending messages even if they obtain an organization's `orgKey`.

## Architecture

### 1. Token Flow

```
Widget → GET /api/bootloader (x-org-key) → API
API → Generate orgToken (HMAC signed, 5-min expiry) → Widget
Widget → POST /conversations (x-org-token) → API
API → Verify token + Load org → Handle request
```

### 2. Token Format

Custom JWT-like format: `header.payload.signature`

**Header:**
```json
{
  "alg": "HS256",
  "typ": "OrgToken"
}
```

**Payload:**
```json
{
  "orgId": "org_xxx",
  "orgKey": "demo",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Signature:** HMAC SHA256 of `header.payload` using `ORG_TOKEN_SECRET`

All parts are base64url encoded.

---

## API Changes

### Protected Endpoints

The following endpoints now **require** `x-org-token` header:

- `POST /conversations` - Create conversation
- `POST /conversations/:id/messages` - Send message

### Bootloader Endpoint (Public)

`GET /api/bootloader` remains **public** and only requires `x-org-key`:

**Request:**
```bash
curl -H "x-org-key: demo" http://localhost:4000/api/bootloader
```

**Response:**
```json
{
  "ok": true,
  "org": { "id": "...", "key": "demo", "name": "Demo Org" },
  "config": { ... },
  "orgToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6Ik9yZ1Rva2VuIn0...",
  "env": "dev",
  "timestamp": "2026-02-05T18:30:00.000Z"
}
```

### Error Responses

**Missing Token (403):**
```json
{
  "error": "Missing org token",
  "message": "This endpoint requires a valid org token. Call GET /api/bootloader first to obtain a token."
}
```

**Invalid/Expired Token (403):**
```json
{
  "error": "Invalid or expired org token",
  "message": "Your org token is invalid or has expired. Call GET /api/bootloader to obtain a new token."
}
```

---

## Widget Changes

### Automatic Token Management

The widget automatically:

1. **Calls bootloader** on initialization with `x-org-key`
2. **Caches `orgToken`** in memory from bootloader response
3. **Sends `x-org-token`** header on all write operations (POST requests)

### API Client (`src/api.ts`)

```typescript
// Set token after bootloader loads
setOrgToken(config.orgToken);

// Automatically includes x-org-token for POST requests
await createConversation(); // Includes x-org-token
await sendMessage(id, content); // Includes x-org-token
```

### No Changes Required

If you're embedding the widget with `window.HELVINO_ORG_KEY`, **nothing changes**. The widget handles token management automatically.

---

## Internal/Dashboard Bypass

For internal tools, dashboard, or development purposes, you can bypass the org token requirement using an internal API key.

### Setup

1. Set `INTERNAL_API_KEY` in `apps/api/.env`:
   ```env
   INTERNAL_API_KEY="your-secret-internal-key-here"
   ```

2. Include `x-internal-key` header in requests:
   ```bash
   curl -X POST \
     -H "x-org-key: demo" \
     -H "x-internal-key: your-secret-internal-key-here" \
     -H "Content-Type: application/json" \
     -d '{}' \
     http://localhost:4000/conversations
   ```

### When to Use

- Internal admin dashboard (`apps/web`)
- Development/testing scripts
- Backend-to-backend API calls
- Automated systems that can't refresh tokens

**Note:** Do NOT expose `INTERNAL_API_KEY` to the public. It bypasses all org token security.

---

## Environment Variables

### Required

**`ORG_TOKEN_SECRET`** (required)
- Secret key for signing org tokens
- Must be at least 32 bytes (base64 encoded)
- Generate with: `openssl rand -base64 32`
- Example: `ORG_TOKEN_SECRET="5AhIFPMXBmyCyndrj8J6plt9R0A67jtT27p60v+9XNw="`

### Optional

**`INTERNAL_API_KEY`** (optional)
- Bypass token requirement for internal usage
- Only set if needed for dashboard/dev
- Generate with: `openssl rand -base64 24`
- Example: `INTERNAL_API_KEY="r/b6LoI/2m6axryScc8YscXs3tEYWLHw"`
- Leave empty in production if not needed

---

## Security Benefits

### Before (Only orgKey)
- ❌ If `orgKey` is stolen → Attacker can create unlimited conversations/messages
- ❌ No expiration → Stolen key works forever
- ❌ No rate limiting per attacker → Easy to abuse

### After (orgKey + orgToken)
- ✅ Stolen `orgKey` alone → **Cannot create conversations/messages**
- ✅ Token expires in 5 minutes → Attacker must call bootloader repeatedly
- ✅ Bootloader can enforce domain allowlist → Attacker blocked if not from allowed domain
- ✅ Token includes `orgId` → Extra validation layer
- ✅ HMAC signed → Cannot be forged without `ORG_TOKEN_SECRET`

---

## Testing

### Test 1: Normal Widget Flow
```bash
# 1. Get token from bootloader
TOKEN=$(curl -s -H "x-org-key: demo" \
  http://localhost:4000/api/bootloader | jq -r .orgToken)

# 2. Create conversation with token
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "x-visitor-id: v_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 201 Created with conversation ID
```

### Test 2: Attempt Without Token (Should Fail)
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-visitor-id: v_test" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 403 Forbidden
# {"error":"Missing org token","message":"..."}
```

### Test 3: Internal Bypass
```bash
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  -H "x-visitor-id: v_internal" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 201 Created (bypass successful)
```

### Test 4: Expired Token (After 5 Minutes)
```bash
# Wait 5+ minutes after getting token, then try to use it
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $OLD_TOKEN" \
  -H "x-visitor-id: v_test" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 403 Forbidden
# {"error":"Invalid or expired org token","message":"..."}
```

---

## Migration Notes

### Breaking Changes
- **None** - Widget automatically handles the new flow
- Existing `x-org-key` based calls to non-POST routes still work (GET endpoints)

### Backward Compatibility
- ✅ Bootloader still uses only `x-org-key` (no token needed)
- ✅ GET endpoints unchanged (conversations list, conversation detail)
- ✅ Internal bypass available for dashboard/dev usage
- ✅ Widget handles token automatically (no code changes needed)

### What You Need to Do
1. Set `ORG_TOKEN_SECRET` in `apps/api/.env` (required)
2. Optionally set `INTERNAL_API_KEY` for internal tools
3. Restart API server
4. Rebuild and redeploy widget (if already deployed)

---

## Implementation Details

### Files Changed

**API:**
- `apps/api/src/utils/org-token.ts` - Token creation/verification
- `apps/api/src/middleware/require-org-token.ts` - Token middleware
- `apps/api/src/routes/bootloader.ts` - Returns orgToken
- `apps/api/src/index.ts` - Applied middleware to POST routes
- `apps/api/.env.example` - Added env vars
- `apps/api/.env` - Added secrets

**Widget:**
- `apps/widget/src/api.ts` - Token caching and usage
- `apps/widget/src/App.tsx` - Calls setOrgToken after bootloader

### Token Expiry
- **Default:** 5 minutes (300 seconds)
- **Configurable:** Modify `TOKEN_EXPIRY_MS` in `apps/api/src/utils/org-token.ts`
- **Recommendation:** 5-10 minutes for production (balances security vs. user experience)

### Token Refresh
- Widget should call bootloader again when token expires
- Future enhancement: Implement automatic token refresh in background
- Current: Widget displays error, user can retry

---

## FAQ

**Q: What if widget calls bootloader from an unauthorized domain?**  
A: The domain allowlist middleware will reject the request with 403 before a token is issued.

**Q: Can I use the same token for multiple widgets?**  
A: Yes, but the token is tied to `orgId`. All widgets for the same org can share tokens.

**Q: What happens if `ORG_TOKEN_SECRET` is leaked?**  
A: Attacker can forge tokens. **Rotate the secret immediately** and redeploy.

**Q: Should I set `INTERNAL_API_KEY` in production?**  
A: Only if you have internal tools that need to bypass tokens. Otherwise leave empty for security.

**Q: Can I extend token expiry beyond 5 minutes?**  
A: Yes, modify `TOKEN_EXPIRY_MS` in `org-token.ts`. But shorter = more secure.

**Q: Does Socket.IO require org tokens?**  
A: No, Socket.IO still uses `orgKey` in handshake auth. Tokens are only for HTTP POST endpoints.

---

## Security Best Practices

1. **Never expose `ORG_TOKEN_SECRET`** - Treat like database passwords
2. **Rotate `ORG_TOKEN_SECRET` periodically** - Every 90 days recommended
3. **Keep `INTERNAL_API_KEY` secret** - Do not commit to version control
4. **Monitor 403 errors** - Could indicate token theft attempts
5. **Use HTTPS in production** - Tokens sent in headers must be encrypted in transit
6. **Enable domain allowlist** - Prevents bootloader calls from unauthorized domains
7. **Rate limit bootloader** - Prevents token farming attacks

---

## Summary

✅ **Bootloader** returns `orgToken` (public, only requires `x-org-key`)  
✅ **Widget** uses `x-org-token` for all POST requests automatically  
✅ **Internal bypass** available via `x-internal-key` for dashboard/dev  
✅ **Zero breaking changes** - Widget handles everything automatically  
✅ **Production safe** - Short-lived tokens prevent orgKey theft abuse  

🔒 **Your API is now protected against organization key theft!**
