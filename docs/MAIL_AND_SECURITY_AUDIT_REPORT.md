# Mail & Güvenlik Denetim Raporu

**Tarih:** 2026-02-08  
**Kapsam:** E-posta akışları, imzalı linkler, şifreleme, oturum güvenliği.

---

## 1. E-posta Akışları (Özet)

| Akış | Endpoint | İmzalı link | Tek kullanım | Rate limit | Durum |
|------|----------|-------------|--------------|------------|--------|
| **Davet** | POST /portal/org/users/invite, resend | Evet (HMAC) | Evet (acceptedAt) | 10/dk | ✅ |
| **Şifre sıfırlama** | POST /portal/auth/forgot-password → reset-password | Evet (HMAC) | Evet (usedAt) | 5/dk | ✅ |
| **E-posta doğrulama** | GET /portal/auth/verify-email | Evet (verifyEmailSignature) | Idempotent | Rate limit | ✅ |
| **Kayıt doğrulama** | POST /portal/auth/signup, resend-verification | Evet | - | Rate limit | ✅ |
| **Recovery onay/red** | Internal approve/reject | - | - | - | ✅ |
| **Emergency token** | POST /portal/emergency/generate | - | Tek gösterim | Cooldown | ✅ |

Tüm e-posta gönderimlerinde artık `from: getDefaultFromAddress()` kullanılıyor; davet ve şifre sıfırlama maillerinde plain-text alternatif eklendi (teslimat/spam için).

---

## 2. İmzalı Linkler (Signed Links)

- **Algoritma:** HMAC-SHA256, `type:token:expiresMs` formatında imza.
- **Secret:** `SIGNED_LINK_SECRET` veya `SESSION_SECRET` (production’da mutlaka ayarlanmalı).
- **Verify-email:** API tarafında `verifyEmailSignature(email, expires, sig)` ile doğrulanıyor.
- **Reset-password:** Frontend artık URL’den `expires` ve `sig` gönderiyor; API opsiyonel olarak `verifySignedLink` ile doğruluyor (sahte/uzatılmış link engellenir).
- **Accept-invite:** Aynı şekilde `expires` ve `sig` gönderiliyor; API’de opsiyonel imza doğrulaması eklendi.

Link türleri: `invite`, `reset`, `recovery`, `emergency`, `verify_email`. Süre aşımı hem imza içinde hem DB’de (invite/reset token expiry) kontrol ediliyor.

---

## 3. Şifre ve Oturum

- **Şifre hash:** Argon2id (memoryCost 64MB, timeCost 3). ✅
- **Şifre politikası:** En az 8 karakter, en az 1 harf, en az 1 rakam. Hem reset-password hem accept-invite’ta (API + frontend) uygulanıyor. ✅
- **Portal oturum:** HMAC-SHA256 ile imzalı JWT-benzeri token, 7 gün TTL, httpOnly + sameSite=lax + production’da secure cookie. ✅
- **Şifre sıfırlandıktan sonra:** Tüm portal oturumları iptal edilir; kullanıcı yeni token ile giriş yapar. ✅

---

## 4. Yapılan Düzeltmeler

1. **Reset-password API:** İsteğe bağlı `expires` ve `sig` ile imzalı link doğrulaması eklendi; şifre sıfırlama mailine `from` ve `text` eklendi.
2. **Accept-invite API:** İsteğe bağlı imzalı link doğrulaması; şifre politikası (harf + rakam) zorunlu; davet mailine `text` eklendi.
3. **Invite/Reset e-posta şablonları:** `getInviteEmail` ve `getResetEmail` artık plain-text alan döndürüyor (teslimat/spam iyileştirmesi).
4. **Tüm mail gönderimleri:** `from: getDefaultFromAddress()` kullanılıyor (portal-signup, recovery approve/reject, portal-security forgot-password).
5. **Frontend reset-password:** URL’den `expires` ve `sig` alınıp API’ye gönderiliyor.
6. **Frontend accept-invite:** Şifre için harf+rakam kontrolü; `expires` ve `sig` API’ye gönderiliyor.

---

## 5. Çalışmayan veya Eksik Yapı

- **Yok.** Denetlenen akışlar tutarlı; imza doğrulama ve şifre politikası davet ve şifre sıfırlamada uygulanıyor. E-posta teslimi Resend ile yapılıyor; domain doğrulandıktan sonra `support@helvion.io` kullanılabilir.

---

## 6. Öneriler

1. **Production:** `SIGNED_LINK_SECRET` ve `SESSION_SECRET` güçlü ve benzersiz değerlerle ayarlanmalı.
2. **E-posta:** Resend’de `helvion.io` domain doğrulandığında `.env` içinde `EMAIL_FROM` / `MAIL_FROM` tekrar `Helvion <support@helvion.io>` yapılmalı.
3. **Rate limit:** Hassas uçlar (forgot-password, accept-invite, reset-password) zaten rate limit’li; gerekirse pencereler daraltılabilir.

---

*Rapor, mail ve güvenlik akışları kod incelemesi ve yapılan değişikliklere göre oluşturulmuştur.*
