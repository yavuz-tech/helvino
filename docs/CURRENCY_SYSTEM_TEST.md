# 🌍 Multi-Currency System - Test Guide

## Overview

Helvino now supports automatic currency detection based on user locale and timezone. The system automatically shows prices in the user's local currency (USD, EUR, TRY, GBP).

---

## 🎯 Test Scenarios

### **Scenario 1: Turkish User (Türkiye'den Giriş)**

**Detection Logic:**
- Browser language: `tr` or `tr-TR`
- Timezone: `Europe/Istanbul`
- **Expected Currency:** TRY (₺)

**Test Steps:**
1. Open browser DevTools → Console
2. Run: `document.cookie = "helvino_lang=tr;path=/;max-age=15552000"`
3. Run: `document.cookie = "helvino_currency=TRY;path=/;max-age=15552000"`
4. Refresh page: http://localhost:3000/pricing

**Expected Results:**
- Language switcher shows: `TR` (Turkish flag)
- Currency switcher shows: `₺ TRY`
- Free plan: `₺0/ay`
- Pro plan: `₺1,690/ay` (49 USD × 34.5 rate)
- Business plan: `₺6,865/ay` (199 USD × 34.5 rate)

---

### **Scenario 2: US User (ABD'den Giriş)**

**Detection Logic:**
- Browser language: `en` or `en-US`
- Timezone: `America/New_York`, `America/Los_Angeles`, etc.
- **Expected Currency:** USD ($)

**Test Steps:**
1. Clear cookies: `document.cookie.split(";").forEach(c => document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/")`
2. Refresh page: http://localhost:3000/pricing

**Expected Results:**
- Language switcher shows: `EN` (UK/US flag)
- Currency switcher shows: `$ USD`
- Free plan: `$0/mo`
- Pro plan: `$49/mo`
- Business plan: `$199/mo`

---

### **Scenario 3: European User (Avrupa'dan Giriş)**

**Detection Logic:**
- Browser language: `es` (Spanish), `de` (German), `fr` (French), etc.
- Timezone: `Europe/Paris`, `Europe/Berlin`, `Europe/Madrid`
- **Expected Currency:** EUR (€)

**Test Steps:**
1. Run: `document.cookie = "helvino_lang=es;path=/;max-age=15552000"`
2. Run: `document.cookie = "helvino_currency=EUR;path=/;max-age=15552000"`
3. Refresh page: http://localhost:3000/pricing

**Expected Results:**
- Language switcher shows: `ES` (Spanish flag)
- Currency switcher shows: `€ EUR`
- Free plan: `€0/mes`
- Pro plan: `€45/mes` (49 USD × 0.92 rate)
- Business plan: `€183/mes` (199 USD × 0.92 rate)

---

### **Scenario 4: UK User (İngiltere'den Giriş)**

**Detection Logic:**
- Browser language: `en-GB`
- Timezone: `Europe/London`
- **Expected Currency:** GBP (£)

**Test Steps:**
1. Run: `document.cookie = "helvino_currency=GBP;path=/;max-age=15552000"`
2. Refresh page: http://localhost:3000/pricing

**Expected Results:**
- Language switcher shows: `EN`
- Currency switcher shows: `£ GBP`
- Free plan: `£0/mo`
- Pro plan: `£39/mo` (49 USD × 0.79 rate)
- Business plan: `£157/mo` (199 USD × 0.79 rate)

---

### **Scenario 5: Manual Currency Switch**

**Test Steps:**
1. Go to: http://localhost:3000/pricing
2. Click currency switcher (₺, $, €, £)
3. Select different currency (e.g., USD → TRY)

**Expected Results:**
- All prices on page instantly update
- Currency switcher shows new currency
- Cookie `helvino_currency` persists choice
- Prices recalculate correctly

---

### **Scenario 6: Portal Usage Page**

**Test Steps:**
1. Login to portal: http://localhost:3000/portal/login
2. Navigate to: http://localhost:3000/portal/usage
3. Check "Plan Details" section → "Price" card

**Expected Results:**
- If TR locale + TRY: Shows `₺1,690/ay` for Pro
- If EN locale + USD: Shows `$49/mo` for Pro
- If ES locale + EUR: Shows `€45/mes` for Pro

