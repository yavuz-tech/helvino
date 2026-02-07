# Step 11.39 — Self-Serve Organizations + Admin Org Directory

## Overview

This step makes Helvino fully self-serve (like Tawk.to / Crisp):
- A user signs up → verifies email → logs in → immediately has a **Workspace (Organization)** created automatically.
- The Admin dashboard gains an **Organization Directory** to view, search, and manage all organizations (self-serve or admin-created).
- No manual approval is needed for new customers.

## Data Model Changes

### Organization (new fields)
| Field | Type | Description |
|---|---|---|
| `isActive` | `Boolean` (default `true`) | Whether the org is active; deactivated orgs are blocked. |
| `ownerUserId` | `String?` | FK to the OrgUser who is the organization owner. |

### Migration
- `20260206220000_v11_39_self_serve_orgs`: Adds `isActive` and `ownerUserId` columns to the `organizations` table, backfills `ownerUserId` for existing orgs.

## Self-Serve Signup Flow

1. User visits `/signup` and fills in **Workspace Name**, email, and password.
2. API `POST /portal/auth/signup` creates:
   - `Organization` with `createdVia="self_serve"`, `isActive=true`
   - `OrgUser` with `role="owner"`, `emailVerifiedAt=null`
   - Links `Organization.ownerUserId` to the new `OrgUser`
3. Sends verification email (signed link).
4. User verifies email, logs in, immediately has their workspace.
5. Audit log action: `org.self_serve_created` with actor `portal_signup`.

## Admin Org Directory

### API Endpoints (admin auth required)

| Method | Path | Description |
|---|---|---|
| GET | `/internal/orgs/directory` | List all orgs with search, pagination |
| GET | `/internal/orgs/directory/:orgKey` | Full org detail (users, usage, health) |
| POST | `/internal/orgs/:orgKey/deactivate` | Deactivate org (step-up required) |
| POST | `/internal/orgs/:orgKey/reactivate` | Reactivate org (step-up required) |

### List Response Shape
```json
{
  "items": [
    {
      "orgKey": "acme-abc123",
      "displayName": "Acme Corp",
      "isActive": true,
      "createdVia": "self_serve",
      "createdAt": "2026-02-06T...",
      "planKey": "free",
      "billingStatus": "none",
      "trialStatus": "none",
      "ownerEmail": "owner@acme.com",
      "lastWidgetSeenAt": null,
      "usageSummary": { "widgetLoads": 0, "widgetFailures": 0 }
    }
  ],
  "nextCursor": null,
  "total": 1,
  "requestId": "..."
}
```

### Web Pages

- `/dashboard/orgs` — Org directory table (search, filters, click to detail)
- `/dashboard/orgs/[orgKey]` — Org detail with overview, users, widget health, deactivate/reactivate
- `/signup` — Updated workspace name field
- `/portal` — Shows workspace name in overview

## Security

- Admin endpoints require admin cookie session (`requireAdmin`).
- Deactivate/reactivate require step-up MFA (`requireStepUp("admin")`).
- All responses include `requestId`.
- Audit log entries created for org lifecycle events.
- No user enumeration in signup flow (generic success response).

## i18n

Full EN/TR/ES parity for all new strings (nav, org directory, signup workspace).

## How It Matches SaaS Competitors

| Feature | Helvino | Tawk.to | Crisp |
|---|---|---|---|
| Self-serve signup | Yes | Yes | Yes |
| Auto workspace creation | Yes | Yes | Yes |
| Email verification required | Yes | Yes | Yes |
| Admin org directory | Yes | N/A (single-tenant) | Yes |
| Deactivate/reactivate | Yes (step-up) | No | Partial |
