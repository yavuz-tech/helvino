# Step 11.2: Multi-Org Admin + Onboarding - Implementation Summary

## Overview

Successfully implemented multi-organization management in the Helvino admin dashboard. Admins can now:
- Create and manage multiple organizations
- Switch between organizations
- View organization-specific data (conversations, settings, security)
- Get embeddable widget snippets with siteId

---

## Backend Changes (apps/api)

### 1. New Admin Endpoints

**File**: `apps/api/src/routes/internal-admin.ts`

#### GET /internal/orgs
- Lists all organizations (admin only)
- Returns: `[{ id, key, name, siteId, allowLocalhost, allowedDomains, createdAt, updatedAt }]`
- Protected by `requireAdmin` middleware (session cookie)

#### POST /internal/orgs
- Creates a new organization (admin only)
- Body: `{ name: string, key?: string, allowedDomains?: string[], allowLocalhost?: boolean }`
- Auto-generates:
  - `key`: slug from name + 4 random chars (e.g., `my-company-a3f9`)
  - `siteId`: `site_` + 16 random alphanumeric chars
- Sets defaults:
  - `widgetEnabled: true`
  - `writeEnabled: true`
  - `aiEnabled: true`
  - `messageRetentionDays: 365`
  - `hardDeleteOnRetention: false`
  - `primaryColor: "#0F5C5C"`
  - `widgetName`: org name
  - `widgetSubtitle`: "AI Chat Assistant"
- Returns: created org object
- Protected by `requireAdmin` middleware

### 2. Helper Functions

```typescript
// Generate unique org key from name
function generateOrgKey(name: string): string
  // Format: slug-XXXX (lowercase, alphanumeric + hyphens)
  // Example: "My Company" → "my-company-a3f9"

// Generate unique site ID
function generateSiteId(): string
  // Format: site_XXXXXXXXXXXXXXXX (16 random alphanumeric)
  // Example: "site_8K4jN2mP7vR9Qa1S"
```

---

## Frontend Changes (apps/web)

### 1. New Context: OrgContext

**File**: `apps/web/src/contexts/OrgContext.tsx`

**Purpose**: Centralized organization state management

**State**:
- `organizations`: Array of all orgs
- `selectedOrg`: Currently selected org
- `isLoading`: Loading state
- `error`: Error state

**Methods**:
- `selectOrg(orgKey)`: Switch to different org
- `refreshOrgs()`: Reload org list from API
- `createOrg(data)`: Create new org and auto-select it

**Storage**: Uses `localStorage` key `helvino_admin_org_key` to persist selection

**Flow**:
1. On mount: Fetch GET /internal/orgs
2. Select org: Try stored key → first org → null
3. On org change: Store key in localStorage

### 2. Updated API Utility

**File**: `apps/web/src/utils/api.ts`

**Changed**:
```typescript
// OLD: Hardcoded x-org-key header
const DEFAULT_ORG_KEY = "demo";
headers: { "x-org-key": DEFAULT_ORG_KEY }

// NEW: Optional orgKey parameter
interface ApiFetchOptions extends RequestInit {
  orgKey?: string;
}

// Usage:
apiFetch("/conversations", { orgKey: selectedOrg.key })
```

**Benefits**:
- No more hardcoded org key
- Dynamic tenant switching
- Backwards compatible (orgKey is optional)

### 3. Dashboard Layout Updates

**File**: `apps/web/src/components/DashboardLayout.tsx`

**Added**:
- Organization dropdown in sidebar
- Shows current org name + key
- Lists all available orgs
- "Create Organization" button at bottom of dropdown
- Auto-closes on selection

**UI Flow**:
1. Click org section in sidebar
2. Dropdown shows all orgs
3. Click org → switches context
4. Click "Create Organization" → navigates to `/dashboard/orgs/new`

### 4. New Page: Create Organization

**File**: `apps/web/src/app/dashboard/orgs/new/page.tsx`

**Form Fields**:
- **Name** (required): Organization display name
- **Allowed Domains** (optional): One per line, supports wildcards (*.example.com)
- **Allow Localhost** (checkbox): For development testing

**Success State**:
- Shows created org details (key, siteId)
- Displays **embeddable snippet** with copy button:
  ```html
  <script>window.HELVINO_SITE_ID="site_XXXX";</script>
  <script src="https://cdn.helvion.io/embed.js"></script>
  ```
- Links to dashboard and settings

**Auto-Selection**: New org is automatically selected after creation

### 5. Dashboard Page Updates

**File**: `apps/web/src/app/dashboard/page.tsx`

**Changes**:
- Uses `useOrg()` hook for selected org
- Passes `orgKey` to all `apiFetch()` calls:
  - `GET /conversations`
  - `GET /conversations/:id`
  - `POST /conversations/:id/messages`
- Resets selected conversation when org changes
- Shows empty state when no org selected

