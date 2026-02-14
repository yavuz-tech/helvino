# Widget Görünüm Sayfası — Hata Analiz Raporu

**Tarih:** 12 Şubat 2026  
**Kapsam:** Widget Appearance v3-ultimate redesign süreci  
**Durum:** Tüm kritik hatalar tespit ve düzeltildi

---

## 1. ÖZET

Önceki Claude oturumları (Part 1–5) widget appearance sayfasını v3-ultimate olarak yeniden tasarladı. 50+ yeni field (tema, launcher stili, AI ayarları, conversation starters vb.) eklendi. Ancak **sadece frontend/UI odaklı çalışıldı, backend entegrasyonu eksik bırakıldı.** Bu rapor tespit edilen 7 kritik hatayı, kök nedenlerini ve doğru mimariyi belgelemektedir.

---

## 2. TESPİT EDİLEN HATALAR

### HATA 1: Kaydet yapınca 500 hatası (An error occurred)

| Alan | Detay |
|------|-------|
| **Belirti** | Portal'da ayar değiştirip "Kaydet" yapınca `An error occurred` hatası |
| **Kök neden** | `v3-ultimate.jsx` 50+ field gönderiyor ama `portal-widget-settings.ts` PUT handler sadece ~12 legacy field kabul ediyordu. Prisma bilinmeyen field'ları reject etti |
| **Eksik olan** | `configJson Json` kolonu schema'ya eklenmemişti. PUT handler tüm v3 field'ları `configJson` JSON kolonuna yazmak üzere güncellenmemişti |
| **Düzeltme** | `schema.prisma`'ya `configJson Json @default("{}")` eklendi. PUT handler yeniden yazıldı: legacy field'lar ayrı kolonlara, geri kalan her şey `configJson`'a |

### HATA 2: Sayfa yenileyince ayarlar eski haline dönüyordu

| Alan | Detay |
|------|-------|
| **Belirti** | Tema seç → Kaydet → Sayfa yenile → Ayarlar default'a dönüyor |
| **Kök neden** | Hydration `useEffect` zamanlama hatası. `hydratedRef` boolean'ı ilk renderda (API verisi gelmeden önce) `true` oluyordu. Gerçek API verisi geldiğinde hydration atlanıyordu |
| **Eksik olan** | `settingsVersion` counter mekanizması yoktu. `initialSettings` default değerlerle gönderiliyordu (`null` yerine) |
| **Düzeltme** | `page.tsx`'te `settingsVersion` counter eklendi. `initialSettings` API verisi gelene kadar `undefined` gönderiliyor. Hydration `useEffect` version-based guard'a geçirildi |

### HATA 3: Müşteri sitesindeki widget güncellenmiyordu (KRİTİK)

| Alan | Detay |
|------|-------|
| **Belirti** | Portal'da tema değiştir → Kaydet → Müşteri sitesindeki widget eski renkte kalıyor |
| **Kök neden** | **ÜÇ KATMANLI KOPUKLUK:** |

**Katman 1 — Frontend (`v3-ultimate.jsx` handleSave):**
- Legacy field'ları (`primaryColor`, `position`, `welcomeTitle`, `welcomeMessage`) payload'a eklemiyordu
- Sadece v3 field'ları (`themeId`, `positionId`, `headerText`, `welcomeMsg`) gönderiyordu

**Katman 2 — API (`portal-widget-settings.ts` PUT):**
- v3 `themeId` → legacy `primaryColor` senkronizasyonu yoktu
- v3 `positionId` → legacy `position` senkronizasyonu yoktu
- v3 `headerText` → legacy `welcomeTitle` senkronizasyonu yoktu

**Katman 3 — Bootloader (`bootloader.ts` GET):**
- `configJson` kolonu `select` sorgusunda yoktu → v3 ayarları hiç fetch edilmiyordu
- `theme.primaryColor` hâlâ legacy kolondan okunuyordu
- v3 `themeId` → renk dönüşümü (THEME_COLORS map) yoktu

**Düzeltme:**
1. `v3-ultimate.jsx`: Legacy field'lar v3'ten derive edilip payload'a eklendi
2. `portal-widget-settings.ts`: v3 → legacy otomatik senkronizasyon eklendi (THEME_COLORS map)
3. `bootloader.ts`: `configJson` fetch'e eklendi, `theme` objesi v3'ten derive ediliyor

### HATA 4: PRO özelliklerin upgrade modalı açılmıyordu

| Alan | Detay |
|------|-------|
| **Belirti** | Free kullanıcı PRO toggle'a tıklıyor → Hiçbir şey olmuyor (upgrade modalı açılmıyor) |
| **Kök neden** | Toggle component'te `disabled={!isPro}` CSS `pointer-events: none` koyuyordu. Click event'i hiç ateşlenmiyordu |
| **Eksik olan** | `disabled` (tamamen pasif) vs. `gated` (kısıtlı ama tıklanabilir) ayrımı düşünülmemişti |
| **Düzeltme** | `disabled={!isPro}` kaldırıldı, `pro={!isPro}` badge'i korundu, `onChange` handler'ı free kullanıcılar için `showUpgrade` modal'ını tetikliyor |

