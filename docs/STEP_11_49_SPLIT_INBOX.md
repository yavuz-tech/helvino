# STEP 11.49 — Split Inbox View (List + Detail Panel) + Deep Link

## Goal
Enhance Portal Inbox (/portal/inbox) with a split-view UI and deep-linkable conversations.

## Implementation

### Split-View Layout

**Left Panel (420px width):**
- Status tabs (Open/Closed/All)
- Search with 300ms debounce
- Assignment filter
- Multi-select checkboxes + Select all
- Bulk actions bar (when selection > 0)
- Pagination (Load more)
- All Step 11.48 features preserved

**Right Panel (flex-1):**
- Empty state when no conversation selected
- Detail panel when conversation selected:
  - Header: conversation ID, status badge, Copy Link, Close (X) button
  - Quick actions: status toggle, assignment dropdown
  - Tabs: Notes / Details
  - All Step 11.47 features preserved

### Deep Link (?c=conversationId)

**URL State Management:**
- When conversation selected → URL updated with `?c=<conversationId>`
- On page load → if `?c=` param exists, auto-select that conversation
- Copy Link button → copies full URL with `?c=` to clipboard
- Close panel → removes `?c=` from URL
- Works with browser back/forward

**Benefits:**
- Shareable links to specific conversations
- Refresh preserves selection
- Browser navigation works naturally

### UX Details

**Tabs in Detail Panel:**
1. **Notes Tab (default)**:
   - Add note textarea
   - Notes list (author, timestamp, body)
   - Note count badge in tab label

2. **Details Tab**:
   - Status (Open/Closed)
   - Assigned to (email or "Unassigned")
   - Closed at (if closed)
   - Created / Last updated timestamps
   - Message count
   - Recent messages preview (scrollable)

**Actions:**
- Copy Link: copies `http://localhost:3000/portal/inbox?c=<id>` to clipboard
- Close Panel (X): clears selection + removes URL param

## i18n

Added keys with EN/TR/ES parity:
- `inbox.detail.noSelection`
- `inbox.detail.copyLink`
- `inbox.detail.linkCopied`
- `inbox.detail.details`
- `inbox.detail.notes`
- `inbox.detail.closePanel`
- `inbox.detail.open`
- `inbox.detail.close`

## Security & Performance

- All existing auth/org scoping preserved
- No breaking changes to API
- Hydration-safe date formatting (useHydrated hook)
- Client-side URL state management (no server burden)

## Non-Breaking Guarantees

- All Step 11.47 features work (status/assignment per conversation, notes)
- All Step 11.48 features work (filters, search, bulk actions)
- No new global CSS
- No layout regressions
