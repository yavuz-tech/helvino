# Step 11.5 — Stripe Billing + Entitlements (Operational)

## What changed
- Added billing metadata to `Organization` (Stripe IDs, plan key/status)
- Added `Plan` and `Usage` models
- Added portal billing endpoints
- Added Stripe checkout + portal session utilities
- Enforced entitlements on write endpoints

## Env vars
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
```

If missing, portal shows **“Billing not configured”** and endpoints return 400.

## Endpoints (Portal)
- `GET /portal/billing`
- `POST /portal/billing/checkout` { planKey, returnUrl }
- `POST /portal/billing/portal` { returnUrl }

## Webhook
- `POST /webhooks/stripe` (raw body)
- Handles:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`

## Entitlement enforcement
