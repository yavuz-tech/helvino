# Page Audit Report — Admin, Dashboard & Org-App

**Date:** 2026-02-15  
**Scope:** admin/login, dashboard/*, org-app/* page.tsx files

---

## Executive Summary

| Category | Status |
|----------|--------|
| **Import errors** | ✅ All imports valid |
| **TypeScript issues** | ⚠️ Minor (see details) |
| **Auth protection** | ⚠️ 2 broken logout links |
| **i18n / hardcoded strings** | ⚠️ Several issues |
| **Broken internal links** | ⚠️ 2 incorrect redirects |

---

## 1. ADMIN PAGES

### `admin/login/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid: FingerprintJS, lucide-react, LanguageSwitcher, ErrorBanner, PasskeyLoginButton, TurnstileWidget |
| TypeScript | ✅ | No issues |
| Auth | N/A | Login page — no protection needed |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | Redirects to `/dashboard` on success |

---

## 2. DASHBOARD (ADMIN PANEL) PAGES

### `dashboard/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → redirect to `/login` if unauthenticated |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | `/dashboard/orgs/new`, `/login` (→ `/admin/login`) |

**Note:** Uses `apiFetch("/conversations", { orgKey })` — ensure API route exists.

---

### `dashboard/settings/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid (MfaSetupSection, PasskeySection, design-tokens) |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | `<a href="/dashboard/settings/security">` — use `Link` for SPA navigation |

**Suggestion:** Replace `<a href="...">` with `<Link href="...">` for client-side navigation.

---

### `dashboard/settings/security/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ⚠️ | **Hardcoded placeholder:** `placeholder="example.com or *.example.com"` (line 302) — should use `t("security.domainPlaceholder")` or similar |
| Links | ✅ | `<a href="/dashboard/settings">` — consider `Link` |

---

### `dashboard/orgs/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | `router.push(\`/dashboard/orgs/${org.orgKey}\`)` |

---

### `dashboard/orgs/new/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ⚠️ | **Validation bug:** `websitePattern.test(trimmedName)` — pattern expects URL format (e.g. `example.com`), but label says "Org Name". The `orgNameLabel` may be misleading; the pattern validates domain-like input. |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ⚠️ | **Hardcoded placeholder:** `placeholder="example.com&#10;*.example.com&#10;app.example.com"` (line 264) — should use i18n key |
| Links | ✅ | `/dashboard`, `/dashboard/settings` |

---

### `dashboard/orgs/[orgKey]/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ⚠️ | **Hardcoded strings:** `"Site ID"` (line 226), `"ON"` / `"OFF"` for MFA (line 324) — should use `t("security.siteId")`, `t("common.on")` / `t("common.off")` |
| Links | ✅ | `Link href="/dashboard/orgs"` |

---

### `dashboard/audit/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | Uses `TranslationKey` cast for dynamic keys |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | N/A |

---

### `dashboard/campaigns/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid (Card, PageHeader, premiumToast, `p` from theme) |
| TypeScript | ⚠️ | **API path:** Uses `apiFetch("/internal/organization/settings")` and `apiFetch("/api/promo-codes")` — verify these routes exist (admin vs portal API) |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | N/A |

---

### `dashboard/landing-widget/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ⚠️ | **Hardcoded Turkish defaults:** `welcomeMessage: "Merhaba! 👋 Size nasil yardimci olabilirim?"`, `offlineMessage: "Su an cevrimdisiyiz..."` (lines 45, 53–54) — these are default values loaded from API; if API returns empty, Turkish is shown. Consider locale-aware defaults. |
| Links | ✅ | N/A |

---

### `dashboard/widget/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid (WidgetGallery) |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → `window.location.href = "/login"` |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | `Link href="/dashboard"` |

**Note:** `DashboardLayout` is used without `user` or `onLogout` — the inner `DashboardWidgetContent` handles auth. Layout may show incomplete user dropdown until content mounts.

---

### `dashboard/widget-appearance/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | `WidgetAppearanceUltimateV2` from `@/app/portal/widget-appearance/widget-appearance-v3-ultimate` — file exists |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → `window.location.href = "/login"` |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | `Link href="/dashboard"` |

**Note:** `DashboardLayout user={user}` passed but no `onLogout` — logout in sidebar may not work.

---

### `dashboard/recovery/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ⚠️ | **Hardcoded error messages:** `"Failed to approve"`, `"Failed to reject"` (lines 85, 109) — should use `t("recovery.admin.approveFailed")` etc. |
| Links | ✅ | N/A |

**Note:** `DashboardLayout` used without `user` or `onLogout` — `if (!user) return null` before render.

---

### `dashboard/security/devices/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid (DeviceList) |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkAuth()` → redirect to `/login` |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | N/A |

**Note:** `DashboardLayout` used without `user` or `onLogout`.

---

## 3. ORG-APP PAGES

### `org-app/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid (OrgPortalLayout, org-auth, premiumToast) |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkOrgAuth()` → redirect to `/org-app/login` |
| i18n | ✅ | All strings use `t()` |
| Links | ✅ | N/A |

---

### `org-app/login/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | N/A | Login page; redirects to `/org-app` if already logged in |
| i18n | ⚠️ | **Hardcoded strings:** `"Helvion"` (line 50), `"you@company.com"` (line 75), `"••••••••"` (line 91) — brand name may be intentional; placeholders should use `t()` |
| Links | ✅ | `<a href="/login">` for admin login |

---

### `org-app/settings/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkOrgAuth()` → redirect to `/org-app/login` |
| i18n | ⚠️ | **Hardcoded placeholders:** `"Support Chat"`, `"We're here to help"` (lines 212, 226); language options `"English"`, `"Türkçe"`, etc. (264–268) — consider i18n for placeholders |
| Links | **❌ BROKEN** | **`router.push("/app/login")` on logout (line 83)** — should be `router.push("/org-app/login")`. Route `/app/login` does not exist. |

---

### `org-app/settings/security/page.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| Imports | ✅ | All valid |
| TypeScript | ✅ | No issues |
| Auth | ✅ | `checkOrgAuth()` → redirect to `/org-app/login` |
| i18n | ⚠️ | **Hardcoded placeholder:** `placeholder="example.com or *.example.com"` (line 264) |
| Links | **❌ BROKEN** | **`router.push("/app/login")` on logout (line 76)** — should be `router.push("/org-app/login")`. Route `/app/login` does not exist. |

---

## 4. Summary of Fixes Required

### Critical (Broken Links)

1. **`org-app/settings/page.tsx`** line 83: Change `router.push("/app/login")` → `router.push("/org-app/login")`
2. **`org-app/settings/security/page.tsx`** line 76: Change `router.push("/app/login")` → `router.push("/org-app/login")`

### i18n (Hardcoded Strings)

| File | Line | String | Suggested i18n Key |
|------|------|--------|--------------------|
| `dashboard/settings/security/page.tsx` | 302 | `"example.com or *.example.com"` | `security.domainPlaceholder` |
| `dashboard/orgs/new/page.tsx` | 264 | domain placeholder | `orgs.domainPlaceholder` |
| `dashboard/orgs/[orgKey]/page.tsx` | 226 | `"Site ID"` | `security.siteId` |
| `dashboard/orgs/[orgKey]/page.tsx` | 324 | `"ON"` / `"OFF"` | `common.on` / `common.off` |
| `dashboard/recovery/page.tsx` | 85, 109 | `"Failed to approve"`, `"Failed to reject"` | `recovery.admin.approveFailed`, `recovery.admin.rejectFailed` |
| `org-app/login/page.tsx` | 75, 91 | `"you@company.com"`, `"••••••••"` | `auth.emailPlaceholder`, `auth.passwordPlaceholder` |
| `org-app/settings/page.tsx` | 212, 226 | `"Support Chat"`, `"We're here to help"` | `app.widgetNamePlaceholder`, `app.widgetSubtitlePlaceholder` |
| `org-app/settings/security/page.tsx` | 264 | `"example.com or *.example.com"` | `security.domainPlaceholder` |

### Optional Improvements

- **`dashboard/landing-widget/page.tsx`:** Use locale-aware default messages instead of hardcoded Turkish.
- **`dashboard/settings/page.tsx`**, **`dashboard/settings/security/page.tsx`:** Use `<Link>` instead of `<a href>` for tab navigation.
- **`dashboard/widget-appearance/page.tsx`:** Pass `onLogout` to `DashboardLayout`.
- **`dashboard/recovery/page.tsx`**, **`dashboard/security/devices/page.tsx`:** Pass `user` and `onLogout` to `DashboardLayout` for consistent sidebar behavior.

---

## 5. Import Verification

All imported components exist:

- `@/components/*`: LanguageSwitcher, ErrorBanner, PasskeyLoginButton, TurnstileWidget, DashboardLayout, MfaSetupSection, PasskeySection, EmptyState, ErrorBanner, PageHeader, Card, StatCard, SectionTitle, SystemStatus, MfaPolicyBanner, OnboardingOverlay, SecurityBadges, AdminWidgetHealthSummary, AdminAuditSummary, PremiumToast, DeviceList, WidgetGallery
- `@/app/portal/widget-appearance/widget-appearance-v3-ultimate`: Exists (`.jsx`)
- `@/lib/auth`, `@/lib/org-auth`, `@/utils/api`, `@/contexts/*`, `@/styles/theme`, `@/i18n/*`: All valid

---

*Report generated from static analysis of page.tsx files.*
