# STEP 11.48 — Inbox Power Tools: Filters + Search + Bulk Actions + Better List API

## Goal
Make /portal/inbox usable at scale with fast filtering, search, pagination, multi-select, and bulk actions.

## API Endpoints

### GET /portal/conversations (Enhanced)
Portal auth required. Rate limit: 60/min per org+IP.

**Query Parameters:**
| Param | Values | Default | Description |
|-------|--------|---------|-------------|
| `status` | `OPEN`, `CLOSED`, `ALL` | `OPEN` | Filter by conversation status |
| `assigned` | `me`, `unassigned`, `any`, `<orgUserId>` | `any` | Filter by assignment |
| `q` | string | - | Search in conversation ID |
| `limit` | 10–50 | 20 | Page size |
| `cursor` | string | - | Cursor for pagination |

**Response:**
```json
{
  "items": [{
    "id": "...",
    "status": "OPEN",
    "assignedToOrgUserId": "...",
    "assignedTo": { "id": "...", "email": "...", "role": "..." },
    "closedAt": null,
    "createdAt": "...",
    "updatedAt": "...",
    "messageCount": 5,
    "lastMessageAt": "...",
    "noteCount": 2,
    "preview": { "text": "Hello...", "from": "user" }
  }],
  "nextCursor": "...",
  "requestId": "..."
}
```

### POST /portal/conversations/bulk
Portal auth + step-up required. Rate limit: 10/min.

**Body:**
```json
{
  "ids": ["conv1", "conv2"],
  "action": "ASSIGN" | "UNASSIGN" | "OPEN" | "CLOSE",
  "assignedToOrgUserId": "..." // required for ASSIGN
}
```

**Rules:**
- Maximum 50 IDs per request
- `ASSIGN` requires valid, active org user
- `CLOSE` sets `status=CLOSED` + `closedAt=now`
- `OPEN` sets `status=OPEN` + `closedAt=null`
- All actions are org-scoped

**Response:**
```json
{ "updated": 5, "action": "CLOSE", "requestId": "..." }
```

## Web UI (/portal/inbox)

### Filter Bar
- **Status tabs**: Open / Closed / All (default Open)
- **Search**: Debounced input (300ms) searching conversation IDs
- **Assignment filter**: Any / Assigned to me / Unassigned

### Multi-Select + Bulk Actions
- Checkbox per conversation row + "Select all on page"
- Bulk actions bar appears when selection > 0:
  - Mark Open / Mark Closed
  - Unassign
  - Assign (dropdown of active team members)
- After bulk action: list refreshes, selection clears, success banner

### Pagination
- Cursor-based "Load more" button at bottom of list

## Audit Logging
- `inbox.bulk` action logged with: action type, count, actor, requestId

## Security
- All endpoints: portal auth + org scoping
- Bulk endpoint: requires step-up (MFA if enabled)
- Rate limits consistent with existing patterns
- requestId propagation maintained

## i18n
Full EN/TR/ES parity for all new keys under `inbox.filters.*`, `inbox.search.*`, `inbox.bulk.*`, `inbox.loadMore`, `inbox.noResults`.
