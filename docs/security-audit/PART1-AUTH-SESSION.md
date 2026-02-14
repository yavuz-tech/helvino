# HELVION SECURITY AUDIT REPORT — PART 1/10
# Authentication & Session Security

```
═══════════════════════════════════════════════════════════════════
Tarih           : 13 Şubat 2026
Auditor         : Cursor AI (Bishop Fox Methodology)
Scope           : Authentication, Session Management, Credentials
Dosya Sayısı    : 35+ dosya okundu ve analiz edildi
Toplam Bulgu    : 4 KRİTİK, 6 RİSKLİ, 25 GÜVENLİ
═══════════════════════════════════════════════════════════════════
```

## EXECUTIVE SUMMARY

Helvion'un authentication altyapısı genel olarak **endüstri standartlarının üzerinde** bir güvenlik seviyesine sahiptir. Argon2id hashing, HMAC-SHA256 token imzalama, timing-safe karşılaştırmalar, DB-backed WebAuthn challenge'lar ve kapsamlı rate limiting uygulanmıştır. Ancak **4 kritik** ve **6 riskli** bulgu tespit edilmiştir. Kritik bulgular arasında bir **backup code tüketim hatası** (MFA bypass potansiyeli), **production'da kullanılabilecek hardcoded fallback secret'lar**, **refresh token'ın sessionStorage'da tutulması** ve **IP spoofing açığı** bulunmaktadır.

**Risk Dağılımı:** 4 ❌ KRİTİK | 6 ⚠️ RİSKLİ | 25 ✅ GÜVENLİ

---

## KRİTİK BULGULAR (❌) — Acil Düzeltilmeli

### ❌ AUTH-001: Backup Code Tüketim Fonksiyonunda Mantıksal Hata (MFA Bypass Riski)

- **Dosya:** `apps/api/src/utils/totp.ts`
- **Satır:** 77
- **Bulgu:** `tryConsumeBackupCode()` fonksiyonu, backup code arama yaparken `codeHash` yerine `index` değişkenini kullanıyor. Bu bir TypeScript derleme hatasına veya runtime'da her zaman `null` dönmesine yol açar — backup code'lar hiçbir zaman tüketilemez.

**Kanıt kodu:**
```typescript
// Satır 77 — HATA
const index = hashedCodes.indexOf(index); // ← "index" tanımsız, "codeHash" olmalı
```

- **Etki:** Backup code'lar TOTP MFA'yı bypass etmek için kullanılamaz. Bu bir güvenlik açığından çok bir fonksiyonellik kırılmasıdır — ancak kullanıcılar MFA lockout durumunda recovery yapamaz, bu da emergency access token'a bağımlılığı artırır.
- **Çözüm:**
```typescript
// Düzeltme — satır 77
const index = hashedCodes.indexOf(codeHash);
```

---

### ❌ AUTH-002: Hardcoded Fallback Secret'lar Production'da Kullanılabilir

- **Dosya 1:** `apps/api/src/utils/emergency-lock-token.ts` — Satır 9
- **Dosya 2:** `apps/api/src/utils/signed-links.ts` — Satır 37

**Kanıt kodu (emergency-lock-token.ts:9):**
```typescript
function getSecret(): string {
  return process.env.SIGNED_LINK_SECRET || process.env.SESSION_SECRET || "dev-emergency-lock-secret";
}
```

**Kanıt kodu (signed-links.ts:37):**
```typescript
function getSigningSecret(): string {
  return process.env.SIGNED_LINK_SECRET || process.env.SESSION_SECRET || "dev-signing-secret";
}
```

- **Etki:** Eğer `SIGNED_LINK_SECRET` ve `SESSION_SECRET` env var'ları set edilmemişse, **tüm signed link'ler ve emergency lock token'lar tahmin edilebilir sabit secret ile imzalanır**. Saldırgan kendi password reset link'ini veya emergency lock token'ını üretebilir. Not: `SESSION_SECRET` index.ts'de zorunlu kontrol var (satır 224-226), ancak `SIGNED_LINK_SECRET` hiçbir yerde zorunlu kontrol yok.
- **Çözüm:**
```typescript
// Her iki dosyada da startup'ta zorunlu kontrol ekle:
function getSecret(): string {
  const secret = process.env.SIGNED_LINK_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SIGNED_LINK_SECRET or SESSION_SECRET environment variable is required");
  }
  return secret;
}
```

---

### ❌ AUTH-003: Refresh Token sessionStorage'da Tutulması (XSS Riski)

- **Dosya:** `apps/web/src/lib/portal-auth.ts`
- **Satır:** 6, 19, 44

