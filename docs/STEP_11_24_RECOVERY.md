# Step 11.24 — Account Recovery + Emergency Access

## Overview
Enterprise-grade account recovery and emergency access flows for both admin and portal users.

## Features

### A) Account Recovery
- **Portal users**: Submit recovery request at `/portal/recovery`
- **Admin users**: Submit recovery request at `/admin/recovery/request`
- **Internal admin**: Review/approve/reject at `/dashboard/recovery` or API

#### Rules
- Recovery requests expire after 48 hours
- Max 3 requests per day per user
- Cannot bypass billing lock
- Recovery does NOT auto-disable MFA (unless MFA lockout detected)
- Recovery creates temporary session (15 min)
- Step-up required immediately after recovery login
- All actions audit logged

### B) MFA Lockout Safety
When a user has MFA enabled but:
- No valid backup codes remaining
- All trusted devices revoked

The system detects this as a lockout. When an admin approves recovery for a locked-out user, MFA is automatically reset.

Lockout check endpoints:
- `POST /portal/auth/mfa-lockout-check`
- `POST /internal/auth/mfa-lockout-check`

### C) Emergency Access (Break-Glass)
Only org owners can generate emergency access tokens.

- One-time use, 10-minute expiry
- Requires MFA + step-up to generate
- 30-day cooldown between generations
- Using the token: disables MFA, forces password reset

Emergency endpoints:
- `POST /portal/emergency/generate` (requires portal auth + step-up)
- `POST /portal/emergency/use` (public, rate-limited)

### D) UI Pages
- `/portal/recovery` — Submit recovery request + use emergency token
- `/dashboard/recovery` — Admin: review/approve/reject requests

### E) Security
- Rate limits on all recovery endpoints
- IP + user agent logging
- Generic responses to prevent user enumeration
- Inactive accounts cannot request recovery
- Email mismatch check on recovery
- No Stripe interaction (webhook-safe)

## Database Models

### AccountRecoveryRequest
| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| userType | String | "admin" or "portal" |
| userId | String | User ID |
| email | String | User email |
| reason | String | Recovery reason |
| status | String | pending/approved/rejected/expired |
| requestedAt | DateTime | When requested |
| expiresAt | DateTime | When it expires |
| resolvedAt | DateTime? | When resolved |
| resolvedBy | String? | Admin who resolved |
| ip | String? | Request IP |
| userAgent | String? | Request user agent |

### EmergencyAccessToken
| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| userId | String | Owner user ID |
| userType | String | "admin" or "portal" |
| tokenHash | String | SHA-256 hash of token |
| expiresAt | DateTime | 10-minute expiry |
| usedAt | DateTime? | When used |
| createdAt | DateTime | Creation time |
| cooldownUntil | DateTime | No regen until this |

## Audit Log Actions
- `recovery.requested`
- `recovery.approved`
- `recovery.rejected`
- `emergency.token_generated`
- `emergency.token_used`

## Verification
Run `bash VERIFY_STEP_11_24.sh` to verify all checks pass.
