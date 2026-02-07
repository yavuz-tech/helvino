# Step 11.27 — Transactional Email System + Signed Links + i18n Templates

## Overview

Step 11.27 adds a production-ready transactional email system to Helvino:

1. **Email provider abstraction** — vendor-agnostic `sendEmail()` with pluggable providers
2. **Signed link generation** — HMAC-signed URLs for invite/reset/recovery/emergency flows
3. **i18n email templates** — HTML templates with EN/TR/ES support
4. **Flow integration** — mail sending wired into existing invite, forgot-password, recovery, and emergency flows

## Architecture

### Email Provider (`apps/api/src/utils/mailer.ts`)

- `sendEmail(payload)` — sends via the configured provider
- `getMailProviderName()` — returns current provider name for diagnostics

Providers:
- **console** (default) — logs email payload to stdout, safe for dev
- **smtp** (stub) — ready for nodemailer/resend/sendgrid integration

Selection via `MAIL_PROVIDER` env var (default: `console`).

### Signed Links (`apps/api/src/utils/signed-links.ts`)

All email links are HMAC-signed with `SIGNED_LINK_SECRET` (falls back to `SESSION_SECRET`).

Link structure: `{APP_PUBLIC_URL}/path?token=...&expires=...&sig=...`

Helpers:
- `generateInviteLink(token, expiresAt)` — portal invite
- `generateResetLink(token, expiresAt)` — password reset
- `generateRecoveryLink(token, expiresAt)` — recovery notification
- `generateEmergencyLink(token, expiresAt)` — emergency access notification
- `verifySignedLink(url)` — signature + expiry verification

### Email Templates (`apps/api/src/utils/email-templates.ts`)

Templates for each flow with full EN/TR/ES support:
- `getInviteEmail(locale, orgName, role, link, expiresIn)`
- `getResetEmail(locale, link, expiresIn)`
- `getRecoveryApprovedEmail(locale, message)`
- `getRecoveryRejectedEmail(locale, reason)`
- `getEmergencyTokenEmail(locale)`

All templates:
- Use responsive HTML email layout
- Branded header with Helvino colors
- Clear CTA buttons
- No jargon (says "authenticator app" not "TOTP")

## Integration Points

| Flow | File | What happens |
|------|------|-------------|
| Portal invite | `portal-team.ts` | Sends invite email with signed link |
| Invite resend | `portal-team.ts` | Regenerates token + sends email |
| Forgot password | `portal-security.ts` | Sends reset email with signed link |
| Recovery approved | `recovery-routes.ts` | Notifies requester of approval |
| Recovery rejected | `recovery-routes.ts` | Notifies requester of rejection |
| Emergency token | `recovery-routes.ts` | Security notification to owner |

All email sends are **best-effort** (`.catch()`) — they never block the API response or cause errors.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAIL_PROVIDER` | No | `console` | Email provider: `console`, `smtp` |
| `MAIL_FROM` | No | `noreply@helvino.com` | Default sender address |
| `SMTP_HOST` | No (prod) | — | SMTP server host |
| `SIGNED_LINK_SECRET` | No | `SESSION_SECRET` | HMAC signing key for links |
| `APP_PUBLIC_URL` | No | `NEXT_PUBLIC_WEB_URL` / `http://localhost:3000` | Base URL for signed links |

## Security Notes

- Email payloads never contain raw tokens or secrets in production
- Signed links use HMAC-SHA256 with timing-safe comparison
- Console provider truncates body output (500 chars)
- Single-use enforcement is handled by the existing token consumption logic (not the link itself)
- Email sends are fire-and-forget; failures are logged but don't affect API responses

## Verification

```bash
bash VERIFY_STEP_11_27.sh
```