### HATA 5: Widget Socket.IO sadece açıkken bağlanıyordu

| Alan | Detay |
|------|-------|
| **Belirti** | Portal'da kaydet yapınca müşteri sitesindeki widget (kapalı/bubble halinde) güncellenmiyordu |
| **Kök neden** | Socket bağlantısı `actualIsOpen` useEffect'i içinde kuruluyordu. Widget kapalı iken socket yoktu, `widget:config-updated` event'i alınamıyordu |
| **Düzeltme** | Socket bağlantısı mount'a taşındı (her zaman aktif). Config update listener her zaman dinliyor. Chat listener'ları conversationId ile filtreleniyor |

### HATA 6: Embed kodunda placeholder değerler

| Alan | Detay |
|------|-------|
| **Belirti** | Embed snippet'te `YOUR_ORG_KEY` yazıyor |
| **Kök neden** | Gerçek org key API'den çekilip snippet'e basılmamıştı |
| **Düzeltme** | Gerçek org key kullanılacak şekilde düzeltildi |

### HATA 7: Test altyapısı yoktu

| Alan | Detay |
|------|-------|
| **Belirti** | Widget'ın gerçek davranışı test edilemiyor |
| **Kök neden** | Hiçbir `widget-test.html` sayfası yoktu |
| **Düzeltme** | `apps/web/public/widget-test.html` oluşturuldu (`yuksel-ltd` org key ile) |

---

## 3. KÖK NEDEN ANALİZİ: NE YANLIŞ YAPILDI?

### A. Frontend-Only Düşünme

