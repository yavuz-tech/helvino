# Step 11.17 — Observability + Traceability

## Overview

Production-grade observability layer added to Helvino without changing core business logic.

## What Changed

### 1. Request Correlation (`x-request-id`)

- Every incoming request gets a unique `requestId` (UUID v4).
- If the client sends `x-request-id` header, it is respected (max 128 chars).
- `x-request-id` is returned on **every** response header.
- Available to all handlers via `request.requestId`.

### 2. Structured Logging

Every request completion log includes:

```json
{
  "msg": "req",
  "requestId": "abc-123",
  "method": "POST",
  "url": "/conversations",
  "route": "/conversations",
  "statusCode": 201,
  "durationMs": 42,
  "actorType": "widget",
  "actorId": "visitor-key",
  "orgKey": "demo-org",
  "siteId": null,
  "ip": "127.0.0.1"
}
```

Actor types: `admin` | `portal` | `widget` | `anon`.

Errors are logged with code and stack (dev only):

```json
{
  "msg": "err",
  "requestId": "abc-123",
  "statusCode": 500,
  "errorCode": "INTERNAL_ERROR",
  "errorMessage": "Something went wrong"
}
```

### 3. Standard Error Envelope

Unhandled errors return a consistent envelope:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error",
    "requestId": "abc-123"
  }
}
```

- In production, 5xx messages are sanitized (no stack leaks).
- In development, original messages and stack are preserved.

### 4. Metrics Summary Endpoint

**`GET /internal/metrics/summary`** (admin session required)

Returns lightweight system info:

```json
{
  "uptimeSec": 3600,
  "env": "development",
  "nodeVersion": "v22.x.x",
  "processMemory": { "rss": 120, "heapUsed": 45, "heapTotal": 80, "unit": "MB" },
  "totalOrgs": 3,
  "totalConversations": 150,
  "totalMessages": 1200,
  "lastWebhookAt": "2026-02-05T10:30:00.000Z"
}
```

### 5. Audit Log Correlation

`writeAuditLog()` now accepts an optional `requestId` parameter. When provided, it is stored in the audit log `details` JSON, enabling end-to-end tracing from HTTP request to audit event.

### 6. Web — RequestId on Failures

When an API call fails, the error UI now shows the `Request ID` (extracted from the `x-request-id` response header) so users can reference it for support.

- `ErrorBanner` component: reusable error display with optional requestId.
- Updated in admin login, dashboard, and portal billing pages.
- Utility functions `getRequestId()` and `parseApiError()` added to `utils/api.ts`.

## Files Changed

| File | Change |
|------|--------|
| `apps/api/src/plugins/request-context.ts` | x-request-id propagation, actor resolution, structured logging, global error handler |
| `apps/api/src/routes/observability.ts` | Added `/internal/metrics/summary` endpoint |
| `apps/api/src/utils/audit-log.ts` | Added optional `requestId` parameter |
| `apps/web/src/utils/api.ts` | Added `getRequestId()` and `parseApiError()` utilities |
| `apps/web/src/components/ErrorBanner.tsx` | New reusable error display component |
| `apps/web/src/app/login/page.tsx` | Shows requestId on login errors |
| `apps/web/src/app/dashboard/page.tsx` | Shows requestId on conversation fetch errors |
| `apps/web/src/app/portal/billing/page.tsx` | Shows requestId on billing errors |

## Verification

```bash
cd apps/api && pnpm build
cd apps/web && pnpm build
bash VERIFY_STEP_11_17.sh
bash VERIFY_ALL.sh
```
