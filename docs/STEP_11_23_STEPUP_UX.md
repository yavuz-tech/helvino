# Step 11.23 — Automatic Step-Up UX + TTL + Unified Client Guard

## Overview

Implements a seamless automatic step-up flow on the web client for both admin and portal. When any sensitive API call returns `STEP_UP_REQUIRED`, the system automatically opens a verification modal, and upon success auto-retries the original action exactly once.

## Architecture

### StepUpProvider (`contexts/StepUpContext.tsx`)

A React context provider mounted at the root (`providers.tsx`) that wraps all pages. It exports:

- **`withStepUp(action, area?)`** — wraps any `async () => Promise<Response>` action:
  1. Executes the action.
  2. If response is 403 with `code: "STEP_UP_REQUIRED"`, opens `MfaStepUpModal`.
  3. User enters code → context calls the correct challenge endpoint (admin or portal).
  4. On success, retries the original action **exactly once**.
  5. On cancel or second failure → returns `{ ok: false, cancelled: true }`.

### Area Detection

- If `area` is passed explicitly (`"admin"` or `"portal"`), it is used directly.
- Otherwise, auto-detected from `window.location.pathname`:
  - `/dashboard/*` or `/login` → `"admin"`
  - Everything else → `"portal"`

### TTL Enforcement

Step-up validity is managed server-side (from Steps 11.20/11.21/11.22):
- **Admin**: `session.adminStepUpUntil` (10-minute window)
- **Portal**: `helvino_portal_stepup` cookie (signed, short-lived)

If step-up is still valid within TTL, the API does not return `STEP_UP_REQUIRED` and the modal never opens.

## Protected UI Actions

### Portal
- Security: save allowed domains, rotate siteId, change password, revoke session(s)
- Team: invite, resend invite, revoke invite, change role, deactivate/reactivate
- Billing: checkout, manage subscription (portal session)
- Devices: trust/untrust, remove

### Admin Dashboard
- Billing: save billing settings, start subscription, manage billing portal, lock/unlock, reconcile
- Usage: reset usage, grant quota
- Devices: trust/untrust, remove

## i18n Keys (Step 11.23)

| Key | EN | TR | ES |
|-----|----|----|-----|
| `stepUp.title` | Security confirmation required | Guvenlik dogrulamasi gerekli | Confirmacion de seguridad requerida |
| `stepUp.description` | For your protection... | Guvenliginiz icin... | Para su proteccion... |
| `stepUp.verify` | Verify & continue | Dogrula ve devam et | Verificar y continuar |
| `stepUp.cancel` | Cancel | Iptal | Cancelar |
| `stepUp.invalidCode` | Invalid code... | Gecersiz kod... | Codigo invalido... |
| `stepUp.cancelled` | Action cancelled | Islem iptal edildi | Accion cancelada |
| `stepUp.retryFailed` | Verification succeeded but... | Dogrulama basarili ancak... | La verificacion fue exitosa pero... |

## Non-Breaking

- No backend changes required (reuses 11.22 guard).
- No widget flow changes.
- Login/logout flows unchanged.
- Read-only endpoints (GET) unaffected.
- Users without MFA enabled pass through silently (no modal shown).

## Files Changed

- `apps/web/src/contexts/StepUpContext.tsx` — new context provider
- `apps/web/src/app/providers.tsx` — mount StepUpProvider
- `apps/web/src/components/MfaStepUpModal.tsx` — updated copy, added ShieldCheck icon
- `apps/web/src/i18n/translations.ts` — new stepUp.* keys (EN/TR/ES)
- `apps/web/src/app/portal/security/page.tsx` — wired step-up
- `apps/web/src/app/portal/team/page.tsx` — wired step-up
- `apps/web/src/app/portal/billing/page.tsx` — wired step-up
- `apps/web/src/app/portal/security/devices/page.tsx` — wired step-up
- `apps/web/src/app/dashboard/settings/page.tsx` — wired step-up
- `apps/web/src/app/dashboard/security/devices/page.tsx` — wired step-up
