# Step 11.9 — Billing State Machine + Grace Lock

## Overview
This step introduces a billing state machine that automatically restricts widget write operations based on Stripe payment status. Admin/dashboard access is unchanged; portal remains read-only where applicable.

## Schema changes
`Organization` adds:
- `graceEndsAt` (nullable)
- `billingLockedAt` (nullable)
- `lastPaymentFailureAt` (nullable)

## Webhook behavior
On Stripe events:
- `invoice.payment_failed` OR `customer.subscription.updated` with `past_due`/`unpaid`:
  - `lastPaymentFailureAt = now`
  - `graceEndsAt = now + GRACE_DAYS` (default 7)
- `invoice.payment_succeeded` OR subscription `active`/`trialing`:
  - `graceEndsAt = null`
  - `billingLockedAt = null`
  - `lastPaymentFailureAt = null`

## Runtime enforcement (widget write endpoints only)
Applies to:
- `POST /conversations`
- `POST /conversations/:id/messages`

Rules:
1) If plan is active/trialing (or free) → allow
2) If `graceEndsAt` in future → block widget writes with `402`
3) If grace expired → set `billingLockedAt` and block widget writes with `402`

Admin and portal access remain intact.

## Portal endpoint
`GET /portal/billing/lock-status`
Returns:
```
{ locked, graceEndsAt, billingLockedAt, reason }
```

## Environment
```
GRACE_DAYS=7
```

## Notes
- The grace/lock state does not affect admin routes.
- Portal billing UI surfaces grace/lock banner and links to the Stripe portal.
