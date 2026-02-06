# Debug Banner Implementation

## ✅ Added Debug Panel (DEV Only)

A floating debug panel has been added to the Next.js dashboard that shows:
- API base URL currently in use
- Last 5 network requests (method + path + status)
- Socket.IO connection status (connected/disconnected/connecting)

**Important:** The banner **only appears in development mode** (`NODE_ENV=development`).

---

## 📁 Files Changed

### 1. `package.json` - Added dependency
```diff
  "dependencies": {
    "next": "^15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@helvino/shared": "workspace:*",
+   "socket.io-client": "^4.8.1"
  }
```

### 2. `.env.example` ✨ NEW
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. `.env.local` ✨ NEW
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 4. `src/contexts/DebugContext.tsx` ✨ NEW
- React Context for debug state
- Tracks API requests (last 5)
- Monitors Socket.IO connection status
- Provides `logRequest()` function for logging API calls

### 5. `src/components/DebugBanner.tsx` ✨ NEW
- Floating debug panel UI (bottom-right corner)
- Shows API URL, socket status, and recent requests
- Minimizable (click `─` button)
- Only renders in `NODE_ENV=development`
- Color-coded status indicators:
  - Green = Connected
  - Red = Disconnected
  - Yellow = Connecting
- Color-coded HTTP status:
  - Green = 2xx (success)
  - Red = 4xx/5xx (error)
  - Yellow = pending/unknown

### 6. `src/utils/api.ts` ✨ NEW
- `apiFetch()` - Fetch wrapper that logs all requests
- `setDebugLogger()` - Connects logging to DebugContext
- Automatically tracks method, path, and status code

### 7. `src/app/layout.tsx` ♻️ UPDATED
```diff
+ import { DebugProvider } from "@/contexts/DebugContext";
+ import DebugBanner from "@/components/DebugBanner";

  return (
    <html lang="en">
      <body className="antialiased">
+       <DebugProvider>
          {children}
+         <DebugBanner />
+       </DebugProvider>
      </body>
    </html>
  );
```

### 8. `src/app/dashboard/page.tsx` ✨ NEW
- Example dashboard page
- Shows how to use `apiFetch()` for API calls
- Demonstrates debug panel functionality
- Includes test button to trigger API request

---

## 🚀 Where to See the Banner

### Step 1: Start the API Server (Terminal 1)
```bash
cd /Users/yavuz/Desktop/helvino/apps/api
npx pnpm dev

# Should show:
# 🚀 Helvino API is running!
# 🔌 Socket.IO enabled on the same port
```

### Step 2: Start the Web Dashboard (Terminal 2)
```bash
cd /Users/yavuz/Desktop/helvino/apps/web
npx pnpm dev

# Should show:
# ▲ Next.js 15.x.x
# - Local: http://localhost:3000
```

### Step 3: Open Dashboard
Navigate to: **`http://localhost:3000/dashboard`**

### Step 4: See the Debug Panel

Look for the **floating debug panel** in the **bottom-right corner**:

```
┌─────────────────────────────────────┐
│ 🐛 Debug Panel        (DEV only)  ─ │
├─────────────────────────────────────┤
│ API Base URL:                       │
│ http://localhost:4000               │
│                                     │
│ Socket.IO Status:                   │
│ 🟢 Connected                        │
│                                     │
│ Last 5 API Requests:                │
│ GET  /health              200       │
│ POST /conversations       201       │
│ POST /conversations/.../messages 201│
└─────────────────────────────────────┘
```

---

## 🧪 Test the Debug Panel

### Test 1: API Request Logging

1. On the dashboard page, click **"Test /health Endpoint"**
2. Watch the debug panel update with:
   - Method: `GET`
   - Path: `/health`
   - Status: `200` (green)
   - Timestamp

### Test 2: Socket.IO Status

The debug panel automatically connects to Socket.IO at the API URL.

**Expected States:**
- **Connecting** (yellow dot) - Initial connection
- **Connected** (green dot, pulsing) - Successfully connected
- **Disconnected** (red dot) - Not connected

