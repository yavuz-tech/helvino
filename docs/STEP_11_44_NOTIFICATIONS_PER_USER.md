# Step 11.44 — Per-User Notifications (Read State) + Preferences + Unread Badge

## Overview

Makes the notification system truly multi-user:
- Read/unread state is tracked per portal user (not org-global)
- Users can configure notification preferences (security/billing/widget)
- Unread badge in portal header polls every 30s

## Data Model

### NotificationRead
| Field | Type | Description |
|-------|------|-------------|
| id | cuid | Primary key |
| notificationId | String | FK to Notification |
| orgUserId | String | The user who read it |
| readAt | DateTime | When read |

Unique constraint: `(notificationId, orgUserId)`

### NotificationPreference
| Field | Type | Description |
|-------|------|-------------|
| id | cuid | Primary key |
| orgUserId | String | Unique per user |
| securityEnabled | Boolean | Show security notifications (default true) |
| billingEnabled | Boolean | Show billing notifications (default true) |
| widgetEnabled | Boolean | Show widget health notifications (default true) |

## API Endpoints

### Portal (auth required, org-scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/portal/notifications` | List with per-user read state |
| GET | `/portal/notifications/unread-count` | Unread count (filtered by prefs) |
| POST | `/portal/notifications/:id/read` | Mark one as read (per-user) |
| POST | `/portal/notifications/mark-all-read` | Mark all as read (per-user) |
| GET | `/portal/notifications/preferences` | Get user preferences |
| PUT | `/portal/notifications/preferences` | Update preferences |

### Preferences Behavior
- Preferences filter which notification types appear in:
  - Unread badge count
  - Notifications list "Unread" tab
- Notifications are never deleted; just filtered at query layer
- SYSTEM type notifications are always shown regardless of preferences

## Web UI

### Portal Header Badge
- Bell icon with red unread count badge
- Polls `/portal/notifications/unread-count` every 30 seconds
- Cleans up interval on unmount

### Notifications Page
- Tabs: All / Unread
- Preferences panel with 3 toggles (save immediately)
- Per-item "Mark as read" button
- "Mark all as read" bulk action
- Pagination with "Load more"

## Security
- All endpoints require portal auth
- Org isolation: users only see their org's notifications
- requestId propagation maintained
- Audit log on preference update
