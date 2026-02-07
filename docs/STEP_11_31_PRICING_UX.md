# Step 11.31 — Pricing, Plan Comparison & Upgrade UX

## Overview

Conversion-focused pricing and plan comparison integrated with existing Stripe billing, entitlements, step-up security, and i18n.

## Changes

### A) Plan Comparison UI
- `PlanComparisonTable` component: reusable across public and portal
- Plans: Free, Pro, Business with feature checklist
- Monthly/Yearly billing toggle (visual; yearly = 20% discount display)
- "Current Plan" badge for portal usage
- "Most Popular" badge on Pro plan
- Upgrade CTA per plan (step-up protected in portal)

### B) Portal Billing Enhancements
- Replaced inline plan cards with `PlanComparisonTable`
- Full feature comparison with checkmarks/X marks
- Existing usage bars, grace/locked states, invoices unchanged

### C) Public Pricing Page (`/pricing`)
- Clean, conversion-focused layout
- Reuses `PlanComparisonTable` with static plan data
- Security trust badges (MFA, Passkeys, Audit)
- CTA: "Start Free" / "Upgrade" → portal login
- Accessible without authentication

### D) Landing Page Enhancement
- Added "Pricing" nav link and "Start Free" CTA button

### E) i18n
- 30 new `pricing.*` keys with EN/TR/ES parity
- No hardcoded strings

## Files Changed

| File | Description |
|------|-------------|
| `components/PlanComparisonTable.tsx` | New: reusable plan comparison |
| `app/pricing/page.tsx` | New: public pricing page |
| `app/portal/billing/page.tsx` | Enhanced: uses PlanComparisonTable |
| `app/page.tsx` | Enhanced: pricing link + CTA |
| `i18n/translations.ts` | New pricing keys (EN/TR/ES) |

## Verification

```bash
bash VERIFY_STEP_11_31.sh
```
