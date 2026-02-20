# Helvion — Handoff & Son İşlemler

Bu dosya proje durumunu ve en son yapılan işlemleri özetler. Yeni bir geliştirici veya oturum devam ederken referans olarak kullanılabilir.

---

## En Son Tamamlanan İşlemler

### 1. Ziyaretçiler sayfası ve harita
- **Harita**: `react-simple-maps` kaldırıldı, **Leaflet** + OpenStreetMap (CARTO Voyager) tile'ları ile profesyonel dünya haritası eklendi.
- **Konum**: `apps/web/src/components/VisitorsMap.tsx` — mouse ile sürükleyerek pan, scroll ile zoom (sadece harita hareket eder).
- **Plan gating**: Free planda 3 ziyaretçi görünür, geri kalanı blur + "Planı Yükselt" CTA.
- **Demo ziyaretçi**: Portal Ziyaretçiler sayfasında "8 Demo Ekle" butonu eklendi; sadece **demo org + owner** hesabında görünür (`apps/web/src/app/portal/visitors/page.tsx`).
- **Backend**: `POST /portal/dashboard/visitors/seed` — 8 ülkeden demo ziyaretçi oluşturur (TR, US, DE, BR, JP, GB, FR, IN).

### 2. Inbox — Ziyaretçiden tıklayınca doğru konuşma açılsın
- Ziyaretçiler sayfasından bir ziyaretçiye tıklanınca `/portal/inbox?c=<conversationId>` ile yönlendirme yapılıyordu ancak mevcut filtreler (OPEN + unassigned) o konuşmayı gizleyebiliyordu.
- **Düzeltme**: `apps/web/src/app/portal/inbox/PortalInboxContent.tsx` — URL'de `?c=` varsa hedef konuşma her zaman açılıyor; gerekirse filtreler otomatik gevşetiliyor (status=ALL, assigned=any) ve ilgili konuşma seçiliyor.

### 3. Harita metin ve attribution
- Harita üstündeki "MagicMap'ten canlı görüntü" metni daha profesyonel bir ifadeyle değiştirildi.
- OpenStreetMap attribution sadeleştirildi ve minimal stile çekildi (lisans gereği tamamen kaldırılmadı). `apps/web/src/components/VisitorsMap.tsx`.

### 4. Test dosyalarının kaldırılması
- Gereksiz test dosyaları silindi: `seed-visitors.sh`, `test-visitors-seed.html`.

### 5. Crisp tarzı tam site yeniden tasarım planı
- **Plan dosyası**: `~/.cursor/plans/helvion_crisp_redesign_28c91eb6.plan.md` (veya workspace içinde `.cursor/plans/` altında).
- **Kapsam**: Tüm public sayfalar Crisp.chat seviyesinde, koyu mavi-mor palet ile sıfırdan tasarlanacak.
- **Renk paleti**: Primary `#4B45FF`, Hero BG `#0D0D12` → `#13131A`, Footer `#0D0D12`, Surface Alt `#F7F8FA`.
- **Uygulama sırası**: Design tokens → PublicLayout → Ortak bileşenler → Homepage → Pricing → Product → Contact → İkincil sayfalar → Auth sayfaları → Final test.
- **Durum**: Plan onaylandı; **henüz kod tarafında uygulama başlamadı**. Tüm plan todo'ları `pending`.

---

## Crisp Redesign — Sıradaki Adımlar

Plan uygulanırken takip edilecek sıra:

1. **Faz 1a** — `apps/web/src/lib/designTokens.ts`, `apps/web/src/lib/design-tokens.ts`, `apps/web/src/app/globals.css` içinde renkleri yeni palete çevir.
2. **Faz 1b** — `apps/web/src/components/PublicLayout.tsx`: Header (sticky, blur, mega menu) + Footer (koyu, 5+ sütun).
3. **Faz 1c** — Ortak bileşenler: `SectionShowcase.tsx`, `TrustLogos.tsx`, `TestimonialCard.tsx`, `CtaBanner.tsx`, `StepCards.tsx`, `FaqAccordion.tsx`, `ScreenshotFrame.tsx`.
4. **Faz 2** — Homepage, Pricing, Product, Contact sayfalarını Crisp şablonuna göre yeniden yaz.
5. **Faz 3** — Security, Developers, Integrations, Solutions, Resources, Help Center, Status, Compare sayfaları.
6. **Faz 4** — Signup/Login sayfalarında renk uyumu.
7. **Screenshots** — Portal ekran görüntüleri `public/marketing/screenshots/` altında; `ScreenshotFrame` ile kullanım.
8. **i18n** — Yeni metinler için EN + TR + ES key'leri.
9. **Final** — `pnpm build`, `tsc --noEmit`, deploy.

---

## Önemli Dosya Yolları

| Ne | Dosya |
|----|--------|
| Public site layout | `apps/web/src/components/PublicLayout.tsx` |
| Design tokens (teal/mevcut) | `apps/web/src/lib/designTokens.ts` |
| Design tokens (renk/font) | `apps/web/src/lib/design-tokens.ts` |
| Global CSS | `apps/web/src/app/globals.css` |
| Homepage | `apps/web/src/app/page.tsx` |
| Pricing | `apps/web/src/app/pricing/page.tsx` |
| Portal visitors | `apps/web/src/app/portal/visitors/page.tsx` |
| Visitors map | `apps/web/src/components/VisitorsMap.tsx` |
| Portal inbox | `apps/web/src/app/portal/inbox/PortalInboxContent.tsx` |
| i18n locales | `apps/web/src/i18n/locales/{en,tr,es}.json` |

---

## Build & Deploy

- **Typecheck**: `pnpm --filter @helvino/web exec tsc --noEmit`
- **Build**: `pnpm --filter @helvino/web build`
- **Deploy**: Değişiklikler `main` branch’e push edildiğinde (Railway vb.) otomatik deploy tetiklenir.

---

*Son güncelleme: Bu handoff, ziyaretçiler/harita/inbox düzeltmeleri ve Crisp redesign planının dokümante edilmesiyle oluşturuldu. Crisp redesign implementasyonu henüz başlamamıştır.*