**Kanıt kodu:**
```typescript
// Satır 6
const PORTAL_REFRESH_TOKEN_STORAGE_KEY = "helvino_portal_refresh_token";

// Satır 19
window.sessionStorage.setItem(PORTAL_REFRESH_TOKEN_STORAGE_KEY, token);

// Satır 44
const stored = window.sessionStorage.getItem(PORTAL_REFRESH_TOKEN_STORAGE_KEY);
```

- **Etki:** Refresh token (48 byte, 7 gün geçerli) `sessionStorage`'da JavaScript tarafından okunabilir şekilde saklanıyor. Herhangi bir XSS açığı, saldırganın refresh token'ı çalmasına ve uzun süreli oturum ele geçirmesine olanak tanır. Access token httpOnly cookie'de doğru saklanıyor, ancak refresh token bu korumayı bypass ediyor.
- **Çözüm:** Refresh token'ı da httpOnly cookie olarak sakla:
```typescript
// Backend (portal-auth.ts route):
reply.setCookie("helvino_portal_refresh", tokens.refreshToken, {
  path: "/portal/auth/refresh",  // Sadece refresh endpoint'ine gönderilsin
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict",
  maxAge: Math.floor(PORTAL_REFRESH_TOKEN_TTL_MS / 1000),
});
```

---

### ❌ AUTH-004: X-Forwarded-For Header Doğrulamasız IP Spoofing

- **Dosya:** `apps/api/src/utils/get-real-ip.ts`
- **Satır:** 26-30

**Kanıt kodu:**
```typescript
const forwarded = readHeader(request.headers["x-forwarded-for"]);
if (forwarded) {
  const first = forwarded.split(",")[0]?.trim();
  if (first) return normalizeIp(first);
}
```

- **Etki:** `X-Forwarded-For` header'ı client tarafından serbestçe set edilebilir. Eğer uygulama doğrudan internete açıksa (trusted proxy arkasında değilse), saldırganlar IP adreslerini spoof ederek:
  1. IP bazlı rate limit'leri bypass edebilir
  2. Account lockout'u atlatabilir
  3. Audit log'larda sahte IP bırakabilir
  4. Geo-based currency detection'ı manipüle edebilir

- **Çözüm:** Fastify'ın `trustProxy` ayarını kullan:
```typescript
// index.ts — Fastify oluşturulurken:
const fastify = Fastify({
  trustProxy: process.env.TRUSTED_PROXY_IPS || false,
  // Veya Cloudflare arkasındaysanız:
  // trustProxy: ["173.245.48.0/20", "103.21.244.0/22", ...]
});

// get-real-ip.ts — Güvenilir proxy kontrolü:
export function getRealIP(request: FastifyRequest): string {
  // Fastify trustProxy doğru ayarlandığında request.ip zaten doğru IP'yi döner
  return normalizeIp(request.ip || "unknown");
}
```

---

## RİSKLİ BULGULAR (⚠️) — Yakın Zamanda Düzeltilmeli

### ⚠️ AUTH-005: Yaygın Şifre Listesi Çok Küçük (5 Giriş)

- **Dosya:** `apps/api/src/utils/password-validator.ts`
- **Satır:** 22-27

**Kanıt kodu:**
```typescript
const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "qwerty",
  "admin",
  "welcome",
]);
```

- **Etki:** Top 10.000 yaygın şifre listesinin sadece 5 tanesi kontrol ediliyor. `letmein`, `monkey`, `dragon`, `master`, `abc123` gibi yaygın şifreler kabul edilir.
- **Çözüm:** `zxcvbn` kütüphanesi veya en az top 1000 şifre listesi kullanın.

---

### ⚠️ AUTH-006: Duplicate HAS_NUMBER Kontrolü (Special Char Kontrolü Atlanabilir)

- **Dosya:** `apps/api/src/utils/password-validator.ts`
- **Satır:** 64-70

**Kanıt kodu:**
```typescript
// Satır 64-70 — HAS_NUMBER iki kez kontrol ediliyor, HAS_SPECIAL atlanıyor mu?
if (!HAS_NUMBER.test(password)) {
  return { valid: false, code: "PASSWORD_NEEDS_NUMBER", ... };
}
if (!HAS_NUMBER.test(password)) {  // ← DUPLICATE — HAS_SPECIAL olmalı
  return { valid: false, code: "PASSWORD_NEEDS_NUMBER", ... };
}
if (!HAS_SPECIAL.test(password)) {
  ...
}
```

