# Step 11.22 — Step-Up Enforcement + Sensitive Actions + Unified Guard

## Overview

Implements a strict, consistent step-up (recent MFA verification) requirement for all sensitive actions across both admin and portal APIs.

## Unified Guard

### `requireStepUp(actor, ttlMinutes?)`

Single middleware factory in `apps/api/src/middleware/require-step-up.ts`.

- `actor`: `"admin"` | `"portal"`
- `ttlMinutes`: defaults to 10

**Behavior:**
1. If user has `mfaEnabled = false` → pass silently (no MFA = no step-up needed)
2. If user has `mfaEnabled = true`:
   - **Admin**: checks `request.session.adminStepUpUntil` timestamp
   - **Portal**: checks `helvino_portal_stepup` cookie validity
3. If step-up is missing/expired → returns:
   ```json
   { "code": "STEP_UP_REQUIRED", "message": "...", "requestId": "..." }
   ```
   with HTTP 403.

## Protected Endpoints

### Admin (Sensitive)
| Endpoint | Method |
|----------|--------|
| `/internal/org/:key/billing` | PATCH |
| `/internal/org/:key/billing/checkout-session` | POST |
| `/internal/org/:key/billing/portal-session` | POST |
| `/internal/org/:key/billing/lock` | POST |
| `/internal/org/:key/billing/unlock` | POST |
| `/internal/org/:key/usage/reset` | POST |
| `/internal/org/:key/usage/grant-quota` | POST |
| `/internal/org/:key/users` | POST |
| `/internal/billing/reconcile` | POST |
| `/internal/security/devices/:id/trust` | PATCH |
| `/internal/security/devices/:id` | DELETE |

### Portal (Sensitive)
| Endpoint | Method |
|----------|--------|
| `/portal/org/me/security` | PATCH |
| `/portal/org/me/rotate-site-id` | POST |
| `/portal/org/users/invite` | POST |
| `/portal/org/users/invite/resend` | POST |
| `/portal/org/users/invite/revoke` | POST |
| `/portal/org/users/role` | POST |
| `/portal/org/users/deactivate` | POST |
| `/portal/auth/change-password` | POST |
| `/portal/auth/sessions/revoke` | POST |
| `/portal/auth/sessions/revoke-all` | POST |
| `/portal/billing/checkout` | POST |
| `/portal/billing/portal` | POST |
| `/portal/billing/portal-session` | POST |
| `/portal/security/devices/:id/trust` | PATCH |
| `/portal/security/devices/:id` | DELETE |

## Web Integration

- `MfaStepUpModal` (existing from 11.20) shows when API returns `STEP_UP_REQUIRED`.
- `apps/web/src/utils/step-up.ts` provides:
  - `isStepUpRequired(data)` — detect the code
  - `adminStepUpChallenge(code)` — call admin challenge endpoint
  - `portalStepUpChallenge(code)` — call portal challenge endpoint

## Non-Breaking

- Read-only endpoints (GET) are NOT gated.
- Non-MFA users pass through silently.
- Widget flows unchanged.
- Login/logout flows unchanged.
