# HELVION SECURITY AUDIT — PART 9/10
# Infrastructure & Configuration Security (Bishop Fox Style)

**Auditor:** Claude Opus 4.6 (Automated)
**Date:** 2025-01-XX
**Target:** Helvion.io Infrastructure — Railway Production
**Mode:** AUDIT + AUTO-FIX

---

## Executive Summary

Helvion's infrastructure security is mature: all secrets are environment-variable-sourced with fail-closed startup checks, `.env` files are properly gitignored, the global error handler sanitizes production responses, structured logging (Pino) captures request context without sensitive data, and health/metrics endpoints are properly scoped. Two auto-fixable issues were found (production logger performance, unused dependency) along with three manual recommendations.

| Severity | Count | Fixed | Manual |
|----------|-------|-------|--------|
| HIGH     | 0     | 0     | 0      |
| MEDIUM   | 1     | 1     | 2      |
| LOW      | 2     | 1     | 1      |
| **Total**| **3** | **2** | **3**  |

---

## Fixed Findings

### FINDING-901: MEDIUM — `pino-pretty` Transport Active in Production

**File:** `apps/api/src/index.ts` (line 137)

**Problem:** The Fastify logger was configured to ALWAYS use the `pino-pretty` transport, regardless of `NODE_ENV`. In production:
- `pino-pretty` adds significant CPU overhead to serialize and pretty-print every log line
- Cloud logging services (Railway, Datadog, CloudWatch) prefer raw JSON for indexing/search
- Pretty-printed output actually REDUCES observability in production log aggregators

**Before:**
```typescript
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: {
      target: "pino-pretty",         // ALWAYS active — even in production
      options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
    },
  },
});
```

**Fix:** Conditionally enable `pino-pretty` only in development:

```typescript
const isProduction = process.env.NODE_ENV === "production";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    // In production: plain JSON logs (lower CPU, better for log aggregators)
    // In development: pretty-printed for readability
    ...(isProduction
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
          },
        }),
  },
});
```

---

### FINDING-902: LOW — Unused `speakeasy` Dependency (Unmaintained)

**File:** `apps/api/package.json` (line 51)

**Problem:** `speakeasy@^2.0.0` was listed as a dependency but is NEVER imported in any source file. The project correctly uses `otpauth@^9.5.0` for TOTP operations. `speakeasy` is:
- **Last updated:** 2017 (7+ years ago)
- **Unmaintained:** No active maintainer, open security issues
- **Dead weight:** Increases `node_modules` size and `pnpm install` time
- **Supply chain risk:** Unmaintained packages are targets for dependency hijacking

**Fix:** Removed `"speakeasy": "^2.0.0"` from `package.json`. Run `pnpm install` to update lockfile.

---

## Manual Findings

### MANUAL-901: MEDIUM — DATABASE_URL Missing SSL Enforcement Documentation

**Risk:** MEDIUM (Railway enforces SSL by default, but custom DB deployments may not)
**File:** `apps/api/.env.example`, `apps/api/src/prisma.ts`

**Problem:** The `DATABASE_URL` in `.env.example` is a bare placeholder with no `?sslmode=require` suffix. The Prisma client doesn't explicitly enforce SSL. While Railway's managed PostgreSQL enforces TLS at the infrastructure level, if someone:
- Connects to a non-Railway PostgreSQL
- Uses a custom DATABASE_URL without SSL
- Deploys to a non-Railway environment

...the connection would be unencrypted, exposing credentials and data in transit.

**Recommendation:**
1. Add `?sslmode=require` to the DATABASE_URL example: `DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require`
2. Document that production DATABASE_URL MUST include SSL parameters
3. Consider adding a startup check: if `NODE_ENV=production` and DATABASE_URL doesn't contain `ssl`, log a warning

### MANUAL-902: MEDIUM — Admin Seed Password Should Be Rotated Post-Deploy

**Risk:** MEDIUM
**File:** `apps/api/src/index.ts` (lines 1226-1260)

