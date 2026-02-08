# Helvino — Feature / Entitlement Matrix (FAZ 3)

## 5 Rules

1) **Free = çalışan ürün + küçük hacim + temel operasyon.**  
2) **Paid = hacim artışı + operasyon verimi + marka/kurumsal ihtiyaçlar.**  
3) **M1/M2/M3 ayrı metriklerdir; birbirini etkilemez.**  
4) **Branding bir upsell tetikleyicisidir; Free’de kaldırılamaz.**  
5) **Enterprise = güvenlik + SLA + yönetim (limit değil sadece).**

---

## Definitions: M1/M2/M3

### Paketler
- **Free / Pro / Growth / Enterprise**

### Metrikler
- **M1 — Human conversations:** Ajan (temsilci) ile yürütülen yeni sohbet/konuşma.
- **M2 — AI assisted/resolved conversations:** AI Agent’ın yanıtladığı veya çözdüğü konuşmalar.
- **M3 — Automations reached visitors:** Otomasyonların ulaştığı benzersiz ziyaretçi.

### Conversation/Thread Sayım Prensibi
- **Ne zaman 1 sayılır?** Yeni bir konuşma/thread açıldığında 1 sayılır (M1 veya M2).  
- **Reset periyodu:** Aylık (UTC ay başlangıcı).  
- **Limit dolunca davranış:**
  - **M1 dolarsa:** yeni human konuşma **bloklanır** (mesaj “beklemede” ve admin uyarısı).  
  - **M2 dolarsa:** AI devre dışı, **fallback insan ajan**.  
  - **M3 dolarsa:** otomasyonlar devre dışı, **basit widget devam**.  
- **Sayısal limitler:** **TBD** (sadece sayılar; mantık sabit).

---

## Modules

- **Widget**  
- **Inbox / Helpdesk**  
- **Automations**  
- **AI Agent**  
- **Analytics**  
- **Branding**  
- **Security**

---

## Feature Matrix

**Zorunlu kolonlar:** Module, Feature, Free, Pro, Growth, Enterprise, Add-on?, Metric Impact, Limit Type, Gating Type, Enforcement Notes, When Limit Reached, Admin Visibility.