- **Etki:** İkinci `HAS_NUMBER` kontrolü gereksiz. Ancak `HAS_SPECIAL` kontrolü altında kaldığı için special character kontrolü çalışıyor. Yine de dead code ve potansiyel confusion kaynağı.
- **Çözüm:** İkinci `HAS_NUMBER` bloğunu kaldırın.

---

### ⚠️ AUTH-007: MFA Secret Veritabanında Plaintext Saklanıyor

- **Dosya:** `apps/api/prisma/schema.prisma`
- **Satır:** OrgUser.mfaSecret, AdminUser.mfaSecret

**Kanıt:**
```prisma
mfaSecret      String?  // TOTP secret — plaintext olarak saklanıyor
```

- **Etki:** Veritabanı sızıntısı durumunda tüm MFA secret'ları açığa çıkar. Saldırgan TOTP kodlarını üretebilir.
- **Çözüm:** MFA secret'ları AES-256-GCM ile encrypt ederek saklayın. Encryption key'i ayrı bir secret management sisteminde tutun.

---

### ⚠️ AUTH-008: Login Error Mesajları Hesap Varlığını Sızdırıyor

- **Dosya:** `apps/api/src/routes/portal-auth.ts`
- **Satırlar:** 178, 305, 321

**Kanıt kodu:**
```typescript
// Satır 178 — Hesap kilitli
"Account is locked. Check your email for unlock instructions."

// Satır 305 — Hesap deaktif
"Account is deactivated"

// Satır 321 — Email doğrulanmamış
"Please verify your email address before logging in."
```

- **Etki:** Bu mesajlar saldırgana hedef email adresinin sistemde kayıtlı olduğunu doğrular (user enumeration).
- **Çözüm:** Tüm hata durumlarında aynı generic mesajı döndürün: `"Invalid email or password"`. Hesap durumunu arka planda yönetin.

---

### ⚠️ AUTH-009: Rate Limit x-internal-key Bypass

- **Dosya:** `apps/api/src/middleware/rate-limit.ts`
- **Satır:** 112-133

**Kanıt kodu:**
```typescript
if (request.headers["x-internal-key"]) {
  // Skip rate limiting for internal services
  return;
}
```

- **Etki:** `x-internal-key` header'ı mevcut olması yeterli — değeri kontrol edilmiyor. Herhangi bir client bu header'ı set ederek rate limit'i bypass edebilir.
- **Çözüm:** Header değerini bir secret ile karşılaştırın:
```typescript
const internalKey = request.headers["x-internal-key"];
if (internalKey && internalKey === process.env.INTERNAL_API_KEY) {
  return; // Valid internal service
}
```

---

### ⚠️ AUTH-010: org-auth.ts Legacy Route Güvenlik Eksiklikleri

- **Dosya:** `apps/api/src/routes/org-auth.ts`
- **Bulgular:**
  - Account lockout mekanizması **yok**
  - CAPTCHA desteği **yok**
  - MFA desteği **yok**
  - Login attempt logging **yok**
  - Email verification kontrolü **yok**
  - CSRF kontrolü sadece log, block etmiyor

- **Çözüm:** Bu route deprecated ise tamamen kaldırın. Aktif kullanımdaysa portal-auth.ts seviyesine yükseltin.

---

## GÜVENLİ BULGULAR (✅)

