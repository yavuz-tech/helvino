# Kill Switch - Quick Test Guide

## Prerequisites

- API server running on `http://localhost:4000`
- `INTERNAL_API_KEY` set in `apps/api/.env`
- Widget built (`npx pnpm build` in `apps/widget`)

---

## Quick Verification Steps

### Step 1: Check Current Status

```bash
curl -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  http://localhost:4000/api/org/demo/settings | jq .settings
```

**Expected Output:**
```json
{
  "widgetEnabled": true,
  "writeEnabled": true,
  "aiEnabled": true,
  "primaryColor": "#0F5C5C"
}
```

---

### Step 2: Normal Operation Test

```bash
# Get token
TOKEN=$(curl -s -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq -r .orgToken)

# Create conversation
curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations | jq
```

**Expected:** `201 Created` with conversation ID

---

### Step 3: Disable Writes

```bash
curl -X PATCH \
  -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":false}' \
  http://localhost:4000/api/org/demo/settings | jq .settings.writeEnabled
```

**Expected:** `false`

---

### Step 4: Verify POST Blocked

```bash
TOKEN=$(curl -s -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq -r .orgToken)

curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations | jq
```

**Expected:** `403 Forbidden`
```json
{
  "error": "Writes disabled",
  "message": "Write operations are temporarily disabled for this organization."
}
```

---

### Step 5: Verify Bootloader Reflects State

```bash
curl -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq .config.writeEnabled
```

**Expected:** `false`

---

### Step 6: Re-Enable Writes

```bash
curl -X PATCH \
  -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  -H "Content-Type: application/json" \
  -d '{"writeEnabled":true}' \
  http://localhost:4000/api/org/demo/settings | jq .settings.writeEnabled
```

**Expected:** `true`

---

### Step 7: Verify POST Works Again

```bash
TOKEN=$(curl -s -H "x-org-key: demo" http://localhost:4000/api/bootloader | jq -r .orgToken)

curl -X POST \
  -H "x-org-key: demo" \
  -H "x-org-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/conversations | jq
```

**Expected:** `201 Created` with conversation ID

---

## Widget Testing (Browser)

### Test 1: Normal Mode

1. Ensure `writeEnabled=true`:
   ```bash
   curl -X PATCH -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
     -H "Content-Type: application/json" \
     -d '{"writeEnabled":true}' \
     http://localhost:4000/api/org/demo/settings
   ```

2. Open widget embed page (e.g., `http://localhost:5173`)
3. Open chat
4. **Expected:** Input box visible, can send messages

### Test 2: Read-Only Mode

1. Disable writes:
   ```bash
   curl -X PATCH -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
     -H "Content-Type: application/json" \
     -d '{"writeEnabled":false}' \
     http://localhost:4000/api/org/demo/settings
   ```

2. Reload widget page
3. Open chat
4. **Expected:** Notice shows "💬 Chat is temporarily unavailable."
5. **Expected:** No input box, no send button

### Test 3: Widget Disabled

1. Disable widget:
   ```bash
   curl -X PATCH -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
     -H "Content-Type: application/json" \
     -d '{"widgetEnabled":false}' \
     http://localhost:4000/api/org/demo/settings
   ```

2. Reload widget page
3. **Expected:** No widget renders, page is empty

### Test 4: Re-Enable Everything

```bash
curl -X PATCH -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  -H "Content-Type: application/json" \
  -d '{"widgetEnabled":true,"writeEnabled":true}' \
  http://localhost:4000/api/org/demo/settings
```

Reload page → Widget works normally

---

## Automated Testing

### Run Full Test Suite

```bash
cd /Users/yavuz/Desktop/helvino
bash VERIFY_KILL_SWITCH.sh
```

**Expected:** All 10 tests pass

**Test Coverage:**
1. Get settings
2. Normal POST (enabled)
3. Disable writes
4. POST blocked (disabled)
5. Bootloader reflects state
6. Internal bypass respects writeEnabled
7. Re-enable writes
8. POST works again
9. Disable widget
10. Re-enable widget

---

## Quick Troubleshooting

### Kill Switch Not Working

**Check 1:** Verify admin API responds
```bash
curl -H "x-internal-key: r/b6LoI/2m6axryScc8YscXs3tEYWLHw" \
  http://localhost:4000/api/org/demo/settings
```

**Check 2:** Verify database updated
```bash
# Check if the field exists in DB
docker exec helvino-postgres psql -U helvino -d helvino_dev -c \
  "SELECT key, \"writeEnabled\", \"widgetEnabled\" FROM organizations WHERE key='demo';"
```

**Check 3:** Verify API restarted after migration
```bash
# API should log: "Server listening at..."
# Recent start time indicates fresh restart
```

### Widget Still Shows Input

**Cause:** Widget cached old bootloader config

**Fix:**
- Reload page (widget calls bootloader on load)
- Or wait for auto token refresh (~5 min)

### POST Still Works When Disabled

**Cause:** Using `x-internal-key` with `INTERNAL_OVERRIDE_WRITES=true`

**Fix:**
- Check `.env` for `INTERNAL_OVERRIDE_WRITES`
- Set to `false` for normal operation
- Restart API

---

## Success Checklist

- [ ] Admin API responds to GET /api/org/:key/settings
- [ ] PATCH updates database successfully
- [ ] POST blocked when writeEnabled=false (403)
- [ ] POST works when writeEnabled=true (201)
- [ ] Bootloader returns current writeEnabled state
- [ ] Widget shows read-only notice when writeEnabled=false
- [ ] Widget input works when writeEnabled=true
- [ ] Widget does not mount when widgetEnabled=false
- [ ] All actions are reversible
- [ ] Automated test script passes all 10 tests

---

## 🎉 If All Tests Pass

**Congratulations!** Kill switch system is operational and ready for production emergencies! 🚨

**You can now:**
- Disable writes instantly for any organization
- Investigate issues without data loss
- Protect against abuse in real-time
- Maintain professional user experience during incidents

**Status: ✅ PRODUCTION READY**
