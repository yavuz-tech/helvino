# Step 11.28 — Host Trust + Canonical URLs + Security Headers

## Overview

Production hardening step that adds:

1. **Trusted host enforcement** — prevents Host header injection attacks
2. **Security headers** — CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
3. **Cookie policy audit** — confirmed all cookies use Secure/HttpOnly/SameSite correctly
4. **Canonical URL resolution** — `APP_PUBLIC_URL` used as canonical base for links

## Trusted Host Enforcement

### How It Works

- API plugin (`middleware/host-trust.ts`) checks the `Host` header on every incoming request
- If the host is not in the trusted list, the request is rejected with `400 UNTRUSTED_HOST`
- In development (NODE_ENV != production), localhost variants are auto-trusted

### Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRUSTED_HOSTS` | No | — | Comma-separated list of trusted Host header values (e.g., `api.helvino.com,helvino.com`) |
| `APP_PUBLIC_URL` | No | `NEXT_PUBLIC_WEB_URL` / `http://localhost:3000` | Canonical public URL; its host is auto-trusted |

### Dev Defaults

In non-production mode, these hosts are automatically trusted:
- `localhost`, `localhost:3000`, `localhost:4000`
- `127.0.0.1`, `127.0.0.1:3000`, `127.0.0.1:4000`
- `0.0.0.0`, `0.0.0.0:PORT`

## Security Headers

### API (Fastify)

Applied via `middleware/security-headers.ts` plugin (onSend hook):

| Header | Value | Notes |
|--------|-------|-------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-Frame-Options` | `DENY` | API responses never framed |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), ...` | Restrictive |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | API returns only JSON |
| `X-Request-Id` | `{requestId}` | Correlation ID |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Production only |

### Web (Next.js)

Applied via `src/middleware.ts`:

**Admin/Portal pages** (`/dashboard/*`, `/portal/*`, `/login`):
- `X-Frame-Options: DENY` — deny framing
- `Content-Security-Policy` with `frame-ancestors 'none'`

**Public/widget pages** (everything else):
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy` with `frame-ancestors *` — allows widget embedding

**Universal** (all pages):
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), ...`

## Cookie Policy Audit

All cookies confirmed to have:
- `httpOnly: true` — no JavaScript access
- `sameSite: "lax"` — CSRF protection
- `secure: isProduction` — HTTPS-only in production
- `path: "/"` — available everywhere

Cookies audited:
- Admin session (`@fastify/session` — `connect.sid`)
- Portal session (`helvino_portal_sid`)
- Portal step-up (`helvino_portal_stepup`)
- Language preference (`helvino_lang`) — not HttpOnly (client-read needed), ok

## Security Notes

- Host trust prevents Host header poisoning in password reset emails and signed links
- CSP `frame-ancestors 'none'` on admin/portal prevents clickjacking
- Widget pages allow framing to support embedded chat widget
- No behavior regressions: all existing auth/billing/widget flows unchanged

## Verification

```bash
bash VERIFY_STEP_11_28.sh
```
