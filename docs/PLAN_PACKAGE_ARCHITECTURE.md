# Helvino — Paket Mimarisi (FAZ 2)

**Hedef:** Free / Pro / Growth / Enterprise paketlerini net limitler ve gating ilkeleriyle tanımlamak; add-on mantığını (AI, Otomasyon, No Branding) çerçevelemek.

---

## 1. Paket İsimleri ve Hedef Kitle

| Paket | Hedef | Özet |
|-------|--------|------|
| **Free** | Tek kişi / mikro işletme | Çalışır ürün, 1 temsilci, temel özelleştirme, branding sabit. |
| **Pro** | Küçük ekip, büyüyen hacim | 3 temsilci, temel analitik + inbox verimi, **branding kaldırma** açılır. |
| **Growth** | Orta ölçek, ekip operasyonu | Yüksek kotalar, rol/izin, atama, gelişmiş analitik, multi-site / multi-widget. |
| **Enterprise** | Kurumsal, uyumluluk | SSO, audit, SLA, dedicated support, custom branding + custom limitler. |

**Karar:** Paket adları **Free / Pro / Growth / Enterprise** olarak kullanılacak. (Mevcut “business” Growth ile eşleştirilebilir veya yeniden adlandırılabilir.)

---

## 2. Ücretsiz (Free) — Net Karar Listesi

| Özellik | Free’de | Not |
|---------|---------|-----|
| Temsilci sayısı | **1** | ✅ |
| Widget: tema, renk, boyut, launcher | ✅ | Temel özelleştirme |
| Avatar / logo: upload + crop | ✅ | |
| Çalışma saatleri (schedule) | ✅ | Temel schedule |
| **Branding: “Helvino tarafından desteklenmektedir”** | **KALICI (kapatılamaz)** | ❌ Kaldırma sadece ücretli |
| M1: Human conversations | Düşük kota (sayı sonra) | Mevcut plan limiti ile uyumlu |
| M2: AI conversations | Yok veya çok düşük | Add-on veya Pro’da başlar |
| M3: Automations reached visitors | Yok veya çok düşük | Add-on veya Pro’da başlar |

---

## 3. Paket Bazlı Limitler (Taslak — Sayılar Sonra Doldurulacak)

Üç metrik: **M1** (human conversations), **M2** (AI conversations), **M3** (automations reached visitors).

| Paket | Temsilci | M1 (human) | M2 (AI) | M3 (automation visitors) | Branding kaldırma |
|-------|----------|------------|---------|--------------------------|-------------------|
| **Free** | 1 | Düşük | — | — | ❌ |
| **Pro** | 3 | Orta | Kota veya add-on | Kota veya add-on | ✅ |
| **Growth** | 10+ | Yüksek | Dahil / add-on | Dahil / add-on | ✅ |
| **Enterprise** | Custom | Custom | Custom | Custom | ✅ + custom |

*Sayısal limitler (örn. 50 / 500 / 2000 konuşma) product ve Stripe tarafında netleştirildikten sonra bu tabloya yazılacak.*

---

## 4. Gating İlkeleri (Hangi Özellik Nerede Başlar)

| Özellik | Free | Pro | Growth | Enterprise |
|---------|------|-----|--------|------------|
| Widget (tema, renk, boyut, launcher) | ✅ | ✅ | ✅ | ✅ |
| Avatar/logo upload + crop | ✅ | ✅ | ✅ | ✅ |
| Çalışma saatleri (temel) | ✅ | ✅ | ✅ | ✅ |
| Branding kaldırma | ❌ | ✅ | ✅ | ✅ |
| Temel analitik | Sınırlı | ✅ | ✅ | ✅ |
| Etiket, not, basit makro (inbox) | ❌ | ✅ | ✅ | ✅ |
| Rol / izin, atama | ❌ | Sınırlı | ✅ | ✅ |
| Gelişmiş analitik | ❌ | ❌ | ✅ | ✅ |
| Multi-site / multi-widget | ❌ | ❌ | ✅ | ✅ |
| AI Agent (M2 kota) | ❌ | Add-on veya dahil | Dahil / add-on | Custom |
| Otomasyon (M3) | ❌ | Add-on veya dahil | Dahil / add-on | Custom |
| SSO / audit / compliance | ❌ | ❌ | ❌ | ✅ |
| Dedicated support / SLA | ❌ | ❌ | ❌ | ✅ |
| Custom branding + limitler | ❌ | ❌ | ❌ | ✅ |

---

## 5. Add-on Mantığı

- **“Hepsi dahil tek paket”** yerine seçilebilir add-on’lar:
  - **AI Agent:** M2 kotası (aylık AI conversation limiti).
  - **Otomasyon / Flows:** M3 (aylık automations reached visitors).
  - **No Branding:** Paket içi (Pro ve üzeri) veya ayrı add-on olarak fiyatlanabilir.
- Fiyatlandırma ve Stripe SKU’ları ayrı dokümanda netleştirilecek.

---

## 6. Mevcut Kod ile Uyum

- **Plan modeli:** `key` (free / pro / business) ve `maxAgents`, `maxConversationsPerMonth`, `maxMessagesPerMonth` mevcut. Growth/Enterprise için yeni plan kayıtları veya `key` eşlemesi eklenebilir.
- **Branding:** Şu an widget’ta “Helvino tarafından desteklenmektedir” her zaman gösteriliyor. Free’de `brandingRemovable: false` (server-side), ücretli planda `true` — config client’a güvenilmez; **server-side override** (bootloader / portal config API) ile uygulanacak.
- **M2 / M3:** Usage/Plan’a yeni alanlar (örn. `aiConversationsThisMonth`, `automationReachedVisitors`) ve entitlement kontrolleri FAZ 4’te eklenecek.

---

## 7. Sonraki Adımlar

- **FAZ 3:** Feature matrix (tek sayfa) + ürün içi paywall/upsell ekranları + “Hangi yükseltme gerekir?” yardım içeriği.
- **FAZ 4:** Backend enforcement (PlanGuard/Entitlements), branding server-side override, domain allowlist, kullanım sayaçları.
- **FAZ 5:** Dokümantasyon + pricing sayfası.
- **FAZ 6:** Abuse test senaryoları, QA checklist.

---

## Başlangıç Onayı (Şimdi Ne Yapacağız?)

1. **Paket adları:** Free / Pro / Growth / Enterprise **onaylandı**.
2. **Free net karar listesi:**
   - Free: 1 temsilci ✅  
   - Avatar/logo upload + crop ✅  
   - Çalışma saatleri (temel) ✅  
   - Branding kaldırma ❌ (sadece ücretli)
3. Sonra: FAZ 3’te feature matrix doldurulacak, FAZ 4’te Cursor ile enforcement (backend + widget config override) geliştirilecek.
