# GÖREV: Widget Appearance Sayfasını Yeniden Tasarla

OPUS-CONTEXT.md'yi zaten aldın. Şimdi Widget Appearance sayfasını yeniden tasarla.

## MEVCUT ALTYAPI (Cursor'dan çıkarıldı — dokunma, koru)

### Mevcut State'ler (useState)

```
settings: WidgetSettings = { primaryColor, position, launcher, bubbleShape, bubbleIcon, bubbleSize, bubblePosition, greetingText, greetingEnabled, welcomeTitle, welcomeMessage, brandName }
localTheme: LocalThemeOverrides = { presetId, accentColor, surfaceColor, textColor, gradientFrom, gradientTo, gradientAngle }
loading: boolean = true
saving: boolean = false
error: string | null = null
upgradeNotice: string | null = null
requestId: string | null = null
saveMessage: string | null = null
showCustomize: boolean = false
showPremiumPalettes: boolean = false
showSizeMenu: boolean = false
showAvatarLauncher: boolean = false
showSettings: boolean = false
showDebugPanel: boolean = false
premiumPreviewId: string | null = null
widgetConfig: WidgetConfig = loadWidgetConfig() ?? DEFAULT_WIDGET_CONFIG
planKey: string = "free"
brandingRequired: boolean = true
domainMismatchCount: number = 0
```

### Mevcut API Çağrıları (BUNLARI AYNEN KORU)

```
GET  /portal/widget/settings → { settings, requestId, planKey, brandingRequired, domainMismatchCount }
PUT  /portal/widget/settings ← { ...payloadSettings }
```

### Mevcut Import'lar (Cursor bunları kullanacak)

```
portalApiFetch — API çağrıları
usePortalAuth — Kullanıcı bilgisi (user, loading)
useI18n — Çeviri (t, locale)
useSearchParams — URL parametreleri
ErrorBanner — Hata gösterimi
Card — Kart component'i
WidgetGallery — Galeri template seçimi
WidgetPreviewRenderer — Canlı önizleme
AvatarSelector — Avatar seçici
WIDGET_THEME_PRESETS, PREMIUM_PALETTES, DEFAULT_PRESET — Tema preset'leri
widgetConfig utils — Config yönetimi
colors, fonts — Design tokens
sanitizePlainText — Input temizleme
premiumToast — Toast bildirimleri
```

### Mevcut Handler'lar (mantık aynı kalacak)

```
fetchSettings — API'den ayarları çek
handleSave — Ayarları kaydet (PUT)
handleReset — Varsayılana sıfırla
applyPreset — Tema preset'i uygula
applyPremiumPreview — Premium tema önizleme
revertPremiumPreview — Önizlemeyi geri al
handleAvatarChange — Avatar değiştir
updateWidgetConfig — Config güncelle
updateLocal — Lokal tema güncelle
validateColor — Renk doğrula
togglePanel — Accordion panel aç/kapa
```

### Plan Mantığı

```
planKey: "free" | "starter" | "pro" | "business" | "enterprise"
isFree = planKey === "free"
canEdit = user?.role === "owner" || user?.role === "admin"
brandingRequired = true (free planda zorunlu, pro'da kapatılabilir)

Free: Tema önizleme yapabilir ama kaydedemez (upgrade notice gösterilir)
Pro+: Tüm tema ve renkleri kaydedebilir
Enterprise: White-label (branding kapatma)
```

---

## TASARIM İSTEĞİ

Bu sayfayı şu bölümlerle yeniden tasarla:

1. **Header** — Sayfa başlığı, açıklama, save/reset butonları
2. **Tema Seçimi** — Preset kartları grid, aktif olanı vurgulu
3. **Renk Özelleştirme** — Primary color picker, gradient ayarları
4. **Launcher/Bubble Ayarları** — Şekil, boyut slider, pozisyon, ikon seçimi
5. **Karşılama Mesajları** — Welcome title, message, greeting text, placeholder
6. **Avatar & Marka** — Bot/agent avatar seçici, brand name, powered-by toggle
7. **Premium Paletler** — Pro+ kullanıcılar için premium tema galerisi (free: önizleme + upgrade CTA)
8. **Canlı Önizleme** — Sağ tarafta sabit pozisyonda widget preview (sticky)
9. **Domain Uyarısı** — domainMismatchCount > 0 ise uyarı banner'ı

## ÇIKTI FORMATI

OPUS-CONTEXT.md Bölüm 11'deki formata uy:

A. Bölüm listesi
B. Her bölüm için React inline style objeleri
C. Element detayları (font, renk, boyut)
D. i18n key listesi (en/tr/es — 3 dil zorunlu)
E. Plan kısıtlama tablosu
F. State listesi (mevcut olanları koru, yeni gerekiyorsa ekle)
G. API bağlantıları

## KURALLAR

1. Mevcut state isimlerini DEĞİŞTİRME
2. Mevcut API endpoint'lerini DEĞİŞTİRME
3. Warm Premium renk paleti kullan (OPUS-CONTEXT.md Bölüm 4)
4. Tam JSX YAZMA — sadece spec ver
5. Sayfa layout: sol taraf form/ayarlar, sağ taraf sticky preview
6. Mobile'da preview alt tarafa geçsin
7. Her bölüm accordion/collapse olabilir
8. Loading/saving state'leri için skeleton/spinner göster
9. Error state için ErrorBanner kullan
10. Tüm görünür metin i18n key olarak ver
