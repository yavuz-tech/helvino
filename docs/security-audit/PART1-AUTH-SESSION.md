# HELVION SECURITY AUDIT REPORT — PART 1/10
# Authentication & Session Security
```
═══════════════════════════════════════════════════════════
HELVION SECURITY AUDIT REPORT — PART 1/10
Authentication & Session Security
Tarih: 2026-02-15
Mod: AUDIT + AUTO-FIX | Ortam: Railway Production
═══════════════════════════════════════════════════════════
```

## EXECUTIVE SUMMARY

Otomatik düzeltilen: 6 | Manuel gereken: 7 | Güvenli: 22

Bu turda odak: portal/admin authentication akislari, session/token tasarimi, MFA (TOTP + backup codes), brute-force ve CSRF/Origin kontrolleri. Kodda zaten ciddi guvenlik iyi uygulamalari var (Argon2id, DB-backed session revocation, timing-safe compare, MFA backup codes hash, trustProxy notlari, rate limiting). Aşağıdaki başlıklarda ek hardening yapıldı.

## OTOMATİK DÜZELTİLEN BULGULAR (✅ FIXED)

### ✅ FIXED-001: MFA secret plaintext saklanıyordu → AES-256-GCM ile şifreli saklama
- **Dosyalar:** `apps/api/src/routes/portal-mfa.ts`, `apps/api/src/routes/admin-mfa.ts`
- **Ne buldum:** `mfaSecret` DB'ye plaintext yazılıyordu (DB sızıntısında TOTP compromise).
- **Ne düzelttim:** Setup sırasında `encryptMfaSecret()` ile saklama; verify/disable/challenge/login-verify aşamalarında `decryptMfaSecret()` ile çözme.
- **Not:** `apps/api/src/utils/mfa-encryption.ts` zaten vardı; route'lar kullanmıyordu.

### ✅ FIXED-002: Portal step-up cookie cross-origin deploy'da çalışmıyordu (SameSite=Lax)
- **Dosya:** `apps/api/src/routes/portal-mfa.ts`
- **Ne buldum:** `helvino_portal_stepup` cookie `sameSite: "lax"` set ediliyordu; `app.helvion.io` → `api.helvion.io` gibi cross-site POST'larda cookie gönderilmez (step-up her zaman fail).
- **Ne düzelttim:** Step-up cookie set ederken `getPortalCookiePolicy()` kullanıldı (cross-origin ise `SameSite=None; Secure`).

### ✅ FIXED-003: Step-up token TTL cookie ile tutarsızdı (token exp daha uzundu)
- **Dosya:** `apps/api/src/routes/portal-mfa.ts`
- **Ne buldum:** Step-up cookie maxAge 10 dk iken token exp varsayılan TTL ile üretiliyordu.
- **Ne düzelttim:** `createPortalSessionToken(..., STEP_UP_TTL_MS)` ile token exp = cookie TTL.

### ✅ FIXED-004: MFA login token TTL uzun olabilirdi (MFA token 60 dk)
- **Dosya:** `apps/api/src/routes/portal-auth.ts`
- **Ne buldum:** MFA gerektiren login'de `mfaToken` default TTL ile üretiliyordu.
- **Ne düzelttim:** MFA login token TTL = 5 dk (`MFA_LOGIN_TOKEN_TTL_MS`).

### ✅ FIXED-005: Login timing-based enumeration azaltildi (unknown user vs wrong password)
- **Dosyalar:** `apps/api/src/routes/portal-auth.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/org-auth.ts`
- **Ne buldum:** “user yok” case'i Argon2 verify çalıştırmadan erken dönüyordu (timing farkı).
- **Ne düzelttim:** `verifyPasswordWithDummy()` eklendi ve user yoksa dummy Argon2 verify çalıştırılıyor.

### ✅ FIXED-006: Password policy minimum length 12+ (ve common password kontrolu)
- **Dosyalar:** `apps/api/src/utils/password-validator.ts`, `apps/api/src/utils/password.ts`, `apps/api/src/utils/schemas.ts`
- **Ne buldum:** Minimum uzunluk 8 idi; common-password kontrolü route'larda tutarlı değildi.
- **Ne düzelttim:** Policy varsayılan `PASSWORD_MIN_LENGTH=12`; `validatePasswordStrength()` policy'ye bağlandı; Zod schema min uzunluklar 12'ye yükseltildi.

### ✅ FIXED-007: Refresh endpoint brute-force'a daha açık (rate limit yok)
- **Dosya:** `apps/api/src/routes/portal-auth.ts`
- **Ne buldum:** `/portal/auth/refresh` rate limit olmadan çalışıyordu.
- **Ne düzelttim:** `createRateLimitMiddleware` eklendi (IP bazlı, auditLog=false).

## MANUEL GEREKLİ BULGULAR (🔧 NEEDS MANUAL FIX)

### 🔧 MANUAL-001: Refresh token DB'de plaintext + unique saklanıyor (DB sızıntısı riski)
- **Dosya:** `apps/api/prisma/schema.prisma` (`PortalSession.refreshToken`)
- **Risk:** DB sızıntısında refresh token'lar direkt kullanılabilir.
- **Plan:** Migration ile `refreshTokenHash` alanına geç; sadece hash sakla. Eski token'lar için geçiş dönemi (dual-read) uygula.

