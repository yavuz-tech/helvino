# Step 11.4 — Customer Portal (Tenant Dashboard) MVP

## Goal
- Provide a **Customer Portal** for org owners/admins under `/portal/*`
- Keep internal admin dashboard at `/dashboard/*` unchanged
- Ensure strict org scoping (no cross-org access)

## Acceptance Criteria
- `/dashboard` works exactly as before (admin session)
- `/portal/login` authenticates portal users (cookie: `helvino_portal_sid`)
- Portal pages use **only** `/portal/*` API endpoints
- Portal users can only access their own org data
- Domain allowlist + siteId rotation work in portal
- Widget flow unchanged (siteId/orgKey → bootloader → orgToken)

## API Endpoints (Portal)

### Auth (Customer Portal)
- `POST /portal/auth/login`
  - Body: `{ email, password }`
  - Sets cookie `helvino_portal_sid` (HttpOnly, SameSite=Lax, Secure in prod)
  - Rate limit: 10/min per IP
- `POST /portal/auth/logout`
- `GET /portal/auth/me`

### Org (Scoped by Portal Session)
- `GET /portal/org/me`
  - Returns org details, kill switches, retention
- `PATCH /portal/org/me/settings`
  - Owner/Admin only
  - Fields: `widgetEnabled`, `writeEnabled`, `aiEnabled`,
    `messageRetentionDays`, `hardDeleteOnRetention`
- `GET /portal/org/me/security`
  - Returns `siteId`, `allowedDomains`, `allowLocalhost`
- `PATCH /portal/org/me/security`
  - Owner/Admin only
  - Fields: `allowedDomains`, `allowLocalhost`
- `POST /portal/org/me/rotate-site-id`
  - Owner only
  - Requires `{ confirm: "ROTATE" }`

### Conversations (Read-only)
- `GET /portal/conversations`
- `GET /portal/conversations/:id`

### Internal Onboarding (Admin only)
- `POST /internal/org/:key/users`
  - Body: `{ email, role?, password? }`
  - Role defaults to `owner`
  - Returns `tempPassword` if no password supplied

## Web Routes (Customer Portal)
- `/portal/login` — login screen
- `/portal` — overview (org info + embed snippet)
- `/portal/inbox` — read-only conversations
- `/portal/settings` — kill switches + retention
- `/portal/security` — domains + localhost + rotate siteId

## Env Vars
- `SESSION_SECRET` (required) — used for portal cookie signing
- `DATABASE_URL` (required)

## Onboarding Flow
1. Internal admin creates org (`/dashboard/orgs/new`)
2. Internal admin creates portal user:
   - `POST /internal/org/:key/users`
3. Customer logs in at `/portal/login`
4. Customer manages org settings/security and uses embed snippet

## Notes
- Portal auth is **separate** from internal admin (cookie: `helvino_portal_sid`)
- Portal cannot access any `/internal/*` endpoints
- Portal is strictly org-scoped via session orgId
