# STEP 11.40 — Minimal Password Policy

## Policy
All password creation/change endpoints enforce the same minimal policy:

| Rule | Value |
|------|-------|
| Minimum length | 8 characters |
| Must include letter | At least 1 letter (a-z, A-Z) |
| Must include digit | At least 1 digit (0-9) |
| Uppercase required | No |
| Special character required | No |

## Implementation

### Shared Validator
`apps/api/src/utils/password-policy.ts` exports `validatePasswordPolicy(password)`:
- Returns `{ valid: true }` on success
- Returns `{ valid: false, code: "WEAK_PASSWORD", message: "..." }` on failure

### Endpoints Using It
| Endpoint | File |
|----------|------|
| `POST /portal/auth/signup` | `portal-signup.ts` |
| `POST /portal/auth/reset-password` | `portal-security.ts` |
| `POST /portal/auth/change-password` | `portal-security.ts` |

### Error Response
On weak password, API returns HTTP 400:
```json
{
  "error": {
    "code": "WEAK_PASSWORD",
    "message": "Password must include at least one number",
    "requestId": "..."
  }
}
```

## Web UX
- A single inline hint appears under every password field:
  - EN: "Password must be at least 8 characters and include a letter and a number."
  - TR: "Sifre en az 8 karakter olmali ve bir harf ile bir rakam icermelidir."
  - ES: "La contrasena debe tener al menos 8 caracteres e incluir una letra y un numero."
- Client-side validation mirrors the server policy (no unnecessary round-trips).
- On `WEAK_PASSWORD` server error, the server message is displayed via `ErrorBanner`.
