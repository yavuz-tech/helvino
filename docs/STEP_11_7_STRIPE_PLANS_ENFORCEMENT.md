# Step 11.7 — Stripe Plans + Entitlements Enforcement

## Overview

Makes Stripe billing production-usable:
- **Plan model** with `stripePriceId` for automatic plan mapping from Stripe events.
- **Entitlement enforcement** blocks writes when plan limits exceeded or subscription inactive.
- **Webhook idempotency** via `lastStripeEventId` — duplicate events are ignored.
- **Portal billing page** shows plan info, usage bars, available plans, and upgrade flow.

## Schema Changes

### Plan model
| Field | Type | Description |
|---|---|---|
| `stripePriceId` | `String? @unique` | Maps Stripe Price ID → plan key |

### Organization
| Field | Type | Description |
|---|---|---|
| `lastStripeEventId` | `String?` | Last processed webhook event ID (idempotency) |
| `trialEndsAt` | `DateTime?` | Trial end date from Stripe |

## Env Vars

```
STRIPE_SECRET_KEY=        # Required for Stripe
STRIPE_WEBHOOK_SECRET=    # Required for webhook verification
STRIPE_PRICE_PRO=         # Stripe Price ID for Pro plan
STRIPE_PRICE_BUSINESS=    # Stripe Price ID for Business plan
STRIPE_PRICE_ID_STARTER=  # Fallback Price ID
STRIPE_SUCCESS_URL=       # Checkout success redirect
STRIPE_CANCEL_URL=        # Checkout cancel redirect
```

## API Endpoints

### Portal Billing (require portal auth)
| Method | Route | Description |
|---|---|---|
| `GET` | `/portal/billing/status` | Plan + limits + usage + subscription + available plans |
| `POST` | `/portal/billing/checkout` | Create Stripe Checkout Session (`{planKey?, returnUrl?}`) |
| `POST` | `/portal/billing/portal` | Create Stripe Customer Portal session |

### Webhook
| Method | Route | Description |
|---|---|---|
| `POST` | `/stripe/webhook` | Stripe webhook (signature required) |
| `POST` | `/webhooks/stripe` | Alias |

**Handled events:** `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`

### Idempotency
Each webhook event's `id` is stored in `Organization.lastStripeEventId`. If the same event ID arrives again, it is skipped silently.

## Entitlement Enforcement

Write endpoints (`POST /conversations`, `POST /conversations/:id/messages`) check:
1. **Kill switch** (`writeEnabled=false`) → 403
2. **Billing enforcement** (`billingEnforced=true` + status not active/trialing + grace expired) → 402
3. **Subscription status** (paid plans: must be active/trialing) → 402 `SUBSCRIPTION_INACTIVE`
4. **Plan limits** (conversations/messages per month) → 402 `LIMIT_CONVERSATIONS` / `LIMIT_MESSAGES`

Free plan is always allowed (no subscription required).

## Portal UI (`/portal/billing`)

- Current plan name + price + status badge
- Usage bars (conversations + messages) with color coding
- Available plans comparison grid
- "Upgrade" button → Stripe Checkout
- "Manage Subscription" → Stripe Customer Portal
- Stripe not configured notice in dev

## Testing

```bash
# Without Stripe env vars: app builds, billing page shows "not configured"
# With Stripe env vars: full checkout + portal flow works

# Verify billing status endpoint
curl -s -b "$COOKIE" http://localhost:4000/portal/billing/status | jq .plan

# Verify webhook rejects bad signature
curl -s -X POST http://localhost:4000/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: bad" \
  -d '{}' # → 400
```

## Migration

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
npx pnpm db:seed  # Updates plans with stripePriceId from env
```
