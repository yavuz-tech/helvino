# STEP 11.41 — Live Password Strength Meter + Requirements Checklist

## Overview
A reusable `PasswordStrength` component that provides real-time visual feedback while typing a password. It shows a strength bar and a requirements checklist.

## Component
`apps/web/src/components/PasswordStrength.tsx`

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `password` | `string` | — | Current password value |
| `minLength` | `number` | `8` | Minimum required length |

### Scoring
Simple, deterministic scoring based on 3 requirements:

| Requirement | Check |
|-------------|-------|
| Minimum length | `password.length >= minLength` |
| Contains a letter | `/[a-zA-Z]/` |
| Contains a number | `/\d/` |

Score = count of met requirements (0–3).

| Score | Bar % | Label |
|-------|-------|-------|
| 0 | 0% | — (hidden) |
| 1 | 33% | Weak |
| 2 | 66% | OK |
| 3 | 100% | Strong |

### Visual
- **Strength bar**: Single continuous bar, colored red (weak) / amber (ok) / green (strong)
- **Requirements checklist**: Each requirement shows a tick (met) or cross (not met)
- Component is hidden when password is empty
- No SSR hydration issues (purely client-side, no Date/locale formatting)

## Pages Using It
| Page | File |
|------|------|
| Signup | `apps/web/src/app/signup/page.tsx` |
| Reset Password | `apps/web/src/app/portal/reset-password/page.tsx` |
| Change Password | `apps/web/src/app/portal/security/page.tsx` |

## i18n Keys (EN/TR/ES)
- `passwordStrength.title`
- `passwordStrength.weak` / `.ok` / `.strong`
- `passwordReq.minLength` / `.letter` / `.number`

All keys have full EN/TR/ES parity.

## Alignment with Server Policy
The 3 requirements match the server-side `validatePasswordPolicy()` from `apps/api/src/utils/password-policy.ts` (Step 11.40). The server returns `WEAK_PASSWORD` error code when any requirement is not met.
