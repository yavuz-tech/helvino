# ═══════════════════════════════════════════════════════════
# HELVION SECURITY AUDIT REPORT — PART 2/10
# API Security & Input Validation
# Tarih: 2026-02-15
# Mod: AUDIT + AUTO-FIX | Ortam: Railway Production
# ═══════════════════════════════════════════════════════════

## EXECUTIVE SUMMARY

Kapsam: `apps/api/src/routes/` altindaki 46 route dosyasinin tamami, `apps/api/src/middleware/` (15 dosya), `apps/api/src/plugins/` ve `apps/api/src/index.ts` (CORS/CSRF/Helmet/global rate limit). Prisma sorgulari, raw SQL kullanimi, rate limiting keying, Origin/Host guvenligi ve input validation pratikleri kontrol edildi.

Toplam: 1 KRITIK | 5 ORTA | 3 DUSUK | 31 PASS  
Otomatik duzeltilen: 9 | Manuel gereken: 1

## OKUNAN ROUTE DOSYALARI (46/46)

`apps/api/src/routes/`:

admin-auth.ts  
admin-mfa.ts  
admin-orgs.ts  
analytics.ts  
audit-log-routes.ts  
auth.ts  
bootloader.ts  
device-routes.ts  
emails.ts  
embed.ts  
internal-admin.ts  
landing-widget.ts  
observability.ts  
org-admin.ts  
org-auth.ts  
org-customer.ts  
organization-settings.ts  
portal-ai-config.ts  
portal-ai-inbox.ts  
portal-auth.ts  
portal-billing.ts  
portal-channels.ts  
portal-chat-page.ts  
portal-conversations.ts  
portal-dashboard.ts  
portal-macros.ts  
portal-mfa.ts  
portal-notifications.ts  
portal-operating-hours.ts  
portal-org.ts  
portal-security.ts  
portal-settings-consistency.ts  
portal-signup.ts  
portal-sla.ts  
portal-team.ts  
portal-translations.ts  
portal-widget-config.ts  
portal-widget-settings.ts  
portal-workflows.ts  
promo-codes.ts  
recovery-routes.ts  
security.ts  
stripe-webhook.ts  
waitlist.ts  
webauthn-routes.ts  
widget-analytics.ts

## OTOMATIK DUZELTILEN BULGULAR (✅ FIXED)

### API-201 [KRITIK] — Stripe returnUrl Open Redirect (checkout + billing portal)

- Etki: Saldirgan, portal billing endpoint’lerine `returnUrl=https://evil.com` vererek Stripe oturumundan cikista kullaniciyi saldirgan domain’ine yonlendirebilirdi (phishing akislari icin uygun).
- Dosya(lar): `apps/api/src/utils/stripe.ts`, `apps/api/src/routes/portal-billing.ts`
- Saldiri senaryosu (ornek):
  ```bash
  curl -i "https://api.helvion.io/portal/billing/portal-session" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Cookie: helvino_portal_session=PORTAL_COOKIE_HERE" \
    -d '{"returnUrl":"https://evil.com/after"}'
  ```
- Duzeltme:
  - `returnUrl` mutlak URL olmak zorunda (http/https).
  - Origin allowlist: `APP_PUBLIC_URL`, `NEXT_PUBLIC_WEB_URL`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`.
  - Route’lar invalid `returnUrl` icin `400 { error: "Invalid returnUrl" }` donuyor.

```176:249:apps/api/src/utils/stripe.ts
function getCheckoutUrls(returnUrl?: string) {
  // ...
  const safeReturnUrl = coerceSafeAbsoluteReturnUrl(returnUrl);
  return {
    successUrl: `${safeReturnUrl}?success=1`,
    cancelUrl: `${safeReturnUrl}?canceled=1`,
  };
}