**Problem:** `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables are used to seed an initial admin user on startup. While this is a valid bootstrap pattern:
- The password is properly hashed (Argon2) before storage
- The password is NOT logged (verified)
- But `ADMIN_PASSWORD` persists in the Railway env vars after initial use
- Anyone with Railway dashboard access can read it
- The seed runs on EVERY deployment (though it no-ops if user exists)

**Recommendation:**
1. After initial admin user creation, UNSET `ADMIN_PASSWORD` from Railway env vars
2. Document in the deployment guide: "After first deployment, remove ADMIN_PASSWORD from env"
3. Consider adding a startup warning: "ADMIN_PASSWORD is still set — consider removing after initial setup"

### MANUAL-903: LOW — `qs` Transitive Vulnerability (via Stripe SDK)

**Risk:** LOW (DoS only, transitive dependency)
**Package:** `qs@>=6.7.0 <=6.14.1` (via `stripe` → `qs`)
**Advisory:** GHSA-w7fw-mjwx-w883 — arrayLimit bypass allows denial of service

**`pnpm audit` output:**
```
┌─────────────────────┬──────────────────────────────────────────┐
│ low                 │ qs's arrayLimit bypass in comma parsing  │
│                     │ allows denial of service                 │
├─────────────────────┼──────────────────────────────────────────┤
│ Vulnerable versions │ >=6.7.0 <=6.14.1                        │
├─────────────────────┼──────────────────────────────────────────┤
│ Patched versions    │ >=6.14.2                                 │
├─────────────────────┼──────────────────────────────────────────┤
│ Paths               │ apps__api>stripe>qs                      │
└─────────────────────┴──────────────────────────────────────────┘
1 vulnerabilities found — Severity: 1 low
```

**Recommendation:** Monitor `stripe` package for an update that bumps `qs`. The vulnerability is low-severity DoS affecting query string parsing, and Helvion's Stripe integration only uses server-to-server calls (not exposed to arbitrary user query strings).

---

## Passed Checklist Items

### A. Environment & Secrets

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | `.env` in `.gitignore` | ✅ PASS | Root `.gitignore` line 23-25: `.env`, `.env.*`, `!.env.example` |
| 2 | All secrets in env vars | ✅ PASS | Full codebase search: 0 hardcoded secrets. All use `process.env.*` |
| 3 | No default/fallback secrets | ✅ PASS | Every critical secret throws on missing: `SESSION_SECRET`, `ORG_TOKEN_SECRET`, `SIGNED_LINK_SECRET` all have startup `throw new Error(...)` |
| 4 | Prod/dev env separated | ✅ PASS | `.env.example` for dev, Railway env vars for prod. `NODE_ENV` properly checked throughout |

### B. Dependency Security

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 5 | `pnpm audit` clean | ⚠️ 1 LOW | 1 low (qs via stripe) — transitive, not actionable |
| 6 | Lockfile committed | ✅ PASS | `pnpm-lock.yaml` exists and is NOT in `.gitignore` |
| 7 | No critical outdated deps | ✅ PASS | All major deps at latest: Fastify 5, Next.js 15, React 19, Prisma 5, Socket.IO 4 |

### C. Error Handling

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 8 | Global error handler | ✅ PASS | `requestContextPlugin` → `fastify.setErrorHandler()` with consistent error envelope |
| 9 | Stack traces hidden in prod | ✅ PASS | `...(isProduction ? {} : { stack: error.stack })` — only logged in dev |
| 10 | Prisma errors sanitized | ✅ PASS | Global handler returns generic "Internal server error" for 500s in production. Route-level handlers catch P2002/P2025 with user-friendly messages |
| 11 | Error format consistent | ✅ PASS | All errors follow `{ error: { code, message, requestId } }` envelope |

### D. Database Security

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 12 | DB connection SSL | ⚠️ MANUAL | Railway enforces SSL, but no code-level enforcement (MANUAL-901) |
| 13 | Connection pool limit | ✅ PASS | Prisma uses default connection pool (configurable via `connection_limit` in DATABASE_URL). No unbounded connections |
| 14 | Migration in production | ✅ PASS | `start` script: `prisma migrate deploy && node dist/index.js` — uses `deploy` (not `dev`) in production |
| 15 | DB backup | ℹ️ INFRA | Railway managed PostgreSQL includes automated backups |

### E. Logging & Monitoring

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 16 | No sensitive data in logs | ✅ PASS | Full search: no passwords, tokens, API keys in log statements. Admin seed explicitly: `"Requested log line (do not log password)"` |
| 17 | Request logging format | ✅ PASS | Structured JSON (Pino) with: requestId, method, url, route, statusCode, durationMs, actorType, actorId, ip |
| 18 | Health check endpoint | ✅ PASS | `GET /health` — public, checks DB + Redis, returns 503 when down |
| 19 | Metrics tracking | ✅ PASS | `metricsTracker` (rolling 60s window): req_total, req_2xx/4xx/5xx, avg/p95 latency. Admin-only `/metrics` endpoint |
| 20 | Background jobs fail-safe | ✅ PASS | Both cron jobs (`checkAbandonedCheckouts`, `scheduleAiQuotaReset`) wrapped in try/catch with error logging |

---

## Mandatory Verification: .env.example (key names only)

### `apps/api/.env.example`
```
PORT, HOST, NODE_ENV
SESSION_SECRET, INTERNAL_API_KEY, ORG_TOKEN_SECRET, SIGNED_LINK_SECRET, TURNSTILE_SECRET_KEY
TRUSTED_HOSTS, TRUSTED_PROXIES
DATABASE_URL
REDIS_URL
APP_PUBLIC_URL, NEXT_PUBLIC_WEB_URL, ALLOWED_ORIGINS
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_ID_STARTER
STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL, GRACE_DAYS
POSTMARK_SERVER_TOKEN, POSTMARK_MESSAGE_STREAM
RESEND_API_KEY
MAIL_PROVIDER, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
EMAIL_FROM, MAIL_FROM
WEBAUTHN_RP_NAME, WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN
ADMIN_MFA_REQUIRED, PORTAL_MFA_RECOMMENDED
RATE_LIMIT_DEV_MULTIPLIER
OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY
INTERNAL_OVERRIDE_WRITES
EMBED_CDN_URL
LOG_LEVEL
```

### `apps/web/.env.example`
```
NEXT_PUBLIC_API_URL, NEXT_PUBLIC_TURNSTILE_SITE_KEY
NEXT_PUBLIC_ORG_KEY
NEXT_PUBLIC_DEFAULT_WIDGET_SITE_ID, NEXT_PUBLIC_DEFAULT_WIDGET_ORG_KEY
```

### `apps/widget/.env.example`
```
VITE_API_URL
```

**Assessment:** All `.env.example` files contain only key names with empty or safe default values. No real secrets present.

## Mandatory Verification: Hardcoded Secret Search

Full codebase search across all `.ts` files for patterns: `|| 'secret'`, `|| "key"`, hardcoded API keys (`sk_`, `pk_`, `Bearer `):

**Result: 0 hardcoded secrets found.** All sensitive values come from `process.env.*` with fail-closed validation (throw on missing).

## Mandatory Verification: `pnpm audit`

```
1 vulnerabilities found
Severity: 1 low

