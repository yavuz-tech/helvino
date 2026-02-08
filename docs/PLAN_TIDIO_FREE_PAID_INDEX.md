# Çalışma Planı — Tidio Free vs Paid → Helvino Paket Mimarisi

Bu dizin, “Tidio Free vs Paid ayrımını netleştirme” ve Helvino paket mimarisine uyarlama çalışma planının çıktılarını toplar.

---

## Fazlar ve Çıktılar

| Faz | Çıktılar | Doküman |
|-----|----------|---------|
| **FAZ 1** | Net ayrım cümlesi, 3 metrik şeması, Helvino modülleri | [PLAN_FREE_VS_PAID.md](./PLAN_FREE_VS_PAID.md) |
| **FAZ 2** | Paket mimarisi (Free/Pro/Growth/Enterprise), limitler, gating, add-on | [PLAN_PACKAGE_ARCHITECTURE.md](./PLAN_PACKAGE_ARCHITECTURE.md) |
| **FAZ 3** | Feature matrix, paywall/upsell UX, “Hangi yükseltme gerekir?” | [PLAN_FEATURE_MATRIX.md](./PLAN_FEATURE_MATRIX.md) ✅ |
| **FAZ 4** | Backend enforcement, PlanGuard, branding override, domain/telemetry | (mevcut: `entitlements.ts`, `billing-enforcement.ts`) |
| **FAZ 5** | Dokümantasyon, pricing sayfası | (mevcut: `STEP_11_31_PRICING_UX.md`, portal billing) |
| **FAZ 6** | Abuse test, QA checklist | (sonra eklenecek) |

---

## Hızlı Referans

- **5 net kural:** [PLAN_FREE_VS_PAID.md#1-beş-net-kural](./PLAN_FREE_VS_PAID.md#1-beş-net-kural-tidiodan-uyarlama)
- **3 metrik (M1/M2/M3):** [PLAN_FREE_VS_PAID.md#2-üç-metrikli-ölçeklendirme-şeması](./PLAN_FREE_VS_PAID.md#2-üç-metrikli-ölçeklendirme-şeması)
- **Paket kararları:** [PLAN_PACKAGE_ARCHITECTURE.md#1-paket-isimleri](./PLAN_PACKAGE_ARCHITECTURE.md#1-paket-isimleri-ve-hedef-kitle)
- **Free net liste:** [PLAN_PACKAGE_ARCHITECTURE.md#2-ücretsiz-free](./PLAN_PACKAGE_ARCHITECTURE.md#2-ücretsiz-free--net-karar-listesi)
- **Gating (hangi özellik nerede):** [PLAN_PACKAGE_ARCHITECTURE.md#4-gating-ilkeleri](./PLAN_PACKAGE_ARCHITECTURE.md#4-gating-ilkeleri-hangi-özellik-nerede-başlar)
- **Feature matrix:** [PLAN_FEATURE_MATRIX.md](./PLAN_FEATURE_MATRIX.md)

---

## Başlangıç Onayı

1. **Paket adları:** Free / Pro / Growth / Enterprise ✅  
2. **Free:** 1 temsilci ✅, upload + crop ✅, çalışma saatleri ✅, branding kaldırma ❌  
3. **Sonra:** FAZ 3 feature matrix → FAZ 4 enforcement (UI + backend).
