# Step 11.43 — In-App Notifications Center (Portal)

## Overview

Adds an org-scoped in-app notification system for portal users. No email sending — notifications are purely in-app with bell icon badge and a dedicated page.

## Data Model

### Notification (Prisma)
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| orgId | String | Organization scope |
| userId | String? | null = org-wide; set = user-specific |
| severity | String | INFO / WARN / CRITICAL |
| type | String | SECURITY / WIDGET_HEALTH / BILLING / SYSTEM |
| titleKey | String | i18n key for title |
| bodyKey | String | i18n key for body |
| metaJson | Json? | Additional metadata |
| createdAt | DateTime | Creation timestamp |
| readAt | DateTime? | null = unread |

Indexes: `(orgId, createdAt)`, `(orgId, userId, readAt)`

## API Endpoints

### Portal (auth required, org-scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/portal/notifications` | Paginated list with unread count |
| POST | `/portal/notifications/:id/read` | Mark one as read |
| POST | `/portal/notifications/read-all` | Mark all as read |

**Query Parameters (GET):**
- `limit` — default 25, max 100
- `cursor` — pagination cursor
- `unreadOnly` — "1" to filter unread only

**Response shape (GET):**
```json
{
  "items": [...],
  "nextCursor": "...",
  "unreadCount": 3,
  "requestId": "..."
}
```

## Notification Emit Logic

### Helper: `createNotification()`
- Server-side only; never trust client input
- Dedupe window: 30 minutes (same org + same titleKey)
- Best-effort: never blocks main request flow

### Emit Triggers
- **SECURITY**: suspicious login activity, password resets, rate limiting, untrusted hosts
- **WIDGET_HEALTH**: widget status changes to NEEDS_ATTENTION

### Helper Functions
- `emitSecurityNotification(orgId, action, meta?)` — maps audit actions to security notifications
- `emitWidgetHealthNotification(orgId, meta?)` — widget health alerts

## Web UI

### Bell Icon (PortalLayout header)
- Shows unread count badge (red circle)
- Links to `/portal/notifications`
- Refreshes count on navigation

### Notifications Page (`/portal/notifications`)
- Tabs: All / Unread
- Items show: severity pill, type icon, title/body (i18n), timestamp
- Actions: Mark as read (per item), Mark all as read
- Pagination: Load more
- Hydration-safe date formatting

## i18n Keys (EN/TR/ES)

All notification UI strings use i18n keys:
- `notifications.*` — UI labels
- `notif.security.*` — security notification content
- `notif.widgetHealth.*` — widget health notification content

## Security

- Portal auth required for all endpoints
- Org isolation: users only see their org's notifications
- userId filtering: user-specific notifications visible only to that user
- requestId propagation maintained