- qs (via stripe>qs) — arrayLimit bypass DoS
  Vulnerable: >=6.7.0 <=6.14.1
  Patched: >=6.14.2
  Impact: LOW — transitive dependency, not directly exploitable
```

## Mandatory Verification: Global Error Handler (FULL CODE)

```typescript
// apps/api/src/plugins/request-context.ts

fastify.setErrorHandler(async (error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  // Log with context (stack trace only in dev)
  fastify.log.error({
    msg: "err",
    requestId: request.requestId,
    method: request.method,
    url: request.url,
    statusCode,
    actorType: request.actorType,
    actorId: request.actorId,
    errorCode: error.code || undefined,
    errorMessage: error.message,
    ...(isProduction ? {} : { stack: error.stack }),
  });

  // Standard error envelope — hide internal details in production
  reply.status(statusCode).send({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: statusCode >= 500 && isProduction
        ? "Internal server error"
        : error.message,
      requestId: request.requestId,
    },
  });
});
```

## Mandatory Verification: TypeScript

```
$ npx tsc --noEmit
(no errors)
```

---

## Changed Files

| File | Change |
|------|--------|
| `apps/api/src/index.ts` | `pino-pretty` transport now conditional (dev-only); removed duplicate `isProduction` declaration |
| `apps/api/package.json` | Removed unused `speakeasy` dependency |
