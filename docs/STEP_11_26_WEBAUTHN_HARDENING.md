# Step 11.26 — WebAuthn Production Hardening

## Overview

Step 11.26 hardens the passkey (WebAuthn) implementation introduced in 11.25 for production readiness:

1. **DB-backed challenge store** — Challenges are now stored in a Prisma-backed `WebAuthnChallenge` table instead of an in-memory TTL map. This ensures:
   - Single-use enforcement (server-side `usedAt` flag)
   - Expiry enforcement (5 minutes TTL via `expiresAt`)
   - Audit metadata capture (IP, User-Agent per challenge)
   - Multi-instance safety (no shared memory required between API replicas)

2. **Preflight env validation** — `scripts/preflight.sh` now validates `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, and `WEBAUTHN_RP_NAME`:
   - In development: shows "not configured (defaults used)" without failing
   - In production (NODE_ENV=production): `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` are **required** (exit 1 if missing)
   - `WEBAUTHN_RP_NAME` is optional (defaults to "Helvino")

3. **Lifecycle management** — New endpoints and UI for:
   - **Revoke all passkeys** (portal + admin, step-up required)
   - **Revoke all sessions** (portal + admin, step-up required)
   - Full audit logging with `requestId` for all revocation actions

## Data Model

### WebAuthnChallenge

| Field      | Type      | Description                              |
|------------|-----------|------------------------------------------|
| id         | String    | CUID primary key                        |
| userType   | String    | "admin" or "portal"                     |
| userId     | String?   | User ID (null for dummy/anti-enum)      |
| challenge  | String    | Unique base64url challenge string       |
| expiresAt  | DateTime  | When the challenge expires              |
| usedAt     | DateTime? | When consumed (single-use enforcement)  |
| createdAt  | DateTime  | Creation timestamp                      |
| ip         | String?   | Client IP at challenge creation         |
| userAgent  | String?   | Client UA at challenge creation         |

## New API Endpoints

### Portal
- `POST /portal/webauthn/credentials/revoke-all` — Revoke all passkeys (step-up required)
- `POST /portal/webauthn/sessions/revoke-all` — Revoke all other portal sessions (step-up required)

### Admin
- `POST /admin/webauthn/credentials/revoke-all` — Revoke all passkeys (step-up required)
- `POST /admin/webauthn/sessions/revoke-all` — Revoke all admin WebAuthn challenges (step-up required)

## Audit Log Actions

- `webauthn.revoked_all` — All passkeys removed
- `webauthn.sessions_revoked_all` — All sessions revoked

## Security Notes

- Challenges are **never** reusable (single-use via `usedAt` flag)
- Expired challenges are lazily cleaned up on each new challenge creation
- Dummy challenges for anti-enumeration are generated in-memory (no DB write)
- IP and User-Agent are truncated before storage (45 / 256 chars)
- No secrets or key material is logged

## Environment Variables

| Variable           | Required (prod) | Default      | Description                |
|--------------------|-----------------|--------------|----------------------------|
| WEBAUTHN_RP_ID     | Yes             | localhost    | Relying Party ID (domain)  |
| WEBAUTHN_ORIGIN    | Yes             | http://localhost:3000 | Expected origin  |
| WEBAUTHN_RP_NAME   | No              | Helvino      | Display name in prompts    |

## Verification

```bash
bash VERIFY_STEP_11_26.sh
```
