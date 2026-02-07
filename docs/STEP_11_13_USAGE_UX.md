# Step 11.13 — Usage Visibility + Alerts UX

## Overview

Adds user-facing usage visibility and proactive alert banners across the Customer Portal and Admin Dashboard, with no API breaking changes.

## Changes

### Portal: `/portal/usage` (New Page)

Dedicated usage page showing:
- **Usage ring charts** — visual percentage indicators for conversations and messages consumed vs limits
- **Extra quota** — bonus quota granted by admin displayed as "+N bonus" beneath each ring
- **Next reset date** — when current-period counters reset (aligned to subscription period or first of next month)
- **Plan details** — plan name, subscription status, agent seats
- **Alert banners**:
  - **>=100% usage** — red banner with "Upgrade your plan" CTA linking to `/portal/billing`
  - **>=80% usage** — amber banner with "View plans" CTA
  - **Billing locked** — red banner with "Manage Subscription" + "Contact support" CTAs
  - **Grace period** — amber banner with grace-end date and "Resolve now" CTA

Navigation: Added "Usage" link (BarChart3 icon) to portal sidebar between Inbox and Settings.

### Portal: `/portal/billing` (Enhanced)

Added two new conditional banners between Stripe-not-configured notice and Current Plan card:
- **>=100% usage** — red banner with "Upgrade Now" button scrolling to Available Plans section
- **>=80% usage** — amber banner with "View Plans" button scrolling to Available Plans section

These banners do NOT appear when the account is already in grace/locked state (those have their own banners).

### Admin: `/dashboard/audit` (New Page)

Audit log viewer for the selected organization:
- **Table view** — timestamp, action badge (color-coded), actor, and truncated details
- **Filters** — action type dropdown, actor text search, limit selector (25/50/100/200)
- **Refresh button** — manually reload entries
- **Data source** — `GET /internal/org/:key/audit-log` (from Step 11.12)

Navigation: Added "Audit Log" link (FileText icon) to admin dashboard sidebar.

## API

No API changes. All data comes from existing endpoints:
- `GET /portal/billing/status` — usage, limits, plan, subscription (Step 11.12 enriched)
- `GET /portal/billing/lock-status` — billing lock/grace state (Step 11.9)
- `GET /internal/org/:key/audit-log` — audit entries (Step 11.12)

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/portal/usage/page.tsx` | **New** — Usage page with ring charts and banners |
| `apps/web/src/app/dashboard/audit/page.tsx` | **New** — Audit log viewer page |
| `apps/web/src/components/PortalLayout.tsx` | Added "Usage" nav link |
| `apps/web/src/components/DashboardLayout.tsx` | Added "Audit Log" nav link |
| `apps/web/src/app/portal/billing/page.tsx` | Added >=80%/100% usage alert banners |

## Verification

```bash
bash VERIFY_STEP_11_13.sh
```
