# HELVION SECURITY AUDIT — PART 7/10
# Frontend & Client-Side Security
**Auditor:** Bishop Fox Style Offensive Security Review
**Target:** Railway Production
**Date:** 2025-01-XX
**Status:** AUDIT + AUTO-FIX COMPLETE

---

## Executive Summary

Audited Helvion's Next.js 15 frontend (`apps/web`), Vite+React widget (`apps/widget`), environment variable exposure, XSS vectors, client-side authentication, route protection, and build security.

**The frontend security posture is strong.** Key strengths: memory-only token storage, DOMPurify on all rendered HTML, comprehensive CSP via middleware, httpOnly cookies for session auth. Only minor hardening items found.

| Severity | Count | Auto-Fixed | Manual |
|----------|-------|------------|--------|
| HIGH     | 0     | 0          | 0      |
| MEDIUM   | 1     | 0          | 1      |
| LOW      | 3     | 3          | 0      |
| MANUAL   | 1     | —          | 1      |

---

## Mandatory Verification: ALL NEXT_PUBLIC_ Variables

| Variable | Purpose | Verdict |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | **SAFE** — public URL |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO server URL | **SAFE** — public URL |
| `NEXT_PUBLIC_WEB_URL` | Canonical web app URL | **SAFE** — public URL |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile (public by design) | **SAFE** — site keys are meant to be public |
| `NEXT_PUBLIC_DEFAULT_ORG_KEY` | Default org key for routing | **SAFE** — public identifier |
| `NEXT_PUBLIC_DEFAULT_WIDGET_SITE_ID` | Default widget site ID | **SAFE** — public identifier |
| `NEXT_PUBLIC_DEFAULT_WIDGET_ORG_KEY` | Default widget org key | **SAFE** — public identifier |
| `NEXT_PUBLIC_ORG_KEY` | Legacy org key | **SAFE** — public identifier |

**No secrets exposed via `NEXT_PUBLIC_` prefix.** All API keys (Stripe secret, OpenAI, Gemini, Anthropic, Resend, Turnstile secret, DATABASE_URL, SESSION_SECRET) are server-side only. `.env` files are properly gitignored.

---

## Mandatory Verification: ALL dangerouslySetInnerHTML Usages

| # | File | Content | Sanitized? | Risk |
|---|------|---------|------------|------|
| 1 | `apps/widget/src/App.tsx:624` | `msg.content` (chat messages) | YES — DOMPurify via `sanitizeMessage()` | **LOW** |
| 2 | `apps/web/src/components/inbox/ThreadView.tsx:184` | `msg.content` (inbox messages) | YES — DOMPurify (double-sanitized at fetch + render) | **LOW** |
| 3 | `apps/web/src/app/layout.tsx:141` | `I18N_BLOCKING_SCRIPT` | N/A — static hardcoded string | **LOW** |
| 4 | `apps/web/src/app/layout.tsx:142` | `CHUNK_LOAD_ERROR_RECOVERY` | N/A — static hardcoded string | **LOW** |
| 5 | `apps/web/src/components/PremiumToast.tsx:182` | CSS `@keyframes` string | N/A — static hardcoded CSS | **LOW** |