function coerceSafeAbsoluteReturnUrl(input: string): string {
  // absolute URL + http(s) + origin allowlist
  // ...
}
```

### API-202 [ORTA] — Portal billing POST endpoint’lerinde JSON Content-Type enforcement eksikti

- Dosya: `apps/api/src/routes/portal-billing.ts`
- Duzeltme: `validateJsonContentType` preHandler eklendi (checkout/portal/portal-session + legacy alias).

```655:703:apps/api/src/routes/portal-billing.ts
fastify.post(
  "/portal/billing/checkout",
  { preHandler: [requirePortalUser, requireStepUp("portal"), validateJsonContentType] },
  async (request, reply) => {
    // ...
  }
);
```

### API-203 [ORTA] — AI Inbox POST endpoint’lerinde JSON Content-Type enforcement eksikti

- Dosya: `apps/api/src/routes/portal-ai-inbox.ts`
- Duzeltme: Tum AI inbox POST endpoint’lerine `validateJsonContentType` eklendi; `locale` whitelisting yapildi.

```36:66:apps/api/src/routes/portal-ai-inbox.ts
fastify.post(
  "/portal/conversations/:id/ai-suggest",
  {
    preHandler: [
      requirePortalUser,
      requirePortalRole(["owner", "admin", "agent"]),
      createRateLimitMiddleware({ limit: 20, windowMs: 60000 }),
      validateJsonContentType,
    ],
  },
  async (request, reply) => {
    const localeRaw = (request.body as any)?.locale;
    const locale = localeRaw === "tr" || localeRaw === "en" || localeRaw === "es" ? localeRaw : "en";
    // ...
  }
);
```

### API-204 [ORTA] — Portal notifications endpoint’lerinde rate limit yoktu

- Etki: Notification list/unread-count/read-all endpoint’leri polling ile DB’yi yormaya acikti.
- Dosya: `apps/api/src/routes/portal-notifications.ts`
- Duzeltme: `createRateLimitMiddleware` eklendi; preferences update icin `validateJsonContentType` eklendi.

```56:71:apps/api/src/routes/portal-notifications.ts
fastify.get(
  "/portal/notifications",
  { preHandler: [requirePortalUser, createRateLimitMiddleware({ limit: 60, windowMs: 60000 })] },
  async (request) => {
    // ...
  }
);
```

### API-205 [ORTA] — Macro update endpoint’inde maxLength/empty validation eksikti

- Dosya: `apps/api/src/routes/portal-macros.ts`
- Duzeltme: Update’te de create ile ayni max length ve trim/empty kontrolleri eklendi.

### API-206 [ORTA] — Workflow update endpoint’inde JSON size validation eksikti

- Dosya: `apps/api/src/routes/portal-workflows.ts`
- Duzeltme: `conditionsJson/actionsJson` icin 32KB limiti + `name` trim/max length eklendi.

### API-207 [DUSUK] — AI test endpoint upstream hata detaylarini dondurebiliyordu

- Dosya: `apps/api/src/routes/portal-ai-config.ts`
- Duzeltme: 500’lerde sabit mesaj; `validateJsonContentType` + `message` max length eklendi.

### API-208 [DUSUK] — embed.js error response production’da bilgi sizdiriyordu

- Dosya: `apps/api/src/routes/embed.ts`
- Duzeltme: Production’da 404 + “Not found”; non-prod’da debug mesaj kaldi.

```13:40:apps/api/src/routes/embed.ts
const isProduction = process.env.NODE_ENV === "production";
reply.code(isProduction ? 404 : 500);
return reply.send({
  error: {
    code: "EMBED_BUILD_MISSING",
    message: isProduction ? "Not found" : "Widget embed build missing. Run: pnpm --filter @helvino/widget build",
  },
});
```

### API-209 [DUSUK] — Widget settings icin route-level bodyLimit override yoktu (global 32KB ile celiski)

- Etki: Handler icinde 256KB hedeflenmis olsa da global `bodyLimit: 32KB` daha once request’i kesiyordu.
- Dosya: `apps/api/src/routes/portal-widget-settings.ts`
- Duzeltme: PUT route’larina `bodyLimit: 256 * 1024` eklendi.

```246:258:apps/api/src/routes/portal-widget-settings.ts
fastify.put(
  "/internal/widget/settings",
  {
    // ...
    bodyLimit: 256 * 1024,
  },
  async (request, reply) => {
    // ...
  }
);
```

## MANUEL GEREKLI BULGULAR (🔧 NEEDS MANUAL FIX)

### MANUAL-201 — TRUSTED_PROXIES Railway’e gore dogru ayarlanmalı (rate limit / IP keying bypass riski)

- Dosya: `apps/api/src/index.ts`
- Sorun: `trustProxy` davranisi `TRUSTED_PROXIES` env ile belirleniyor. Railway proxy zinciri dogru set edilmezse `X-Forwarded-For` spoofing ile IP-based keying ve limitler yanlis calisabilir.
- Cozum plani:
  - Railway ortaminda gercek proxy header zincirini dogrula.
  - `TRUSTED_PROXIES`’i Railway dokumanina gore set et (gerekirse `loopback,linklocal,uniquelocal` veya spesifik proxy IP araligi).
  - Prod’da `getRealIP()` loglarini audit ederek dogrula.

## ZATEN GUVENLI (✅ PASS) — SECILMIS NOTLAR

- CORS: wildcard `*` ve `*.` pattern’leri allowlist’ten otomatik dislaniyor; production’da allowlist bos ise cross-origin tamamen blok.
- CSRF: cookie-auth surface icin unsafe method’larda Origin allowlist kontrolu var (`/portal`, `/internal`).
- SQLi: `apps/api/src` altinda `$executeRawUnsafe` bulunmadi.
- IDOR: Portal route’larda org scope genelde `orgId` ile enforced (conversation, macro, workflow, notification).
- Error handling: Global error handler production’da stack trace sizdirmiyor.

## CHECKLIST (40 MADDE): ✅ PASS / ✅ FIXED / 🔧 MANUAL

### A. IDOR
1. ✅ PASS — `/portal/conversations/:id` orgId filtreli
2. ✅ PASS — `/portal/customers/:id` route yok (mevcut degil)
3. ✅ PASS — `/portal/widget/settings` orgId session’dan (ID body ile override edilemiyor)
4. ✅ PASS — DELETE endpoint’lerde org-scoped guard pattern’i var
5. ✅ PASS — Portal route’larda orgId filtreleme yaygin

### B. Input Validation
6. ✅ PASS — Zod + manual validation karisik (kritik endpoint’lerde mevcut)
7. ✅ FIXED — Macro/workflow update maxLength/empty kontrolleri eklendi
8. ✅ PASS — Numerik alanlarda min/max ornekleri mevcut (SLA/operating-hours vb.)
9. ✅ PASS — Email validation (zod + regex + trim)
10. ✅ FIXED — Stripe returnUrl allowlist (open redirect kapandi)
11. ✅ PASS — File upload endpoint bulunmadi (config flag var ama API route yok)
12. ✅ FIXED — Buyuk payload gerektiren route’lara bodyLimit override eklendi

### C. SQL Injection
13. ✅ PASS — `$executeRawUnsafe` yok
14. ✅ PASS — Raw query’ler parametrik template ile
15. ✅ PASS — Prisma query’lerinde user input dogrudan raw SQL’e gitmiyor

### D. Rate Limiting
16. ✅ PASS — Global rate limit mevcut (`GLOBAL_HTTP`)
17. ✅ PASS — Auth endpoint’lerinde ozel rate limit var
18. ✅ PASS — Per-IP ve per-user/per-org key builder pattern’i var
19. 🔧 MANUAL — `TRUSTED_PROXIES` prod ayari dogrulanmali
20. ✅ PASS — 429 + `Retry-After` var (redis-based middleware)

### E. Authentication & Authorization
21. ✅ PASS — Protected endpoint’lerde `requirePortalUser` / `requireAdmin`
22. ✅ PASS — Role checks (owner/admin/agent) uygulanmis
23. ✅ PASS — Admin endpoint’leri session tabanli
24. ✅ PASS — Public widget endpoints ayrik (bootloader vs portal)

### F. CSRF Protection
25. ✅ PASS — cookie-auth surface icin Origin kontrolu (global hook)
26. ✅ PASS — Cookie policy merkezi politikalarda
27. ✅ PASS — Origin allowlist CORS ile uyumlu

### G. Error Handling
28. ✅ PASS — Production’da stack trace donmuyor (global error handler)
29. ✅ PASS — Production 500 response’larda generic envelope
30. ✅ FIXED — Internal config leak azaltildi (embed/ai errors)
31. ✅ PASS — Error envelope tutarli (requestId)
32. ✅ PASS — 404/403 ayrimi genel olarak uygun
33. ✅ PASS — Prisma mesajlari production 500’de sanitize
34. ✅ PASS — Generic cevaplar/limits ile leak azaltma yaklasimi var

### H. CORS & Headers
35. ✅ PASS — CORS whitelist; wildcard ignored
36. ✅ PASS — `credentials: true` iken origin `*` yok
37. ✅ PASS — Helmet + security headers plugin aktif
38. ✅ PASS — API versioning formal degil (risk degil)

### I. Mass Assignment & Data Exposure
39. ✅ PASS — `data: request.body` / `...request.body` pattern’i bulunmadi
40. ✅ PASS — select/include bircok yerde minimize edilmis

## IDOR TEST SENARYOLARI (curl)

1) Baska org conversation read denemesi:
```bash
curl -i "https://api.helvion.io/portal/conversations/c_OTHER_ORG/read" \
  -X POST -H "Content-Type: application/json" \
  -H "Cookie: helvino_portal_session=ORG_A_COOKIE" \
  -d "{}"
