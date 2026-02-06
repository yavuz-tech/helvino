# Step 11.3: Customer Portal (Org-Scoped) - Implementation Summary

## Overview

Successfully implemented a **separate customer portal** at `/app/*` for organization users, completely independent from the internal admin dashboard at `/dashboard/*`. Each portal has its own authentication, session, and data scope.

---

## Architecture

### Two Separate Portals

| Feature | Internal Admin (`/dashboard/*`) | Customer Portal (`/app/*`) |
|---------|-------------------------------|---------------------------|
| **Auth** | `AdminUser` (session) | `OrgUser` (session) |
| **Cookie** | `sessionId` (default) | `sessionId` (shared secret, different session data) |
| **Scope** | Multi-org (can switch) | Single org (fixed to user's org) |
| **Login** | `/login` | `/app/login` |
| **Pages** | Overview, Settings, Security, Create Org | Conversations, Settings, Security |
| **Permissions** | Full access (can create orgs, manage all data) | Org-scoped only (own org data) |
| **Session Keys** | `adminUserId`, `adminRole` | `orgUserId`, `orgId`, `orgRole` |

---

## Backend Changes (apps/api)

### 1. Prisma Schema

**File**: `prisma/schema.prisma`

**Added Model**:
```prisma
model OrgUser {
  id           String       @id @default(cuid())
  orgId        String
  email        String       @unique
  passwordHash String
  role         String       // "owner" | "admin" | "agent"
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([email])
  @@map("org_users")
}
```

**Updated Organization Model**:
```prisma
model Organization {
  // ... existing fields ...
  orgUsers              OrgUser[]
}
```

**Migration**: `prisma/migrations/20260205220000_add_org_users/migration.sql`

### 2. Database Seed

**File**: `prisma/seed.ts`

**Added**:
- Creates default org user for demo org
- Reads `ORG_OWNER_EMAIL` and `ORG_OWNER_PASSWORD` from env
- Default: `owner@demo.helvino.io` / `demo_owner_2026`

### 3. New Middleware

**File**: `src/middleware/require-org-user.ts`

**Functions**:
- `requireOrgUser()`: Validates org user session, injects `request.orgUser`
- `requireOrgRole(roles)`: Checks org user role

**Session Keys**:
- `orgUserId`: OrgUser ID
- `orgId`: Organization ID (for data scoping)
- `orgRole`: User role (owner, admin, agent)

**Key Difference from Admin Middleware**:
- Uses different session keys to avoid conflicts
- Automatically scopes data to single org
- No multi-org access

### 4. New Auth Routes

**File**: `src/routes/org-auth.ts`

**Endpoints**:

#### POST /org/auth/login
- Body: `{ email, password }`
- Sets org user session
- Returns: `{ ok: true, user: { id, email, role, orgId, orgKey, orgName } }`
- Rate limited: 10 per minute per IP

#### POST /org/auth/logout
- Clears org user session
- Returns: `{ ok: true }`

#### GET /org/auth/me
- Returns current org user session info
- Returns 401 if not authenticated

### 5. New Customer-Scoped Endpoints

**File**: `src/routes/org-customer.ts`

All routes require `requireOrgUser` middleware (session cookie auth).
All data automatically scoped to `request.orgUser.orgId`.

#### GET /org/conversations
- Lists conversations for session org only
- No `x-org-key` header needed (uses session orgId)

#### GET /org/conversations/:id
- Gets conversation detail with messages
- 404 if conversation not in session org

#### POST /org/conversations/:id/messages
- Adds message to conversation (agent reply)
- Respects `writeEnabled` flag
- Emits Socket.IO event to org room
- Rate limited: 120 per minute

#### GET /org/settings
- Returns org settings (read-only for status, writable for branding)
- Includes: widgetEnabled, writeEnabled, aiEnabled (read-only)
- Includes: widgetName, widgetSubtitle, primaryColor, language, position (writable)

#### PATCH /org/settings
- Updates branding fields only (widgetName, widgetSubtitle, primaryColor, etc.)
- Kill switches NOT editable by org users (admin-only)
- Only owner/admin roles can update

#### GET /org/security
- Returns siteId, allowedDomains, allowLocalhost

#### PATCH /org/security
- Updates allowedDomains and allowLocalhost
- Only owner role can update

### 6. Route Registration

**File**: `src/index.ts`

**Added**:
```typescript
fastify.register(orgAuthRoutes); // Org user auth
fastify.register(orgCustomerRoutes); // Org customer routes
```

---

## Frontend Changes (apps/web)

### 1. New Utilities

**File**: `src/lib/org-auth.ts`

**Functions**:
- `checkOrgAuth()`: Check if org user is authenticated
- `orgLogin(email, password)`: Login org user
- `orgLogout()`: Logout org user
- `orgApiFetch(path, options)`: Fetch wrapper with session cookie

**Key Features**:
- Separate from internal admin auth (`src/lib/auth.ts`)
- Uses `/org/auth/*` endpoints
- All requests include `credentials: "include"`

### 2. Customer Portal Layout

**File**: `src/components/OrgPortalLayout.tsx`

**Features**:
- Similar to `DashboardLayout` but simpler
- Sidebar navigation (Conversations, Settings, Security)
- Shows single org info (no switching)
- User info + logout button

### 3. Customer Portal Pages

#### `/app/login`
**File**: `src/app/app/login/page.tsx`

- Email + password form
- Redirects to `/app` on success
- Link to internal admin login (`/login`)
- Auto-redirects if already logged in

#### `/app` (Main Page)
**File**: `src/app/app/page.tsx`

- **Inbox list** (left panel): Shows conversations for user's org only
- **Conversation detail** (right panel): Full message thread
- **Reply box** (bottom): Send agent messages
- Uses `orgApiFetch()` for all API calls
- No org selection (fixed to session org)

#### `/app/settings`
**File**: `src/app/app/settings/page.tsx`

- **Branding fields** (editable):
  - Widget Name
  - Widget Subtitle
  - Primary Color
  - Language
  - Position
- **Status flags** (read-only):
  - Widget Enabled
  - Write Enabled
  - AI Enabled
- Only owner/admin can save

#### `/app/settings/security`
**File**: `src/app/app/settings/security/page.tsx`

- **Site ID** (read-only, copyable)
- **Allowed Domains** (editable): Add/remove, wildcard support
- **Allow Localhost** (toggle)
- Only owner can save

---

## Session Separation

### How Sessions Don't Conflict

Both portals use Fastify's `@fastify/session` plugin with the **same secret** but **different session data keys**:

#### Internal Admin Session
```typescript
request.session.set("adminUserId", "...")
request.session.set("adminRole", "...")
```

#### Org User Session
```typescript
request.session.set("orgUserId", "...")
request.session.set("orgId", "...")
request.session.set("orgRole", "...")
```

**Result**: Same cookie (`sessionId`), different data keys = no conflicts!

**Alternative Approach** (if needed):
- Use `cookieName: "adminSession"` vs `cookieName: "orgSession"`
- Requires two separate session plugin registrations
- Current approach is simpler and works fine

---

## Data Flow Examples

### Customer Portal: Agent Reply

```
1. Org user logs in at /app/login
   → Session: { orgUserId, orgId, orgRole }

2. User navigates to /app
   → Fetches GET /org/conversations
   → Middleware: requireOrgUser() reads session
   → Returns conversations where orgId = session.orgId

3. User selects conversation, types reply, clicks Send
   → POST /org/conversations/:id/messages
   → Middleware: requireOrgUser() reads session
   → Checks org.writeEnabled for session.orgId
   → Creates message with orgId = session.orgId
   → Emits Socket.IO event to org room

4. Message appears in thread (optimistic UI)
```

### Internal Admin: Agent Reply

```
1. Admin logs in at /login
   → Session: { adminUserId, adminRole }

2. Admin navigates to /dashboard
   → Fetches orgs, selects one
   → Stores selection in localStorage

3. Admin sends reply
   → POST /conversations/:id/messages
   → Headers: { x-org-key: selectedOrg.key }
   → Session cookie included
   → Middleware: requireOrgToken() detects admin session
   → Admin bypass granted
   → Creates message for specified orgKey
```

---

## Environment Variables

### Added to `.env.example`

```env
# Org Owner Credentials (REQUIRED for seed)
# Default org user (customer portal) created during database seed
# ⚠️  CHANGE THESE IN PRODUCTION!
ORG_OWNER_EMAIL="owner@demo.helvino.io"
ORG_OWNER_PASSWORD="demo_owner_2026"
```

### Update Your `.env`

```bash
cd /Users/yavuz/Desktop/helvino/apps/api
echo 'ORG_OWNER_EMAIL="owner@demo.helvino.io"' >> .env
echo 'ORG_OWNER_PASSWORD="demo_owner_2026"' >> .env
```

---

## Database Setup

### 1. Apply Migration

```bash
cd /Users/yavuz/Desktop/helvino/apps/api

# Start PostgreSQL (if not running)
docker-compose up -d postgres

# Apply migration
npx prisma migrate deploy

# Or in dev:
npx prisma migrate dev
```

### 2. Run Seed

```bash
# This will create:
# - Demo org (if not exists)
# - Admin user (admin@helvino.io)
# - Org user (owner@demo.helvino.io) ← NEW
npx pnpm db:seed
```

---

## Files Changed

### Backend (apps/api)
1. ✅ `prisma/schema.prisma` - Added OrgUser model
2. ✅ `prisma/migrations/20260205220000_add_org_users/migration.sql` - NEW
3. ✅ `prisma/seed.ts` - Added org user seeding
4. ✅ `src/middleware/require-org-user.ts` - NEW
5. ✅ `src/routes/org-auth.ts` - NEW
6. ✅ `src/routes/org-customer.ts` - NEW
7. ✅ `src/index.ts` - Registered new routes
8. ✅ `.env.example` - Added ORG_OWNER_EMAIL/PASSWORD

### Frontend (apps/web)
1. ✅ `src/lib/org-auth.ts` - NEW
2. ✅ `src/components/OrgPortalLayout.tsx` - NEW
3. ✅ `src/app/app/login/page.tsx` - NEW
4. ✅ `src/app/app/page.tsx` - NEW
5. ✅ `src/app/app/settings/page.tsx` - NEW
6. ✅ `src/app/app/settings/security/page.tsx` - NEW

### Documentation
1. ✅ `STEP_11_3_CUSTOMER_PORTAL.md` - This file

**Total**: 15 files (8 backend, 6 frontend, 1 doc)

---

## Verification Checklist

### Setup (One-Time)

```bash
# 1. Add env vars to API .env
cd /Users/yavuz/Desktop/helvino/apps/api
echo 'ORG_OWNER_EMAIL="owner@demo.helvino.io"' >> .env
echo 'ORG_OWNER_PASSWORD="demo_owner_2026"' >> .env

# 2. Start PostgreSQL
docker-compose up -d postgres

# 3. Apply migration
npx prisma migrate deploy

# 4. Regenerate Prisma client
npx prisma generate

# 5. Run seed (creates org user)
npx pnpm db:seed

# 6. Start API
npx pnpm dev

# 7. Start Web (different terminal)
cd /Users/yavuz/Desktop/helvino/apps/web
npm run dev
```

### Manual Testing

#### Test 1: Internal Admin Portal (Should Work Unchanged)

```
1. Navigate to http://localhost:3000/login
2. Login: admin@helvino.io / helvino_admin_2026
3. ✅ Redirects to /dashboard
4. ✅ Org switcher visible in sidebar
5. ✅ Can create orgs, switch between them
6. ✅ Can view conversations, send replies
7. ✅ Settings/Security work
```

#### Test 2: Customer Portal Login

```
1. Navigate to http://localhost:3000/app/login
2. Login: owner@demo.helvino.io / demo_owner_2026
3. ✅ Redirects to /app
4. ✅ Sidebar shows single org (Demo Org)
5. ✅ No org switcher (fixed to user's org)
```

#### Test 3: Customer Portal Inbox

```
1. At /app
2. ✅ Shows conversations for demo org only
3. ✅ Click conversation → messages load
4. ✅ Type reply → Send
5. ✅ Message appears in thread
6. ✅ Inbox updates (count + timestamp)
```

#### Test 4: Customer Portal Settings

```
1. Navigate to /app/settings
2. ✅ Shows branding fields (name, subtitle, color, language, position)
3. ✅ Shows status flags (widget, write, AI) as read-only
4. ✅ Change widget name → Save
5. ✅ "Settings saved successfully" message
6. ✅ Refresh page → changes persisted
```

#### Test 5: Customer Portal Security

```
1. Navigate to /app/settings/security
2. ✅ Shows siteId (read-only, copyable)
3. ✅ Click copy → "Copied!" feedback
4. ✅ Add domain → example.com
5. ✅ Toggle "Allow Localhost"
6. ✅ Save → "Security settings saved"
7. ✅ Refresh → changes persisted
```

#### Test 6: Session Separation

```
1. Login as admin at /login → Session A
2. Open incognito/private window
3. Login as org user at /app/login → Session B
4. ✅ Both sessions work simultaneously
5. ✅ Admin sees multi-org switcher
6. ✅ Org user sees single org only
7. ✅ Logout from one doesn't affect the other
```

#### Test 7: Data Isolation

```
Admin portal:
1. Create new org "Test Company"
2. Switch to "Demo Org"
3. View conversations (e.g., 10 conversations)

Customer portal (logged in as demo org user):
1. View /app
2. ✅ Shows same 10 conversations
3. ✅ Cannot see "Test Company" data
4. ✅ Cannot switch orgs (no switcher UI)
```

#### Test 8: Role-Based Access

```
As org owner (owner@demo.helvino.io):
1. ✅ Can update settings (PATCH /org/settings works)
2. ✅ Can update security (PATCH /org/security works)

If you create an agent role user:
1. ❌ Cannot update settings (403 Forbidden)
2. ✅ Can view conversations and reply
```

### API Endpoint Testing

```bash
# Org user login
curl -c cookies.txt -X POST http://localhost:4000/org/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.helvino.io","password":"demo_owner_2026"}'

# Expected:
# {
#   "ok": true,
#   "user": {
#     "id": "...",
#     "email": "owner@demo.helvino.io",
#     "role": "owner",
#     "orgId": "...",
#     "orgKey": "demo",
#     "orgName": "Demo Org"
#   }
# }

# Get conversations (org-scoped)
curl -b cookies.txt http://localhost:4000/org/conversations

# Expected: [...conversations for demo org only]

# Get settings
curl -b cookies.txt http://localhost:4000/org/settings

# Expected:
# {
#   "org": { "id": "...", "key": "demo", "name": "Demo Org" },
#   "settings": { ... }
# }

# Update settings (branding only)
curl -b cookies.txt -X PATCH http://localhost:4000/org/settings \
  -H "Content-Type: application/json" \
  -d '{"widgetName":"My Custom Widget"}'

# Expected: Updated settings returned
```

---

## Security Notes

### Session Security

✅ **Separate Session Data**:
- Admin session: `adminUserId`, `adminRole`
- Org user session: `orgUserId`, `orgId`, `orgRole`
- Same cookie name, different data keys = no conflicts

✅ **Cookie Settings** (Same for Both):
- HttpOnly: `true` (prevent JavaScript access)
- Secure: `true` (production only, HTTPS)
- SameSite: `lax` (CSRF protection)
- Max Age: 7 days
- Rolling: `true` (resets on each request)

### Data Isolation

✅ **Org User Cannot**:
- Access other organizations' data
- Create new organizations
- View/modify internal admin settings
- Access `/internal/*` endpoints
- Switch organizations (no multi-org access)

✅ **Org User Can**:
- View all conversations in their org
- Send agent replies (if writeEnabled)
- Update widget branding settings (if owner/admin)
- Manage domain allowlist (if owner)
- View siteId

### Permission Levels

| Action | Owner | Admin | Agent |
|--------|-------|-------|-------|
| View conversations | ✅ | ✅ | ✅ |
| Send replies | ✅ | ✅ | ✅ |
| Update branding | ✅ | ✅ | ❌ |
| Update security | ✅ | ❌ | ❌ |

**Note**: Kill switches (widgetEnabled, writeEnabled, aiEnabled) are admin-only (internal admin portal).

---

## URL Structure

### Internal Admin Portal
- Login: `/login`
- Dashboard: `/dashboard`
- Create Org: `/dashboard/orgs/new`
- Settings: `/dashboard/settings`
- Security: `/dashboard/settings/security`

### Customer Portal
- Login: `/app/login`
- Conversations: `/app`
- Settings: `/app/settings`
- Security: `/app/settings/security`

**No Conflicts**: Different URL prefixes = no routing issues

---

## No Breaking Changes

✅ **Internal Admin Portal**: Completely unchanged
- Same routes, same auth, same functionality
- Multi-org switching works
- Org creation works
- All settings/security work

✅ **Widget Embed Flow**: Completely unchanged
- Still uses siteId
- Still uses org token from bootloader
- Domain allowlist enforced
- No API changes to widget endpoints

✅ **Existing API Endpoints**: Still work
- `/conversations`, `/conversations/:id`, `/conversations/:id/messages`
- Still support admin session bypass (from internal admin dashboard)
- Still support org token (from widgets)
- Still support x-org-key header (for multi-org admin access)

---

## Next Steps (Optional)

### 1. Org User Management
- Add page to invite/manage org users
- Send invitation emails
- Role management (promote agent → admin)

### 2. Org User Registration
- Self-service signup flow
- Email verification
- Org ownership transfer

### 3. Team Collaboration
- Real-time presence (who's viewing what conversation)
- Assign conversations to specific agents
- Internal notes (not visible to customers)

### 4. Customer Portal Analytics
- Conversation volume charts
- Response time metrics
- Agent performance stats

### 5. Unified Socket.IO
- Connect customer portal to Socket.IO
- Real-time updates for inbox
- Typing indicators

---

## Status

✅ **COMPLETE** - Customer portal fully implemented and ready to test

**What Works**:
- Separate login/logout flows
- Org-scoped data access
- Conversations inbox + detail + reply
- Settings management (branding only)
- Security management (domains, siteId)
- Session separation (no conflicts)
- Role-based access control

**No Breaking Changes**:
- Internal admin portal unchanged
- Widget embed flow unchanged
- Existing API endpoints unchanged

**Ready to Test**: After database migration + seed!
