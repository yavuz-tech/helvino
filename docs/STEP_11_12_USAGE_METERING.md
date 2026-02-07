# Step 11.12 — Usage Metering + Monthly Reset + Admin Overrides

## Overview

Adds canonical org usage counters, exposes them via API for both admin dashboard and customer portal, implements lazy monthly reset, and provides admin-only override actions (all audited).

## Database Changes

### New Model: `AuditLog`
- `id`, `orgId`, `actor`, `action`, `details` (JSON), `createdAt`
- Indexed on `(orgId, createdAt)`
- Records all admin overrides, webhook state changes, and billing lock/unlock events

### Extended: `Organization`
- `extraConversationQuota` (Int, default 0) — bonus conversations on top of plan
- `extraMessageQuota` (Int, default 0) — bonus messages on top of plan

## API Endpoints

### Admin-Only (require admin session)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/internal/org/:key/usage` | Current month usage + limits (incl extra quota) + next reset date |
| POST | `/internal/org/:key/usage/reset` | Reset current month counters to zero |
| POST | `/internal/org/:key/usage/grant-quota` | Set extra quota `{extraConversations, extraMessages}` |
| POST | `/internal/org/:key/billing/lock` | Manually lock billing (block writes) |
| POST | `/internal/org/:key/billing/unlock` | Manually unlock billing (allow writes) |
| GET | `/internal/org/:key/audit-log` | Recent audit log entries for the org |

### Portal (require portal session)

| Endpoint | Change |
|----------|--------|
| GET `/portal/billing/status` | Now includes `nextResetDate`, `extraConversationQuota`, `extraMessageQuota` in response |

## Entitlements

- Plan limits now include extra quota: `effectiveLimit = plan.max + org.extra`
- `getUsageForMonth()` returns `nextResetDate` (aligned to subscription period end or first of next month)
- `getPlanLimits()` returns extra quota fields

## Audit Logging

All state-changing operations are logged:
- `usage.reset` — admin resets counters
- `quota.grant` — admin changes extra quota (with before/after values)
- `billing.lock` / `billing.unlock` — manual lock/unlock
- `webhook.state_change` — Stripe webhook state transitions

## UI Changes

### Portal Billing (`/portal/billing`)
- Shows next reset date alongside current period
- Shows "Account locked" banner with contact support messaging when locked

### Admin Dashboard Settings (`/dashboard/settings`)
- New "Usage & Admin Overrides" section showing:
  - Current month usage with progress bars
  - Next reset date
  - Reset Usage button
  - Grant Extra Quota form
  - Manual Billing Lock/Unlock buttons

## Verification

```bash
bash VERIFY_STEP_11_12.sh
```
