# Step 11.14 — Production Readiness Hardening

## Overview

Makes Helvino safer for production deployment without changing core flows. No UI redesign, no schema changes, no new features — only guards, consistency, and verification.

## Environment Requirements

### Required (API will not start / preflight fails)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Cookie signing secret (>=32 chars recommended in production) |

### Optional (features degrade gracefully)

| Variable | Purpose | Missing Behavior |
|----------|---------|------------------|
| `STRIPE_SECRET_KEY` | Stripe API key | Billing endpoints return 501 |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Webhook returns 501 on calls |
| `REDIS_URL` | Redis for sessions + rate limiting | Falls back to in-memory |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin seed credentials | Admin user not seeded |
| `ORG_OWNER_EMAIL` / `ORG_OWNER_PASSWORD` | Portal user seed | Portal user not seeded |
| `NEXT_PUBLIC_API_URL` | API base URL for web frontend | Defaults to `http://localhost:4000` |

### Production Cookie/Security Checks

When `NODE_ENV=production`, the preflight script additionally checks:
- `SESSION_SECRET` length >= 32 characters
- `STRIPE_SECRET_KEY` presence (warns if missing)
- `STRIPE_WEBHOOK_SECRET` presence when Stripe key is set

## Failure Modes

### Stripe Not Configured

All billing action endpoints return **501** with a consistent payload:

```json
{
  "error": "Stripe is not configured on this server.",
  "code": "STRIPE_NOT_CONFIGURED"
}
```

Affected endpoints:
- `POST /portal/billing/checkout` — 501
- `POST /portal/billing/portal` — 501
- `POST /portal/billing/portal-session` — 501
- `POST /portal/org/billing/portal-session` — 501
- `GET /portal/billing/invoices` — 501

Read-only endpoints (`GET /portal/billing/status`, `GET /portal/billing/lock-status`) still work and return `stripeConfigured: false`.

### Webhook Secret Missing

- `POST /webhooks/stripe` and `POST /stripe/webhook` return **501** with `STRIPE_NOT_CONFIGURED` code
- Distinguished from invalid signatures which return **400**

### Missing Stripe Signature

- `POST /webhooks/stripe` without `stripe-signature` header returns **400** `"Missing signature"`

## Preflight Script

```bash
bash scripts/preflight.sh
```

- Checks all required and optional vars
- Never prints secret values
- Exits 1 if any required var is missing
- Exits 0 with warnings for optional missing vars
- In production mode: checks session secret strength and Stripe configuration

## Verification

```bash
bash VERIFY_STEP_11_14.sh
```

Tests:
- Preflight script exists and exits 0
- Documentation exists
- Webhook distinguishes StripeNotConfiguredError (501) vs bad signature (400)
- Portal billing uses 501 consistently
- Login pages return 200
- Billing endpoints require auth (401/403)
- Admin endpoints require auth (401/403)
- Webhook rejects missing/bad signatures

## Running in CI

```bash
bash VERIFY_CI.sh
# Runs: preflight -> API build -> Web build -> VERIFY_ALL (includes 11.14)
```
