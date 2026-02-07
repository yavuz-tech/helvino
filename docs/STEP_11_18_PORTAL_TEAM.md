# Step 11.18 — Portal User Management (Invites + Roles)

## Overview

Org owners/admins can invite users, manage roles, and deactivate/reactivate team members from the customer portal.

## Data Model

### PortalInvite
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| orgId | string | FK → Organization |
| email | string | Invitee email |
| role | string | "admin" or "agent" |
| tokenHash | string | SHA-256 hash of raw token (unique) |
| expiresAt | DateTime | Default: 7 days from creation |
| acceptedAt | DateTime? | Set when invite is accepted |
| createdAt | DateTime | Auto |
| createdByPortalUserId | string | FK → OrgUser |

### OrgUser (updated)
- `isActive` (Boolean, default true) — can be deactivated by owner/admin
- `lastLoginAt` (DateTime?) — updated on each login

## API Routes

All under `/portal/org/` (portal session cookie required):

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| GET | /portal/org/users | any | List users + pending invites |
| POST | /portal/org/users/invite | owner, admin | Create invite |
| POST | /portal/org/users/invite/resend | owner, admin | Regenerate token + extend expiry |
| POST | /portal/org/users/invite/revoke | owner, admin | Revoke invite (expires immediately) |
| POST | /portal/org/users/role | owner | Change user role |
| POST | /portal/org/users/deactivate | owner, admin | Deactivate/reactivate user |
| POST | /portal/auth/accept-invite | public | Accept invite with token + password |

## Security

- Invite tokens are hashed with SHA-256 before storage; raw tokens are never persisted.
- Token comparison uses constant-time `crypto.timingSafeEqual`.
- Rate limited: 10 requests/minute per IP on invite and accept endpoints.
- All actions are audit-logged with actor email + requestId.
- Deactivated users cannot log in (checked at login time).
- Cannot deactivate the last owner or demote the last owner.
- Admin cannot deactivate an owner.

## Web Pages

- `/portal/team` — Team management dashboard (users table, invite form, pending invites)
- `/portal/accept-invite?token=...` — Public page for accepting invites (set password, auto-login)
- "Team" nav item added to PortalLayout sidebar

## i18n

All strings use `t()` with `team.*` translation keys in EN/TR/ES. No hardcoded text.

## Invite Flow (Dev)

1. Owner/admin sends invite from `/portal/team`
2. In dev mode, the invite link is returned and shown in the UI
3. Invitee opens `/portal/accept-invite?token=...`
4. Sets password → account created → auto-logged in → redirected to `/portal`

In production, the invite link is hidden (email integration required).

## Verification

```bash
bash VERIFY_STEP_11_18.sh
bash VERIFY_ALL.sh
```