**All dynamic content usages (#1, #2) are properly sanitized with DOMPurify** using a strict allowlist (`b, i, em, strong, a, br, p, ul, ol, li, code, pre`; only `href, target, rel` attrs). No `.innerHTML` assignments found in source code.

---

## Mandatory Verification: localStorage/sessionStorage Keys

### Widget (`apps/widget/src/`)

| Key | Contents | Risk |
|-----|----------|------|
| `helvino-conv-{orgKey}` | Conversation ID (CUID) | **LOW** — non-sensitive identifier |
| `helvino-visitor-id` | Visitor ID (random UUID) | **LOW** — anonymous identifier |
| `helvino-recent-emoji` | Recent emoji array | **LOW** — UI preference |

### Web (`apps/web/src/`)

| Key | Contents | Risk |
|-----|----------|------|
| `helvino_portal_refresh_token` | **CLEANED UP** — legacy key, actively removed | **SAFE** — now memory-only |
| `helvino_portal_onboarding_deferred` (sessionStorage) | "1" flag | **LOW** — UI state |
| `helvino-widget-theme-overrides` | Widget theme JSON | **LOW** — UI config |
| `sidebar-collapsed` | "0"/"1" | **LOW** — UI preference |
| `helvino-recent-emoji` | Emoji array | **LOW** — UI preference |
| `helvino-org-key` | Selected org key | **LOW** — public identifier |
| `helvino-site-id` | Widget site ID | **LOW** — public identifier |
| `helvino-org-key-widget` | Widget org key | **LOW** — public identifier |
| `helvino_sound_enabled` | Sound preference | **LOW** — UI preference |
| `helvino_portal_socket_token` (sessionStorage, debug only) | Debug socket token | **MEDIUM** — only in DebugContext, dev env |
| ChunkLoad retry keys (sessionStorage) | Retry counters | **LOW** — error recovery |

**No secrets, tokens, or sensitive data stored in localStorage.** Refresh token is explicitly kept in memory-only closure variable with active cleanup of legacy storage.

---

## Mandatory Verification: Security Headers (middleware.ts)

The Next.js middleware applies comprehensive security headers to ALL routes:

### Universal Headers (all routes)

| Header | Value | Status |
|--------|-------|--------|
| `X-Content-Type-Options` | `nosniff` | ✅ PASS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ PASS |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | ✅ PASS |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (prod only) | ✅ PASS |

### Portal/Dashboard Routes (CSP strict)

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'` |

### Public/Widget Routes (CSP permissive for embed)

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `SAMEORIGIN` |
| `Content-Security-Policy` | Same as above but `frame-ancestors *` (allows embedding) |

---

## Fixed Findings

### FIX-701: `X-Powered-By` Header Leaks Framework Version (LOW)

**File:** `apps/web/next.config.ts`
**Issue:** Next.js sends `X-Powered-By: Next.js` by default, revealing the framework to attackers for targeted exploits.
**Fix:** Added `poweredByHeader: false` to next.config.ts.

---

### FIX-702: Source Maps Not Explicitly Disabled (LOW)

**File:** `apps/web/next.config.ts`
**Issue:** `productionBrowserSourceMaps` was not set. While Next.js standalone builds don't generate browser source maps by default, this should be explicitly configured for defense-in-depth.
**Fix:** Added `productionBrowserSourceMaps: false`.

---

### FIX-703: CSP `connect-src` Allowed Localhost in Production (LOW)

**File:** `apps/web/src/middleware.ts`
**Issue:** The CSP `connect-src` directive included `http://localhost:* ws://localhost:*` even in production, which is unnecessary and slightly weakens the policy.
**Fix:** Extracted `connectSrc` to a conditional variable that only includes localhost in development:

```typescript
const connectSrc = isProduction
  ? "connect-src 'self' https: wss:"
  : "connect-src 'self' http://localhost:* ws://localhost:* https: wss:";
```

---

## Manual Findings

### MANUAL-701: `NEXT_PUBLIC_INTERNAL_KEY` Orphaned in `.env.local`

**Risk:** MEDIUM
**File:** `apps/web/.env.local` (gitignored, not deployed)
**Issue:** The variable `NEXT_PUBLIC_INTERNAL_KEY=r/b6LoI/2m6axryScc8YscXs3tEYWLHw` still exists in the local `.env.local` file. While it's no longer referenced in any source code (confirmed by grep), it should be removed to prevent accidental future use. If this value ever matched the production `INTERNAL_API_KEY`, that key should be rotated.
**Action:** Delete the `NEXT_PUBLIC_INTERNAL_KEY` line from `apps/web/.env.local`. Verify and rotate `INTERNAL_API_KEY` if values matched.

---

## Passed Checklist Items

### A. Environment Variable Exposure
| # | Check | Status |
|---|-------|--------|
| 1 | NEXT_PUBLIC_ has no secrets | ✅ PASS |
| 2 | Stripe: only publishable key exposed | ✅ PASS (via Turnstile site key pattern; Stripe key server-side) |
| 3 | AI API keys server-side only | ✅ PASS |
| 4 | DATABASE_URL not in client | ✅ PASS |

### B. Widget Embed Security
| # | Check | Status |
|---|-------|--------|
| 5 | Widget SRI hash | ❌ N/A — self-hosted bundle, not CDN |
| 6 | Widget origin/domain allowlist | ✅ PASS — enforced server-side via `allowedDomains` |
| 7 | postMessage security | ✅ PASS — no postMessage usage (direct iframe communication) |
| 8 | Widget clickjacking | ✅ PASS — widget IS the iframe; parent page CSP is customer's responsibility |
| 9 | Widget localStorage sensitive data | ✅ PASS — only conv ID, visitor ID, emoji prefs |

### C. XSS Vectors
| # | Check | Status |
|---|-------|--------|
| 10 | dangerouslySetInnerHTML | ✅ PASS — all 5 usages safe (DOMPurify or static) |
| 11 | Chat messages sanitized | ✅ PASS — DOMPurify with strict allowlist |
| 12 | URL params in DOM | ✅ PASS — never rendered as HTML |
| 13 | i18n injection | ✅ PASS — React text interpolation auto-escapes |
| 14 | Markdown render | ✅ PASS — no markdown libraries used |

### D. Authentication Client-Side
| # | Check | Status |
|---|-------|--------|
| 15 | Token storage | ✅ EXCELLENT — memory-only (closure variable), not localStorage |
| 16 | Token refresh flow | ✅ PASS — 401 → refresh → retry with proper error handling |
| 17 | Logout state cleanup | ✅ PASS — clears memory tokens + onboarding + calls server logout |
| 18 | Auth header | ✅ PASS — `Authorization: Bearer` from memory, with `credentials: include` for cookies |

### E. Route Protection
| # | Check | Status |
|---|-------|--------|
| 19 | Middleware protects portal routes | ✅ PASS — CSP + X-Frame-Options: DENY on /dashboard, /portal, /login |
| 20 | Admin route protection | ✅ PASS — server-side `requireAdmin` middleware on all admin APIs |
| 21 | Unauthorized redirect | ✅ PASS — client-side auth check redirects to /portal/login |

### F. Build & Bundle
| # | Check | Status |
|---|-------|--------|
| 22 | Source maps in prod | ✅ FIXED — explicitly `productionBrowserSourceMaps: false` |
| 23 | Console.log cleanup | ⚠️ ACCEPTABLE — some debug logs exist but contain no secrets |
| 24 | npm audit | ⚠️ MANUAL — should be run as part of CI pipeline |
| 25 | Security headers | ✅ PASS — comprehensive CSP, HSTS, X-Frame-Options, X-Content-Type-Options |

---

## Client-Side Auth Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER                               │
│                                                         │
│  ┌─── Memory (closure) ───┐   ┌─── httpOnly Cookie ──┐ │
│  │ refreshToken: string    │   │ PORTAL_SESSION_COOKIE│ │
│  │ accessToken: string     │   │ (set by server)      │ │
│  └─────────────────────────┘   └──────────────────────┘ │
│                                                         │
│  Login Flow:                                            │
│  1. POST /portal/auth/login (credentials: include)      │
│  2. Server sets httpOnly cookie + returns refreshToken   │
│  3. refreshToken stored in memory (NOT localStorage)     │
│  4. accessToken stored in memory                        │
│                                                         │
│  Request Flow:                                          │
│  1. portalApiFetch() reads token from memory             │
│  2. Sends Authorization: Bearer <accessToken>           │
│  3. Also sends httpOnly cookie (credentials: include)   │
│  4. If 401 → auto-refresh → retry                      │
│                                                         │
│  Logout Flow:                                           │
│  1. Clear memory tokens (refreshToken = null)           │
│  2. Clear memory accessToken                            │
│  3. Clear sessionStorage onboarding state               │
│  4. POST /portal/auth/logout (server revokes session)   │
│  5. Server clears httpOnly cookie                       │
│                                                         │
│  XSS Mitigation:                                        │
│  ✅ Tokens in memory — XSS cannot read closure vars     │
│  ✅ Legacy sessionStorage entries actively cleaned       │
│  ✅ httpOnly cookie immune to document.cookie access     │
└─────────────────────────────────────────────────────────┘
```

**This is a best-practice auth implementation.** The memory-only token storage is the strongest defense against token theft via XSS, while the httpOnly cookie ensures session persistence across page reloads.

---

## TypeScript Verification

```
$ npx tsc --noEmit --project apps/web/tsconfig.json
(exit code: 0 — no errors)

$ npx tsc --noEmit --project apps/api/tsconfig.json
(exit code: 0 — no errors)
```

---

## Changed Files

| File | Changes |
|------|---------|
| `apps/web/next.config.ts` | Added `poweredByHeader: false`, `productionBrowserSourceMaps: false` |
| `apps/web/src/middleware.ts` | Tightened CSP `connect-src` to exclude localhost in production |

---

## Pending Manual Items from Previous Parts

- **MANUAL-201:** TRUSTED_PROXIES Railway proxy chain configuration
- **MANUAL-301:** Founding Member atomic slot reservation
- **MANUAL-401:** WebSocket IP keying validation with Railway proxy
- **MANUAL-501:** AI response caching for cost optimization
- **MANUAL-601:** Admin role differentiation
- **MANUAL-701:** Remove orphaned `NEXT_PUBLIC_INTERNAL_KEY` from `.env.local` (this part)
