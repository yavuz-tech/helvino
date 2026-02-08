# Unified Admin Dashboard - Implementation Summary

## Overview

Successfully unified the Helvino admin dashboard into a single authenticated admin UI at `http://localhost:3000/dashboard`. The dashboard now shows System Status, Inbox (conversation list), Conversation Detail, and Agent Reply functionality in one place, while maintaining access to Settings and Security pages.

---

## Changes Made

### 1. **API Changes (apps/api)**

#### A. Admin Session Bypass for Org Token Middleware

**File**: `apps/api/src/middleware/require-org-token.ts`

**What Changed**:
- Added **admin session cookie detection** as the primary bypass mechanism
- Checks for `request.session.get("adminUserId")` to identify admin-authenticated requests
- If admin session exists, allows POST operations to `/conversations` and `/conversations/:id/messages` without requiring `x-org-token`
- Admin bypass still respects the `writeEnabled` flag (unless `INTERNAL_OVERRIDE_WRITES=true`)

**Code Comment Added**:
```typescript
/**
 * Bypass mechanisms:
 * 1. Admin session cookie (for dashboard)
 * 2. x-internal-key header (for automated/dev tools)
 */
```

**Why This Matters**:
- The dashboard can now send agent messages without needing to obtain and manage org tokens
- Widget security remains unchanged (widgets still use org token flow)
- Admin actions are logged with `adminBypass: true` flag

---

### 2. **Web App Changes (apps/web)**

#### A. API Fetch Utility Updated

**File**: `apps/web/src/utils/api.ts`

**What Changed**:
- Added `credentials: "include"` to all fetch requests to send session cookie
- Changed `NEXT_PUBLIC_ORG_KEY` to `NEXT_PUBLIC_DEFAULT_ORG_KEY` for clarity
- Added comprehensive code comments explaining admin authentication flow

**Key Addition**:
```typescript
credentials: "include", // CRITICAL: Send session cookie for admin auth
```

**Why This Matters**:
- Every API request from the dashboard now includes the session cookie
- The API middleware detects the admin session and grants POST access
- No need to manually include `x-internal-key` header

#### B. Debug Context Updated

**File**: `apps/web/src/contexts/DebugContext.tsx`

**What Changed**:
- Updated Socket.IO connection to use `NEXT_PUBLIC_DEFAULT_ORG_KEY` instead of `NEXT_PUBLIC_ORG_KEY`
- Ensures consistency across the codebase

#### C. Dashboard Page Enhanced

**File**: `apps/web/src/app/dashboard/page.tsx`

**What Changed**:
- Improved empty state for zero conversations (added emoji, better messaging)
- Already had full inbox/conversation/reply functionality in place

**Empty State**:
```
📭
No conversations yet
Conversations will appear here when visitors use the widget
```

#### D. Environment Variables

**File**: `apps/web/.env.local`

**What Changed**:
- Added `NEXT_PUBLIC_DEFAULT_ORG_KEY=demo`
- This allows admin dashboard to work with a specific organization

---

## Architecture