**Empty State**:
```
🏢
No Organization Selected
Create your first organization to get started
[Create Organization Button]
```

### 6. Settings Page Updates

**File**: `apps/web/src/app/dashboard/settings/page.tsx`

**Changes**:
- Uses `useOrg()` hook for selected org
- Fetches `/api/org/${selectedOrg.key}/settings`
- Saves to `/api/org/${selectedOrg.key}/settings`
- Waits for org selection before loading

### 7. Security Page Updates

**File**: `apps/web/src/app/dashboard/settings/security/page.tsx`

**Changes**:
- Uses `useOrg()` hook for selected org
- Fetches `/api/org/${selectedOrg.key}/security`
- Saves to `/api/org/${selectedOrg.key}/security`
- Rotates siteId for `/api/org/${selectedOrg.key}/security/rotate-site-id`
- Waits for org selection before loading

### 8. Providers Setup

**File**: `apps/web/src/app/providers.tsx`

**Updated**:
```tsx
<OrgProvider>
  <DebugProvider>
    {children}
    <DebugBanner />
  </DebugProvider>
</OrgProvider>
```

**Order**: OrgProvider wraps DebugProvider to make org context available everywhere

---

## User Flow

### First Login (No Orgs)
1. Login → `/dashboard`
2. See empty state: "No Organization Selected"
3. Click "Create Organization"
4. Fill form (name, domains, localhost toggle)
5. Submit → Org created with auto-generated key + siteId
6. See success page with embed snippet
7. Copy embed snippet
8. Go to dashboard → Inbox loads (empty initially)

### Creating Additional Orgs
1. Click org dropdown in sidebar
2. Click "Create Organization" at bottom
3. Fill form
4. Submit → New org auto-selected
5. Dashboard data refreshes for new org

### Switching Orgs
1. Click org dropdown in sidebar
2. See list of all orgs
3. Click different org
4. Dashboard reloads:
   - Conversations list refreshes
   - Selected conversation resets
   - Settings/Security reflect new org

### Managing Org Settings
1. Select org from dropdown
2. Go to Settings → Shows selected org's settings
3. Go to Security → Shows selected org's siteId + domains
4. All changes apply to selected org only

---

## Data Isolation

### Conversation List
- `GET /conversations` with `x-org-key: ${selectedOrg.key}`
- Only returns conversations for selected org
- Empty inbox when switching to new org

### Conversation Detail
- `GET /conversations/:id` with `x-org-key: ${selectedOrg.key}`
- Only loads if conversation belongs to selected org
- 404 if wrong org

### Agent Replies
- `POST /conversations/:id/messages` with `x-org-key: ${selectedOrg.key}`
- Admin session bypass allows POST without org token
- Message associated with selected org

### Settings
- `/api/org/${selectedOrg.key}/settings`
- Each org has independent:
  - Kill switches (widgetEnabled, writeEnabled, aiEnabled)
  - Retention policy (messageRetentionDays, hardDeleteOnRetention)
  - Branding (widgetName, widgetSubtitle, primaryColor, language)

### Security
- `/api/org/${selectedOrg.key}/security`
- Each org has independent:
  - Site ID (public identifier for embeds)
  - Allowed domains (domain allowlist)
  - Allow localhost toggle

---

## Files Changed

### Backend (apps/api)
1. ✅ `src/routes/internal-admin.ts` - Added GET/POST /internal/orgs endpoints

### Frontend (apps/web)
1. ✅ `src/contexts/OrgContext.tsx` - NEW: Multi-org state management
2. ✅ `src/utils/api.ts` - Added optional orgKey parameter
3. ✅ `src/components/DashboardLayout.tsx` - Added org switcher dropdown
4. ✅ `src/app/providers.tsx` - Wrapped with OrgProvider
5. ✅ `src/app/dashboard/page.tsx` - Use orgKey from context
6. ✅ `src/app/dashboard/settings/page.tsx` - Use orgKey from context
7. ✅ `src/app/dashboard/settings/security/page.tsx` - Use orgKey from context
8. ✅ `src/app/dashboard/orgs/new/page.tsx` - NEW: Create org form
9. ✅ `src/contexts/DebugContext.tsx` - Minor update for org key

---

## Testing Checklist

### Manual Testing

**1. Create First Organization**
```
1. Login to dashboard
2. See empty state (no org selected)
3. Click "Create Organization"
4. Fill: name="Test Company", domains="localhost\n*.test.com", allowLocalhost=true
5. Submit
6. Verify:
   - Success page shows org key (e.g., test-company-xyz9)
   - Success page shows siteId (e.g., site_ABC123...)
   - Embed snippet is copyable
7. Click "Go to Dashboard"
8. Verify: Dashboard loads, org switcher shows "Test Company"
```

**2. Create Second Organization**
```
1. Click org dropdown
2. Click "Create Organization"
3. Fill: name="Demo Company"
4. Submit
5. Verify:
   - New org created
   - Org switcher now shows "Demo Company" (auto-selected)
   - Inbox is empty (different org)
```

