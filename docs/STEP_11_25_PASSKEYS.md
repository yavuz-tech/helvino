# Step 11.25 — Passkeys (WebAuthn)

## Overview
Adds WebAuthn/Passkey support for both Admin and Portal authentication. Users can register hardware keys, Touch ID, Face ID, or Windows Hello as passwordless login methods.

## Data Model

### WebAuthnCredential
| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| userType | String | "admin" or "portal" |
| userId | String | Reference to AdminUser or OrgUser |
| credentialId | String | Unique base64url-encoded credential ID |
| publicKey | String | base64url DER-encoded SubjectPublicKeyInfo |
| counter | Int | Signature counter (anti-replay) |
| transports | String? | JSON array of supported transports |
| aaguid | String? | Authenticator attestation GUID |
| nickname | String? | User-provided name (e.g. "MacBook Pro") |
| createdAt | DateTime | Registration time |
| lastUsedAt | DateTime | Last authentication time |

## API Routes

### Portal
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /portal/webauthn/register/options | Portal + Step-up | Get registration challenge |
| POST | /portal/webauthn/register/verify | Portal + Step-up | Verify registration |
| POST | /portal/webauthn/login/options | Public (rate-limited) | Get login challenge |
| POST | /portal/webauthn/login/verify | Public (rate-limited) | Verify login |
| GET | /portal/webauthn/credentials | Portal | List passkeys |
| POST | /portal/webauthn/credentials/:id/revoke | Portal + Step-up | Remove passkey |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/webauthn/register/options | Admin + Step-up | Get registration challenge |
| POST | /admin/webauthn/register/verify | Admin + Step-up | Verify registration |
| POST | /admin/webauthn/login/options | Public (rate-limited) | Get login challenge |
| POST | /admin/webauthn/login/verify | Public (rate-limited) | Verify login |
| GET | /admin/webauthn/credentials | Admin | List passkeys |
| POST | /admin/webauthn/credentials/:id/revoke | Admin + Step-up | Remove passkey |

## Security

### Registration
- Requires step-up MFA verification
- Attestation verified server-side
- Challenge expires after 5 minutes
- Existing credentials excluded to prevent duplicates

### Login
- Passkey login = strong authentication (skips TOTP)
- Counter checked to detect cloned authenticators
- Challenge consumed on use (single-use)
- Rate-limited (10 attempts/min)
- No user enumeration (dummy challenge for unknown emails)

### General
- Keys stored as DER-encoded SubjectPublicKeyInfo (standard format)
- Raw keys never logged
- All operations audit logged with requestId
- Supports ES256 (P-256) and RS256 algorithms

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| WEBAUTHN_RP_NAME | "Helvino" | Relying party display name |
| WEBAUTHN_RP_ID | "localhost" | Relying party ID (domain) |
| WEBAUTHN_ORIGIN | "http://localhost:3000" | Expected origin |

## UI

### Security Pages (Portal + Admin)
- "Passkeys" section with:
  - List of registered passkeys (nickname, created, last used)
  - "Add passkey" button with nickname input
  - "Remove" action per passkey (requires step-up)

### Login Pages (Portal + Admin)
- "Sign in with passkey" button below password form
- Passkey login creates full session (no TOTP required)
- TOTP login flow preserved as fallback

## i18n
All strings use `t()` with keys under `passkeys.*` prefix.
Full parity across EN, TR, ES locales.

## Audit Log Actions
- `webauthn.registered` — Passkey registered
- `webauthn.login` — Passkey login
- `webauthn.revoked` — Passkey removed
