# Step 11.35 — Widget Analytics + Health Metrics

## Overview

Adds lightweight, org-scoped widget health tracking and exposes analytics via Portal (org-scoped) and Admin (global summary) endpoints. Response times are stored as rolling histograms; percentiles are computed at read time.

## What Is Counted

| Metric | Trigger | Storage |
|--------|---------|---------|
| `widgetLoadsTotal` | Bootloader success | Atomic increment on `organizations` |
| `widgetLoadFailuresTotal` | Bootloader internal error (after org resolved) | Atomic increment (best-effort) |
| `widgetDomainMismatchTotal` | Domain allowlist rejects origin | Atomic increment in `domain-allowlist.ts` |
| `lastWidgetSeenAt` | Bootloader success | Set to `NOW()` |
| Response-time histogram | Bootloader success + message creation | `widgetRtBucketsJson` (JSONB) + `widgetRtTotalCount` |

### Histogram Buckets (ms)

`[0-50, 50-100, 100-200, 200-500, 500-1000, 1000-2000, 2000+]`

p50 and p95 are computed via linear interpolation from the histogram at read time using `computePercentile()`.

## Endpoints

### GET /portal/widget/health

**Auth**: Portal session cookie (requirePortalUser)
**Rate limit**: Standard portal read policy

```json
{
  "status": "OK" | "NEEDS_ATTENTION" | "NOT_CONNECTED",
  "lastSeenAt": "2026-02-06T12:00:00.000Z" | null,
  "loads": { "total": 1234, "failures": 5 },
  "domainMismatch": { "total": 2 },
  "responseTime": { "p50": 45, "p95": 180 },
  "requestId": "abc-123"
}
```

**Status logic (deterministic)**:
- `NOT_CONNECTED`: `firstWidgetEmbedAt` is null OR `lastWidgetSeenAt` is null
- `NEEDS_ATTENTION` if any:
  - `lastWidgetSeenAt` older than 24 hours
  - `domainMismatchTotal > 0`
  - `loadsTotal > 0` AND `failuresTotal / loadsTotal >= 0.05`
- Otherwise: `OK`

### GET /internal/metrics/widget-health-summary

**Auth**: Admin session cookie (requireAdmin)
**Rate limit**: Standard admin read policy

```json
{
  "totals": {
    "orgsTotal": 50,
    "connectedOrgs": 30,
    "loadsTotal": 100000,
    "failuresTotal": 150,
    "domainMismatchTotal": 20,
    "okCount": 25,
    "needsAttentionCount": 5,
    "notConnectedCount": 20
  },
  "topByFailures": [
    { "orgKey": "acme", "orgName": "Acme Corp", "failuresTotal": 80, "loadsTotal": 5000, "lastSeenAt": "..." }
  ],
  "topByDomainMismatch": [
    { "orgKey": "beta", "orgName": "Beta Inc", "domainMismatchTotal": 12, "lastSeenAt": "..." }
  ],
  "lastSeenDistribution": {
    "never": 20,
    "lt1h": 10,
    "lt24h": 8,
    "lt7d": 7,
    "gte7d": 5
  },
  "requestId": "xyz-789"
}
```

## Audit Logging

- **admin.metrics.widget_health_summary.read**: Logged when admin reads the summary. Includes requestId and counts.
- **security.widget_health_spike**: Logged best-effort when any org has `failuresTotal >= 50 AND failures/loads >= 0.2` OR `domainMismatchTotal >= 20`.

## Security Notes

- No client-provided timing is accepted; all measurements are server-side.
- No raw events are stored; only rolling histogram counts.
- Metric updates are fire-and-forget; they never block API responses.
- requestId is included in all JSON responses and x-request-id header.
- Both endpoints require proper authentication (401 if missing).

## Rate Limits

Endpoints use existing rate-limit policies matching their respective contexts (portal read / admin read). No custom relaxed limits.

## Files Changed

- `apps/api/prisma/schema.prisma` — histogram fields on Organization
- `apps/api/prisma/migrations/20260206200000_v11_35_widget_histogram/` — migration
- `apps/api/src/utils/widget-histogram.ts` — histogram helpers
- `apps/api/src/routes/widget-analytics.ts` — portal + admin endpoints
- `apps/api/src/routes/bootloader.ts` — load/failure/histogram instrumentation
- `apps/api/src/routes/org-customer.ts` — message response-time histogram
- `apps/api/src/middleware/domain-allowlist.ts` — domain mismatch counter (existing)
- `apps/web/src/components/WidgetHealthCard.tsx` — portal health card
- `apps/web/src/components/AdminWidgetHealthSummary.tsx` — admin summary panel
- `apps/web/src/i18n/translations.ts` — i18n keys (EN/TR/ES)
- `VERIFY_STEP_11_35.sh` — verification script with authenticated shape checks
