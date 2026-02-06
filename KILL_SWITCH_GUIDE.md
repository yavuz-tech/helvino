# Kill Switch System - Production Emergency Controls

## Overview

The Helvino API includes production-grade kill switches to instantly disable operations per-organization without breaking embed behavior or requiring code changes.

## Kill Switch Types

### 1. `widgetEnabled` (Widget Kill Switch)
- **Purpose:** Completely disable widget rendering
- **Effect:** Widget does not mount on client pages
- **Use Case:** Emergency shutdown, contract termination, policy violation

### 2. `writeEnabled` (Write Operations Kill Switch)
- **Purpose:** Disable all write operations (POST requests)
- **Effect:** Conversations and messages cannot be created
- **Use Case:** Abuse mitigation, maintenance, rate limit breach

### 3. `aiEnabled` (AI Features Kill Switch)
- **Purpose:** Disable AI-powered responses
- **Effect:** Currently informational (future AI integration)
- **Use Case:** AI model issues, cost control, compliance

---

## Database Schema

### Organization Model (Prisma)

```prisma
model Organization {
  id             String         @id @default(cuid())
  key            String         @unique
  name           String
  allowedDomains String[]       @default([])
  widgetEnabled  Boolean        @default(true)   // Widget kill switch
  writeEnabled   Boolean        @default(true)   // Write ops kill switch
  aiEnabled      Boolean        @default(true)   // AI kill switch
  primaryColor   String?                         // Custom theme
  createdAt      DateTime       @default(now())
  // ... relations
}
```

**Migration:** `20260205185428_add_kill_switch_controls`

---

## API Behavior

### Bootloader Response

`GET /api/bootloader` returns kill switch states in config:

```json
{
  "ok": true,
  "org": { "id": "...", "key": "demo", "name": "Demo Org" },
  "config": {
    "widgetEnabled": true,
    "writeEnabled": true,
    "aiEnabled": true,
    "language": "en",
    "theme": { "primaryColor": "#0F5C5C" }
  },
  "orgToken": "...",
  "env": "dev",
  "timestamp": "2026-02-05T18:58:00.000Z"
}
```

### Write Protection Enforcement

**Protected Endpoints:**
- `POST /conversations`
- `POST /conversations/:id/messages`

**Enforcement Logic:**
1. Verify org token (existing)
2. Load organization from database
3. Check `org.writeEnabled`:
   - If `false` → Return 403 with clear error
   - If `true` → Allow request to proceed

**Error Response (403):**
```json
{
  "error": "Writes disabled",
  "message": "Write operations are temporarily disabled for this organization."
}
```

### Internal Override

**Environment Variable:** `INTERNAL_OVERRIDE_WRITES`

**Default:** `false` (internal API key respects writeEnabled)

**When `true`:** Internal API key bypasses writeEnabled check (emergency admin override)

**Example:**
```env
INTERNAL_OVERRIDE_WRITES=true
```

---

## Widget Behavior

### When `widgetEnabled = false`
- Widget does not mount
- No UI rendered on client pages
- User sees nothing (graceful degradation)

### When `writeEnabled = false`
- Widget mounts normally
- Chat UI renders in **read-only mode**
- Input box replaced with notice: "💬 Chat is temporarily unavailable."
- No POST requests attempted
- User can still view existing messages (if conversation exists)

### When `writeEnabled` Changes to `true`
- On next bootloader refresh (auto-renew cycle), widget detects change
- Input box re-enables automatically
- User can send messages again
- No page reload required

---

## Admin API

### Update Organization Settings

**Endpoint:** `PATCH /api/org/:key/settings`

**Authentication:** Requires `x-internal-key` header

**Request Body:**
```json
{
  "widgetEnabled": false,     // Optional
  "writeEnabled": false,      // Optional
  "aiEnabled": false,         // Optional
  "primaryColor": "#FF5733"   // Optional
}
```

**Response (200):**
```json
{
  "ok": true,
  "org": {
    "id": "cml9pye7t0000d55ndyrk3ngi",
    "key": "demo",
    "name": "Demo Org"
  },
  "settings": {
    "widgetEnabled": false,
    "writeEnabled": false,
    "aiEnabled": false,
    "primaryColor": "#FF5733"
  }
}
```

