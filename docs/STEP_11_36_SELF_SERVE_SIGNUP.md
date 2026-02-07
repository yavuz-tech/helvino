# Step 11.36 — Self-Serve Signup + Email Verification + Auto Org Provisioning

## Overview

Enables "Crisp/Tawk.to style" self-serve onboarding:
- A customer can sign up at `/signup` without admin intervention
- System auto-creates an Organization + Owner user
- Email verification is required before portal login

## Data Model Changes

| Field | Model | Type | Purpose |
|-------|-------|------|---------|
| `emailVerifiedAt` | OrgUser | DateTime? | null = unverified |
| `createdVia` | Organization | String | "admin" \| "self_serve" |

Existing users are backfilled as verified (migration sets `emailVerifiedAt = createdAt`).

## API Endpoints

### POST /portal/auth/signup
- Body: `{ orgName, email, password, locale? }`
- Creates Organization (createdVia="self_serve") + OrgUser (role=owner)
- Sends verification email via signed-link system
- Returns generic 200 to avoid user enumeration
- Rate-limited: 5/min per IP+email

### POST /portal/auth/resend-verification
- Body: `{ email, locale? }`
- Always returns generic 200
- Sends email only if user exists + not verified
- Rate-limited: 3/min per IP+email

### GET /portal/auth/verify-email
- Query: `?token=<email>&expires=<ms>&sig=<hmac>`
- Verifies HMAC signature + expiry
- Sets `emailVerifiedAt = now()` (idempotent)
- Returns 400 with LINK_EXPIRED / INVALID_LINK codes
- Rate-limited: 10/min per IP

## Portal Login Enforcement

If `emailVerifiedAt` is null, login returns:
```json
{
  "error": {
    "code": "EMAIL_VERIFICATION_REQUIRED",
    "message": "Please verify your email address before logging in.",
    "requestId": "..."
  }
}
```
HTTP 403.

## Web Pages

| Route | Purpose |
|-------|---------|
| `/signup` | Public signup form (PublicLayout) |
| `/portal/verify-email` | Verification landing page |
| Portal login page | Shows verification-required state with resend button |

## Security Properties

- **No user enumeration**: signup + resend always return generic 200
- **Rate limiting**: per-IP + per-email on all auth endpoints
- **Signed links**: HMAC-SHA256 with timing-safe comparison
- **Token = email**: verification links carry email as token, not a random string (since the operation is idempotent and the link expires)
- **Audit logging**: portal.signup, portal.email_verification_sent, portal.email_verified
- **requestId propagation**: all responses include requestId

## i18n

All UI strings use i18n keys with EN/TR/ES parity. No hardcoded strings.

## Email Template

Uses existing mailer infrastructure. In DEV mode, emails are printed to console. Subjects and body copy available in EN/TR/ES.