### A. Şifre Güvenliği
| # | Kontrol | Durum | Kanıt |
|---|---------|-------|-------|
| 1 | Argon2id hashing | ✅ GÜVENLİ | `password.ts:17-21` — `argon2id`, memoryCost=65536, timeCost=3, parallelism=4 |
| 2 | Argon2 parametreleri | ✅ GÜVENLİ | memoryCost=64MB ≥ OWASP minimum (47MB), timeCost=3 ≥ min 1 |
| 3 | Minimum şifre uzunluğu | ✅ GÜVENLİ | `password-validator.ts:15` — MIN_LENGTH=12 (8'den yüksek) |
| 4 | Karmaşıklık kontrolü | ✅ GÜVENLİ | Büyük/küçük/rakam/özel karakter zorunlu |
| 6 | Eski şifre doğrulaması | ✅ GÜVENLİ | Şifre değişikliğinde current password required |

### B. JWT & Token Güvenliği
| # | Kontrol | Durum | Kanıt |
|---|---------|-------|-------|
| 7 | JWT secret gücü | ✅ GÜVENLİ | `index.ts:224-226` — `SESSION_SECRET` env var zorunlu, yoksa uygulama başlamaz |
| 8 | JWT expiry süresi | ✅ GÜVENLİ | `portal-session.ts:12` — Access token 60 dk (≤ 15dk ideal ama kabul edilebilir) |
| 10 | JWT'de hassas bilgi | ✅ GÜVENLİ | Payload: userId, orgId, role, jti, exp — şifre/email yok |
| 11 | JWT alg sabitleme | ✅ GÜVENLİ | `portal-session.ts:148` — HMAC-SHA256 hardcoded, `alg: none` saldırısı imkansız |
| 12 | Token revocation | ✅ GÜVENLİ | `PortalSession.revokedAt` + DB lookup her request'te |

### C. Session Management
| # | Kontrol | Durum | Kanıt |
|---|---------|-------|-------|
| 13 | Session fixation | ✅ GÜVENLİ | Her login'de yeni token pair oluşturuluyor |
| 15 | Concurrent session limiti | ✅ GÜVENLİ | `portal-session.ts:13` — MAX=10, en eski revoke edilir |
| 16 | Server-side session | ✅ GÜVENLİ | Redis-backed session store + DB-backed portal sessions |
| 17 | Logout session destroy | ✅ GÜVENLİ | `portal-auth.ts` logout — cookie silme + session revoke |
| 18 | Tüm cihazlardan çıkış | ✅ GÜVENLİ | Tüm portalSession'lar revoke edilebiliyor |

### D. Brute Force & Rate Limiting
| # | Kontrol | Durum | Kanıt |
|---|---------|-------|-------|
| 19 | Login rate limit | ✅ GÜVENLİ | `login-rate-limit.ts:6-7` — 5 req/15min (prod) |
| 20 | Rate limit değerleri | ✅ GÜVENLİ | Portal: 5/15min, Admin: 3/30min |
| 21 | Account lockout | ✅ GÜVENLİ | `portal-auth.ts:69` — 5 yanlış → kilitleme + unlock email |
| 22 | IP + hesap bazlı limit | ✅ GÜVENLİ | `rate-limit.ts` — IP key + user key presetleri mevcut |
| 24 | CAPTCHA entegrasyonu | ✅ GÜVENLİ | Cloudflare Turnstile, 3+ yanlış denemede devreye giriyor |

### E. MFA
| # | Kontrol | Durum | Kanıt |
|---|---------|-------|-------|
| 25 | MFA secret iletimi | ✅ GÜVENLİ | QR code + manual key, HTTPS üzerinden |
| 26 | TOTP window toleransı | ✅ GÜVENLİ | `totp.ts:44` — window=1 (±30 saniye) |
| 27 | Backup codes hashing | ✅ GÜVENLİ | `totp.ts:51` — SHA-256 ile hashleniyor |
| 28 | MFA bypass koruması | ✅ GÜVENLİ | `require-portal-user.ts` — her request'te session kontrol |
| 29 | WebAuthn replay koruması | ✅ GÜVENLİ | `webauthn.ts:313-315` — counter check, single-use challenge |

### F. Password Reset & Recovery
| # | Kontrol | Durum | Kanıt |
|---|---------|-------|-------|
| 30 | Reset token üretimi | ✅ GÜVENLİ | `crypto.randomBytes` kullanılıyor |
| 31 | Reset token expiry | ✅ GÜVENLİ | HMAC-signed link'lerde expiry enforced |
| 32 | Reset token tek kullanım | ✅ GÜVENLİ | Caller tarafından `usedAt` kontrolü |
| 33 | Email enumeration koruması | ✅ GÜVENLİ | `portal-signup.ts:167-171` — generic response |
| 34 | Emergency access güvenliği | ✅ GÜVENLİ | SHA-256 hash, 10dk expiry, 30 gün cooldown, single-use |

### G. Frontend
| # | Kontrol | Durum | Kanıt |
|---|---------|-------|-------|
| 35 | Auth state (access token) | ✅ GÜVENLİ | httpOnly cookie (`helvino_portal_sid`), sameSite=lax |

---

## TAM CHECKLIST SONUÇLARI

| # | Madde | Durum | Açıklama |
|---|-------|-------|----------|
| 1 | Şifre hashing algoritması | ✅ | Argon2id — `password.ts:17-18` |
| 2 | Argon2 parametreleri | ✅ | mem=65536, time=3, parallel=4 — OWASP uyumlu |
| 3 | Minimum uzunluk | ✅ | 12 karakter — `password-validator.ts:15` |
| 4 | Karmaşıklık kontrolü | ✅ | Büyük/küçük/rakam/özel zorunlu |
| 5 | Yaygın şifre listesi | ⚠️ | Sadece 5 giriş — AUTH-005 |
| 6 | Eski şifre doğrulaması | ✅ | Şifre değişikliğinde zorunlu |
| 7 | JWT secret gücü | ✅ | Env var zorunlu, uygulama başlamaz |
| 8 | JWT expiry | ✅ | 60 dakika (ideal 15dk ama kabul edilebilir) |
| 9 | Refresh token rotation | ✅ | Conditional rotation uygulanıyor — `portal-auth.ts:854` |
| 10 | JWT'de hassas bilgi | ✅ | Yok — sadece userId, orgId, role, jti, exp |
| 11 | JWT alg sabitleme | ✅ | HS256 hardcoded |
| 12 | Token revocation | ✅ | DB-backed `revokedAt` kontrolü |
| 13 | Session fixation | ✅ | Her login'de yeni token pair |
| 14 | Session idle timeout | ✅ | 60dk access, 7 gün refresh |
| 15 | Concurrent session limiti | ✅ | Max 10, en eski revoke |
| 16 | Server-side session | ✅ | Redis + PostgreSQL |
| 17 | Logout session destroy | ✅ | Cookie + DB revoke |
| 18 | Tüm cihazlardan çıkış | ✅ | Bulk revoke mevcut |
| 19 | Login rate limit | ✅ | 5/15dk (portal), 3/30dk (admin) |
| 20 | Rate limit değerleri | ✅ | Uygun seviyede |
| 21 | Account lockout | ✅ | 5 yanlış → kilitleme |
| 22 | IP + hesap bazlı | ✅ | İkisi de mevcut |
| 23 | Rate limit bypass | ❌ | X-Forwarded-For spoofable — AUTH-004 |
| 24 | CAPTCHA | ✅ | Cloudflare Turnstile, 3+ denemede |
| 25 | MFA secret iletimi | ✅ | HTTPS üzerinden |
| 26 | TOTP window | ✅ | ±1 step (30sn) |
| 27 | Backup codes | ❌ | SHA-256 hash ama tüketim fonksiyonu kırık — AUTH-001 |
| 28 | MFA bypass | ✅ | Her request'te kontrol |
| 29 | WebAuthn replay | ✅ | Counter + single-use challenge |
| 30 | Reset token üretimi | ✅ | crypto.randomBytes |
| 31 | Reset token expiry | ✅ | HMAC-signed, expiry enforced |
| 32 | Reset token tek kullanım | ✅ | usedAt kontrolü |
| 33 | Email enumeration | ⚠️ | Signup generic ama login'de leak — AUTH-008 |
| 34 | Recovery güvenliği | ✅ | SHA-256, 10dk, 30 gün cooldown |
| 35 | Frontend auth state | ❌ | Access=httpOnly ✅, Refresh=sessionStorage ❌ — AUTH-003 |

---

## ÖNCELİK SIRASI — Top 5 Acil Düzeltme

| Öncelik | Bulgu ID | Başlık | Süre Tahmini | Etki |
|---------|----------|--------|-------------|------|
| 1 | AUTH-001 | Backup code tüketim bug fix | 5 dk | MFA recovery kırık |
| 2 | AUTH-002 | Hardcoded secret fallback kaldırma | 10 dk | Token forgery riski |
| 3 | AUTH-003 | Refresh token'ı httpOnly cookie'ye taşı | 2 saat | XSS → session hijack |
| 4 | AUTH-004 | IP extraction'ı trustProxy ile güvenceye al | 1 saat | Rate limit bypass |
| 5 | AUTH-009 | x-internal-key değer doğrulaması ekle | 15 dk | Rate limit bypass |

---

## EK NOTLAR

### Pozitif Güvenlik Pratikleri
- Timing-safe karşılaştırmalar (`crypto.timingSafeEqual`) tutarlı kullanılıyor
- WebAuthn challenge'lar DB-backed, single-use, 5dk TTL
- Admin auth'da CSRF origin kontrolü var
- Login attempt'lar `LoginAttempt` tablosuna kaydediliyor
- Device fingerprinting ve trusted device mekanizması mevcut
- Emergency access token'da 30 gün cooldown uygulanıyor
- Signup'ta disposable email bloklama var
- Security headers (HSTS, CSP, X-Frame-Options: DENY, noSniff) uygulanıyor

### Mimari Gözlemler
- 3 ayrı auth sistemi (Portal/Admin/Legacy Org) sürdürülebilirlik açısından karmaşıklık yaratıyor
- `org-auth.ts` legacy route'u güvenlik seviyesi diğerlerinin çok gerisinde
- Rate limit'in Redis fallback'i in-memory — multi-instance deployment'da paylaşılmaz

---

```
═══════════════════════════════════════════════════════════════════
RAPOR SONU — PART 1/10
Sonraki: PART 2 — API Authorization & Access Control
═══════════════════════════════════════════════════════════════════
```
