# Step 11.29 — Rate Limiting + Abuse Controls + Auth Hardening

## Overview

Production-grade rate limiting with consistent error envelopes, audit logging, and UX-friendly 429 handling across admin/portal/widget flows.

## Architecture

### Rate Limit Middleware (`middleware/rate-limit.ts`)

- Redis-based sliding window (per-key counters with TTL)
- Fails open if Redis is unavailable (request allowed)
- Consistent 429 error envelope
- Audit logs throttled events
- Dev multiplier from `RATE_LIMIT_DEV_MULTIPLIER`

### Rate Limit Presets (`utils/rate-limit.ts`)

Higher-level convenience functions with built-in key strategies:

| Preset | Limit | Window | Key Strategy |
|--------|-------|--------|-------------|
| `loginRateLimit` | 10/min | 60s | Per IP |
| `forgotPasswordRateLimit` | 5/min | 60s | Per IP |
| `resetPasswordRateLimit` | 5/min | 60s | Per IP |
| `mfaRateLimit` | 10/min | 60s | Per IP+User |
| `webauthnRateLimit` | 20/min | 60s | Per IP |
| `inviteRateLimit` | 30/hr | 3600s | Per Org |
| `recoveryRequestRateLimit` | 3/day | 86400s | Per User |
| `emergencyRateLimit` | 5/hr | 3600s | Per IP+User |
| `changePasswordRateLimit` | 5/min | 60s | Per IP |

## Error Envelope (429)

All rate-limited responses follow this format:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 42 seconds.",
    "retryAfterSec": 42,
    "requestId": "abc-123"
  }
}
```

Headers included:
- `Retry-After: <seconds>`
- `X-RateLimit-Limit: <max>`
- `X-RateLimit-Remaining: <remaining>`
- `X-RateLimit-Reset: <ISO timestamp>`
- `X-Request-Id: <correlation ID>`

## Audit Logging

Rate-limited events are logged via `writeAuditLog`:
- Action: `security.rate_limited`
- Details: `{ route, key, retryAfterSec, ip }`
- Includes `requestId` for correlation

## UX Handling

### Web (`apps/web`)

- `parseApiError()` detects 429 + `RATE_LIMITED`, extracts `retryAfterSec`
- Login pages (admin + portal) show i18n-friendly "Too many attempts" messages
- Forgot-password page shows rate limit warning with retry countdown
- ErrorBanner displays the message with requestId

### i18n Keys

| Key | EN | TR | ES |
|-----|----|----|-----|
| `rateLimit.title` | Too many attempts | Çok fazla deneme | Demasiados intentos |
| `rateLimit.message` | You've made too many requests... | ...saniye sonra tekrar deneyin... | Has realizado demasiadas solicitudes... |
| `rateLimit.tryAgain` | Try again later | Daha sonra tekrar deneyin | Inténtalo más tarde |

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_DEV_MULTIPLIER` | No | `3` | Multiplies all rate limits in dev mode |
| `REDIS_URL` | No | — | Redis connection for distributed rate limiting |

## Security Notes

- Rate limits are per-IP by default, preventing brute-force attacks
- Authenticated internal admin sessions bypass rate limits (intentional)
- Auth endpoints use timing-safe patterns (no user enumeration via rate limit behavior)
- Recovery endpoints have daily limits to prevent abuse
- All counters reset with the window (no permanent blacklisting)
- Audit trail for all rate-limited events enables incident investigation
