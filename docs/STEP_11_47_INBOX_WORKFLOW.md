# STEP 11.47 — Inbox Workflow: Assignment + Open/Closed + Notes

**Goal**: Transform the Portal Inbox into a real support workflow with conversation assignment, status management (open/closed), and internal notes.

## Implementation Summary

### Database (Prisma)

Added fields to `Conversation`:
- `status` (String, default "OPEN"): "OPEN" | "CLOSED"
- `assignedToOrgUserId` (String?, nullable): FK to `OrgUser`
- `closedAt` (DateTime?, nullable): timestamp when closed

Created `ConversationNote` model:
- `id` (cuid)
- `orgId` (String)
- `conversationId` (String, FK)
- `authorOrgUserId` (String, FK)
- `body` (Text, max 2000 chars)
- `createdAt` (DateTime)

### API Routes

**Portal conversation management** (`/portal/conversations/:id`):

1. **PATCH /portal/conversations/:id**
   - Auth: portal user + role check
   - Rate limit: 30/minute
   - Body: `{ status?: "OPEN"|"CLOSED", assignedToUserId?: string|null }`
   - Validation:
     - Assignee must be active org member
     - Status change updates `closedAt` accordingly
   - Audit log: `conversation.assigned`, `conversation.unassigned`, `conversation.closed`, `conversation.reopened`
   - Returns: updated conversation + requestId

2. **GET /portal/conversations/:id/notes**
   - Auth: portal user + role check
   - Rate limit: 60/minute
   - Returns: list of notes (latest first) + requestId

3. **POST /portal/conversations/:id/notes**
   - Auth: portal user + role check
   - Rate limit: 20/minute
   - Body: `{ body: string }` (min 1, max 2000 chars)
   - Creates note as current portal user
   - Audit log: `conversation.note_created`
   - Returns: created note + requestId

### Web UI (/portal/inbox)

**Enhanced inbox page** with:

1. **Status management**:
   - Badge showing "Open" or "Closed" status
   - Close/Reopen button (disabled while updating)
   - Status reflected in conversation list

2. **Assignment**:
   - Dropdown showing team members (active only)
   - "Unassigned" option
   - Real-time assignment update
   - Assignee displayed in conversation list

3. **Internal notes**:
   - Notes section below messages
   - Add note textarea with character counter (2000 max)
   - Submit button with validation
   - Notes list showing author + timestamp + body
   - Empty state when no notes

### i18n (EN/TR/ES)

Added keys with full parity:
- `inbox.statusOpen`, `inbox.statusClosed`
- `inbox.assignTo`, `inbox.unassigned`
- `inbox.closeConversation`, `inbox.reopenConversation`
- `inbox.notesTitle`, `inbox.addNote`, `inbox.notePlaceholder`, `inbox.noteSubmit`
- `inbox.noteEmpty`, `inbox.noteTooLong`
- `inbox.assigneeUpdated`, `inbox.statusUpdated`

## Security & Observability

1. **Org isolation**: All endpoints enforce org-scoped access
2. **Validation**: Assignee must be active member, note length enforced
3. **Audit logs**: Best-effort logging for assignment/status/note actions with requestId
4. **Rate limiting**: Applied to all endpoints using existing presets
5. **RequestId propagation**: x-request-id header preserved throughout

## Non-Breaking Guarantees

- No changes to existing routes
- Widget security flow unchanged
- orgToken enforcement unchanged
- Portal/admin auth separation maintained
- Hydration-safe date formatting using `useHydrated` hook

## Migration

Applied:
```
20260206260000_v11_47_inbox_workflow/migration.sql
```

Adds:
- `conversations.status`, `conversations.assignedToOrgUserId`, `conversations.closedAt`
- `conversation_notes` table with indexes
- Foreign keys and constraints
