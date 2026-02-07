# Step 11.21 — MFA Policy + Risk-Based Step-Up + Device/Session Audit

## Overview

Extends MFA with configurable policy enforcement, device tracking, and trusted device management for both admin and portal users.

## Features

### 1. MFA Policy (Configurable)

Environment variables:
- `ADMIN_MFA_REQUIRED` — `true`/`false` (default: `true` in production, `false` in dev)
- `PORTAL_MFA_RECOMMENDED` — `true`/`false` (default: `true`)

**Admin**: When `ADMIN_MFA_REQUIRED=true` and admin user has `mfaEnabled=false`, a blocking overlay prevents access to `/dashboard/*` with a CTA to enable MFA.

**Portal**: When `PORTAL_MFA_RECOMMENDED=true` and portal user has `mfaEnabled=false`, a dismissible banner encourages enabling MFA. Does not block access.

### 2. Device Tracking

New `TrustedDevice` model stores:
- `id`, `userId`, `userType` (portal/admin)
- `userAgentHash` (SHA-256 of UA, truncated to 32 chars)
- `label` (optional, user-assigned)
- `trusted` (boolean)
- `firstSeenAt`, `lastSeenAt`, `lastIp`
- `userAgentRaw` (truncated for display)

Devices are upserted on every successful login (including MFA login-verify).

### 3. API Endpoints

#### Admin Devices
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/internal/security/devices` | Admin | List devices |
| PATCH | `/internal/security/devices/:id/trust` | Admin | Trust/untrust |
| PATCH | `/internal/security/devices/:id/label` | Admin | Rename label |
| DELETE | `/internal/security/devices/:id` | Admin | Remove device |
| GET | `/internal/security/mfa-policy` | Admin | Get MFA policy |

#### Portal Devices
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/portal/security/devices` | Portal | List devices |
| PATCH | `/portal/security/devices/:id/trust` | Portal | Trust/untrust |
| PATCH | `/portal/security/devices/:id/label` | Portal | Rename label |
| DELETE | `/portal/security/devices/:id` | Portal | Remove device |
| GET | `/portal/security/mfa-policy` | Portal | Get MFA policy |

### 4. Web UI

- `/dashboard/security/devices` — Admin device management
- `/portal/security/devices` — Portal device management
- `MfaPolicyBanner` — Reusable component (blocking for admin, non-blocking for portal)
- `DeviceList` — Reusable device list with trust/rename/remove actions

### 5. Audit Log Actions

- `device_trusted`, `device_untrusted`, `device_renamed`, `device_removed`

### 6. i18n

All new strings under `mfaPolicy.*` and `devices.*` keys with EN/TR/ES parity.

## Security Notes

- Device records use hashed user-agent for fingerprinting
- No secrets stored in device records
- All device management endpoints are rate-limited
- Audit logs include `requestId` for traceability