---

## 📊 Conversion Rates (Base: USD)

| Currency | Rate   | Example: $49 → |
|----------|--------|----------------|
| USD      | 1.00   | $49            |
| TRY      | 34.5   | ₺1,690         |
| EUR      | 0.92   | €45            |
| GBP      | 0.79   | £39            |

**Note:** These are static rates. In production, consider fetching real-time rates from an API.

---

## ✅ Test Checklist

### Pricing Page (`/pricing`)
- [ ] Free plan shows `₺0` in Turkish
- [ ] Pro plan shows `₺1,690` in Turkish
- [ ] Business plan shows `₺6,865` in Turkish
- [ ] Currency switcher is visible
- [ ] Manual currency change works
- [ ] Prices recalculate correctly

### Usage Page (`/portal/usage`)
- [ ] Plan Details → Price card shows correct currency
- [ ] Free plan shows "Free" (not `₺0`)
- [ ] Pro plan shows `₺1,690/ay` in Turkish
- [ ] Business plan shows `₺6,865/ay` in Turkish

### Billing Page (`/portal/billing`)
- [ ] Plan comparison table shows correct currency
- [ ] Upgrade CTAs show correct prices
- [ ] Current plan badge works

### Language + Currency Sync
- [ ] TR locale → TRY currency (auto-detect)
- [ ] EN locale → USD/GBP (auto-detect)
- [ ] ES locale → EUR/USD (auto-detect)
- [ ] Cookie persistence works (180 days)

---

## 🐛 Known Issues / Future Improvements

1. **Real-time Rates:** Currently uses static rates. Consider integrating with:
   - https://exchangerate-api.com
   - https://fixer.io
   - https://openexchangerates.org

2. **Stripe Integration:** When upgrading, ensure Stripe prices match currency:
   - Create separate Stripe Price IDs for USD/EUR/TRY/GBP
   - Map currency to correct Price ID before checkout

3. **Tax Display:** VAT/KDV not yet calculated. Consider:
   - Turkey: 20% KDV
   - EU: 19-25% VAT
   - US: varies by state

4. **Currency Formatting:** Currently uses `Intl.NumberFormat`. Ensure:
   - Thousand separators correct (. vs ,)
   - Decimal places correct (TRY = 0, EUR = 0, USD = 0)

---

## 🚀 Quick Test Command

```bash
# Test Turkish
document.cookie = "helvino_lang=tr;path=/;max-age=15552000"; document.cookie = "helvino_currency=TRY;path=/;max-age=15552000"; location.reload();

# Test US
document.cookie = "helvino_lang=en;path=/;max-age=15552000"; document.cookie = "helvino_currency=USD;path=/;max-age=15552000"; location.reload();

# Test Europe
document.cookie = "helvino_lang=es;path=/;max-age=15552000"; document.cookie = "helvino_currency=EUR;path=/;max-age=15552000"; location.reload();
```

---

## 📝 Developer Notes

**Files Modified:**
- `apps/web/src/contexts/CurrencyContext.tsx` - Core currency logic
- `apps/web/src/components/CurrencySwitcher.tsx` - UI component
- `apps/web/src/components/PlanComparisonTable.tsx` - Price display
- `apps/web/src/app/portal/usage/page.tsx` - Usage page integration
- `apps/web/src/components/PublicLayout.tsx` - Header integration
- `apps/web/src/app/providers.tsx` - Provider setup

**API:**
- `useCurrency()` - Hook for currency context
- `formatUsd(amount)` - Convert USD to user currency
- `convert(amount)` - Convert without formatting
- `config` - Current currency config (symbol, name, locale)

**Example Usage:**
```tsx
import { useCurrency } from "@/contexts/CurrencyContext";

function MyComponent() {
  const { formatUsd, currency, config } = useCurrency();
  
  return (
    <div>
      <p>Current: {config.symbol} {currency}</p>
      <p>Pro Plan: {formatUsd(49)}/mo</p>
    </div>
  );
}
```

---

**Test Date:** 2026-02-09  
**Status:** ✅ READY FOR TESTING  
**Next Step:** Manual browser testing + production deployment
