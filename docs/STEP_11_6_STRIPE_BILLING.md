# Step 11.6 — Stripe Billing Foundation

## Overview
Adds a Stripe-backed billing foundation with:
- Billing fields on `Organization`
- Webhook sync to keep billing status current
- Admin + portal billing endpoints
- Optional write enforcement (off by default)

## Env Vars (API)
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_STARTER=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
```

## API Endpoints
### Webhook
- `POST /stripe/webhook` (Stripe signature required)

### Admin (session auth)
- `GET /internal/org/:key/billing`
- `PATCH /internal/org/:key/billing`
- `POST /internal/org/:key/billing/checkout-session`
- `POST /internal/org/:key/billing/portal-session`

### Portal (session auth)
- `GET /portal/org/billing`
- `POST /portal/org/billing/portal-session`

## Enforcement
If `billingEnforced=true` and status is not `active|trialing`, writes are blocked
after `billingGraceDays` past `currentPeriodEnd` (or `lastStripeEventAt`).

## UI
- Admin: Billing section under `/dashboard/settings`
- Portal: Billing page at `/portal/billing`