### Get Organization Settings

**Endpoint:** `GET /api/org/:key/settings`

**Authentication:** Requires `x-internal-key` header

**Response (200):**
```json
{
  "ok": true,
  "org": { "id": "...", "key": "demo", "name": "Demo Org" },
  "settings": {
    "widgetEnabled": true,
    "writeEnabled": true,
    "aiEnabled": true,
    "primaryColor": "#0F5C5C"
  }
}
```

---

## Usage Examples

### Emergency: Disable All Writes

```bash
curl -X PATCH \
  -H "x-internal-key: YOUR_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":false}' \
  http://localhost:4000/api/org/demo/settings
```

**Effect:**
- All POST requests immediately fail with 403
- Widget shows "Chat is temporarily unavailable"
- No new conversations or messages created
- Existing data remains accessible (GET endpoints still work)

### Re-Enable Writes

```bash
curl -X PATCH \
  -H "x-internal-key: YOUR_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":true}' \
  http://localhost:4000/api/org/demo/settings
```

**Effect:**
- POST requests work again
- Widget re-enables input automatically (on next token refresh)
- Users can send messages

### Disable Entire Widget

```bash
curl -X PATCH \
  -H "x-internal-key: YOUR_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"widgetEnabled":false}' \
  http://localhost:4000/api/org/demo/settings
```

**Effect:**
- Widget does not mount on client pages
- Users see nothing (invisible)
- Bootloader still responds (ok:true, widgetEnabled:false)

### Check Current Settings

```bash
curl -H "x-internal-key: YOUR_INTERNAL_KEY" \
  http://localhost:4000/api/org/demo/settings | jq
```

---

## Testing & Verification

### Test 1: Disable Writes

```bash
# Disable writes
curl -X PATCH \
  -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":false}' \
  http://localhost:4000/api/org/demo/settings

# Try to create conversation
TOKEN=$(curl -s -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq -r .orgToken)
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 403 {"error":"Writes disabled","message":"..."}
```

### Test 2: Re-Enable and Verify

```bash
# Re-enable writes
curl -X PATCH \
  -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":true}' \
  http://localhost:4000/api/org/demo/settings

# Try again
TOKEN=$(curl -s -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq -r .orgToken)
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# Expected: 201 {"id":"...","createdAt":"..."}
```

### Test 3: Widget Read-Only Mode

```bash
# Disable writes
curl -X PATCH \
  -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":false}' \
  http://localhost:4000/api/org/demo/settings

# Open widget in browser
# Expected: Input box hidden, notice shows "💬 Chat is temporarily unavailable."
```

### Test 4: Bootloader Reflects Current State

```bash
curl -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq .config

# Expected: Shows current writeEnabled state from database
```

---

## Emergency Response Scenarios

### Scenario 1: Abuse Detection

**Situation:** Org creating spam conversations/messages

**Action:**
```bash
curl -X PATCH \
  -H "x-internal-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":false}' \
  http://localhost:4000/api/org/ABUSER_ORG/settings
```

**Effect:**
- All write operations stop immediately
- Investigation can proceed
- Re-enable when resolved

### Scenario 2: Database Maintenance

**Situation:** Need to run migrations, backup, or maintenance

**Action:**
```bash
# Disable all writes across all orgs (if needed)
# Or disable specific org:
curl -X PATCH \
  -H "x-internal-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":false}' \
  http://localhost:4000/api/org/CUSTOMER_ORG/settings
```

**Effect:**
- No new data written during maintenance
- Users see "temporarily unavailable" notice
- Re-enable after maintenance completes

### Scenario 3: Contract Termination

**Situation:** Customer contract ends, need to disable service

**Action:**
```bash
curl -X PATCH \
  -H "x-internal-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"widgetEnabled":false,"writeEnabled":false}' \
  http://localhost:4000/api/org/TERMINATED_ORG/settings
```

**Effect:**
- Widget stops rendering on their site
- No API access
- Data remains in database (can be exported if needed)

### Scenario 4: Emergency Override (Admin Force Write)

**Situation:** Need to create data for disabled org (admin operation)