### Request Flow: Admin Sending Agent Reply

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Admin Dashboard (apps/web)                                   │
│    - User clicks "Send" on agent reply                          │
│    - apiFetch() called with credentials: "include"              │
│    - Request includes:                                           │
│      • Session cookie (httpOnly, secure)                        │
│      • x-org-key: "demo" header                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. API Server (apps/api)                                        │
│    - Receives POST /conversations/:id/messages                  │
│    - Middleware: requireOrgToken runs                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Admin Session Check (BYPASS #1)                             │
│    - Middleware checks: request.session.get("adminUserId")      │
│    - ✅ Admin session found                                     │
│    - Loads org by x-org-key header                              │
│    - Checks org.writeEnabled flag                               │
│    - Attaches org to request                                    │
│    - Logs: "Admin session bypass: allowing write operation"    │
│    - ✅ Request proceeds to route handler                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Route Handler                                                │
│    - Creates message with role="assistant"                      │
│    - Emits Socket.IO event to org room                          │
│    - Returns 201 Created                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Widget Request Flow (Unchanged)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Widget (apps/widget)                                         │
│    - Calls GET /api/bootloader to get org token                │
│    - Stores token in memory                                     │
│    - Sends POST with x-org-token header                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. API Server (apps/api)                                        │
│    - requireOrgToken middleware                                 │
│    - Validates org token signature                              │
│    - Checks expiration                                          │
│    - ✅ Token valid, request proceeds                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dashboard Features

### Main Page: `/dashboard`

**What You See**:
1. **System Status Section**
   - Health check status (green/red)
   - Request metrics (total, 2xx, 4xx, 5xx)
   - P95 latency
   - Rate limit count
   - Refresh button

2. **Inbox List (Left Panel)**
   - Shows all conversations for the demo org
   - Displays conversation ID (shortened) + message count
   - Last updated timestamp
   - Click to select and view messages
   - Real-time updates via Socket.IO

3. **Conversation Detail (Right Panel)**
   - Shows selected conversation messages
   - User messages: right-aligned, dark background
   - Assistant messages: left-aligned, light background
   - Timestamps for each message

4. **Agent Reply Box (Bottom)**
   - Text input for agent response
   - Send button (disabled when empty)
   - Press Enter to send
   - Real-time updates on send

**Empty States**:
- No conversations: Shows 📭 with helpful message
- No messages: Shows "No messages yet"
- Loading: "Loading conversations..." / "Loading messages..."

### Settings Page: `/dashboard/settings`

**What You See**:
- Organization name and key
- Kill switches (widgetEnabled, writeEnabled, aiEnabled)
- Retention settings (messageRetentionDays, hardDeleteOnRetention)
- Branding settings (widgetName, widgetSubtitle, primaryColor, language)
- Preview box showing widget appearance
- Save button (only enabled when changes detected)

### Security Page: `/dashboard/settings/security`

**What You See**:
- Site ID (public identifier for widget embedding)
- Copy button for Site ID
- Rotate Site ID button (requires confirmation)
- Allowed Domains editor (add/remove domains)
- Wildcard pattern support (*.domain.com)
- Allow Localhost toggle (for development)

---

## Navigation

**Sidebar Menu** (All Pages):
- ✅ **Overview** → `/dashboard`
- ✅ **Settings** → `/dashboard/settings`
- ✅ **Security** → `/dashboard/settings/security`

**Previously Had** (Removed):
- ❌ Analytics (placeholder, no implementation)
- ❌ Chat History (placeholder, no implementation)

---

## Authentication

**Flow**:
1. User visits `/dashboard` without auth → redirected to `/login`
2. User logs in with email/password → session cookie set
3. User redirected to `/dashboard` → checkAuth() verifies session
4. All subsequent API requests include session cookie automatically
5. Logout clears session and redirects to `/login`

**Session Details**:
- Cookie name: `sessionId` (Fastify session default)
- HttpOnly: `true` (prevents JavaScript access)
- Secure: `true` (production only, HTTPS required)
- SameSite: `lax` (CSRF protection)
- Max Age: 7 days
- Rolling: `true` (resets on every request)

---

## Testing

### Manual Verification

**1. Login**
```
Navigate to: http://localhost:3000/login
Credentials: admin@helvion.io / admin123
Expected: Redirect to /dashboard
```

**2. Dashboard Overview**
```
Navigate to: http://localhost:3000/dashboard
Expected:
  - System Status section shows health + metrics
  - Inbox shows conversations (or "No conversations yet")
  - Sidebar visible on left
  - User info in header (top right)
```

**3. View Conversation**
```
Click on any conversation in inbox
Expected:
  - Conversation messages load in right panel
  - Reply box appears at bottom
  - Selected conversation highlighted in inbox
```

**4. Send Agent Reply**
```
Type message in reply box
Click "Send" or press Enter
Expected:
  - Message appears in thread immediately (optimistic UI)
  - "Sending..." shows briefly
  - Message persists after page refresh
```

**5. Settings Page**
```
Navigate to: http://localhost:3000/dashboard/settings
Expected:
  - Organization settings load
  - Kill switches visible
  - Preview box shows widget appearance
  - Save button appears when changes made
```

**6. Security Page**
```
Navigate to: http://localhost:3000/dashboard/settings/security
Expected:
  - Site ID displayed with copy button
  - Allowed Domains list editable
  - Allow Localhost toggle works
  - Save button appears when changes made
```

### API Logs to Verify

**Admin Bypass Working**:
```
Look for in API logs:
[INFO] Admin session bypass: allowing write operation
  orgKey: "demo"
  orgId: "..."
  adminBypass: true
  adminUserId: "..."
```

**Normal Widget Flow** (Unchanged):
```
Look for in API logs:
[INFO] Org token verified successfully
  orgKey: "demo"
  orgId: "..."
  tokenExp: <timestamp>
```

---

## Files Changed

### API (apps/api)
1. ✅ `src/middleware/require-org-token.ts` - Added admin session bypass

### Web (apps/web)
1. ✅ `src/utils/api.ts` - Added credentials: "include"
2. ✅ `src/contexts/DebugContext.tsx` - Updated to use NEXT_PUBLIC_DEFAULT_ORG_KEY
3. ✅ `src/app/dashboard/page.tsx` - Improved empty state messaging
4. ✅ `.env.local` - Added NEXT_PUBLIC_DEFAULT_ORG_KEY=demo

---

## Security Notes

### What's Protected

✅ **Admin Routes**:
- All `/dashboard/*` pages check auth via `checkAuth()` on mount
- Redirect to `/login` if not authenticated
- Session cookie required for all admin actions

✅ **API Write Operations**:
- POST `/conversations` - Protected by `requireOrgToken` (admin bypass or org token)
- POST `/conversations/:id/messages` - Protected by `requireOrgToken` (admin bypass or org token)
- All admin-only routes (`/api/org/*`, `/internal/*`) - Protected by `requireAdmin`

✅ **Widget Security** (Unchanged):
- Widgets must call `/api/bootloader` to get org token
- Token expires after 5 minutes
- Domain allowlist enforced for widget endpoints
- Rate limiting per (org, IP) pair

### What's NOT Protected

⚠️ **Read Operations**:
- GET `/conversations` - Requires x-org-key header but no org token
- GET `/conversations/:id` - Requires x-org-key header but no org token
- This is by design: admins need to read conversations without tokens

---

## Environment Variables

### Required (apps/web/.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_INTERNAL_KEY=<your-internal-key>
NEXT_PUBLIC_DEFAULT_ORG_KEY=demo
```

### Required (apps/api/.env)
```env
DATABASE_URL=<postgresql-connection-string>
REDIS_URL=<redis-connection-string>
SESSION_SECRET=<random-secret-for-sessions>
INTERNAL_API_KEY=<matches-NEXT_PUBLIC_INTERNAL_KEY>
ORG_TOKEN_SECRET=<random-secret-for-org-tokens>
ADMIN_EMAIL=admin@helvion.io
ADMIN_PASSWORD=admin123
```

---

## Next Steps (Optional)

### If You Want Analytics Page
1. Create `apps/web/src/app/dashboard/analytics/page.tsx`
2. Add to sidebar navigation in `DashboardLayout.tsx`
3. Fetch metrics from `/metrics` endpoint
4. Display charts/graphs using a library like recharts

### If You Want Chat History Page
1. Create `apps/web/src/app/dashboard/history/page.tsx`
2. Add to sidebar navigation
3. Show table view of all conversations (no detail panel)
4. Add filtering/search functionality

### If You Want Multi-Org Support
1. Add org switcher to dashboard header
2. Store selected `orgKey` in component state or URL param
3. Update `apiFetch` to use dynamic org key
4. Filter conversations by selected org

---

## Status

✅ **COMPLETE** - Unified admin dashboard is fully functional at `http://localhost:3000/dashboard`

**What Works**:
- Login with admin credentials
- View all conversations for demo org
- Select conversation to view messages
- Send agent replies (POST with admin session bypass)
- Real-time updates via Socket.IO
- Settings page (org configuration)
- Security page (Site ID, domain allowlist)
- Logout

**What's Protected**:
- All dashboard pages require authentication
- POST operations use admin session bypass (no org token needed)
- Widget security unchanged (still uses org token flow)

**No Breaking Changes**:
- Widget functionality unchanged
- Existing API endpoints unchanged
- Session authentication unchanged
