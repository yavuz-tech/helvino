# STEP 11.40 — Domain Allowlist + Widget Settings (Self-Serve) + Admin Visibility

## Overview
This step makes widget configuration fully self-serve for portal users. After signup, customers can:
1. Authorize their website domain(s) for the widget
2. Copy the embed snippet with their siteId
3. Verify widget connection status and health
4. Enable/disable their widget

All without manual admin intervention.

## Domain Allowlist

### How It Works
- Organizations have an `allowedDomains` array in the database
- When the widget loads on a website, the bootloader checks `Origin`/`Referer` headers against this list
- Unauthorized domains are rejected with 403 and the `widgetDomainMismatchTotal` counter increments

### Domain Validation Rules
- **Accepted**: `example.com`, `sub.example.com`, `*.example.com` (wildcard)
- **Rejected**: protocols (`http://`, `https://`), paths (`/foo`), ports (`:3000`)
- **Localhost**: Allowed in development (`NODE_ENV !== "production"`), blocked in production
- Domains are always lowercased, trimmed, and stored normalized

## API Endpoints

### Portal (requires portal auth)

| Method | Path | Step-up | Description |
|--------|------|---------|-------------|
| GET | `/portal/widget/config` | No | Widget config + embed snippet + health |
| POST | `/portal/widget/domains` | Yes | Add domain to allowlist |
| DELETE | `/portal/widget/domains` | Yes | Remove domain from allowlist |
| PATCH | `/portal/widget/config` | Yes | Toggle widgetEnabled |

### Admin (requires admin auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/internal/orgs/:orgKey/widget/config` | Read-only widget config view |

## Response Shapes

### GET /portal/widget/config
```json
{
  "widgetEnabled": true,
  "allowedDomains": ["example.com"],
  "allowLocalhost": true,
  "embedSnippet": {
    "html": "<!-- Helvino Chat Widget -->\n<script>window.HELVINO_SITE_ID=\"...\";",
    "scriptSrc": "https://cdn.helvino.io/embed.js",
    "siteId": "..."
  },
  "lastWidgetSeenAt": "2026-02-05T...",
  "health": { "status": "OK", "failuresTotal": 0, "domainMismatchTotal": 0 },
  "requestId": "..."
}
```

## Security
- All mutation endpoints require step-up verification
- Rate-limited: 20/min per IP on domain add/remove
- requestId propagated in all responses
- Audit log events: `widget.domain.added`, `widget.domain.removed`, `widget.config.updated`, `admin.widget.config.read`

## Dev vs Production
| Feature | Dev | Production |
|---------|-----|-----------|
| Localhost domains | Allowed | Blocked |
| allowLocalhost flag | Enabled by default | Should be disabled |

## i18n
Full EN/TR/ES parity for all widget settings UI strings.