**To test disconnect:**
1. Stop the API server
2. Watch status change to "Disconnected" (red)
3. Restart API server
4. Watch status change to "Connected" (green)

### Test 3: Multiple Requests

Make several API calls in quick succession:
1. Click test button multiple times
2. Debug panel shows last 5 requests
3. Older requests scroll off the top

### Test 4: Minimize/Maximize

1. Click the `─` button in the top-right of the panel
2. Panel minimizes to a small "🐛 Debug" button
3. Click the button to restore the full panel

---

## 🔧 How to Use in Your Code

### Option 1: Use the `apiFetch()` wrapper

```typescript
import { apiFetch, setDebugLogger } from "@/utils/api";
import { useDebug } from "@/contexts/DebugContext";

function MyComponent() {
  const { logRequest } = useDebug();

  useEffect(() => {
    setDebugLogger(logRequest); // Connect logging
  }, [logRequest]);

  const fetchData = async () => {
    const response = await apiFetch("/conversations");
    const data = await response.json();
    // Request automatically logged to debug panel
  };
}
```

### Option 2: Manual logging

```typescript
import { useDebug } from "@/contexts/DebugContext";

function MyComponent() {
  const { logRequest } = useDebug();

  const fetchData = async () => {
    try {
      const response = await fetch("http://localhost:4000/health");
      logRequest("GET", "/health", response.status);
    } catch (error) {
      logRequest("GET", "/health", 0); // 0 = error
    }
  };
}
```

---

## 🎨 Debug Panel Features

### Status Indicators
- **Socket.IO:** Pulsing colored dot + text
  - 🟢 Green = Connected
  - 🔴 Red = Disconnected  
  - 🟡 Yellow = Connecting

- **HTTP Status Codes:**
  - 🟢 Green = 200-299 (success)
  - 🔴 Red = 400+ (client/server error)
  - 🟡 Yellow = null (pending/unknown)

### Request List
- Shows last 5 requests (most recent first)
- Each entry shows:
  - HTTP method (GET, POST, etc.)
  - API path
  - Status code
  - Timestamp (local time)

### Panel Controls
- **Minimize:** Click `─` button to collapse
- **Maximize:** Click `🐛 Debug` button to expand

---

## 🚫 Production Behavior

In production builds (`NODE_ENV=production`):
- Debug panel **does not render** at all
- Socket.IO connection **not established**
- No performance overhead
- No visual clutter

**Test production build:**
```bash
cd /Users/yavuz/Desktop/helvino/apps/web
npx pnpm build
npx pnpm start

# Open http://localhost:3000/dashboard
# Debug panel should NOT appear
```

---

## 📊 Architecture

```
┌─────────────────┐
│  RootLayout     │
│  (app/layout)   │
└────────┬────────┘
         │
         ├─ DebugProvider (Context)
         │  └─ Tracks requests & socket status
         │
         ├─ {children} (Your pages)
         │  └─ Use apiFetch() or logRequest()
         │
         └─ DebugBanner (UI)
            └─ Reads from DebugContext
            └─ Only renders in dev mode
```

---

## 🔍 Environment Variables

### `.env.local` (local development)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### `.env.production` (production)
```env
NEXT_PUBLIC_API_URL=https://api.helvino.io
```

**Note:** Use `NEXT_PUBLIC_` prefix to expose vars to client-side code.

---

## 🎯 Summary

✅ **Zero refactoring** - Existing UI unchanged  
✅ **Minimal instrumentation** - Just wrap API calls with `apiFetch()`  
✅ **DEV-only** - Auto-hides in production  
✅ **Real-time monitoring** - Socket.IO status updates live  
✅ **Request history** - Last 5 API calls tracked  
✅ **Minimizable** - Doesn't block UI when not needed  
✅ **Type-safe** - Full TypeScript support  

**The debug panel is now live at `http://localhost:3000/dashboard`! 🎉**
