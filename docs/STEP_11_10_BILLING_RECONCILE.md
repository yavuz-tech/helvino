# Step 11.10 — Billing Reconciliation + Self-Healing

## Overview
Adds an admin-only reconciliation endpoint that pulls authoritative billing data from Stripe and updates org billing state to prevent drift when webhooks are delayed or missed.

## Endpoint
`POST /internal/billing/reconcile` (admin session required)

Body:
```
{ "orgKey": "demo", "dryRun": true, "limit": 50 }
```

Behavior:
- If `orgKey` is provided, reconciles that org only.
- Otherwise reconciles all orgs with `stripeCustomerId` (default `limit = 50`).
- Returns a report with per-org results and errors.
- `dryRun=true` computes changes without writing to DB.

## Billing rules (authoritative)
- Active/trialing subscription → `billingStatus=active|trialing`, clears grace/lock.
- Past due/unpaid or latest invoice failed → sets `lastPaymentFailureAt` and `graceEndsAt`.
- If grace already expired → sets `billingLockedAt`.
- No subscription → `planKey=free`, `planStatus=inactive`, retains grace/lock if already set.

## Portal visibility
`GET /portal/billing/lock-status` includes `lastReconcileAt`.
`GET /portal/billing/reconcile-status` returns last reconcile timestamp and stored summary.

## Failure modes
- Stripe not configured → `501` with clear message.
- Per-org Stripe API errors/timeouts are captured in `errors[]`, reconciliation continues.

## Example (dry run)
```
curl -X POST http://localhost:4000/internal/billing/reconcile \
  -H "Content-Type: application/json" \
  --cookie "helvino_admin_sid=..." \
  -d '{"dryRun": true, "limit": 10}'
```
