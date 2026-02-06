# Step 11.8 — Stripe Customer Portal + Invoice History

## Overview

Adds two new portal billing endpoints and updates the billing UI:

- **Manage Subscription** button opens a real Stripe Billing Portal session where the customer can cancel, update payment methods, or switch plans.
- **Billing History** section fetches and displays recent invoices from Stripe with status badges, amounts, dates, and links to hosted invoice pages and PDF downloads.

## API Endpoints

### Portal Billing (require portal auth)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/portal/billing/portal-session` | Creates a Stripe Billing Portal session. Returns `{url}`. |
| `GET` | `/portal/billing/invoices?limit=10` | Lists recent invoices. Returns `{invoices: [...]}`. |

### Error Codes

| HTTP | Condition | Response |
|------|-----------|----------|
| `401` | No portal auth cookie | `{error: "Authentication required"}` |
| `501` | `STRIPE_SECRET_KEY` not set | `{error: "Stripe is not configured on this server."}` |
| `409` | No `stripeCustomerId` on org | `{error: "No Stripe customer linked yet. Please start a checkout first."}` |

### Rate Limiting

Both new endpoints are rate-limited at 30 requests/min per org+IP.

## Invoice Object Shape

```json
{
  "id": "in_xxx",
  "number": "INV-0001",
  "status": "paid",
  "amountDue": 4900,
  "amountPaid": 4900,
  "currency": "usd",
  "hostedInvoiceUrl": "https://invoice.stripe.com/...",
  "invoicePdf": "https://pay.stripe.com/...",
  "created": 1707177600,
  "periodEnd": 1709856000
}
```

Amounts are in cents. Frontend converts via `Intl.NumberFormat`.

## Portal UI Changes (`/portal/billing`)

1. **Manage Subscription** button appears when a Stripe customer exists. Calls `POST /portal/billing/portal-session` and redirects to the returned URL.
2. **Billing History** table shows the latest 10 invoices with:
   - Invoice number
   - Date
   - Amount (formatted)
   - Status badge (paid / open / void / draft / uncollectible)
   - View (hosted page) and PDF download links
3. Empty states:
   - No customer yet: "No billing history yet. Start a subscription…"
   - Customer exists but no invoices: "No invoices found yet."
   - Stripe not configured: "Billing not configured" banner (same as before)

## Existing Routes (Unchanged)

All existing routes remain backwards compatible:
- `GET /portal/billing/status`
- `POST /portal/billing/checkout`
- `POST /portal/billing/portal` (legacy)
- `GET /portal/org/billing` (legacy)
- `GET /portal/billing` (legacy)
- `POST /portal/org/billing/portal-session` (legacy)

## Testing

```bash
# Without auth → 401
curl -s http://localhost:4000/portal/billing/invoices
# → {"error":"Authentication required"}

# Without Stripe env → 501 (when logged in)
# With Stripe env → real invoice list

# Portal session without customer → 409
# Portal session with customer → {url: "https://billing.stripe.com/..."}
```
