# Step 11.19 — Portal Session Security + Password Recovery

## Overview
Adds production-grade session management and password recovery to the customer portal.

## Data Model
- **PasswordResetToken**: `id`, `orgUserId`, `hashedToken` (unique), `expiresAt`, `usedAt?`, `createdAt`
- **PortalSession**: `id`, `orgUserId`, `tokenHash` (unique), `createdAt`, `lastSeenAt`, `revokedAt?`, `ip?`, `userAgent?`

## API Endpoints

### Password Reset (Public)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/portal/auth/forgot-password` | Request password reset (generic response) |
| POST | `/portal/auth/reset-password` | Reset password with token + newPassword |

### Session Management (Authenticated)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/portal/auth/change-password` | Change password (requires current password) |
| GET | `/portal/auth/sessions` | List active sessions |
| POST | `/portal/auth/sessions/revoke` | Revoke specific session |
| POST | `/portal/auth/sessions/revoke-all` | Revoke all sessions except current |

## Security
- Reset tokens are SHA-256 hashed before storage (never stored raw)
- Tokens expire after 30 minutes and are single-use
- Generic responses prevent user enumeration
- Rate limiting: 5/min per IP on forgot-password, reset-password
- Password change revokes all other sessions
- Password reset via token revokes ALL sessions, creates fresh session
- Session revocation checked on every authenticated request
- `lastSeenAt` updated on each request (best-effort)

## Audit Log Actions
- `portal_password_reset_requested`
- `portal_password_reset_completed`
- `portal_password_changed`
- `portal_session_revoked`
- `portal_sessions_revoked_all`

## Web Pages
- `/portal/forgot-password` — Email form to request reset
- `/portal/reset-password?token=...` — Set new password with token
- `/portal/security` — Updated with Change Password + Active Sessions sections
- `/portal/login` — Added "Forgot password?" link

## Dev Mode
When `NODE_ENV !== "production"`, the forgot-password endpoint includes the reset link in the JSON response for testing without email delivery.

## i18n
All new strings have EN/TR/ES parity under `security.*` keys.
