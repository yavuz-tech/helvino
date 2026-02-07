# Step 11.20 — MFA (TOTP) + Step-Up Security

## Overview

Adds two-factor authentication (TOTP) to both admin (`/dashboard`) and portal (`/portal`) users, with a step-up challenge flow for sensitive actions.

## Data Model Changes

### AdminUser
- `mfaEnabled` (Boolean, default false)
- `mfaSecret` (String?, encrypted TOTP secret)
- `mfaVerifiedAt` (DateTime?)
- `backupCodesHash` (String?, JSON array of SHA-256 hashed backup codes)

### OrgUser
- Same fields as AdminUser above

## API Endpoints

### Portal MFA
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/portal/security/mfa/setup` | Portal user | Start MFA setup, returns otpauth URI + backup codes |
| POST | `/portal/security/mfa/verify` | Portal user | Verify TOTP code to enable MFA |
| POST | `/portal/security/mfa/disable` | Portal user | Disable MFA with code/backup |
| GET | `/portal/security/mfa/status` | Portal user | Get current MFA status |
| POST | `/portal/auth/mfa/challenge` | Portal user | Step-up challenge (10 min validity) |
| POST | `/portal/auth/mfa/login-verify` | Public | Complete login when MFA required |

### Admin MFA
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/internal/security/mfa/setup` | Admin | Start MFA setup |
| POST | `/internal/security/mfa/verify` | Admin | Verify TOTP code to enable MFA |
| POST | `/internal/security/mfa/disable` | Admin | Disable MFA |
| GET | `/internal/security/mfa/status` | Admin | Get MFA status |
| POST | `/internal/auth/mfa/challenge` | Admin | Step-up challenge |
| POST | `/internal/auth/mfa/login-verify` | Session (partial) | Complete login after MFA |

## Login Flow

1. User submits email + password
2. If `mfaEnabled` is true, API returns `{ ok: false, mfaRequired: true }` (portal also gets `mfaToken`)
3. Frontend shows MFA code input
4. User enters TOTP code or backup code
5. Frontend calls `mfa/login-verify` endpoint
6. On success, full session is established

## Step-Up Security

Sensitive actions (billing, invite management, security settings) can require MFA step-up verification when the user has MFA enabled.

- Portal: Uses a short-lived signed cookie (`helvino_portal_stepup`, 10 min)
- Admin: Uses session property (`adminStepUpUntil` timestamp)

## Backup Codes

- 8 codes generated in format `XXXX-XXXX`
- Only shown once during setup
- Stored as SHA-256 hashes
- Each code is single-use (removed after consumption)

## Audit Log Actions

- `mfa_setup_started`
- `mfa_enabled`
- `mfa_disabled`
- `mfa_challenge_passed`
- `mfa_challenge_failed`

## Web UI

- Portal: `/portal/security` page updated with MFA setup section
- Portal: `/portal/login` updated with MFA verification step
- Admin: `/dashboard/settings` updated with MFA setup section
- Admin: `/login` updated with MFA verification step

## i18n

All strings use `t()` function with EN/TR/ES parity under `mfa.*` keys.

## Dependencies

- `otpauth` v9.x — RFC 6238 TOTP implementation
