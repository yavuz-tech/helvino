# Step 11.16 — i18n Quality Gate + Shared Language Switcher

## What Changed

| Change | Details |
|--------|---------|
| Public page switcher | `LanguageSwitcher` added to `/` (top-right corner) |
| Verification script | `VERIFY_STEP_11_16.sh` — strict, deterministic quality gate |
| Documentation | This file |

## LanguageSwitcher Placement

The shared `<LanguageSwitcher />` component is used in:

| Area | File | Location |
|------|------|----------|
| Public `/` | `app/page.tsx` | Top-right absolute |
| Admin `/dashboard/*` | `components/DashboardLayout.tsx` | Header right cluster |
| Portal `/portal/*` | `components/PortalLayout.tsx` | Header right cluster |
| App `/app/*` | `components/OrgPortalLayout.tsx` | Header right cluster |
| Login pages | `app/login/page.tsx`, `portal/login/page.tsx`, `app/login/page.tsx` | In form area |

## Language Detection Order

1. **Cookie** `helvino_lang` (180 days, SameSite=Lax) — user's explicit choice
2. **Browser** `navigator.languages` / `navigator.language`
3. **Timezone** `Intl.DateTimeFormat().resolvedOptions().timeZone` → country heuristic
4. **Fallback** → `en`

## SSR/CSR Hydration Safety

- SSR always renders with `DEFAULT_LOCALE` ("en")
- After mount, `useEffect` resolves the real locale
- The `t()` function uses a `mounted` guard to ensure SSR and CSR produce identical output
- `<html lang="en" suppressHydrationWarning>` prevents React warnings

## Quality Gate: VERIFY_STEP_11_16.sh

Runs 6 categories of checks:

1. **Key files** — translations.ts, I18nContext, LanguageSwitcher, docs, cursor rule
2. **Locale parity** — EN/TR/ES must have identical key sets (no missing, no extra)
3. **No duplicates** — No key appears twice in any locale
4. **LanguageSwitcher usage** — Must be present in DashboardLayout, PortalLayout, public page
5. **System integration** — I18nProvider, cookie, browser detection, timezone, hydration guard
6. **Hardcoded string scan** — TSX files scanned for English text not wrapped in `t()`

### Running

```bash
# Single step
bash VERIFY_STEP_11_16.sh

# Full suite
bash VERIFY_ALL.sh
```

## Adding New UI Text

1. Add key to `en` object in `apps/web/src/i18n/translations.ts`
2. Add same key to `tr` and `es` objects (TypeScript will error if you miss one)
3. Use `t("your.key")` in the component via `const { t } = useI18n()`
4. Run `bash VERIFY_STEP_11_16.sh` to validate

## Rules

- **Never** write bare English strings in JSX
- **Always** use `t("key")` for user-visible text
- **Always** add keys to all 3 locales simultaneously
- Naming convention: `"section.camelCase"` (e.g. `"billing.upgradeNow"`)
