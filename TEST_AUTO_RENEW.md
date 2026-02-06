# Testing Org Token Auto-Renew

## Quick Verification

### Prerequisites
- API server running on `http://localhost:4000`
- Widget built and ready (`npx pnpm build` in `apps/widget`)
- Browser with console open

---

## Test 1: Token Parsing

**Purpose:** Verify token expiration is correctly parsed from payload

**Steps:**
1. Open widget in browser
2. Open browser console
3. Check for log message

**Expected Console Output:**
```
✅ Org token cached, expires at 2026-02-05T18:35:00.000Z
```

**Verification:**
- ✅ Log shows expiration time
- ✅ Expiration is ~5 minutes (300 seconds) in the future

---

## Test 2: Normal Flow (No Auto-Renew)

**Purpose:** Verify no unnecessary refreshes when token is valid

**Steps:**
1. Load widget (fresh)
2. Open chat immediately
3. Send a message

**Expected Console Output:**
```
✅ Org token cached, expires at 2026-02-05T18:35:00.000Z
(no refresh messages)
```

**Expected UI:**
- ✅ No "Connecting..." banner
- ✅ Message sends immediately
- ✅ No delays

**Verification:**
- Should NOT see "🔄 Refreshing org token..."
- Should NOT see blue banner

---

## Test 3: Auto-Renew After Expiry

**Purpose:** Verify token automatically refreshes when expired

**Setup:**
```javascript
// Option A: Wait naturally (5+ minutes)
// Just leave widget open for 5 minutes, then send a message

// Option B: Force expiry (for quick testing)
// In browser console:
// Note: This won't work in production - it's just for understanding the flow
// The actual test requires waiting or changing the expiry time
```

**Steps:**
1. Load widget
2. Wait 5+ minutes (or use short-expiry token for testing)
3. Send a message

**Expected Console Output:**
```
✅ Org token cached, expires at 2026-02-05T18:35:00.000Z
... wait 5+ minutes ...
🔄 Refreshing org token...
✅ Org token refreshed, expires at 2026-02-05T18:40:00.000Z
```

**Expected UI:**
- ✅ Blue banner appears: "🔄 Connecting..."
- ✅ Brief delay (< 1 second)
- ✅ Banner disappears
- ✅ Message sends successfully

**Verification:**
- Token refresh logged in console
- New expiration time is +5 minutes from refresh
- Message successfully sent after refresh

---

## Test 4: Request Queueing (Multiple Concurrent Requests)

**Purpose:** Verify multiple requests share same refresh

**Steps:**
1. Load widget
2. Wait 5+ minutes
3. **Rapidly** send 3 messages (click Send 3 times quickly)

**Expected Console Output:**
```
🔄 Refreshing org token...
(only one refresh, not 3)
✅ Org token refreshed, expires at...
```

**Expected UI:**
- ✅ Blue banner appears once
- ✅ All 3 messages queued during refresh
- ✅ All 3 messages sent after refresh completes
- ✅ Messages appear in correct order

**Verification:**
- Only ONE "Refreshing org token" log (not 3)
- All messages sent successfully
- Messages appear in order sent

---

## Test 5: Error Handling (Network Failure)

**Purpose:** Verify graceful failure when refresh fails

**Steps:**
1. Load widget
2. Wait 5+ minutes
3. **Disconnect network** (turn off WiFi or use browser DevTools → Offline)
4. Try to send a message

**Expected Console Output:**
```
🔄 Refreshing org token...
❌ Token refresh failed: [error details]
```

**Expected UI:**
- ✅ Red banner appears: "⚠️ Connection issue, retrying..."
- ✅ Banner auto-disappears after 3 seconds
- ✅ Message not sent (failed gracefully)

**Verification:**
- Error logged in console
- User sees error banner
- No crash or uncaught exceptions
- User can retry after reconnecting

---

## Test 6: Long Session (Multiple Auto-Refreshes)

**Purpose:** Verify widget can stay open indefinitely

**Steps:**
1. Load widget
2. Send a message every 2 minutes for 15 minutes

**Expected Timeline:**
```
00:00 - Widget loaded, initial token (expires at 05:00)
02:00 - Send message (token valid, no refresh)
04:00 - Send message (token valid, no refresh)
06:00 - Send message (token expired, auto-refresh #1, new expiry 11:00)
08:00 - Send message (token valid, no refresh)
10:00 - Send message (token valid, no refresh)
12:00 - Send message (token expired, auto-refresh #2, new expiry 17:00)
14:00 - Send message (token valid, no refresh)
```