# Beklenen: 404
```

2) Baska org macro update denemesi:
```bash
curl -i "https://api.helvion.io/portal/settings/macros/c_OTHER_ORG_MACRO" \
  -X PUT -H "Content-Type: application/json" \
  -H "Cookie: helvino_portal_session=ORG_A_COOKIE" \
  -d '{"title":"x","content":"y"}'
# Beklenen: 404
```

3) Baska org notification read denemesi:
```bash
curl -i "https://api.helvion.io/portal/notifications/c_OTHER_ORG_NOTIF/read" \
  -X POST \
  -H "Cookie: helvino_portal_session=ORG_A_COOKIE" \
  -d "{}"
# Beklenen: 404
```

## CORS CONFIG (KOD KANITI)

```176:211:apps/api/src/index.ts
const corsPolicy = buildCorsPolicy(process.env.NODE_ENV, [
  process.env.APP_PUBLIC_URL,
  process.env.NEXT_PUBLIC_WEB_URL,
  process.env.ALLOWED_ORIGINS,
  process.env.FRONTEND_URL,
  "https://gracious-expression-production-7caa.up.railway.app",
  "https://helvion.io",
  "https://www.helvion.io",
  "https://helvion-landing.pages.dev",
]);
```

## RATE LIMIT CONFIG (KOD KANITI)

- Global: `GLOBAL_HTTP` 200 / dakika / IP (`apps/api/src/index.ts`)
- Redis-based: `createRateLimitMiddleware()` 429 + Retry-After (`apps/api/src/middleware/rate-limit.ts`)
- In-memory: `rateLimit()` 429 + Retry-After (`apps/api/src/middleware/rate-limiter.ts`)

## DEGISTIRILEN DOSYALAR

- `apps/api/src/utils/stripe.ts` — Stripe returnUrl allowlist / open redirect fix
- `apps/api/src/routes/portal-billing.ts` — returnUrl validation error mapping + JSON Content-Type
- `apps/api/src/routes/embed.ts` — production info-leak fix
- `apps/api/src/routes/portal-ai-inbox.ts` — JSON Content-Type + locale whitelist
- `apps/api/src/routes/portal-ai-config.ts` — JSON Content-Type + upstream error sanitization
- `apps/api/src/routes/portal-notifications.ts` — rate limit + JSON Content-Type (prefs update)
- `apps/api/src/routes/portal-macros.ts` — update validation
- `apps/api/src/routes/portal-workflows.ts` — update validation
- `apps/api/src/routes/portal-widget-settings.ts` — route-level bodyLimit override
- `apps/api/src/routes/analytics.ts` — rate limit + period input bound
