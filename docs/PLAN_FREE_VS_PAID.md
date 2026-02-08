# Helvino — Free vs Paid Net Ayrım (FAZ 1)

**Hedef:** Tidio benzeri “ücretsiz vs ücretli” sınırını tek sayfada net prensiplere indirmek; Helvino paket mimarisi için temel çerçeve.

---

## 1. Beş Net Kural (Tidio’dan uyarlama)

| # | Kural | Açıklama |
|---|--------|----------|
| 1 | **Ücretsiz = çalışır ürün + küçük hacim + temel operasyon** | Kullanıcı widget’ı kurabilir, tek temsilci ile canlı sohbet yürütebilir, temel özelleştirme (tema/renk/boyut/launcher) yapabilir. Limitler düşük, branding açık kalır. |
| 2 | **Ücretli = hacim artışı + operasyon verimi + marka/kurumsal ihtiyaçlar** | Daha fazla konuşma/mesaj, daha fazla temsilci, gelişmiş inbox/analitik, branding kaldırma, çoklu site, SSO/SLA. |
| 3 | **İnsan / AI / Otomasyon kotaları birbirinden bağımsız sayılır** | Billable conversations (insan), AI-assisted/resolved conversations, automations reached visitors — üç ayrı metrik; add-on veya paket bazında ayrı limitler. |
| 4 | **Branding kaldırma net upsell tetikleyicisidir** | “Helvino tarafından desteklenmektedir” Free’de **kapatılamaz**. Ücretli pakette (veya add-on) branding kaldırma açılır. |
| 5 | **Enterprise’da satılan “sadece limit değil”** | Güvenlik (SSO, audit, compliance), SLA, dedicated support, custom branding, custom limitler. |

---

## 2. Üç Metrikli Ölçeklendirme Şeması

Helvino’da hacim sınırları **üç metrik** üzerinden tanımlanır:

| Metrik | İsim (EN) | Açıklama | Sayım |
|--------|-----------|----------|--------|
| **M1** | **Human conversations** | Ajan (temsilci) tarafından yürütülen konuşmalar | Aylık yeni konuşma (billable conversation) |
| **M2** | **AI assisted / resolved conversations** | AI Agent’ın yanıtladığı veya kapattığı konuşmalar | Aylık kota (Lyro benzeri) |
| **M3** | **Automations reached visitors** | Otomasyonların (çalışma saatleri, tetikleyiciler, formlar, vb.) ulaştığı benzersiz ziyaretçi | Aylık benzersiz visitor |

- **M1** mevcut `conversationsCreated` / `maxConversationsPerMonth` ile uyumludur.
- **M2** ve **M3** ileride Plan/Usage/Entitlements’a eklenecek (kota bazlı add-on veya paket içi).
- Üç metrik **birbirinden bağımsız** limitlere sahip olacak; biri dolunca diğerleri etkilenmez (tanıma göre fallback: AI kota dolunca insan ajan, otomasyon dolunca basit widget).

---

## 3. Helvino Ürün Modülleri Listesi

Paket/feature matrix’te kullanılacak modül seti:

| Modül | Açıklama |
|-------|----------|
| **Widget** | Gömülü sohbet penceresi: tema, renk, boyut, launcher, avatar/logo, çalışma saatleri. |
| **Inbox / Helpdesk** | Konuşma listesi, atama, etiket, not, makro, filtre. |
| **Automations** | Çalışma saatleri, tetikleyiciler, formlar, “flows” benzeri kurallar (M3 ile sınırlanacak). |
| **AI Agent** | Otomatik yanıt / çözüm (M2 kotası). |
| **Analytics** | Temel sayaçlar, gelişmiş raporlar, verim metrikleri. |
| **Branding** | “Helvino tarafından desteklenmektedir” — Free’de sabit; ücretli pakette kaldırılabilir. |
| **Security** | SSO, audit logs, MFA, compliance, domain allowlist. |

---

## 4. Kısa Özet Cümleleri

- **Free:** Çalışan ürün, tek temsilci, temel widget özelleştirme, avatar/logo upload + çalışma saatleri dahil; branding **her zaman açık**; düşük kotalar.
- **Paid:** Hacim artışı (M1/M2/M3), operasyon verimi (ekip, rol, analitik), branding kaldırma, çoklu site/ekip.
- **Enterprise:** SSO, audit, SLA, dedicated support, custom branding ve limitler.

---

## Sonraki Adım

→ **FAZ 2:** [PLAN_PACKAGE_ARCHITECTURE.md](./PLAN_PACKAGE_ARCHITECTURE.md) — Paket isimleri (Free / Pro / Growth / Enterprise), her paketin M1/M2/M3 limitleri, gating ilkeleri, add-on mantığı.