**Action:**
```bash
# Set INTERNAL_OVERRIDE_WRITES=true in .env
# Restart API
# Use internal key to bypass writeEnabled:
curl -X POST \
  -H "x-org-key: TARGET_ORG" \
  -H "x-internal-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations

# This will work even if writeEnabled=false
```

---

## Monitoring & Alerts

### What to Monitor

**High Priority:**
- 403 errors with "Writes disabled" (indicates kill switch active)
- PATCH requests to `/api/org/:key/settings` (admin actions)
- Changes to writeEnabled/widgetEnabled (audit log)

**Metrics to Track:**
- Number of orgs with writeEnabled=false
- Number of orgs with widgetEnabled=false
- Duration writes were disabled per org
- User impact (conversations affected)

### Logging

API logs include kill switch state:

```json
{
  "level": "warn",
  "msg": "Write operations disabled for organization",
  "orgKey": "demo",
  "orgId": "...",
  "writeEnabled": false
}
```

---

## Configuration

### Environment Variables

**`INTERNAL_API_KEY`** (required for admin API)
```env
INTERNAL_API_KEY="your-secret-key"
```

**`INTERNAL_OVERRIDE_WRITES`** (optional)
```env
INTERNAL_OVERRIDE_WRITES=false  # Default: respect writeEnabled
INTERNAL_OVERRIDE_WRITES=true   # Emergency: bypass writeEnabled with internal key
```

### Database Defaults

All organizations default to:
```typescript
{
  widgetEnabled: true,
  writeEnabled: true,
  aiEnabled: true,
  primaryColor: "#0F5C5C"
}
```

---

## Widget Integration

### No Code Changes Needed

Existing widget embeds work without modification:

```html
<script>window.HELVINO_ORG_KEY = "demo"</script>
<script src="/embed.js"></script>
```

### Automatic Behavior

**When `writeEnabled=true`:**
- Normal operation
- Input enabled
- Messages sent

**When `writeEnabled=false`:**
- Read-only mode
- Input replaced with notice
- No POST attempts

**When `widgetEnabled=false`:**
- Widget does not render
- Nothing shown to user

---

## Security Best Practices

### 1. Protect Internal API Key
- Never expose `INTERNAL_API_KEY` to frontend
- Rotate periodically
- Use different keys for dev/staging/prod

### 2. Audit Kill Switch Changes
- Log all PATCH requests to settings
- Alert on unexpected changes
- Track who changed what and when

### 3. Document Kill Switch Actions
- Create incident log for each disable/enable
- Document reason for action
- Note duration and impact

### 4. Test Kill Switches Regularly
- Run drills to ensure they work
- Verify widget shows proper notice
- Confirm re-enabling works smoothly

### 5. Monitor User Impact
- Track 403 errors during kill switch
- Monitor user frustration signals
- Communicate status to customers

---

## FAQ

**Q: What happens to existing conversations when writeEnabled=false?**  
A: They remain accessible via GET endpoints. Users just can't create new ones or add messages.

**Q: Can internal tools still write when writeEnabled=false?**  
A: By default, no. Set `INTERNAL_OVERRIDE_WRITES=true` to allow emergency admin writes.

**Q: How fast does the kill switch take effect?**  
A: Immediate. Next POST request after PATCH will fail. Widget updates on next bootloader refresh (~5min or on page reload).

**Q: Can I disable writes for all orgs at once?**  
A: Yes, but requires SQL query or script to update all orgs. Admin API is per-org.

**Q: What if I disable widgetEnabled by mistake?**  
A: Just PATCH to set `widgetEnabled: true`. Users can reload page to see widget again.

**Q: Does Socket.IO stop working when writeEnabled=false?**  
A: No, Socket.IO connections remain active. Only POST endpoints are blocked.

**Q: Can I customize the "Chat is temporarily unavailable" message?**  
A: Yes, edit `apps/widget/src/App.tsx`. Currently hardcoded for simplicity.

---

## Troubleshooting

### Issue: PATCH returns 401

**Cause:** Missing or invalid `x-internal-key`

**Fix:**
```bash
# Verify env var is set
cat apps/api/.env | grep INTERNAL_API_KEY

# Use correct header name
curl -X PATCH -H "x-internal-key: YOUR_KEY" ...
```

### Issue: Kill switch doesn't take effect

**Cause:** Widget cached old bootloader config