**3. Switch Between Orgs**
```
1. Click org dropdown
2. See both orgs listed
3. Click "Test Company"
4. Verify:
   - Org switcher updates to "Test Company"
   - Inbox refreshes (may show conversations if any)
   - Selected conversation resets
5. Go to Settings
6. Verify: Settings reflect "Test Company" org
```

**4. Org-Specific Data**
```
Test Company context:
1. Create conversation (via widget or API)
2. See conversation in inbox
3. Select and reply

Switch to Demo Company:
1. Inbox is empty (no conversations yet)
2. Settings are independent
3. Security shows different siteId
```

**5. Widget Embedding**
```
1. Create org, copy siteId from success page
2. In embed code, verify siteId format: site_XXXXXXXXXXXXXXXX
3. Embed on test page with HELVINO_SITE_ID
4. Conversations appear in correct org inbox
```

### API Endpoint Testing

```bash
# List orgs (requires admin session)
curl -X GET http://localhost:4000/internal/orgs \
  --cookie "sessionId=..."

# Expected: [{ id, key, name, siteId, allowLocalhost, allowedDomains, createdAt, updatedAt }]

# Create org
curl -X POST http://localhost:4000/internal/orgs \
  -H "Content-Type: application/json" \
  --cookie "sessionId=..." \
  -d '{"name":"My New Org","allowedDomains":["example.com"],"allowLocalhost":true}'

# Expected: { id, key, name, siteId, allowLocalhost, allowedDomains, createdAt, updatedAt }

# Get conversations for specific org
curl -X GET http://localhost:4000/conversations \
  -H "x-org-key: my-new-org-xyz9" \
  --cookie "sessionId=..."

# Expected: [...conversations for that org only]
```

---

## Security Notes

### Multi-Tenancy Enforcement

✅ **Backend**:
- All conversation/message endpoints require `x-org-key` header
- Data queries filtered by `orgId`
- Admin session bypasses org token requirement (but still needs x-org-key)

✅ **Frontend**:
- Selected org key sent with every tenant-specific request
- No cross-org data leakage
- Org selection persisted in localStorage (client-side only)

✅ **Widget Security** (Unchanged):
- Widgets use `siteId` (public identifier)
- Domain allowlist enforced per org
- Org token flow unchanged

### Admin Permissions

- All `/internal/orgs` endpoints require admin session
- Session cookie authentication (no x-internal-key needed)
- Org creation logged with admin user ID

---

## Environment Variables

### No Changes Required

**Removed**:
- ❌ `NEXT_PUBLIC_DEFAULT_ORG_KEY` (no longer used)

**Kept**:
- ✅ `NEXT_PUBLIC_API_URL` (API base URL)
- ✅ `NEXT_PUBLIC_INTERNAL_KEY` (only for SystemStatus metrics display)

---

## Known Limitations

### 1. Socket.IO Org Switching
**Issue**: Socket connection uses fixed orgKey on mount
**Impact**: Real-time updates may not switch when org changes
**Workaround**: Refresh page after org switch
**Future**: Reconnect socket on org change

### 2. No Org Search/Filter
**Current**: Dropdown shows all orgs in creation order
**Limitation**: May be slow with 100+ orgs
**Future**: Add search/filter in org dropdown

### 3. No Org Deletion
**Current**: No UI or API to delete orgs
**Workaround**: Database query to delete org manually
**Future**: Add soft delete with admin confirmation

### 4. No Org Rename
**Current**: Cannot change org name after creation
**Workaround**: Create new org
**Future**: Add org update endpoint

---

## Next Steps (Optional)

### 1. Team Management
- Add `AdminUser` → `Organization` many-to-many relationship
- Org-level RBAC (owner, admin, viewer)
- Invite team members to specific orgs

### 2. Org Deletion
- Add `DELETE /internal/orgs/:key` endpoint
- Soft delete (flag `deleted: true`)
- Cascade delete conversations/messages

### 3. Org Transfer
- Transfer ownership to another admin
- Change org key (with redirect from old key)

### 4. Org Analytics
- Per-org metrics dashboard
- Conversation volume charts
- Widget usage stats

### 5. Org Billing
- Add `plan` field (free, pro, enterprise)
- Rate limits per plan
- Usage tracking

---

## Status

✅ **COMPLETE** - Multi-org admin management is fully functional

**What Works**:
- Create organizations with auto-generated key + siteId
- List all organizations
- Switch between organizations
- Org-specific data isolation (conversations, settings, security)
- Embeddable snippet with siteId
- Persistent org selection in localStorage

**What's Protected**:
- All org management endpoints require admin session
- Data queries filtered by selected org key
- No cross-org data leakage

**No Breaking Changes**:
- Existing orgs still work
- Widget security unchanged
- Admin auth flow unchanged
