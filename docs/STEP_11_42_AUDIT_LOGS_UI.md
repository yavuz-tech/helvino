# Step 11.42 — Audit Logs (Portal + Admin) + CSV Export + Filters

## Overview

Adds org-scoped audit log viewing for portal users and global audit search + security summary for admin users.

## API Endpoints

### Portal (auth required, org-scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/portal/audit-logs` | Paginated list with filters |
| GET | `/portal/audit-logs/export.csv` | CSV download |

**Query Parameters:**
- `limit` — default 25, max 100
- `cursor` — pagination cursor (ID)
- `action` — filter by action (contains match)
- `from` / `to` — ISO date range
- `actorUserId` — filter by actor

**Response shape:**
```json
{
  "items": [
    {
      "id": "...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "action": "billing.lock",
      "actor": { "id": "admin@example.com", "email": "admin@example.com" },
      "ip": "127.0.0.1",
      "requestId": "req-xyz",
      "meta": { ... }
    }
  ],
  "nextCursor": "...",
  "requestId": "..."
}
```

### Admin (admin auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/internal/audit-logs` | Global list with filters + orgKey/orgId |
| GET | `/internal/metrics/audit-summary` | Last 24h summary |

**Audit Summary Response:**
```json
{
  "last24h": {
    "total": 42,
    "byActionTopN": [{ "action": "...", "count": 10 }]
  },
  "suspiciousTopN": [{ "action": "security.widget_health_spike", "count": 3 }],
  "requestId": "..."
}
```

## CSV Export

- Header: `createdAt,action,actor,ip,requestId,metaSummary`
- Content-Type: `text/csv; charset=utf-8`
- Max 5000 rows per export
- Uses same filters as list endpoint

## RBAC

- Portal: `owner` or `admin` role required (via `requirePortalRole`)
- Admin: `requireAdmin` middleware

## Security

- requestId propagated via x-request-id header
- Rate limits unchanged (uses existing middleware)
- No secrets exposed in responses
- Audit log details may contain `requestId` and `ip` from original action

## Web UI

### Portal — `/portal/audit`
- Filterable table (action, actor, date range)
- Pagination with "Load More"
- CSV export button
- Date formatting uses `useHydrated` to prevent SSR/CSR mismatch

### Admin — Dashboard Overview
- `AdminAuditSummary` component showing:
  - Total events (24h)
  - Top actions
  - Suspicious events (security.*, rate_limited, etc.)

## i18n

All strings use i18n keys with EN/TR/ES parity:
- `audit.filters.*`, `audit.table.*`, `audit.exportCsv`, `audit.empty`, `audit.loadMore`
- `admin.auditSummary.*`
- `nav.auditLogs`