**Fix:**
- Wait up to 5 minutes for auto-refresh
- Or reload page to force new bootloader call
- Future enhancement: Add manual refresh button

### Issue: Internal bypass still blocked

**Cause:** `INTERNAL_OVERRIDE_WRITES=false` (default)

**Fix:**
```bash
# In apps/api/.env
INTERNAL_OVERRIDE_WRITES=true

# Restart API
```

### Issue: Widget shows notice but writes work

**Cause:** Widget and API out of sync (widget cached old config)

**Fix:**
- Widget will sync on next token refresh
- Or reload page
- Check bootloader returns correct writeEnabled state

---

## Production Deployment Checklist

### Before Deploy

- [ ] Verify `INTERNAL_API_KEY` is set in production `.env`
- [ ] Set `INTERNAL_OVERRIDE_WRITES=false` (default)
- [ ] Test kill switches in staging
- [ ] Document incident response procedures
- [ ] Set up monitoring for 403 errors

### Emergency Kill Switch Procedure

1. **Disable Writes:**
   ```bash
   curl -X PATCH \
     -H "x-internal-key: PROD_KEY" \
     -H "Content-Type: application/json" \
     -d '{"writeEnabled":false}' \
     https://api.helvino.io/api/org/CUSTOMER/settings
   ```

2. **Verify:**
   ```bash
   curl -H "x-internal-key: PROD_KEY" \
     https://api.helvino.io/api/org/CUSTOMER/settings
   ```

3. **Monitor:**
   - Check for 403 "Writes disabled" errors in logs
   - Verify widget shows "temporarily unavailable" notice

4. **Investigate Issue:**
   - Review logs, metrics, user reports
   - Identify root cause
   - Implement fix

5. **Re-Enable:**
   ```bash
   curl -X PATCH \
     -H "x-internal-key: PROD_KEY" \
     -H "Content-Type: application/json" \
     -d '{"writeEnabled":true}' \
     https://api.helvino.io/api/org/CUSTOMER/settings
   ```

6. **Verify Recovery:**
   - Test conversation creation
   - Monitor for normal operation
   - Communicate status to customer

---

## Summary

### Files Changed (10 files)

**API (7 files):**
1. `apps/api/prisma/schema.prisma` - Added kill switch fields
2. `apps/api/prisma/seed.ts` - Seed defaults
3. `apps/api/src/types.ts` - Added fields to Organization interface
4. `apps/api/src/store.ts` - Return kill switch fields
5. `apps/api/src/routes/bootloader.ts` - Return config from DB
6. `apps/api/src/routes/org-admin.ts` - NEW: Admin settings API
7. `apps/api/src/middleware/require-org-token.ts` - Enforce writeEnabled
8. `apps/api/src/index.ts` - Register admin routes
9. `apps/api/.env.example` - Document INTERNAL_OVERRIDE_WRITES
10. `apps/api/.env` - Add INTERNAL_OVERRIDE_WRITES

**Widget (2 files):**
11. `apps/widget/src/api.ts` - Updated BootloaderConfig type
12. `apps/widget/src/App.tsx` - Read-only mode UI
13. `apps/widget/src/App.css` - Disabled notice styles

**Migration (1):**
14. `20260205185428_add_kill_switch_controls` - DB migration

### Environment Variables

**Required:**
- `INTERNAL_API_KEY` - For admin API access

**Optional:**
- `INTERNAL_OVERRIDE_WRITES=false` - Respect writeEnabled even with internal key

### Zero Breaking Changes

- ✅ Widget embedding unchanged
- ✅ Bootloader API compatible (adds fields)
- ✅ All existing functionality preserved
- ✅ Defaults to enabled (widgetEnabled=true, writeEnabled=true)

---

## 🎯 Production Ready

Kill switch system is complete and tested:

- ✅ **Instant effect** - Kill switch active immediately after PATCH
- ✅ **Graceful degradation** - Widget shows clear notice, no crashes
- ✅ **Easy re-enable** - Single PATCH to restore functionality
- ✅ **Audit trail** - All changes logged with requestId
- ✅ **Emergency override** - Admin can bypass if absolutely needed
- ✅ **Zero downtime** - No API restart required

**Status: Ready for production emergencies! 🚨**
