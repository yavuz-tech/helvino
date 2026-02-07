# Step 11.15 — i18n Coverage + Consistency

## What Was Changed

All remaining hardcoded user-facing strings across the Helvino web app were replaced with `t()` calls from the i18n system. This ensures **complete EN/TR/ES localization** with zero mixed-language UI.

### Files Updated

| Area | Files | Changes |
|------|-------|---------|
| Homepage | `app/page.tsx` | Tagline + system status |
| Admin Settings | `dashboard/settings/page.tsx` | ~20 error messages, labels, status text |
| Admin Security | `dashboard/settings/security/page.tsx` | Error msgs, rotate UI, domain examples |
| Portal Billing | `portal/billing/page.tsx` | Error msgs, status badge, loading states |
| Portal Usage | `portal/usage/page.tsx` | Error msgs, loading states |
| Org Creation | `dashboard/orgs/new/page.tsx` | Organization Name label |
| Dashboard Layout | `components/DashboardLayout.tsx` | Loading + empty state text |
| System Status | `components/SystemStatus.tsx` | Bootloader Calls label |
| Translation Dict | `i18n/translations.ts` | ~50 new keys in EN/TR/ES |
| Verification | `VERIFY_STEP_11_15.sh` | New script |
| Cursor Rule | `.cursor/rules/i18n-enforcement.mdc` | Set to `alwaysApply: true` |

### New Translation Keys Added

- `home.*` — Homepage content
- `settings.failedLoadSettings`, `settings.usageResetSuccess`, etc. — Admin error/success messages
- `security.failedLoadSettings`, `security.siteIdRotated`, `security.examplesTitle`, etc. — Security page
- `billing.failedLoad`, `billing.noSubscription`, `billing.checkoutFailed`, etc. — Portal billing
- `usage.failedLoad` — Portal usage
- `common.networkError` — Shared error
- `orgs.orgNameLabel` — Org creation
- `dashboard.noOrganizations`, `dashboard.bootloaderCalls` — Dashboard layout

## How Language Selection Works

Priority (highest to lowest):

1. **Cookie** `helvino_lang` — If user explicitly chose a language, it persists (180 days, `SameSite=Lax`).
2. **Browser preference** — `navigator.languages` / `navigator.language` checked for `tr`, `es`, or `en`.
3. **Timezone heuristic** — `Intl.DateTimeFormat().resolvedOptions().timeZone` maps Istanbul → `tr`, Madrid/Mexico → `es`.
4. **Fallback** — `en` (English).

The `LanguageSwitcher` component appears in all layout headers (Dashboard, Portal, App) and writes the cookie on change.

## How to Add New UI Text

### Rules (enforced by `.cursor/rules/i18n-enforcement.mdc`)

1. **Never** write bare English strings in JSX.
2. Import `useI18n` and use `const { t } = useI18n();`
3. Add keys to `apps/web/src/i18n/translations.ts` in **all three** locales:
   - `en` (English) — added first, defines the type
   - `tr` (Turkish)
   - `es` (Spanish)
4. Use dot-notation grouping: `"section.keyName"` (e.g., `"settings.title"`, `"billing.upgradeNow"`).

### Example

```tsx
// In translations.ts — EN block:
"myFeature.title": "My Feature",
"myFeature.description": "This is a description",

// In translations.ts — TR block:
"myFeature.title": "Özelliğim",
"myFeature.description": "Bu bir açıklamadır",

// In translations.ts — ES block:
"myFeature.title": "Mi Función",
"myFeature.description": "Esta es una descripción",

// In your component:
import { useI18n } from "@/i18n/I18nContext";

export default function MyFeature() {
  const { t } = useI18n();
  return (
    <div>
      <h1>{t("myFeature.title")}</h1>
      <p>{t("myFeature.description")}</p>
    </div>
  );
}
```

## How to Run Verification

```bash
# Quick check
bash VERIFY_STEP_11_15.sh

# Full suite (includes builds + all step verifications)
bash VERIFY_ALL.sh
```

### What the verification checks:
- Key files exist (translations.ts, I18nContext.tsx, LanguageSwitcher.tsx)
- All three locales have identical key counts (no missing or extra keys)
- No duplicate keys within any locale
- Best-effort scan for hardcoded English strings in TSX files
- i18n system integration (Provider, Switcher, cookie persistence, language detection)
- Cursor rule is active (`alwaysApply: true`)