50+ UI field eklendi ama:
- Backend bunları kabul edecek şekilde güncellenmedi
- Legacy uyumluluk katmanı tasarlanmadı
- Bootloader (müşteri widget'ın veri kaynağı) güncellenmedi

### B. Veri Akışı Ucu Uca Trace Edilmedi

```
Frontend State → handleSave payload → API PUT body → DB kolonları 
→ API GET response → Frontend hydration → Bootloader response → Widget render
```

Bu zincirin **her halkası** ayrı ayrı test edilmeliydi. Hiçbiri test edilmedi.

### C. Legacy Uyumluluk Düşünülmedi

Müşteri widget'ı (bootloader) hâlâ legacy field'ları okuyor:

| v3 Field | Legacy Kolon | Bootloader Field |
|----------|-------------|-----------------|
| `themeId` + renk hesabı | `primaryColor` | `theme.primaryColor` |
| `positionId` ("br"/"bl") | `position` ("right"/"left") | `theme.bubblePosition` |
| `headerText` | `welcomeTitle` | `widgetSettings.welcomeTitle` |
| `welcomeMsg` | `welcomeMessage` | `widgetSettings.welcomeMessage` |

Bu mapping tablosu Part 2'de (field eklenirken) tanımlanmalıydı.

### D. Hydration Zamanlama Hatası Test Edilmedi

```javascript
// YANLIŞ: Boolean ref — ilk renderda true olur, gerçek veri gelince atlanır
const hydratedRef = useRef(false);
useEffect(() => {
  if (hydratedRef.current) return;
  hydratedRef.current = true;
  // ... hydrate
}, [initialSettings]);

// DOĞRU: Version counter — her API fetch'te version artar, hydration tekrar çalışır
const lastVersionRef = useRef(0);
useEffect(() => {
  if (!initialSettings || settingsVersion === 0) return;
  if (lastVersionRef.current >= settingsVersion) return;
  lastVersionRef.current = settingsVersion;
  // ... hydrate
}, [initialSettings, settingsVersion]);
```

### E. Incremental Test Yapılmadı

Her Part bittiğinde şu kontrol yapılmalıydı:

```bash
# 1. Kaydet çalışıyor mu?
curl -X PUT /portal/widget/settings -d '{"themeId":"ocean",...}' → 200 OK?

# 2. GET doğru dönüyor mu?
curl GET /portal/widget/settings → themeId: "ocean"?

# 3. Bootloader doğru dönüyor mu?
curl -H "x-org-key: yuksel-ltd" /api/bootloader → theme.primaryColor: "#0EA5E9"?

# 4. Sayfa yenileme sonrası hydration doğru mu?
Sayfayı yenile → tema hâlâ "ocean" mı?
```

Hiçbiri yapılmadı.

---

## 4. DOĞRU MİMARİ: BU TÜR SAYFA AKTARIMLARINDA NE YAPILMALI

### A. Tasarım Öncesi Checklist

1. **Veri akışı diyagramı çiz** — Frontend'den widget'a kadar her adım
2. **Her yeni field için 6 nokta kontrol et:**
   - `schema.prisma` → kolon veya configJson key
   - `PUT handler` → kabul + validasyon
   - `GET handler` → return
   - `bootloader` → return (müşteri widget için)
   - `Frontend hydration` → GET'ten gelen veriyi state'e yazma
   - `Frontend save` → state'ten payload'a yazma
3. **Legacy uyumluluk matrisi** — v3 field → legacy kolon → bootloader field

### B. Geliştirme Sırasında Zorunlu Adımlar

Her Part bittiğinde **MUTLAKA**:

1. `curl` ile PUT yap → 200 OK mi?
2. `curl` ile GET yap → kaydedilen değerler dönüyor mu?
3. `curl` ile bootloader çek → widget göreceği değerler doğru mu?
4. Sayfayı yenile → hydration doğru çalışıyor mu?
5. `widget-test.html` aç → widget güncellendi mi?

### C. Save → Widget Güncelleme Zinciri

```
1. Frontend handleSave:
   - v3 field'ları + legacy field'ları birlikte gönder
   - Legacy field'ları v3'ten DERIVE et (themeId → THEME_COLORS → primaryColor)

2. API PUT handler:
   - configJson'a HER ŞEYİ yaz (complete snapshot)
   - Legacy kolonları v3'ten SYNC et

3. API PUT sonrası:
   - Socket.IO ile "widget:config-updated" event'i emit et
   - org:id VE org:key odalarına gönder

4. Widget (embed):
   - Socket MOUNT'ta bağlansın (her zaman aktif)
   - "widget:config-updated" → loadBootloader() → setBootloaderConfig()
   - Sayfa yenilemesine gerek kalmasın
```

---

## 5. TEST SENARYOLARI

### Senaryo 1 — Temel Widget Yüklenme
1. `http://localhost:3000/widget-test.html` aç
2. Widget bubble görünür mü?
3. Bubble'a tıkla → chat penceresi açılır mı?
4. Mesaj yaz, gönder → API'ye ulaşır mı?

### Senaryo 2 — Ayar Değişikliği (Real-time)
1. Portal'da tema değiştir (örn. amber → ocean) → kaydet
2. `widget-test.html`'de (yenileme YAPMADAN) bubble rengi değişti mi?
3. Widget'ı aç → başlık ve karşılama mesajı güncellendi mi?

### Senaryo 3 — Sayfa Yenileme Sonrası Persistence
1. Portal'da ayar değiştir → kaydet
2. Portal sayfasını yenile
3. Yeni ayarlar hâlâ geçerli mi? (hydration doğru mu?)
4. `widget-test.html`'yi yenile → widget yeni ayarlarla mı yükleniyor?

### Senaryo 4 — Plan Gating
1. Free kullanıcı olarak PRO toggle'a tıkla → upgrade modalı açılır mı?
2. PRO temaya tıkla → upgrade modalı açılır mı?
3. Free'de kaydet yapınca PRO field'lar strip ediliyor mu?

### Senaryo 5 — Bootloader Doğrulaması
```bash
# Tema değiştir ve kaydet, sonra:
curl -H "x-org-key: yuksel-ltd" http://localhost:4000/api/bootloader | python3 -c "
import json,sys
d=json.load(sys.stdin)
c=d.get('config',{})
t=c.get('theme',{})
ws=c.get('widgetSettings',{})
print('theme.primaryColor:', t.get('primaryColor'))
print('widgetSettings.themeId:', ws.get('themeId'))
print('widgetSettings.welcomeTitle:', ws.get('welcomeTitle'))
"
```

### Senaryo 6 — Socket Real-time
1. `widget-test.html` aç (widget bubble görünsün)
2. DevTools Console'u aç
3. Portal'da tema değiştir → kaydet
4. Console'da `[Widget] Config updated via socket` logu çıkıyor mu?
5. Bubble rengi değişti mi?

---

## 6. DEĞİŞEN DOSYALAR ÖZET

| Dosya | Değişiklik |
|-------|-----------|
| `apps/api/prisma/schema.prisma` | `configJson Json @default("{}")` eklendi |
| `apps/api/src/routes/portal-widget-settings.ts` | PUT: configJson yazma + legacy sync. GET: configJson merge |
| `apps/api/src/routes/bootloader.ts` | configJson fetch + v3→legacy derive (THEME_COLORS) |
| `apps/widget/src/App.tsx` | Socket mount'ta bağlanıyor + config update listener |
| `apps/web/src/app/portal/widget-appearance/page.tsx` | settingsVersion counter + null-safe initialSettings |
| `apps/web/src/app/portal/widget-appearance/widget-appearance-v3-ultimate.jsx` | Version-based hydration + legacy field'lar handleSave'e eklendi |
| `apps/web/public/widget-test.html` | Yeni test sayfası |
| `apps/web/public/embed.js` | Rebuild (socket değişikliği için) |

---

## 7. SONUÇ

**Temel ders:** Bir settings sayfası sadece UI değildir. Veri **frontend → API → DB → API → bootloader → widget** zincirinde akar. Bu zincirin her halkası aynı anda tasarlanmalı ve test edilmelidir. "Önce UI'yı yap, backend'i sonra hallederiz" yaklaşımı bu tür çok katmanlı sorunlara yol açar.