### 🔧 MANUAL-002: Refresh token rotation her kullanımda değil (concurrency trade-off)
- **Dosya:** `apps/api/src/routes/portal-auth.ts`
- **Risk:** Rotation “yaklaşık expiry” ile sınırlı. Her refresh’te rotation istenirse multi-tab / parallel refresh yarışlarında istemsiz logout riski var.
- **Plan:** DB şemasıyla `previousRefreshTokenHash` + kısa grace window (örn. 2 dk) ekle; reuse detection + revoke on reuse.

### 🔧 MANUAL-003: Portal access token TTL 60 dk (hedef ≤15 dk) tasarım trade-off'u
- **Dosyalar:** `apps/api/src/utils/portal-session.ts`, `apps/web/src/lib/portal-auth.ts`
- **Risk:** Access cookie daha uzun; fakat refresh token XSS riskine karşı kalıcı storage'da tutulmuyor (bilinçli trade-off).
- **Plan:** Refresh token'ı httpOnly cookie'ye taşı (path-scoped) + CSRF/Origin guard ile birlikte; access TTL'yi 15 dk'ya indir.

### 🔧 MANUAL-004: Admin & portal secret ayrımı
- **Dosyalar:** `apps/api/src/index.ts`, `apps/api/src/utils/portal-session.ts`
- **Risk:** `SESSION_SECRET` hem admin fastify-session hem portal token HMAC için kullanılıyor (key separation eksik).
- **Plan:** `ADMIN_SESSION_SECRET` ve `PORTAL_SESSION_SECRET` ayır; rollout için eski secret ile verify + yeni ile sign (kısa süre).

### 🔧 MANUAL-005: MFA_ENCRYPTION_KEY production’da zorunlu olmalı
- **Dosya:** `apps/api/src/utils/mfa-encryption.ts`
- **Risk:** Key yoksa plaintext fallback var (uyumluluk modu).
- **Plan:** Production'da startup check: MFA_ENCRYPTION_KEY yoksa MFA setup'i kapat veya server boot fail (tercihen fail-fast).

### 🔧 MANUAL-006: trustProxy/TRUSTED_PROXIES Railway için doğru set edilmeli
- **Dosya:** `apps/api/src/index.ts`
- **Risk:** Yanlış konfig: rate limit / audit IP kalitesi düşer. Fazla geniş trustProxy ise XFF spoof riskine döner.
- **Plan:** Railway proxy zincirine uygun `TRUSTED_PROXIES` değerini belirle (platform dokümanı + gerçek header davranışı).

### 🔧 MANUAL-007: Pwned password (HIBP k-anon) entegrasyonu yok
- **Risk:** Common list + complexity yeterli değil; breach'ten gelen zayıf parolalar engellenmiyor.
- **Plan:** Backend'de signup/reset/change-password sırasında HIBP k-anon sorgusu (rate limit + caching).

## ZATEN GÜVENLİ (✅ PASS)

- `Argon2id` kullanımı ve parametreler (aşağıdaki kanıt kodu)
- Portal session DB-backed revocation kontrolü (`tokenHash` ile) + `revokedAt`
- Backup code'ların hash saklanması + single-use (consume ile silme)
- TOTP doğrulamada ±1 window (30sn tolerans)
- Refresh token memory-only (frontend) — XSS riskini azaltır (trade-off: page refresh sonrası refresh token kaybolur)
- Global CSRF/Origin kontrolu (cookie-auth surface için) + CORS allowlist

## KANIT / MANDATORY VERIFICATION

### Okunan auth route dosyalari (liste)
- `apps/api/src/routes/auth.ts` (admin auth)
- `apps/api/src/routes/portal-auth.ts`
- `apps/api/src/routes/portal-signup.ts`
- `apps/api/src/routes/portal-mfa.ts`
- `apps/api/src/routes/admin-mfa.ts`
- `apps/api/src/routes/org-auth.ts` (legacy)
- Ek: `apps/api/src/routes/portal-security.ts`, `apps/api/src/routes/recovery-routes.ts`

### JWT/secret hardcoded degil (kanit)
- Portal token imzasi `SESSION_SECRET` env ile:
```186:212:apps/api/src/utils/portal-session.ts
export function createPortalSessionToken(
  payload: Omit<PortalSessionPayload, "iat" | "exp">,
  secret: string,
  ttlMs = PORTAL_ACCESS_TOKEN_TTL_MS
): string {
  // ...
  const signature = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}
```
- Admin session secret `SESSION_SECRET` env ile zorunlu:
```234:255:apps/api/src/index.ts
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

fastify.register(session, {
  secret: sessionSecret,
  // ...
});
```

### Password hashing (Argon2 parametreleri dahil)
```15:22:apps/api/src/utils/password.ts
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}
```