| Module | Feature | Free | Pro | Growth | Enterprise | Add-on? | Metric Impact | Limit Type | Gating Type | Enforcement Notes | When Limit Reached | Admin Visibility |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Widget | Core embed (widget çalışır) | ✅ | ✅ | ✅ | ✅ | None | None | None | **Server** | Embed config server’dan gelir; client override kabul edilmez. | Hide | Widget health + load count |
| Widget | Size / density ayarları | ✅ | ✅ | ✅ | ✅ | None | None | None | **UI** | Portal ayarı; server sadece doğrulama yapar. | Hide | UI config audit |
| Widget | Avatar preset seçimi | ✅ | ✅ | ✅ | ✅ | None | None | None | **UI** | UI seçenekleri plan kontrollü gösterilir. | Hide | Config change log |
| Widget | Avatar upload + crop | ✅ | ✅ | ✅ | ✅ | None | None | None | **Mixed** | UI açılır; server file upload izinleri planla doğrulanır. | Block | Upload denied event |
| Widget | Avatar URL ile ekleme | ✅ | ✅ | ✅ | ✅ | None | None | None | **Mixed** | UI açılır; server URL allowlist/validation yapar. | Block | Validation error log |
| Widget | Launcher style/label/badge | ✅ | ✅ | ✅ | ✅ | None | None | None | **UI** | Görsel seçenekler planla gösterilir. | Hide | Config change log |
| Widget | Agents limit (temsilci sayısı) | **1** | **TBD** | **TBD** | **Custom** | None | None | Seat | **Server** | Org user sayısı server-side limitlenir. | Block | Admin uyarısı + billing CTA |
| Branding | “Powered by Helvino” zorunlu | **Zorunlu** | Opsiyonel | Opsiyonel | Opsiyonel | No-Branding | None | None | **Server** | Free plan server-side override ile branding render zorunlu. | Hide | Branding override event |
| Branding | Branding kaldırma | ❌ | ✅ | ✅ | ✅ | No-Branding | None | None | **Server** | Client config no-op; server entitlements belirler. | Hide | Admin panel: “Branding locked” |
| Branding | Custom branding (logo/color) | ❌ | ❌ | ✅ (sınırlı) | ✅ | Custom | None | None | **Server** | Plan kontrolü server-side; UI sadece gösterir. | Hide | Branding change log |
| Security | Domain allowlist (temel) | ✅ | ✅ | ✅ | ✅ | None | None | Projects | **Server** | Widget request’te Origin/Referer doğrulanır. | Block | Domain mismatch alerts |
| Security | Domain allowlist gelişmiş (wildcards, env) | ❌ | ✅ | ✅ | ✅ | None | None | Projects | **Server** | Allowlist parse + wildcard match server-side. | Block | Domain policy events |
| Security | Domain mismatch detection + admin uyarı | ✅ | ✅ | ✅ | ✅ | None | None | None | **Server** | Mismatch event log + admin panel warning. | Block | Security events counter |
| Inbox/Helpdesk | Inbox/project sayısı | **1** | **TBD** | **TBD** | **Custom** | None | None | Projects | **Server** | Project create limit server-side. | Block | Billing CTA + audit |
| Inbox/Helpdesk | Seat/agent yönetimi | Sınırlı | ✅ | ✅ | ✅ | None | None | Seat | **Server** | Org user limit enforced. | Block | Admin alert |
| Inbox/Helpdesk | Assignment rules | ❌ | ✅ | ✅ | ✅ | None | None | None | **Mixed** | UI planla açılır; server rules endpoint kontrol eder. | Hide | Rule create denied log |
| Inbox/Helpdesk | Macros (basic) | ❌ | ✅ | ✅ | ✅ | None | None | None | **Mixed** | UI gating; server create/update kontrolü. | Hide | Macro limit log |
| Inbox/Helpdesk | Notes / internal comments | ❌ | ✅ | ✅ | ✅ | None | None | None | **Mixed** | UI gating + server permission check. | Hide | Permission denied log |
| Inbox/Helpdesk | Permissions / roles | ❌ | Sınırlı | ✅ | ✅ | None | None | Seat | **Server** | Role management server-side. | Block | Admin audit log |
| Inbox/Helpdesk | Audit log | ❌ | ❌ | ✅ | ✅ | None | None | None | **Server** | Audit endpoints plan kontrolü. | Hide | Audit log access denied |
| Inbox/Helpdesk | SLA dashboards | ❌ | ❌ | ❌ | ✅ | None | None | None | **Server** | SLA endpoints enterprise-only. | Hide | SLA access denied |
| Automations | Working hours schedule | ✅ | ✅ | ✅ | ✅ | Automations | M3 | Visitors | **Mixed** | UI planla açılır; server rules execution entitlement. | Degrade | Automation disabled notice |
| Automations | Offline form / autoresponder | ✅ | ✅ | ✅ | ✅ | Automations | M3 | Visitors | **Mixed** | UI + server execution check. | Degrade | Automation usage warning |
| Automations | Rule-based automations | ❌ | ✅ | ✅ | ✅ | Automations | M3 | Visitors | **Server** | Execution gating server-side. | Degrade | Automation usage log |
| Automations | Advanced flow analytics | ❌ | ❌ | ✅ | ✅ | Automations | M3 | Visitors | **Server** | Analytics endpoints plan kontrolü. | Hide | Analytics access denied |
| Automations | Webhook/outgoing integrations | ❌ | ❌ | ✅ | ✅ | Automations | M3 | Visitors | **Server** | Execution gating + rate limit server-side. | Block | Integration events log |
| AI Agent | AI trial quota | Trial | ✅ (TBD) | ✅ (TBD) | Custom | AI | M2 | Conversations | **Server** | AI responses server-side quota ile sınırlı. | Degrade | AI quota exhausted log |
| AI Agent | Knowledge base ingestion | ❌ | ✅ | ✅ | ✅ | AI | M2 | Projects | **Server** | Ingestion endpoint entitlements. | Block | Ingestion denied log |
| AI Agent | Human handoff rules | ❌ | ✅ | ✅ | ✅ | AI | M2 | None | **Mixed** | UI + server routing check. | Route | Handoff events log |
| AI Agent | Resolution analytics | ❌ | ❌ | ✅ | ✅ | AI | M2 | None | **Server** | Analytics endpoints plan kontrolü. | Hide | Analytics access denied |
| AI Agent | Outcome-based / managed | ❌ | ❌ | ❌ | ✅ | Custom | M2 | None | **Server** | Enterprise-only workflow. | Hide | Enterprise flag required |
| Analytics | Basic widget metrics | ✅ | ✅ | ✅ | ✅ | None | None | None | **Server** | Usage + widget health server-side. | Hide | Dashboard metrics |
| Analytics | Advanced analytics + funnels + CSAT | ❌ | ❌ | ✅ | ✅ | None | None | None | **Server** | Analytics endpoints plan kontrolü. | Hide | Analytics access denied |
| Analytics | Export / BI | ❌ | ❌ | ❌ | ✅ | Custom | None | None | **Server** | Export endpoints enterprise-only. | Block | Export denied log |
| Security | Embed config signing/verification | ✅ | ✅ | ✅ | ✅ | None | None | None | **Server** | Client config’a güvenme; server entitlements override. | Block | Config mismatch log |
| Security | Rate limiting / abuse detection | ✅ | ✅ | ✅ | ✅ | None | None | None | **Server** | API + widget rate limit enforcement. | Block | Abuse event log |
| Security | SSO / Compliance pack | ❌ | ❌ | ❌ | ✅ | Custom | None | None | **Server** | Enterprise-only. | Hide | Security access denied |

---

## Branding & Domain Allowlist Security

**Free’de branding neden kaldırılamaz?**
1) **Client config güvenilir değildir.** Widget config yalnızca görsel ayardır; entitlements server’dan gelir.  
2) **Source-of-truth server’dır.** Plan/entitlement bilgisi server-side override ile uygulanır.  
3) **Runtime override zorunludur.** Free plan için “Helvino tarafından desteklenmektedir” always-on render edilir.

**Senaryo: Kullanıcı embed script’ten Helvino yazısını siler.**  
- **Free:** Widget yine branded render etmeli (server entitlement override).  
- Branding kaldırma sadece Pro+ veya No-Branding add-on ile açılır.

**Domain mismatch senaryosu:**  
- Allowlist dışında bir domain’de load olursa: **widget disabled + reason code** ve admin panelde **security alert**.

---

## Phase 4 Checklist

1) **Entitlements source-of-truth** (server).  
2) **PlanGuard**: runtime override (branding, limits, agents).  
3) **UI paywall**: plan’a göre CTA ve kilit ekranları.  
4) **Admin alerts/logs**: branding, domain mismatch, quota.  
5) **Metering M1/M2/M3**: usage counters + reset.  
6) **Billing integration**: plan key + add-on mapping.  
7) **Security enforcement**: allowlist + rate limit.  
8) **QA + abuse tests**: spoof config / remove branding / domain mismatch.