**Expected Console Output:**
```
✅ Org token cached, expires at T+05:00
🔄 Refreshing org token...  (at ~6:00)
✅ Org token refreshed, expires at T+11:00
🔄 Refreshing org token...  (at ~12:00)
✅ Org token refreshed, expires at T+17:00
```

**Verification:**
- Multiple refreshes over time
- All messages sent successfully
- Widget never crashes or requires page reload

---

## Test 7: Proactive Refresh (15-Second Buffer)

**Purpose:** Verify token refreshes 15 seconds before expiry

**Setup:** This requires precise timing

**Steps:**
1. Load widget, note token expiration time (e.g., 18:35:00)
2. Wait until 15 seconds before expiry (e.g., 18:34:45)
3. Send a message

**Expected Behavior:**
- Token refresh triggered at 18:34:45 (15 seconds before 18:35:00)
- Not at 18:35:01 (after expiry)

**Expected Console Output:**
```
✅ Org token cached, expires at 2026-02-05T18:35:00.000Z
... wait until 18:34:45 ...
🔄 Refreshing org token...
✅ Org token refreshed, expires at 2026-02-05T18:40:00.000Z
```

**Verification:**
- Refresh happens BEFORE expiry
- User never experiences expired token error

---

## Automated Test Script

### Quick Console Test

Paste this in browser console to inspect token state:

```javascript
// Check current token expiration
const getTokenInfo = () => {
  // Note: Token functions are not exposed globally by default
  // This is just for demonstration
  console.log('Token info requires widget internals access');
  
  // You can check localStorage for conversation ID
  console.log('Conversation ID:', localStorage.getItem('helvino_conversation_id'));
};

getTokenInfo();
```

### Monitor Token Lifecycle

```javascript
// Watch console for these log patterns
const patterns = [
  "✅ Org token cached, expires at",
  "🔄 Refreshing org token...",
  "✅ Org token refreshed, expires at",
  "❌ Token refresh failed"
];

// Console logs will show these automatically
```

---

## Manual Testing Checklist

Before considering the feature complete, verify:

- [ ] Widget loads and shows token expiration in console
- [ ] Fresh widget sends messages without any refresh
- [ ] After 5+ minutes, sending message triggers auto-refresh
- [ ] Blue "Connecting..." banner appears during refresh
- [ ] Message sends successfully after refresh
- [ ] Multiple rapid messages share same refresh (only 1 refresh logged)
- [ ] Network failure shows red error banner
- [ ] Error banner auto-clears after 3 seconds
- [ ] Widget can stay open 15+ minutes with multiple auto-refreshes
- [ ] No page reload required at any point
- [ ] No "Invalid or expired org token" errors ever shown to user

---

## Common Issues

### Issue: Token never refreshes

**Symptom:** After 5 minutes, messages fail with "Invalid or expired org token"

**Debug:**
1. Check console for "🔄 Refreshing org token..." - if missing, auto-renew not triggering
2. Verify `ensureValidToken()` is called before POST requests
3. Check `isTokenExpiredOrExpiring()` logic

**Fix:** Ensure `createConversation()` and `sendMessage()` call `await ensureValidToken()` first

---

### Issue: Multiple refreshes for concurrent requests

**Symptom:** Console shows 3 "Refreshing org token" logs when sending 3 messages

**Debug:**
1. Check if `tokenRefreshPromise` is properly reused
2. Verify queueing logic

**Fix:** Ensure `if (tokenRefreshPromise) return tokenRefreshPromise;` check exists

---

### Issue: Banner never disappears

**Symptom:** Blue or red banner stays visible forever

**Debug:**
1. Check if `setConnectionStatus(null)` is called after operations
2. Verify error timeout is working

**Fix:** Ensure `finally` block or success path sets status to `null`

---

### Issue: Messages sent in wrong order

**Symptom:** Messages appear out of order after refresh

**Debug:**
1. Check queue flush logic
2. Verify promises resolve in correct order

**Fix:** Ensure `queuedResolvers.forEach((resolve) => resolve())` executes in order

---

## Success Criteria

✅ All tests pass  
✅ No breaking changes to existing functionality  
✅ Widget can stay open indefinitely  
✅ Users never see token expiration errors  
✅ UI feedback is clear and non-intrusive  
✅ No unnecessary refreshes when token is valid  
✅ Concurrent requests handled efficiently  

---

## 🎉 If All Tests Pass

**Congratulations!** Token auto-renew is working correctly. Users can now keep the widget open for hours without any interruption! 🚀