### Rate limit config (kanit)
```106:146:apps/api/src/middleware/rate-limit.ts
export function createRateLimitMiddleware(config: RateLimitConfig) {
  // ...
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const realIp = getRealIP(request);
    // ...
    const result = await checkRateLimit(rateLimitKey, effectiveLimit, config.windowMs);
    // ...
    if (!result.allowed) {
      reply.code(429);
      return reply.send({ error: { code: "RATE_LIMITED", /* ... */ } });
    }
  };
}
```

### MFA backup code logic (kanit)
```55:86:apps/api/src/utils/totp.ts
export function generateBackupCodes(): { raw: string[]; hashed: string[] } {
  const raw: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
    raw.push(formatted);
    hashed.push(hashBackupCode(formatted));
  }
  return { raw, hashed };
}

export function tryConsumeBackupCode(code: string, hashedCodes: string[]): string[] | null {
  const codeHash = hashBackupCode(code);
  const index = hashedCodes.indexOf(codeHash);
  if (index === -1) return null;
  const remaining = [...hashedCodes];
  remaining.splice(index, 1);
  return remaining;
}
```

### TypeScript doğrulama (0 hata)
- `npx tsc --noEmit -p apps/api/tsconfig.json` ✅
- `npx tsc --noEmit -p apps/web/tsconfig.json` ✅
- `npx tsc --noEmit -p packages/shared/tsconfig.json` ✅
- `npx tsc --noEmit -p apps/widget/tsconfig.json` ✅

## CHECKLIST: ✅ PASS / ✅ FIXED / 🔧 MANUAL / ❌ OPEN

1. Password hashing algoritması: ✅ PASS (Argon2id)
2. Argon2 parametreleri yeterli mi: ✅ PASS (64MB, t=3, p=4) *(performans/sertlestirme izleme önerilir)*
3. Minimum password length 12+: ✅ FIXED
4. Password complexity kontrolü: ✅ PASS
5. Pwned password kontrolü: 🔧 MANUAL
6. JWT secret env’den mi: ✅ PASS (SESSION_SECRET env; hardcoded yok)
7. JWT expiration süreleri: 🔧 MANUAL (portal access TTL 60dk; hedef ≤15dk)
8. Refresh token rotation: 🔧 MANUAL (partial rotation var)
9. Token revocation: ✅ PASS (portalSession.revokedAt)
10. JWT payload hassas veri: ✅ PASS (userId/orgId/role)
11. Admin ve portal secret farkli mi: 🔧 MANUAL
12. Session httpOnly cookie: ✅ PASS
13. Session secure flag: ✅ PASS
14. Session sameSite: ✅ PASS (portal policy dinamik; admin lax)
15. Concurrent session limit: ✅ PASS (portal max sessions)
16. Session fixation korumasi: ✅ FIXED (admin + legacy org: best-effort regenerate)
17. MFA secret encrypted saklama: ✅ FIXED
18. TOTP time window: ✅ PASS (window=1)
19. Backup codes hash: ✅ PASS
20. Backup codes single-use: ✅ PASS
21. MFA setup QR güvenliği: ✅ PASS (setup + verify gating; best-effort)
22. MFA bypass mekanizması: ✅ PASS (backup codes + recovery flows; auditlog var)
23. Login rate limit: ✅ PASS
24. Rate limit degerleri: ✅ PASS (portal 5/15dk; admin 3/15dk)
25. Account lockout: ✅ PASS
26. Unlock mekanizması: ✅ PASS (hashed token + TTL)
27. CAPTCHA entegrasyonu: ✅ PASS (Turnstile; conditional)
28. Rate limit XFF ile bypass: 🔧 MANUAL (trustProxy doğru set edilmeli)
29. User enumeration: ✅ PASS (generic mesajlar; timing hardening eklendi)
30. Timing attack: ✅ FIXED
31. Login notification email: ✅ PASS
32. Geo/IP change detection: ✅ PASS
33. Trusted device mekanizması: ✅ PASS
34. Reset token expire: ✅ PASS (signed link + DB token expiry; 1h hedefi korunuyor)
35. Reset token single-use: ✅ PASS (usedAt set + revoke sessions)

## DEĞİŞTİRİLEN DOSYALAR

- `apps/api/src/utils/password-validator.ts`: policy min length 12 (env: `PASSWORD_MIN_LENGTH`)
- `apps/api/src/utils/password.ts`: policy entegrasyonu + dummy verify + mesaj güncelleme
- `apps/api/src/utils/schemas.ts`: signup/reset minimum password 12
- `apps/api/src/routes/portal-auth.ts`: MFA token TTL 5dk + refresh rate limit + dummy verify
- `apps/api/src/routes/auth.ts`: dummy verify + best-effort session regenerate
- `apps/api/src/routes/org-auth.ts`: dummy verify + best-effort session regenerate
- `apps/api/src/routes/portal-mfa.ts`: MFA secret encrypt/decrypt + step-up cookie policy + TTL düzeltme
- `apps/api/src/routes/admin-mfa.ts`: MFA secret encrypt/decrypt
- `package.json`: `typescript` devDependency (typecheck için)
- `pnpm-lock.yaml`: dependency lock update

